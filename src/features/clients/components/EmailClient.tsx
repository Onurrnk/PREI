import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlass, Paperclip, PaperPlaneTilt, ArrowBendUpLeft,
  EnvelopeSimple, TextB, TextItalic, TextUnderline, ListBullets, ListNumbers, FileText, X, WarningCircle,
} from '@phosphor-icons/react';
import type { EmailMessageDTO, ThreadSummaryDTO, ThreadDetailDTO, EmailAttachmentInput, MeResponse } from '../../../core/types';
import { gmailApi, meApi } from '../../../core/api/resources';
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

/** Yalnız HTML gövdeli mailler (ör. otomatik yanıtlar) için okunur düz
 *  metin çıkarır — HTML'i doğrudan render etmek yerine (XSS riski)
 *  satır sonlarını koruyarak etiketleri söker. */
const htmlToPlainText = (html: string | null): string => {
  if (!html) return '';
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '');
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
  const text = doc.body.textContent ?? '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
};

/** Mesajın gösterilecek metni: düz metin parçası varsa o; yoksa HTML'den
 *  çıkarılmış metin; o da yoksa Gmail snippet'i. */
const messageDisplayText = (msg: EmailMessageDTO): string =>
  msg.bodyText.trim() || htmlToPlainText(msg.bodyHtml) || msg.snippet;

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

  // Arama: Gmail'in kendi q sözdizimiyle, müşteri filtresinin üstüne eklenir.
  // 400ms debounce — her tuşta istek atmamak için.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(id);
  }, [search]);

  // Müşteri-360 (Onur talebi): YALNIZ bu müşteriyle yapılan yazışmalar.
  // from:/to: filtresi tüm inbox sızıntısını keser; e-posta yoksa hiç sorgu
  // atılmaz (aksi hâlde boş q tüm kutuyu listelerdi).
  const emailValid = /\S+@\S+\.\S+/.test(clientEmail);
  const clientFilter = `(from:${clientEmail} OR to:${clientEmail})`;
  const gmailQuery = debouncedSearch ? `${clientFilter} ${debouncedSearch}` : clientFilter;
  const { data: threadList, loading: threadsLoading, error: threadsError, refetch: refetchThreads } =
    useFetch<ThreadSummaryDTO[]>(
      () => (emailValid ? gmailApi.threads(gmailQuery) : Promise.resolve([])),
      [gmailQuery, emailValid],
    );
  const threads = threadList ?? [];

  // Yeni e-posta kompozörü — yazışma geçmişi olmasa da mail başlatılabilir
  // (önceden kompozör yalnız mevcut thread seçiliyken açılıyordu → "mail
  // gönderemiyorum" sorunu).
  const [composingNew, setComposingNew] = useState(false);
  const [newSubject, setNewSubject] = useState('');

  // İmza önizlemesi: gönderilen maile sunucu tarafında otomatik eklenen
  // markalı imzanın (ad/unvan/e-posta) kompozördeki görünür karşılığı.
  const { data: me } = useFetch<MeResponse>(() => meApi.get(), []);

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
  const [editorFocused, setEditorFocused] = useState(false);
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

  const focusComposer = () => {
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    editorRef.current?.focus();
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
    const isNew = composingNew || !selectedThread;
    if (!bodyText) return;
    if (isNew && !newSubject.trim()) {
      toast.error(t('clients.email.subjectRequired'));
      return;
    }
    setSending(true);
    try {
      const subject = isNew
        ? newSubject.trim()
        : (selectedThread!.subject.startsWith('Re:') ? selectedThread!.subject : `Re: ${selectedThread!.subject}`);
      const result = await gmailApi.send({
        to: clientEmail,
        subject,
        body: bodyText,
        bodyHtml,
        attachments: attachments.length > 0
          ? attachments.map(({ filename, mimeType, dataBase64 }) => ({ filename, mimeType, dataBase64 }))
          : undefined,
        threadId: isNew ? undefined : selectedThread!.id,
        recipientName: clientName,
      });
      if (isNew) {
        toast.success(t('clients.email.emailSent'));
        resetComposer();
        setComposingNew(false);
        setNewSubject('');
        refetchThreads(); // yeni thread listede görünsün
      } else {
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
          [selectedThread!.id]: [...(prev[selectedThread!.id] ?? []), sentMessage],
        }));
        toast.success(t('clients.email.emailSent'));
        resetComposer();
        refetchThread();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('clients.email.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  // E-posta adresi yoksa: inbox sızdırmak yerine net yönlendirme göster.
  if (!emailValid) {
    return (
      <Card className={styles.emailContainer}>
        <CardBody>
          <div className={styles.messageEmpty} style={{ padding: 40 }}>
            <EnvelopeSimple size={32} weight="duotone" />
            <p style={{ fontWeight: 600 }}>{t('clients.email.noEmailTitle')}</p>
            <p>{t('clients.email.noEmailBody')}</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className={styles.emailWrapper}>
    <Card className={styles.emailContainer}>
      <CardHeader className={styles.emailHeader}>
        <div className={styles.headerTop}>
          <div className={styles.integrationBadge}>
            <img src="https://cdn.simpleicons.org/gmail/EA4335" alt="Gmail" className={styles.googleIcon} />
            <span>{threadsError ? t('clients.email.gmailNeedsReconnect') : t('clients.email.gmailConnected')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={styles.threadCount}>{t('clients.email.threadCount', { count: threads.length })}</span>
            <Button variant="primary" onClick={() => { setComposingNew(true); setSelectedId(null); focusComposer(); }}>
              <PaperPlaneTilt size={14} /> {t('clients.email.newEmail')}
            </Button>
          </div>
        </div>
        <div className={styles.searchBar}>
          <MagnifyingGlass size={14} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={t('clients.email.searchPlaceholder', { email: clientEmail })}
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>

      <CardBody className={styles.emailBody}>
        <div className={styles.threadList}>
          {threadsLoading && <p className={styles.messageEmpty}>{t('clients.email.loading')}</p>}
          {threadsError && (
            <div className={styles.messageEmpty} style={{ padding: 24, textAlign: 'center', gap: 8 }}>
              <WarningCircle size={28} weight="duotone" style={{ color: 'var(--data-warning, var(--color-warning))' }} />
              <p style={{ fontWeight: 600 }}>{t('clients.email.connectionIssueTitle')}</p>
              <p style={{ fontSize: 13 }}>{threadsError}</p>
            </div>
          )}
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
                  <button type="button" className={styles.iconBtn} title={t('clients.email.reply')} onClick={focusComposer}>
                    <ArrowBendUpLeft size={16} />
                  </button>
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
                      {messageDisplayText(msg).split('\n').map((p, i) => (
                        <p key={i} className={styles.messageParagraph}>{p || ' '}</p>
                      ))}
                    </div>
                  );
                })}
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

      {/* Kompozör — okuma kartının DIŞINDA, altında ayrı blok. Yanıt modunda
          thread'e cevap yazar; "Yeni E-posta" modunda konu satırıyla sıfırdan
          mail başlatır (yazışma geçmişi olmayan müşteride de çalışır). */}
      {(selectedThread || composingNew) && (
              <div className={styles.replyBox}>
                {(composingNew || !selectedThread) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <input
                      style={{
                        flex: 1, padding: '8px 12px', fontSize: 14,
                        color: 'var(--text-primary)', background: 'var(--bg-inset)',
                        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-control, 6px)',
                      }}
                      value={newSubject}
                      placeholder={t('clients.email.subjectPh')}
                      onChange={(e) => setNewSubject(e.target.value)}
                    />
                    <button type="button" className={styles.iconBtn} title={t('clients.cancel')}
                      onClick={() => { setComposingNew(false); setNewSubject(''); }}>
                      <X size={16} />
                    </button>
                  </div>
                )}
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
                  /* Okuma öncelikli kompozör: boş+odaksızken tek satır, yazarken
                     rahat yükseklik. Inline style — CSS kaskadına bağımlı değil. */
                  style={{ minHeight: (editorFocused || !editorEmpty) ? 180 : 48 }}
                  contentEditable
                  role="textbox"
                  aria-multiline="true"
                  aria-label={t('clients.email.replyPlaceholder')}
                  data-placeholder={t('clients.email.replyPlaceholder')}
                  onInput={syncEditorEmpty}
                  onFocus={() => setEditorFocused(true)}
                  onBlur={() => setEditorFocused(false)}
                  suppressContentEditableWarning
                />

                {me && (
                  <div className={styles.signaturePreview} title={t('clients.email.signatureHint')}>
                    <span className={styles.signatureLabel}>{t('clients.email.signatureLabel')}</span>
                    <span className={styles.signatureName}>{me.name}</span>
                    {me.jobTitle && <span className={styles.signatureMeta}>· {me.jobTitle}</span>}
                    <span className={styles.signatureMeta}>· {me.email}</span>
                  </div>
                )}

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
      )}
    </div>
  );
};
