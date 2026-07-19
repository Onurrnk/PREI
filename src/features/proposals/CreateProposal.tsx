// =====================================================================
// PREI | Yeni Teklif Sihirbazı — gerçek veriye bağlı, kayıtlı, izlenebilir.
// 1) Hedef (kilitli müşteri + kayıtlı/serbest proje)  2) Mülk bilgileri
// 3) Finansal (liste−indirim−nihai + ödeme planı)     4) Getiri (ROI)
// 5) Materyaller & Önizleme (logo + tüm alanlar; taslak kaydet / mail gönder)
// Tasarım dondurulmuş: accent = logo moru (#9B5BB3). i18n korunur; yeni
// etiketler bileşen-içi TX sözlüğünde (tr/en) — büyük locale dosyaları
// riske girmesin diye.
// =====================================================================
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import {
  ArrowLeft, CheckCircle, Buildings, Calculator, PenNib,
  PaperPlaneTilt, DownloadSimple, User, House, ChartLineUp, Plus, Trash,
} from '@phosphor-icons/react';
import { Modal } from '../../core/components/Modal/Modal';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { clientsApi, projectsApi, proposalsApi } from '../../core/api/resources';
import { ApiError } from '../../core/api/client';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { printProposal } from '../../core/utils/printProposal';
import type {
  ClientDTO, ProjectDTO, ProposalRoiInputs, ProposalUnitDetails, CreateProposalInput,
} from '../../core/types';
import { computeRoi, formatMoney, groupThousands, parseNumeric } from './roi';
import styles from './CreateProposal.module.css';

interface PaymentPlanRow {
  milestone: string;
  percentage: string;
  date: string;
}

