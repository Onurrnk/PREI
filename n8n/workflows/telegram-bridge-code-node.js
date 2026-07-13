// =====================================================================
// Eylul Telegram Bridge — tek Code node, native AI Agent node DEĞİL.
// Akış: 1) update parse → 2) ingest → 3) geçmiş → 4) RAG → 5) Eylül
// cevabı (keşif-öncelikli persona) → 6) gönder+logla → 7) profil
// extraction (ad/e-posta/telefon/bütçe/kriterler → lead-profile API).
// v2 (2026-07-14, Onur'un gerçek konuşma analizinden sonra): tanıtım
// kuralı, tek-soru keşif akışı, erken Calendly yasağı, ücret guardrail'i,
// /start deterministik karşılama, extraction adımı EKLENDİ.
// =====================================================================

const AGENT_KEY = $env.AGENT_API_KEY;
const API_BASE = $env.PREI_API_BASE;
const OPENAI_KEY = $env.OPENAI_API_KEY;
const TG_TOKEN = $env.TELEGRAM_BOT_TOKEN;

// n8n 2.29.10 Code node'ları task-runner'da çalışır, global fetch yok —
// n8n'in kendi HTTP helper'ı kullanılmalı (community-doğrulanmış API).
const httpRequest = this.helpers.httpRequest.bind(this.helpers);

const INTRO_MESSAGE = `Merhaba, ben Eylül 👋

ProDuality'nin yapay zeka yatırım asistanıyım. Türkiye, Dubai, İspanya ve İngiltere'de gayrimenkul yatırımı konusunda size yardımcı olabilirim — sorularınızı yanıtlar, aradığınız yatırımı netleştirmenize destek olurum.

Size nasıl yardımcı olabilirim?`;

const EYLUL_SYSTEM_PROMPT = `Sen Eylül'sün — ProDuality'nin yapay zeka yatırım asistanı. ProDuality, Türkiye, BAE (Dubai), İspanya ve İngiltere'de uluslararası gayrimenkul yatırımı yapan bağımsız bir danışmanlıktır — emlak ajansı değil. Kurucu: Onur Nazım Karataş. Amacın satış kapatmak DEĞİL: yatırımcıyı gerçekten anlamak, doğru bilgi vermek ve profili netleştiğinde Onur Bey ile görüşmeye köprü olmak.

KİMLİK ŞEFFAFLIĞI: Yapay zeka asistanı olduğunu asla gizleme. Sorulursa doğal karşıla: "Evet, ProDuality'nin yapay zeka asistanıyım — ama sorularınızı ciddiyetle dinliyorum ve size gerçek bilgi veriyorum."

DİL: Yatırımcı hangi dilde yazarsa o dilde yanıt ver (Türkçe veya İngilizce). Belirsizse Türkçe.

TON: Sıcak, insansı, sabırlı. Satışçı değil, meraklı ve iyi dinleyen bir danışman. Kısa cümleler, mesajlaşma ritmi (2-4 cümle). Robotik kalıplardan kaçın ("Size nasıl yardımcı olabilirim?" tekrarı yok).

KEŞİF-ÖNCELİKLİ AKIŞ — EN ÖNEMLİ KURALIN:
Görevin yatırımcıyı ANLAMAK. Bilgi vermekle keşif sorusu sormayı dengele: her cevabında önce kullanıcının sorusunu/söylediğini karşıla, SONRA profili derinleştiren TEK bir soru sor. Asla üst üste birden çok soru sorma (anket gibi hissettirir).
Zamanla netleştirmen gereken profil (sırayla, doğal akışta):
1. Amaç: yatırım getirisi mi, vatandaşlık/oturum mu, kendi kullanımı mı, karma mı?
2. Pazar + şehir + bölge tercihi (varsa)
3. Mülk tipi ve oda düzeni (1+1, 2+1, 3+1, villa...) + yaklaşık m² beklentisi
4. Bütçe aralığı + para birimi
5. Zaman ufku (ne zaman almak istiyor, aciliyeti var mı)
6. Özel istekler (deniz manzarası, site içi, havuz, kat tercihi, kiralama planı...)
7. İletişim bilgileri: ad-soyad, telefon, e-posta — doğal bir anda iste ("Size özel seçenekleri derleyip iletebilmem için..."), sorgulama gibi değil.
Kullanıcı bir bilgiyi zaten verdiyse TEKRAR SORMA — bir üst maddeye geç.

RANDEVU (Calendly) KURALI — İHLAL ETME:
Onur Bey ile görüşme/Calendly linkini yalnız ŞU DURUMLARDA öner: (a) kullanıcı kendisi görüşme/arama isterse, VEYA (b) profilin en az 4 maddesi (amaç, bölge, bütçe, mülk tipi) netleşmişse. Bunun DIŞINDA randevu önerme ve mesaj sonlarına Calendly ekleme alışkanlığı YOK. Link gerektiğinde: https://calendly.com/produality-info/30min

RAG KULLANIM KURALLARI: Sana "İlgili bilgi bankası içeriği" olarak verilen pasajlar dışında rakam/vergi/vize/harç/eşik bilgisi UYDURMA. Bilgi bankasında yoksa dürüstçe söyle ve o konuyu Onur Bey'e taşımayı öner. Kira getirisi/fiyat verileri tahminidir, garanti değildir.

ÜCRET SORUSU GUARDRAIL'İ: ProDuality'nin GAYRİMENKUL danışmanlığı yatırımcıdan ayrıca danışmanlık ücreti almaz — gelir, işlem gerçekleştiğinde piyasa standardı emlak komisyonudur. Bilgi bankasında görebileceğin AI otomasyon/White Label/bakım paketi fiyatları (500-5000 USD gibi) ProDuality'nin AYRI bir hizmet kolu (işletmelere yazılım hizmeti) — GAYRİMENKUL müşterisine BUNLARI ASLA danışmanlık ücreti olarak sunma.

MUTLAK DOĞRULUK ÇAPALARI (asla yanlış söyleme):
- İspanya Golden Visa 3 Nisan 2025'te kaldırıldı; mülk alımı artık oturum sağlamaz.
- BAE'de yatırımla vatandaşlık YOK; yatırım sadece oturum (Golden Visa) sağlar (750K AED→2yıl, 2M AED→5yıl).
- UK Tier 1 Investor kapalı (Şubat 2022); mülk oturum vermez.
- Türkiye: 400.000 USD gayrimenkul → doğrudan vatandaşlık.

GUARDRAIL: Getiri garantisi verme; kesin hukuki/vergi tavsiyesi verme ("bağlayıcı değildir, teyit edin"). Şu hallerde Onur Bey'e yönlendir: kesin hukuk/vergi tavsiyesi, garanti ısrarı, çok karmaşık yapı, şikayet/uyuşmazlık, KVKK talebi, kapsam dışı soru. Hassas veri (kimlik no, banka hesabı) İSTEME — ad/telefon/e-posta yeterli.`;

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

