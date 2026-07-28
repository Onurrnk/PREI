// =====================================================================
// PREI | ProjectAudience — "Bu proje kimlere sunuldu".
//
// Sunulan Ürünler kaydının ters yönü: müşteri kartından projeye
// bakabiliyorduk, burada projeden müşteriye bakıyoruz. Rozet dili
// bilinçli olarak PresentedProperties ile aynı (aynı aşama, aynı renk).
// Salt okuma — aşama değişikliği müşteri kartından yapılır, tek yerden.
// =====================================================================
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Users, CaretRight } from '@phosphor-icons/react';
import type { ProjectAudienceDTO, PresentedStage } from '../../../core/types';
import { projectsApi } from '../../../core/api/resources';
import { useFetch } from '../../../core/hooks/useFetch';
import { EmptyState } from '../../../core/components/EmptyState/EmptyState';
import styles from './ProjectAudience.module.css';

/** Aşama → rozet sınıfı. PresentedProperties ile aynı eşleme. */
const stageClass = (s: PresentedStage): string =>
  s === 'sold' ? styles.stSold
    : s === 'rejected' ? styles.stRejected
    : s === 'contract' || s === 'reserved' ? styles.stLate
    : styles.stEarly;

const money = (v: number | null, cur: string): string =>
  v == null ? '—' : `${new Intl.NumberFormat('tr-TR').format(v)} ${cur}`;

export function ProjectAudience({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, loading } = useFetch<ProjectAudienceDTO>(
    () => projectsApi.audience(projectId, i18n.language), [projectId, i18n.language],
  );

  if (loading) return <p className={styles.muted}>{t('common.loading')}</p>;
  if (!data || data.total === 0) {
    return (
      <EmptyState
        icon={<Users size={22} />}
        title={t('projects.audience.emptyTitle')}
        description={t('projects.audience.emptyDesc')}
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.stats}>
        <span><b>{data.total}</b> {t('projects.audience.presentedCount')}</span>
        {data.sold > 0 && (
          <span className={styles.okText}><b>{data.sold}</b> {t('projects.audience.soldCount')}</span>
        )}
        {data.rejected > 0 && (
          <span className={styles.mutedText}>
            <b>{data.rejected}</b> {t('projects.audience.rejectedCount')}
          </span>
        )}
      </div>

      <div className={styles.list}>
        {data.people.map((p) => (
          <button
            key={p.presentedId}
            type="button"
            className={`${styles.row} ${p.stage === 'rejected' ? styles.dim : ''}`}
            onClick={() => navigate(`/clients/${p.contactId}`)}
            title={t('projects.audience.openClient')}
          >
            <span className={styles.name}>
              {p.name}
              <span className={styles.kind}>
                {p.isCustomer ? t('projects.audience.customer') : t('projects.audience.prospect')}
              </span>
            </span>
            <span className={styles.price}>{money(p.price, p.currency)}</span>
            <span className={`${styles.badge} ${stageClass(p.stage)}`}>{p.stageLabel}</span>
            <CaretRight size={14} className={styles.caret} />
          </button>
        ))}
      </div>
    </div>
  );
}
