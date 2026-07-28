// =====================================================================
// PREI | Sunulan Ürünler — "bu müşteriye ne sunduk, ne sunmadık".
//
// İki kaynak tek listede:
//   · İç proje  → katalogdan seçilir (Proje Zekâsı'ndaki projeler)
//   · Dış ilan  → katalogda olmayan her şey: başlık + ilan no + link +
//                 özellikler (sahibinden, Bayut, geliştirici sitesi…)
//
// Her satırın bir AŞAMASI var: Sunuldu → İlgilendi → Teklif → Rezerve →
// Sözleşme → Satış tamamlandı (ve yan yol: Beğenmedi). "Satış tamamlandı"
// seçilince backend gerçek anlaşma (deal) kaydı açar; Komuta Merkezi'ndeki
// "Kapanan Satış" oradan beslenir.
// =====================================================================
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PresentedDTO, PresentedStage, ProjectDTO } from '../../../core/types';
import { clientsApi, projectsApi } from '../../../core/api/resources';
import { useFetch } from '../../../core/hooks/useFetch';
import { useToast } from '../../../core/components/Toast/ToastProvider';
import { Button } from '../../../core/components/Button/Button';
import { SelectMenu } from '../../../core/components/Form/SelectMenu';
import { Field, Input, Textarea, FormRow } from '../../../core/components/Form/Form';
import { EmptyState } from '../../../core/components/EmptyState/EmptyState';
import {
  Buildings, LinkSimple, Plus, Trash, PencilSimple, Storefront,
} from '@phosphor-icons/react';
import styles from './PresentedProperties.module.css';

const STAGES: PresentedStage[] = [
  'presented', 'interested', 'offer', 'reserved', 'contract', 'sold', 'rejected',
];

/** Aşama → rozet sınıfı. Satış yeşil, elenen soluk, ara aşamalar mor tonları. */
const stageClass = (s: PresentedStage): string =>
  s === 'sold' ? styles.stSold
    : s === 'rejected' ? styles.stRejected
    : s === 'contract' || s === 'reserved' ? styles.stLate
    : styles.stEarly;

interface FormValue {
  mode: 'project' | 'listing';
  propertyId: string;
  externalTitle: string;
  externalListingNo: string;
  externalUrl: string;
  externalSource: string;
  location: string;
  features: string;
  price: string;
  currency: string;
  stage: PresentedStage;
  notes: string;
}

const emptyForm: FormValue = {
  mode: 'project', propertyId: '', externalTitle: '', externalListingNo: '',
  externalUrl: '', externalSource: '', location: '', features: '',
  price: '', currency: 'EUR', stage: 'presented', notes: '',
};

