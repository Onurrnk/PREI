import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { Field, Input, Select, FormRow } from '../../core/components/Form/Form';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { useFetch } from '../../core/hooks/useFetch';
import { marketingApi } from '../../core/api/resources';
import type { MarketingSummaryDTO, MarketingTimeframe, CreateAdSpendInput } from '../../core/types';
import {
  TrendUp, TrendDown, ChatCircle, WhatsappLogo, TelegramLogo, InstagramLogo,
  Plus, UploadSimple, Trash, Info, ArrowsClockwise,
} from '@phosphor-icons/react';
import { FunnelSteps, ComboSpend, DonutMetric, Sparkline, fmtEUR } from '../../core/charts';
import { parseAdSpendCsv } from './marketing-csv';
import styles from './Marketing.module.css';

const MARKETS = ['TR', 'AE', 'ES', 'GB', 'TH', 'DE'];
const CHANNELS = ['meta', 'instagram', 'google', 'other'];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'TRY'];

const scoreClass = (score: number): string =>
  score >= 75 ? 'scoreHigh' : score >= 50 ? 'scoreMid' : 'scoreLow';

const num = (v: number | null, suffix = ''): string => (v == null ? '—' : `${v}${suffix}`);

function relTime(iso: string | null, lang: string): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return '';
  const mins = Math.floor(diffMs / 60_000);
  const tr = lang === 'tr';
  if (mins < 60) return `${mins}${tr ? 'dk' : 'm'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${tr ? 'sa' : 'h'}`;
  const days = Math.floor(hrs / 24);
  return `${days}${tr ? 'g' : 'd'}`;
}

const channelIcon = (channel: string | null): React.ReactNode => {
  switch (channel) {
    case 'telegram': return <TelegramLogo size={18} />;
    case 'instagram': return <InstagramLogo size={18} />;
    case 'whatsapp': return <WhatsappLogo size={18} />;
    default: return <ChatCircle size={18} />;
  }
};

const emptyForm: CreateAdSpendInput = {
  name: '', marketCode: 'AE', channel: 'meta', status: 'active',
  periodStart: '', periodEnd: '', spend: 0, currency: 'EUR',
  impressions: undefined, clicks: undefined, campaignRef: undefined,
};

