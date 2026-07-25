// =====================================================================
// PREI | AdApprovalQueue — AI'nin ürettiği reklam önerileri ve ONAY KAPISI.
//
// Tasarım ilkesi: her butonun PARA sonucunu açıkça yazar. "Yayına al"
// harcamayı başlatan tek düğmedir ve ayrı bir onay ister; diğerleri
// para harcamaz. Bütçe alanı düzenlenebilir — son söz kullanıcınındır.
// =====================================================================
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../core/components/Card/Card';
import { Button } from '../../../core/components/Button/Button';
import { Modal } from '../../../core/components/Modal/Modal';
import { useToast } from '../../../core/components/Toast/ToastProvider';
import { adProposalsApi } from '../../../core/api/resources';
import type { AdProposalDTO } from '../../../core/types';
import styles from './AdApprovalQueue.module.css';

const MARKET_LABEL: Record<string, string> = {
  TR: 'Türkiye', AE: 'Dubai (BAE)', ES: 'İspanya', GB: 'İngiltere',
};

const STATUS_STYLE: Record<string, string> = {
  pending: styles.badgePending,
  approved: styles.badgeApproved,
  rejected: styles.badgeRejected,
  published: styles.badgePublished,
  draft: styles.badgePending,
};

export function AdApprovalQueue() {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState<AdProposalDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detail, setDetail] = useState<AdProposalDTO | null>(null);
  const [budgetInput, setBudgetInput] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await adProposalsApi.list());
    } catch {
      toast.error(t('marketing.ads.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { void load(); }, [load]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await adProposalsApi.analyze();
      if (!res.ok) {
        toast.error(res.message ?? t('marketing.ads.analyzeFailed'));
        return;
      }
      toast.success(t('marketing.ads.analyzeDone', { count: res.proposalsCreated }));
      await load();
    } catch {
      toast.error(t('marketing.ads.analyzeFailed'));
    } finally {
      setAnalyzing(false);
    }
  };

  const openDetail = (p: AdProposalDTO) => {
    setDetail(p);
    setBudgetInput(p.dailyBudget != null ? String(p.dailyBudget) : '');
  };

  const approve = async () => {
    if (!detail) return;
    const raw = budgetInput.trim();
    const budget = raw === '' ? undefined : Number(raw);
    if (budget !== undefined && (!Number.isFinite(budget) || budget < 0)) {
      toast.error(t('marketing.ads.budgetInvalid'));
      return;
    }
    setBusy(detail.id);
    try {
      await adProposalsApi.approve(detail.id, { dailyBudget: budget });
      toast.success(t('marketing.ads.approved'));
      setDetail(null);
      await load();
    } catch {
      toast.error(t('marketing.ads.approveFailed'));
    } finally {
      setBusy(null);
    }
  };

  const act = async (
    id: string, fn: () => Promise<{ ok: boolean; message: string }>, okKey: string,
  ) => {
    setBusy(id);
    try {
      const res = await fn();
      if (res.ok) { toast.success(res.message || t(okKey)); await load(); }
      else toast.error(res.message);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const reject = async (id: string) => {
    setBusy(id);
    try {
      await adProposalsApi.reject(id);
      toast.success(t('marketing.ads.rejected'));
      setDetail(null);
      await load();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card padding="md">
        <header className={styles.head}>
          <div>
            <h2 className={styles.headTitle}>{t('marketing.ads.title')}</h2>
            <span className={styles.headMeta}>{t('marketing.ads.subtitle')}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? t('common.loading') : t('marketing.ads.analyze')}
          </Button>
        </header>
        {/* Para güvenliği sözleşmesi — kullanıcı her zaman görsün. */}
        <p className={styles.safety}>{t('marketing.ads.safetyNote')}</p>

        {loading ? (
          <p className={styles.empty}>{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>{t('marketing.ads.empty')}</p>
        ) : (
          <ul className={styles.list}>
            {items.map((p) => (
              <li key={p.id} className={styles.row}>
                <button type="button" className={styles.rowMain} onClick={() => openDetail(p)}>
                  <span className={styles.rowTitle}>{p.title}</span>
                  <span className={styles.rowMeta}>
                    {p.marketCode ? MARKET_LABEL[p.marketCode] ?? p.marketCode : t('marketing.ads.noMarket')}
                    {p.dailyBudget != null && ` · ${p.dailyBudget} ${p.currency}/${t('marketing.ads.perDay')}`}
                    {p.source === 'ai' && ` · ${t('marketing.ads.byAi')}`}
                  </span>
                </button>

                <span className={`${styles.badge} ${STATUS_STYLE[p.status] ?? ''}`}>
                  {t(`marketing.ads.status.${p.status}`)}
                </span>

                <div className={styles.rowActions}>
                  {p.status === 'approved' && !p.publishedAt && (
                    <Button
                      size="sm" variant="secondary" disabled={busy === p.id}
                      onClick={() => act(p.id, () => adProposalsApi.publish(p.id), 'marketing.ads.published')}
                    >
                      {t('marketing.ads.publish')}
                    </Button>
                  )}
                  {p.publishedAt && p.publishState === 'paused' && (
                    <Button
                      size="sm" variant="primary" disabled={busy === p.id}
                      onClick={() => {
                        if (!window.confirm(t('marketing.ads.activateConfirm'))) return;
                        void act(p.id, () => adProposalsApi.activate(p.id), 'marketing.ads.activated');
                      }}
                    >
                      {t('marketing.ads.activate')}
                    </Button>
                  )}
                  {p.publishState === 'active' && (
                    <Button
                      size="sm" variant="ghost" disabled={busy === p.id}
                      onClick={() => act(p.id, () => adProposalsApi.pause(p.id), 'marketing.ads.paused')}
                    >
                      {t('marketing.ads.pause')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title ?? ''}
        size="lg"
      >
        {detail && (
          <div className={styles.detail}>
            {detail.rationale && (
              <section className={styles.block}>
                <h4 className={styles.blockTitle}>{t('marketing.ads.rationale')}</h4>
                <p className={styles.blockText}>{detail.rationale}</p>
              </section>
            )}

            <section className={styles.block}>
              <h4 className={styles.blockTitle}>{t('marketing.ads.creative')}</h4>
              {detail.primaryText && <p className={styles.adText}>{detail.primaryText}</p>}
              {detail.headline && <p className={styles.adHeadline}>{detail.headline}</p>}
              {detail.description && <p className={styles.blockText}>{detail.description}</p>}
              {detail.creativeBrief && (
                <p className={styles.brief}>
                  <b>{t('marketing.ads.visualBrief')}:</b> {detail.creativeBrief}
                </p>
              )}
            </section>

            {detail.status !== 'published' && (
              <section className={styles.block}>
                <h4 className={styles.blockTitle}>{t('marketing.ads.budget')}</h4>
                <p className={styles.budgetNote}>{t('marketing.ads.budgetNote')}</p>
                <div className={styles.budgetRow}>
                  <input
                    type="number" min={0} step="1"
                    className={styles.budgetInput}
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder={t('marketing.ads.budgetPlaceholder')}
                  />
                  <span className={styles.budgetCur}>{detail.currency} / {t('marketing.ads.perDay')}</span>
                </div>
              </section>
            )}

            <div className={styles.detailActions}>
              {detail.status !== 'published' && (
                <>
                  <Button variant="ghost" disabled={busy === detail.id} onClick={() => reject(detail.id)}>
                    {t('marketing.ads.reject')}
                  </Button>
                  <Button variant="primary" disabled={busy === detail.id} onClick={approve}>
                    {t('marketing.ads.approve')}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
