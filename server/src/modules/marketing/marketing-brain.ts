// =====================================================================
// PREI | Pazarlama analiz motorunun saf parçaları — şema + prompt kurulumu.
// Ağ/DB'ye dokunmaz; birim testlerle kilitlenir.
// =====================================================================

export interface MarketingSnapshot {
  accounts: Array<{
    platform: string; followers: number; reach30d: number; impressions30d: number;
    accountsEngaged30d: number; websiteClicks30d: number;
  }>;
  audience: Array<{ dimension: string; bucket: string; value: number }>;
  posts: Array<{ title: string; postedAt: string; reach: number; engagements: number; leads: number }>;
  spend: Array<{
    name: string; marketCode: string | null; spend: number; currency: string;
    impressions: number; clicks: number;
  }>;
  leadsByMarket: Array<{ market: string; leads: number; won: number }>;
}

export interface BrainProposal {
  title: string;
  objective: string;
  marketCode: string | null;
  primaryText: string;
  headline: string;
  description: string;
  callToAction: string;
  creativeBrief: string;
  targeting: Record<string, unknown>;
  rationale: string;
  suggestedDailyBudget: number | null;
  currency: string;
}

export interface BrainOutput {
  findings: string[];
  contentPlan: Array<{ format: string; topic: string; why: string }>;
  proposals: BrainProposal[];
  warnings: string[];
}

/**
 * Çıktı şeması. Model bunun DIŞINA çıkamaz — uydurma alan gelemez,
 * zorunlu alan eksik kalamaz. (Yapılandırılmış çıktı: output_config.format)
 */
export const PROPOSAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings', 'contentPlan', 'proposals', 'warnings'],
  properties: {
    findings: {
      type: 'array',
      description: 'Verideki somut bulgular. Her madde bir sayıya dayanmalı.',
      items: { type: 'string' },
    },
    contentPlan: {
      type: 'array',
      description: 'Organik içerik önerileri (reklam değil) — takipçi ve erişim büyütmek için.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['format', 'topic', 'why'],
        properties: {
          format: { type: 'string', enum: ['reel', 'carousel', 'single_image', 'story'] },
          topic: { type: 'string' },
          why: { type: 'string', description: 'Hangi veriye dayanarak öneriliyor.' },
        },
      },
    },
    proposals: {
      type: 'array',
      description: 'Reklam önerileri. ONAY BEKLER — hiçbiri otomatik yayınlanmaz.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'objective', 'marketCode', 'primaryText', 'headline',
                   'description', 'callToAction', 'creativeBrief', 'targeting',
                   'rationale', 'suggestedDailyBudget', 'currency'],
        properties: {
          title: { type: 'string' },
          objective: {
            type: 'string',
            enum: ['OUTCOME_ENGAGEMENT', 'OUTCOME_TRAFFIC', 'OUTCOME_LEADS', 'OUTCOME_AWARENESS'],
          },
          marketCode: { type: ['string', 'null'], enum: ['TR', 'AE', 'ES', 'GB', null] },
          primaryText: { type: 'string', description: 'Reklam ana metni (Türkçe).' },
          headline: { type: 'string' },
          description: { type: 'string' },
          callToAction: {
            type: 'string',
            enum: ['LEARN_MORE', 'SEND_MESSAGE', 'CONTACT_US', 'BOOK_TRAVEL', 'SIGN_UP'],
          },
          creativeBrief: { type: 'string', description: 'Görsel/video için somut yönerge.' },
          targeting: { type: 'object', additionalProperties: true },
          rationale: { type: 'string', description: 'Hangi veriye dayanarak önerildi.' },
          suggestedDailyBudget: {
            type: ['number', 'null'],
            description: 'ÖNERİ günlük bütçe. Onaylanmadan harcanmaz.',
          },
          currency: { type: 'string', enum: ['TRY', 'USD', 'EUR'] },
        },
      },
    },
    warnings: {
      type: 'array',
      description: 'Veri yetersizliği veya risk uyarıları. Veri azsa bunu açıkça söyle.',
      items: { type: 'string' },
    },
  },
} as const;

