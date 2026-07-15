import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlass, Paperclip, PaperPlaneTilt, ArrowBendUpLeft, Trash, DotsThreeVertical, EnvelopeSimple } from '@phosphor-icons/react';
import type { EmailMessageDTO, ThreadSummaryDTO, ThreadDetailDTO } from '../../../core/types';
import { gmailApi } from '../../../core/api/resources';
import { useFetch } from '../../../core/hooks/useFetch';
import { Card, CardHeader, CardBody } from '../../../core/components/Card/Card';
import { Button } from '../../../core/components/Button/Button';
import { useToast } from '../../../core/components/Toast/ToastProvider';
import styles from './EmailClient.module.css';

const formatThreadDate = (iso: string, locale: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return locale.startsWith('tr') ? 'Dün' : 'Yesterday';
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
};

export const EmailClient: React.FC<{ clientEmail: string; clientName: string }> = ({ clientEmail, clientName }) => {
  const { t, i18n: i18nInstance } = useTranslation();
  const locale = i18nInstance.language?.startsWith('tr') ? 'tr-TR' : 'en-GB';
  const toast = useToast();

  const { data: threadList, loading: threadsLoading, error: threadsError } =
    useFetch<ThreadSummaryDTO[]>(() => gmailApi.threads(clientEmail), [clientEmail]);
  const threads = threadList ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Kullanıcı henüz seçim yapmadıysa ilk thread'i türetilmiş değer olarak
  // kullan — effect içinde senkron setState yerine (render-time derivation).
  const effectiveSelectedId = selectedId ?? threads[0]?.id ?? null;
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  // Gönderilen mesajları thread bazında yerelde tutar — GET round-trip'i
  // beklemeden anında görünür (ClientProfile'daki addedNotes deseniyle aynı).
  const [sentByThread, setSentByThread] = useState<Record<string, EmailMessageDTO[]>>({});

  const {
    data: selectedThread,
    loading: threadLoading,
    refetch: refetchThread,
  } = useFetch<ThreadDetailDTO | null>(
    () => (effectiveSelectedId ? gmailApi.thread(effectiveSelectedId) : Promise.resolve(null)),
    [effectiveSelectedId],
  );
  void threadLoading; // future: inline skeleton for message pane

  const selectThread = (id: string) => {
    setSelectedId(id);
    setReadIds((prev) => new Set(prev).add(id));
  };

  const handleSend = async () => {
    const body = reply.trim();
    if (!body || !selectedThread) return;
    setSending(true);
    try {
      const subject = selectedThread.subject.startsWith('Re:') ? selectedThread.subject : `Re: ${selectedThread.subject}`;
      const result = await gmailApi.send({
        to: clientEmail,
        subject,
        body,
        threadId: selectedThread.id,
        recipientName: clientName,
      });
      const sentMessage: EmailMessageDTO = {
        id: result.id,
        threadId: result.threadId,
        from: 'ProDuality',
        fromEmail: 'info@produality.com',
        to: [clientEmail],
        subject,
        date: new Date().toISOString(),
        snippet: body.slice(0, 120),
        bodyText: body,
        bodyHtml: null,
      };
      setSentByThread((prev) => ({
        ...prev,
        [selectedThread.id]: [...(prev[selectedThread.id] ?? []), sentMessage],
      }));
      toast.success(t('clients.email.emailSent'));
      setReply('');
      refetchThread();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('clients.email.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className={styles.emailContainer}>
      <CardHeader className={styles.emailHeader}>
        <div className={styles.headerTop}>
          <div className={styles.integrationBadge}>
            <img src="https://cdn.simpleicons.org/gmail/EA4335" alt="Gmail" className={styles.googleIcon} />
            <span>{t('clients.email.gmailConnected')}</span>
          </div>
          <span className={styles.threadCount}>{t('clients.email.threadCount', { count: threads.length })}</span>
        </div>
        <div className={styles.searchBar}>
          <MagnifyingGlass size={14} className={styles.searchIcon} />
          <input type="text" placeholder={t('clients.email.searchPlaceholder', { email: clientEmail })} className={styles.searchInput} />
        </div>
      </CardHeader>

      <CardBody className={styles.emailBody}>
        <div className={styles.threadList}>
          {threadsLoading && <p className={styles.messageEmpty}>{t('clients.email.loading')}</p>}
          {threadsError && <p className={styles.messageEmpty}>{threadsError}</p>}
          {!threadsLoading && !threadsError && threads.length === 0 && (
            <div className={styles.messageEmpty}>
              <EnvelopeSimple size={28} weight="duotone" />
              <p>{t('clients.email.noThreads')}</p>
            </div>
          )}
          {threads.map((thread) => {
            const unread = thread.unread && !readIds.has(thread.id);
            const fromClient = thread.fromEmail?.toLowerCase() === clientEmail.toLowerCase();
            return (
              <button
                key={thread.id}
                className={`${styles.threadItem} ${effectiveSelectedId === thread.id ? styles.active : ''} ${unread ? styles.unread : ''}`}
                onClick={() => selectThread(thread.id)}
              >
                <div className={styles.threadHeader}>
                  <span className={styles.threadSender}>
                    {unread && <span className={styles.unreadDot} aria-label="unread" />}
                    {fromClient ? clientName : t('clients.email.me')}
                  </span>
                  <span className={styles.threadDate}>{formatThreadDate(thread.date, locale)}</span>
                </div>
                <div className={styles.threadSubject}>{thread.subject}</div>
                <div className={styles.threadSnippet}>{thread.snippet}</div>
              </button>
            );
          })}
        </div>

        <div className={styles.messageView}>
          {selectedThread ? (
            <div className={styles.messageContent}>
              <div className={styles.messageHeader}>
                <div className={styles.messageMeta}>
                  <h3 className={styles.messageSubject}>{selectedThread.subject}</h3>
                </div>
                <div className={styles.messageActions}>
                  <button className={styles.iconBtn} title={t('clients.email.reply')}><ArrowBendUpLeft size={16} /></button>
                  <button className={styles.iconBtn} title={t('clients.email.delete')}><Trash size={16} /></button>
                  <button className={styles.iconBtn} title={t('clients.email.more')}><DotsThreeVertical size={16} /></button>
                </div>
              </div>
              <div className={styles.messageBody}>
                {[...selectedThread.messages, ...(sentByThread[selectedThread.id] ?? [])].map((msg) => {
                  const fromClient = msg.fromEmail?.toLowerCase() === clientEmail.toLowerCase();
                  return (
                    <div key={msg.id} className={styles.messageContent}>
                      <div className={styles.messageSenderDetails}>
                        <div className={styles.avatar}>
                          {(fromClient ? clientName : 'ProDuality').charAt(0)}
                        </div>
                        <div className={styles.senderInfo}>
                          <span className={styles.senderName}>{fromClient ? clientName : msg.from}</span>
                          <span className={styles.senderEmail}>{msg.fromEmail}</span>
                        </div>
                      </div>
                      {msg.bodyText.split('\n').map((p, i) => (
                        <p key={i} className={styles.messageParagraph}>{p || ' '}</p>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div className={styles.replyBox}>
                <textarea
                  className={styles.replyInput}
                  placeholder={t('clients.email.replyPlaceholder')}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <div className={styles.replyActions}>
                  <button className={styles.attachBtn} title={t('clients.email.attach')}><Paperclip size={16} /></button>
                  <Button variant="primary" onClick={handleSend} disabled={sending || !reply.trim()}>
                    <PaperPlaneTilt size={14} /> {sending ? t('clients.email.sending') : t('clients.email.send')}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.messageEmpty}>
              <EnvelopeSimple size={28} weight="duotone" />
              <p>{t('clients.email.selectThread')}</p>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
