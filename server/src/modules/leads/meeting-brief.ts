// =====================================================================
// PREI | Görüşme brifingi — saf (yan etkisiz) parçalar.
//
// Amaç: danışman toplantıya girmeden önce "dersini çalışmış" olsun.
// Ham veri (konuşma geçmişi + profil + skor geçmişi) burada modele
// verilecek metne dönüşür; çıktı JSON şemasıyla kısıtlanır.
//
// Tasarım ilkesi: BİLİNMEYENİ SAKLAMA. Danışmanın en çok ihtiyacı olan
// şey neyi bilmediğidir — toplantıda soracağı sorular oradan çıkar.
// =====================================================================

export interface DossierMessage {
  direction: 'inbound' | 'outbound';
  channel: string;
  body: string;
  sentAt: string;
}

export interface DossierScore {
  score: number;
  reasoning: string | null;
  signals: Record<string, unknown>;
  source: string;
  createdAt: string;
}

export interface LeadDossier {
  leadId: string;
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredLang: string | null;
  status: string;
  /** Randevu varsa zamanı — brifingin aciliyetini belirler. */
  meetingAt: string | null;
  meetingTitle: string | null;
  /** Yapılandırılmış profil (leads kolonları). */
  profile: {
    marketCode: string | null;
    city: string | null;
    district: string | null;
    propertyType: string | null;
    rooms: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
    currency: string | null;
    timeline: string | null;
    investmentPurpose: string | null;
    interestType: string | null;
  };
  /** Eylül'ün sohbetten çıkardığı kriterler (leads.metadata.criteria). */
  extractedCriteria: Record<string, unknown> | null;
  notes: string | null;
  /** Skor geçmişi — append-only, en yeniden eskiye. Skorun NASIL değiştiği. */
  scoreHistory: DossierScore[];
  /** Tüm konuşma, eskiden yeniye. */
  messages: DossierMessage[];
  /** Gönderilmiş teklifler. */
  proposals: Array<{ title: string; status: string; totalValue: number | null; currency: string; sentAt: string | null }>;
  /** Geçmiş toplantılar. */
  pastMeetings: Array<{ title: string; dueDate: string; status: string }>;
  /** Mükerrer kayıt şüphesi vb. bayraklar. */
  flags: string[];
}

/** Profil alanı → danışmanın toplantıda sorması gereken soru. */
const MISSING_QUESTION: Record<string, string> = {
  marketCode: 'Hangi ülkeyi düşünüyor? (Türkiye / Dubai / İspanya / İngiltere)',
  city: 'Hangi şehir veya bölge?',
  budget: 'Bütçe aralığı nedir?',
  investmentPurpose: 'Amaç ne: getiri, oturum/vatandaşlık, kendi kullanımı, karma?',
  timeline: 'Zaman ufku ne? Ne kadar sürede karar vermeyi planlıyor?',
  propertyType: 'Mülk tipi ve oda düzeni tercihi var mı?',
};

export interface ProfileGap {
  field: string;
  question: string;
}

/**
 * Profildeki boşlukları ve her biri için sorulacak soruyu döndürür.
 * Eylül'ün çıkardığı kriterler kolonu doldurmuyorsa onu da sayar
 * (canlıda target_market_code boş ama metadata.criteria.market dolu).
 */
export function profileGaps(d: LeadDossier): ProfileGap[] {
  const c = (d.extractedCriteria ?? {}) as Record<string, unknown>;
  const has = (v: unknown) => v !== null && v !== undefined && v !== '';

  const gaps: ProfileGap[] = [];
  if (!has(d.profile.marketCode) && !has(c.market)) {
    gaps.push({ field: 'marketCode', question: MISSING_QUESTION.marketCode });
  }
  if (!has(d.profile.city) && !has(c.city)) {
    gaps.push({ field: 'city', question: MISSING_QUESTION.city });
  }
  if (!has(d.profile.budgetMin) && !has(d.profile.budgetMax) && !has(c.budget)) {
    gaps.push({ field: 'budget', question: MISSING_QUESTION.budget });
  }
  if (!has(d.profile.investmentPurpose) && !has(c.purpose)) {
    gaps.push({ field: 'investmentPurpose', question: MISSING_QUESTION.investmentPurpose });
  }
  if (!has(d.profile.timeline)) {
    gaps.push({ field: 'timeline', question: MISSING_QUESTION.timeline });
  }
  if (!has(d.profile.propertyType) && !has(d.profile.rooms)) {
    gaps.push({ field: 'propertyType', question: MISSING_QUESTION.propertyType });
  }
  return gaps;
}

