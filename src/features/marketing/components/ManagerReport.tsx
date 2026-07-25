// =====================================================================
// PREI | ManagerReport — pazarlama yöneticisinin haftalık raporu.
//
// Üç şey gösterir: hedeflere NEREDEYİZ, yönetici NE GÖRÜYOR, geçen hafta
// NE OLDU. Bunlar bir "analiz" ile "yönetim" arasındaki farktır.
//
// Yönetici her Pazartesi 08:00'de kendiliğinden çalışır (n8n); buradaki
// düğme elle çalıştırmak içindir.
// =====================================================================
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../core/components/Card/Card';
import { Button } from '../../../core/components/Button/Button';
import { useToast } from '../../../core/components/Toast/ToastProvider';
import { adProposalsApi } from '../../../core/api/resources';
import type { ManagerReportDTO, GoalProgressDTO } from '../../../core/types';
import styles from './ManagerReport.module.css';

const METRIC_LABEL: Record<string, string> = {
  followers: 'Yeni takipçi',
  reach: 'Erişim',
  leads: 'Müşteri adayı',
  profile_views: 'Profil görüntüleme',
  engagement: 'Etkileşen hesap',
};

const nf = new Intl.NumberFormat('tr-TR');

/** Hedef çubuğu — %100'ü geçince yeşil, yolun yarısındaysa mavi, gerideyse amber. */
function GoalBar({ goal }: { goal: GoalProgressDTO }) {
  const pct = goal.progressPct ?? 0;
  const clamped = Math.min(pct, 100);
  const tone = pct >= 100 ? styles.fillGood : pct >= 50 ? styles.fillOk : styles.fillLow;
  return (
    <li className={styles.goalRow}>
      <span className={styles.goalLabel}>{METRIC_LABEL[goal.metric] ?? goal.metric}</span>
      <span className={styles.goalTrack}>
        <span className={`${styles.goalFill} ${tone}`} style={{ width: `${clamped}%` }} />
      </span>
      <span className={styles.goalNums}>
        {nf.format(goal.actual)} / {nf.format(goal.target)}
        {goal.progressPct != null && <b> · %{goal.progressPct.toFixed(0)}</b>}
      </span>
    </li>
  );
}

export function ManagerReport() {
  const { t } = useTranslation();
  const toast = useToast();
  const [report, setReport] = useState<ManagerReportDTO | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      setReport(await adProposalsApi.managerReport());
    } catch {
      /* rapor yoksa sessiz — kart boş durumu gösterir */
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async () => {
    setRunning(true);
    try {
      const res = await adProposalsApi.runManager();
      if (!res.ok) {
        toast.error(res.message ?? t('marketing.manager.runFailed'));
        return;
      }
      toast.success(t('marketing.manager.runDone', { count: res.actionsCreated }));
      await load();
    } catch {
      toast.error(t('marketing.manager.runFailed'));
    } finally {
      setRunning(false);
    }
  };

  const run_ = report?.run;
  const goals = report?.goals ?? [];

  return (
    <Card padding="md">
      <header className={styles.head}>
        <div>
          <h2 className={styles.headTitle}>{t('marketing.manager.title')}</h2>
          <span className={styles.headMeta}>
            {t('marketing.manager.subtitle')}
            {run_ && ` · ${t('marketing.manager.lastRun')} ${run_.runAt.slice(0, 16)}`}
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={run} disabled={running}>
          {running ? t('marketing.manager.running') : t('marketing.manager.run')}
        </Button>
      </header>

      {goals.length > 0 && (
        <section className={styles.block}>
          <h3 className={styles.blockTitle}>{t('marketing.manager.goals')}</h3>
          <ul className={styles.goals}>
            {goals.map((g) => <GoalBar key={`${g.metric}-${g.period}`} goal={g} />)}
          </ul>
        </section>
      )}

      {!run_ ? (
        <p className={styles.empty}>{t('marketing.manager.empty')}</p>
      ) : (
        <>
          <div className={styles.stageRow}>
            <span className={`${styles.stage} ${styles[`stage_${run_.stage}`] ?? ''}`}>
              {t(`marketing.manager.stage.${run_.stage}`)}
            </span>
            <span className={styles.stageHint}>{t(`marketing.manager.stageHint.${run_.stage}`)}</span>
          </div>

          {run_.assessment && (
            <section className={styles.block}>
              <h3 className={styles.blockTitle}>{t('marketing.manager.assessment')}</h3>
              <p className={styles.text}>{run_.assessment}</p>
            </section>
          )}

          {run_.previousReview && (
            <section className={styles.block}>
              <h3 className={styles.blockTitle}>{t('marketing.manager.previousReview')}</h3>
              <p className={styles.text}>{run_.previousReview}</p>
            </section>
          )}

          {run_.warnings.length > 0 && (
            <section className={styles.block}>
              <h3 className={styles.blockTitle}>{t('marketing.manager.warnings')}</h3>
              <ul className={styles.warnings}>
                {run_.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </Card>
  );
}
