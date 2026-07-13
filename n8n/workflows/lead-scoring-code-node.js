// =====================================================================
// PREI Lead Scoring (RAG) — tek Code node, native AI Agent node DEĞİL.
// Neden: bu n8n sürümünde (2.29.10) native node şemalarını görsel geri
// bildirim olmadan tahmin etmek risk taşıyor; burada AKIŞ (embedding→RAG
// search→chat completion→yaz) tamamen açık ve kontrol altında. Gerçek
// analiz burada oluyor — adım 4/5, gerçek OpenAI çağrıları.
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

function buildScoringPrompt(contactName, conversationText, knowledgeChunks) {
  const knowledgeText = knowledgeChunks.length
    ? knowledgeChunks.map((k, i) => `[${i + 1}] (benzerlik ${k.similarity.toFixed(2)}) ${k.content.slice(0, 500)}`).join('\n\n')
    : '(İlgili bilgi bankası içeriği bulunamadı.)';

  return `Sen PREI (Dubai gayrimenkul yatırım danışmanlığı) için bir lead skorlama asistanısın.

Görevin: aşağıdaki lead'in iletişim geçmişini, PREI'nin bilgi bankasından alınan ilgili pazar/ürün bilgisiyle karşılaştırarak 0-100 arası bir "yakınlaşma/nitelik" skoru üret.

Değerlendirme kriterleri:
- Bütçe netliği ve gerçekçiliği (PREI'nin sunduğu ürün aralıklarına göre)
- Niyet/aciliyet sinyalleri (zaman çizelgesi, Golden Visa hedefi, somut soru sorma)
- Yanıt verme hızı ve etkileşim derinliği
- Lead'in ifade ettiği ihtiyaçların PREI envanteri/uzmanlığıyla uyumu (bilgi bankası bağlamına göre)

Lead iletişim geçmişi:
---
${conversationText}
---

İlgili PREI bilgi bankası içeriği:
---
${knowledgeText}
---

Yalnızca şu JSON şemasıyla yanıt ver, başka hiçbir metin ekleme:
{"score": <0-100 tam sayı>, "reasoning": "<Türkçe, 2-4 cümle, somut gerekçe>", "signals": {"budget_clarity": <0-1 arası sayı>, "urgency": <0-1 arası sayı>, "market_match": <0-1 arası sayı>, "engagement_depth": <0-1 arası sayı>}}`;
}

// ---- 1. Skorlanmaya aday lead'leri çek (son 24s'te skorlanmamış) ----
const results = [];
const leads = await agentFetch('/api/agent/leads');

for (const lead of leads) {
  try {
    // ---- 2. Lead'in kendi görüşme geçmişi ----
    const communications = await agentFetch(`/api/agent/leads/${lead.id}/communications`);
    const conversationText = buildConversationText(lead.contactName, communications);

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

    // ---- 4. GERÇEK ANALİZ: LLM, görüşme + RAG bağlamını değerlendirir ----
    const prompt = buildScoringPrompt(lead.contactName, conversationText, knowledgeChunks);

    const chatRes = await openaiFetch('/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sadece geçerli JSON döndüren bir skorlama motorusun.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const parsed = JSON.parse(chatRes.choices[0].message.content);
    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));

    // ---- 5. Sonucu lead_scores'a yaz (append-only, F6 deseni) ----
    const written = await agentFetch('/api/agent/lead-score', {
      method: 'POST',
      body: {
        lead_id: lead.id,
        score,
        reasoning: parsed.reasoning,
        signals: parsed.signals || {},
      },
    });

    results.push({ json: { leadId: lead.id, contactName: lead.contactName, status: 'scored', score, scoreId: written.score_id } });
  } catch (err) {
    results.push({ json: { leadId: lead.id, contactName: lead.contactName, status: 'error', error: err.message } });
  }
}

return results.length ? results : [{ json: { status: 'no_leads_needing_score' } }];