/** Para birimi + aralıktan okunabilir bütçe metni. */
export function formatBudget(
  min: number | null, max: number | null, currency: string | null,
): string {
  const cur = currency ?? '';
  const f = (n: number) => n.toLocaleString('tr-TR');
  if (min != null && max != null) {
    return min === max ? `${f(min)} ${cur}`.trim() : `${f(min)} – ${f(max)} ${cur}`.trim();
  }
  if (min != null) return `${f(min)} ${cur}+`.trim();
  if (max != null) return `en fazla ${f(max)} ${cur}`.trim();
  return 'belirtilmemiş';
}

/**
 * Konuşmayı prompt'a sığacak biçimde özetler.
 * MÜŞTERİNİN mesajları önemlidir (beklentiler orada); Eylül'ün cevapları
 * bağlam için kısaltılır. Uzun sohbetlerde ilk ve son kısımlar korunur —
 * ortadaki tekrar genelde bilgi taşımaz.
 */
export function transcriptDigest(
  messages: DossierMessage[], maxChars = 12000,
): { text: string; truncated: boolean; inbound: number; outbound: number } {
  const inbound = messages.filter((m) => m.direction === 'inbound').length;
  const outbound = messages.length - inbound;

  const line = (m: DossierMessage) => {
    const who = m.direction === 'inbound' ? 'MÜŞTERİ' : 'EYLÜL';
    const when = m.sentAt.slice(0, 16).replace('T', ' ');
    // Eylül'ün cevapları bağlam; müşterinin sözü asıl veri → daha az kırp.
    const cap = m.direction === 'inbound' ? 900 : 320;
    const body = (m.body ?? '').replace(/\s+/g, ' ').trim();
    const shown = body.length > cap ? `${body.slice(0, cap)}…` : body;
    return `[${when}] ${who}: ${shown}`;
  };

  const all = messages.map(line);
  const joined = all.join('\n');
  if (joined.length <= maxChars) {
    return { text: joined, truncated: false, inbound, outbound };
  }

  // Baş ve son korunur, orta atlanır.
  const head: string[] = [];
  const tail: string[] = [];
  let hLen = 0;
  let tLen = 0;
  const half = Math.floor(maxChars / 2);
  for (const l of all) {
    if (hLen + l.length > half) break;
    head.push(l); hLen += l.length + 1;
  }
  for (let i = all.length - 1; i >= head.length; i--) {
    if (tLen + all[i].length > half) break;
    tail.unshift(all[i]); tLen += all[i].length + 1;
  }
  const skipped = all.length - head.length - tail.length;
  return {
    text: [...head, `\n… (${skipped} mesaj atlandı) …\n`, ...tail].join('\n'),
    truncated: true, inbound, outbound,
  };
}

