// =====================================================================
// PREI | Bildirim Merkezi (T7b)
// Topbar zilinin arkasındaki panel. Mock bildirimler Faz 4-6'da gerçek
// event akışına (sözleşme uyarısı, gecikmiş ödeme, CPL anomalisi) bağlanır.
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellSlash,
  UserPlus,
  Warning,
  FileText,
  Megaphone,
  CalendarBlank,
  Checks,
} from '@phosphor-icons/react';
import styles from './NotificationCenter.module.css';
import { useTranslation } from 'react-i18next';

type NotificationKind = 'lead' | 'payment' | 'contract' | 'ad' | 'meeting';

interface Notification {
  id: string;
  kind: NotificationKind;
  titlePath: string;
  bodyPath: string;
  time: string;
  unread: boolean;
}

// Mock — Faz 6'da event akışından beslenecek
const initialNotifications: Notification[] = [
  { id: 'n1', kind: 'lead', titlePath: 'notifications.items.n1.title', bodyPath: 'notifications.items.n1.body', time: '12m', unread: true },
  { id: 'n2', kind: 'payment', titlePath: 'notifications.items.n2.title', bodyPath: 'notifications.items.n2.body', time: '1h', unread: true },
  { id: 'n3', kind: 'ad', titlePath: 'notifications.items.n3.title', bodyPath: 'notifications.items.n3.body', time: '3h', unread: true },
  { id: 'n4', kind: 'contract', titlePath: 'notifications.items.n4.title', bodyPath: 'notifications.items.n4.body', time: '1d', unread: false },
  { id: 'n5', kind: 'meeting', titlePath: 'notifications.items.n5.title', bodyPath: 'notifications.items.n5.body', time: '1d', unread: false },
];

const KIND_ICON: Record<NotificationKind, React.ReactNode> = {
  lead: <UserPlus size={16} />,
  payment: <Warning size={16} />,
  contract: <FileText size={16} />,
  ad: <Megaphone size={16} />,
  meeting: <CalendarBlank size={16} />,
};

const KIND_CLASS: Record<NotificationKind, string> = {
  lead: 'kindPositive',
  payment: 'kindNegative',
  contract: 'kindWarning',
  ad: 'kindInfo',
  meeting: 'kindNeutral',
};

export const NotificationCenter: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>(initialNotifications);
  const rootRef = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => n.unread).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const markAllRead = () => setItems((list) => list.map((n) => ({ ...n, unread: false })));
  const markRead = (id: string) =>
    setItems((list) => list.map((n) => (n.id === id ? { ...n, unread: false } : n)));

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        className={styles.trigger}
        title={t('notifications.title')}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label={t('notifications.title')}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button className={styles.markAll} onClick={markAllRead}>
                <Checks size={14} /> {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className={styles.empty}>
              <BellSlash size={28} weight="duotone" />
              <p>{t('notifications.empty')}</p>
            </div>
          ) : (
            <div className={styles.list}>
              {items.map((n) => (
                <button
                  key={n.id}
                  className={`${styles.item} ${n.unread ? styles.itemUnread : ''}`}
                  onClick={() => markRead(n.id)}
                >
                  <span className={`${styles.kindIcon} ${styles[KIND_CLASS[n.kind]]}`}>
                    {KIND_ICON[n.kind]}
                  </span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemTop}>
                      <span className={styles.itemTitle}>{t(n.titlePath)}</span>
                      <span className={styles.itemTime}>{n.time}</span>
                    </span>
                    <span className={styles.itemText}>{t(n.bodyPath)}</span>
                  </span>
                  {n.unread && <span className={styles.unreadDot} aria-label={t('notifications.unread')} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
