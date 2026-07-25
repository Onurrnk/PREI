// =====================================================================
// PREI | Pazarlama Yöneticisi — saf parçalar (şema + prompt + aşama).
// Ağ/DB'ye dokunmaz; birim testlerle kilitlenir.
//
// Yönetici ≠ analizci: hedefi vardır, geçen sefer ne dediğini hatırlar ve
// mevcut kampanyaları düzeltir. Bu dosya o üç şeyi modele anlatır.
// =====================================================================
import type { MarketingSnapshot } from './marketing-brain';

export interface GoalProgress {
  metric: string;
  target: number;
  actual: number;
  period: string;
  /** Hedefe ulaşma yüzdesi; hedef 0 ise null. */
  progressPct: number | null;
}

export interface PreviousRun {
  runAt: string;
  assessment: string | null;
  stage: string;
  /** Geçen çalışmanın önerileri ne oldu. */
  outcomes: Array<{ title: string; kind: string; status: string; publishState: string }>;
}

export interface ActiveCampaign {
  name: string;
  campaignRef: string | null;
  marketCode: string | null;
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  /** Tıklama oranı (%) — gösterim yoksa null. */
  ctr: number | null;
  /** Tıklama başına maliyet — tıklama yoksa null. */
  cpc: number | null;
}

export interface ManagerContext {
  snapshot: MarketingSnapshot;
  goals: GoalProgress[];
  previous: PreviousRun | null;
  campaigns: ActiveCampaign[];
}

/**
 * Aşama tespiti — yöneticinin ne yapması gerektiğini belirler.
 * Kuruluşta içerik üretmek, büyümede erişim, optimizasyonda verim öncelikli.
 */
export function detectStage(ctx: ManagerContext): 'setup' | 'growth' | 'optimization' {
  const hasCampaigns = ctx.campaigns.length > 0;
  const hasPosts = ctx.snapshot.posts.length > 0;
  if (hasCampaigns) return 'optimization';
  if (hasPosts) return 'growth';
  return 'setup';
}

export const MANAGER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['assessment', 'previousReview', 'stage', 'actions', 'warnings'],
  properties: {
    assessment: {
      type: 'string',
      description: 'Durum değerlendirmesi: hedeflere göre neredeyiz, ne değişti. Sayılara dayan.',
    },
    previousReview: {
      type: 'string',
      description: 'Geçen çalışmanın önerileri ne oldu ve bundan ne öğrendik. İlk çalışmaysa bunu söyle.',
    },
    stage: { type: 'string', enum: ['setup', 'growth', 'optimization'] },
    actions: {
      type: 'array',
      description: 'Somut eylemler. Hepsi ONAY BEKLER; hiçbiri otomatik uygulanmaz.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'title', 'rationale', 'expectedImpact', 'marketCode',
                   'primaryText', 'headline', 'description', 'callToAction',
                   'creativeBrief', 'targeting', 'suggestedDailyBudget', 'currency',
                   'objective', 'targetCampaignRef'],
        properties: {
          kind: {
            type: 'string',
            enum: ['new_campaign', 'optimization', 'content', 'pause'],
            description: 'content = organik paylaşım önerisi (para harcamaz). ' +
                         'optimization = mevcut kampanya düzeltmesi. pause = durdur.',
          },
          title: { type: 'string' },
          rationale: { type: 'string', description: 'Hangi SAYIYA dayanarak.' },
          expectedImpact: {
            type: 'string',
            description: 'Bu eylem hangi hedefi ne kadar hareket ettirir. Ölçülebilir yaz.',
          },
          marketCode: { type: ['string', 'null'], enum: ['TR', 'AE', 'ES', 'GB', null] },
          objective: {
            type: 'string',
            enum: ['OUTCOME_ENGAGEMENT', 'OUTCOME_TRAFFIC', 'OUTCOME_LEADS', 'OUTCOME_AWARENESS'],
          },
          primaryText: { type: ['string', 'null'], description: 'Reklam/paylaşım metni (Türkçe).' },
          headline: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          callToAction: {
            type: ['string', 'null'],
            enum: ['LEARN_MORE', 'SEND_MESSAGE', 'CONTACT_US', 'SIGN_UP', null],
          },
          creativeBrief: { type: ['string', 'null'] },
          targeting: {
            type: 'object',
            additionalProperties: true,
            description: 'Hedefleme: ülke, şehir, yaş aralığı, ilgi alanı. Kitle verisine dayandır.',
          },
          suggestedDailyBudget: {
            type: ['number', 'null'],
            description: 'ÖNERİ. content/pause için null. Onaylanmadan harcanmaz.',
          },
          currency: { type: 'string', enum: ['TRY', 'USD', 'EUR'] },
          targetCampaignRef: {
            type: ['string', 'null'],
            description: 'optimization/pause ise düzeltilecek kampanyanın referansı; değilse null.',
          },
        },
      },
    },
    warnings: {
      type: 'array',
      description: 'Veri yetersizliği, risk, dikkat edilmesi gereken noktalar.',
      items: { type: 'string' },
    },
  },
} as const;

