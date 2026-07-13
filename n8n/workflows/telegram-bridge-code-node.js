// =====================================================================
// Eylul Telegram Bridge — tek Code node, native AI Agent node DEĞİL.
// Aynı gerekçe: bu n8n sürümünde native node şemalarını görsel geri
// bildirim olmadan tahmin etmek risk taşıyor. Adım 5 (chat completion),
// gerçek konuşma geçmişi + RAG bağlamıyla çalışan LLM'in ürettiği cevap
// — burası "analiz" kısmı.
// =====================================================================

const AGENT_KEY = $env.AGENT_API_KEY;
const API_BASE = $env.PREI_API_BASE;
const OPENAI_KEY = $env.OPENAI_API_KEY;
const TG_TOKEN = $env.TELEGRAM_BOT_TOKEN;

// n8n 2.29.10 Code node'ları task-runner'da çalışır, global fetch yok —
// n8n'in kendi HTTP helper'ı kullanılmalı (community-doğrulanmış API).
const httpRequest = this.helpers.httpRequest.bind(this.helpers);

const EYLUL_SYSTEM_PROMPT = `Sen ProDuality'nin dijital yatırım danışmanısın (adın Eylül). ProDuality, Türkiye, BAE (Dubai), İspanya ve İngiltere'de uluslararası gayrimenkul yatırımı yapan bağımsız bir danışmanlıktır — emlak ajansı değil. Kurucu: Onur Nazım Karataş. Amacın satış kapatmak değil, doğru bilgiyle danışmanlık yapıp yatırımcıyı Onur Bey ile bir görüşmeye yönlendirmektir.

DİL: Yatırımcı hangi dilde yazarsa o dilde yanıt ver (Türkçe veya İngilizce). Belirsizse Türkçe başla.

TON: Sıcak, insansı, profesyonel; satışçı değil güvenilir danışman. Baskı yok, abartı yok, getiri garantisi yok. Riski dürüstçe söyle.

KONUŞMA AKIŞI:
1. Önce kayıt: derin danışmanlığa başlamadan ad-soyad + telefon + e-posta almaya çalış (doğal bir şekilde, sorgu gibi değil).
2. "Nereden yazıyorsunuz?" / "Size nasıl yardımcı olabilirim?" ile dinle.
3. Amaç keşfi: vatandaşlık / döviz getirisi / yaşam-oturum / portföy çeşitlendirme.
4. Bütçe, zaman ufku, uyruk, risk algısını baskısız öğren.
5. Dürüst yönlendirme: 1-2 ülke, her biri için tek güçlü sebep + bir risk.
6. Yatırımcıyı bir seviyeye kadar anladıktan SONRA randevu öner: "İsterseniz Onur Bey ile görüşme organize edeyim, özeti kendisine iletirim." → Calendly: https://calendly.com/produality-info/30min

RAG KULLANIM KURALLARI: Sana "İlgili bilgi bankası içeriği" olarak verilen pasajlar dışında rakam/vergi/vize/harç/eşik bilgisi UYDURMA. Bilgi bankasında yoksa dürüstçe "bu konuyu Onur Bey ile netleştirelim" de. Kira getirisi/fiyat verileri tahminidir, garanti değildir.

MUTLAK DOĞRULUK ÇAPALARI (sık hatalar, bunları asla yanlış söyleme):
- İspanya Golden Visa 3 Nisan 2025'te kaldırıldı; mülk alımı artık oturum sağlamaz.
- BAE'de yatırımla vatandaşlık YOK; yatırım sadece oturum (Golden Visa) sağlar (750K AED→2yıl, 2M AED→5yıl).
- UK Tier 1 Investor kapalı (Şubat 2022); mülk oturum vermez.
- Türkiye: 400.000 USD gayrimenkul → doğrudan vatandaşlık.

GUARDRAIL: Getiri garantisi verme; kesin hukuki/vergi tavsiyesi verme ("bağlayıcı değildir, teyit edin"). Şu hallerde Onur'a yönlendir: kesin hukuk/vergi tavsiyesi, garanti ısrarı, çok karmaşık yapı, şikayet/uyuşmazlık, KVKK talebi, kapsam dışı soru. Hassas veri (kimlik no, hesap no) isteme.

Yanıtların kısa ve mesajlaşma-uygun olsun (2-5 cümle, gerekmedikçe madde işareti kullanma).`;

