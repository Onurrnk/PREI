import React, { useState } from 'react';
import { Search, Paperclip, Send, Reply, Trash2, MoreVertical } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../core/components/Card/Card';
import { Button } from '../../../core/components/Button/Button';
import styles from './EmailClient.module.css';

export const EmailClient: React.FC<{ clientEmail: string, clientName: string }> = ({ clientEmail, clientName }) => {
  const [selectedThread, setSelectedThread] = useState<string | null>('1');

  const threads = [
    {
      id: '1',
      subject: 'Re: Dubai Marina Off-plan Projects',
      snippet: 'Thanks for the PDF. I am interested in the 2BR options...',
      date: '10:45 AM',
      unread: true,
      sender: clientName,
    },
    {
      id: '2',
      subject: 'Property Portfolio Update',
      snippet: 'Please find attached the latest portfolio options tailored to your profile.',
      date: 'Yesterday',
      unread: false,
      sender: 'Me',
    },
    {
      id: '3',
      subject: 'Initial Consultation Follow-up',
      snippet: 'It was great speaking with you today regarding your investment goals...',
      date: 'Oct 12',
      unread: false,
      sender: 'Me',
    }
  ];

  return (
    <Card className={styles.emailContainer}>
      <CardHeader className={styles.emailHeader}>
        <div className={styles.headerTop}>
          <div className={styles.integrationBadge}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/archive/c/c1/20210817165306%21Google_%22G%22_logo.svg" alt="Google" className={styles.googleIcon} />
            <span>Gmail Connected</span>
          </div>
          <div className={styles.adminBadge}>Admin View</div>
        </div>
        <div className={styles.searchBar}>
          <Search size={14} className={styles.searchIcon} />
          <input type="text" placeholder={`Search emails with ${clientEmail}...`} className={styles.searchInput} />
        </div>
      </CardHeader>
      
      <CardBody className={styles.emailBody}>
        <div className={styles.threadList}>
          {threads.map(thread => (
            <div 
              key={thread.id} 
              className={`${styles.threadItem} ${selectedThread === thread.id ? styles.active : ''} ${thread.unread ? styles.unread : ''}`}
              onClick={() => setSelectedThread(thread.id)}
            >
              <div className={styles.threadHeader}>
                <span className={styles.threadSender}>{thread.sender}</span>
                <span className={styles.threadDate}>{thread.date}</span>
              </div>
              <div className={styles.threadSubject}>{thread.subject}</div>
              <div className={styles.threadSnippet}>{thread.snippet}</div>
            </div>
          ))}
        </div>

        <div className={styles.messageView}>
          {selectedThread === '1' && (
            <div className={styles.messageContent}>
              <div className={styles.messageHeader}>
                <div className={styles.messageMeta}>
                  <h3 className={styles.messageSubject}>Re: Dubai Marina Off-plan Projects</h3>
                  <div className={styles.messageSenderDetails}>
                    <div className={styles.avatar}>{clientName.charAt(0)}</div>
                    <div className={styles.senderInfo}>
                      <span className={styles.senderName}>{clientName}</span>
                      <span className={styles.senderEmail}>&lt;{clientEmail}&gt;</span>
                    </div>
                  </div>
                </div>
                <div className={styles.messageActions}>
                  <button className={styles.iconBtn}><Reply size={16} /></button>
                  <button className={styles.iconBtn}><Trash2 size={16} /></button>
                  <button className={styles.iconBtn}><MoreVertical size={16} /></button>
                </div>
              </div>
              <div className={styles.messageBody}>
                <p>Hi Sarah,</p>
                <p>Thanks for sending over the PDF with the latest off-plan projects in Dubai Marina.</p>
                <p>I've reviewed the options and I'm particularly interested in the 2-bedroom apartments in the EMAAR Beachfront development. Could you please send me the specific payment plans for those?</p>
                <p>Also, let me know when we can schedule a quick call to discuss the expected ROI.</p>
                <br/>
                <p>Best regards,<br/>{clientName}</p>
              </div>
              
              <div className={styles.replyBox}>
                <textarea className={styles.replyInput} placeholder="Type your reply here..."></textarea>
                <div className={styles.replyActions}>
                  <button className={styles.attachBtn}><Paperclip size={16} /></button>
                  <Button variant="primary"><Send size={14} style={{ marginRight: '8px' }} /> Send</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
