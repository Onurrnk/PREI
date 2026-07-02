// =====================================================================
// PREI | Toast notifications
// Replaces native alert() with non-blocking, styled in-app notifications.
// Usage: const toast = useToast(); toast.success('Saved');
// =====================================================================
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle, WarningCircle, Info, X } from '@phosphor-icons/react';
import styles from './Toast.module.css';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

const ICONS = { success: CheckCircle, error: WarningCircle, info: Info };

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = Date.now() + Math.random();
      setToasts((list) => [...list, { id, message, variant }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const api: ToastApi = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.container}>
        {toasts.map((t) => {
          const Icon = ICONS[t.variant];
          return (
            <div key={t.id} className={`${styles.toast} ${styles[t.variant]}`} role="status">
              <Icon size={18} className={styles.icon} />
              <span className={styles.message}>{t.message}</span>
              <button className={styles.close} onClick={() => dismiss(t.id)} aria-label="Kapat">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
