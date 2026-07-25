// =====================================================================
// PREI | Toplu müşteri içe aktarımı — dosya seç → önizle → aktar.
//
// Neden zorunlu önizleme: içe aktarım geri alınamaz. Kullanıcı hangi
// kolonun neye eşlendiğini, kaç kaydın zaten sistemde olduğunu ve hangi
// satırların atlanacağını YAZMADAN ÖNCE görür. "İçe aktar" düğmesi
// önizleme yapılmadan etkinleşmez.
//
// Kodlama tuzağı: Türkçe Windows Excel CSV'yi windows-1254 ile yazabilir.
// UTF-8 okursak "Yılmaz" → "Y�lmaz" olur ve kullanıcı bunu ancak kayıt
// olduktan sonra görür. Önce UTF-8 denenir; sonuçta değiştirme karakteri
// (U+FFFD) varsa windows-1254 ile yeniden çözülür.
// =====================================================================
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadSimple, Warning, CheckCircle, ArrowCounterClockwise } from '@phosphor-icons/react';
import { Button } from '../../core/components/Button/Button';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { contactsApi, type ImportReportDTO } from '../../core/api/resources';
import styles from './ImportClients.module.css';

/**
 * Dosyayı metne çevirir. UTF-8 bozuk çıkarsa Türkçe Windows kod sayfasına
 * düşer — Excel'in Türkçe kurulumu CSV'yi hâlâ windows-1254 yazabiliyor.
 */
async function readCsvFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8;
  try {
    return new TextDecoder('windows-1254').decode(buf);
  } catch {
    return utf8;   // tarayıcı bu kod sayfasını tanımıyorsa elimizdekiyle devam
  }
}

interface Props {
  /** Aktarım bittiğinde listeyi tazelemek için. */
  onImported: () => void;
}

export const ImportClients: React.FC<Props> = ({ onImported }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [dialCode, setDialCode] = useState('90');
  const [report, setReport] = useState<ImportReportDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const k = (key: string) => t(`clients.import.${key}`);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readCsvFile(file);
    setFileName(file.name);
    setCsv(text);
    setReport(null);
    setDone(false);
  };

  const reset = () => {
    setFileName(''); setCsv(''); setReport(null); setDone(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const run = async (commit: boolean) => {
    setBusy(true);
    try {
      const input = { csv, defaultDialCode: dialCode.trim() || undefined };
      const r = commit
        ? await contactsApi.importCommit(input)
        : await contactsApi.importPreview(input);
      setReport(r);
      if (commit) {
        setDone(true);
        toast.success(`${r.summary.created} · ${k('created')} — ${r.summary.targets} ${k('statTargets')}`);
        onImported();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const s = report?.summary;
  const nothingToDo = (s?.created ?? 0) + (s?.matched ?? 0) === 0;

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>{k('intro')}</p>

      {/* ── 1. Dosya ─────────────────────────────────────────────── */}
      <div className={styles.row}>
        <input
          ref={fileRef} type="file" accept=".csv,.txt,text/csv"
          onChange={pick} className={styles.fileInput} id="import-file"
        />
        <label htmlFor="import-file" className={styles.fileLabel}>
          <UploadSimple size={16} /> {fileName || k('pick')}
        </label>
        {fileName && (
          <button type="button" className={styles.reset} onClick={reset}>
            <ArrowCounterClockwise size={14} /> {k('change')}
          </button>
        )}
      </div>

      {/* ── 2. Ayar ──────────────────────────────────────────────── */}
      <label className={styles.dial}>
        <span>{k('dialLabel')}</span>
        <div className={styles.dialInput}>
          <span>+</span>
          <input
            value={dialCode}
            onChange={(e) => setDialCode(e.target.value.replace(/\D/g, ''))}
            maxLength={4} placeholder="90"
          />
        </div>
        <small>{k('dialHint')}</small>
      </label>

      {/* ── 3. Önizleme / aktarım ────────────────────────────────── */}
      <div className={styles.actions}>
        <Button variant="outline" disabled={!csv || busy} onClick={() => run(false)}>
          {busy && !done ? k('previewing') : k('preview')}
        </Button>
        <Button
          variant="primary"
          disabled={!report || busy || done || nothingToDo}
          onClick={() => run(true)}
        >
          {k('commit')}
        </Button>
      </div>

      {report && s && (
        <div className={styles.result}>
          <div className={styles.summary}>
            <Stat label={k('statRows')} value={s.total} />
            <Stat
              label={done ? k('statCreatedDone') : k('statCreated')}
              value={s.created} tone="positive"
            />
            <Stat label={k('statMatched')} value={s.matched} tone="info" />
            <Stat label={k('statSkipped')} value={s.skipped} tone={s.skipped ? 'warning' : undefined} />
            <Stat label={k('statTargets')} value={s.targets} />
          </div>

          <p className={styles.meta}>
            {k('delimiter')}:{' '}
            <code>{report.delimiter === '\t' ? k('tab') : report.delimiter}</code>
            {' · '}
            {k('mapped')}:{' '}
            {report.mapping.filter((m) => m.field)
              .map((m) => `${m.header} → ${t(`clients.import.fields.${m.field}`)}`)
              .join(', ') || '—'}
          </p>

          {report.unmappedHeaders.length > 0 && (
            <p className={styles.warn}>
              <Warning size={14} /> {k('unmapped')}{' '}
              <strong>{report.unmappedHeaders.join(', ')}</strong>
            </p>
          )}

          {done && (
            <p className={styles.ok}><CheckCircle size={14} /> {k('completed')}</p>
          )}

          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{k('colName')}</th>
                  <th>{k('colContact')}</th>
                  <th>{k('colOutcome')}</th>
                  <th>{k('colNote')}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.rowNumber} className={r.outcome === 'skipped' ? styles.dim : undefined}>
                    <td className={styles.num}>{r.rowNumber}</td>
                    <td>{r.name}</td>
                    <td className={styles.contact}>
                      {r.email && <span>{r.email}</span>}
                      {r.phone && <span>{r.phone}</span>}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[r.outcome]}`}>
                        {r.outcome === 'created' ? (done ? k('created') : k('willCreate'))
                          : r.outcome === 'matched' ? `${k('matched')} (${r.matchedBy})`
                          : k('skipped')}
                      </span>
                      {r.targetsAdded > 0 && (
                        <span className={styles.targets}>
                          {t('clients.import.targetsAdded', { count: r.targetsAdded })}
                        </span>
                      )}
                    </td>
                    <td className={styles.issues}>
                      {r.issues.map((i, idx) => <span key={idx}>{i}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; tone?: 'positive' | 'info' | 'warning' }> =
  ({ label, value, tone }) => (
    <div className={styles.stat}>
      <span className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
