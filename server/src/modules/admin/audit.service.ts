// =====================================================================
// PREI | AuditService — süper admin denetim konsolu.
//
// "Kim ne yaptı" sorusunun tam cevabı: audit_log (insan eylemleri) ve
// events (sistem/Eylül olayları) TEK akışta birleşir, her satır şununla
// zenginleşir:
//   - aktörün adı (kullanıcı mı, Eylül mü)
//   - dokunulan kaydın İNSAN OKUNUR adı (hangi müşteri, hangi proje)
//   - kaydın kendisine gidecek bağlantı
//   - ne değiştiği (diff özeti)
//
// YETKİ: yalnız 'audit_full' izni (süper admin). Bu, sistemdeki en geniş
// görüş açısıdır — açık ve tek bir izne bağlıdır, örtük değil.
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';
import { ACTION_LABELS, actionSeverity, entityRoute, summarizeDiff, type DiffField } from './audit.util';

export interface ActivityFilters {
  actorId?: string;
  entityType?: string;
  action?: string;
  /** Tek bir kaydın geçmişi için — "bu yatırımcının profilinde ne oldu?" */
  entityId?: string;
  /** 'human' = audit_log, 'system' = events, boş = ikisi */
  source?: 'human' | 'system';
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityRow {
  id: string;
  source: 'human' | 'system';
  occurredAt: string;
  actorId: string | null;
  actorName: string;
  action: string;
  actionLabel: string;
  severity: 'normal' | 'notable' | 'critical';
  entityType: string;
  entityId: string;
  /** Dokunulan kaydın insan okunur adı — "hangi müşteri" sorusunun cevabı. */
  entityLabel: string | null;
  /** Kaydın kendisine giden rota; yoksa null. */
  entityRoute: string | null;
  changes: DiffField[];
}

export interface ActivityPage {
  rows: ActivityRow[];
  total: number;
  hasMore: boolean;
}

export interface ActorSummary {
  id: string;
  name: string;
  role: string | null;
  isActive: boolean;
  actions: number;
  lastActiveAt: string | null;
}

/**
 * Varlık adını çözen ortak SQL parçası. Her tip için ayrı sorgu atmak
 * yerine tek LATERAL ile çözülür — N+1 yok.
 */
const ENTITY_LABEL_SQL = `
  CASE a.entity_type
    WHEN 'contact' THEN (SELECT NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), '')
                           FROM contacts c WHERE c.id = a.entity_id)
    WHEN 'client'  THEN (SELECT NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), '')
                           FROM contacts c WHERE c.id = a.entity_id)
    WHEN 'lead'    THEN (SELECT NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), '')
                           FROM leads l JOIN contacts c ON c.id = l.contact_id WHERE l.id = a.entity_id)
    WHEN 'deal'    THEN (SELECT NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), '')
                           FROM deals d JOIN leads l ON l.id = d.lead_id
                           JOIN contacts c ON c.id = l.contact_id WHERE d.id = a.entity_id)
    WHEN 'project' THEN (SELECT p.title FROM properties p WHERE p.id = a.entity_id)
    WHEN 'property' THEN (SELECT p.title FROM properties p WHERE p.id = a.entity_id)
    WHEN 'developer' THEN (SELECT o.name FROM organizations o WHERE o.id = a.entity_id)
    WHEN 'proposal' THEN (SELECT pr.title FROM proposals pr WHERE pr.id = a.entity_id)
    WHEN 'task'    THEN (SELECT t.title FROM tasks t WHERE t.id = a.entity_id)
    WHEN 'meeting' THEN (SELECT t.title FROM tasks t WHERE t.id = a.entity_id)
    WHEN 'document' THEN (SELECT dv.name FROM documents_vault dv WHERE dv.id = a.entity_id)
    WHEN 'user'    THEN (SELECT u.full_name FROM users u WHERE u.id = a.entity_id)
    ELSE NULL
  END`;

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Birleşik etkinlik akışı. audit_log ve events UNION ile tek listede;
   * her satır aktör adı + varlık adı + değişiklik özetiyle zenginleşir.
   */
  async activity(ctx: RequestContext, f: ActivityFilters): Promise<ActivityPage> {
    const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
    const offset = Math.max(f.offset ?? 0, 0);

    return this.db.withContext(ctx, async (c) => {
      const params: unknown[] = [
        f.actorId ?? null,      // $1
        f.entityType ?? null,   // $2
        f.action ?? null,       // $3
        f.from ?? null,         // $4
        f.to ?? null,           // $5
        f.search ? `%${f.search}%` : null, // $6
        f.source ?? null,       // $7
        f.entityId ?? null,     // $8
      ];

      // İki kaynağı ortak sütun setine indirger. events'te diff yoktur;
      // payload'ı 'after' gibi ele alırız (Eylül'ün mesajı vb. görünür).
      const unionSql = `
        WITH combined AS (
          SELECT 'human'::text AS source, al.id, al.occurred_at, al.actor_id,
                 al.action, al.entity_type, al.entity_id, al.diff
            FROM audit_log al
           WHERE ($7::text IS NULL OR $7 = 'human')
          UNION ALL
          SELECT 'system'::text AS source, ev.id, ev.occurred_at, ev.created_by AS actor_id,
                 ev.event_type AS action, ev.aggregate_type AS entity_type,
                 ev.aggregate_id AS entity_id,
                 jsonb_build_object('after', ev.payload) AS diff
            FROM events ev
           WHERE ($7::text IS NULL OR $7 = 'system')
        ),
        a AS (
          SELECT combined.*,
                 COALESCE(u.full_name, 'Sistem') AS actor_name
            FROM combined
            LEFT JOIN users u ON u.id = combined.actor_id
        )
        SELECT a.source, a.id, a.occurred_at::text, a.actor_id, a.actor_name,
               a.action, a.entity_type, a.entity_id, a.diff,
               ${ENTITY_LABEL_SQL} AS entity_label
          FROM a
         WHERE ($1::uuid IS NULL OR a.actor_id = $1)
           AND ($2::text IS NULL OR a.entity_type = $2)
           AND ($3::text IS NULL OR a.action = $3)
           AND ($4::timestamptz IS NULL OR a.occurred_at >= $4)
           AND ($5::timestamptz IS NULL OR a.occurred_at <= $5)
           AND ($8::uuid IS NULL OR a.entity_id = $8)`;

      // Arama varlık ADI üzerinde — "Kudret" yazınca o müşteriye dokunan
      // her işlem çıksın. Alt sorgu şart: alias WHERE'de kullanılamaz.
      const searchWrap = `
        SELECT * FROM (${unionSql}) q
         WHERE ($6::text IS NULL OR q.entity_label ILIKE $6 OR q.actor_name ILIKE $6)`;

      const { rows } = await c.query<{
        source: 'human' | 'system'; id: string; occurred_at: string;
        actor_id: string | null; actor_name: string; action: string;
        entity_type: string; entity_id: string;
        diff: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
        entity_label: string | null;
      }>(
        `${searchWrap} ORDER BY q.occurred_at DESC LIMIT ${limit + 1} OFFSET ${offset}`,
        params,
      );

      const { rows: cnt } = await c.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM (${searchWrap}) t`, params,
      );

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;

      return {
        rows: page.map((r) => ({
          id: r.id,
          source: r.source,
          occurredAt: r.occurred_at,
          actorId: r.actor_id,
          actorName: r.actor_name,
          action: r.action,
          actionLabel: ACTION_LABELS[r.action] ?? r.action,
          severity: actionSeverity(r.action),
          entityType: r.entity_type,
          entityId: r.entity_id,
          entityLabel: r.entity_label,
          entityRoute: entityRoute(r.entity_type, r.entity_id),
          changes: summarizeDiff(r.diff),
        })),
        total: Number(cnt[0]?.total ?? 0),
        hasMore,
      };
    });
  }

  /** Aktör listesi + eylem sayıları — filtre açılır menüsü ve genel bakış. */
  async actors(ctx: RequestContext): Promise<ActorSummary[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        id: string; full_name: string; role: string | null; is_active: boolean;
        actions: string; last_active: string | null;
      }>(
        `SELECT u.id, u.full_name, u.is_active,
                (SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                  WHERE ur.user_id = u.id LIMIT 1) AS role,
                (SELECT count(*)::text FROM audit_log al WHERE al.actor_id = u.id) AS actions,
                (SELECT max(al.occurred_at)::text FROM audit_log al WHERE al.actor_id = u.id) AS last_active
           FROM users u
          WHERE u.deleted_at IS NULL
          ORDER BY u.full_name`,
      );
      return rows.map((r) => ({
        id: r.id, name: r.full_name, role: r.role, isActive: r.is_active,
        actions: Number(r.actions), lastActiveAt: r.last_active,
      }));
    });
  }

  /**
   * Bir kaydın TÜM geçmişi — "bu yatırımcının profilinde ne oldu?".
   * Kullanıcı odaklı akışın tersi: varlık odaklı.
   */
  async entityHistory(
    ctx: RequestContext, entityId: string, limit = 100,
  ): Promise<ActivityRow[]> {
    const page = await this.activity(ctx, { entityId, limit });
    return page.rows;
  }
}