// ---- 1b. /start → deterministik tanıtım (LLM'e gitmez, sabit ve hızlı) ----
if (text.trim() === '/start') {
  await telegramSend(chatId, INTRO_MESSAGE);
  const ing = await agentFetch('/api/agent/whatsapp-event', {
    method: 'POST',
    body: {
      channel: 'telegram', phone, name,
      message: '/start',
      external_session_id: `tg-${chatId}`,
      external_message_id: `tg-${message.message_id}`,
    },
  });
  if (!ing.deduped) {
    await agentFetch('/api/agent/outbound-message', {
      method: 'POST',
      body: { lead_id: ing.lead_id, channel: 'telegram', message: INTRO_MESSAGE },
    });
  }
  return [{ json: { status: 'intro_sent', leadId: ing.lead_id } }];
}

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
const recent = history.slice(0, 24).reverse();
const isFirstExchange = !recent.some((m) => m.direction === 'outbound');

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
const firstMessageRule = isFirstExchange
  ? `\n\nİLK TEMAS: Bu, bu kullanıcıyla İLK konuşman. Cevabına kendini KISACA tanıtarak başla: "Merhaba, ben Eylül — ProDuality'nin yapay zeka yatırım asistanıyım." Sonra kullanıcının mesajını karşıla.`
  : '';

const chatMessages = [
  { role: 'system', content: `${EYLUL_SYSTEM_PROMPT}${firstMessageRule}\n\nİlgili bilgi bankası içeriği (bu turun sorusuyla ilgili):\n${knowledgeText}` },
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

// ---- 7. PROFİL EXTRACTION: konuşmadan yapılandırılmış bilgi çıkar, kaydet ----
// Cevap zaten gönderildi — bu adımın gecikmesi/hatası kullanıcıyı etkilemez.
let extractionStatus = 'skipped';
try {
  const convoText = recent
    .concat([{ direction: 'inbound', body: text }])
    .map((m) => `${m.direction === 'inbound' ? 'MÜŞTERİ' : 'EYLÜL'}: ${(m.body || '').slice(0, 500)}`)
    .join('\n');

  const extractRes = await openaiFetch('/chat/completions', {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Görüşme metninden MÜŞTERİNİN AÇIKÇA SÖYLEDİĞİ bilgileri çıkar. Tahmin/çıkarım YAPMA — yalnız metinde geçen bilgiyi al. Şu JSON şemasıyla yanıt ver (bilinmeyen alanları TAMAMEN ATLA, null yazma):
{"first_name": "<ad>", "last_name": "<soyad>", "email": "<e-posta>", "phone": "<telefon, uluslararası formata çevir: 05xx→+905xx>", "budget_min": <sayı>, "budget_max": <sayı>, "currency": "<TRY|USD|EUR|GBP|AED>", "criteria": {"purpose": "<amaç>", "market": "<ülke>", "city": "<şehir>", "district": "<bölge/semt>", "unit_type": "<1+1/2+1/villa...>", "area_m2": <sayı>, "timeline": "<zaman ufku>", "special_requests": "<özel istekler>"}}
Tek bütçe rakamı verilmişse hem budget_min hem budget_max'e aynı değeri yaz. criteria içinde de yalnız söylenmiş alanları doldur.`,
      },
      { role: 'user', content: convoText },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  const extracted = JSON.parse(extractRes.choices[0].message.content);
  const hasData = Object.keys(extracted).some((k) => k === 'criteria'
    ? extracted.criteria && Object.keys(extracted.criteria).length > 0
    : extracted[k] !== undefined && extracted[k] !== null && extracted[k] !== '');

  if (hasData) {
    const profileRes = await agentFetch('/api/agent/lead-profile', {
      method: 'POST',
      body: { lead_id: ingestResult.lead_id, ...extracted },
    });
    extractionStatus = `updated: ${(profileRes.updated || []).join(',') || 'none'}`;
  } else {
    extractionStatus = 'no_new_data';
  }
} catch (err) {
  extractionStatus = `error: ${err.message}`;
}

return [{ json: { status: 'replied', leadId: ingestResult.lead_id, reply: replyText, extraction: extractionStatus } }];
