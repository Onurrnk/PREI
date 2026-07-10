# PREI — proje talimatları

## Konum & Güvenlik
- Repo konumu: `C:\dev\prei` (OneDrive'dan taşındı 2026-07-10 — OneDrive kopyası kullanılmaz).
- Sır taraması: gitleaks. Her klonda bir kez: `git config core.hooksPath .githooks` (pre-commit staged tarama). CI: `.github/workflows/gitleaks.yml`. Bilinçli istisnalar `.gitleaks.toml` allowlist'inde (yalnız public anon key; service_role ASLA).

## Testing
- Komut: `npm test` (Vitest, `src/**/*.test.{ts,tsx}`) — detay: TESTING.md
- Hedef: tam kapsam. Yeni fonksiyon → test; bug fix → regression testi; hata yolu → hatayı tetikleyen test; yeni koşul → her iki dalın testi.
- Mevcut testleri kıran kod commit'lenmez (CI zorunlu kapı, `.github/workflows/ci.yml`).

## Tasarım
- Görsel dil dondurulmuş: `PREI_Design_System_v1.md` ("Private Banking Terminal", accent = logo moru #9B5BB3). UI değişiklikleri bu dokümana uygunluk denetiminden geçer; altın/şampanya accent önerme.

## Skill routing
- Görsel cila → /design-review · Kod incelemesi → /review · QA → /qa · Hata → /investigate · Ship → /ship
