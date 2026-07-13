// =====================================================================
// PREI Lead Scoring (RAG) — tek Code node, native AI Agent node DEĞİL.
// Neden: bu n8n sürümünde (2.29.10) native node şemalarını görsel geri
// bildirim olmadan tahmin etmek risk taşıyor; burada AKIŞ (embedding→RAG
// search→chat completion→yaz) tamamen açık ve kontrol altında.
// v2 (2026-07-14): SKOR CETVELİ eklendi — Onur'un gerçek konuşma analizi
// tek mesajlık lead'lere bile 85 verildiğini gösterdi. Artık bantlar +
// "profil eksikse 60 üstü YOK" kuralı + profil verisi (bütçe/kriter)
// skorlama bağlamına dahil.
// =====================================================================

const AGENT_KEY = $env.AGENT_API_KEY;
const API_BASE = $env.PREI_API_BASE;
const OPENAI_KEY = $env.OPENAI_API_KEY;

// n8n 2.29.10 Code node'ları task-runner'da çalışır, global fetch yok —
// n8n'in kendi HTTP helper'ı kullanılmalı (community-doğrulanmış API).
const httpRequest = this.helpers.httpRequest.bind(this.helpers);

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

function buildConversationText(contactName, communications) {
  if (communications.length === 0) {
    return `Lead: ${contactName}. Henüz iletişim kaydı yok.`;
  }
  const lines = communications
    .slice()
    .reverse()
    .map((c) => {
      const who = c.direction === 'inbound' ? contactName : 'PREI';
      const body = (c.body || '').slice(0, 800);
      return `[${c.channel}/${c.direction}] ${who}: ${c.subject ? c.subject + ' — ' : ''}${body}`;
    });
  return `Lead: ${contactName}\n\n${lines.join('\n')}`;
}

function buildProfileText(lead) {
  const parts = [];
  if (lead.budgetMin || lead.budgetMax) {
    parts.push(`Bütçe: ${lead.budgetMin ?? '?'} - ${lead.budgetMax ?? '?'} ${lead.currency ?? ''}`);
  } else {
    parts.push('Bütçe: BELİRSİZ');
  }
  const cr = lead.criteria || {};
  parts.push(`Amaç: ${cr.purpose ?? 'BELİRSİZ'}`);
  parts.push(`Pazar/şehir/bölge: ${[cr.market, cr.city, cr.district].filter(Boolean).join(' / ') || 'BELİRSİZ'}`);
  parts.push(`Mülk tipi: ${cr.unit_type ?? 'BELİRSİZ'}${cr.area_m2 ? ` (~${cr.area_m2} m²)` : ''}`);
  parts.push(`Zaman ufku: ${cr.timeline ?? 'BELİRSİZ'}`);
  parts.push(`Özel istekler: ${cr.special_requests ?? '-'}`);
  parts.push(`İletişim: e-posta ${lead.hasEmail ? 'VAR' : 'YOK'}, gerçek telefon ${lead.hasRealPhone ? 'VAR' : 'YOK'}`);
  return parts.join('\n');
}

