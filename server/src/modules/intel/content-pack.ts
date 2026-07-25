// =====================================================================
// PREI | Haftalık rapordan içerik üretimi — saf parçalar.
//
// Onur'un akışı: Co-work raporu üretir → buradan LinkedIn/Instagram post
// metinleri ve karusel slayt planları çıkar → yerel betik bilgisayardaki
// tarihli klasöre yazar → Onur platformlara kendisi yükler.
//
// SPEKÜLATİF İÇERİK KURALI: rapor doğrulanmamış iddiaları ayrı bölümde
// etiketliyor. O bölümden post ÜRETİLMEZ — yanlış bilgi paylaşılmasın.
// =====================================================================
import type { ReportSection } from './intel-report';
import { isSpeculativeSection } from './intel-report';

export interface ContentPost {
  platform: 'linkedin' | 'instagram';
  hook: string;
  body: string;
  hashtags: string[];
  marketCode: string | null;
  sourceSection: string;
}

export interface CarouselSlide {
  index: number;
  headline: string;
  body: string;
  /** Nano Banana'ya (Gemini) gidecek görsel istemi. */
  imagePrompt: string;
}

export interface Carousel {
  title: string;
  marketCode: string | null;
  sourceSection: string;
  slides: CarouselSlide[];
}

export interface ContentPack {
  posts: ContentPost[];
  carousels: Carousel[];
  /** Bu hafta ATLANMASI gereken başlıklar ve nedeni (şeffaflık). */
  skipped: Array<{ topic: string; reason: string }>;
}

