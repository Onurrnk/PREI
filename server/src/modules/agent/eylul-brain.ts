// =====================================================================
// PREI | Eylül'ün cevap üretimi — saf (yan etkisiz) parçalar.
//
// Buradaki fonksiyonlar ağ/DB'ye dokunmaz; birim testlerle kilitlenir.
// Servis katmanı (eylul-brain.service.ts) bunları RAG + OpenAI çağrısıyla
// birleştirir. Persona metni tek kaynaktan (eylul-persona.ts) gelir —
// Telegram (n8n) ve Instagram/Messenger (backend) AYNI sesle konuşur.
// =====================================================================

/** Türkçe'ye özgü harfler + sık kullanılan işlev sözcükleri. */
const TR_CHARS = /[çğıöşüÇĞİÖŞÜ]/;
const TR_WORDS =
  /\b(ve|bir|için|nasıl|nedir|merhaba|selam|istiyorum|olur|var|yok|mı|mi|mu|mü|bey|hanım|teşekkür|lütfen|fiyat|daire|ev|yatırım|kaç|hangi)\b/i;
const EN_WORDS =
  /\b(the|and|for|how|what|hello|hi|want|would|please|thanks|price|apartment|property|investment|which|can|you|is|are)\b/i;

/**
 * Cevap dili: kullanıcının SON mesajına bakar. Türkçe işaret varsa 'tr';
 * yalnız İngilizce işaret varsa 'en'; ikisi de yoksa 'tr' (ana pazar).
 */
export function detectLang(text: string): 'tr' | 'en' {
  const t = (text ?? '').trim();
  if (!t) return 'tr';
  if (TR_CHARS.test(t) || TR_WORDS.test(t)) return 'tr';
  if (EN_WORDS.test(t)) return 'en';
  return 'tr';
}

/**
 * İçi boş kapanış cümlelerini SİLER. Persona bunu zaten yasaklıyor ama
 * model ara sıra yine ekliyor — burada deterministik olarak kesiyoruz
 * (kural + kod: iki kat koruma). Cevabın tamamı dolguysa dokunmaz,
 * yoksa boş mesaj göndermiş oluruz.
 */
const FILLER_PATTERNS: RegExp[] = [
  /\s*Başka bir (konuda|sorunuz|konu) [^.!?\n]*[.!?]?\s*$/i,
  /\s*(Size )?[Yy]ardımcı ol(abilirim|maktan memnuniyet duyarım)[^.!?\n]*[.!?]?\s*$/i,
  /\s*Başka sorunuz olursa [^.!?\n]*[.!?]?\s*$/i,
  /\s*(Her zaman |Ben )?buradayım[.!?]?\s*$/i,
  /\s*(Is there )?anything else I can help[^.!?\n]*[.!?]?\s*$/i,
  /\s*(Please )?(feel free to|let me know)[^.!?\n]*[.!?]?\s*$/i,
];

export function stripFiller(text: string | null | undefined): string {
  let out = (text ?? '').trim();
  if (!out) return '';
  // Birden çok dolgu üst üste gelebilir; sabitlenene kadar tekrarla.
  for (let pass = 0; pass < FILLER_PATTERNS.length; pass++) {
    const before = out;
    for (const re of FILLER_PATTERNS) {
      const candidate = out.replace(re, '').trim();
      // Cevabın TAMAMI dolguysa silme — boş mesaj göndermeyelim.
      if (candidate.length > 0) out = candidate;
    }
    if (out === before) break;
  }
  return out.trim();
}

/** Markdown'ı düz metne indirger (DM'lerde markdown render edilmez). */
export function toPlainText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 $2')
    .replace(/`([^`]+)`/g, '$1');
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface BuildPromptInput {
  persona: string;
  rules: string;
  knowledgeText: string;
  replyLang: 'tr' | 'en';
  /** Eskiden yeniye sıralı konuşma geçmişi (son mesaj HARİÇ). */
  history: Array<{ direction: 'inbound' | 'outbound'; body: string }>;
  /** Kullanıcının şu anki mesajı. */
  message: string;
  /** Bilinen ad — persona "ismiyle hitap et" derken kullanır. */
  contactName?: string | null;
}

/**
 * OpenAI mesaj dizisini kurar. Persona + kurallar sistem rolünde,
 * geçmiş gerçek rollerle (model "bunu ben söylemiştim" bilgisini kaybetmez).
 */
export function buildPrompt(input: BuildPromptInput): ChatMessage[] {
  const rules = input.rules
    .replace('{{replyLang}}', input.replyLang === 'tr' ? 'Türkçe' : 'İngilizce')
    .replace('{{knowledgeText}}', input.knowledgeText.trim() || '(ilgili kayıt bulunamadı)');

  const known = input.contactName?.trim()
    ? `\n\nBu kişinin bilinen adı: ${input.contactName.trim()}.`
    : '\n\nBu kişinin adını henüz bilmiyorsun.';

  const messages: ChatMessage[] = [
    { role: 'system', content: input.persona + known },
    { role: 'system', content: rules },
  ];
  for (const h of input.history) {
    messages.push({ role: h.direction === 'inbound' ? 'user' : 'assistant', content: h.body });
  }
  messages.push({ role: 'user', content: input.message });
  return messages;
}
