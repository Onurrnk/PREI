// =====================================================================
// PREI | DashboardService — Command Center özeti (gerçek aggregate).
// Karışık para birimleri fx_to_eur ile EUR bazına çevrilir (K-6/B-7).
// Trend serileri gerçek veriden TÜRETİLİR (durum geçmişi tablosu yok):
//  - pipeline/activeLeads: created_at <= hafta sonu olan, bugün aktif leadler
//    (birikimli büyüme eğrisi — geriye dönük durum bilinmediği için yaklaşım)
//  - closedWon: converted leadlerin updated_at'ine göre birikimli toplam
//  - meetings: o haftaya düşen toplantı sayısı (due_date, birebir gerçek)
// =====================================================================
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { RequestContext } from '../../common/request-context';

const ACTIVE_STATUSES = "('new','contacted','qualified','nurturing')";

const MARKET_NAME: Record<string, string> = {
  TR: 'Türkiye', AE: 'Dubai (UAE)', ES: 'Spain', GB: 'United Kingdom', TH: 'Thailand', DE: 'Germany',
  US: 'United States', FR: 'France', RU: 'Russia', SA: 'Saudi Arabia', QA: 'Qatar',
  KW: 'Kuwait', IR: 'Iran', AZ: 'Azerbaijan', NL: 'Netherlands',
  XX: 'Diğer',
};

export interface MarketSplitItem { code: string; name: string; valueEur: number }

export interface WeeklyTrends {
  weeks: string[];          // 'W14' … (son 12 ISO haftası)
  pipelineEur: number[];
  activeLeads: number[];
  meetings: number[];
  closedWonEur: number[];
}

export interface LeadSourceItem { name: string; value: number }

/** Ülkeye göre müşteri coğrafyası — harita kartını besler. Ülke, marketSplit
 *  ile AYNI türetim zinciriyle bulunur (target_market_code → para birimi →
 *  telefon ülke kodu); ek olarak kişi sayısı telefon kodundan türetilir. */
export interface GeographyItem {
  code: string;          // ISO-2 (TR, GB, AE, ES, US...) veya XX
  name: string;
  contacts: number;      // bu ülkeden kişi sayısı
  activeLeads: number;   // aktif aday sayısı
  pipelineEur: number;   // aktif pipeline değeri (EUR)
}

/** Marketing entegrasyonu — ad_spend tablosundan son 30 günün özeti. */
export interface DashboardMarketing {
  hasSpendData: boolean;
  adSpend30dEur: number;
  avgCpl30dEur: number | null;
  leads30d: number;
  spendByMarket: { code: string; name: string; valueEur: number }[];
}

