import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../core/components/Card/Card';
import type { LeadDTO } from '../../core/types';
import { leadsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { MoreHorizontal, Plus, LayoutGrid, List } from 'lucide-react';
import styles from './LeadsPipeline.module.css';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';

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
    return <div className={styles.loading}>Loading Pipeline...</div>;
  }

  if (error) {
    return <div className={styles.loading}>Adaylar yüklenemedi: {error}</div>;
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
              <LayoutGrid size={18} />
            </button>
            <button 
              className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <List size={18} />
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
                        <button className={styles.moreButton}><MoreHorizontal size={16} /></button>
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
                  <TableCell>{formatCurrency(lead.value)}</TableCell>
                  <TableCell>{lead.probability}%</TableCell>
                  <TableCell>
                    <span className={`${styles.riskBadge} ${styles[lead.aiRiskScore.toLowerCase()]}`}>
                      {lead.aiRiskScore}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <button className={styles.moreButton}><MoreHorizontal size={16} /></button>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Full Name</label>
              <input type="text" placeholder="e.g. Michael Smith" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Company / Affiliation</label>
              <input type="text" placeholder="e.g. Global Tech LLC" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Email Address</label>
              <input type="email" placeholder="michael@example.com" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Phone Number</label>
              <input type="tel" placeholder="+971 50 123 4567" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Interested Project</label>
            <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
              <option value="">Select Project...</option>
              <option value="p1">Marina Vista (Emaar)</option>
              <option value="p2">Safa Two (DAMAC)</option>
              <option value="p3">Palm Beach Towers (Nakheel)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Estimated Value (USD)</label>
              <input type="number" placeholder="e.g. 1500000" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Priority</label>
              <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
                <option value="high">High (Hot Lead)</option>
                <option value="medium">Medium</option>
                <option value="low">Low (Cold Lead)</option>
              </select>
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Notes</label>
            <textarea placeholder="Initial contact details or special requirements..." rows={3} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', resize: 'vertical' }}></textarea>
          </div>
        </div>
      </Modal>
    </div>
  );
};
