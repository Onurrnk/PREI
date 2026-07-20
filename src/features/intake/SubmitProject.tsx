// =====================================================================
// PREI | SubmitProject — geliştirici self-servis proje gönderimi (PUBLIC).
// /submit/:token — RequireAuth DIŞINDA; kimlik doğrulaması yok, token guard
// backend'de. Minimal markalı layout (gerçek logo, sidebar yok).
// ?lang=tr|en ile dil seçilir; sayfada TR/EN düğmesi de var (Onur: TR ve EN
// için ayrı link verilebilsin).
// =====================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../../core/hooks/useFetch';
import { publicIntakeApi } from '../../core/api/resources';
import type { PublicInviteInfoDTO } from '../../core/types';
import { Card } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { Field, Input, Textarea, Select, FormRow } from '../../core/components/Form/Form';
import { CheckCircle, WarningCircle, UploadSimple } from '@phosphor-icons/react';
import { MapPicker, geocode, type MapFocus } from './MapPicker';
import styles from './SubmitProject.module.css';

const MARKETS = ['TR', 'AE', 'ES', 'GB', 'TH', 'DE'];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED', 'TRY'];
const UNIT_OPTIONS = ['Studio', '1+1', '2+1', '3+1', '4+1', '5+1', 'Villa', 'Penthouse'];
const VARIANT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const LOGO_URL = 'https://produality.com/assets/images/logo-transparent.png';

// Daire tipi → varyant (A/B/C…) → iç görseller + 1 layout çizimi.
type UnitVariant = { label: string; images: File[]; layout: File | null };
type UnitTypeDef = { type: string; variants: UnitVariant[] };

// Fiyat girişi: yalnız rakam tut, binlik ayracıyla göster (1.250.000).
const digitsOnly = (s: string): string => s.replace(/\D/g, '');
const fmtThousands = (s: string): string =>
  s === '' ? '' : Number(s).toLocaleString('tr-TR');

const emptyForm = {
  title: '', city: '', district: '', neighborhood: '', marketCode: 'AE',
  priceMin: '', priceMax: '', currency: 'EUR', commissionPct: '',
  customUnits: '', description: '', completionDate: '',
  downPaymentPct: '', installmentMonths: '', paymentNote: '', listingUrl: '',
};

// Pazar kodu → geocode sorgusuna ülke adı (mahalle/ilçe tek başına belirsiz olmasın).
const MARKET_COUNTRY: Record<string, string> = {
  TR: 'Türkiye', AE: 'United Arab Emirates', ES: 'España', GB: 'United Kingdom', TH: 'Thailand', DE: 'Deutschland',
};

