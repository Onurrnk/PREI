import React, { useState } from 'react';
import { MagnifyingGlass, Paperclip, PaperPlaneTilt, ArrowBendUpLeft, Trash, DotsThreeVertical, EnvelopeSimple } from '@phosphor-icons/react';
import { Card, CardHeader, CardBody } from '../../../core/components/Card/Card';
import { Button } from '../../../core/components/Button/Button';
import { useToast } from '../../../core/components/Toast/ToastProvider';
import styles from './EmailClient.module.css';

// Mock thread'ler — Faz 1'de Gmail API'ye (server/src/modules/gmail) bağlanır.
interface EmailThread {
  id: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  fromClient: boolean;
  paragraphs: string[];
}

const buildThreads = (clientName: string): EmailThread[] => [
  {
    id: '1',
    subject: 'Re: Dubai Marina Off-plan Projects',
    snippet: 'Thanks for the PDF. I am interested in the 2BR options...',
    date: '10:45',
    unread: true,
    fromClient: true,
    paragraphs: [
      'Hello,',
      'Thanks for sending over the PDF with the latest off-plan projects in Dubai Marina.',
      "I've reviewed the options and I'm particularly interested in the 2-bedroom apartments in the EMAAR Beachfront development. Could you please send me the specific payment plans for those?",
      'Also, let me know when we can schedule a quick call to discuss the expected ROI.',
      `Best regards,\n${clientName}`,
    ],
  },
  {
    id: '2',
    subject: 'Property Portfolio Update',
    snippet: 'Please find attached the latest portfolio options tailored to your profile.',
    date: 'Yesterday',
    unread: false,
    fromClient: false,
    paragraphs: [
      `Dear ${clientName.split(' ')[0]},`,
      'Please find attached the latest portfolio options tailored to your investment profile: 4 units across Dubai Marina and Downtown, all within your stated budget range.',
      'Two of them include a 60/40 construction-linked payment plan, which matches the structure you preferred in our last call.',
      'Happy to walk you through the comparison whenever suits you.',
      'Kind regards,\nProDuality Advisory',
    ],
  },
  {
    id: '3',
    subject: 'Initial Consultation Follow-up',
    snippet: 'It was great speaking with you today regarding your investment goals...',
    date: '12 Jun',
    unread: false,
    fromClient: false,
    paragraphs: [
      `Dear ${clientName.split(' ')[0]},`,
      'It was great speaking with you today regarding your investment goals in the Gulf region.',
      'As discussed, I will prepare a shortlist focused on 2BR waterfront units with strong rental yield history, and share it before the end of the week.',
      'Kind regards,\nProDuality Advisory',
    ],
  },
];

export const EmailClient: React.FC<{ clientEmail: string; clientName: string }> = ({ clientEmail, clientName }) => {
  const [threads, setThreads] = useState<EmailThread[]>(() => buildThreads(clientName));
  const [selectedId, setSelectedId] = useState<string>('1');
  const [reply, setReply] = useState('');
  const toast = useToast();

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  const selectThread = (id: string) => {
    setSelectedId(id);
    setThreads((list) => list.map((t) => (t.id === id ? { ...t, unread: false } : t)));
  };

  const handleSend = () => {
    if (!reply.trim()) return;
    toast.success('E-posta gönderildi');
    setReply('');
  };

  return (
    <Card className={styles.emailContainer}>
      <CardHeader className={styles.emailHeader}>
        <div className={styles.headerTop}>
          <div className={styles.integrationBadge}>
            <img src="https://cdn.simpleicons.org/gmail/EA4335" alt="Gmail" className={styles.googleIcon} />
            <span>Gmail Connected</span>
          </div>
          <span className={styles.threadCount}>{threads.length} threads</span>
        </div>
        <div className={styles.searchBar}>
          <MagnifyingGlass size={14} className={styles.searchIcon} />
          <input type="text" placeholder={`Search emails with ${clientEmail}...`} className={styles.searchInput} />
        </div>
      </CardHeader>

      <CardBody className={styles.emailBody}>
        <div className={styles.threadList}>
          {threads.map((thread) => (
            <button
              key={thread.id}
              className={`${styles.threadItem} ${selectedId === thread.id ? styles.active : ''} ${thread.unread ? styles.unread : ''}`}
              onClick={() => selectThread(thread.id)}
            >
              <div className={styles.threadHeader}>
                <span className={styles.threadSender}>
                  {thread.unread && <span className={styles.unreadDot} aria-label="unread" />}
                  {thread.fromClient ? clientName : 'Me'}
                </span>
                <span className={styles.threadDate}>{thread.date}</span>
              </div>
              <div className={styles.threadSubject}>{thread.subject}</div>
              <div className={styles.threadSnippet}>{thread.snippet}</div>
            </button>
          ))}
        </div>

        <div className={styles.messageView}>
          {selected ? (
            <div className={styles.messageContent}>
              <div className={styles.messageHeader}>
                <div className={styles.messageMeta}>
                  <h3 className={styles.messageSubject}>{selected.subject}</h3>
                  <div className={styles.messageSenderDetails}>
                    <div className={styles.avatar}>
                      {(selected.fromClient ? clientName : 'ProDuality').charAt(0)}
                    </div>
                    <div className={styles.senderInfo}>
                      <span className={styles.senderName}>
                        {selected.fromClient ? clientName : 'ProDuality Advisory'}
                      </span>
                      <span className={styles.senderEmail}>
                        {selected.fromClient ? clientEmail : 'info@produality.com'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.messageActions}>
                  <button className={styles.iconBtn} title="Reply"><ArrowBendUpLeft size={16} /></button>
                  <button className={styles.iconBtn} title="Delete"><Trash size={16} /></button>
                  <button className={styles.iconBtn} title="More"><DotsThreeVertical size={16} /></button>
                </div>
              </div>
              <div className={styles.messageBody}>
                {selected.paragraphs.map((p, i) => (
                  <p key={i} className={styles.messageParagraph}>{p}</p>
                ))}
              </div>

              <div className={styles.replyBox}>
                <textarea
                  className={styles.replyInput}
                  placeholder="Type your reply here..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <div className={styles.replyActions}>
                  <button className={styles.attachBtn} title="Attach file"><Paperclip size={16} /></button>
                  <Button variant="primary" onClick={handleSend}>
                    <PaperPlaneTilt size={14} /> Send
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.messageEmpty}>
              <EnvelopeSimple size={28} weight="duotone" />
              <p>Select a thread to read.</p>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
