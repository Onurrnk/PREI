import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../core/components/Card/Card';
import type { LeadDTO, LeadStatus, LeadInterest, LeadPriority } from '../../core/types';
import { leadsApi, contactsApi } from '../../core/api/resources';
import { ApiError } from '../../core/api/client';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { DotsThree, Plus, SquaresFour, ListBullets, UsersThree } from '@phosphor-icons/react';
import styles from './LeadsPipeline.module.css';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Field, Input, Textarea, FormRow } from '../../core/components/Form/Form';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';

// Kanban kolonları = backend lead_status enum (7 değer). Dondurulmuş 9-aşamalı
// tasarım Faz 1'de DB'nin tek doğruluk kaynağına hizalandı.
const PIPELINE_STAGES: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'nurturing', label: 'Nurturing' },
  { value: 'converted', label: 'Converted' },
  { value: 'unqualified', label: 'Unqualified' },
  { value: 'lost', label: 'Lost' },
];

const STATUS_LABEL: Record<LeadStatus, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.value, s.label]),
) as Record<LeadStatus, string>;

type ViewMode = 'kanban' | 'list';

// Qualification skoru (0..100) → renk bandı. Yüksek skor = daha nitelikli (yeşil);
// düşük = zayıf (kırmızı); skorsuz = nötr. NOT: eski aiRiskScore'un tersi semantik.
function scoreBand(score: number | null): 'weak' | 'moderate' | 'strong' | 'unscored' {
  if (score === null) return 'unscored';
  if (score < 40) return 'weak';
  if (score < 70) return 'moderate';
  return 'strong';
}

function formatMoney(value: number | null, currency: string): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

// Kart/tablo için bütçe: max varsa onu, yoksa min'i göster.
function leadBudget(lead: LeadDTO): string {
  return formatMoney(lead.budgetMax ?? lead.budgetMin, lead.currency);
}

// Aktif pazarlar (K-6) ve para birimi eşlemesi — seed ile tutarlı.
const MARKETS: { code: string; label: string; currency: string }[] = [
  { code: 'TR', label: 'Türkiye', currency: 'TRY' },
  { code: 'AE', label: 'BAE / Dubai', currency: 'AED' },
  { code: 'ES', label: 'İspanya', currency: 'EUR' },
  { code: 'GB', label: 'İngiltere', currency: 'GBP' },
];

interface NewLeadForm {
  fullName: string;
  email: string;
  phone: string;
  interest: LeadInterest;
  market: string;
  value: string;
  priority: LeadPriority;
  notes: string;
}

const EMPTY_FORM: NewLeadForm = {
  fullName: '', email: '', phone: '', interest: 'buy',
  market: 'AE', value: '', priority: 'medium', notes: '',
};

