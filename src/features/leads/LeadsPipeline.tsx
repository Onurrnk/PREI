import React, { useEffect, useState } from 'react';
import { Card } from '../../core/components/Card/Card';
import type { LeadDTO, LeadStatus } from '../../core/types';
import { leadsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { DotsThree, Plus, SquaresFour, ListBullets, UsersThree } from '@phosphor-icons/react';
import styles from './LeadsPipeline.module.css';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Field, Input, Select, Textarea, FormRow } from '../../core/components/Form/Form';
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

// Qualification skoru (0..100) → renk bandı. Yüksek skor = daha nitelikli.
function scoreBand(score: number | null): 'low' | 'medium' | 'high' {
  if (score === null || score < 40) return 'low';
  if (score < 70) return 'medium';
  return 'high';
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

export const LeadsPipeline: React.FC = () => {
  const { data, loading, error } = useFetch<LeadDTO[]>(() => leadsApi.list(), []);
  const leads = data ?? [];

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const savedMode = localStorage.getItem('prei_leads_viewMode');
    return (savedMode as ViewMode) || 'kanban';
  });

  useEffect(() => {
    localStorage.setItem('prei_leads_viewMode', viewMode);
  }, [viewMode]);
  const [showAddModal, setShowAddModal] = useState(false);
  const toast = useToast();

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
                    <Card key={lead.id} padding="md" className={styles.leadCard}>
                      <div className={styles.leadHeader}>
                        <span className={styles.leadName}>{lead.contactName || 'İsimsiz aday'}</span>
                        <button className={styles.moreButton}><DotsThree size={18} weight="bold" /></button>
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
                <TableRow key={lead.id}>
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
        onClose={() => setShowAddModal(false)}
        title="Add New Lead"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              // Aday oluşturma mevcut bir contact gerektirir (contact_id).
              // Contacts modülü Faz 1'in sıradaki adımında bağlanınca bu form
              // gerçek POST /api/leads'e kablolanır.
              toast.info('Aday oluşturma Contacts modülüyle birlikte bağlanacak (sıradaki adım).');
              setShowAddModal(false);
            }}>Save Lead</Button>
          </>
        }
      >
        <div className={styles.formStack}>
          <FormRow>
            <Field label="Full Name">
              <Input type="text" placeholder="e.g. Arda Yılmazer" />
            </Field>
            <Field label="Company / Affiliation">
              <Input type="text" placeholder="e.g. Bosphorus Holding" />
            </Field>
          </FormRow>

          <FormRow>
            <Field label="Email Address">
              <Input type="email" placeholder="arda@bosphorusholding.com" />
            </Field>
            <Field label="Phone Number">
              <Input type="tel" placeholder="+971 50 217 4863" />
            </Field>
          </FormRow>

          <Field label="Interested Project">
            <Select defaultValue="">
              <option value="">Select Project...</option>
              <option value="p1">Marina Vista (Emaar)</option>
              <option value="p2">Safa Two (DAMAC)</option>
              <option value="p3">Palm Beach Towers (Nakheel)</option>
            </Select>
          </Field>

          <FormRow>
            <Field label="Estimated Value (USD)">
              <Input type="number" placeholder="e.g. 1500000" />
            </Field>
            <Field label="Priority">
              <Select defaultValue="medium">
                <option value="high">High (Hot Lead)</option>
                <option value="medium">Medium</option>
                <option value="low">Low (Cold Lead)</option>
              </Select>
            </Field>
          </FormRow>

          <Field label="Notes">
            <Textarea placeholder="Initial contact details or special requirements..." rows={3} />
          </Field>
        </div>
      </Modal>
    </div>
  );
};
