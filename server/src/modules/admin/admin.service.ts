// =====================================================================
// PREI | AdminService — ekip performans özeti + audit timeline (gerçek veri).
// 'admin' izni yalnız super_admin'de (permissions.ts) — komisyon/pipeline
// detayları başka bir danışmanın verisidir, RBAC bilinçli olarak dar.
// =====================================================================
import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { randomUUID, randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { MEDIA_BUCKET, StorageService } from '../documents/storage.service';
import type { AppConfig } from '../../config/configuration';
import type { RequestContext } from '../../common/request-context';
import type { UpdateBrandingDto } from './dto/update-branding.dto';
import type { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import type { CreateTeamMemberDto } from './dto/create-team-member.dto';

export interface UploadedLogoLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const ACTION_LABEL: Record<string, string> = {
  'lead.created': 'Yeni aday oluşturdu',
  'lead.updated': 'Aday kaydını güncelledi',
  'contact.created': 'Yeni kişi kaydetti',
  'client.updated': 'Müşteri profilini güncelledi',
  'client.note_created': 'Müşteriye not ekledi',
  'document.uploaded': 'Belge yükledi',
  'document.deleted': 'Belge sildi',
  'task.updated': 'Görev güncelledi',
  'deal.created': 'Yeni işlem oluşturdu',
  'deal.updated': 'İşlem güncelledi',
};

// leads.status (7 değer) → sayfadaki 5 pipeline kovası. 'converted' bu
// görünümde yok (kapanmış işlem → Transactions bölümünde zaten görünür).
const STATUS_BUCKET: Record<string, string> = {
  qualified: 'hotLeads',
  new: 'activeLeads',
  contacted: 'activeLeads',
  nurturing: 'negotiating',
  unqualified: 'frozen',
  lost: 'lost',
};

export interface RoleOption { key: string; name: string }

export interface TeamMemberRow {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  lastActiveAt: string | null;
  clientsRegistered: number;
}

export interface UserDetailKpis {
  salesVolumeEur: number;
  commissionEur: number;
  activeDeals: number;
  conversionRatePct: number;
}
export interface PipelineBucket { key: string; count: number }
export interface PipelineClient {
  id: string; bucket: string; name: string; interest: string | null;
  date: string; reason: string | null;
}
export interface TransactionRow {
  id: string; property: string; client: string; amount: number; currency: string; status: 'open' | 'won' | 'lost';
}
export interface TimelineEntry { id: string; occurredAt: string; label: string; entityType: string }

export interface UserDetail {
  id: string; name: string; role: string; isActive: boolean;
  kpis: UserDetailKpis;
  pipeline: PipelineBucket[];
  pipelineClients: PipelineClient[];
  transactions: TransactionRow[];
  timeline: TimelineEntry[];
}

export interface BrandingSettings {
  companyName: string;
  websiteUrl: string;
  primaryColor: string;
  logoUrl: string;
  offPlanCommissionPct: number;
  secondaryCommissionPct: number;
}

function toBranding(row: { name: string; metadata: Record<string, unknown> | null }): BrandingSettings {
  const m = row.metadata ?? {};
  return {
    companyName: row.name,
    websiteUrl: typeof m.website_url === 'string' ? m.website_url : '',
    primaryColor: typeof m.primary_color === 'string' ? m.primary_color : '#9B5BB3',
    logoUrl: typeof m.logo_url === 'string' ? m.logo_url : '',
    offPlanCommissionPct: typeof m.off_plan_commission_pct === 'number' ? m.off_plan_commission_pct : 50,
    secondaryCommissionPct: typeof m.secondary_commission_pct === 'number' ? m.secondary_commission_pct : 60,
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async listTeam(ctx: RequestContext): Promise<TeamMemberRow[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{
        id: string; full_name: string; is_active: boolean; role: string | null;
        last_active: string | null; clients_registered: string;
      }>(
        `SELECT u.id, u.full_name, u.is_active,
                (SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                   WHERE ur.user_id = u.id LIMIT 1) AS role,
                (SELECT max(occurred_at) FROM audit_log WHERE actor_id = u.id) AS last_active,
                (SELECT count(*) FROM contacts ct WHERE ct.created_by = u.id AND ct.deleted_at IS NULL) AS clients_registered
           FROM users u
          WHERE u.deleted_at IS NULL AND u.email NOT LIKE '%@prei.system'
          ORDER BY u.full_name ASC`,
      );
      return rows.map((r) => ({
        id: r.id,
        name: r.full_name,
        role: r.role ?? 'consultant',
        isActive: r.is_active,
        lastActiveAt: r.last_active,
        clientsRegistered: Number(r.clients_registered),
      }));
    });
  }

  /** Güçlü geçici şifre üretir (büyük/küçük/rakam/simge içerir, tahmini zor). */
  private generateTempPassword(): string {
    // 18 baytlık base64url gövde + garantili karakter sınıfları.
    const body = randomBytes(18).toString('base64').replace(/[+/=]/g, '');
    return `Pr!${body}9`;
  }

  /** Supabase Auth Admin API ile e-posta/şifreli kullanıcı oluşturur (e-posta onaylı). */
  private async createSupabaseAuthUser(email: string, password: string, fullName: string): Promise<void> {
    const sb = this.config.get('supabase', { infer: true });
    const res = await fetch(`${sb.url.replace(/\/$/, '')}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: sb.serviceRoleKey,
        Authorization: `Bearer ${sb.serviceRoleKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true, // hesap hemen giriş yapabilir; şifreyi sonra kendi değiştirir
        user_metadata: { full_name: fullName },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Supabase 422: e-posta zaten kayıtlı
      if (res.status === 422 || text.includes('already been registered')) {
        throw new ConflictException('Bu e-posta ile bir Supabase hesabı zaten var.');
      }
      throw new InternalServerErrorException(`Auth kullanıcısı oluşturulamadı (${res.status}): ${text.slice(0, 200)}`);
    }
  }

  /** Supabase Auth kullanıcısını e-posta ile bulur ve siler (rollback için). */
  private async deleteSupabaseAuthUserByEmail(email: string): Promise<void> {
    const sb = this.config.get('supabase', { infer: true });
    const headers = { apikey: sb.serviceRoleKey, Authorization: `Bearer ${sb.serviceRoleKey}` };
    const listRes = await fetch(
      `${sb.url.replace(/\/$/, '')}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
      { headers },
    );
    if (!listRes.ok) return;
    const data = (await listRes.json()) as { users?: Array<{ id: string; email?: string }> };
    const match = (data.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!match) return;
    await fetch(`${sb.url.replace(/\/$/, '')}/auth/v1/admin/users/${match.id}`, {
      method: 'DELETE',
      headers,
    }).catch(() => undefined);
  }

  /**
   * Yeni ekip üyesi oluşturur: Supabase Auth hesabı (geçici şifre) + PREI users
   * satırı + rol ataması. Geçici şifreyi BİR KEZ döndürür (sadece bu yanıtta).
   * Sıra: Auth önce (en olası hata kaynağı) → DB. DB başarısızsa Auth geri alınır.
   */
  async createTeamMember(
    ctx: RequestContext,
    dto: CreateTeamMemberDto,
  ): Promise<{ member: TeamMemberRow; tempPassword: string }> {
    const email = dto.email.trim().toLowerCase();
    const fullName = dto.fullName.trim();

    // Ön kontroller (Auth hesabı oluşturmadan önce) — RLS bağlamında.
    const roleId = await this.db.withContext(ctx, async (c) => {
      const { rows: existing } = await c.query<{ id: string }>(
        `SELECT id FROM users WHERE tenant_id = $1 AND lower(email) = $2 AND deleted_at IS NULL`,
        [ctx.tenantId, email],
      );
      if (existing.length > 0) throw new ConflictException('Bu e-posta ile aktif bir kullanıcı zaten var.');
      const { rows: roleRows } = await c.query<{ id: string }>(
        `SELECT id FROM roles WHERE tenant_id = $1 AND key = $2`,
        [ctx.tenantId, dto.roleKey],
      );
      if (roleRows.length === 0) throw new BadRequestException(`Bilinmeyen rol: ${dto.roleKey}`);
      return roleRows[0].id;
    });

    const tempPassword = this.generateTempPassword();
    await this.createSupabaseAuthUser(email, tempPassword, fullName);

    try {
      const member = await this.db.withContext(ctx, async (c) => {
        const { rows } = await c.query<{ id: string }>(
          `INSERT INTO users (tenant_id, email, full_name, phone, is_active)
           VALUES ($1,$2,$3,$4,true)
           RETURNING id`,
          [ctx.tenantId, email, fullName, dto.phone?.trim() || null],
        );
        const userId = rows[0].id;
        await c.query(
          `INSERT INTO user_roles (tenant_id, user_id, role_id, created_by) VALUES ($1,$2,$3,$4)`,
          [ctx.tenantId, userId, roleId, ctx.userId],
        );
        await c.query(
          `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
           VALUES ($1,$2,'team_member.created','user',$3,$4,$5)`,
          [ctx.tenantId, ctx.userId, userId, JSON.stringify({ email, roleKey: dto.roleKey }), ctx.correlationId],
        );
        return {
          id: userId,
          name: fullName,
          role: dto.roleKey,
          isActive: true,
          lastActiveAt: null,
          clientsRegistered: 0,
        } satisfies TeamMemberRow;
      });
      return { member, tempPassword };
    } catch (err) {
      // DB yazımı başarısız → yetim Auth hesabını geri al (best-effort).
      await this.deleteSupabaseAuthUserByEmail(email);
      throw err;
    }
  }

  async listRoles(ctx: RequestContext): Promise<RoleOption[]> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<RoleOption>(
        `SELECT key, name FROM roles WHERE tenant_id = $1 ORDER BY name ASC`,
        [ctx.tenantId],
      );
      return rows;
    });
  }

  /** Rol atar (mevcut atamaların yerine geçer — UI tek-rol seçtirir) ve/veya aktiflik günceller. */
  async updateTeamMember(ctx: RequestContext, userId: string, dto: UpdateTeamMemberDto): Promise<TeamMemberRow> {
    if (userId === ctx.userId && (dto.isActive === false || (dto.roleKey && dto.roleKey !== 'super_admin'))) {
      throw new ForbiddenException('Kendi hesabınızı devre dışı bırakamaz veya yetkinizi düşüremezsiniz.');
    }
    return this.db.withContext(ctx, async (c) => {
      const { rows: userRows } = await c.query<{ id: string; full_name: string; is_active: boolean }>(
        `SELECT id, full_name, is_active FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [userId, ctx.tenantId],
      );
      if (userRows.length === 0) throw new NotFoundException('Kullanıcı bulunamadı');

      if (dto.roleKey) {
        const { rows: roleRows } = await c.query<{ id: string }>(
          `SELECT id FROM roles WHERE tenant_id = $1 AND key = $2`,
          [ctx.tenantId, dto.roleKey],
        );
        if (roleRows.length === 0) throw new BadRequestException(`Bilinmeyen rol: ${dto.roleKey}`);
        await c.query(`DELETE FROM user_roles WHERE user_id = $1 AND tenant_id = $2`, [userId, ctx.tenantId]);
        await c.query(
          `INSERT INTO user_roles (tenant_id, user_id, role_id, created_by) VALUES ($1,$2,$3,$4)`,
          [ctx.tenantId, userId, roleRows[0].id, ctx.userId],
        );
      }
      if (dto.isActive !== undefined) {
        await c.query(`UPDATE users SET is_active = $2 WHERE id = $1`, [userId, dto.isActive]);
      }
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'team_member.updated','user',$3,$4,$5)`,
        [ctx.tenantId, ctx.userId, userId, JSON.stringify(dto), ctx.correlationId],
      );

      const { rows } = await c.query<{
        id: string; full_name: string; is_active: boolean; role: string | null;
        last_active: string | null; clients_registered: string;
      }>(
        `SELECT u.id, u.full_name, u.is_active,
                (SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                   WHERE ur.user_id = u.id LIMIT 1) AS role,
                (SELECT max(occurred_at) FROM audit_log WHERE actor_id = u.id) AS last_active,
                (SELECT count(*) FROM contacts ct WHERE ct.created_by = u.id AND ct.deleted_at IS NULL) AS clients_registered
           FROM users u WHERE u.id = $1`,
        [userId],
      );
      const r = rows[0];
      return {
        id: r.id, name: r.full_name, role: r.role ?? 'consultant', isActive: r.is_active,
        lastActiveAt: r.last_active, clientsRegistered: Number(r.clients_registered),
      };
    });
  }

  async userDetail(ctx: RequestContext, userId: string): Promise<UserDetail> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: userRows } = await c.query<{ id: string; full_name: string; is_active: boolean; role: string | null }>(
        `SELECT u.id, u.full_name, u.is_active,
                (SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                   WHERE ur.user_id = u.id LIMIT 1) AS role
           FROM users u WHERE u.id = $1 AND u.deleted_at IS NULL`,
        [userId],
      );
      const user = userRows[0];
      if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

      const { rows: kpiRows } = await c.query<{
        sales_volume_eur: string; commission_eur: string; active_deals: string;
        total_leads: string; won_deals: string;
      }>(
        `SELECT
           (SELECT COALESCE(SUM(fx.amount_eur),0) FROM deals d
              LEFT JOIN LATERAL fx_to_eur(d.amount, d.currency) fx ON true
             WHERE d.owner_id = $1 AND d.status = 'won' AND d.deleted_at IS NULL) AS sales_volume_eur,
           (SELECT COALESCE(SUM(fx.amount_eur),0) FROM financials f
              JOIN deals d ON d.id = f.deal_id
              LEFT JOIN LATERAL fx_to_eur(f.amount, f.currency) fx ON true
             WHERE d.owner_id = $1 AND f.type = 'commission' AND f.status = 'paid' AND f.deleted_at IS NULL) AS commission_eur,
           (SELECT count(*) FROM deals WHERE owner_id = $1 AND status = 'open' AND deleted_at IS NULL) AS active_deals,
           (SELECT count(*) FROM leads WHERE owner_id = $1 AND deleted_at IS NULL) AS total_leads,
           (SELECT count(*) FROM deals WHERE owner_id = $1 AND status = 'won' AND deleted_at IS NULL) AS won_deals`,
        [userId],
      );
      const k = kpiRows[0];
      const totalLeads = Number(k.total_leads);
      const wonDeals = Number(k.won_deals);

      const { rows: pipelineRows } = await c.query<{
        id: string; status: string; name: string; interest: string | null; date: string; reason: string | null;
      }>(
        `SELECT l.id, l.status,
                trim(concat(ct.first_name, ' ', coalesce(ct.last_name, ''))) AS name,
                coalesce(l.pref_city, l.pref_property_type::text) AS interest,
                l.updated_at AS date, l.notes AS reason
           FROM leads l
           JOIN contacts ct ON ct.id = l.contact_id
          WHERE l.owner_id = $1 AND l.deleted_at IS NULL AND l.status <> 'converted'
          ORDER BY l.updated_at DESC`,
        [userId],
      );
      const pipelineClients: PipelineClient[] = pipelineRows
        .map((r) => ({
          id: r.id, bucket: STATUS_BUCKET[r.status] ?? 'activeLeads', name: r.name,
          interest: r.interest, date: r.date, reason: r.reason,
        }));
      const bucketCounts = new Map<string, number>();
      for (const p of pipelineClients) bucketCounts.set(p.bucket, (bucketCounts.get(p.bucket) ?? 0) + 1);
      const pipeline: PipelineBucket[] = ['hotLeads', 'activeLeads', 'negotiating', 'frozen', 'lost']
        .map((key) => ({ key, count: bucketCounts.get(key) ?? 0 }));

      const { rows: dealRows } = await c.query<{
        id: string; property: string | null; client: string; amount: string; currency: string; status: string;
      }>(
        `SELECT d.id, p.title AS property,
                trim(concat(ct.first_name, ' ', coalesce(ct.last_name, ''))) AS client,
                d.amount, d.currency, d.status
           FROM deals d
           JOIN leads l ON l.id = d.lead_id
           JOIN contacts ct ON ct.id = l.contact_id
           LEFT JOIN properties p ON p.id = d.property_id
          WHERE d.owner_id = $1 AND d.deleted_at IS NULL
          ORDER BY d.updated_at DESC LIMIT 10`,
        [userId],
      );
      const transactions: TransactionRow[] = dealRows.map((r) => ({
        id: r.id, property: r.property ?? '—', client: r.client,
        amount: Number(r.amount), currency: r.currency, status: r.status as TransactionRow['status'],
      }));

      const { rows: auditRows } = await c.query<{ id: string; action: string; entity_type: string; occurred_at: string }>(
        `SELECT id, action, entity_type, occurred_at FROM audit_log
          WHERE actor_id = $1 ORDER BY occurred_at DESC LIMIT 20`,
        [userId],
      );
      const timeline: TimelineEntry[] = auditRows.map((r) => ({
        id: r.id, occurredAt: r.occurred_at, entityType: r.entity_type,
        label: ACTION_LABEL[r.action] ?? r.action,
      }));

      return {
        id: user.id, name: user.full_name, role: user.role ?? 'consultant', isActive: user.is_active,
        kpis: {
          salesVolumeEur: Number(k.sales_volume_eur),
          commissionEur: Number(k.commission_eur),
          activeDeals: Number(k.active_deals),
          conversionRatePct: totalLeads > 0 ? (wonDeals / totalLeads) * 100 : 0,
        },
        pipeline, pipelineClients, transactions, timeline,
      };
    });
  }

  async getBranding(ctx: RequestContext): Promise<BrandingSettings> {
    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ name: string; metadata: Record<string, unknown> | null }>(
        `SELECT name, metadata FROM tenants WHERE id = $1`,
        [ctx.tenantId],
      );
      return toBranding(rows[0]);
    });
  }

  async updateBranding(ctx: RequestContext, dto: UpdateBrandingDto): Promise<BrandingSettings> {
    const metadataPatch: Record<string, unknown> = {};
    if (dto.websiteUrl !== undefined) metadataPatch.website_url = dto.websiteUrl;
    if (dto.primaryColor !== undefined) metadataPatch.primary_color = dto.primaryColor;
    if (dto.offPlanCommissionPct !== undefined) metadataPatch.off_plan_commission_pct = dto.offPlanCommissionPct;
    if (dto.secondaryCommissionPct !== undefined) metadataPatch.secondary_commission_pct = dto.secondaryCommissionPct;

    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ name: string; metadata: Record<string, unknown> | null }>(
        `UPDATE tenants SET
           name     = COALESCE($2, name),
           metadata = metadata || $3::jsonb
         WHERE id = $1
         RETURNING name, metadata`,
        [ctx.tenantId, dto.companyName ?? null, JSON.stringify(metadataPatch)],
      );
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'branding.updated','tenant',$1,$3,$4)`,
        [ctx.tenantId, ctx.userId, JSON.stringify(metadataPatch), ctx.correlationId],
      );
      return toBranding(rows[0]);
    });
  }

  /** Şirket logosunu media bucket'ına yükler, public URL'i tenant'a yazar. */
  async uploadLogo(ctx: RequestContext, file: UploadedLogoLike): Promise<BrandingSettings> {
    if (!file) throw new BadRequestException('Logo dosyası gelmedi.');
    if (!ALLOWED_LOGO_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Desteklenmeyen logo türü: ${file.mimetype}`);
    }
    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException('Logo çok büyük (maks 2MB).');
    }
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    const path = `branding/${ctx.tenantId}/${randomUUID()}-${safeName}`;
    await this.storage.upload(path, file.buffer, file.mimetype, MEDIA_BUCKET);
    const logoUrl = this.storage.publicUrl(path);

    return this.db.withContext(ctx, async (c) => {
      const { rows } = await c.query<{ name: string; metadata: Record<string, unknown> | null }>(
        `UPDATE tenants SET metadata = metadata || $2::jsonb
          WHERE id = $1 RETURNING name, metadata`,
        [ctx.tenantId, JSON.stringify({ logo_url: logoUrl })],
      );
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, entity_type, entity_id, diff, correlation_id)
         VALUES ($1,$2,'branding.logo_uploaded','tenant',$1,$3,$4)`,
        [ctx.tenantId, ctx.userId, JSON.stringify({ logo_url: logoUrl }), ctx.correlationId],
      );
      return toBranding(rows[0]);
    });
  }
}