/** Brifing çıktı şeması — model bunun dışına çıkamaz. */
export const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'whoIsThis', 'topicsDiscussed', 'profileSummary',
             'expectations', 'buyingSignals', 'riskSignals', 'openQuestions',
             'suggestedAgenda', 'sensitivities', 'scoreRationale'],
  properties: {
    headline: {
      type: 'string',
      description: 'Tek cümlede bu görüşmenin özü. Danışman sadece bunu okusa bile hazır olsun.',
    },
    whoIsThis: {
      type: 'string',
      description: '2-4 cümle: kim, nereden geldi, ne arıyor. Sohbetten çıkan insani bağlam dahil.',
    },
    topicsDiscussed: {
      type: 'array',
      description: 'Konuşulan konular. Her biri SOMUT olmalı — "yatırım" değil, "Nişantaşı 2+1 kira getirisi".',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'detail'],
        properties: {
          topic: { type: 'string' },
          detail: { type: 'string', description: 'Müşterinin bu konuda tam olarak ne söylediği.' },
        },
      },
    },
    profileSummary: {
      type: 'object',
      additionalProperties: false,
      required: ['markets', 'regions', 'budget', 'purpose', 'timeline', 'propertyPreference'],
      properties: {
        markets: { type: 'array', items: { type: 'string' }, description: 'Konuştuğu ülke(ler).' },
        regions: { type: 'array', items: { type: 'string' }, description: 'İstediği şehir/bölge/semt.' },
        budget: { type: 'string' },
        purpose: { type: 'string' },
        timeline: { type: 'string' },
        propertyPreference: { type: 'string' },
      },
    },
    expectations: {
      type: 'array',
      description: 'Müşterinin açıkça veya dolaylı olarak beklediği şeyler.',
      items: { type: 'string' },
    },
    buyingSignals: {
      type: 'array',
      description: 'Ciddiyet göstergeleri. Sohbetten alıntıya dayanmalı.',
      items: { type: 'string' },
    },
    riskSignals: {
      type: 'array',
      description: 'Tereddüt, itiraz, kaybetme riski işaretleri. Yoksa boş dizi.',
      items: { type: 'string' },
    },
    openQuestions: {
      type: 'array',
      description: 'Toplantıda MUTLAKA sorulması gereken sorular — bilinmeyen her şey için.',
      items: { type: 'string' },
    },
    suggestedAgenda: {
      type: 'array',
      description: 'Görüşme akışı önerisi, sırayla. Açılış cümlesi dahil.',
      items: { type: 'string' },
    },
    sensitivities: {
      type: 'array',
      description: 'Dikkat edilmesi gerekenler: söylenmemesi gerekenler, hassas konular, önceki şikâyetler. Yoksa boş dizi.',
      items: { type: 'string' },
    },
    scoreRationale: {
      type: 'string',
      description: 'Skorun NEDEN bu seviyede olduğu — hangi somut sinyaller yükseltti/düşürdü.',
    },
  },
} as const;

export const BRIEF_SYSTEM = `Sen ProDuality'nin görüşme hazırlık analistisin.

ProDuality: Türkiye, BAE (Dubai), İspanya ve İngiltere'de uluslararası gayrimenkul
yatırım danışmanlığı. Emlak ajansı DEĞİL — yatırımcının tarafında duran bağımsız
danışman. Kurucu: Onur Nazım Karataş. Görüşmeyi Onur Bey yapar.

GÖREVİN: Danışman toplantıya girmeden önce "dersini çalışmış" olsun. Elindeki
konuşma geçmişi, profil verisi ve skor geçmişinden eksiksiz bir hazırlık brifingi
çıkar.

MUTLAK KURALLAR:
1. SADECE verilen veriye dayan. Müşterinin söylemediği bir şeyi söylemiş gibi
   yazma. Emin olmadığın çıkarımı "muhtemelen/izlenimi var" diye işaretle.
2. BİLİNMEYENİ SAKLAMA. Profilde eksik olan her şey "openQuestions" içine
   girer. Danışmanın en çok ihtiyacı olan şey neyi bilmediğidir.
3. SOMUT ol. "Yatırım konuşuldu" değil; "Nişantaşı'nda 2+1, kira getirisi
   ve iş ortaklarının konaklaması için kullanım konuşuldu".
4. Konuşmadan ALINTI kullan — buyingSignals ve riskSignals müşterinin
   kendi sözlerine dayanmalı.
5. Vatandaşlık/oturum çapalarını ihlal etme: İspanya Golden Visa 3 Nisan
   2025'te kaldırıldı; BAE'de yatırımla vatandaşlık YOK (yalnız oturum);
   UK Tier 1 Investor kapalı; Türkiye'de 400.000 USD doğrudan vatandaşlık.
6. Getiri garantisi verme, rakam uydurma.
7. Türkçe yaz. Danışmanın hızlı okuyup içselleştireceği net bir dil kullan.
8. Konuşma çok kısaysa bunu dürüstçe söyle ve brifingi "henüz az veri var,
   şunları öğrenmek gerekiyor" biçiminde kur.`;

