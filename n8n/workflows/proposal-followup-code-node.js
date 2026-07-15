// =====================================================================
// PREI Proposal Follow-up — tek Code node, native AI Agent node DEĞİL.
// Neden: bu n8n sürümünde (2.29.10) native node şemalarını görsel geri
// bildirim olmadan tahmin etmek risk taşıyor (bkz. lead-scoring-code-node.js
// ve telegram-bridge-code-node.js ile aynı gerekçe/desen).
// Akış: GET /api/agent/proposals/stale (PREI) → her biri için OpenAI ile
// kişiselleştirilmiş, tiresiz, kurumsal tonlu takip metni → produality.com
// /api/agent-mail.php ile marka şablonunda gönder → POST
// /api/agent/proposals/:id/follow-up-sent ile işaretle (idempotency).
// =====================================================================

const AGENT_KEY = $env.AGENT_API_KEY;
const API_BASE = $env.PREI_API_BASE;
const OPENAI_KEY = $env.OPENAI_API_KEY;
const PD_API_BASE = $env.PD_API_BASE;     // örn. https://produality.com
const PD_AGENT_KEY = $env.PD_AGENT_KEY;   // api/lib/secrets.php ile eşleşmeli

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

async function sendBrandedMail(body) {
  try {
    return await httpRequest({
      method: 'POST',
      url: `${PD_API_BASE}/api/agent-mail.php`,
      headers: { 'X-Agent-Key': PD_AGENT_KEY, 'Content-Type': 'application/json' },
      body,
      json: true,
    });
  } catch (err) {
    throw new Error(`ProDuality mail -> ${err.message}`);
  }
}

function buildFollowUpPrompt(p) {
  return `Sen ProDuality (uluslararası gayrimenkul yatırım danışmanlığı) adına, bir müşteriye daha önce gönderilmiş bir yatırım teklifinin ardından NAZİK bir takip e-postası yazıyorsun.

Bağlam:
- Müşteri adı: ${p.contactName}
- Proje: ${p.projectName || 'görüştüğümüz fırsat'}
- Teklif gönderileli ${p.daysSinceSent} gün oldu, henüz yanıt gelmedi.

KURALLAR (KESİN):
1. ASLA tire ( - ) karakteri kullanma.
2. Kurumsal ama sıcak bir ton kullan; "biz" diliyle yaz (kişisel isim/imza YOK, o ayrıca eklenecek).
3. Baskıcı/satış dili kullanma; nazik bir hatırlatma ve kapı açık bırakma havası.
4. Görüşme ayarlama çağrısı AYRICA bir buton olarak eklenecek — metinde bunu tekrar isteme, yalnızca sorularına açık olduğunuzu belirtin.
5. 2-4 kısa paragraf; ne çok kısa ne çok uzun.
6. Hem düz metin hem HTML sürümünü üret. HTML'de yalnız <p style="margin:0 0 18px 0;">...</p> etiketini kullan, başka hiçbir HTML etiketi ekleme.

Yalnızca şu JSON şemasıyla yanıt ver, başka hiçbir metin ekleme:
{"subject": "<konu satırı, tire yok>", "bodyText": "<düz metin, paragraflar \\n\\n ile ayrılmış>", "bodyHtml": "<yukarıdaki kurala uygun HTML>"}`;
}

const results = [];
const staleProposals = await agentFetch('/api/agent/proposals/stale?days=5');

for (const p of staleProposals) {
  try {
    const chatRes = await openaiFetch('/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Kurumsal, tiresiz, sıcak tonlu marka metni yazan bir asistansın. Sadece geçerli JSON döndürürsün.' },
        { role: 'user', content: buildFollowUpPrompt(p) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });
    const copy = JSON.parse(chatRes.choices[0].message.content);

    await sendBrandedMail({
      type: 'proposal_follow_up',
      to: p.contactEmail,
      toName: p.contactName,
      lang: 'tr',
      subject: copy.subject,
      bodyHtml: copy.bodyHtml,
      bodyText: copy.bodyText,
      cta: true,
    });

    await agentFetch(`/api/agent/proposals/${p.id}/follow-up-sent`, { method: 'POST' });

    results.push({ json: { proposalId: p.id, contactName: p.contactName, status: 'sent' } });
  } catch (err) {
    results.push({ json: { proposalId: p.id, contactName: p.contactName, status: 'error', error: err.message } });
  }
}

return results.length ? results : [{ json: { status: 'no_stale_proposals' } }];
