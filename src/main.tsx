import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './core/i18n/config'
import './index.css'
import { AppRouter } from './core/router'
import { AuthProvider } from './core/auth/AuthContext'
import { ToastProvider } from './core/components/Toast/ToastProvider'
import { ThemeProvider } from './core/theme/ThemeContext'

// Hata izleme (E1) — yalnız production build'de ve DSN verilmişse aktif.
// DSN gizli değildir (public identifier) ama env'de tutmak ortam ayrımını
// (dev'de gürültü yok) ve ileride rotasyonu kolaylaştırır.
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    // Yatırımcı verisi hassas: PII (kullanıcı bilgisi/istek gövdeleri)
    // Sentry'ye gönderilmez, yalnız hata + stack trace gider.
    sendDefaultPii: false,
  })
}

async function enableMocking() {
  if (!import.meta.env.DEV) {
    return
  }
  // Gerçek auth/backend modunda MSW başlatma → istekler gerçek backend'e gider.
  if (import.meta.env.VITE_USE_REAL_API === 'true') {
    return
  }
  const { worker } = await import('./mocks/browser')
  // `worker.start()` returns a Promise that resolves
  // once the Service Worker is up and ready to intercept requests.
  return worker.start()
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  )
})