/** Modele verilecek dosya metni. */
export function buildBriefPrompt(d: LeadDossier): string {
  const L: string[] = [];
  const digest = transcriptDigest(d.messages);
  const gaps = profileGaps(d);

  L.push('## KİŞİ');
  L.push(`Ad: ${d.name}`);
  if (d.email) L.push(`E-posta: ${d.email}`);
  if (d.phone) L.push(`Telefon: ${d.phone}`);
  if (d.preferredLang) L.push(`Tercih ettiği dil: ${d.preferredLang}`);
  L.push(`Lead durumu: ${d.status}`);
  if (d.meetingAt) {
    L.push(`RANDEVU: ${d.meetingAt.slice(0, 16).replace('T', ' ')}${d.meetingTitle ? ` — ${d.meetingTitle}` : ''}`);
  }

  L.push('', '## YAPILANDIRILMIŞ PROFİL (CRM kolonları)');
  const p = d.profile;
  L.push(`Pazar: ${p.marketCode ?? '(boş)'}`);
  L.push(`Şehir: ${p.city ?? '(boş)'} | Semt: ${p.district ?? '(boş)'}`);
  L.push(`Mülk tipi: ${p.propertyType ?? '(boş)'} | Oda: ${p.rooms ?? '(boş)'}`);
  L.push(`Bütçe: ${formatBudget(p.budgetMin, p.budgetMax, p.currency)}`);
  L.push(`Amaç: ${p.investmentPurpose ?? '(boş)'} | İlgi tipi: ${p.interestType ?? '(boş)'}`);
  L.push(`Zaman ufku: ${p.timeline ?? '(boş)'}`);

  if (d.extractedCriteria && Object.keys(d.extractedCriteria).length > 0) {
    L.push('', '## EYLÜL\'ÜN SOHBETTEN ÇIKARDIĞI KRİTERLER');
    for (const [k, v] of Object.entries(d.extractedCriteria)) {
      if (v !== null && v !== '') L.push(`- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    }
  }

  if (d.notes) { L.push('', '## CRM NOTLARI'); L.push(d.notes); }

  if (d.scoreHistory.length > 0) {
    L.push('', '## SKOR GEÇMİŞİ (yeniden eskiye)');
    for (const s of d.scoreHistory.slice(0, 6)) {
      L.push(`- ${s.createdAt.slice(0, 10)} · ${s.score}/100 (${s.source})${s.reasoning ? ` — ${s.reasoning}` : ''}`);
      const sig = Object.entries(s.signals ?? {}).filter(([, v]) => v !== null && v !== '');
      if (sig.length > 0) {
        L.push(`  sinyaller: ${sig.map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ')}`);
      }
    }
  }

  if (d.proposals.length > 0) {
    L.push('', '## GÖNDERİLEN TEKLİFLER');
    for (const pr of d.proposals) {
      L.push(`- "${pr.title}" · ${pr.status}${pr.totalValue ? ` · ${pr.totalValue.toLocaleString('tr-TR')} ${pr.currency}` : ''}${pr.sentAt ? ` · ${pr.sentAt.slice(0, 10)}` : ''}`);
    }
  }

  if (d.pastMeetings.length > 0) {
    L.push('', '## GEÇMİŞ TOPLANTILAR');
    for (const m of d.pastMeetings) L.push(`- ${m.dueDate.slice(0, 10)} · ${m.title} (${m.status})`);
  }

  if (d.flags.length > 0) { L.push('', '## BAYRAKLAR'); for (const f of d.flags) L.push(`- ${f}`); }

  L.push('', `## KONUŞMA (${digest.inbound} müşteri / ${digest.outbound} Eylül mesajı${digest.truncated ? ', kısaltıldı' : ''})`);
  L.push(digest.text || '(hiç mesaj yok)');

  if (gaps.length > 0) {
    L.push('', '## CRM\'DE EKSİK OLANLAR (openQuestions içine mutlaka al)');
    for (const g of gaps) L.push(`- ${g.question}`);
  }

  L.push('', 'Bu dosyaya dayanarak görüşme hazırlık brifingini üret.');
  return L.join('\n');
}
