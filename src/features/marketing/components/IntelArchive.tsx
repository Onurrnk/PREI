// =====================================================================
// PREI | IntelArchive — haftalık istihbarat raporu arşivi.
//
// Onur'un kullanımı: rapor müşteriye GİTMEZ. İki işi var —
//   1) bilgi bankası ("İspanya'da geçen çeyrek ne olmuş")
//   2) sosyal medya içerik kaynağı (post/video için haber çıkarma)
//
// Bu yüzden üç bölüm: yükleme, arama, içerik kuyruğu.
// Spekülatif kalemler AYRI işaretlenir — doğrulanmamış bir iddia
// "haber" gibi paylaşılmasın.
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../core/components/Card/Card';
import { Button } from '../../../core/components/Button/Button';
import { useToast } from '../../../core/components/Toast/ToastProvider';
import { intelApi } from '../../../core/api/resources';
import type { IntelItemDTO, IntelReportSummaryDTO, IntelSearchHitDTO } from '../../../core/types';
import styles from './IntelArchive.module.css';

const MARKET_LABEL: Record<string, string> = {
  TR: 'Türkiye', AE: 'BAE', ES: 'İspanya', GB: 'İngiltere',
  NL: 'Hollanda', DE: 'Almanya', TH: 'Tayland', GLOBAL: 'Global',
};

const FORMAT_LABEL: Record<string, string> = {
  reel: 'Reels', carousel: 'Karusel', single_image: 'Tek görsel',
  story: 'Story', video: 'Video',
};

const STATUS_NEXT: Record<string, IntelItemDTO['status']> = {
  new: 'queued', queued: 'published', published: 'new', skipped: 'new',
};

