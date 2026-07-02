import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../core/components/Card/Card';
import type { LeadDTO } from '../../core/types';
import { leadsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { DotsThree, Plus, SquaresFour, ListBullets } from '@phosphor-icons/react';
import styles from './LeadsPipeline.module.css';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Field, Input, Select, Textarea, FormRow } from '../../core/components/Form/Form';
import { TableSkeleton } from '../../core/components/Skeleton/Skeleton';

const PIPELINE_STAGES = [
  'New Lead', 'Contacted', 'Qualified', 'Meeting Scheduled', 
  'Proposal Sent', 'Negotiation', 'Reservation', 'Closed Won', 'Closed Lost'
];

type ViewMode = 'kanban' | 'list';

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

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

      {viewMode === 'kanban' ? (
        <div className={styles.board}>
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = leads.filter(l => l.status === stage);
            const stageValue = stageLeads.reduce((sum, l) => sum + l.value, 0);
            
            return (
              <div key={stage} className={styles.column}>
                <div className={styles.columnHeader}>
                  <h3 className={styles.columnTitle}>{stage}</h3>
                  <div className={styles.columnMeta}>
                    <span className={styles.leadCount}>{stageLeads.length}</span>
                    <span className={styles.stageValue}>{formatCurrency(stageValue)}</span>
                  </div>
                </div>
                
                <div className={styles.columnBody}>
                  {stageLeads.map(lead => (
                    <Card key={lead.id} padding="md" className={styles.leadCard}>
                      <div className={styles.leadHeader}>
                        <Link to={`/clients/${lead.id}`} className={styles.leadName}>{lead.name}</Link>
                        <button className={styles.moreButton}><DotsThree size={18} weight="bold" /></button>
                      </div>
                      <div className={styles.leadCompany}>{lead.company}</div>
                      <div className={styles.leadFooter}>
                        <span className={styles.leadValue}>{formatCurrency(lead.value)}</span>
                        <span className={`${styles.riskBadge} ${styles[lead.aiRiskScore.toLowerCase()]}`}>
                          Risk: {lead.aiRiskScore}
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
                <TableHeader>Value</TableHeader>
                <TableHeader>Probability</TableHeader>
                <TableHeader>AI Risk Score</TableHeader>
                <TableHeader align="right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {leads.map(lead => (
                <TableRow key={lead.id}>
                  <TableCell style={{ fontWeight: 600 }}><Link to={`/clients/${lead.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{lead.name}</Link></TableCell>
                  <TableCell>{lead.company}</TableCell>
                  <TableCell>
                    <span className={styles.statusBadge}>{lead.status}</span>
                  </TableCell>
                  <TableCell><span className={styles.numCell}>{formatCurrency(lead.value)}</span></TableCell>
                  <TableCell><span className={styles.numCell}>{lead.probability}%</span></TableCell>
                  <TableCell>
                    <span className={`${styles.riskBadge} ${styles[lead.aiRiskScore.toLowerCase()]}`}>
                      {lead.aiRiskScore}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <button className={styles.moreButton}><DotsThree size={18} weight="bold" /></button>
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
              toast.success("Aday kaydedildi");
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