export const LeadsPipeline: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch<LeadDTO[]>(() => leadsApi.list(), []);
  const leads = data ?? [];

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const savedMode = localStorage.getItem('prei_leads_viewMode');
    return (savedMode as ViewMode) || 'kanban';
  });

  useEffect(() => {
    localStorage.setItem('prei_leads_viewMode', viewMode);
  }, [viewMode]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<NewLeadForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const setField = <K extends keyof NewLeadForm>(key: K, value: NewLeadForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const closeModal = () => {
    setShowAddModal(false);
    setForm(EMPTY_FORM);
  };

  const handleCreate = async () => {
    const name = form.fullName.trim();
    if (!name) {
      toast.error('Ad Soyad zorunlu.');
      return;
    }
    const [firstName, ...rest] = name.split(/\s+/);
    const lastName = rest.join(' ') || undefined;
    const market = MARKETS.find((m) => m.code === form.market);
    const valueNum = form.value ? Number(form.value) : undefined;

    setSaving(true);
    try {
      // 1) Kişi (dedup: aynı telefon → mevcut kişi). 2) Lead (kişiye bağlı).
      const contact = await contactsApi.create({
        first_name: firstName,
        last_name: lastName,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      await leadsApi.create({
        contact_id: contact.id,
        status: 'new',
        interest_type: form.interest,
        priority: form.priority,
        budget_max: Number.isFinite(valueNum) ? valueNum : undefined,
        currency: market?.currency,
        target_market_code: form.market,
        notes: form.notes.trim() || undefined,
      });
      toast.success(`Aday oluşturuldu: ${name}`);
      closeModal();
      refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Aday kaydedilemedi.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <TableSkeleton rows={7} />;
  }

  if (error) {
    return <div className={styles.errorState}>Adaylar yüklenemedi: {error}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Leads Pipeline</h1>
          <p className={styles.subtitle}>Manage your property investment opportunities</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'kanban' ? styles.active : ''}`}
              onClick={() => setViewMode('kanban')}
              title="Kanban View"
            >
              <SquaresFour size={18} />
            </button>
            <button
              className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <ListBullets size={18} />
            </button>
          </div>
          <Button variant="primary" onClick={() => setShowAddModal(true)}><Plus size={16} /> New Lead</Button>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className={styles.emptyState}>
          <UsersThree size={40} weight="thin" />
          <h3>Henüz aday yok</h3>
          <p>Yeni bir aday ekleyin ya da WhatsApp/reklam kanallarından gelen ilk temaslar burada görünecek.</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className={styles.board}>
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.status === stage.value);
            const stageValue = stageLeads.reduce((sum, l) => sum + (l.budgetMax ?? l.budgetMin ?? 0), 0);

            return (
              <div key={stage.value} className={styles.column}>
                <div className={styles.columnHeader}>
                  <h3 className={styles.columnTitle}>{stage.label}</h3>
                  <div className={styles.columnMeta}>
                    <span className={styles.leadCount}>{stageLeads.length}</span>
                    <span className={styles.stageValue}>{formatMoney(stageValue, stageLeads[0]?.currency ?? 'EUR')}</span>
                  </div>
                </div>

                <div className={styles.columnBody}>
                  {stageLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      padding="md"
                      className={styles.leadCard}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/leads/${lead.id}`); }}
                    >
                      <div className={styles.leadHeader}>
                        <span className={styles.leadName}>{lead.contactName || 'İsimsiz aday'}</span>
                        <button
                          className={styles.moreButton}
                          onClick={(e) => e.stopPropagation()}
                        ><DotsThree size={18} weight="bold" /></button>
                      </div>
                      <div className={styles.leadCompany}>{lead.company ?? '—'}</div>
                      <div className={styles.leadFooter}>
                        <span className={styles.leadValue}>{leadBudget(lead)}</span>
                        <span className={`${styles.riskBadge} ${styles[scoreBand(lead.score)]}`}>
                          Skor: {lead.score ?? '—'}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.listView}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Company</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Budget</TableHeader>
                <TableHeader>Interest</TableHeader>
                <TableHeader align="right">Score</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <TableCell style={{ fontWeight: 600 }}>{lead.contactName || 'İsimsiz aday'}</TableCell>
                  <TableCell>{lead.company ?? '—'}</TableCell>
                  <TableCell>
                    <span className={styles.statusBadge}>{STATUS_LABEL[lead.status]}</span>
                  </TableCell>
                  <TableCell><span className={styles.numCell}>{leadBudget(lead)}</span></TableCell>
                  <TableCell>{lead.interestType}</TableCell>
                  <TableCell align="right">
                    <span className={`${styles.riskBadge} ${styles[scoreBand(lead.score)]}`}>
                      {lead.score ?? '—'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={closeModal}
        title="Add New Lead"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Save Lead'}
            </Button>
          </>
        }
      >
        <div className={styles.formStack}>
          <FormRow>
            <Field label="Full Name">
              <Input type="text" placeholder="e.g. Arda Yılmazer"
                value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} />
            </Field>
            <Field label="Email Address">
              <Input type="email" placeholder="arda@bosphorusholding.com"
                value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </Field>
          </FormRow>

          <FormRow>
            <Field label="Phone Number">
              <Input type="tel" placeholder="+971 50 217 4863"
                value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </Field>
            <Field label="Target Market">
              <SelectMenu
                aria-label="Target Market"
                value={form.market}
                onChange={(v) => setField('market', v)}
                options={MARKETS.map((m) => ({ value: m.code, label: `${m.label} (${m.currency})` }))}
              />
            </Field>
          </FormRow>

          <FormRow>
            <Field label="Interest">
              <SelectMenu
                aria-label="Interest"
                value={form.interest}
                onChange={(v) => setField('interest', v as LeadInterest)}
                options={[
                  { value: 'buy', label: 'Buy' },
                  { value: 'rent', label: 'Rent' },
                  { value: 'invest', label: 'Invest' },
                  { value: 'sell', label: 'Sell' },
                ]}
              />
            </Field>
            <Field label="Priority">
              <SelectMenu
                aria-label="Priority"
                value={form.priority}
                onChange={(v) => setField('priority', v as LeadPriority)}
                options={[
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
              />
            </Field>
          </FormRow>

          <Field label={`Estimated Value (${MARKETS.find((m) => m.code === form.market)?.currency ?? 'EUR'})`}>
            <Input type="number" placeholder="e.g. 1500000"
              value={form.value} onChange={(e) => setField('value', e.target.value)} />
          </Field>

          <Field label="Notes">
            <Textarea placeholder="Initial contact details or special requirements..." rows={3}
              value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
};
