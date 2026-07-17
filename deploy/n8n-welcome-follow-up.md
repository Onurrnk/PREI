# n8n — Welcome Takip Akışı (günlük onay döngüsü)

**Amaç:** Hoş geldiniz mailine ≥3 gündür yanıt vermeyen web yatırımcıları için
Eylül'ün marka sesiyle takip taslağı hazırlaması ve Onur'un Telegram'dan tek
dokunuşla onaylaması. Onaysız hiçbir takip maili gönderilmez.

**Durum:** Backend uçları CANLI (2026-07-17). n8n workflow'u henüz kurulmadı —
n8n MCP bağlandığında bu dokümandaki tasarım birebir uygulanacak.

## Backend sözleşmesi (hazır)

Tümü `X-Agent-Key: <AGENT_API_KEY>` ile (backend.env'deki değer; n8n'de mevcut
"PREI Agent" credential'ı aynı anahtarı kullanıyor).

1. **Aday listesi**
   `GET https://api.produality.com/api/agent/leads/welcome-follow-up?days=3`
   Dönen dizi: `{ contact_id, lead_id, name, email, lang ('tr'|'en'), source
   ('Website Contact Form'|'ROI Calculator'|null), welcome_sent_at, days_since }`
   Filtre backend'de: takip zaten gönderilmişse, inbound yanıt geldiyse veya
   lead kapandıysa kişi listede GÖRÜNMEZ. Boş dizi = bugün iş yok.

2. **Gönderim** (onay sonrası) — mevcut `agent-mail.php` ucu:
   `POST https://produality.com/api/agent-mail.php` (X-Agent-Key: PD_AGENT_KEY)
   Eylül'ün ürettiği gövde markalı kabuğa sarılır, info@'dan gönderilir.

3. **Kayıt** — mevcut uç: `POST /api/agent/outbound-message`
   `{ lead_id, channel: 'email', message: <gönderilen metin> }`

4. **İşaretleme** (tekrar listelenmesin):
   `POST /api/agent/contacts/{contact_id}/welcome-follow-up-sent`

## Workflow tasarımı (5 node — az node, net akış)

1. **Schedule Trigger** — her gün 10:00 (Europe/Istanbul).
2. **HTTP Request** — aday listesi (yukarıdaki GET). Boşsa akış biter.
3. **AI Agent (Eylül)** — her aday için taslak. Prompt çekirdeği:
   - Kimlik: ProDuality kurucu ekibi adına, marka ses rehberine sadık
     (satıcı değil danışman; sakin kesinlik; baskı/FOMO yasak; isimle hitap).
   - Girdi: name, lang, source, days_since.
   - Görev: 2-3 kısa paragraf takip maili. Suçlayıcı/ısrarcı olmayan bir
     hatırlatma + tek bir net davet (Calendly:
     https://calendly.com/produality-info/30min). lang'a göre TR veya EN.
   - Çıktı: JSON `{ subject, bodyText }`.
4. **Telegram (onay)** — Onur'a: aday özeti + taslak + inline butonlar
   [Gönder] [Atla]. (Mevcut Eylül botu; callback'i bekleyen Wait/Telegram
   Trigger deseni, proposal follow-up akışıyla aynı.)
5. **Onaylanırsa zincir:** agent-mail.php gönderimi → outbound-message kaydı →
   welcome-follow-up-sent işareti. [Atla] seçilirse hiçbir şey yapılmaz
   (kişi ertesi gün yine listelenir; kalıcı susturmak istenirse Onur CRM'den
   lead'i kapatır).

## Not
- Adaylar zaten telefon+e-posta dolu kişiler (welcome yalnız onlara gitti).
- `days` parametresi 1-60 aralığına kıstırılır; liste 50 kişiyle sınırlı.
