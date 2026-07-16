import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlass, Paperclip, PaperPlaneTilt, ArrowBendUpLeft, Trash, DotsThreeVertical,
  EnvelopeSimple, TextB, TextItalic, TextUnderline, ListBullets, ListNumbers, FileText, X,
} from '@phosphor-icons/react';
import type { EmailMessageDTO, ThreadSummaryDTO, ThreadDetailDTO, EmailAttachmentInput } from '../../../core/types';
import { gmailApi } from '../../../core/api/resources';
import { useFetch } from '../../../core/hooks/useFetch';
import { Card, CardHeader, CardBody } from '../../../core/components/Card/Card';
import { Button } from '../../../core/components/Button/Button';
import { SelectMenu } from '../../../core/components/Form/SelectMenu';
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

const formatFileSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// Ek başına 5MB, e-posta başına toplam 15MB (backend limiti ile hizalı).
const MAX_TOTAL_ATTACHMENT_BYTES = 15 * 1024 * 1024;

interface PendingAttachment extends EmailAttachmentInput {
  sizeBytes: number;
}

// Hazır şablon gövdeleri — {client} alıcı adıyla değiştirilir. Şablon
// başlıkları i18n'den gelir; gövde her iki dilde de i18n'de tutulur.
const TEMPLATE_KEYS = ['followUp', 'portfolio', 'meetingInvite', 'paymentPlan'] as const;
type TemplateKey = typeof TEMPLATE_KEYS[number];

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
  const [sending, setSending] = useState(false);
  // Gönderilen mesajları thread bazında yerelde tutar — GET round-trip'i
  // beklemeden anında görünür (ClientProfile'daki addedNotes deseniyle aynı).
  const [sentByThread, setSentByThread] = useState<Record<string, EmailMessageDTO[]>>({});

  // Zengin kompozör: contentEditable div (state yerine ref — her tuşta
  // re-render + caret kaybı yaşamamak için). isEmpty yalnız buton durumunu
  // günceller.
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // innerText satır sonlarını korur; jsdom'da tanımsız olduğundan textContent'e düşer.
  const editorText = (): string =>
    (editorRef.current?.innerText ?? editorRef.current?.textContent ?? '').trim();

  const syncEditorEmpty = () => {
    setEditorEmpty(editorText().length === 0);
  };

  // document.execCommand: eski API ama tüm tarayıcılarda çalışır ve
  // bağımlılıksız b/i/u/liste için hâlâ pratik standart.
  const exec = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command);
    syncEditorEmpty();
  };

  const applyTemplate = (key: string) => {
    setSelectedTemplate(key);
    if (!key || !editorRef.current) return;
    const body = t(`clients.email.templates.${key as TemplateKey}.body`, { client: clientName });
    // Şablon paragrafları <p> olarak yerleştirilir; danışman üstüne yazabilir.
    editorRef.current.innerHTML = body
      .split('\n\n')
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
    editorRef.current.focus();
    syncEditorEmpty();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const currentTotal = attachments.reduce((s, a) => s + a.sizeBytes, 0);
    const incomingTotal = incoming.reduce((s, f) => s + f.size, 0);
    if (currentTotal + incomingTotal > MAX_TOTAL_ATTACHMENT_BYTES) {
      toast.error(t('clients.email.attachTooLarge'));
      return;
    }
    incoming.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? '');
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        setAttachments((prev) => [...prev, {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataBase64: base64,
          sizeBytes: file.size,
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (idx: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const resetComposer = () => {
    if (editorRef.current) editorRef.current.innerHTML = '';
    setEditorEmpty(true);
    setAttachments([]);
    setSelectedTemplate('');
  };

  const handleSend = async () => {
    const bodyText = editorText();
    const bodyHtml = editorRef.current?.innerHTML ?? '';
    if (!bodyText || !selectedThread) return;
    setSending(true);
    try {
      const subject = selectedThread.subject.startsWith('Re:') ? selectedThread.subject : `Re: ${selectedThread.subject}`;
      const result = await gmailApi.send({
        to: clientEmail,
        subject,
        body: bodyText,
        bodyHtml,
        attachments: attachments.length > 0
          ? attachments.map(({ filename, mimeType, dataBase64 }) => ({ filename, mimeType, dataBase64 }))
          : undefined,
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
        snippet: bodyText.slice(0, 120),
        bodyText,
        bodyHtml: null,
      };
      setSentByThread((prev) => ({
        ...prev,
        [selectedThread.id]: [...(prev[selectedThread.id] ?? []), sentMessage],
      }));
      toast.success(t('clients.email.emailSent'));
      resetComposer();
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
                    <div key={msg.id} className={styles.messageItem}>
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
                        <p key={i} className={styles.messageParagraph}>{p || ' '}</p>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div className={styles.replyBox}>
                <div className={styles.composerToolbar}>
                  <div className={styles.formatButtons}>
                    <button type="button" className={styles.formatBtn} title={t('clients.email.bold')} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}>
                      <TextB size={16} weight="bold" />
                    </button>
                    <button type="button" className={styles.formatBtn} title={t('clients.email.italic')} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}>
                      <TextItalic size={16} />
                    </button>
                    <button type="button" className={styles.formatBtn} title={t('clients.email.underline')} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}>
                      <TextUnderline size={16} />
                    </button>
                    <span className={styles.toolbarDivider} />
                    <button type="button" className={styles.formatBtn} title={t('clients.email.bulletList')} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')}>
                      <ListBullets size={16} />
                    </button>
                    <button type="button" className={styles.formatBtn} title={t('clients.email.numberList')} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertOrderedList')}>
                      <ListNumbers size={16} />
                    </button>
                  </div>
                  <div className={styles.templatePicker}>
                    <SelectMenu
                      aria-label={t('clients.email.templateLabel')}
                      value={selectedTemplate}
                      onChange={applyTemplate}
                      placeholder={t('clients.email.templateLabel')}
                      options={TEMPLATE_KEYS.map((key) => ({
                        value: key,
                        label: t(`clients.email.templates.${key}.title`),
                      }))}
                    />
                  </div>
                </div>

                <div
                  ref={editorRef}
                  className={styles.richEditor}
                  contentEditable
                  role="textbox"
                  aria-multiline="true"
                  aria-label={t('clients.email.replyPlaceholder')}
                  data-placeholder={t('clients.email.replyPlaceholder')}
                  onInput={syncEditorEmpty}
                  suppressContentEditableWarning
                />

                {attachments.length > 0 && (
                  <div className={styles.attachmentList}>
                    {attachments.map((att, idx) => (
                      <span key={`${att.filename}-${idx}`} className={styles.attachmentChip}>
                        <FileText size={13} />
                        <span className={styles.attachmentName} title={att.filename}>{att.filename}</span>
                        <span className={styles.attachmentSize}>{formatFileSize(att.sizeBytes)}</span>
                        <button
                          type="button"
                          className={styles.attachmentRemove}
                          aria-label={t('clients.email.removeAttachment', { name: att.filename })}
                          onClick={() => removeAttachment(idx)}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className={styles.replyActions}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    className={styles.fileInput}
                    onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                  />
                  <button
                    type="button"
                    className={styles.attachBtn}
                    title={t('clients.email.attach')}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip size={16} />
                    {attachments.length > 0 && <span className={styles.attachCount}>{attachments.length}</span>}
                  </button>
                  <Button variant="primary" onClick={handleSend} disabled={sending || editorEmpty}>
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
