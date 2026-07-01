# PREI — Gmail Entegrasyonu Kurulum Rehberi

Bu backend, her danışmanın kendi Gmail hesabını PREI'ye bağlamasını sağlar (gelen kutusu okuma, yanıtlama/gönderme, lead/müşteri eşleştirme). Gmail API güvenlik nedeniyle **sunucu tarafı OAuth 2.0** gerektirir; aşağıdaki adımları **senin** yapman gerekir (Claude hesap açamaz / secret giremez).

## 1. Google Cloud projesi ve OAuth credential'ı

1. [Google Cloud Console](https://console.cloud.google.com/) → yeni proje oluştur (örn. "PREI Smart Suites").
2. **APIs & Services → Library** → "Gmail API" → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: şirket içi Google Workspace kullanıyorsan **Internal**; değilse **External**.
   - Uygulama adı, destek e-postası, geliştirici e-postası gir.
   - **Scopes** ekle: `.../auth/gmail.readonly`, `.../auth/gmail.send`, `userinfo.email`, `openid`.
   - External seçtiysen, test aşamasında **Test users** listesine bağlanacak danışmanların e-postalarını ekle.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs** → şunu ekle (birebir aynı olmalı):
     ```
     http://localhost:4000/api/auth/google/callback
     ```
     (Canlıya alınca kendi domainini de ekle.)
   - Oluştur → **Client ID** ve **Client Secret** değerlerini kopyala.

## 2. Backend ortam değişkenleri

```bash
cd server
cp .env.example .env
```

`.env` içine 1. adımdaki değerleri gir:

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
```

## 3. Çalıştır

```bash
cd server
npm install
npm run start:dev
```

Backend `http://localhost:4000/api` üzerinde ayağa kalkar.

## 4. Bağlama akışı (frontend bir sonraki adımda eklenecek)

1. Danışman PREI'de **Settings → Gmail Bağla**'ya tıklar.
2. Frontend: `GET /api/auth/google/url?userId=<id>` → dönen `url`'i açar.
3. Danışman Google onay ekranında izin verir.
4. Google `…/api/auth/google/callback`'e döner; backend token'ı saklar ve `…/settings?gmail=connected`'e yönlendirir.
5. Artık: `GET /api/gmail/threads`, `GET /api/gmail/threads/:id`, `POST /api/gmail/send` çağrılabilir.

## Önemli notlar / yapılacaklar (production)

- **Token saklama:** Şu an `InMemoryTokenStore` kullanılıyor (sadece dev). Production'da token'lar **şifrelenmiş** olarak Postgres/Supabase'e yazılmalı (`TokenStore` arayüzünün Supabase implementasyonu). — DEBT-GMAIL-001
- **userId:** Şu an query param ile geliyor (placeholder). Production'da PREI JWT oturumundan alınmalı, asla client'tan güvenilmemeli. — DEBT-GMAIL-002
- **Webhook/push:** Gerçek zamanlı gelen kutusu için Gmail `watch` + Pub/Sub eklenebilir (şimdilik pull/list).
- **Rate limit & retry:** Gmail API kotaları için exponential backoff eklenmeli.
- **Scope minimizasyonu:** Sadece okuma istiyorsan `gmail.send` scope'unu kaldır.
