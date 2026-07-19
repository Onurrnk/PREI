// =====================================================================
// PREI | SubmitProject — geliştirici self-servis proje gönderimi (PUBLIC).
// /submit/:token — RequireAuth DIŞINDA; kimlik doğrulaması yok, token guard
// backend'de. Minimal markalı layout (sidebar yok).
// =====================================================================
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../../core/hooks/useFetch';
import { publicIntakeApi } from '../../core/api/resources';
import type { PublicInviteInfoDTO } from '../../core/types';
import { Card } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { Field, Input, Textarea, Select, FormRow } from '../../core/components/Form/Form';
import { CheckCircle, WarningCircle, UploadSimple } from '@phosphor-icons/react';
import styles from './SubmitProject.module.css';

const MARKETS = ['TR', 'AE', 'ES', 'GB', 'TH', 'DE'];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'TRY'];

const emptyForm = {
  title: '', city: '', district: '', marketCode: 'AE',
  priceMin: '', priceMax: '', currency: 'EUR', commissionPct: '',
  unitTypes: '', description: '', completionDate: '',
};

export const SubmitProject: React.FC = () => {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const { data: info, loading, error } = useFetch<PublicInviteInfoDTO>(() => publicIntakeApi.info(token), [token]);

  const [form, setForm] = useState(emptyForm);
  const [brochure, setBrochure] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setF = (patch: Partial<typeof emptyForm>) => setForm((f) => ({ ...f, ...patch }));
  const canSubmit = useMemo(
    () => form.title.trim().length >= 2 && !!brochure && images.length > 0,
    [form.title, brochure, images],
  );

  const handleSubmit = async () => {
    setErr(null);
    if (!canSubmit) { setErr(t('intake.public.missing')); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title.trim());
      if (form.city.trim()) fd.append('city', form.city.trim());
      if (form.district.trim()) fd.append('district', form.district.trim());
      fd.append('marketCode', form.marketCode);
      if (form.priceMin) fd.append('priceMin', form.priceMin);
      if (form.priceMax) fd.append('priceMax', form.priceMax);
      fd.append('currency', form.currency);
      if (form.commissionPct) fd.append('commissionPct', form.commissionPct);
      if (form.unitTypes.trim()) fd.append('unitTypes', form.unitTypes.trim());
      if (form.description.trim()) fd.append('description', form.description.trim());
      if (form.completionDate) fd.append('completionDate', new Date(form.completionDate).toISOString());
      fd.append('brochure', brochure!);
      images.forEach((im) => fd.append('images', im));
      await publicIntakeApi.submit(token, fd);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.page}><div className={styles.center}>{t('common.loading')}</div></div>;
  }
  if (error || !info?.valid) {
    return (
      <div className={styles.page}>
        <Card padding="lg">
          <div className={styles.stateBox}>
            <WarningCircle size={40} weight="duotone" className={styles.iconWarn} />
            <h2 className={styles.stateTitle}>{t('intake.public.invalidTitle')}</h2>
            <p className={styles.stateBody}>{t('intake.public.invalidBody')}</p>
          </div>
        </Card>
      </div>
    );
  }
  if (done) {
    return (
      <div className={styles.page}>
        <Card padding="lg">
          <div className={styles.stateBox}>
            <CheckCircle size={40} weight="duotone" className={styles.iconOk} />
            <h2 className={styles.stateTitle}>{t('intake.public.doneTitle')}</h2>
            <p className={styles.stateBody}>{t('intake.public.doneBody')}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.brand}>ProDuality</span>
        <h1 className={styles.title}>{t('intake.public.title')}</h1>
        <p className={styles.subtitle}>
          {info.developerName ? t('intake.public.forDeveloper', { name: info.developerName }) : t('intake.public.subtitle')}
        </p>
      </div>

      <Card padding="lg">
        <div className={styles.form}>
          <Field label={t('intake.form.title')}>
            <Input value={form.title} onChange={(e) => setF({ title: e.target.value })} placeholder={t('intake.form.titlePh')} />
          </Field>
          <FormRow>
            <Field label={t('intake.form.city')}>
              <Input value={form.city} onChange={(e) => setF({ city: e.target.value })} />
            </Field>
            <Field label={t('intake.form.district')}>
              <Input value={form.district} onChange={(e) => setF({ district: e.target.value })} />
            </Field>
            <Field label={t('intake.form.market')}>
              <Select value={form.marketCode} onChange={(e) => setF({ marketCode: e.target.value })}>
                {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
          </FormRow>
          <FormRow>
            <Field label={t('intake.form.priceMin')}>
              <Input type="number" min={0} value={form.priceMin} onChange={(e) => setF({ priceMin: e.target.value })} />
            </Field>
            <Field label={t('intake.form.priceMax')}>
              <Input type="number" min={0} value={form.priceMax} onChange={(e) => setF({ priceMax: e.target.value })} />
            </Field>
            <Field label={t('intake.form.currency')}>
              <Select value={form.currency} onChange={(e) => setF({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </FormRow>
          <FormRow>
            <Field label={t('intake.form.commission')} hint={t('intake.form.commissionPh')}>
              <Input type="number" min={0} max={100} step="0.1" value={form.commissionPct} onChange={(e) => setF({ commissionPct: e.target.value })} />
            </Field>
            <Field label={t('intake.form.completion')}>
              <Input type="date" value={form.completionDate} onChange={(e) => setF({ completionDate: e.target.value })} />
            </Field>
          </FormRow>
          <Field label={t('intake.form.unitTypes')} hint={t('intake.form.unitTypesPh')}>
            <Input value={form.unitTypes} onChange={(e) => setF({ unitTypes: e.target.value })} placeholder="1+1, 2+1, Villa" />
          </Field>
          <Field label={t('intake.form.description')}>
            <Textarea rows={4} value={form.description} onChange={(e) => setF({ description: e.target.value })} />
          </Field>

          <Field label={t('intake.form.brochure')} hint={t('intake.form.brochureHint')}>
            <input type="file" accept="application/pdf"
              onChange={(e) => setBrochure(e.target.files?.[0] ?? null)} />
            {brochure && <span className={styles.fileName}>{brochure.name}</span>}
          </Field>
          <Field label={t('intake.form.images')} hint={t('intake.form.imagesHint')}>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple
              onChange={(e) => setImages(Array.from(e.target.files ?? []).slice(0, 8))} />
            {images.length > 0 && <span className={styles.fileName}>{t('intake.form.imagesCount', { count: images.length })}</span>}
          </Field>

          {err && <div className={styles.errorBox}>{err}</div>}

          <div className={styles.actions}>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || !canSubmit}>
              <UploadSimple size={16} /> {submitting ? t('intake.public.submitting') : t('intake.public.submit')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