export function IntelArchive() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const locale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';
  const fileRef = useRef<HTMLInputElement>(null);

  const [reports, setReports] = useState<IntelReportSummaryDTO[]>([]);
  const [items, setItems] = useState<IntelItemDTO[]>([]);
  const [hits, setHits] = useState<IntelSearchHitDTO[] | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, i] = await Promise.all([
        intelApi.list(),
        intelApi.items({ status: statusFilter || undefined, market: marketFilter || undefined }),
      ]);
      setReports(r);
      setItems(i);
    } catch {
      setReports([]);
      setItems([]);
    }
  }, [statusFilter, marketFilter]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const res = await intelApi.upload(file);
      toast.success(t('marketing.intel.uploaded', {
        sections: res.sectionCount, items: res.itemCount,
      }));
      setHits(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message || t('marketing.intel.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) { setHits(null); return; }
    try {
      setHits(await intelApi.search(q, marketFilter || undefined));
    } catch {
      toast.error(t('marketing.intel.searchFailed'));
    }
  };

  const cycleStatus = async (item: IntelItemDTO) => {
    setBusy(item.id);
    try {
      const next = STATUS_NEXT[item.status] ?? 'new';
      const updated = await intelApi.updateItem(item.id, next);
      setItems((prev) => prev.map((x) => (x.id === item.id ? updated : x)));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const skip = async (item: IntelItemDTO) => {
    setBusy(item.id);
    try {
      const updated = await intelApi.updateItem(item.id, 'skipped');
      setItems((prev) => prev.map((x) => (x.id === item.id ? updated : x)));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const markets = [...new Set(reports.flatMap((r) => r.markets))].sort();

  return (
    <Card padding="md">
      <header className={styles.head}>
        <div>
          <h2 className={styles.headTitle}>{t('marketing.intel.title')}</h2>
          <span className={styles.headMeta}>{t('marketing.intel.subtitle')}</span>
        </div>
        <div className={styles.headActions}>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.txt,.md"
            className={styles.hiddenFile}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          />
          <Button
            size="sm" variant="secondary" disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? t('common.loading') : t('marketing.intel.upload')}
          </Button>
        </div>
      </header>

      <p className={styles.note}>{t('marketing.intel.note')}</p>

      {/* Bilgi bankası araması */}
      <div className={styles.searchRow}>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
          placeholder={t('marketing.intel.searchPlaceholder')}
        />
        <select
          className={styles.select}
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
        >
          <option value="">{t('marketing.intel.allMarkets')}</option>
          {markets.map((m) => (
            <option key={m} value={m}>{MARKET_LABEL[m] ?? m}</option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={search}>
          {t('marketing.intel.search')}
        </Button>
        {hits && (
          <Button size="sm" variant="ghost" onClick={() => { setHits(null); setQuery(''); }}>
            {t('marketing.intel.clearSearch')}
          </Button>
        )}
      </div>

      {/* Arama sonuçları — hangi raporun hangi bölümünde */}
      {hits && (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>
            {t('marketing.intel.searchResults', { count: hits.length })}
          </h4>
          {hits.length === 0 ? (
            <p className={styles.empty}>{t('marketing.intel.noHits')}</p>
          ) : (
            <ul className={styles.hits}>
              {hits.map((h, i) => (
                <li key={`${h.reportId}-${i}`} className={styles.hit}>
                  <span className={styles.hitMeta}>
                    {new Date(h.reportDate).toLocaleDateString(locale)}
                    {h.sectionHeading && ` · ${h.sectionHeading}`}
                  </span>
                  <span className={styles.hitSnippet}>{h.snippet}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Arşiv listesi */}
      {!hits && (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>{t('marketing.intel.archive')}</h4>
          {reports.length === 0 ? (
            <p className={styles.empty}>{t('marketing.intel.archiveEmpty')}</p>
          ) : (
            <ul className={styles.reports}>
              {reports.map((r) => (
                <li key={r.id} className={styles.report}>
                  <span className={styles.reportTitle}>{r.title}</span>
                  <span className={styles.reportMeta}>
                    {r.periodStart && r.periodEnd
                      ? `${new Date(r.periodStart).toLocaleDateString(locale)} – ${new Date(r.periodEnd).toLocaleDateString(locale)}`
                      : new Date(r.reportDate).toLocaleDateString(locale)}
                    {' · '}{t('marketing.intel.sections', { count: r.sectionCount })}
                    {' · '}{t('marketing.intel.newsItems', { count: r.itemCount })}
                  </span>
                  <span className={styles.chips}>
                    {r.markets.map((m) => (
                      <span key={m} className={styles.chip}>{MARKET_LABEL[m] ?? m}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Sosyal medya içerik kuyruğu */}
      <section className={styles.block}>
        <div className={styles.queueHead}>
          <h4 className={styles.blockTitle}>{t('marketing.intel.contentQueue')}</h4>
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t('marketing.intel.allStatuses')}</option>
            <option value="new">{t('marketing.intel.status.new')}</option>
            <option value="queued">{t('marketing.intel.status.queued')}</option>
            <option value="published">{t('marketing.intel.status.published')}</option>
            <option value="skipped">{t('marketing.intel.status.skipped')}</option>
          </select>
        </div>

        {items.length === 0 ? (
          <p className={styles.empty}>{t('marketing.intel.queueEmpty')}</p>
        ) : (
          <ul className={styles.items}>
            {items.map((it) => (
              <li key={it.id} className={`${styles.item} ${it.isSpeculative ? styles.speculative : ''}`}>
                <div className={styles.itemBody}>
                  <span className={styles.itemHeadline}>{it.headline}</span>
                  <span className={styles.itemMeta}>
                    {it.marketCode && (
                      <span className={styles.chip}>{MARKET_LABEL[it.marketCode] ?? it.marketCode}</span>
                    )}
                    {it.suggestedFormat && (
                      <span className={styles.chipFormat}>{FORMAT_LABEL[it.suggestedFormat] ?? it.suggestedFormat}</span>
                    )}
                    {it.isSpeculative && (
                      <span className={styles.specBadge}>{t('marketing.intel.speculative')}</span>
                    )}
                    {it.section && <span className={styles.itemSection}>{it.section}</span>}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={`${styles.statusBtn} ${styles[`st_${it.status}`]}`}
                    disabled={busy === it.id}
                    onClick={() => cycleStatus(it)}
                    title={t('marketing.intel.cycleHint')}
                  >
                    {t(`marketing.intel.status.${it.status}`)}
                  </button>
                  {it.status !== 'skipped' && (
                    <button
                      type="button" className={styles.skipBtn}
                      disabled={busy === it.id} onClick={() => skip(it)}
                    >
                      {t('marketing.intel.skip')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}