export interface DashboardSummary {
  activeLeads: number;
  pipelineValueEur: number;
  closedWonEur: number;
  proposalsActive: number;
  meetingsThisWeek: number;
  marketSplit: MarketSplitItem[];
  trends: WeeklyTrends;
  leadSources: LeadSourceItem[];
  geography: GeographyItem[];
  marketing: DashboardMarketing;
}

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async summary(ctx: RequestContext): Promise<DashboardSummary> {
    return this.db.withContext(ctx, async (c) => {
      const { rows: kpi } = await c.query<{
        active_leads: string; pipeline_eur: string; closed_won_eur: string;
        proposals_active: string; meetings_week: string;
      }>(
        `SELECT
           (SELECT count(*) FROM leads
              WHERE deleted_at IS NULL AND status IN ${ACTIVE_STATUSES}) AS active_leads,
           (SELECT COALESCE(SUM(fx.amount_eur),0) FROM leads l
              LEFT JOIN LATERAL fx_to_eur(l.budget_max, l.currency) fx ON true
              WHERE l.deleted_at IS NULL AND l.status IN ${ACTIVE_STATUSES}) AS pipeline_eur,
           -- Kapanan satış = GERÇEK kazanılmış anlaşma (deals.status='won'),
           -- lead bütçesi DEĞİL. Eskiden leads.status='converted' toplamıydı;
           -- "Müşteriye çevir" o statüyü yazınca bütçeler sahte ciro olarak
           -- görünüyordu. Tek doğru kaynak: deals.amount.
           (SELECT COALESCE(SUM(fx.amount_eur),0) FROM deals d
              LEFT JOIN LATERAL fx_to_eur(d.amount, d.currency) fx ON true
              WHERE d.deleted_at IS NULL AND d.status = 'won') AS closed_won_eur,
           (SELECT count(*) FROM proposals
              WHERE deleted_at IS NULL AND status IN ('sent','viewed','accepted')) AS proposals_active,
           (SELECT count(*) FROM tasks
              WHERE deleted_at IS NULL AND task_type = 'meeting'
                AND due_date >= date_trunc('week', now())
                AND due_date <  date_trunc('week', now()) + interval '7 days') AS meetings_week`,
      );

      // Pazar (market) çıkarımı — öncelik sırası: (1) açık target_market_code,
      // (2) işlem para birimi (GBP→GB, TRY→TR, AED→AE, EUR→ES; USD belirsiz
      // olduğu için atlanır), (3) müşteri telefon ülke kodu (+90/+44/+971/+34).
      // Hiçbiri yoksa 'XX' (Diğer). Uydurma değil — gerçek alanlardan türetilir;
      // target_market_code dolarsa her zaman o kazanır (ileriye dönük doğru).
      const { rows: markets } = await c.query<{ code: string; value_eur: string }>(
        `SELECT
           COALESCE(
             l.target_market_code,
             CASE l.currency
               WHEN 'GBP' THEN 'GB' WHEN 'TRY' THEN 'TR'
               WHEN 'AED' THEN 'AE' WHEN 'EUR' THEN 'ES'
             END,
             CASE
               WHEN ct.phone LIKE '+90%'  THEN 'TR'
               WHEN ct.phone LIKE '+44%'  THEN 'GB'
               WHEN ct.phone LIKE '+971%' THEN 'AE'
               WHEN ct.phone LIKE '+34%'  THEN 'ES'
             END,
             'XX'
           ) AS code,
           COALESCE(SUM(fx.amount_eur),0) AS value_eur
           FROM leads l
           LEFT JOIN LATERAL fx_to_eur(l.budget_max, l.currency) fx ON true
           LEFT JOIN contacts ct ON ct.id = l.contact_id
          WHERE l.deleted_at IS NULL AND l.status IN ${ACTIVE_STATUSES}
          GROUP BY 1
          ORDER BY value_eur DESC`,
      );

      // Son 12 ISO haftası için türetilmiş trend serileri (başlık yorumuna bkz.)
      const { rows: trendRows } = await c.query<{
        iso_week: string; pipeline_eur: string; active_leads: string;
        meetings: string; closed_won_eur: string;
      }>(
        `WITH weeks AS (
           SELECT date_trunc('week', now()) - (i || ' weeks')::interval AS week_start
             FROM generate_series(11, 0, -1) AS i
         )
         SELECT to_char(week_start, 'IW') AS iso_week,
           (SELECT COALESCE(SUM(fx.amount_eur),0) FROM leads l
              LEFT JOIN LATERAL fx_to_eur(l.budget_max, l.currency) fx ON true
             WHERE l.deleted_at IS NULL AND l.status IN ${ACTIVE_STATUSES}
               AND l.created_at < week_start + interval '7 days') AS pipeline_eur,
           (SELECT count(*) FROM leads
             WHERE deleted_at IS NULL AND status IN ${ACTIVE_STATUSES}
               AND created_at < week_start + interval '7 days') AS active_leads,
           (SELECT count(*) FROM tasks
             WHERE deleted_at IS NULL AND task_type = 'meeting'
               AND due_date >= week_start AND due_date < week_start + interval '7 days') AS meetings,
           -- Haftalık birikimli kapanan satış — gerçek anlaşmalardan
           -- (closed_at yoksa updated_at'e düşer).
           (SELECT COALESCE(SUM(fx.amount_eur),0) FROM deals d
              LEFT JOIN LATERAL fx_to_eur(d.amount, d.currency) fx ON true
             WHERE d.deleted_at IS NULL AND d.status = 'won'
               AND COALESCE(d.closed_at, d.updated_at) < week_start + interval '7 days') AS closed_won_eur
           FROM weeks ORDER BY week_start`,
      );

      // Lead kaynakları (son 30 gün): lead_sources adı → yoksa kişinin İLK
      // iletişim kanalı (whatsapp/telegram/…) → o da yoksa 'Direct'.
      const { rows: sourceRows } = await c.query<{ name: string; value: string }>(
        `SELECT COALESCE(ls.name,
                  initcap((SELECT cm.channel::text FROM communications cm
                            WHERE cm.contact_id = l.contact_id
                            ORDER BY cm.sent_at ASC NULLS LAST LIMIT 1)),
                  'Direct') AS name,
                count(*) AS value
           FROM leads l
           LEFT JOIN lead_sources ls ON ls.id = l.source_id
          WHERE l.deleted_at IS NULL AND l.created_at >= now() - interval '30 days'
          GROUP BY 1 ORDER BY value DESC LIMIT 6`,
      );

      // Müşteri coğrafyası (harita kartı): ülke başına kişi + aktif aday +
      // pipeline. Aday ülkesi marketSplit ile aynı türetim zinciri; kişi
      // ülkesi telefon ülke kodundan (tek eldeki güvenilir sinyal).
      const { rows: geoRows } = await c.query<{
        code: string; contacts: string; active_leads: string; pipeline_eur: string;
      }>(
        `WITH contact_geo AS (
           SELECT ct.id,
                  CASE WHEN ct.phone LIKE '+90%'  THEN 'TR'
                       WHEN ct.phone LIKE '+44%'  THEN 'GB'
                       WHEN ct.phone LIKE '+971%' THEN 'AE'
                       WHEN ct.phone LIKE '+34%'  THEN 'ES'
                       WHEN ct.phone LIKE '+49%'  THEN 'DE'
                       WHEN ct.phone LIKE '+33%'  THEN 'FR'
                       WHEN ct.phone LIKE '+7%'   THEN 'RU'
                       WHEN ct.phone LIKE '+966%' THEN 'SA'
                       WHEN ct.phone LIKE '+974%' THEN 'QA'
                       WHEN ct.phone LIKE '+965%' THEN 'KW'
                       WHEN ct.phone LIKE '+98%'  THEN 'IR'
                       WHEN ct.phone LIKE '+994%' THEN 'AZ'
                       WHEN ct.phone LIKE '+31%'  THEN 'NL'
                       WHEN ct.phone LIKE '+1%'   THEN 'US'
                       ELSE 'XX' END AS code
             FROM contacts ct
            WHERE ct.deleted_at IS NULL AND ct.merged_into_id IS NULL
         ), lead_geo AS (
           SELECT COALESCE(
                    l.target_market_code,
                    CASE l.currency WHEN 'GBP' THEN 'GB' WHEN 'TRY' THEN 'TR'
                                    WHEN 'AED' THEN 'AE' WHEN 'EUR' THEN 'ES' END,
                    cg.code, 'XX') AS code,
                  COALESCE(fx.amount_eur, 0) AS amount_eur
             FROM leads l
             LEFT JOIN LATERAL fx_to_eur(l.budget_max, l.currency) fx ON true
             LEFT JOIN contact_geo cg ON cg.id = l.contact_id
            WHERE l.deleted_at IS NULL AND l.status IN ${ACTIVE_STATUSES}
         )
         SELECT g.code,
                (SELECT count(*) FROM contact_geo c2 WHERE c2.code = g.code) AS contacts,
                count(lg.code) AS active_leads,
                COALESCE(SUM(lg.amount_eur), 0) AS pipeline_eur
           FROM (SELECT DISTINCT code FROM contact_geo
                 UNION SELECT DISTINCT code FROM lead_geo) g
           LEFT JOIN lead_geo lg ON lg.code = g.code
          GROUP BY g.code
          ORDER BY pipeline_eur DESC, contacts DESC`,
      );

      // Marketing entegrasyonu: son 30 günün reklam harcaması + CPL + pazar
      // dağılımı (ad_spend elle/CSV/Meta-sync ile beslenir — Marketing modülü).
      // Marketing modülüyle aynı mantık: harcama ad_spend.period_start
      // penceresinde, lead sayısı leads.created_at penceresinde (CPL = harcama/lead).
      const { rows: mkt } = await c.query<{
        spend_eur: string; leads: string; has_rows: boolean;
      }>(
        `SELECT
           (SELECT COALESCE(SUM(fx.amount_eur),0) FROM ad_spend a
              LEFT JOIN LATERAL fx_to_eur(a.spend, a.currency) fx ON true
             WHERE a.deleted_at IS NULL
               AND a.period_start >= (current_date - interval '30 days')) AS spend_eur,
           (SELECT count(*) FROM leads l
             WHERE l.deleted_at IS NULL
               AND l.created_at >= (current_date - interval '30 days')) AS leads,
           EXISTS(SELECT 1 FROM ad_spend WHERE deleted_at IS NULL) AS has_rows`,
      );
      const { rows: mktByMarket } = await c.query<{ code: string; value_eur: string }>(
        `SELECT COALESCE(a.market_code, 'XX') AS code, COALESCE(SUM(fx.amount_eur),0) AS value_eur
           FROM ad_spend a
           LEFT JOIN LATERAL fx_to_eur(a.spend, a.currency) fx ON true
          WHERE a.deleted_at IS NULL
            AND a.period_start >= (current_date - interval '30 days')
          GROUP BY 1 ORDER BY value_eur DESC`,
      );

      const k = kpi[0];
      const mk = mkt[0];
      const mLeads = Number(mk?.leads ?? 0);
      const mSpend = Number(mk?.spend_eur ?? 0);
      return {
        activeLeads: Number(k.active_leads),
        pipelineValueEur: Number(k.pipeline_eur),
        closedWonEur: Number(k.closed_won_eur),
        proposalsActive: Number(k.proposals_active),
        meetingsThisWeek: Number(k.meetings_week),
        geography: geoRows.map((g) => ({
          code: g.code,
          name: MARKET_NAME[g.code] ?? g.code,
          contacts: Number(g.contacts),
          activeLeads: Number(g.active_leads),
          pipelineEur: Number(g.pipeline_eur),
        })),
        marketing: {
          hasSpendData: Boolean(mk?.has_rows),
          adSpend30dEur: mSpend,
          avgCpl30dEur: mLeads > 0 ? mSpend / mLeads : null,
          leads30d: mLeads,
          spendByMarket: mktByMarket.map((m) => ({
            code: m.code,
            name: MARKET_NAME[m.code] ?? m.code,
            valueEur: Number(m.value_eur),
          })),
        },
        marketSplit: markets.map((m) => ({
          code: m.code,
          name: MARKET_NAME[m.code] ?? m.code,
          valueEur: Number(m.value_eur),
        })),
        trends: {
          weeks: trendRows.map((r) => `W${r.iso_week}`),
          pipelineEur: trendRows.map((r) => Number(r.pipeline_eur)),
          activeLeads: trendRows.map((r) => Number(r.active_leads)),
          meetings: trendRows.map((r) => Number(r.meetings)),
          closedWonEur: trendRows.map((r) => Number(r.closed_won_eur)),
        },
        leadSources: sourceRows.map((s) => ({ name: s.name, value: Number(s.value) })),
      };
    });
  }
}