export const Marketing: React.FC = () => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [timeframe, setTimeframe] = useState<MarketingTimeframe>('30D');
  const { data, refetch } = useFetch<MarketingSummaryDTO>(() => marketingApi.summary(timeframe), [timeframe]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateAdSpendInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const kpis = useMemo(() => {
    const k = data?.kpis;
    return [
      { id: 'spend', labelKey: 'marketing.kpi.adSpend', value: k ? fmtEUR(k.adSpendEur) : '—', delta: k?.adSpendDeltaPct ?? null, spark: k?.spendSpark ?? [] },
      { id: 'cpl', labelKey: 'marketing.kpi.avgCpl', value: k?.avgCplEur != null ? `€${k.avgCplEur.toFixed(1)}` : '—', delta: k?.avgCplDeltaPct ?? null, spark: k?.cplSpark ?? [], invert: true },
      { id: 'qualified', labelKey: 'marketing.kpi.convQualified', value: k ? `${k.convQualifiedPct.toFixed(1)}%` : '—', delta: k?.convQualifiedDeltaPct ?? null, spark: k?.qualifiedSpark ?? [] },
      { id: 'roas', labelKey: 'marketing.kpi.roasCommission', value: k?.roas != null ? `${k.roas.toFixed(1)}x` : '—', delta: k?.roasDeltaPct ?? null, spark: k?.roasSpark ?? [] },
    ];
  }, [data]);

  const funnel = useMemo(() => {
    const f = data?.funnel;
    return [
      { label: t('marketing.funnel.impressions'), value: f?.impressions ?? 0 },
      { label: t('marketing.funnel.ctwaClicks'), value: f?.ctwaClicks ?? 0 },
      { label: t('marketing.funnel.conversations'), value: f?.conversations ?? 0 },
      { label: t('marketing.funnel.qualified'), value: f?.qualified ?? 0 },
      { label: t('marketing.funnel.meetings'), value: f?.meetings ?? 0 },
      { label: t('marketing.funnel.closedWon'), value: f?.closedWon ?? 0 },
    ];
  }, [data, t]);

  const weekly = useMemo(
    () => (data?.weeklySpendCpl ?? []).map((w) => ({ label: w.label, bar: w.spendEur, line: w.cpl ?? 0 })),
    [data],
  );
  const spendByMarket = useMemo(() => (data?.spendByMarket ?? []).map((m) => ({ name: m.name, value: m.valueEur })), [data]);
  const marketTotal = useMemo(() => spendByMarket.reduce((s, m) => s + m.value, 0), [spendByMarket]);
  const campaigns = data?.campaigns ?? [];
  const conversations = data?.conversations ?? [];

  const setF = (patch: Partial<CreateAdSpendInput>) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.periodStart || !form.periodEnd) {
      toast.error(t('marketing.form.required'));
      return;
    }
    setSaving(true);
    try {
      await marketingApi.create({
        ...form,
        campaignRef: form.campaignRef?.trim() || undefined,
        impressions: form.impressions || undefined,
        clicks: form.clicks || undefined,
      });
      toast.success(t('marketing.form.saved'));
      setModalOpen(false);
      setForm(emptyForm);
      refetch();
    } catch (e) {
      toast.error(`${t('marketing.form.saveError')}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    const { rows, errors } = parseAdSpendCsv(text);
    if (rows.length === 0) {
      toast.error(errors[0] ?? t('marketing.csv.noRows'));
      return;
    }
    try {
      const res = await marketingApi.import(rows);
      toast.success(t('marketing.csv.imported', { count: res.imported }));
      if (errors.length > 0) toast.error(t('marketing.csv.errorsTitle', { count: errors.length }));
      refetch();
    } catch (e) {
      toast.error(`${t('marketing.csv.importError')}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleMetaSync = async () => {
    setSyncing(true);
    try {
      const r = await marketingApi.syncMeta();
      if (!r.configured) {
        toast.error(t('marketing.meta.notConfigured'));
      } else {
        toast.success(t('marketing.meta.synced', { campaigns: r.campaigns, rows: r.rows }));
        refetch();
      }
    } catch (e) {
      toast.error(`${t('marketing.meta.error')}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await marketingApi.remove(id);
      toast.success(t('marketing.form.deleted'));
      refetch();
    } catch (e) {
      toast.error(`${t('marketing.form.deleteError')}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('marketing.title')}</h1>
          <p className={styles.subtitle}>{t('marketing.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.timeframeSelect}>
            <SelectMenu
              aria-label="Timeframe"
              value={timeframe}
              onChange={(v) => setTimeframe(v as MarketingTimeframe)}
              options={[
                { value: '30D', label: t('marketing.timeframeSel.d30') },
                { value: '90D', label: t('marketing.timeframeSel.d90') },
                { value: 'YTD', label: t('marketing.timeframeSel.ytd') },
                { value: '1Y', label: t('marketing.timeframeSel.y1') },
              ]}
            />
          </div>
          <Button variant="outline" onClick={handleMetaSync} disabled={syncing}>
            <ArrowsClockwise size={16} /> {syncing ? t('marketing.meta.syncing') : t('marketing.toolbar.metaSync')}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <UploadSimple size={16} /> {t('marketing.toolbar.importCsv')}
          </Button>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus size={16} /> {t('marketing.toolbar.addCampaign')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Kaynak notu — harcamanın elle/CSV, huninin gerçek CRM olduğu şeffaf */}
      <div className={styles.sourceNote}>
        <Info size={15} />
        <span>{t('marketing.sourceNote')}</span>
      </div>

      {/* Boş durum — hiç harcama girilmemişse yönlendirme */}
      {data && !data.hasSpendData && (
        <Card padding="lg">
          <div className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>{t('marketing.empty.title')}</h2>
            <p className={styles.emptyBody}>{t('marketing.empty.body')}</p>
            <div className={styles.emptyActions}>
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                <Plus size={16} /> {t('marketing.toolbar.addCampaign')}
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <UploadSimple size={16} /> {t('marketing.toolbar.importCsv')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* KPI şeridi */}
      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => {
          const positive = 'invert' in kpi && kpi.invert ? (kpi.delta ?? 0) < 0 : (kpi.delta ?? 0) > 0;
          return (
            <Card key={kpi.id} padding="md">
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>{t(kpi.labelKey)}</span>
                <div className={styles.kpiValueRow}>
                  <span className={styles.kpiValue}>{kpi.value}</span>
                  {kpi.delta != null && (
                    <span className={`${styles.kpiDelta} ${positive ? styles.deltaUp : styles.deltaDown}`}>
                      {kpi.delta > 0 ? <TrendUp size={14} /> : <TrendDown size={14} />}
                      {Math.abs(kpi.delta).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className={styles.kpiSpark}>
                  <Sparkline data={kpi.spark.length ? kpi.spark : [0, 0]} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Funnel + Harcama/CPL */}
      <div className={styles.mainGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('marketing.funnel.title')}</h2>
            <span className={styles.cardMeta}>{t('marketing.funnel.meta')}</span>
          </div>
          <FunnelSteps steps={funnel} />
        </Card>

        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('marketing.spendVsCpl.title')}</h2>
            <span className={styles.cardMeta}>{t('marketing.spendVsCpl.meta')}</span>
          </div>
          <ComboSpend
            data={weekly}
            barName={t('marketing.spendVsCpl.barName')}
            lineName={t('marketing.spendVsCpl.lineName')}
            formatBar={fmtEUR}
            formatLine={(v) => `€${v}`}
            height={264}
          />
        </Card>
      </div>

      {/* Kampanya tablosu */}
      <Card padding="none">
        <CardHeader>
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('marketing.campaignPerformance')}</h2>
            <span className={styles.cardMeta}>{t('marketing.attributionHint')}</span>
          </div>
        </CardHeader>
        <CardBody padding="none">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>{t('marketing.table.campaign')}</TableHeader>
                <TableHeader>{t('marketing.table.market')}</TableHeader>
                <TableHeader>{t('marketing.table.status')}</TableHeader>
                <TableHeader align="right">{t('marketing.table.spend')}</TableHeader>
                <TableHeader align="right">{t('marketing.table.leads')}</TableHeader>
                <TableHeader align="right">{t('marketing.table.qualified')}</TableHeader>
                <TableHeader align="right">{t('marketing.table.cpl')}</TableHeader>
                <TableHeader align="right">{t('marketing.table.closed')}</TableHeader>
                <TableHeader align="right">{t('marketing.table.roas')}</TableHeader>
                <TableHeader align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell style={{ fontWeight: 500 }}>{c.name}</TableCell>
                  <TableCell>{c.market ? <span className={styles.marketChip}>{c.market}</span> : '—'}</TableCell>
                  <TableCell>
                    <span className={`${styles.statusChip} ${c.status === 'active' ? styles.statusActive : ''}`}>
                      {c.status === 'active' ? t('marketing.status.active') : t('marketing.status.paused')}
                    </span>
                  </TableCell>
                  <TableCell align="right"><span className={styles.numCell}>{fmtEUR(c.spendEur)}</span></TableCell>
                  <TableCell align="right"><span className={styles.numCell}>{num(c.leads)}</span></TableCell>
                  <TableCell align="right"><span className={styles.numCell}>{num(c.qualified)}</span></TableCell>
                  <TableCell align="right"><span className={styles.numCell}>{c.cpl != null ? `€${c.cpl.toFixed(1)}` : '—'}</span></TableCell>
                  <TableCell align="right"><span className={styles.numCell}>{num(c.closed)}</span></TableCell>
                  <TableCell align="right">
                    <span className={`${styles.numCell} ${c.roas != null && c.roas >= 4 ? styles.roasStrong : ''}`}>
                      {c.roas != null ? `${c.roas.toFixed(1)}x` : '—'}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <button className={styles.rowDelete} onClick={() => handleDelete(c.id)} aria-label={t('common.delete')}>
                      <Trash size={15} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10}>
                    <span className={styles.tableEmpty}>{t('common.noResults')}</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Pazar dağılımı + Eylül konuşmaları */}
      <div className={styles.bottomGrid}>
        <Card padding="md">
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{t('marketing.spendByMarket')}</h2>
          </div>
          <DonutMetric
            data={spendByMarket}
            centerValue={fmtEUR(marketTotal)}
            centerLabel={t('marketing.last30Days')}
            formatValue={fmtEUR}
            height={176}
          />
        </Card>

        <Card padding="none" className={styles.convCard}>
          <CardHeader>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>
                <ChatCircle size={16} className={styles.titleIcon} /> {t('marketing.liveConversations')}
              </h2>
              <span className={styles.cardMeta}>{t('marketing.aiQualifier')}</span>
            </div>
          </CardHeader>
          <CardBody padding="none">
            <div className={styles.convList}>
              {conversations.map((cv) => (
                <div key={cv.id} className={styles.convItem}>
                  <span className={styles.convChannel}>{channelIcon(cv.channel)}</span>
                  <div className={styles.convBody}>
                    <div className={styles.convTop}>
                      <span className={styles.convName}>{cv.name}</span>
                      {cv.market && <span className={styles.marketChip}>{cv.market}</span>}
                      <span className={styles.convTime}>{relTime(cv.lastActivityAt, i18n.language)}</span>
                    </div>
                    <p className={styles.convSnippet}>{cv.snippet ?? '—'}</p>
                  </div>
                  {cv.score != null && (
                    <span className={`${styles.scoreChip} ${styles[scoreClass(cv.score)]}`}>{cv.score}</span>
                  )}
                </div>
              ))}
              {conversations.length === 0 && (
                <div className={styles.convItem}><span className={styles.tableEmpty}>{t('common.noResults')}</span></div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Kampanya ekle modalı */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('marketing.form.addTitle')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </>
        }
      >
        <Field label={t('marketing.form.name')}>
          <Input value={form.name} placeholder={t('marketing.form.namePh')} onChange={(e) => setF({ name: e.target.value })} />
        </Field>
        <FormRow>
          <Field label={t('marketing.form.market')}>
            <Select value={form.marketCode} onChange={(e) => setF({ marketCode: e.target.value })}>
              {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label={t('marketing.form.channel')}>
            <Select value={form.channel} onChange={(e) => setF({ channel: e.target.value })}>
              {CHANNELS.map((c) => <option key={c} value={c}>{t(`marketing.channelOpt.${c}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('marketing.form.statusLabel')}>
            <Select value={form.status} onChange={(e) => setF({ status: e.target.value })}>
              <option value="active">{t('marketing.status.active')}</option>
              <option value="paused">{t('marketing.status.paused')}</option>
            </Select>
          </Field>
        </FormRow>
        <FormRow>
          <Field label={t('marketing.form.periodStart')}>
            <Input type="date" value={form.periodStart} onChange={(e) => setF({ periodStart: e.target.value })} />
          </Field>
          <Field label={t('marketing.form.periodEnd')}>
            <Input type="date" value={form.periodEnd} onChange={(e) => setF({ periodEnd: e.target.value })} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label={t('marketing.form.spend')}>
            <Input type="number" min={0} step="0.01" value={form.spend} onChange={(e) => setF({ spend: Number(e.target.value) })} />
          </Field>
          <Field label={t('marketing.form.currency')}>
            <Select value={form.currency} onChange={(e) => setF({ currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </FormRow>
        <FormRow>
          <Field label={t('marketing.form.impressions')}>
            <Input type="number" min={0} value={form.impressions ?? ''} onChange={(e) => setF({ impressions: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <Field label={t('marketing.form.clicks')}>
            <Input type="number" min={0} value={form.clicks ?? ''} onChange={(e) => setF({ clicks: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
        </FormRow>
        <Field label={t('marketing.form.campaignRef')}>
          <Input value={form.campaignRef ?? ''} onChange={(e) => setF({ campaignRef: e.target.value })} />
        </Field>
      </Modal>
    </div>
  );
};
