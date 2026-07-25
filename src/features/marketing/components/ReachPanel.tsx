// =====================================================================
// PREI | ReachPanel — Meta'dan otomatik gelen görünürlük metrikleri ve
// kitle kırılımı. Takipçi sayısı tek başına yanıltıcıdır; erişim, profil
// görüntüleme ve etkileşen hesap işin gerçek nabzıdır.
//
// Tüm veri otomatik senkrondan gelir — elle giriş YOK.
// =====================================================================
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../core/components/Card/Card';
import type { SocialSummaryDTO } from '../../../core/types';
import styles from './ReachPanel.module.css';

const FLAG: Record<string, string> = {
  TR: '🇹🇷', DE: '🇩🇪', NL: '🇳🇱', BE: '🇧🇪', GB: '🇬🇧', AE: '🇦🇪',
  ES: '🇪🇸', US: '🇺🇸', RU: '🇷🇺', EG: '🇪🇬', RS: '🇷🇸', CH: '🇨🇭',
  TH: '🇹🇭', FR: '🇫🇷', IT: '🇮🇹', AZ: '🇦🇿', KZ: '🇰🇿',
};

const GENDER_LABEL: Record<string, string> = { M: 'Erkek', F: 'Kadın', U: 'Belirtilmemiş' };

const nf = new Intl.NumberFormat('tr-TR');

/** Değişim rozeti — veri yoksa "—", yanıltıcı sıfır göstermeyiz. */
function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className={styles.deltaNeutral}>—</span>;
  const up = pct >= 0;
  return (
    <span className={up ? styles.deltaUp : styles.deltaDown}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

interface Props {
  social: SocialSummaryDTO | null;
}

export function ReachPanel({ social }: Props) {
  const { t } = useTranslation();

  const grouped = useMemo(() => {
    const map = new Map<string, { bucket: string; value: number }[]>();
    for (const a of social?.audience ?? []) {
      if (!map.has(a.dimension)) map.set(a.dimension, []);
      map.get(a.dimension)!.push({ bucket: a.bucket, value: a.value });
    }
    return map;
  }, [social?.audience]);

  const countries = grouped.get('country') ?? [];
  const cities = grouped.get('city') ?? [];
  const ages = grouped.get('age') ?? [];
  const genders = grouped.get('gender') ?? [];
  const totalAudience = countries.reduce((s, c) => s + c.value, 0);

  const r = social?.reach30d;
  const hasReach = !!r && (r.reach > 0 || r.profileViews > 0 || r.accountsEngaged > 0);
  const hasAudience = countries.length > 0 || ages.length > 0;

  if (!social) return null;

  return (
    <div className={styles.wrap}>
      <Card padding="md">
        <header className={styles.head}>
          <h2 className={styles.headTitle}>{t('marketing.reach.title')}</h2>
          <span className={styles.headMeta}>{t('marketing.reach.subtitle')}</span>
        </header>
        {hasReach ? (
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>{t('marketing.reach.reach')}</span>
              <strong className={styles.metricValue}>{nf.format(r!.reach)}</strong>
              <Delta pct={r!.reachDeltaPct} />
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>{t('marketing.reach.profileViews')}</span>
              <strong className={styles.metricValue}>{nf.format(r!.profileViews)}</strong>
              <Delta pct={r!.profileViewsDeltaPct} />
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>{t('marketing.reach.engaged')}</span>
              <strong className={styles.metricValue}>{nf.format(r!.accountsEngaged)}</strong>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>{t('marketing.reach.clicks')}</span>
              <strong className={styles.metricValue}>{nf.format(r!.websiteClicks)}</strong>
            </div>
          </div>
        ) : (
          <p className={styles.empty}>{t('marketing.reach.noActivity')}</p>
        )}
      </Card>

      <Card padding="md">
        <header className={styles.head}>
          <h2 className={styles.headTitle}>{t('marketing.audience.title')}</h2>
          <span className={styles.headMeta}>{t('marketing.audience.subtitle')}</span>
        </header>
        {!hasAudience ? (
          <p className={styles.empty}>{t('marketing.audience.empty')}</p>
        ) : (
          <div className={styles.audienceGrid}>
            {countries.length > 0 && (
              <section>
                <h4 className={styles.secTitle}>{t('marketing.audience.countries')}</h4>
                <ul className={styles.bars}>
                  {countries.slice(0, 6).map((c) => (
                    <li key={c.bucket} className={styles.barRow}>
                      <span className={styles.barLabel}>
                        {FLAG[c.bucket] ?? '🏳️'} {c.bucket}
                      </span>
                      <span className={styles.barTrack}>
                        <span
                          className={styles.barFillBlue}
                          style={{ width: `${totalAudience > 0 ? (c.value / totalAudience) * 100 : 0}%` }}
                        />
                      </span>
                      <span className={styles.barValue}>{c.value}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {cities.length > 0 && (
              <section>
                <h4 className={styles.secTitle}>{t('marketing.audience.cities')}</h4>
                <ul className={styles.chips}>
                  {cities.slice(0, 6).map((c) => (
                    <li key={c.bucket} className={styles.chip}>
                      {/* Meta "Istanbul, Istanbul Province" döner — ili kırp */}
                      {c.bucket.split(',')[0]} <b>{c.value}</b>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {ages.length > 0 && (
              <section>
                <h4 className={styles.secTitle}>{t('marketing.audience.age')}</h4>
                <ul className={styles.bars}>
                  {ages.map((a) => {
                    const max = Math.max(...ages.map((x) => x.value), 1);
                    return (
                      <li key={a.bucket} className={styles.barRow}>
                        <span className={styles.barLabel}>{a.bucket}</span>
                        <span className={styles.barTrack}>
                          <span className={styles.barFillGreen} style={{ width: `${(a.value / max) * 100}%` }} />
                        </span>
                        <span className={styles.barValue}>{a.value}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {genders.length > 0 && (
              <section>
                <h4 className={styles.secTitle}>{t('marketing.audience.gender')}</h4>
                <ul className={styles.chips}>
                  {genders.map((g) => (
                    <li key={g.bucket} className={styles.chip}>
                      {GENDER_LABEL[g.bucket] ?? g.bucket} <b>{g.value}</b>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