export const MANAGER_SYSTEM = `Sen ProDuality'nin pazarlama yöneticisisin — analizci değil, YÖNETİCİ.

ProDuality: Türkiye, BAE (Dubai), İspanya ve İngiltere'de uluslararası gayrimenkul
yatırım danışmanlığı. Emlak ajansı DEĞİL — yatırımcının tarafında duran bağımsız
danışman. Kurucu: Onur Nazım Karataş. Yatırımcıdan danışmanlık ücreti alınmaz.
Kültür: algı değil bilgi; satış baskısı yok.

GÖREVİN: Hedeflere ulaşmak. Her çalışmada (1) nerede olduğumuzu ölç,
(2) geçen sefer ne dediğini ve ne olduğunu gözden geçir, (3) bir sonraki
somut adımları öner.

AŞAMAYA GÖRE ÖNCELİK:
- setup (hiç paylaşım/kampanya yok): Önce ORGANİK içerik. Reklam, gösterecek
  içerik yokken para yakmaktır. En fazla 1 küçük test kampanyası öner.
- growth (içerik var, kampanya yok): İçeriği sürdür + hangi içeriğin tuttuğunu
  ölç. Tutan içerik varsa onu öne çıkaracak kampanya öner.
- optimization (aktif kampanya var): Neyin işe yaradığını ölç. Kötü performansı
  durdur, iyiyi büyüt, hedeflemeyi kitle verisine göre daralt.

MUTLAK KURALLAR:
1. SADECE verilen veriye dayan. Elinde olmayan metriği varmış gibi konuşma.
   Veri azsa "warnings"te açıkça yaz ve temkinli öner.
2. Hiçbir eylem otomatik uygulanmaz — hepsi Onur Bey'in onayına gider.
   Bütçe önerilerin ÖNERİDİR. Veri yokken küçük test bütçesiyle başla.
3. Her eylemin "rationale" alanı bir SAYIYA dayanmalı, "expectedImpact" alanı
   ölçülebilir olmalı ("erişimi ~%15 artırması beklenir" gibi).
4. Hedeflemeyi kitle verisine dayandır. Takipçinin çoğu nerede ise oraya git;
   veri olmayan pazara körlemesine bütçe koyma.
5. Reklam ve paylaşım metinleri TÜRKÇE, marka sesine uygun: sakin, güven veren,
   abartısız. Ünlem yağmuru, emoji yağmuru, "harika/mükemmel/inanılmaz" YASAK.
6. Getiri garantisi verme.
7. Vatandaşlık/oturum çapaları: İspanya Golden Visa 3 Nisan 2025'te kaldırıldı;
   BAE'de yatırımla vatandaşlık YOK (sadece oturum); UK Tier 1 Investor kapalı;
   Türkiye'de 400.000 USD doğrudan vatandaşlık sağlar.
8. Az ve iyi öner. 3-5 eylem yeterli; liste uzunluğu değer değildir.`;