export const SubmitProject: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { token = '' } = useParams();
  const [params] = useSearchParams();
  const { data: info, loading, error } = useFetch<PublicInviteInfoDTO>(() => publicIntakeApi.info(token), [token]);

  // ?lang=tr|en → sayfa dili (yalnız bu public sayfa için; davet linki dile göre verilebilir).
  useEffect(() => {
    const lang = params.get('lang');
    if (lang === 'en' || lang === 'tr') void i18n.changeLanguage(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [form, setForm] = useState(emptyForm);
  const [unitDefs, setUnitDefs] = useState<UnitTypeDef[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);

  // Şehir/ilçe/mahalle alanından çıkınca haritayı o bölgeye odakla —
  // kişi haritada gezinmeden doğrudan pin bırakabilsin.
  const focusMapFromFields = async () => {
    const parts = [form.neighborhood, form.district, form.city, MARKET_COUNTRY[form.marketCode]]
      .map((s) => s?.trim()).filter(Boolean);
    if (parts.length < 2) return; // ülke tek başına yeterince spesifik değil
    const res = await geocode(parts.join(', '), i18n.language?.startsWith('en') ? 'en' : 'tr');
    if (res[0]) {
      const zoom = form.neighborhood.trim() ? 15 : form.district.trim() ? 13 : 11;
      setMapFocus({ lat: Number(res[0].lat), lng: Number(res[0].lon), zoom });
    }
  };
  const [brochure, setBrochure] = useState<File | null>(null);
  const [imgExterior, setImgExterior] = useState<File[]>([]);
  const [imgSocial, setImgSocial] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setF = (patch: Partial<typeof emptyForm>) => setForm((f) => ({ ...f, ...patch }));

  // --- Daire tipi / varyant kurucu ---
  const addUnitType = () =>
    setUnitDefs((p) => [...p, { type: '', variants: [{ label: VARIANT_LABELS[0], images: [], layout: null }] }]);
  const removeUnitType = (ti: number) => setUnitDefs((p) => p.filter((_, i) => i !== ti));
  const setUnitType = (ti: number, type: string) =>
    setUnitDefs((p) => p.map((u, i) => (i === ti ? { ...u, type } : u)));
  const addVariant = (ti: number) =>
    setUnitDefs((p) => p.map((u, i) => i === ti
      ? { ...u, variants: [...u.variants, { label: VARIANT_LABELS[u.variants.length] ?? '', images: [], layout: null }] }
      : u));
  const removeVariant = (ti: number, vi: number) =>
    setUnitDefs((p) => p.map((u, i) => i === ti ? { ...u, variants: u.variants.filter((_, j) => j !== vi) } : u));
  const patchVariant = (ti: number, vi: number, patch: Partial<UnitVariant>) =>
    setUnitDefs((p) => p.map((u, i) => i === ti
      ? { ...u, variants: u.variants.map((v, j) => (j === vi ? { ...v, ...patch } : v)) }
      : u));

  const unitImageCount = unitDefs.reduce((s, u) => s + u.variants.reduce((a, v) => a + v.images.length, 0), 0);
  const totalImages = imgExterior.length + imgSocial.length + unitImageCount;
  const canSubmit = useMemo(
    () => form.title.trim().length >= 2 && !!brochure && totalImages > 0,
    [form.title, brochure, totalImages],
  );

  const pickFiles = (setter: (f: File[]) => void) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setter(Array.from(e.target.files ?? []).slice(0, 8));

  const handleSubmit = async () => {
    setErr(null);
    if (!canSubmit) { setErr(t('intake.public.missing')); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title.trim());
      if (form.city.trim()) fd.append('city', form.city.trim());
      if (form.district.trim()) fd.append('district', form.district.trim());
      if (form.neighborhood.trim()) fd.append('neighborhood', form.neighborhood.trim());
      if (form.listingUrl.trim()) fd.append('listingUrl', form.listingUrl.trim());
      fd.append('marketCode', form.marketCode);
      if (form.priceMin) fd.append('priceMin', digitsOnly(form.priceMin));
      if (form.priceMax) fd.append('priceMax', digitsOnly(form.priceMax));
      fd.append('currency', form.currency);
      if (form.commissionPct) fd.append('commissionPct', form.commissionPct);
      // Daire tipleri: yapıyı (sayılar) JSON olarak + dosyaları SIRAYLA gönder.
      const cleanDefs = unitDefs
        .map((u) => ({ ...u, type: u.type.trim(), variants: u.variants.filter((v) => v.images.length > 0 || v.layout) }))
        .filter((u) => u.type && u.variants.length > 0);
      if (cleanDefs.length) {
        fd.append('unitTypesData', JSON.stringify(cleanDefs.map((u) => ({
          type: u.type,
          variants: u.variants.map((v) => ({ label: v.label.trim() || '—', imageCount: v.images.length, hasLayout: !!v.layout })),
        }))));
        const typeLabels = [...new Set(cleanDefs.map((u) => u.type))];
        fd.append('unitTypes', typeLabels.join(', '));
        // Görseller: tip→varyant sırasıyla; layout'lar: aynı sırada (assemble ile birebir).
        cleanDefs.forEach((u) => u.variants.forEach((v) => v.images.forEach((f) => fd.append('unitImages', f))));
        cleanDefs.forEach((u) => u.variants.forEach((v) => { if (v.layout) fd.append('unitLayouts', v.layout); }));
      }
      if (form.description.trim()) fd.append('description', form.description.trim());
      if (form.completionDate) fd.append('completionDate', new Date(form.completionDate).toISOString());
      if (coords) { fd.append('latitude', String(coords.lat)); fd.append('longitude', String(coords.lng)); }
      if (form.downPaymentPct) fd.append('downPaymentPct', form.downPaymentPct);
      if (form.installmentMonths) fd.append('installmentMonths', form.installmentMonths);
      if (form.paymentNote.trim()) fd.append('paymentNote', form.paymentNote.trim());
      fd.append('brochure', brochure!);
      imgExterior.forEach((f) => fd.append('imagesExterior', f));
      imgSocial.forEach((f) => fd.append('imagesSocial', f));
      await publicIntakeApi.submit(token, fd);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const langSwitch = (
    <div className={styles.langSwitch}>
      <button className={i18n.language === 'tr' ? styles.langActive : styles.langBtn} onClick={() => void i18n.changeLanguage('tr')}>TR</button>
      <button className={i18n.language?.startsWith('en') ? styles.langActive : styles.langBtn} onClick={() => void i18n.changeLanguage('en')}>EN</button>
    </div>
  );

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
        {langSwitch}
        <img src={LOGO_URL} alt="ProDuality" className={styles.logo} />
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
              <Input value={form.city} onChange={(e) => setF({ city: e.target.value })}
                onBlur={() => void focusMapFromFields()} />
            </Field>
            <Field label={t('intake.form.district')}>
              <Input value={form.district} onChange={(e) => setF({ district: e.target.value })}
                onBlur={() => void focusMapFromFields()} />
            </Field>
          </FormRow>
          <Field label={t('intake.form.neighborhood')} hint={t('intake.form.neighborhoodHint')}>
            <Input value={form.neighborhood} onChange={(e) => setF({ neighborhood: e.target.value })}
              onBlur={() => void focusMapFromFields()} />
          </Field>
          <FormRow>
            <Field label={t('intake.form.market')}>
              <Select value={form.marketCode} onChange={(e) => setF({ marketCode: e.target.value })}>
                {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label={t('intake.form.currency')}>
              <Select value={form.currency} onChange={(e) => setF({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </FormRow>
          <FormRow>
            <Field label={t('intake.form.priceMin')}>
              <Input inputMode="numeric" value={fmtThousands(digitsOnly(form.priceMin))}
                onChange={(e) => setF({ priceMin: digitsOnly(e.target.value) })} placeholder="500.000" />
            </Field>
            <Field label={t('intake.form.priceMax')}>
              <Input inputMode="numeric" value={fmtThousands(digitsOnly(form.priceMax))}
                onChange={(e) => setF({ priceMax: digitsOnly(e.target.value) })} placeholder="1.250.000" />
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

          {/* Ödeme planı */}
          <div className={styles.sectionTitle}>{t('intake.form.paymentSection')}</div>
          <FormRow>
            <Field label={t('intake.form.downPayment')}>
              <Input type="number" min={0} max={100} value={form.downPaymentPct}
                onChange={(e) => setF({ downPaymentPct: e.target.value })} placeholder="40" />
            </Field>
            <Field label={t('intake.form.installment')}>
              <Input type="number" min={0} max={360} value={form.installmentMonths}
                onChange={(e) => setF({ installmentMonths: e.target.value })} placeholder="24" />
            </Field>
          </FormRow>
          <Field label={t('intake.form.paymentNote')}>
            <Input value={form.paymentNote} onChange={(e) => setF({ paymentNote: e.target.value })}
              placeholder={t('intake.form.paymentNotePh')} />
          </Field>

          {/* Daire tipleri — her tip altında varyant (A/B/C), varyant başına iç görseller + 1 layout */}
          <div className={styles.sectionTitle}>{t('intake.form.unitTypesSection')}</div>
          <p className={styles.sectionHint}>{t('intake.form.unitTypesSectionHint')}</p>
          {unitDefs.map((u, ti) => (
            <div key={ti} className={styles.unitCard}>
              <div className={styles.unitHead}>
                <input list="unitTypeOpts" className={styles.unitTypeInput}
                  placeholder={t('intake.form.unitTypePh')}
                  value={u.type} onChange={(e) => setUnitType(ti, e.target.value)} />
                <button type="button" className={styles.removeBtn} onClick={() => removeUnitType(ti)}>
                  {t('intake.form.removeUnit')}
                </button>
              </div>
              {u.variants.map((v, vi) => (
                <div key={vi} className={styles.variantRow}>
                  <input className={styles.variantLabel} value={v.label}
                    onChange={(e) => patchVariant(ti, vi, { label: e.target.value })}
                    placeholder={t('intake.form.variantPh')} />
                  <label className={styles.fileCell}>
                    <span>{t('intake.form.variantImages')}</span>
                    <input type="file" accept="image/*" multiple
                      onChange={(e) => patchVariant(ti, vi, { images: Array.from(e.target.files ?? []).slice(0, 12) })} />
                    {v.images.length > 0 && <span className={styles.fileName}>{t('intake.form.imagesCount', { count: v.images.length })}</span>}
                  </label>
                  <label className={styles.fileCell}>
                    <span>{t('intake.form.variantLayout')}</span>
                    <input type="file" accept="image/*"
                      onChange={(e) => patchVariant(ti, vi, { layout: e.target.files?.[0] ?? null })} />
                    {v.layout && <span className={styles.fileNameOk}>✓ {v.layout.name.slice(0, 24)}</span>}
                  </label>
                  {u.variants.length > 1 && (
                    <button type="button" className={styles.removeBtnSm} onClick={() => removeVariant(ti, vi)} aria-label="sil">×</button>
                  )}
                </div>
              ))}
              <button type="button" className={styles.addVariantBtn} onClick={() => addVariant(ti)}>
                + {t('intake.form.addVariant')}
              </button>
            </div>
          ))}
          <button type="button" className={styles.addUnitBtn} onClick={addUnitType}>
            + {t('intake.form.addUnitType')}
          </button>
          <datalist id="unitTypeOpts">{UNIT_OPTIONS.map((u) => <option key={u} value={u} />)}</datalist>

          <Field label={t('intake.form.description')} hint={t('intake.form.descriptionHint')}>
            <Textarea rows={5} value={form.description} onChange={(e) => setF({ description: e.target.value })}
              placeholder={t('intake.form.descriptionPh')} />
          </Field>

          <Field label={t('intake.form.listingUrl')} hint={t('intake.form.listingUrlHint')}>
            <Input type="url" value={form.listingUrl} onChange={(e) => setF({ listingUrl: e.target.value })}
              placeholder="https://www.sahibinden.com/ilan/…" />
          </Field>

          <Field
            label={t('intake.form.location')}
            hint={coords ? t('intake.form.locationPicked', { lat: coords.lat.toFixed(5), lng: coords.lng.toFixed(5) }) : t('intake.form.locationHint')}
          >
            <MapPicker lat={coords?.lat ?? null} lng={coords?.lng ?? null} focus={mapFocus}
              onPick={(lat, lng) => setCoords({ lat, lng })} />
          </Field>

          <Field label={t('intake.form.brochure')} hint={t('intake.form.brochureHint')}>
            <input type="file" accept="application/pdf"
              onChange={(e) => setBrochure(e.target.files?.[0] ?? null)} />
            {brochure && <span className={styles.fileName}>{brochure.name}</span>}
          </Field>

          {/* Proje-seviyesi görseller: dış cephe + sosyal alanlar (iç mekan daire tipinde) */}
          <div className={styles.sectionTitle}>{t('intake.form.imagesSection')}</div>
          <Field label={t('intake.form.imagesExterior')} hint={t('intake.form.imagesHint')}>
            <input type="file" accept="image/*" multiple onChange={pickFiles(setImgExterior)} />
            {imgExterior.length > 0 && <span className={styles.fileName}>{t('intake.form.imagesCount', { count: imgExterior.length })}</span>}
          </Field>
          <Field label={t('intake.form.imagesSocial')} hint={t('intake.form.imagesHint')}>
            <input type="file" accept="image/*" multiple onChange={pickFiles(setImgSocial)} />
            {imgSocial.length > 0 && <span className={styles.fileName}>{t('intake.form.imagesCount', { count: imgSocial.length })}</span>}
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
