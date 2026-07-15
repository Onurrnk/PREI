// =====================================================================
// PREI Weekly Intelligence Report Broadcast — tek Code node, native AI
// Agent node DEĞİL (aynı gerekçe, bkz. lead-scoring-code-node.js).
// Akış: Webhook (title + reportText, Claude Cowork'ten yapıştırılır) →
// OpenAI ile marka sesine uygun temiz HTML/metin üretimi (TEK sefer,
// içerik herkese aynı) → GET /api/agent/clients/active (PREI) → her aktif
// müşteriye produality.com/api/agent-mail.php ile gönder (kişisel
// selamlama agent-mail.php'de toName ile ayrıca üretilir).
// =====================================================================

const AGENT_KEY = $env.AGENT_API_KEY;
const API_BASE = $env.PREI_API_BASE;
const OPENAI_KEY = $env.OPENAI_API_KEY;
const PD_API_BASE = $env.PD_API_BASE;
const PD_AGENT_KEY = $env.PD_AGENT_KEY;

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

// Webhook body n8n'de $json.body altında gelir (bkz. telegram-bridge ile
// aynı desen); ikisini de dener.
const input = $input.first().json.body ?? $input.first().json;
const title = (input.title || '').trim();
const reportText = (input.reportText || '').trim();

if (!title || !reportText) {
  return [{ json: { status: 'error', error: 'title ve reportText zorunlu alanlardır' } }];
}

const prompt = `Sen ProDuality (uluslararası gayrimenkul yatırım danışmanlığı) için haftalık piyasa istihbarat raporunu, müşterilere gidecek markalı bir e-postaya dönüştürüyorsun. Aşağıdaki ham araştırma metnini al, temizle ve biçimlendir.

KURALLAR (KESİN):
1. ASLA tire ( - ) karakteri kullanma; madde işareti gerekiyorsa <ul><li> kullan, tire değil.
2. İçeriği KISALTMA veya ÖZETLEME — yalnızca biçimlendir, temizle, kurumsal tona çevir. Tüm veri/rakam/analiz korunmalı.
3. HTML'de yalnız şu etiketleri kullan: <h2 style="margin:24px 0 12px 0; font-size:18px; color:#292524;">, <p style="margin:0 0 18px 0;">, <ul style="margin:0 0 18px 0; padding-left:20px;">, <li style="margin:0 0 8px 0;">.
4. Kurumsal "biz" sesiyle sun (ProDuality ekibi konuşuyor); kişisel isim yok.
5. Hem düz metin hem HTML sürümünü üret.

Ham rapor başlığı: ${title}

Ham rapor metni:
---
${reportText}
---

Yalnızca şu JSON şemasıyla yanıt ver, başka hiçbir metin ekleme:
{"subject": "<e-posta konu satırı, tire yok>", "bodyText": "<düz metin sürüm>", "bodyHtml": "<yukarıdaki kurala uygun HTML>"}`;

const chatRes = await openaiFetch('/chat/completions', {
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'Ham araştırma metnini marka sesine uygun, tiresiz, eksiksiz bir HTML e-postaya dönüştüren bir editörsün. Sadece geçerli JSON döndürürsün.' },
    { role: 'user', content: prompt },
  ],
  response_format: { type: 'json_object' },
  temperature: 0.2,
});
const copy = JSON.parse(chatRes.choices[0].message.content);

const clients = await agentFetch('/api/agent/clients/active');

const results = [];
for (const c of clients) {
  try {
    await sendBrandedMail({
      type: 'weekly_report',
      to: c.email,
      toName: c.name,
      lang: 'tr',
      subject: copy.subject,
      bodyHtml: copy.bodyHtml,
      bodyText: copy.bodyText,
      cta: true,
    });
    results.push({ clientId: c.id, status: 'sent' });
  } catch (err) {
    results.push({ clientId: c.id, status: 'error', error: err.message });
  }
}

return [{
  json: {
    status: 'done',
    totalClients: clients.length,
    sent: results.filter((r) => r.status === 'sent').length,
    results,
  },
}];