/** Yöneticinin göreceği tam bağlam — hedefler, geçmiş, kampanyalar, ölçümler. */
export function buildManagerPrompt(ctx: ManagerContext): string {
  const L: string[] = [];
  const s = ctx.snapshot;

  L.push(`## AŞAMA: ${detectStage(ctx)}`);

  L.push('', '## HEDEFLER VE İLERLEME');
  if (ctx.goals.length === 0) {
    L.push('(hedef tanımlanmamış — bunu bir uyarı olarak belirt)');
  } else {
    for (const g of ctx.goals) {
      const pct = g.progressPct != null ? `%${g.progressPct.toFixed(0)}` : 'ölçülemedi';
      L.push(`- ${g.metric} (${g.period}): hedef ${g.target}, gerçekleşen ${g.actual} → ${pct}`);
    }
  }

  L.push('', '## GEÇEN ÇALIŞMA');
  if (!ctx.previous) {
    L.push('(bu ilk çalışma — kıyaslanacak geçmiş yok)');
  } else {
    L.push(`Tarih: ${ctx.previous.runAt} · Aşama: ${ctx.previous.stage}`);
    if (ctx.previous.assessment) L.push(`Değerlendirme: ${ctx.previous.assessment}`);
    if (ctx.previous.outcomes.length === 0) {
      L.push('Önerilerin akıbeti: kayıt yok');
    } else {
      L.push('Önerilerin akıbeti:');
      for (const o of ctx.previous.outcomes) {
        L.push(`  - [${o.kind}] "${o.title}" → ${o.status}${o.publishState !== 'none' ? ` (${o.publishState})` : ''}`);
      }
    }
  }

  L.push('', '## AKTİF KAMPANYALAR');
  if (ctx.campaigns.length === 0) {
    L.push('(aktif kampanya yok)');
  } else {
    for (const c of ctx.campaigns) {
      const ctr = c.ctr != null ? `TO %${c.ctr.toFixed(2)}` : 'TO yok';
      const cpc = c.cpc != null ? `TBM ${c.cpc.toFixed(2)} ${c.currency}` : 'TBM yok';
      L.push(`- "${c.name}" [${c.marketCode ?? 'pazar?'}] ${c.spend} ${c.currency} · ` +
             `${c.impressions} gösterim · ${c.clicks} tıklama · ${ctr} · ${cpc}`);
    }
  }

  L.push('', '## HESAP METRİKLERİ (son 30 gün)');
  if (s.accounts.length === 0) L.push('(kayıt yok)');
  for (const a of s.accounts) {
    L.push(`- ${a.platform}: ${a.followers} takipçi | erişim ${a.reach30d} | ` +
           `profil görüntüleme ${a.impressions30d} | etkileşen ${a.accountsEngaged30d} | ` +
           `site tıklaması ${a.websiteClicks30d}`);
  }

  L.push('', '## KİTLE (hedeflemenin temeli)');
  if (s.audience.length === 0) {
    L.push('(kitle verisi yok)');
  } else {
    const byDim = new Map<string, Array<{ bucket: string; value: number }>>();
    for (const a of s.audience) {
      if (!byDim.has(a.dimension)) byDim.set(a.dimension, []);
      byDim.get(a.dimension)!.push(a);
    }
    for (const [dim, rows] of byDim) {
      L.push(`- ${dim}: ${rows.slice(0, 8).map((r) => `${r.bucket}=${r.value}`).join(', ')}`);
    }
  }

  L.push('', '## PAYLAŞIM PERFORMANSI');
  if (s.posts.length === 0) {
    L.push('(hiç paylaşım yok — içerik üretimi henüz başlamamış)');
  } else {
    for (const p of s.posts) {
      L.push(`- ${p.postedAt} "${p.title}" → erişim ${p.reach}, etkileşim ${p.engagements}, lead ${p.leads}`);
    }
  }

  L.push('', '## PAZAR BAZINDA LEAD (son 90 gün)');
  if (s.leadsByMarket.length === 0) L.push('(kayıt yok)');
  for (const l of s.leadsByMarket) L.push(`- ${l.market}: ${l.leads} lead, ${l.won} kazanılan`);

  L.push(
    '',
    'Bu bilgiyle: durumu değerlendir, geçen çalışmayı gözden geçir, aşamaya uygun',
    '3-5 somut eylem öner ve uyarılarını yaz. Her eylemi bir sayıya dayandır.',
  );
  return L.join('\n');
}