const DEFAULT_PAYMENT_PLAN: PaymentPlanRow[] = [
  { milestone: 'Peşinat', percentage: '20', date: 'Rezervasyonda' },
  { milestone: 'İnşaat Sürecinde', percentage: '40', date: 'Taksitler' },
  { milestone: 'Teslimde', percentage: '40', date: 'Teslim' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'TRY'];
const UNIT_TYPES = ['Stüdyo', '1+1', '2+1', '3+1', '4+1', '4+2', '5+1', 'Dubleks', 'Villa'];
const PROPERTY_STATUSES = ['under_construction', 'offplan', 'ready', 'resale'] as const;
const TITLE_DEEDS = ['kat_mulkiyeti', 'kat_irtifaki', 'mustakil', 'arsa'] as const;
const TOTAL_STEPS = 5;

// Bileşen-içi iki dilli sözlük (yalnız yeni eklenen alanlar).
const DICT = {
  tr: {
    steps: {
      target: ['Hedef Seçimi', 'Müşteri ve Proje'],
      unit: ['Mülk Bilgileri', 'Daire ve özellikler'],
      financial: ['Finansal Teklif', 'Fiyat ve ödeme'],
      roi: ['Getiri Analizi', 'ROI projeksiyonu'],
      preview: ['Önizleme ve Gönder', 'Son kontrol'],
    },
    headings: ['Müşteri ve Proje Seçin', 'Mülk Bilgileri', 'Finansal Teklifi Yapılandırın', 'Yatırım Getirisi (ROI)', 'Önizleme ve Gönder'],
    lockedClient: '(kilitli)',
    noEmail: '⚠ Bu müşterinin e-postası yok — teklif gönderilemez, yalnızca taslak kaydedilir.',
    freeToggle: 'Kayıtlı olmayan proje / ürün',
    projectPh: 'Kayıtlı projeden seçin…',
    freePh: 'Proje / ürün adını yazın (örn: Özel Villa X)',
    registeredSelected: '✓ Kayıtlı proje seçildi.',
    freeHint: 'Kayıtlı olmayan bir ürün adı da yazabilirsiniz.',
    currency: 'Para Birimi',
    listPrice: 'Liste Fiyatı',
    discount: 'İndirim (%)',
    finalPrice: 'İndirimli Nihai Fiyat',
    onList: 'Ödeme planı oranları liste fiyatı üzerinden hesaplanmıştır (teklife not düşülür)',
    addStage: 'Aşama Ekle',
    total: 'Toplam',
    unit: {
      type: 'Daire Tipi', unitNo: 'Daire / Blok No', area: 'Brüt Alan (m²)', netArea: 'Net Alan (m²)',
      floor: 'Kat', facade: 'Cephe / Yön', view: 'Manzara', beds: 'Yatak Odası', baths: 'Banyo',
      titleDeed: 'Tapu Durumu',
      features: 'Özellikler', featuresPh: 'Örn: Akıllı ev, kapalı otopark, 7/24 güvenlik, havuz',
      desc: 'Açıklama',
    },
    titleDeed: {
      kat_mulkiyeti: 'Kat Mülkiyeti', kat_irtifaki: 'Kat İrtifakı', mustakil: 'Müstakil Tapu', arsa: 'Arsa',
    },
    propertyStatus: {
      under_construction: 'İnşaat Halinde', offplan: 'Off-Plan', ready: 'Hazır', resale: '2. El',
    },
    roi: {
      status: 'Mülk Durumu',
      model: 'Kira Modeli', longterm: 'Uzun Dönem', shortterm: 'Kısa Dönem',
      monthlyRent: 'Aylık Kira', rentCurrency: 'Kira Para Birimi', occupancy: 'Doluluk (%)',
      appreciation: 'Yıllık Değer Artışı (%)',
      maintenance: 'Bakım (%/yıl)', aidat: 'Aidat (aylık)', mgmt: 'Yönetim (% kira)',
      needPrice: 'ROI hesabı için önce Finansal adımda bir fiyat girin.',
      grossYield: 'Brüt Kira Getirisi (yıllık)', netYield: 'Net Kira Getirisi (yıllık)',
      annualNet: 'Yıllık Net Kira Geliri', annualAppr: 'Yıllık Değer Artışı', totalReturn: 'Yıllık Toplam Getiri',
    },
    notes: 'Notlar (opsiyonel)',
    materials: 'Materyaller',
    saveDraft: 'Taslak Kaydet', saving: 'Kaydediliyor…',
    saveSend: 'Kaydet ve Mail Gönder', sending: 'Gönderiliyor…',
    draftTitle: 'Taslak Kaydedildi', draftBody: 'Teklif taslak olarak kaydedildi. Daha sonra düzenleyip gönderebilirsiniz.',
    noEmailAction: 'Müşterinin e-postası olmadığından mail gönderilemez; taslak olarak kaydedebilirsiniz.',
    mustClientProject: 'Lütfen bir müşteri ve proje/ürün seçin, başlık girin.',
  },
  en: {
    steps: {
      target: ['Target Selection', 'Client & Project'],
      unit: ['Property Details', 'Unit & features'],
      financial: ['Financial Offer', 'Pricing & payment'],
      roi: ['Return Analysis', 'ROI projection'],
      preview: ['Preview & Send', 'Final review'],
    },
    headings: ['Select Client & Project', 'Property Details', 'Configure Financial Offer', 'Return on Investment (ROI)', 'Preview & Send'],
    lockedClient: '(locked)',
    noEmail: '⚠ This client has no email — the proposal can only be saved as a draft.',
    freeToggle: 'Unregistered project / product',
    projectPh: 'Select a registered project…',
    freePh: 'Type a project / product name (e.g. Private Villa X)',
    registeredSelected: '✓ Registered project selected.',
    freeHint: 'You can also type an unregistered product name.',
    currency: 'Currency',
    listPrice: 'List Price',
    discount: 'Discount (%)',
    finalPrice: 'Discounted Final Price',
    onList: 'Payment plan percentages are calculated on the list price (noted on the proposal)',
    addStage: 'Add Stage',
    total: 'Total',
    unit: {
      type: 'Unit Type', unitNo: 'Unit / Block No', area: 'Gross Area (m²)', netArea: 'Net Area (m²)',
      floor: 'Floor', facade: 'Facade / Aspect', view: 'View', beds: 'Bedrooms', baths: 'Bathrooms',
      titleDeed: 'Title Deed',
      features: 'Features', featuresPh: 'e.g. Smart home, covered parking, 24/7 security, pool',
      desc: 'Description',
    },
    titleDeed: {
      kat_mulkiyeti: 'Condominium (Kat Mülkiyeti)', kat_irtifaki: 'Construction Servitude (Kat İrtifakı)',
      mustakil: 'Freehold (Müstakil)', arsa: 'Land (Arsa)',
    },
    propertyStatus: {
      under_construction: 'Under Construction', offplan: 'Off-Plan', ready: 'Ready', resale: 'Resale',
    },
    roi: {
      status: 'Property Status',
      model: 'Rental Model', longterm: 'Long-term', shortterm: 'Short-term',
      monthlyRent: 'Monthly Rent', rentCurrency: 'Rent Currency', occupancy: 'Occupancy (%)',
      appreciation: 'Annual Appreciation (%)',
      maintenance: 'Maintenance (%/yr)', aidat: 'Dues (monthly)', mgmt: 'Management (% rent)',
      needPrice: 'Enter a price in the Financial step first to compute ROI.',
      grossYield: 'Gross Rental Yield (annual)', netYield: 'Net Rental Yield (annual)',
      annualNet: 'Annual Net Rent', annualAppr: 'Annual Appreciation', totalReturn: 'Annual Total Return',
    },
    notes: 'Notes (optional)',
    materials: 'Materials',
    saveDraft: 'Save Draft', saving: 'Saving…',
    saveSend: 'Save & Send Email', sending: 'Sending…',
    draftTitle: 'Draft Saved', draftBody: 'The proposal has been saved as a draft. You can edit and send it later.',
    noEmailAction: 'The client has no email, so no mail can be sent; you can save it as a draft.',
    mustClientProject: 'Please select a client and project/product, and enter a title.',
  },
};

export const CreateProposal: React.FC = () => {
  const { t, i18n } = useTranslation();
  const TX = i18n.language === 'tr' ? DICT.tr : DICT.en;
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const lockedClientId = params.get('clientId') || '';

  const [step, setStep] = useState(1);

  const { data: clientsData, loading: clientsLoading } = useFetch<ClientDTO[]>(() => clientsApi.list(), []);
  const { data: projectsData, loading: projectsLoading } = useFetch<ProjectDTO[]>(() => projectsApi.list(), []);
  const clients = clientsData ?? [];
  const projects = projectsData ?? [];

  const [selectedClient, setSelectedClient] = useState(lockedClientId);
  const [freeProjectMode, setFreeProjectMode] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [freeProjectName, setFreeProjectName] = useState('');
  const [title, setTitle] = useState('');

  const [currency, setCurrency] = useState('USD');
  const [listPrice, setListPrice] = useState<number | undefined>();
  const [discountPercent, setDiscountPercent] = useState('0');
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlanRow[]>(DEFAULT_PAYMENT_PLAN);
  const [paymentPlanOnList, setPaymentPlanOnList] = useState(false);

  const [unit, setUnit] = useState<ProposalUnitDetails>({});
  const [roi, setRoi] = useState<ProposalRoiInputs>({
    propertyStatus: 'ready', rentalType: 'longterm', occupancyRate: 60,
    appreciationPercent: 5, maintenancePercent: 1, mgmtFeePercent: 5,
  });

  const [includeBrochurePdf, setIncludeBrochurePdf] = useState(true);
  const [includeFloorPlans, setIncludeFloorPlans] = useState(true);
  const [includeRoiSheet, setIncludeRoiSheet] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const [savedId, setSavedId] = useState<string | undefined>();
  const [busy, setBusy] = useState<'' | 'draft' | 'send'>('');
  const [modal, setModal] = useState<'' | 'draft' | 'sent'>('');

  const selectedClientObj = clients.find((c) => c.id === selectedClient);
  const selectedProjectObj = projects.find((p) => p.id === selectedProject);
  const clientEmail = selectedClientObj?.email;
  const projectName = freeProjectMode ? freeProjectName.trim() : (selectedProjectObj?.name ?? '');

  const discountNum = Number(discountPercent) || 0;
  const finalPrice = useMemo(
    () => (listPrice ? Math.round(listPrice * (1 - Math.min(100, Math.max(0, discountNum)) / 100)) : undefined),
    [listPrice, discountNum],
  );
  const roiReport = useMemo(() => (finalPrice ? computeRoi(roi, finalPrice, currency) : undefined), [roi, finalPrice, currency]);

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    if (!title.trim()) setTitle(t('proposals.create.titleTemplate', { project: proj.name }));
    if (!listPrice) setListPrice(proj.startingPrice || undefined);
    if (proj.currency && CURRENCIES.includes(proj.currency)) setCurrency(proj.currency);
    setPaymentPlan(proj.paymentPlan.map((pp) => ({
      milestone: pp.milestone, percentage: String(pp.percentage), date: pp.date,
    })));
    setSelectedPhotos(proj.images);
  };

  const updatePaymentRow = (idx: number, patch: Partial<PaymentPlanRow>) =>
    setPaymentPlan((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addPaymentRow = () => setPaymentPlan((r) => [...r, { milestone: '', percentage: '0', date: '' }]);
  const removePaymentRow = (idx: number) => setPaymentPlan((r) => r.filter((_, i) => i !== idx));
  const togglePhoto = (url: string) =>
    setSelectedPhotos((cur) => (cur.includes(url) ? cur.filter((u) => u !== url) : [...cur, url]));

  const planTotal = Math.round(paymentPlan.reduce((s, r) => s + (Number(r.percentage) || 0), 0));
  const canProceed1 = !!selectedClient && projectName.length > 0 && title.trim().length >= 2;

  function buildPayload(status: 'draft' | 'sent'): CreateProposalInput {
    const metadata: Record<string, unknown> = {
      project_name: projectName || undefined,
      listPrice, discountPercent: discountNum,
      paymentPlan: paymentPlan.filter((r) => r.milestone.trim()),
      paymentPlanOnList,
      unit, roi, notes: notes.trim() || undefined,
      includeBrochurePdf, includeFloorPlans, includeRoiSheet, selectedPhotos,
    };
    const payload: CreateProposalInput = {
      title: title.trim(), contactId: selectedClient,
      totalValue: finalPrice, currency, status, metadata,
    };
    if (!freeProjectMode && selectedProject) payload.propertyId = selectedProject;
    return payload;
  }

  async function persist(status: 'draft' | 'sent') {
    const payload = buildPayload(status);
    if (savedId) return proposalsApi.update(savedId, payload);
    const created = await proposalsApi.create(payload);
    setSavedId(created.id);
    return created;
  }

  async function handleSaveDraft() {
    if (!canProceed1) { toast.error(TX.mustClientProject); setStep(1); return; }
    setBusy('draft');
    try { await persist('draft'); setModal('draft'); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : t('proposals.create.sendError')); }
    finally { setBusy(''); }
  }

  async function handleSend() {
    if (!canProceed1) { toast.error(TX.mustClientProject); setStep(1); return; }
    if (!clientEmail) { toast.error(TX.noEmailAction); return; }
    setBusy('send');
    try {
      const p = await persist('draft');
      await proposalsApi.send(p.id);
      setModal('sent');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('proposals.create.sendError'));
    } finally { setBusy(''); }
  }

  const closeModal = () => { setModal(''); navigate('/proposals'); };
  const dateLocale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';
  const coverImage = selectedPhotos[0] ?? selectedProjectObj?.images[0] ?? '/images/exterior.png';

  const stepDefs = [
    { icon: <User size={14} />, def: TX.steps.target },
    { icon: <House size={14} />, def: TX.steps.unit },
    { icon: <Calculator size={14} />, def: TX.steps.financial },
    { icon: <ChartLineUp size={14} />, def: TX.steps.roi },
    { icon: <PenNib size={14} />, def: TX.steps.preview },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <div>
            <h1 className={styles.title}>{t('proposals.create.title')}</h1>
            <p className={styles.subtitle}>{t('proposals.create.subtitle')}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={() => navigate(-1)}>{t('proposals.create.cancel')}</Button>
          <Button variant="primary" onClick={handleSend} disabled={step !== TOTAL_STEPS || busy !== '' || !clientEmail}>
            <PaperPlaneTilt size={16} style={{ marginRight: 6 }} />
            {busy === 'send' ? TX.sending : t('proposals.create.sendProposal')}
          </Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <Card>
            <CardBody className={styles.stepsContainer}>
              {stepDefs.map((s, i) => (
                <div key={i} className={`${styles.stepItem} ${step >= i + 1 ? styles.stepActive : ''}`} onClick={() => setStep(i + 1)}>
                  <div className={styles.stepCircle}>{s.icon}</div>
                  <div className={styles.stepInfo}>
                    <div className={styles.stepTitle}>{s.def[0]}</div>
                    <div className={styles.stepDesc}>{s.def[1]}</div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className={styles.main}>
          <Card className={styles.mainCard}>
            <CardHeader><h3 className={styles.cardTitle}>{TX.headings[step - 1]}</h3></CardHeader>
            <CardBody className={styles.cardBodyScroll}>

              {/* ADIM 1: HEDEF */}
              {step === 1 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>{t('proposals.create.selectClient')} {lockedClientId && <span style={{ color: '#9B5BB3' }}>{TX.lockedClient}</span>}</label>
                    <SelectMenu
                      aria-label={t('proposals.create.selectClient')}
                      value={selectedClient} onChange={setSelectedClient}
                      disabled={clientsLoading || !!lockedClientId}
                      placeholder={t('proposals.create.selectClientPh')}
                      options={clients.map((c) => ({ value: c.id, label: c.type === 'VIP' ? `${c.name} (VIP)` : c.name }))}
                    />
                    {selectedClient && !clientEmail && <p className={styles.hintText}>{TX.noEmail}</p>}
                  </div>

                  <div className={styles.formGroup}>
                    <label>{t('proposals.create.selectProject')}</label>
                    {freeProjectMode ? (
                      <input type="text" className={styles.textInput} value={freeProjectName}
                        placeholder={TX.freePh} onChange={(e) => setFreeProjectName(e.target.value)} />
                    ) : (
                      <SelectMenu
                        aria-label={t('proposals.create.selectProject')}
                        value={selectedProject} onChange={handleProjectChange}
                        disabled={projectsLoading} placeholder={TX.projectPh}
                        options={projects.map((p) => ({ value: p.id, label: `${p.name} (${p.developerName})` }))}
                      />
                    )}
                    <label className={styles.checkboxItem} style={{ marginTop: 8 }}>
                      <input type="checkbox" checked={freeProjectMode}
                        onChange={(e) => { setFreeProjectMode(e.target.checked); setSelectedProject(''); }} />
                      {TX.freeToggle}
                    </label>
                    <p className={styles.hintText}>{!freeProjectMode && selectedProject ? TX.registeredSelected : TX.freeHint}</p>
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{t('proposals.create.proposalTitle')}</label>
                    <input type="text" className={styles.textInput} value={title}
                      onChange={(e) => setTitle(e.target.value)} placeholder={t('proposals.create.proposalTitle')} />
                  </div>
                </div>
              )}

              {/* ADIM 2: MÜLK BİLGİLERİ */}
              {step === 2 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>{TX.unit.type}</label>
                    <input className={styles.textInput} list="prei-unittypes" value={unit.type ?? ''}
                      onChange={(e) => setUnit({ ...unit, type: e.target.value })} placeholder="2+1 / 4+2…" />
                    <datalist id="prei-unittypes">{UNIT_TYPES.map((u) => <option key={u} value={u} />)}</datalist>
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.unit.unitNo}</label>
                    <input className={styles.textInput} value={unit.unitNo ?? ''} onChange={(e) => setUnit({ ...unit, unitNo: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.unit.area}</label>
                    <input type="number" className={styles.textInput} value={unit.area ?? ''}
                      onChange={(e) => setUnit({ ...unit, area: e.target.value ? Number(e.target.value) : undefined })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.unit.netArea}</label>
                    <input type="number" className={styles.textInput} value={unit.netArea ?? ''}
                      onChange={(e) => setUnit({ ...unit, netArea: e.target.value ? Number(e.target.value) : undefined })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.unit.floor}</label>
                    <input className={styles.textInput} value={unit.floor ?? ''} onChange={(e) => setUnit({ ...unit, floor: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.unit.facade}</label>
                    <input className={styles.textInput} value={unit.facade ?? ''} onChange={(e) => setUnit({ ...unit, facade: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.unit.view}</label>
                    <input className={styles.textInput} value={unit.view ?? ''} onChange={(e) => setUnit({ ...unit, view: e.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.unit.beds} / {TX.unit.baths}</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" className={styles.textInput} placeholder={TX.unit.beds} value={unit.bedrooms ?? ''}
                        onChange={(e) => setUnit({ ...unit, bedrooms: e.target.value ? Number(e.target.value) : undefined })} />
                      <input type="number" className={styles.textInput} placeholder={TX.unit.baths} value={unit.bathrooms ?? ''}
                        onChange={(e) => setUnit({ ...unit, bathrooms: e.target.value ? Number(e.target.value) : undefined })} />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.unit.titleDeed}</label>
                    <select className={styles.textInput} value={unit.titleDeed ?? ''}
                      onChange={(e) => setUnit({ ...unit, titleDeed: (e.target.value || undefined) as ProposalUnitDetails['titleDeed'] })}>
                      <option value="">—</option>
                      {TITLE_DEEDS.map((d) => <option key={d} value={d}>{TX.titleDeed[d]}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{TX.unit.features}</label>
                    <input className={styles.textInput} placeholder={TX.unit.featuresPh} value={unit.features ?? ''}
                      onChange={(e) => setUnit({ ...unit, features: e.target.value })} />
                  </div>
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{TX.unit.desc}</label>
                    <textarea className={styles.textInput} rows={3} value={unit.description ?? ''}
                      onChange={(e) => setUnit({ ...unit, description: e.target.value })} />
                  </div>
                </div>
              )}

              {/* ADIM 3: FİNANSAL */}
              {step === 3 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>{TX.currency}</label>
                    <select className={styles.textInput} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.listPrice} ({currency})</label>
                    <input className={styles.textInput} inputMode="numeric" value={groupThousands(listPrice)}
                      onChange={(e) => setListPrice(parseNumeric(e.target.value))} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.discount}</label>
                    <input type="number" className={styles.textInput} value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.finalPrice}</label>
                    <input className={styles.textInput} readOnly value={finalPrice !== undefined ? formatMoney(finalPrice, currency) : '—'}
                      style={{ fontWeight: 700, color: '#9B5BB3' }} />
                  </div>

                  <div className={styles.sectionDivider} style={{ gridColumn: 'span 2' }}>
                    <h4>{t('proposals.create.paymentPlan')}</h4>
                  </div>

                  <div className={styles.paymentPlanBuilder} style={{ gridColumn: 'span 2' }}>
                    {paymentPlan.map((row, idx) => (
                      <div className={styles.paymentRowForm} key={idx}>
                        <input type="text" className={styles.textInput} value={row.milestone}
                          onChange={(e) => updatePaymentRow(idx, { milestone: e.target.value })} />
                        <input type="number" className={styles.textInput} value={row.percentage} style={{ width: 90 }}
                          onChange={(e) => updatePaymentRow(idx, { percentage: e.target.value })} />
                        <input type="text" className={styles.textInput} value={row.date}
                          onChange={(e) => updatePaymentRow(idx, { date: e.target.value })} />
                        <button className={styles.backButton} onClick={() => removePaymentRow(idx)} title="Sil"><Trash size={16} /></button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <Button variant="outline" onClick={addPaymentRow}><Plus size={14} style={{ marginRight: 4 }} /> {TX.addStage}</Button>
                      <span className={styles.hintText} style={{ margin: 0 }}>{TX.total}: %{planTotal}</span>
                    </div>
                    <label className={styles.checkboxItem} style={{ marginTop: 12 }}>
                      <input type="checkbox" checked={paymentPlanOnList} onChange={(e) => setPaymentPlanOnList(e.target.checked)} />
                      {TX.onList}
                    </label>
                  </div>
                </div>
              )}

              {/* ADIM 4: ROI */}
              {step === 4 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>{TX.roi.status}</label>
                    <select className={styles.textInput} value={roi.propertyStatus}
                      onChange={(e) => setRoi({ ...roi, propertyStatus: e.target.value as ProposalRoiInputs['propertyStatus'] })}>
                      {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{TX.propertyStatus[s]}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.roi.model}</label>
                    <select className={styles.textInput} value={roi.rentalType}
                      onChange={(e) => setRoi({ ...roi, rentalType: e.target.value as 'longterm' | 'shortterm' })}>
                      <option value="longterm">{TX.roi.longterm}</option>
                      <option value="shortterm">{TX.roi.shortterm}</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>{TX.roi.monthlyRent}</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className={styles.textInput} inputMode="numeric" value={groupThousands(roi.monthlyRent)}
                        onChange={(e) => setRoi({ ...roi, monthlyRent: parseNumeric(e.target.value) })} />
                      <select className={styles.textInput} style={{ maxWidth: 90 }}
                        value={roi.rentCurrency ?? currency}
                        onChange={(e) => setRoi({ ...roi, rentCurrency: e.target.value })}>
                        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  {roi.rentalType === 'shortterm' ? (
                    <div className={styles.formGroup}>
                      <label>{TX.roi.occupancy}</label>
                      <input type="number" className={styles.textInput} value={roi.occupancyRate ?? ''}
                        onChange={(e) => setRoi({ ...roi, occupancyRate: Number(e.target.value) })} />
                    </div>
                  ) : <div className={styles.formGroup} aria-hidden="true" />}

                  <div className={styles.formGroup}>
                    <label>{TX.roi.appreciation}</label>
                    <input type="number" className={styles.textInput} value={roi.appreciationPercent ?? ''}
                      onChange={(e) => setRoi({ ...roi, appreciationPercent: Number(e.target.value) })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.roi.maintenance}</label>
                    <input type="number" className={styles.textInput} value={roi.maintenancePercent ?? ''}
                      onChange={(e) => setRoi({ ...roi, maintenancePercent: Number(e.target.value) })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.roi.aidat} ({currency})</label>
                    <input className={styles.textInput} inputMode="numeric" value={groupThousands(roi.aidatMonthly)}
                      onChange={(e) => setRoi({ ...roi, aidatMonthly: parseNumeric(e.target.value) })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{TX.roi.mgmt}</label>
                    <input type="number" className={styles.textInput} value={roi.mgmtFeePercent ?? ''}
                      onChange={(e) => setRoi({ ...roi, mgmtFeePercent: Number(e.target.value) })} />
                  </div>

                  <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
                    {roiReport
                      ? <RoiTable r={roiReport} currency={currency} tx={TX} />
                      : <p className={styles.hintText}>{TX.roi.needPrice}</p>}
                  </div>
                </div>
              )}

              {/* ADIM 5: MATERYALLER + ÖNİZLEME */}
              {step === 5 && (
                <div className={styles.previewContainer}>
                  <div className={styles.formGroup}>
                    <label>{TX.materials}</label>
                    <div className={styles.checkboxList}>
                      <label className={styles.checkboxItem}><input type="checkbox" checked={includeBrochurePdf} onChange={(e) => setIncludeBrochurePdf(e.target.checked)} /> {t('proposals.create.brochurePdf')}</label>
                      <label className={styles.checkboxItem}><input type="checkbox" checked={includeFloorPlans} onChange={(e) => setIncludeFloorPlans(e.target.checked)} /> {t('proposals.create.floorPlansPdf')}</label>
                      <label className={styles.checkboxItem}><input type="checkbox" checked={includeRoiSheet} onChange={(e) => setIncludeRoiSheet(e.target.checked)} /> {t('proposals.create.roiSheet')}</label>
                    </div>
                  </div>
                  {selectedProjectObj && selectedProjectObj.images.length > 0 && (
                    <div className={styles.formGroup} style={{ marginTop: 16 }}>
                      <label>{t('proposals.create.selectPhotos')}</label>
                      <div className={styles.photoGrid}>
                        {selectedProjectObj.images.map((img) => (
                          <div key={img} className={`${styles.photoItem} ${selectedPhotos.includes(img) ? styles.photoSelected : ''}`}
                            onClick={() => togglePhoto(img)} role="button" tabIndex={0}>
                            <img src={img} alt="" />
                            {selectedPhotos.includes(img) && <div className={styles.checkOverlay}><CheckCircle size={24} /></div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className={styles.formGroup} style={{ margin: '16px 0' }}>
                    <label>{TX.notes}</label>
                    <textarea className={styles.textInput} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>

                  <div className={styles.digitalProposal} data-print-root>
                    <div className={styles.proposalHeader}>
                      <div className={styles.brandLogo}><Buildings size={28} /><span>ProDuality</span></div>
                      <div className={styles.proposalMeta}>
                        <div>{t('proposals.view.preparedFor', { name: selectedClientObj?.name ?? '—' })}</div>
                        <div className={styles.metaDate}>{t('proposals.view.date', { date: new Date().toLocaleDateString(dateLocale) })}</div>
                      </div>
                    </div>

                    <div className={styles.proposalCover}>
                      <img src={coverImage} alt="Cover" className={styles.coverImage} />
                      <div className={styles.coverText} data-print-cover>
                        <h2>{t('proposals.view.coverTag')}</h2>
                        <h1>{title || projectName || '—'}</h1>
                        <p>{projectName}{selectedProjectObj?.location ? ` · ${selectedProjectObj.location}` : ''}</p>
                      </div>
                    </div>

                    <div className={styles.proposalBody}>
                      <UnitSection unit={unit} tx={TX} />

                      <div className={styles.bodySection}>
                        <h3>{t('proposals.view.financialSummary')}</h3>
                        <div className={styles.financialSummary}>
                          {(discountNum > 0 && listPrice) ? (
                            <div className={styles.finBox}><span>{TX.listPrice}</span>
                              <strong style={{ textDecoration: 'line-through', opacity: .7 }}>{formatMoney(listPrice, currency)}</strong></div>
                          ) : null}
                          <div className={styles.finBox}><span>{(discountNum > 0 && listPrice) ? TX.finalPrice : t('proposals.view.totalInvestment')}</span>
                            <strong>{finalPrice !== undefined ? formatMoney(finalPrice, currency) : '—'}</strong></div>
                          <div className={styles.finBox}><span>{t('proposals.view.handover')}</span>
                            <strong>{selectedProjectObj?.completionDate ?? '—'}</strong></div>
                        </div>
                      </div>

                      <div className={styles.bodySection}>
                        <h3>{t('proposals.view.paymentPlan')}</h3>
                        <table className={styles.previewTable}>
                          <thead><tr><th>{t('proposals.view.milestone')}</th><th>{t('proposals.view.percentage')}</th><th>{t('proposals.view.planDate')}</th></tr></thead>
                          <tbody>{paymentPlan.filter((r) => r.milestone.trim()).map((row, idx) => (
                            <tr key={idx}><td>{row.milestone}</td><td>{row.percentage}%</td><td>{row.date}</td></tr>
                          ))}</tbody>
                        </table>
                        {paymentPlanOnList && <p className={styles.hintText}>* {TX.onList}</p>}
                      </div>

                      {roiReport && (
                        <div className={styles.bodySection}>
                          <h3>{TX.steps.roi[0]}</h3>
                          <RoiTable r={roiReport} currency={currency} tx={TX} />
                        </div>
                      )}

                      {notes.trim() && (
                        <div className={styles.bodySection}><h3>{TX.notes}</h3><p style={{ opacity: .85 }}>{notes}</p></div>
                      )}
                    </div>
                  </div>

                  <div className={styles.previewActions}>
                    <Button variant="outline" onClick={() => printProposal()}><DownloadSimple size={16} style={{ marginRight: 6 }} /> {t('proposals.create.downloadAsPdf')}</Button>
                    <Button variant="outline" onClick={handleSaveDraft} disabled={busy !== ''}>{busy === 'draft' ? TX.saving : TX.saveDraft}</Button>
                    <Button variant="primary" onClick={handleSend} disabled={busy !== '' || !clientEmail}>
                      <PaperPlaneTilt size={16} style={{ marginRight: 6 }} /> {busy === 'send' ? TX.sending : TX.saveSend}
                    </Button>
                  </div>
                  {!clientEmail && <p className={styles.hintText}>{TX.noEmailAction}</p>}
                </div>
              )}

            </CardBody>
          </Card>

          <div className={styles.navigationFooter}>
            <Button variant="outline" onClick={() => setStep((p) => Math.max(1, p - 1))} disabled={step === 1}>
              {t('proposals.create.previousStep')}
            </Button>
            {step < TOTAL_STEPS ? (
              <Button variant="primary" onClick={() => setStep((p) => Math.min(TOTAL_STEPS, p + 1))} disabled={step === 1 && !canProceed1}>
                {t('proposals.create.nextStep')}
              </Button>
            ) : (
              <Button variant="primary" onClick={handleSend} disabled={busy !== '' || !clientEmail}>
                {busy === 'send' ? TX.sending : t('proposals.create.sendToClient')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={modal !== ''} onClose={closeModal}
        title={modal === 'sent' ? t('proposals.create.successTitle') : TX.draftTitle}
        footer={<Button variant="primary" onClick={closeModal}>{t('proposals.create.backToProposals')}</Button>}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: 16 }} />
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {modal === 'sent'
              ? <>{t('proposals.create.successBody')}<br />{t('proposals.create.successBody2')}</>
              : TX.draftBody}
          </p>
        </div>
      </Modal>
    </div>
  );
};

type Tx = typeof DICT.tr;

const UnitSection: React.FC<{ unit: ProposalUnitDetails; tx: Tx }> = ({ unit, tx }) => {
  const rows: Array<[string, string]> = [];
  const push = (k: string, v?: string | number, sfx = '') => {
    if (v !== undefined && v !== null && v !== '') rows.push([k, `${v}${sfx}`]);
  };
  push(tx.unit.type, unit.type); push(tx.unit.unitNo, unit.unitNo);
  push(tx.unit.area, unit.area, ' m²'); push(tx.unit.netArea, unit.netArea, ' m²');
  push(tx.unit.floor, unit.floor); push(tx.unit.facade, unit.facade);
  push(tx.unit.view, unit.view); push(tx.unit.beds, unit.bedrooms); push(tx.unit.baths, unit.bathrooms);
  if (unit.titleDeed) push(tx.unit.titleDeed, tx.titleDeed[unit.titleDeed]);
  if (rows.length === 0 && !unit.features && !unit.description) return null;
  return (
    <div className={styles.bodySection}>
      <h3>{tx.steps.unit[0]}</h3>
      {rows.length > 0 && (
        <table className={styles.previewTable}><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
      )}
      {unit.features && <p style={{ marginTop: 8 }}><strong>{tx.unit.features}:</strong> {unit.features}</p>}
      {unit.description && <p style={{ marginTop: 6, opacity: .85 }}>{unit.description}</p>}
    </div>
  );
};

const RoiTable: React.FC<{ r: import('../../core/types').ProposalRoiReport; currency: string; tx: Tx }> = ({ r, currency, tx }) => (
  <table className={styles.previewTable}>
    <tbody>
      <tr><td>{tx.roi.grossYield}</td><td>%{r.grossYieldPct}</td></tr>
      <tr><td>{tx.roi.netYield}</td><td>%{r.netYieldPct}</td></tr>
      <tr><td>{tx.roi.annualNet}</td><td>{formatMoney(r.annualNetRent, currency)}</td></tr>
      <tr><td>{tx.roi.annualAppr}</td><td>{formatMoney(r.annualAppreciation, currency)} (%{r.appreciationPct})</td></tr>
      <tr><td><strong>{tx.roi.totalReturn}</strong></td><td><strong style={{ color: '#9B5BB3' }}>%{r.annualTotalReturnPct}</strong></td></tr>
    </tbody>
  </table>
);
