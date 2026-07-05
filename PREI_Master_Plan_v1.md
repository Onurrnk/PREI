# PREI × ProDuality — Product-Ready Master Plan v1.1

**Tarih:** 2026-07-02 · **Revizyon:** v1.1 — 2026-07-04 (/plan-ceo-review, SELECTIVE EXPANSION; 22 karar — bkz. §9 Revizyon Günlüğü) · **Sahibi:** Onur Nazım KARATAŞ (Super Admin)
**Amaç:** PREI CRM'i production-ready hale getirmek ve ProDuality otomasyon altyapısını (WhatsApp/Telegram/n8n/Meta Ads) bu CRM'in etrafında, CRM'i **sistemin beyni** yapacak şekilde faz faz kurgulamak.

> Bu doküman `PREI_Architecture_Blueprint.md` (mimari anayasa) ile `ProDuality_Master_Prompt_v3.md` (otomasyon spesifikasyonu) arasındaki köprüdür. Çelişki durumunda mimari kurallar Blueprint'ten, iş kuralları Master Prompt'tan, **fazlama ve entegrasyon kararları bu dokümandan** okunur.

---

## 1. Mevcut Durum Envanteri (Ne var, ne eksik)

| Bileşen | Durum | Not |
|---|---|---|
| **Frontend (React 19 + Vite)** | ✅ Kapsamlı UI var | 13 modül: dashboard, leads, clients, developers, projects, proposals, documents, meetings, tasks, contracts, financials, admin, settings |
| **Backend verisi** | ⚠️ **Tamamı MSW mock** | `src/mocks/handlers.ts` — gerçek veri yok. Production'a giden en kritik boşluk |
| **NestJS server** | ⚠️ Embriyonik | Sadece Gmail OAuth + contacts matcher. CRM API'leri yok |
| **DB şeması** | ✅ Güçlü temel | `migrations/001_crm_core.sql`: tenants, users, roles/RBAC, teams, contacts, organizations, properties, leads, deals, activities, communications, audit_log + RLS fonksiyonları |
| **RBAC (frontend)** | ⚠️ Basit | Admin/Manager/Consultant — Super Admin kavramı ve backend enforcement yok |
| **Supabase (ProDuality)** | ✅ Kısmen canlı | `knowledge_chunks` (RAG) mevcut — **dokunulmaz, sadece okunur** |
| **Airtable** | ✅ Canlı | Master Prompt'un CRM'i olarak tasarlanmıştı — bkz. Karar K-2 |
| **n8n** | ⚠️ Denemeler var | 6 fazlık otomasyon henüz kurulmadı |
| **Meta Ads** | ❌ Yok | Reklam analitiği, atıf (attribution), ROI takibi tamamen eksik |
| **Auth** | ❌ Yok | Login mock; gerçek JWT/Supabase Auth yok |

---

## 2. Kritik Mimari Kararlar (bu plan bunların üstüne kurulu)

