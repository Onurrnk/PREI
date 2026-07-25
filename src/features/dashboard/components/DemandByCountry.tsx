// =====================================================================
// PREI | DemandByCountry — hangi ülkeye kaç talep var.
//
// Komuta Merkezi'ndeki "Müşteri Coğrafyası" kartıyla KARIŞTIRILMAMALI:
// o kart müşterinin NEREDEN olduğunu gösterir, bu kart NEREYE yatırım
// yapmak istediğini. İkisi farklı eksen; Türk müşteri Dubai isteyebilir.
//
// Kaynak: investment_targets (003g) — ülke ISO kodlu, sorgulanabilir.
// =====================================================================
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../core/components/Card/Card';
import { EmptyState } from '../../../core/components/EmptyState/EmptyState';
import { useFetch } from '../../../core/hooks/useFetch';
import { contactsApi } from '../../../core/api/resources';
import { Target } from '@phosphor-icons/react';
import styles from './DemandByCountry.module.css';

export interface DemandRow {
  countryCode: string;
  countryName: string;
  /** İngilizce ad — arayüz dili EN iken kullanılır. */
  countryNameEn?: string;
  contacts: number;
  regions: string[];
}

const flagOf = (code: string): string =>
  /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
    : '🌐';

/** En çok talep alan ülkeye göre oransal bar genişliği (min %6 görünür kalsın). */
export function barWidth(contacts: number, max: number): string {
  if (max <= 0) return '0%';
  return `${Math.max(6, Math.round((contacts / max) * 100))}%`;
}

export const DemandByCountry: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const { data } = useFetch<DemandRow[]>(() => contactsApi.investmentSummary(), []);
  const rows = data ?? [];
  const max = rows.reduce((m, r) => Math.max(m, r.contacts), 0);
  const totalPeople = rows.reduce((s, r) => s + r.contacts, 0);

  return (
    <Card padding="md">
      <div className={styles.titleRow}>
        <h2 className={styles.title}>
          <Target size={16} className={styles.titleIcon} /> {t('dashboard.demand.title')}
        </h2>
        {rows.length > 0 && (
          <span className={styles.meta}>
            {t('dashboard.demand.meta', { countries: rows.length, people: totalPeople })}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            icon={<Target size={24} weight="duotone" />}
            title={t('dashboard.demand.emptyTitle')}
            description={t('dashboard.demand.emptyDesc')}
          />
        </div>
      ) : (
        <ul className={styles.list}>
          {rows.map((r) => (
            <li key={r.countryCode} className={styles.row}>
              <div className={styles.head}>
                <span className={styles.flag}>{flagOf(r.countryCode)}</span>
                <span className={styles.country}>
                  {isEn ? (r.countryNameEn ?? r.countryName) : r.countryName}
                </span>
                <span className={styles.count}>
                  {t('dashboard.demand.people', { count: r.contacts })}
                </span>
              </div>
              <div className={styles.track}>
                <div className={styles.bar} style={{ width: barWidth(r.contacts, max) }} />
              </div>
              {/* Bölgeler: danışman "İspanya'da tam olarak nerede" bilsin. */}
              {r.regions.length > 0 && (
                <span className={styles.regions}>{r.regions.join(' · ')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