function buildScoringPrompt(contactName, conversationText, profileText, knowledgeChunks) {
  const knowledgeText = knowledgeChunks.length
    ? knowledgeChunks.map((k, i) => `[${i + 1}] (benzerlik ${k.similarity.toFixed(2)}) ${k.content.slice(0, 500)}`).join('\n\n')
    : '(İlgili bilgi bankası içeriği bulunamadı.)';

  return `Sen PREI (uluslararası gayrimenkul yatırım danışmanlığı) için bir lead skorlama motorusun. Skorun, danışmanın hangi lead'e önce zaman ayıracağını belirler — ŞİŞİRİLMİŞ SKOR, danışmanın vaktini boşa harcatır. Şüphede kal, düşük ver.

SKOR CETVELİ — bu bantlara UYMAK ZORUNDASIN:
- 0-30: Tek mesaj / selamlaşma / genel merak. Profil yok.
- 30-50: İlgi gerçek ama profil çoğunlukla belirsiz (amaç VEYA bölge var, gerisi yok).
- 50-70: Kısmi profil — amaç + bölge + bütçe/tip'ten en az ikisi net; niyet görünür.
- 70-85: Profil büyük ölçüde tam (amaç, bölge, bütçe, mülk tipi net) + aktif etkileşim + iletişim bilgisi paylaşılmış.
- 85-100: Tam profil + belirgin aciliyet/zaman ufku + PREI envanteriyle güçlü uyum + görüşme isteği.

SERT KURALLAR:
1. "YAPILANDIRILMIŞ PROFİL" bölümünde bütçe, amaç, bölge veya mülk tipi alanlarından İKİSİ VEYA FAZLASI "BELİRSİZ" ise skor 60'I GEÇEMEZ.
2. Tek inbound mesaj varsa skor 35'İ GEÇEMEZ.
3. Aciliyet sinyalini yalnız SOMUT kanıtla 0.5 üstü ver (tarih/zaman ifadesi, "bu ay", vize başvuru tarihi, görüşme talebi). "İlgileniyorum" aciliyet DEĞİLDİR.
4. engagement_depth: 3 mesajdan az inbound = en çok 0.3; sorulara ayrıntılı cevap veriyorsa artar.
5. info_completeness: yapılandırılmış profildeki dolu alan oranını yansıt.

Değerlendirme girdileri:

YAPILANDIRILMIŞ PROFİL (sistemin konuşmadan çıkardığı):
---
${profileText}
---

GÖRÜŞME GEÇMİŞİ:
---
${conversationText}
---

İLGİLİ PREI BİLGİ BANKASI İÇERİĞİ (pazar uyumu değerlendirmesi için):
---
${knowledgeText}
---

Yalnızca şu JSON şemasıyla yanıt ver, başka hiçbir metin ekleme:
{"score": <0-100 tam sayı, CETVELE UYGUN>, "reasoning": "<Türkçe, 2-4 cümle; hangi bandın neden seçildiğini ve eksik bilgileri açıkça söyle>", "signals": {"budget_clarity": <0-1>, "urgency": <0-1>, "market_match": <0-1>, "engagement_depth": <0-1>, "info_completeness": <0-1>}}`;
}

// ---- 1. Skorlanmaya aday lead'leri çek (son 24s'te skorlanmamış) ----
const results = [];
const leads = await agentFetch('/api/agent/leads');

for (const lead of leads) {
  try {
    // ---- 2. Lead'in kendi görüşme geçmişi ----
    const communications = await agentFetch(`/api/agent/leads/${lead.id}/communications`);
    const conversationText = buildConversationText(lead.contactName, communications);
    const profileText = buildProfileText(lead);
    const inboundCount = communications.filter((c) => c.direction === 'inbound').length;

    // ---- 3. RAG: geçmişi embed et, PREI bilgi bankasında ara ----
    const embeddingRes = await openaiFetch('/embeddings', {
      model: 'text-embedding-3-small',
      input: conversationText.slice(0, 8000),
    });
    const embedding = embeddingRes.data[0].embedding;

    const knowledgeChunks = await agentFetch('/api/agent/knowledge/search', {
      method: 'POST',
      body: { embedding, matchCount: 5 },
    });

    // ---- 4. GERÇEK ANALİZ: LLM, profil + görüşme + RAG bağlamını değerlendirir ----
    const prompt = buildScoringPrompt(lead.contactName, conversationText, profileText, knowledgeChunks);

    const chatRes = await openaiFetch('/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Skor cetveline harfiyen uyan, muhafazakâr bir skorlama motorusun. Sadece geçerli JSON döndürürsün.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const parsed = JSON.parse(chatRes.choices[0].message.content);
    let score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    // ---- 4b. Cetvel tavanlarını KODDA da zorla (LLM'e güvenme) ----
    const cr = lead.criteria || {};
    const missing = [
      !(lead.budgetMin || lead.budgetMax),
      !cr.purpose,
      !(cr.market || cr.city || cr.district),
      !cr.unit_type,
    ].filter(Boolean).length;
    if (missing >= 2 && score > 60) score = 60;
    if (inboundCount <= 1 && score > 35) score = 35;

    // ---- 5. Sonucu lead_scores'a yaz (append-only, F6 deseni) ----
    const written = await agentFetch('/api/agent/lead-score', {
      method: 'POST',
      body: {
        lead_id: lead.id,
        score,
        reasoning: parsed.reasoning,
        signals: { ...(parsed.signals || {}), inbound_messages: inboundCount, capped: score !== Math.round(parsed.score) },
      },
    });

    results.push({ json: { leadId: lead.id, contactName: lead.contactName, status: 'scored', score, llmScore: Math.round(parsed.score), scoreId: written.score_id } });
  } catch (err) {
    results.push({ json: { leadId: lead.id, contactName: lead.contactName, status: 'error', error: err.message } });
  }
}

return results.length ? results : [{ json: { status: 'no_leads_needing_score' } }];