async function agentFetch(path, opts = {}) {
  try {
    return await httpRequest({
      method: opts.method || 'GET',
      url: `${API_BASE}${path}`,
      headers: { 'X-Agent-Key': AGENT_KEY, ...(opts.headers || {}) },
      body: opts.body,
      json: true,
    });
  } catch (err) {
    throw new Error(`PREI API ${path} -> ${err.message}`);
  }
}

async function openaiFetch(path, body) {
  try {
    return await httpRequest({
      method: 'POST',
      url: `https://api.openai.com/v1${path}`,
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body,
      json: true,
    });
  } catch (err) {
    throw new Error(`OpenAI ${path} -> ${err.message}`);
  }
}

async function telegramSend(chatId, text) {
  try {
    return await httpRequest({
      method: 'POST',
      url: `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
      body: { chat_id: chatId, text },
      json: true,
    });
  } catch (err) {
    throw new Error(`Telegram sendMessage -> ${err.message}`);
  }
}

// ---- 1. Telegram update'i parse et (yalnız text mesajları işlenir) ----
const update = $input.first().json.body ?? $input.first().json;
const message = update.message;

if (!message || !message.text) {
  return [{ json: { status: 'ignored_non_text_update' } }];
}

const chatId = message.chat.id;
const from = message.from || {};
const text = message.text;
const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Telegram Kullanıcısı';
const phone = String(from.id);

// ---- 2. Ingest: contact+lead+session+inbound communication (atomik) ----
const ingestResult = await agentFetch('/api/agent/whatsapp-event', {
  method: 'POST',
  body: {
    channel: 'telegram',
    phone,
    name,
    message: text,
    external_session_id: `tg-${chatId}`,
    external_message_id: `tg-${message.message_id}`,
  },
});

if (ingestResult.deduped) {
  return [{ json: { status: 'deduped', ...ingestResult } }];
}

// ---- 3. Konuşma geçmişini çek (LLM'e çok-turlu bağlam vermek için) ----
const history = await agentFetch(`/api/agent/leads/${ingestResult.lead_id}/communications`);
const recent = history.slice(0, 20).reverse();

// ---- 4. RAG: bu turun mesajını embed et, PREI bilgi bankasında ara ----
const embeddingRes = await openaiFetch('/embeddings', {
  model: 'text-embedding-3-small',
  input: text.slice(0, 8000),
});
const embedding = embeddingRes.data[0].embedding;

const knowledgeChunks = await agentFetch('/api/agent/knowledge/search', {
  method: 'POST',
  body: { embedding, matchCount: 4 },
});

const knowledgeText = knowledgeChunks.length
  ? knowledgeChunks.map((k, i) => `[${i + 1}] ${k.content.slice(0, 600)}`).join('\n\n')
  : '(İlgili bilgi bankası içeriği bulunamadı — bu konuda dürüst ol, uydurma.)';

// ---- 5. GERÇEK ANALİZ: Eylül persona + RAG bağlamı + geçmişle LLM cevabı ----
const chatMessages = [
  { role: 'system', content: `${EYLUL_SYSTEM_PROMPT}\n\nİlgili bilgi bankası içeriği (bu turun sorusuyla ilgili):\n${knowledgeText}` },
  ...recent.map((m) => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: m.body || '',
  })),
];

const chatRes = await openaiFetch('/chat/completions', {
  model: 'gpt-4o-mini',
  messages: chatMessages,
  temperature: 0.6,
  max_tokens: 400,
});

const replyText = chatRes.choices[0].message.content.trim();

// ---- 6. Cevabı Telegram'a gönder + outbound olarak logla ----
await telegramSend(chatId, replyText);

await agentFetch('/api/agent/outbound-message', {
  method: 'POST',
  body: {
    lead_id: ingestResult.lead_id,
    channel: 'telegram',
    message: replyText,
  },
});

return [{ json: { status: 'replied', leadId: ingestResult.lead_id, contactId: ingestResult.contact_id, reply: replyText } }];