### K-1 — Tek Doğruluk Kaynağı: PREI Supabase Postgres
Master Prompt kendi `users/leads/properties/contracts/financials` tablolarını tanımlıyor; PREI şeması (001_crm_core) bunların daha olgun (tenant envelope, audit, RBAC'li) versiyonlarını zaten içeriyor. **İki paralel şema kurulmayacak.** n8n workflow'ları Master Prompt'un tablolarına değil, PREI şemasına yazar. Master Prompt'taki eksik tablolar PREI konvansiyonlarıyla (envelope + RLS) yeni migration'lar olarak eklenir (bkz. §3).

### K-2 v2 — Ayna yok: PREI tek araç *(revize: 2026-07-04, Onur + CEO review)*
CRM artık PREI'nin kendisi — ve **hiçbir SaaS aynası kurulmaz**. Gerekçe: (a) Airtable'da kayıtlı veri yok (boş — tarihsel import ihtiyacı düştü), (b) B-14 zaten Faz 1 sonunda 390px-uyumlu PWA taahhüt ediyor; ~3 hafta ömürlü bir senkron aynası boşa iştir. Airtable derhal emekli. Mobil/saha erişimi = PWA (B-14 önceliği yükseldi). *(Master Prompt'taki tüm "Airtable upsert" adımları tamamen düşer.)* Not: **"PREI Smart Suites"** ürünün kendi modül setinin ticari adıdır — harici bir araç değildir.

### K-3 — n8n = otomasyon düzlemi, PREI = beyin
n8n dış dünya ile (WhatsApp, Telegram, Calendly, Meta, SendGrid, Perplexity) konuşur; ama **karar verisi ve durum daima PREI DB'de** yaşar. Her n8n workflow'u PREI'ye servis-principal olarak (scoped API key / service role) yazar ve her yazım `audit_log`'a düşer. Blueprint §8'deki "agents get no privileged backdoor" kuralı n8n için de geçerli.

### K-4 — Super Admin modeli
`super_admin` rolü (001_crm_core'da zaten öngörülmüş) tek kişiye — Onur'a — atanır ve:
- Tüm modüllere okuma/yazma, tüm tenant verisine erişim,
- Rol/izin atama, kullanıcı davet/devre dışı bırakma,
- Audit log, tüm finansallar, komisyon verileri ve Meta Ads harcamalarını görme yetkisine sahiptir.
- **Komisyon gizliliği (Master Prompt Kritik Not 3):** CBI komisyon dağılımı DB'de `confidential` işaretli alanlarda tutulur; yalnızca `super_admin` ve `finance_manager` okuyabilir. Eylül ve PREI-asistan bu alanlara erişen sorgu yapamaz (RLS + tool-seviyesi filtre).

### K-5 — Meta Ads verisi CRM'e akar, atıf lead'de kapanır
Reklam → lead → satış zinciri tek yerde izlenir: WhatsApp Click-to-Ad (CTWA) `referral` payload'ındaki `ad_id/adset_id/campaign_id` lead kaydına yazılır; Meta Insights API'den gelen harcama/performans verisi `ad_insights` tablosuna günlük sync edilir. Böylece "hangi kampanya kaç €'ya kaç qualified lead ve kaç kapanış getirdi" sorusu SQL ile cevaplanır — sistemin "beyin" olmasının özü budur.


### K-6 — Pazar modeli çok ülkeli ve genişletilebilir (Onur, 2026-07-02)
Aktif satış pazarları: **Türkiye, BAE (Dubai), İspanya, İngiltere**. Planlanan: **Tayland, Almanya**. Sonuç olarak:
- Master Prompt'taki `CHECK (country IN ('TR','UAE'))` ve `target_market IN ('TR','UAE','both')` kısıtları **kullanılmaz** — migration 002'de `markets` lookup tablosu kurulur (`code, name, currency, timezone, is_active`); properties/leads bu tabloya FK verir. Yeni ülke = 1 satır INSERT, migration yok.
- Eylül'ün qualification mantığındaki pazar regex'i (TR/Dubai) tüm aktif pazarları kapsayacak şekilde genişletilir; `knowledge_chunks.market` değerleri mevcut haliyle kalır, yeni pazar içerikleri geldikçe eklenir.
- Raporlama para birimi normalizasyonu (B-7 `fx_rates`) artık zorunluluk: EUR baz; GBP/THB dahil.
- Haftalık bülten (Faz 6) pazar başına özet üretecek şekilde parametrik kurulur.

---

## 3. Şema Uzlaştırma Haritası (Master Prompt → PREI)

| Master Prompt tablosu | PREI karşılığı | Aksiyon |
|---|---|---|
| `users` (lead/client/partner) | `contacts` (+ `users` yalnızca personel) | Master Prompt'un "users"ı aslında kişi kartı → `contacts`'a alanlar eklenir: `birthdate`, `nationality`, `language`, `is_pm_client`, `is_subscribed_reports`, `whatsapp_number` |
| `leads` | `leads` (mevcut) | Eksik alanlar migration ile: `qualification_score`, `qualification_data jsonb`, `calendly_booked`, `research_data jsonb`, `target_market`, `investment_purpose`, `budget_min/max`, `timeline` |
| `conversation_sessions` | **YENİ** `conversation_sessions` | Envelope'lu olarak eklenir; `contact_id` FK |
| `properties` | `properties` (mevcut) | PM alanları eklenir: `pm_fee_gross_pct`, `pm_fee_net_pct`, `monthly_rent_eur`, `developer_id` FK |
| `financials` | **YENİ** `financials` | Envelope'lu; frontend'deki Financials modülüne gerçek veri kaynağı olur |
| `meeting_notes` | **YENİ** `meeting_notes` | Frontend Meetings modülüne bağlanır |
| `contracts` | **YENİ** `contracts` | Frontend Contracts modülüne bağlanır; koruma pencereleri dahil |
| `knowledge_chunks` | Olduğu gibi kalır | **Dokunma** — sadece `match_knowledge_chunks` RPC eklenir |
| Views (`upcoming_birthdays`, `overdue_payments`, `contract_renewal_alerts`) | Aynen, PREI tabloları üzerinde | Migration 002+ içinde |
| — | **YENİ** `ad_accounts`, `ad_campaigns`, `ad_sets`, `ads`, `ad_insights_daily`, `lead_attributions` | Meta Ads modülü (Faz 5) |

---

## 4. RBAC — Rol ve İzin Matrisi

Roller (DB `roles.key` ↔ frontend `Role`):

| Modül / Yetenek | `super_admin` (Onur) | `manager` | `finance_manager` | `marketing_manager` | `consultant` |
|---|---|---|---|---|---|
| Dashboard (genel KPI) | ✅ | ✅ | ✅ | ✅ | ✅ (kendi) |
| Leads / Pipeline | ✅ tümü | ✅ tümü | 👁 okuma | 👁 okuma | ✅ kendi atananları |
| Clients | ✅ | ✅ | 👁 | 👁 | ✅ kendi portföyü |
| Developers / Projects / Proposals | ✅ | ✅ | 👁 | 👁 | ✅ |
| Documents | ✅ | ✅ | ✅ | kendi klasörü | kendi klasörü |
| Meetings / Tasks | ✅ | ✅ | ✅ | ✅ | ✅ kendi |
| Contracts | ✅ | ✅ | ✅ | ❌ | ❌ |
| Financials | ✅ | 👁 özet | ✅ | ❌ | ❌ |
| **Komisyon dağılımı (CBI)** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Meta Ads / Marketing Analytics** | ✅ | 👁 | 👁 maliyet | ✅ | ❌ |
| Admin (kullanıcı/rol/audit) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ayarlar (sistem geneli) | ✅ | ❌ | ❌ | ❌ | ❌ |
| n8n / entegrasyon anahtarları | ✅ | ❌ | ❌ | ❌ | ❌ |

Uygulama kuralları (Blueprint §7.1 ile uyumlu):
1. İzinler **backend Application katmanında** zorlanır; frontend `permissions.ts` yalnızca UI gizler.
2. Consultant için ABAC: sadece `assigned_to = kendisi` olan lead/client kayıtları (RLS politikası + servis filtresi).
3. Tüm allow/deny kararları audit'e loglanır; Super Admin panelinden izlenir.
4. AI ajanları (Eylül, PREI-asistan, n8n servisleri) ayrı servis-principal'lardır; kendi scoped izin setleri vardır ve komisyon/gizli alanlara izinleri yoktur.

---

## 4.5 Güvenlik Katmanı (zorunlu, faz-eşlemeli)

Güvenlik ayrı bir faz değil, **her fazın çıkış kapısıdır** — ilgili maddeler kapanmadan faz onaylanmaz. Blueprint §7.5 baseline'ının bu projeye somutlanmış hali:

### G-1 · Kimlik ve Erişim *(Faz 0 kapısı)*
- Supabase Auth + JWT; refresh token rotasyonu (tek kullanımlık, yeniden kullanım tespitinde oturum ailesi iptal).
- **Super Admin hesabında MFA/2FA zorunlu** (TOTP). Yeni kullanıcı daveti yalnız Super Admin'den; self-signup kapalı.
- Deny-by-default: rolü/izni olmayan her istek 403 değil **404** döner (varlık ifşası yok).
- DB rol disiplini: frontend'e yalnız `anon` key; `service_role` key **asla** tarayıcıya/n8n dışına çıkmaz; migration'lar ayrı privileged rol ile.

### G-2 · Sır Yönetimi *(Faz 0 kapısı, her fazda denetim)*
- Hiçbir API anahtarı kodda/git'te tutulmaz; `.env` + platform secret store (Vercel/Railway/Supabase Vault). `.gitignore` denetimi + pre-commit secret taraması (gitleaks).
- n8n credential'ları n8n'in şifreli credential store'unda; workflow JSON'larında `{{ $env.X }}` — hardcode yasak (Master Prompt Kritik Not 4).
- Anahtar rotasyon takvimi: WhatsApp/Meta/OpenAI/Anthropic anahtarları 90 günde bir; sızıntı şüphesinde anında.

### G-3 · API ve Webhook Sertleştirme *(Faz 0–2 kapıları)*
- NestJS: helmet, CORS allowlist (yalnız PREI domain'leri), global rate limiting (IP + kullanıcı + API key bazlı), şema + semantik input validasyonu (class-validator), DTO-dışı serileştirme yasak.
- **WhatsApp webhook:** Meta `X-Hub-Signature-256` HMAC imza doğrulaması zorunlu (verify token tek başına yeterli değil); imzasız istek 401 + log.
- **Calendly webhook:** signing key doğrulaması; **Telegram:** `chat.id === TELEGRAM_OWNER_CHAT_ID` kontrolü her workflow'un ilk node'unda (Master Prompt Kritik Not 7).
- n8n editör arayüzü internete açık bırakılmaz: basic auth + IP kısıtı veya VPN arkasında.

### G-4 · AI Ajan Güvenliği *(Faz 2–3 kapıları)*
- **Prompt injection savunması:** Eylül'e gelen her WhatsApp mesajı güvenilmez girdidir. Sistem talimatı ile kullanıcı mesajı katı ayrılır; kullanıcı metni asla SQL/API çağrısına ham gömülmez (parametrize sorgular); Eylül'ün tool'u yoktur — yalnız RAG okur, yanıt üretir.
- **PREI-asistan tool allowlist'i:** her tool sabit endpoint + sabit HTTP metodu; serbest URL/SQL üretimine izin yok. Müşteriye giden her mesaj (acil ödeme hariç) Telegram onayından geçer.
- **Komisyon gizliliği teknik enforcement:** gizli kolonlar ayrı tabloda (`deal_confidential`), RLS yalnız `super_admin`+`finance_manager`; AI servis-principal'larının bu tabloya SELECT hakkı yok — prompt seviyesinde değil, DB seviyesinde engel.
- AI çıktıları loglanır ama loglara PII maskesi uygulanır (telefon/e-posta kısmi maskeleme).

### G-5 · Veri Koruma ve KVKK/GDPR *(Faz 1 kapısı, sürekli)*
- Supabase PITR (point-in-time recovery) aktif + haftalık off-site yedek testi (geri dönüş provası yapılmamış yedek, yedek değildir).
- Veri saklama politikası: WhatsApp konuşmaları 24 ay, işlenmemiş lead'ler 12 ay; silme talebi = loglanan privileged hard-delete (Blueprint §6 istisnası).
- Aydınlatma metni: Eylül ilk konuşmada kısa KVKK bilgilendirmesi yapar; `is_subscribed_reports` açık rıza ile set edilir.
- TLS her yerde; DB bağlantıları SSL zorunlu.

### G-6 · İzleme ve Müdahale *(Faz 1'den itibaren, Faz 6'da tam)*
- Başarısız login denemeleri (5+/10dk), yeni cihazdan Super Admin girişi, olağandışı saatte toplu veri çekimi → anında Telegram uyarısı.
- `audit_log` değiştirilemez (append-only, UPDATE/DELETE izni yok); Admin panelinde Super Admin'e özel görünüm.
- Aylık `npm audit` + bağımlılık güncelleme turu; lockfile'lar commit'li.
- **Hesap hijyeni (insan katmanı):** Supabase, Meta Business, n8n, Vercel/Railway, Google Cloud hesaplarının kendisinde 2FA — sistemin en zayıf halkası platform hesaplarıdır.

### Faz kapısı özeti

| Faz | Kapanması zorunlu güvenlik maddeleri |
|---|---|
| FAZ T | — (tasarım; yalnız G-2 git taraması kurulur) |
| FAZ 0 | G-1 tamamı, G-2 tamamı, G-3 NestJS sertleştirme |
| FAZ 1 | G-5 yedek+saklama, G-6 audit append-only + login uyarıları |
| FAZ 2 | G-3 WhatsApp HMAC, G-4 Eylül injection savunması |
| FAZ 3 | G-3 Telegram kontrolü, G-4 tool allowlist + komisyon DB-enforcement |
| FAZ 4–5 | G-3 Calendly imzası, Meta token'ın en dar izin setiyle (`ads_read`) sınırlanması |
| FAZ 6 | G-6 anomali uyarılarının tamamı |

---

## 4.7 HAFTA-0 Güvenlik Kapısı *(v1.1 — 4–8 Temmuz 2026, Hafta 1'in kalan günleri; faz beklemez)*

Sıralı checklist — uzun onay süreçleri bugün başlar:

1. **Meta Business doğrulaması — ŞİRKET KURULUŞUNA ERTELENDİ (Onur kararı, 2026-07-05):** Tüzel kişilik henüz yok (ilk müşteri geliriyle kurulacak); marka tescili MEVCUT ama Meta doğrulaması için belge olarak geçmiyor (tüzel varlık kanıtı gerekir). **Birincil yol: doğrulamasız Cloud API** (~250 benzersiz kişi/gün — başlangıç hacmi için yeterli; HSM şablon başvurusu doğrulamasız da yapılır). Şirket kurulunca: doğrulama → limitler yükselir + marka tesciliyle resmi işletme adı alınır. `ads_read` de doğrulama istediğinden **Faz 5 CSV fallback birincil yol** olur (madde 4).
2. **Ayrı bot numarası** (OV-6 kararı): Eylül + tüm otomasyonlar için yeni numara WABA'ya bağlanır; CTWA reklamları bu numaraya yönlenir; ana işletme hattı insan iletişiminde ve dokunulmaz kalır.
3. **HSM şablon başvuruları** (WABA hazır olur olmaz): `meeting_summary`, `payment_reminder`, `birthday_greeting`, `contract_renewal` — **TR/EN/NL**. Sabit kural: reddedilen şablon 48 saat içinde revize edilip yeniden sunulur. **Contingency:** 1 Ağustos'a kadar onay yoksa proaktif müşteri bildirimleri Telegram'dan Onur'a düşer (müşteriye pencere-dışı mesaj denenmez); Faz 3-4 çıkışları bu modda da sağlanır.
4. **Meta System User + `ads_read` App Review başvurusu** (OV-7): şimdi başvurulur. Onay gecikirse Faz 5a fallback: Ads Manager haftalık CSV export → n8n ile `ad_insights_daily`'ye yükleme (ekran aynı, kaynak geçici manuel). CTWA attribution webhook'tan gelir — App Review'a muhtaç değildir.
5. **OneDrive → `C:\dev\prei` taşıma** (kanonik yol): OneDrive senkronu duraklat → taşı → `git remote -v` + `git status` doğrula → araç kayıtlarını yeniden işaretle (gstack, Claude hafızası, launch config) → eski klasörü arşivle.
6. **CI iskeleti:** GitHub Actions — lint → typecheck → test → build → migration-dry-run (boş DB'ye). Kırmızı pipeline = deploy yok.
7. **gitleaks:** pre-commit hook **ve** CI adımı (tek seferlik tarama değil).
8. **Git hijyeni:** `graphify-out/` `.gitignore`'a; üretilmiş çıktılar repoya girmez.
9. **İzleyici:** P0/P1/P2'ler **GitHub Issues**'ta yaşar (go/no-go kriterlerinin ölçüm yeri).

---

## 5. FAZ PLANI

Sıralama mantığı: **önce tasarım final hale gelir (Faz T)**, sonra CRM gerçek veriyle ayağa kalkar (Faz 0–1), sonra dış dünya otomasyonları CRM'e bağlanır (Faz 2–4), sonra Meta Ads + beyin katmanı (Faz 5–6). Master Prompt'un 6 fazı korunur ama **CRM şemasına yazacak şekilde** yeniden hedeflenir.

```
FAZ T           FAZ 0          FAZ 1           FAZ 2            FAZ 3             FAZ 4              FAZ 5              FAZ 6
Tasarım    →    Temel     →    CRM Canlı  →    WhatsApp    →    Telegram +   →    Calendly +    →    Meta Ads +    →    Komuta Merkezi
Overhaul        (Auth+RBAC)    (mock'suz)      Eylül RAG        Toplantı Notu     Sözleşme/Doğum     Haftalık Bülten    ("Beyin")
```

---

### FAZ T — Tasarım Sistemi & UI Overhaul  *(ön koşul: yok — her şeyden önce)*

Onur'un kararı (2026-07-02): ürün 100M USD seviyesinde bir ürün algısıyla kurgulanacak; grafikler ve istatistik ekranları imza kalitesinde olacak. **Önce tasarım finale gelir, backend işleri ardından tamamlanır.**

**Kapsam** — tamamı `PREI_Design_System_v1.md`'de tanımlı ("Private Banking Terminal" dili):
- Token katmanının yeniden yazımı: off-black nötrler + **logo moru accent** (#9B5BB3 — Onur kararı 2026-07-02: renkler logodan, altın denendi ve geri alındı) + veri-semantiği renkleri; Geist + Geist Mono (self-host); radius/gölge kilidi.
- Core bileşen overhaul'u (Button, Card, Table, Modal, Sidebar, Topbar) + lucide → Phosphor ikon geçişi.
- **`src/core/charts/` grafik tema katmanı:** TrendArea, Sparkline, HBarCompare, DonutMetric, FunnelSteps, ComboSpend sarmalayıcıları — çıplak recharts feature kodunda yasak.
- Dashboard'un "Komuta Merkezi v0" olarak yeniden tasarımı (kalite çıtası bu ekranda belirlenir), ardından 13 modülün tamamının taşınması.
- Loading/empty/error durumlarının her modülde standartlaştırılması; mock verilerin gerçekçi hale getirilmesi.

**Çıkış kriterleri:** `PREI_Design_System_v1.md` §9'daki 9 maddelik kabul listesi. Not: Bu faz mock veri üzerinde tamamlanır — tasarımın backend'i beklemesi gerekmez; Faz 1'de API bağlanırken görsel dil artık sabittir.

**T7 — Frontend Complete (Onur kararı, 2026-07-02: "tüm ön yüz bitmeden backend'e girmeyelim"):**
FAZ 0 öncesine çekilen ek kapsam — uygulamanın TÜM yüzeyleri mock veriyle eksiksiz ve Apple-konforunda hazır olacak:
- **T7a · Marketing/Analytics modülü** (Faz 5'in ön yüzü öne alındı): reklam harcaması, CPL, conversion funnel (gösterim → CTWA → konuşma → qualified → toplantı → kapanış), ROAS'lı kampanya tablosu, pazar bazlı kırılım, Eylül konuşma verileri paneli. FunnelSteps + ComboSpend grafik bileşenleri.
- **T7b · Bildirim merkezi:** Topbar'daki ölü zil → gerçek bildirim paneli (tip bazlı ikonlar, okundu yönetimi, boş durum).
- **T7c · Client kartları & profil** yeniden tasarımı; **T7d · Mail alanı** (EmailClient) yeniden tasarımı; **T7e · Proje sunum sayfası** (galeri, ödeme planı görselleştirmesi, doküman kartları); **T7f · Login + kalan cilalar + 390px mobil tur;** **T7g · Mock kontratları (OV-8, v1.1):** MSW mock şekilleri typed contract'lara (zod/OpenAPI) çıkarılır — Faz 0 DTO'ları bu kontratları karşılamak zorunda; mock↔API kayması Hafta 4-6'da toplu sürpriz olmaktan çıkar.
Faz 0–1 bu blok bitince başlar. *(v1.1: T7d itibarıyla blok büyük ölçüde tamam — fiili durum §6.5'te.)*

---

### FAZ 0 — Temel: Auth, RBAC, Gerçek Backend İskeleti  *(ön koşul: yok)*

**Kapsam**
- Supabase projesine `001_crm_core.sql` uygulanır (idempotent kontrolle); tek tenant "ProDuality" + Onur `super_admin` seed edilir.
- **Migration 002 — üçe bölünmüş (F1):** her birine down-script, uygulama öncesi otomatik yedek:
  - **002a (şema):** §3'teki eksik alanlar + yeni tablolar (`conversation_sessions`, `financials`, `meeting_notes`, `contracts`, `lead_attributions`, `fx_rates`) + 3 view + `match_knowledge_chunks` RPC (embedding **boyutu VE modeli** canlı DB'den doğrulanarak).
  - **002b (RLS-onarım):** B-3 permissive-OR açığı `AS RESTRICTIVE` politikalarla kapatılır; RLS tüm veri tablolarına genişletilir; **audit_log append-only teknik enforcement: tüm rollerden UPDATE/DELETE REVOKE + koruyucu trigger (F6)** — negatif testi çıkış kriterinde.
  - **002c (outbox+fx):** `events` outbox tablosu; `fx_rates` nil-path kuralı (F7): tarihte kur yoksa son bilinen kur + rapor katmanında "≈" bayatlık işareti; 3+ gün bayatlıkta E1 paneli alarmı.
- NestJS server'a: Supabase bağlantısı, JWT auth (Supabase Auth), `TenantContext` middleware, RBAC guard, base CRUD pattern (1 örnek modül uçtan uca: Leads), **correlation-id + yapılandırılmış log standardı (F10):** nestjs-pino + request-id; her satırda tenant_id, maskeli user_id, request_id; audit_log'a request_id kolonu.
- **Agent Ingest API (OV-4):** `POST /agent/whatsapp-event` — contact+lead+session+message atomik yazım; n8n scoped API key ile çağırır; DTO validasyonu + audit + rate limit. Faz 2'nin yazma yolu budur — n8n'e hiçbir zaman service_role verilmez (K-3 teknik güvencesi).
- **Typed API client (T-3):** NestJS Swagger şemasından `openapi-typescript` codegen; ilk modülle (Leads) kurulur, CI'a codegen adımı eklenir. Faz 1'in 13 modül taşıması bu kontrata karşı yapılır. **T7 mock şekilleri de bu kontratlara çıkarılır (OV-8)** — mock↔API kayması derleme anında yakalanır.
- **DEBT-GMAIL-002 kapanır (D1):** userId yalnız JWT principal'dan; yabancı `userId` query-param'ı yok sayılır; principal'a ait olmayan kaynağa istek 404.
- Frontend: Login gerçek auth'a bağlanır; `permissions.ts` yeni rol setine (`super_admin/manager/finance_manager/marketing_manager/consultant`) genişletilir.
- `.env.example` Master Prompt'taki tüm anahtarlarla güncellenir (Meta Ads için `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` eklenir).

**Çıkış kriterleri**
- [ ] Onur super_admin olarak gerçek login yapabiliyor; Consultant rolü admin sayfasını göremiyor **ve** API'den de alamıyor (403/404).
- [ ] Bir lead, UI → API → DB → audit_log zincirini uçtan uca **tek request_id ile izlenerek** dolaşıyor.
- [ ] RLS testleri: consultant başka consultant'ın lead'ini SQL seviyesinde bile okuyamıyor.
- [ ] audit_log negatif testi: super_admin dahil hiçbir rol UPDATE/DELETE yapamıyor.
- [ ] Gmail endpoint'leri JWT principal dışında userId kabul etmiyor (DEBT-GMAIL-002 kapalı).

---

### FAZ 1 — CRM Productionization: Mock'ların Sökülmesi  *(ön koşul: Faz 0)*

**Kapsam**
- 13 frontend modülünün tamamı MSW'den gerçek API'ye taşınır (modül modül: Leads → Clients → Projects/Developers → Proposals → Meetings/Tasks → Contracts → Financials → Documents → Admin/Audit) — typed client kontratlarına karşı (T-3/OV-8).
- Dosya depolama: Supabase Storage (Document Vault için signed URL'ler).
- Audit log ekranı gerçek `audit_log` tablosuna bağlanır (Super Admin'e özel).
- Hata/loading durumları, boş durumlar, optimistic concurrency (`version` alanı → 409 yönetimi).
- Deploy hattı: frontend (Vercel/Netlify) + NestJS (Railway/Fly/Render) + Supabase — staging ve prod ortamları. **Smoke paketi deploy pipeline'ına (F11):** B-11 Playwright smoke'ları her deploy sonrası staging'e karşı otomatik koşar; yeşilse prod'a geçilir, prod'da hafif probe.
- **DEBT-GMAIL-001 kapanır (D1):** `InMemoryTokenStore` → **Supabase Vault (pgsodium) ile şifrelenmiş** Postgres TokenStore. Kabul: restart sonrası Gmail bağlantısı korunur; token düz metin hiçbir tabloda/logda görünmez. Mail modülü gerçek veriye bundan önce bağlanmaz.
- **E1 · Entegrasyon Sağlık Paneli (Faz-1 minimumu):** cron heartbeat'leri, yedek restore prova durumu, Sentry hata sayacı, Gmail OAuth durumu. WhatsApp/Telegram/Meta kartları kendi fazlarında eklenir — olmayan entegrasyona yüzey inşa edilmez.
- **E4 · Otomatik yedek restore provası:** haftalık cron — son yedeği geçici DB'ye restore, 3 kritik tabloda satır sayısı doğrulama, Telegram raporu. **İlk production yedeği oluştuğu anda kurulur** (Faz 1 çıkışını beklemez); elle tetiklenen prova da sayılır.

**Çıkış kriterleri**
- [ ] `src/mocks/` production build'den tamamen çıkarıldı.
- [ ] Gerçek verilerle günlük operasyon yürütülebiliyor (lead girişi → teklif → sözleşme → finansal kayıt).
- [ ] Staging + prod ortamları ayrık, secrets vault'ta.
- [ ] Gmail token'ları şifreli ve kalıcı (DEBT-GMAIL-001 kapalı); restart provası yapıldı.
- [ ] E1 paneli Faz-1 minimumuyla canlı; E4 provası en az 1 kez geçti.

---

### FAZ 2 — WhatsApp RAG Lead Qualifier "Eylül"  *(Master Prompt Faz 1 · ön koşul: Faz 0)*

Master Prompt'taki workflow kurulur, **şu değişikliklerle**:
1. Yazma hedefi **Agent Ingest API'dir (OV-4):** n8n, `POST /agent/whatsapp-event`'i scoped API key ile çağırır — kişi → `contacts`, lead → `leads` (`qualification_score`, `qualification_data`), oturum → `conversation_sessions`, her mesaj → `communications` (channel: whatsapp) atomik yazılır. n8n'e DB erişimi/service_role verilmez. ~~Airtable push~~ (K-2 v2: ayna yok).
2. **CTWA atıf yakalama (K-5'in temeli):** Webhook payload'ında `referral` objesi varsa (`source_type: ad`) `ad_id/adset_id/campaign_id/headline` lead'in `lead_attributions` kaydına yazılır. Bu, Faz 5'te ROI hesabının ham verisidir — şimdiden toplanmaya başlar.
3. **Eylül hata modları (F3):** timeout → 1x retry, sonra nazik bekletme mesajı; bozuk JSON → skorlama atlanır, ham metin kaydedilir; refusal/3. deneme → Telegram'a insan-devir bildirimi. Sonsuz sessizlik yasak.
4. **Devir kanalı — Telegram köprüsü (OV-5):** skor 75+ / "temsilci" isteğinde Eylül susar; Onur devir bildirimine Telegram'dan cevap yazar, n8n metni Cloud API üzerinden müşteriye iletir (24s penceresi içinde). PREI-içi WhatsApp inbox → TODOS (Faz 6 adayı).
5. **n8n workflow'ları git'te (F2):** her workflow değişikliğinde JSON export → repo `workflows/` klasörü; credential'lar `{{ $env }}` ile dışarıda.
6. Eylül **ayrı bot numarasında** yaşar (OV-6, Hafta-0'da kuruldu).

Qualification score mantığı, Eylül system prompt'u, test senaryoları (3 mesajlık simülasyon, score 75+ → Calendly) Master Prompt'taki gibi. **v1.1 notu:** Eylül'ün kimlik/kural/akış config'i hazır — `ProDuality_Knowladge/00_PLAYBOOKS/produality_ai_system_prompt.md` (TR/EN dil kuralı, discovery akışı, Calendly linki, guardrail'ler); RAG chunk'ları + n8n reingest workflow'u aynı pakette (`produality_reingest_README.md`). **Ek (OV-2):** 15-20 örnek konuşmalık **eval seti** (TR/EN karışık, edge case'ler dahil) + beklenen skor aralıkları — B-10 model seçimi ve sonraki her model/prompt değişimi bu setle ölçülür; RAG dosyası içerik tarafını beslemeye devam eder (ikisi rakip değil).

**Çıkış kriterleri:** Master Prompt Faz 1 kriterleri + lead'ler PREI Leads Pipeline ekranında gerçek zamanlı görünüyor + reklam kaynaklı test mesajında attribution kaydı düşüyor + 3 hata modu test edildi + Telegram köprüsünden uçtan uca cevap iletildi + eval seti koşuldu ve skorlar beklenen aralıkta.

---

### FAZ 3 — Telegram PREI Asistanı + Toplantı Notu Hattı  *(Master Prompt Faz 2+3 · ön koşul: Faz 1)*

İki Master Prompt fazı tek fazda birleşir çünkü aynı Telegram botu ve aynı güvenlik modelini (yalnız `TELEGRAM_OWNER_CHAT_ID`) paylaşırlar.

- **PREI Asistan:** Master Prompt Faz 2 tool seti; `query_crm` tool'u artık Airtable yerine **PREI API**'yi çağırır (super-admin-scoped servis anahtarıyla ama komisyon alanlarına erişimsiz).
- **Toplantı notu hattı:** metin/ses/PDF → GPT-4o extraction → `meeting_notes` + müşteriye WhatsApp bildirimi → Telegram onayı (Master Prompt Faz 3 aynen). Kayıtlar Meetings modülünde görünür.
- **E3 · Günlük Özet Lite:** her sabah 08:00 Telegram'a 3 KPI (son 24 saatte yeni lead, aktif konuşma sayısı, pipeline toplam değeri EUR) + 3 uyarı (24 saati geçmiş cevapsız WhatsApp, 7 gün içindeki sözleşme/ödeme vadeleri, bugünkü toplantılar) — tek n8n cron + SQL view'lar. Faz 6 anomali motoru aynı view'ların üstüne kurulur, bu cron'u tüketir/değiştirir — iki kez inşa edilmez.

**Çıkış kriterleri:** Master Prompt Faz 2 + Faz 3 kriterleri; ek olarak: "Bugün kaç aktif lead var?" sorusu PREI DB'den cevaplanıyor, toplantı notu Meetings ekranına düşüyor, sabah özeti 3 gün üst üste doğru veriyle geldi.

---

### FAZ 4 — Calendly Research + Sözleşme & Doğum Günü Otomasyonları  *(Master Prompt Faz 4+5 · ön koşul: Faz 3)*

- **Calendly Deep Research:** Master Prompt Faz 4 aynen; brifing çıktısı `leads.research_data`'ya yazılır ve Lead detay sayfasında "Toplantı Brifingi" kartı olarak gösterilir.
- **Sözleşme lifecycle:** günlük 08:00 taraması `contracts` + `contract_renewal_alerts` view; gecikmiş ödemeler `overdue_payments` → WhatsApp hatırlatma; hepsi Contracts/Financials modüllerinde rozet/uyarı olarak görünür.
- **Doğum günü otomasyonu:** 09:00, `upcoming_birthdays` → GPT mesajı → WhatsApp (+PM müşterisine e-posta).

**Çıkış kriterleri:** Master Prompt Faz 4 + Faz 5 kriterleri; uyarılar hem Telegram'a hem CRM dashboard'una düşüyor.

---

### FAZ 5 — Meta Ads & Marketing Analytics Modülü + Haftalık Bülten  *(YENİ + Master Prompt Faz 6 · ön koşul: Faz 2)*

**Meta Ads entegrasyonu (yeni bounded context: Marketing)**
- **Migration 003:** `ad_accounts`, `ad_campaigns`, `ad_sets`, `ads`, `ad_insights_daily` (spend, impressions, clicks, ctr, cpm, cpl, tarih bazlı). *(`lead_attributions` migration 002'de kuruldu; Faz 2'den beri veri biriktiriyor.)*
- **n8n sync workflow:** her gece Meta Marketing API (Insights endpoint, `access_token` System User üzerinden) → `ad_insights_daily` upsert. Kampanya/adset/ad meta verisi haftalık tam senkron. **Bayatlama koruması (F4):** sync sonu heartbeat → E1 paneli + 24 saat sessizlikte Telegram alarmı; Marketing ekranında "veri son güncelleme: X" rozeti; token expiry'ye 60 gün kala proaktif uyarı. **App Review fallback (OV-7):** onay gecikirse haftalık CSV export → n8n yükleme; ekran aynı kalır.
- **Frontend "Marketing" modülü** (yeni route, `marketing_manager`+ görebilir):
  - Kampanya performans tablosu (harcama, CPL, lead sayısı, qualified lead sayısı, kapanış, **ROAS**),
  - Funnel: Reklam gösterimi → CTWA tıklama → WhatsApp konuşma → Qualified (score 75+) → Toplantı → Kapanış,
  - Kaynak kırılımı: organik vs. reklam vs. referral (mevcut `lead_sources` tablosuyla birleşik).
- **Atıf birleştirme job'ı:** `lead_attributions` × `ad_insights_daily` × `deals` → kampanya bazlı gerçek ROI projeksiyonu (KPI tablosu).
- **Haftalık Piyasa Bülteni:** Master Prompt Faz 6 aynen (4 Perplexity araması → Claude sentezi → aboneler + Telegram + LinkedIn taslakları); rapor çıktısı `weekly_reports` tablosuna da yazılır ve CRM'de arşivlenir.

**Çıkış kriterleri**
- [ ] Dünkü reklam harcaması ve CPL, Marketing ekranında kampanya bazında görünüyor.
- [ ] Reklamdan gelen bir lead'in kartında hangi kampanya/reklamdan geldiği yazıyor.
- [ ] "Bu ay Meta'ya X € harcadık, Y qualified lead, Z kapanış" sorusunu PREI-asistan Telegram'dan cevaplayabiliyor.
- [ ] Pazartesi 10:00 bülteni çalışıyor (Master Prompt Faz 6 kriterleri).

---

### FAZ 6 — Komuta Merkezi: Sistemin Beyni  *(ön koşul: Faz 1–5)*

Tüm akışlar kurulduktan sonra veriyi tek bakışta yönetilebilir kılan katman:

- **Super Admin Command Center** (dashboard'un evrimi): pipeline değeri, kaynak bazlı CAC/ROAS, Eylül konuşma hacmi ve qualification oranı, açık aksiyon kalemleri, sözleşme/ödeme uyarıları, haftalık trend — hepsi tek ekranda, rol bazlı daraltılmış versiyonları diğer rollere.
- **KPI projeksiyonları:** Blueprint §7.2'deki ayrım uygulanır — event akışından beslenen materialized read-model'lar (günlük cron ile başlar, DEBT-001 uyarınca outbox'a evrilir).
- **Anomali/nabız bildirimleri:** eşik bazlı kurallar (örn. CPL %40 arttı, 3 gündür yeni lead yok, cevaplanmamış WhatsApp 24 saati geçti) → Telegram'a proaktif uyarı. PREI-asistan "beynin sesi" haline gelir.
- **AI insight katmanı (opsiyonel v2):** haftalık otomatik yönetim özeti — "geçen hafta ne oldu, bu hafta neye odaklan" (Claude, KPI + event verisi üzerinden).

**Çıkış kriterleri**
- [ ] Onur güne tek ekrandan başlayabiliyor; sistemdeki her kritik sinyal ya Command Center'da ya Telegram'da.
- [ ] Her sayı tıklanınca kaynağına (lead listesi, kampanya, sözleşme) iniyor — kara kutu metrik yok.

---

## 6. Bağımlılık Grafiği ve Paralellik

```
FAZ T ──▶ FAZ 0 ──▶ FAZ 1 ──▶ FAZ 3 ──▶ FAZ 4
             │                              
             └────▶ FAZ 2 ─────────────▶ FAZ 5 ──▶ FAZ 6
                       (attribution verisi Faz 2'de birikmeye başlar)
```
- Faz T mock veri üzerinde yürüdüğü için hiçbir backend işini beklemez; **Faz T'nin T4–T5 adımları Faz 0 ile paralel yürüyebilir** (tasarım UI'da, temel backend'de — çakışma yok).
- Faz 2 (Eylül), Faz 1'in tamamlanmasını **beklemez** — sadece Faz 0'ın şema+auth temelini ister. İstenirse Faz 1 ile paralel yürür.
- Faz 5'in Meta sync'i erken de kurulabilir; ama ROI ekranı anlamlı olması için Faz 2'nin attribution verisine muhtaçtır.

## 6.5 Zaman Çizelgesi — v1.1: İç bitiş 20 Ağustos · **LANSMAN 28 Ağustos 2026**

**Fiili durum (2026-07-04):** FAZ T, T7d'ye kadar tamamlandı — orijinal çizelgenin ~2 hafta önündeyiz; "backend 1 hafta sağa kayar" notu fiilen absorbe edildi. Kalan: T7e + T7f. İkinci lansman hattı (ProDuality.com, 15 Ağustos) çizelgeye ayrı satır olarak eklendi (OV-3) — web sitesi işi öne çekilir, Ağustos'ta yalnız "düğmeye basma" kalır.

| Hafta | Tarih | Ana iş (PREI) | Paralel iş |
|---|---|---|---|
| 1 | 4–8 Tem | **HAFTA-0 güvenlik kapısı (§4.7, 9 madde)** + T7e/T7f bitişi → **FAZ T final ✅** | WABA + HSM + App Review başvuruları |
| 2 | 9–15 Tem | **FAZ 0** (002a/b/c, auth, RBAC, ingest API, typed client) | **ProDuality.com:** 5 kritik blocker kapanır (ölü n8n webhook dahil) |
| 3 | 16–22 Tem | **FAZ 0** biter ✅ · **FAZ 1** başlar (Leads, Clients) | **ProDuality.com:** içerik + test → **yayına hazır ✅** |
| 4 | 23–29 Tem | **FAZ 1** devam (Projects, Proposals, Meetings/Tasks) | **FAZ 2** Eylül kurulumu başlar |
| 5 | 30 Tem–5 Ağu | **FAZ 1** devam (Financials, Contracts, Documents, Admin) | **FAZ 2** test + eval seti + canlı ✅ |
| 6 | 6–12 Ağu | **FAZ 1** biter ✅ (E1 panel + E4 prova + DEBT-GMAIL-001) · **FAZ 3** başlar | **FAZ 5a** Meta sync (veya CSV fallback) + Marketing ekranı |
| 7 | 13–20 Ağu | **FAZ 3** biter (Telegram + özet lite + toplantı notu) · **FAZ 4** | **15 Ağu: ProDuality.com go-live** (yalnız DNS/içerik düğmesi) · **FAZ 5b** bülten · **FAZ 6 v0** |
| 8 | 21–28 Ağu | **STABİLİZASYON:** operasyon provası, dayanıklılık testi, P1-P2 kapanışı, go/no-go | **28 Ağu: PREI LANSMAN 🚀** |

**28 Ağustos go/no-go kriterleri (hepsi yeşil olmadan lansman yok; ölçüm yeri GitHub Issues):**
1. Restore provası ≥2 kez üst üste geçti (E4 — cron ilk prod yedeğiyle kurulur, elle tetikleme sayılır).
2. Kritik akış smoke paketi (login, RBAC deny, lead CRUD, webhook imza) staging+prod yeşil.
3. Açık P0 = 0, açık P1 = 0 (P2'ler lansman notuna yazılır).
4. HSM şablonları onaylı **veya** contingency aktif ve test edilmiş.
5. RLS negatif testleri yeşil (consultant başkasının lead'ini SQL'den okuyamıyor).

**Dürüst risk notu:** 2 haftalık öne geçiş + 8 günlük tampon planı rahatlattı ama Hafta 6–7 hâlâ en yoğun blok. Garanti kapsam = Faz T+0+1+2; Faz 6'nın tam hali (anomali motoru, AI insight) lansman sonrasına sarkabilir — E3 özet lite ve Komuta Merkezi kabuğu hazır olacağı için kabul edilebilir. Haftalık cuma günleri fiili durum bu tabloya işlenir.

## 7. Riskler ve Açık Kararlar

| # | Konu | Öneri / Karar gereği |
|---|---|---|
| R-1 | Meta API erişimi: System User token + `ads_read` izni ve App Review gerekebilir | Faz 0'da Business Manager'da System User oluşturup token'ı hazırla — Faz 5'i bloklamasın |
| R-2 | WhatsApp Cloud API ile Eylül'ün aynı numarada insan devralması (handover) | v1: Eylül score 75+ veya "temsilci" isteğinde susar, Telegram'a devir bildirimi düşer |
| R-3 | ~~Mevcut Airtable'daki tarihsel veri~~ **DÜŞTÜ (v1.1):** Airtable boş — import edilecek veri yok | K-2 v2 gereği Airtable derhal emekli; import script'i iptal |
| R-4 | Embedding boyutu varsayımı (1536) | **v1.1 — büyük ölçüde çözüldü:** RAG korpusu bulundu (`C:\Users\onurr\OneDrive\Belgeler\ProDuality_Knowladge\ProDuality_Knowladge` — 185 dosya, sağlık raporu 2026-06-13, reingest paketi hazır). Model belgeli: **OpenAI `text-embedding-3-small`, 1536**. Faz 0'da kalan teyit: canlı DB'de **tablo adı çelişkisi** (reingest README `documents` diyor, Blueprint `knowledge_chunks`) — RPC doğru tabloya bağlanacak; model adı config'e yazılır |
| R-5 | KVKK/GDPR: WhatsApp konuşmaları ve doğum günü verisi kişisel veri | Aydınlatma metni + veri saklama süresi politikası; silme talebi = loglanan privileged hard-delete (Blueprint §6) |
| A-1 | **Açık karar:** Instagram/YouTube lead formları da Meta üzerinden mi toplanacak? | Evet ise Faz 5'e Lead Ads webhook'u eklenir |
| A-2 | **Açık karar:** Consultant'lar sisteme ne zaman katılacak? | Faz 1 sonuna kadar tek kullanıcı (Onur) yeterli; RBAC hazır olduğundan katılım maliyeti düşük |

## 7.5 Denetim Bulguları ve v1.1 Revizyonları (2026-07-02 derin denetim)

Şema, kod tabanı ve çalışma ortamının satır satır denetiminden çıkan bulgular. B = bulgu; her birinin çözüm fazı işaretli.

### Kritik (B-1..B-5)
| # | Bulgu | Çözüm | Faz |
|---|---|---|---|
| B-1 | **Proje git deposu değil ve OneDrive klasöründe.** Hayatımızın projesinde sıfır versiyon kontrolü; OneDrive senkronu node_modules/secrets ile riskli | `git init` + private GitHub repo + proje OneDrive dışına (`C:\dev\prei`) taşınır; `.env` asla commit edilmez | **Hemen** (Hafta 1, Faz T öncesi) |
| B-2 | **Migration 001 dosyası bozuktu** — dosya sonunda duplike trigger/RLS/seed bloğu + kesik `EXECUTE` (satır 613); uygulansa syntax hatası verirdi | ✅ Düzeltildi (2026-07-02). Ders: migration'lar CI'da boş DB'ye karşı test edilir | Kapatıldı |
| B-3 | **RLS mantık açığı:** permissive politikalar OR'lanır; `leads_tenant_isolation` (ALL) SELECT'i de kapsadığından consultant **tüm tenant lead'lerini okuyabilir** — `leads_ownership_read` fiilen etkisiz. Ayrıca RLS yalnız 4 tabloda; `communications`, `audit_log` korumasız | Ownership politikaları `AS RESTRICTIVE` yazılır; RLS tüm veri tablolarına genişletilir; Faz 0 çıkışında negatif RLS testleri (consultant başkasının lead'ini SQL'den okuyamamalı) | Faz 0 |
| B-4 | Plan içi tutarsızlık: `lead_attributions` Faz 2'de yazılmaya başlıyordu ama tablo Faz 5/migration 003'teydi | ✅ Tablo migration 002'ye (Faz 0) çekildi | Kapatıldı |
| B-5 | **WhatsApp 24 saat penceresi atlanmış:** Faz 3–5'teki proaktif müşteri mesajları (toplantı bildirimi, ödeme hatırlatma, doğum günü) son müşteri mesajından 24 saat sonra **serbest metinle gönderilemez** — Meta onaylı şablon (HSM) zorunlu, onay süreci haftalar alabilir. Master Prompt bunu hiç ele almamış | Hafta 1'de şablon başvuruları: `meeting_summary`, `payment_reminder`, `birthday_greeting`, `contract_renewal` (TR/EN/NL). Workflow'lar pencere içindeyse serbest metin, dışındaysa şablon kullanır | Başvuru: Hemen · Kullanım: Faz 3 |

### Mimari güçlendirmeler (B-6..B-10)
| # | Bulgu | Çözüm | Faz |
|---|---|---|---|
| B-6 | Outbox/`events` tablosu hiçbir fazda yoktu; Faz 6 KPI projeksiyonları ve audit beslemesi geriye dönük event üretemez | `events` tablosu migration 002'ye eklendi; NestJS mutasyonları Faz 0'dan itibaren event yazar (Blueprint ADR-004) | Faz 0 |
| B-7 | **Çoklu para birimi kör noktası:** şemada TRY default, planda EUR, Meta harcaması USD/TRY, Dubai AED. ROI/ROAS ve pipeline toplamı farklı birimlerle toplanamaz | `fx_rates` tablosu (günlük kur, n8n sync); tüm rapor/KPI katmanı **EUR bazına normalize** eder; kayıt orijinal birimde saklanır | Faz 0 (tablo) + Faz 5 (rapor) |
| B-8 | Webhook tekrarları: Meta webhook'ları retry eder; Eylül aynı mesaja iki kez cevap verebilir | `communications.external_id` unique index'i (şemada mevcut) n8n akışında **ilk adım dedupe kontrolü** olarak kullanılır; execution idempotent | Faz 2 |
| B-9 | Embedding varsayımı: yalnız boyut (1536) değil **model kimliği** de doğrulanmalı — farklı modelle sorgu embedding'i üretmek sessizce alakasız sonuç döndürür | Faz 0'da canlı chunk'lardan model teyidi; model adı config'e yazılır, workflow'lar oradan okur | Faz 0 |
| B-10 | Model/versiyon hardcode'ları: Master Prompt `gpt-4o`, `claude-sonnet-4`, WhatsApp `v18.0` sabitliyor — 2026 itibarıyla eski | Tüm model adları ve API versiyonları tek config'te (`system_settings` tablosu / env); Eylül için TR kalite karşılaştırması yapılıp model seçilir | Faz 2 |

### Kalite ve operasyon (B-11..B-14)
| # | Bulgu | Çözüm | Faz |
|---|---|---|---|
| B-11 | **Test altyapısı ve CI yok.** "Hataya yer yok" hedefi elle testle tutmaz | Vitest (birim) + Playwright smoke paketi (login, RBAC deny, lead CRUD, kritik akışlar) + GitHub Actions: lint→typecheck→test→build→migration-dry-run. Kırmızı pipeline = deploy yok | Faz T'den itibaren kademeli, Faz 0'da zorunlu |
| B-12 | Hata ve uptime izleme yok: n8n workflow'u sessizce ölürse (ör. doğum günü cron'u) kimse fark etmez | Sentry (frontend+NestJS); n8n global error workflow → Telegram; kritik cron'lara heartbeat (ör. healthchecks.io); webhook endpoint'lerine uptime probe | Faz 1 |
| B-13 | Migration süreci elle: raw SQL dosyasını panele yapıştırmak drift yaratır | Supabase CLI migration akışı (`supabase migration`); staging→prod aynı dosyalarla; şema drift kontrolü CI'da | Faz 0 |
| B-14 | **Mobil deneyim planda yok** ama K-2 (Airtable emekliliği) buna bağlı: sahada Onur telefondan bakacak | Faz T kabul kriterlerine responsive denetim eklenir (tüm modüller 390px'te kullanılabilir); Faz 1 sonunda PWA (ana ekrana ekle + temel offline) | Faz T + Faz 1 |

### Uygulama kapasitesi notu (B-15)
Bu oturumun araç seti fazların doğrudan benim tarafımdan uygulanmasına imkân veriyor: **Supabase MCP** bağlı (migration'ları doğrudan uygular, advisor/log okurum), **Airtable MCP** bağlı (mevcut verinin B-1 import'u), **n8n-workflow-builder skill'i** kurulu (Faz 2–6 workflow'ları). Yani plan "bana talimat listesi" değil, "benim uygulayacağım iş planı" olarak yürütülebilir — her faz sonunda Onur onayı sabit kalır.

## 8. Faz Onay Protokolü

Master Prompt'un çalışma protokolü korunur: **OKU → ANLA → PLANLA → YAP → VALIDATE → TEST → ✅ ONAY → SONRAKİ FAZ.** Her faz sonunda: kısa özet + çıkış kriterleri checklist'i + Onur'un onayı. Onaysız faz atlanmaz.

## 9. Revizyon Günlüğü — v1.1 (2026-07-04, /plan-ceo-review)

22 karar (Onur onaylı). Tam kayıt: `~/.gstack/projects/Onurrnk-PREI/ceo-plans/2026-07-04-master-plan-v1-1-guvenlik-revizyonu.md`

| Karar | Özet | Nereye işlendi |
|---|---|---|
| D1 | Hafta-0 güvenlik kapısı | §4.7 (yeni) |
| D3 | 20 Ağu iç bitiş → 28 Ağu lansman + go/no-go | §6.5 |
| E1/E3/E4 | Sağlık paneli / Günlük özet lite / Restore prova otomasyonu | Faz 1 / Faz 3 / Faz 1 |
| F1 | Migration 002 → 002a/b/c + down + yedek | Faz 0 |
| F2 | n8n workflow'ları git'te | Faz 2 |
| F3 | Eylül LLM hata modları | Faz 2 |
| F4 | Meta sync heartbeat + bayatlık rozeti | Faz 5 |
| F5 | graphify-out/ .gitignore | §4.7/8 |
| F6 | audit_log REVOKE + trigger | Faz 0 (002b) |
| F7 | fx_rates nil-path kuralı | Faz 0 (002c) |
| F10 | Correlation-id + pino log standardı | Faz 0 |
| F11 | Deploy-sonrası smoke paketi | Faz 1 |
| T-3/OV-8 | Typed client + mock kontratları | Faz 0 + T7g |
| DEBT-GMAIL-001/002 | Faz kapılarına bağlandı (graf denetim bulgusu) | Faz 1 / Faz 0 |
| OV-1+F13 | K-2 v2: ayna yok, Airtable boş+emekli, R-3 düştü, "PREI Smart Suites" = ürün adı | K-2, R-3 |
| OV-2 | Eylül eval seti kabul (F9 kararı revize edildi) | Faz 2 |
| OV-3 | ProDuality.com hattı Hafta 2-3'e öne çekildi | §6.5 |
| OV-4 | Agent Ingest API (n8n'e asla service_role yok) | Faz 0 + Faz 2 |
| OV-5 | Devir kanalı: Telegram köprüsü | Faz 2 |
| OV-6 | Eylül ayrı bot numarasında | §4.7 |
| OV-7 | Meta App Review contingency (CSV fallback) | §4.7 + Faz 5 |
| OV-9 | P0/P1/P2 izleyici: GitHub Issues | §4.7 + go/no-go |

**NOT in scope (değerlendirilip ertelendi/geçildi):** E2 demo tenant (TODOS — lansman formatı netleşince) · Login güvenlik ekranı (TODOS — P3) · PREI-içi WhatsApp inbox (TODOS — Faz 6 adayı) · SCOPE EXPANSION katedral önerileri (deadline disiplini gereği açılmadı).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 7 proposals (D+E), 6 accepted, 1 deferred; 12 rigor bulgusu (F1-F12) + 9 dış-ses bulgusu (OV-1..9) işlendi |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | Codex kurulu değil; dış ses Claude subagent ile koşuldu |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | Henüz koşulmadı — implementasyon öncesi önerilir |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | UI kapsamı var (T7e/f/g, Marketing, E1) — önerilir |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CROSS-MODEL:** Dış ses (bağımsız Claude subagent) 9 bulgu üretti; 7'si Onur kararıyla plana işlendi (OV-1..7), 2'si varsayılanla çözüldü (OV-8 → T7g, OV-9 → GitHub Issues). Eval seti konusunda dış ses, ilk reddi B-10 çelişkisini göstererek devirdi — cross-model mutabakat kabul edildi.

**VERDICT:** CEO CLEARED — plan v1.1 olarak revize edildi; implementasyon öncesi eng review önerilir.

NO UNRESOLVED DECISIONS