export const MARKETING_SYSTEM = `Sen ProDuality'nin pazarlama analistisin.

ProDuality: Türkiye, BAE (Dubai), İspanya ve İngiltere'de uluslararası gayrimenkul
yatırım danışmanlığı. Emlak ajansı DEĞİL — yatırımcının tarafında duran bağımsız
danışman ("yatırımcının avukatlığı"). Kurucu: Onur Nazım Karataş. Yatırımcıdan
danışmanlık ücreti alınmaz; gelir işlem gerçekleşince piyasa standardı komisyondur.
Kültür: algı değil bilgi. Satış baskısı kurulmaz.

GÖREVİN: Eldeki gerçek veriyi analiz et; görünürlüğü ve takipçiyi artıracak organik
içerik planı ile reklam önerileri üret.

MUTLAK KURALLAR:
1. SADECE sana verilen veriye dayan. Elinde olmayan bir metriği VARMIŞ GİBİ konuşma.
   Veri azsa "warnings" içinde bunu açıkça yaz ve öneriyi buna göre temkinli kur.
2. Bütçe önerilerin ÖNERİDİR. Hiçbiri otomatik harcanmayacak; Onur Bey onaylayacak.
   Veri yetersizken yüksek bütçe önerme — küçük test bütçesiyle başla.
3. Getiri garantisi verme. "kesin", "garanti" gibi ifadeler kullanma.
4. Reklam metinlerini TÜRKÇE yaz, marka sesine uygun: sakin, güven veren, abartısız.
   Ünlem yağmuru, emoji yağmuru, "harika/mükemmel/inanılmaz" YASAK.
5. Vatandaşlık/oturum bilgisinde şu çapaları ihlal etme: İspanya Golden Visa
   3 Nisan 2025'te kaldırıldı; BAE'de yatırımla vatandaşlık YOK (sadece oturum);
   UK Tier 1 Investor kapalı; Türkiye'de 400.000 USD doğrudan vatandaşlık sağlar.
6. Hangi ülkeden ilgi geliyorsa hedeflemeyi ona göre kur — kitle verisi bunun
   en güçlü göstergesi.
7. Her bulguyu ve her öneriyi bir SAYIYA dayandır. "rationale" alanında hangi
   veriye dayandığını açıkça yaz.`;

/** Analiz istemi — veriyi okunabilir biçimde modele verir. */
export function buildAnalysisPrompt(s: MarketingSnapshot): string {
  const lines: string[] = [];

  lines.push('## HESAP METRİKLERİ (son 30 gün)');
  if (s.accounts.length === 0) {
    lines.push('(kayıt yok)');
  } else {
    for (const a of s.accounts) {
      lines.push(
        `- ${a.platform}: ${a.followers} takipçi | erişim ${a.reach30d} | ` +
        `gösterim ${a.impressions30d} | etkileşen hesap ${a.accountsEngaged30d} | ` +
        `site tıklaması ${a.websiteClicks30d}`,
      );
    }
  }

  lines.push('', '## KİTLE KIRILIMI (bizi kim takip ediyor)');
  if (s.audience.length === 0) {
    lines.push('(kayıt yok)');
  } else {
    const byDim = new Map<string, Array<{ bucket: string; value: number }>>();
    for (const a of s.audience) {
      if (!byDim.has(a.dimension)) byDim.set(a.dimension, []);
      byDim.get(a.dimension)!.push({ bucket: a.bucket, value: a.value });
    }
    for (const [dim, rows] of byDim) {
      const top = rows.slice(0, 8).map((r) => `${r.bucket}=${r.value}`).join(', ');
      lines.push(`- ${dim}: ${top}`);
    }
  }

  lines.push('', '## PAYLAŞIM PERFORMANSI');
  if (s.posts.length === 0) {
    lines.push('(hiç paylaşım yok — hesap içerik üretimine henüz başlamamış)');
  } else {
    for (const p of s.posts) {
      lines.push(`- ${p.postedAt} "${p.title}" → erişim ${p.reach}, etkileşim ${p.engagements}, lead ${p.leads}`);
    }
  }

  lines.push('', '## REKLAM HARCAMASI (son 90 gün)');
  if (s.spend.length === 0) {
    lines.push('(hiç reklam harcaması yok)');
  } else {
    for (const c of s.spend) {
      lines.push(
        `- "${c.name}" [${c.marketCode ?? 'pazar belirsiz'}]: ${c.spend} ${c.currency}, ` +
        `${c.impressions} gösterim, ${c.clicks} tıklama`,
      );
    }
  }

  lines.push('', '## PAZAR BAZINDA LEAD (son 90 gün)');
  if (s.leadsByMarket.length === 0) {
    lines.push('(kayıt yok)');
  } else {
    for (const l of s.leadsByMarket) {
      lines.push(`- ${l.market}: ${l.leads} lead, ${l.won} kazanılan`);
    }
  }

  lines.push(
    '',
    'Bu veriye dayanarak: (1) somut bulgular, (2) organik içerik planı,',
    '(3) reklam önerileri, (4) uyarılar üret. Veri azsa bunu dürüstçe söyle.',
  );
  return lines.join('\n');
}
