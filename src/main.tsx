import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './core/i18n/config'
import './index.css'
import { AppRouter } from './core/router'
import { AuthProvider } from './core/auth/AuthContext'
import { ToastProvider } from './core/components/Toast/ToastProvider'
import { ThemeProvider } from './core/theme/ThemeContext'

async function enableMocking() {
  if (!import.meta.env.DEV) {
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
