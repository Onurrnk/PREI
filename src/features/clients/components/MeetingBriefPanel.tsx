// =====================================================================
// PREI | MeetingBriefPanel — görüşme öncesi hazırlık brifingi.
//
// "Toplantıya girmeden önce dersimize çalışmış olalım": ne konuşuldu,
// müşteri profili, istediği bölgeler, beklentiler, ciddiyet sinyalleri,
// SORULACAK SORULAR ve görüşme akışı önerisi.
//
// Brifing motoru kapalıysa (API anahtarı yok) panel yine de işe yarar:
// ham dosya sayıları ve "şunları sor" listesi gösterilir.
// =====================================================================
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../core/components/Button/Button';
import { useToast } from '../../../core/components/Toast/ToastProvider';
import { meetingBriefApi } from '../../../core/api/resources';
import type { BriefResultDTO } from '../../../core/types';
import styles from './MeetingBriefPanel.module.css';

interface Props {
  leadId: string | null;
}

/** Liste bölümü — boşsa hiç render edilmez (sahte doluluk yok). */
function Section({ title, items, tone }: {
  title: string; items: string[]; tone?: 'good' | 'risk' | 'ask';
}) {
  if (!items || items.length === 0) return null;
  return (
    <section className={styles.block}>
      <h4 className={`${styles.blockTitle} ${tone ? styles[`t_${tone}`] : ''}`}>{title}</h4>
      <ul className={styles.list}>
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </section>
  );
}

export function MeetingBriefPanel({ leadId }: Props) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const locale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';
  const [data, setData] = useState<BriefResultDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      setData(await meetingBriefApi.brief(leadId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { void load(); }, [load]);

  const regenerate = async () => {
    if (!leadId) return;
    setBusy(true);
    try {
      const res = await meetingBriefApi.regenerate(leadId);
      setData(res);
      if (res.ok) toast.success(t('clients.brief.regenerated'));
      else toast.error(res.message ?? t('clients.brief.failed'));
    } catch {
      toast.error(t('clients.brief.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!leadId) return null;
  if (loading && !data) return <p className={styles.muted}>{t('common.loading')}</p>;
  if (!data) return null;

  const d = data.dossier;
  const b = data.brief;
  const inbound = d.messages.filter((m) => m.direction === 'inbound').length;

  return (
    <div className={styles.wrap}>
      {/* Üst şerit: dosyanın hacmi + randevu + yenile */}
      <div className={styles.bar}>
        <div className={styles.stats}>
          <span><b>{d.messages.length}</b> {t('clients.brief.messages')}</span>
          <span><b>{inbound}</b> {t('clients.brief.fromClient')}</span>
          {d.scoreHistory.length > 0 && (
            <span><b>{d.scoreHistory[0].score}</b>/100 {t('clients.brief.score')}</span>
          )}
          {d.meetingAt && (
            <span className={styles.meeting}>
              {t('clients.brief.meetingAt')} {new Date(d.meetingAt).toLocaleString(locale)}
            </span>
          )}
        </div>
        <Button size="sm" variant="secondary" disabled={busy} onClick={regenerate}>
          {busy ? t('common.loading') : t('clients.brief.regenerate')}
        </Button>
      </div>

      {/* Bayraklar — dikkat gerektiren durumlar */}
      {d.flags.length > 0 && (
        <ul className={styles.flags}>
          {d.flags.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}

      {/* Motor kapalıysa dürüst uyarı; ham dosya yine de aşağıda */}
      {!data.ok && (
        <p className={styles.engineOff}>{data.message ?? t('clients.brief.engineOff')}</p>
      )}

      {b && (
        <>
          <p className={styles.headline}>{b.headline}</p>
          <p className={styles.who}>{b.whoIsThis}</p>

          {/* Profil özeti — bölgeler ve beklentiler kullanıcının özel isteği */}
          <div className={styles.grid}>
            <div className={styles.cell}>
              <span className={styles.cellLabel}>{t('clients.brief.markets')}</span>
              <span className={styles.cellValue}>
                {b.profileSummary.markets.length > 0 ? b.profileSummary.markets.join(', ') : '—'}
              </span>
            </div>
            <div className={styles.cell}>
              <span className={styles.cellLabel}>{t('clients.brief.regions')}</span>
              <span className={styles.cellValue}>
                {b.profileSummary.regions.length > 0 ? b.profileSummary.regions.join(', ') : '—'}
              </span>
            </div>
            <div className={styles.cell}>
              <span className={styles.cellLabel}>{t('clients.brief.budget')}</span>
              <span className={styles.cellValue}>{b.profileSummary.budget || '—'}</span>
            </div>
            <div className={styles.cell}>
              <span className={styles.cellLabel}>{t('clients.brief.purpose')}</span>
              <span className={styles.cellValue}>{b.profileSummary.purpose || '—'}</span>
            </div>
            <div className={styles.cell}>
              <span className={styles.cellLabel}>{t('clients.brief.timeline')}</span>
              <span className={styles.cellValue}>{b.profileSummary.timeline || '—'}</span>
            </div>
            <div className={styles.cell}>
              <span className={styles.cellLabel}>{t('clients.brief.property')}</span>
              <span className={styles.cellValue}>{b.profileSummary.propertyPreference || '—'}</span>
            </div>
          </div>

          {/* Ne konuşuldu — her konu kendi detayıyla */}
          {b.topicsDiscussed.length > 0 && (
            <section className={styles.block}>
              <h4 className={styles.blockTitle}>{t('clients.brief.topics')}</h4>
              <ul className={styles.topics}>
                {b.topicsDiscussed.map((tp, i) => (
                  <li key={i}>
                    <b>{tp.topic}</b>
                    <span className={styles.topicDetail}>{tp.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Section title={t('clients.brief.expectations')} items={b.expectations} />
          <Section title={t('clients.brief.buyingSignals')} items={b.buyingSignals} tone="good" />
          <Section title={t('clients.brief.riskSignals')} items={b.riskSignals} tone="risk" />
          <Section title={t('clients.brief.openQuestions')} items={b.openQuestions} tone="ask" />
          <Section title={t('clients.brief.agenda')} items={b.suggestedAgenda} />
          <Section title={t('clients.brief.sensitivities')} items={b.sensitivities} tone="risk" />

          {b.scoreRationale && (
            <section className={styles.block}>
              <h4 className={styles.blockTitle}>{t('clients.brief.scoreRationale')}</h4>
              <p className={styles.blockText}>{b.scoreRationale}</p>
            </section>
          )}
        </>
      )}

      {/* Motor kapalıyken bile: CRM'de eksik olanlar → toplantıda sorulacaklar */}
      {!b && data.gaps.length > 0 && (
        <Section
          title={t('clients.brief.openQuestions')}
          items={data.gaps.map((g) => g.question)}
          tone="ask"
        />
      )}

      {data.generatedAt && (
        <p className={styles.footer}>
          {t('clients.brief.generatedAt')} {new Date(data.generatedAt).toLocaleString(locale)}
          {data.cached && ` · ${t('clients.brief.cached')}`}
        </p>
      )}
    </div>
  );
}
