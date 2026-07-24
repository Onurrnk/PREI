// =====================================================================
// PREI | Bildirim Merkezi — Topbar zilinin arkasındaki panel.
// GERÇEK veri: /api/me/notifications (events akışından süzülmüş anlamlı
// olaylar). Okundu durumu sunucuda users.metadata.notificationsSeenAt ile
// tutulur; "Tümünü okundu işaretle" bu zaman damgasını günceller.
// =====================================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bell, BellSlash, UserPlus, AddressBook, FileText, CalendarBlank, FileArrowUp, Note, Checks,
} from '@phosphor-icons/react';
import styles from './NotificationCenter.module.css';
import { useTranslation } from 'react-i18next';
import { notificationsApi } from '../../api/resources';
import type { NotificationDTO, NotificationKind } from '../../types';

const KIND_ICON: Record<NotificationKind, React.ReactNode> = {
  lead: <UserPlus size={16} />,
  contact: <AddressBook size={16} />,
  meeting: <CalendarBlank size={16} />,
  proposal: <FileText size={16} />,
  document: <FileArrowUp size={16} />,
  note: <Note size={16} />,
};

const KIND_CLASS: Record<NotificationKind, string> = {
  lead: 'kindPositive',
  contact: 'kindPositive',
  meeting: 'kindNeutral',
  proposal: 'kindWarning',
  document: 'kindInfo',
  note: 'kindInfo',
};

// event_type → i18n başlık anahtarı
const TYPE_KEY: Record<string, string> = {
  'lead.created': 'notifications.event.leadCreated',
  'lead.web_form': 'notifications.event.leadWebForm',
  'contact.created': 'notifications.event.contactCreated',
  'meeting.created': 'notifications.event.meetingCreated',
  'proposal.follow_up_sent': 'notifications.event.proposalFollowUp',
  'document.uploaded': 'notifications.event.documentUploaded',
  'client.note_created': 'notifications.event.noteCreated',
};

export const NotificationCenter: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const relTime = useCallback((iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t('notifications.time.now');
    if (m < 60) return `${m}${t('notifications.time.m')}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}${t('notifications.time.h')}`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}${t('notifications.time.d')}`;
    return new Date(iso).toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { day: '2-digit', month: 'short' });
  }, [t, i18n.language]);

  const load = useCallback(async () => {
    try {
      const feed = await notificationsApi.list();
      setItems(feed.items);
      setUnreadCount(feed.unreadCount);
    } catch {
      // sessiz: bildirim zili kritik değil, hata topbar'ı bozmamalı
    }
  }, []);

  // İlk yükleme + 60 sn'de bir tazele
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(id);
  }, [load]);

  // Panel açıldığında tazele
  useEffect(() => { if (open) void load(); }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const markAllRead = async () => {
    setItems((list) => list.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);
    try { await notificationsApi.markSeen(); } catch { void load(); }
  };

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
                <div key={n.id} className={`${styles.item} ${n.unread ? styles.itemUnread : ''}`}>
                  <span className={`${styles.kindIcon} ${styles[KIND_CLASS[n.kind]]}`}>
                    {KIND_ICON[n.kind]}
                  </span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemTop}>
                      <span className={styles.itemTitle}>{t(TYPE_KEY[n.type] ?? 'notifications.event.generic')}</span>
                      <span className={styles.itemTime}>{relTime(n.occurredAt)}</span>
                    </span>
                    {n.label && <span className={styles.itemText}>{n.label}</span>}
                  </span>
                  {n.unread && <span className={styles.unreadDot} aria-label={t('notifications.unread')} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
