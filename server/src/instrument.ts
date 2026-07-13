// =====================================================================
// PREI | Sentry enstrümantasyonu — main.ts'in EN ÜSTÜNDE import edilmeli
// (Sentry'nin otomatik enstrümantasyonu diğer modüllerden önce yüklenmeli).
// Yalnız SENTRY_DSN verilmişse aktive olur — lokal dev'de sessiz kalır.
// PII kapalı: yatırımcı verisi hassas (K-4/KVKK) — yalnız hata + stack
// trace gider; kullanıcı bilgisi/istek gövdesi Sentry'ye GÖNDERİLMEZ.
// =====================================================================
import * as Sentry from '@sentry/nestjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    sendDefaultPii: false,
    // SENTRY_DEBUG=1 → SDK kendi gönderim loglarını basar (sorun teşhisi).
    debug: process.env.SENTRY_DEBUG === '1',
  });
}