export const PresentedProperties: React.FC<{ clientId: string }> = ({ clientId }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { data, loading, refetch } = useFetch<PresentedDTO[]>(
    () => clientsApi.presented(clientId), [clientId],
  );
  const items = data ?? [];
  // Katalog projeleri — "iç proje" seçimi için.
  const { data: projectsData } = useFetch<ProjectDTO[]>(() => projectsApi.list(), []);
  const projects = projectsData ?? [];

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValue>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const set = (p: Partial<FormValue>) => setForm((f) => ({ ...f, ...p }));

  const startAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };

  const startEdit = (it: PresentedDTO) => {
    setEditId(it.id);
    setForm({
      mode: it.source === 'project' ? 'project' : 'listing',
      propertyId: it.propertyId ?? '',
      externalTitle: it.source === 'listing' ? it.title : '',
      externalListingNo: it.listingNo ?? '',
      externalUrl: it.url ?? '',
      externalSource: it.listingSource ?? '',
      location: it.location ?? '',
      features: it.features ?? '',
      price: it.price != null ? String(it.price) : '',
      currency: it.currency,
      stage: it.stage,
      notes: it.notes ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      propertyId: form.mode === 'project' ? (form.propertyId || null) : null,
      externalTitle: form.mode === 'listing' ? (form.externalTitle.trim() || null) : null,
      externalListingNo: form.externalListingNo.trim() || null,
      externalUrl: form.externalUrl.trim() || null,
      externalSource: form.externalSource.trim() || null,
      location: form.location.trim() || null,
      features: form.features.trim() || null,
      price: form.price.trim() ? Number(form.price) : null,
      currency: form.currency,
      stage: form.stage,
      notes: form.notes.trim() || null,
    };
    setSaving(true);
    try {
      if (editId) await clientsApi.updatePresented(clientId, editId, payload);
      else await clientsApi.addPresented(clientId, payload);
      toast.success(t(editId ? 'clients.presented.updated' : 'clients.presented.added'));
      setOpen(false); setEditId(null); setForm(emptyForm);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  /** Aşamayı satır üstünden hızlı değiştir — modal açmadan. */
  const quickStage = async (it: PresentedDTO, stage: PresentedStage) => {
    try {
      await clientsApi.updatePresented(clientId, it.id, {
        propertyId: it.propertyId,
        externalTitle: it.source === 'listing' ? it.title : null,
        externalListingNo: it.listingNo, externalUrl: it.url,
        externalSource: it.listingSource, location: it.location,
        features: it.features, price: it.price, currency: it.currency,
        notes: it.notes, stage,
      });
      if (stage === 'sold') toast.success(t('clients.presented.soldNote'));
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (id: string) => {
    try {
      await clientsApi.removePresented(clientId, id);
      toast.success(t('clients.presented.deleted'));
      setConfirmDel(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const money = (v: number | null, cur: string) =>
    v == null ? '—' : new Intl.NumberFormat('tr-TR', {
      style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 0,
    }).format(v);

  if (loading) return <p className={styles.muted}>{t('common.loading')}</p>;

  const sold = items.filter((i) => i.stage === 'sold').length;
  const rejected = items.filter((i) => i.stage === 'rejected').length;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.stats}>
          <span><b>{items.length}</b> {t('clients.presented.total')}</span>
          {sold > 0 && <span className={styles.okText}><b>{sold}</b> {t('clients.presented.soldCount')}</span>}
          {rejected > 0 && <span className={styles.mutedText}><b>{rejected}</b> {t('clients.presented.rejectedCount')}</span>}
        </div>
        <Button variant="primary" size="sm" onClick={startAdd}>
          <Plus size={16} /> {t('clients.presented.add')}
        </Button>
      </div>

      {/* ── Ekleme / düzenleme formu ─────────────────────────────── */}
      {open && (
        <div className={styles.form}>
          <div className={styles.modeSeg} role="group">
            <button type="button"
              className={form.mode === 'project' ? styles.segActive : styles.seg}
              onClick={() => set({ mode: 'project' })}>
              <Buildings size={14} /> {t('clients.presented.modeProject')}
            </button>
            <button type="button"
              className={form.mode === 'listing' ? styles.segActive : styles.seg}
              onClick={() => set({ mode: 'listing' })}>
              <Storefront size={14} /> {t('clients.presented.modeListing')}
            </button>
          </div>

          {form.mode === 'project' ? (
            <Field label={t('clients.presented.project')}>
              <SelectMenu
                aria-label={t('clients.presented.project')}
                value={form.propertyId}
                onChange={(v) => set({ propertyId: v })}
                placeholder={t('clients.presented.projectPlaceholder')}
                options={projects.map((p) => ({ value: p.id, label: `${p.name} · ${p.location}` }))}
              />
            </Field>
          ) : (
            <>
              <FormRow>
                <Field label={t('clients.presented.listingTitle')}>
                  <Input value={form.externalTitle}
                    placeholder={t('clients.presented.listingTitlePh')}
                    onChange={(e) => set({ externalTitle: e.target.value })} />
                </Field>
                <Field label={t('clients.presented.listingNo')}>
                  <Input value={form.externalListingNo}
                    placeholder="1123456789"
                    onChange={(e) => set({ externalListingNo: e.target.value })} />
                </Field>
              </FormRow>
              <FormRow>
                <Field label={t('clients.presented.listingUrl')}>
                  <Input value={form.externalUrl} placeholder="https://…"
                    onChange={(e) => set({ externalUrl: e.target.value })} />
                </Field>
                <Field label={t('clients.presented.listingSource')}>
                  <Input value={form.externalSource} placeholder="sahibinden, Bayut…"
                    onChange={(e) => set({ externalSource: e.target.value })} />
                </Field>
              </FormRow>
            </>
          )}

          <FormRow>
            <Field label={t('clients.presented.location')}>
              <Input value={form.location} placeholder={t('clients.presented.locationPh')}
                onChange={(e) => set({ location: e.target.value })} />
            </Field>
            <Field label={t('clients.presented.price')}>
              <div className={styles.priceRow}>
                <Input type="number" value={form.price} placeholder="0"
                  onChange={(e) => set({ price: e.target.value })} />
                <SelectMenu aria-label="currency" value={form.currency}
                  onChange={(v) => set({ currency: v })}
                  options={['EUR', 'USD', 'GBP', 'TRY', 'AED'].map((c) => ({ value: c, label: c }))} />
              </div>
            </Field>
          </FormRow>

          <Field label={t('clients.presented.features')}>
            <Input value={form.features} placeholder={t('clients.presented.featuresPh')}
              onChange={(e) => set({ features: e.target.value })} />
          </Field>

          <FormRow>
            <Field label={t('clients.presented.stage')}>
              <SelectMenu aria-label={t('clients.presented.stage')} value={form.stage}
                onChange={(v) => set({ stage: v as PresentedStage })}
                options={STAGES.map((s) => ({ value: s, label: t(`clients.presented.stages.${s}`) }))} />
            </Field>
          </FormRow>

          <Field label={t('clients.presented.notes')}>
            <Textarea rows={2} value={form.notes}
              placeholder={t('clients.presented.notesPh')}
              onChange={(e) => set({ notes: e.target.value })} />
          </Field>

          <div className={styles.formActions}>
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setEditId(null); }}>
              {t('clients.presented.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={save} disabled={saving}>
              {saving ? t('clients.presented.saving') : t('clients.presented.save')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Liste ────────────────────────────────────────────────── */}
      {items.length === 0 && !open ? (
        <EmptyState
          icon={<Buildings size={40} weight="thin" />}
          title={t('clients.presented.emptyTitle')}
          description={t('clients.presented.emptyBody')}
          actionLabel={t('clients.presented.add')}
          onAction={startAdd}
        />
      ) : (
        <div className={styles.list}>
          {items.map((it) => (
            <div key={it.id} className={`${styles.item} ${it.stage === 'rejected' ? styles.dim : ''}`}>
              <div className={styles.itemMain}>
                <div className={styles.itemHead}>
                  <span className={styles.srcIcon}>
                    {it.source === 'project' ? <Buildings size={15} /> : <Storefront size={15} />}
                  </span>
                  <span className={styles.itemTitle}>{it.title}</span>
                  {it.url && (
                    <a href={it.url} target="_blank" rel="noopener noreferrer"
                      className={styles.link} title={it.url}>
                      <LinkSimple size={14} /> {t('clients.presented.openListing')}
                    </a>
                  )}
                </div>
                <div className={styles.meta}>
                  {it.listingNo && <span>{t('clients.presented.listingNoShort')}: {it.listingNo}</span>}
                  {it.location && <span>{it.location}</span>}
                  {it.features && <span>{it.features}</span>}
                  <span className={styles.price}>{money(it.price, it.currency)}</span>
                </div>
                {it.notes && <p className={styles.note}>{it.notes}</p>}
              </div>

              <div className={styles.itemSide}>
                <span className={`${styles.badge} ${stageClass(it.stage)}`}>{it.stageLabel}</span>
                <div className={styles.stageSelect}>
                  <SelectMenu
                    aria-label={t('clients.presented.stage')}
                    value={it.stage}
                    onChange={(v) => quickStage(it, v as PresentedStage)}
                    options={STAGES.map((s) => ({ value: s, label: t(`clients.presented.stages.${s}`) }))}
                  />
                </div>
                <div className={styles.rowBtns}>
                  <button className={styles.iconBtn} title={t('clients.presented.edit')}
                    onClick={() => startEdit(it)}>
                    <PencilSimple size={14} />
                  </button>
                  <button className={`${styles.iconBtn} ${styles.danger}`}
                    title={t('clients.presented.delete')}
                    onClick={() => setConfirmDel(it.id)}>
                    <Trash size={14} />
                  </button>
                </div>
                {confirmDel === it.id && (
                  <div className={styles.confirm}>
                    <span>{t('clients.presented.deleteConfirm')}</span>
                    <Button variant="ghost" size="sm" onClick={() => remove(it.id)}
                      style={{ color: 'var(--data-negative)' }}>
                      {t('clients.presented.delete')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDel(null)}>
                      {t('clients.presented.cancel')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