/** Çıktı şeması — model bunun dışına çıkamaz. */
export const CONTENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['posts', 'carousels', 'skipped'],
  properties: {
    posts: {
      type: 'array',
      description: 'Tek başına paylaşılabilir postlar. LinkedIn uzun form, Instagram kısa.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['platform', 'hook', 'body', 'hashtags', 'marketCode', 'sourceSection'],
        properties: {
          platform: { type: 'string', enum: ['linkedin', 'instagram'] },
          hook: {
            type: 'string',
            description: 'İlk satır — okuyucuyu durduran cümle. Clickbait DEĞİL, veriye dayalı.',
          },
          body: {
            type: 'string',
            description: 'Post gövdesi. LinkedIn için 3-6 kısa paragraf, Instagram için 2-3.',
          },
          hashtags: {
            type: 'array',
            items: { type: 'string' },
            description: '3-6 etiket, Türkçe/İngilizce karışık olabilir. # işareti OLMADAN.',
          },
          marketCode: { type: ['string', 'null'], enum: ['TR', 'AE', 'ES', 'GB', 'NL', 'DE', 'TH', 'GLOBAL', null] },
          sourceSection: { type: 'string', description: 'Raporun hangi bölümünden geldiği.' },
        },
      },
    },
    carousels: {
      type: 'array',
      description: 'Çok slaytlı anlatımlar. Tek postta anlatılamayacak konular için.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'marketCode', 'sourceSection', 'slides'],
        properties: {
          title: { type: 'string' },
          marketCode: { type: ['string', 'null'], enum: ['TR', 'AE', 'ES', 'GB', 'NL', 'DE', 'TH', 'GLOBAL', null] },
          sourceSection: { type: 'string' },
          slides: {
            type: 'array',
            description: '4-7 slayt. İlk slayt kanca, son slayt eylem çağrısı.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['index', 'headline', 'body', 'imagePrompt'],
              properties: {
                index: { type: 'integer' },
                headline: { type: 'string', description: 'Slaytta büyük yazacak metin. Kısa.' },
                body: { type: 'string', description: 'Slayt altı açıklama. 1-2 cümle.' },
                imagePrompt: {
                  type: 'string',
                  description:
                    'Görsel üretimi için İNGİLİZCE istem. Sakin, kurumsal, fotogerçekçi. ' +
                    'Görselin ÜZERİNE YAZI İSTEME (metin ayrı eklenecek).',
                },
              },
            },
          },
        },
      },
    },
    skipped: {
      type: 'array',
      description: 'Post üretilmeyen başlıklar ve nedeni. Spekülatif olanlar burada.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'reason'],
        properties: {
          topic: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;

export const CONTENT_SYSTEM = `Sen ProDuality'nin sosyal medya içerik editörüsün.

ProDuality: Türkiye, BAE (Dubai), İspanya ve İngiltere'de uluslararası gayrimenkul
yatırım danışmanlığı. Emlak ajansı DEĞİL — yatırımcının tarafında duran bağımsız
danışman ("yatırımcının avukatlığı"). Kurucu: Onur Nazım Karataş, ~20 yıl sektör
içinde, 6 yıl profesyonel. Kültür: algı değil bilgi; satış baskısı yok.

GÖREVİN: Haftalık istihbarat raporundan LinkedIn ve Instagram için paylaşıma
hazır içerik üretmek. Onur Bey bunları kendi hesaplarından paylaşacak.

MUTLAK KURALLAR:
1. SPEKÜLATİF BÖLÜMDEN POST ÜRETME. Rapor doğrulanmamış iddiaları ayrı bölümde
   etiketliyor; oradaki hiçbir şey paylaşılmaz. Onları "skipped" içine yaz,
   nedeni "rapor bunu spekülatif olarak etiketlemiş" olsun.
2. HER RAKAM RAPORDAN GELMELİ. Uydurma sayı, uydurma oran, uydurma tarih YOK.
   Rapordaki veriyi aynen kullan.
3. Getiri garantisi verme. "kesin kazanç", "garantili getiri" gibi ifadeler YASAK.
   Yatırım tavsiyesi verme; bilgi ver.
4. Vatandaşlık/oturum çapaları — ihlal etme:
   - İspanya Golden Visa 3 Nisan 2025'te KALDIRILDI; mülk alımı oturum sağlamaz.
   - BAE'de yatırımla VATANDAŞLIK YOK; yalnız oturum (Golden Visa).
   - UK Tier 1 Investor kapalı (Şubat 2022).
   - Türkiye: 400.000 USD gayrimenkul doğrudan vatandaşlık sağlar.
5. MARKA SESİ: sakin, güven veren, abartısız. Şunlar YASAK — "harika",
   "mükemmel", "inanılmaz", "kaçırmayın", ünlem yağmuru, emoji yağmuru
   (post başına en fazla bir tane, o da gerekiyorsa).
6. Satış yapmıyorsun, bilgi veriyorsun. Post sonunda agresif çağrı yok;
   en fazla "Bu konuyu detaylı konuşmak isterseniz yazın" tonunda.
7. LinkedIn postu: profesyonel, 3-6 kısa paragraf, veri odaklı, ilk satır
   kanca. Instagram postu: daha kısa, 2-3 paragraf, daha erişilebilir dil.
8. Karusel görsel istemleri İNGİLİZCE olsun ve görselin ÜZERİNE YAZI İSTEME —
   metin sonradan eklenecek. Sakin, kurumsal, fotogerçekçi; stok fotoğraf
   klişesinden ("gülen aile", "el sıkışma") uzak dur.
9. Türkçe yaz (görsel istemleri hariç).
10. Rapordaki en güçlü 3-5 konuyu seç; her başlığa post üretmeye çalışma.
    Kalitesiz doldurma post istemiyoruz.`;

/**
 * Modele verilecek metin. Spekülatif bölüm AYRI işaretlenerek verilir —
 * model onu görsün ki "skipped" içine doğru gerekçeyle yazabilsin, ama
 * post üretmemesi gerektiğini de bilsin.
 */
export function buildContentPrompt(
  reportTitle: string,
  periodLabel: string,
  sections: ReportSection[],
  maxChars = 30000,
): string {
  const L: string[] = [];
  L.push(`## RAPOR: ${reportTitle}`);
  L.push(`Kapsam: ${periodLabel}`);
  L.push('');

  let used = 0;
  for (const s of sections) {
    const spec = isSpeculativeSection(s.heading);
    const header = spec
      ? `### ${s.index}. ${s.heading}  ⚠️ SPEKÜLATİF — BURADAN POST ÜRETİLMEZ`
      : `### ${s.index}. ${s.heading}`;
    // Bütçe dolduysa uzun bölümleri kırp, ama başlığı ve spekülatif
    // işaretini KORU (model neyi atladığını bilsin).
    const remaining = maxChars - used;
    if (remaining < 500) {
      L.push(header, '(yer kalmadığı için gövde atlandı)', '');
      continue;
    }
    const body = s.body.length > remaining ? `${s.body.slice(0, remaining)}…` : s.body;
    L.push(header, body, '');
    used += body.length + header.length;
  }

  L.push('---');
  L.push('Bu rapordan LinkedIn ve Instagram için paylaşıma hazır içerik üret.');
  L.push('Spekülatif bölümden post ÜRETME; onları skipped içine yaz.');
  return L.join('\n');
}

/** Karusel slaytlarını Gemini istemlerine çevirir (marka tutarlılığı ekli). */
export function imagePromptFor(slide: CarouselSlide, marketCode: string | null): string {
  const place: Record<string, string> = {
    TR: 'Istanbul, Turkey', AE: 'Dubai, UAE', ES: 'Spain', GB: 'United Kingdom',
    NL: 'Netherlands', DE: 'Germany', TH: 'Thailand',
  };
  const loc = marketCode && place[marketCode] ? ` Setting: ${place[marketCode]}.` : '';
  // Marka çerçevesi her isteme eklenir: sakin, kurumsal, metinsiz.
  return (
    `${slide.imagePrompt}${loc} ` +
    'Style: calm, corporate, photorealistic, muted natural colours, soft daylight. ' +
    'Absolutely no text, letters, numbers, logos or watermarks in the image. ' +
    'Avoid stock-photo cliches such as smiling groups or handshakes. ' +
    'Square 1:1 composition suitable for a social media carousel slide.'
  );
}

/** Paketi yerel klasöre yazılacak Markdown'a çevirir. */
export function packToMarkdown(
  pack: ContentPack, reportTitle: string, periodLabel: string,
): string {
  const L: string[] = [];
  L.push(`# Haftalık İçerik Paketi`);
  L.push('');
  L.push(`**Rapor:** ${reportTitle}  `);
  L.push(`**Kapsam:** ${periodLabel}`);
  L.push('');

  if (pack.posts.length > 0) {
    L.push('## Postlar');
    L.push('');
    for (const [i, p] of pack.posts.entries()) {
      L.push(`### ${i + 1}. ${p.platform === 'linkedin' ? 'LinkedIn' : 'Instagram'}${p.marketCode ? ` · ${p.marketCode}` : ''}`);
      L.push('');
      L.push(`**${p.hook}**`);
      L.push('');
      L.push(p.body);
      L.push('');
      if (p.hashtags.length > 0) L.push(p.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' '));
      L.push('');
      L.push(`_Kaynak bölüm: ${p.sourceSection}_`);
      L.push('');
      L.push('---');
      L.push('');
    }
  }

  if (pack.carousels.length > 0) {
    L.push('## Karuseller');
    L.push('');
    for (const [ci, c] of pack.carousels.entries()) {
      L.push(`### Karusel ${ci + 1}: ${c.title}${c.marketCode ? ` · ${c.marketCode}` : ''}`);
      L.push('');
      for (const s of c.slides) {
        L.push(`**Slayt ${s.index}** — ${s.headline}`);
        L.push('');
        L.push(s.body);
        L.push('');
        L.push(`\`görsel: karusel-${ci + 1}-slayt-${s.index}.png\``);
        L.push('');
      }
      L.push(`_Kaynak bölüm: ${c.sourceSection}_`);
      L.push('');
      L.push('---');
      L.push('');
    }
  }

  if (pack.skipped.length > 0) {
    L.push('## Paylaşılmayanlar');
    L.push('');
    L.push('Bu başlıklardan bilinçli olarak post üretilmedi:');
    L.push('');
    for (const s of pack.skipped) L.push(`- **${s.topic}** — ${s.reason}`);
    L.push('');
  }

  return L.join('\n');
}
