import React, { useState } from 'react';
import { Card, CardBody } from '../../core/components/Card/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { FileText, Download, X, Building, Calendar, Percent, ShieldCheck } from 'lucide-react';
import styles from './Contracts.module.css';

// --- MOCK DATA ---
const mockContracts = [
  {
    id: 'C-1001',
    developer: 'Emaar Properties',
    project: 'Downtown Views II',
    status: 'Active',
    startDate: '2025-01-01',
    expiryDate: '2026-12-31',
    commission: '5%',
    legalEntity: 'Emaar Development PJSC',
    paymentTerms: '30 Days Net',
    documents: [
      { id: 'd1', name: 'Agency Agreement_Emaar_2025.pdf', size: '2.4 MB' },
      { id: 'd2', name: 'Marketing Guidelines.pdf', size: '1.1 MB' },
      { id: 'd3', name: 'NOC Template.pdf', size: '450 KB' },
    ]
  },
  {
    id: 'C-1002',
    developer: 'Nakheel',
    project: 'Palm Beach Towers',
    status: 'Active',
    startDate: '2024-06-15',
    expiryDate: '2025-06-14',
    commission: '4%',
    legalEntity: 'Nakheel PJSC',
    paymentTerms: '45 Days Net',
    documents: [
      { id: 'd4', name: 'Nakheel_Broker_Agreement.pdf', size: '3.1 MB' },
      { id: 'd5', name: 'Commission Structure Annex.pdf', size: '800 KB' },
    ]
  },
  {
    id: 'C-1003',
    developer: 'Damac Properties',
    project: 'Damac Hills',
    status: 'Expiring',
    startDate: '2023-08-01',
    expiryDate: '2024-07-31',
    commission: '6%',
    legalEntity: 'Damac Real Estate Dev.',
    paymentTerms: '15 Days Net',
    documents: [
      { id: 'd6', name: 'Damac_Agency_Contract.pdf', size: '1.9 MB' },
      { id: 'd7', name: 'KYC Documents.pdf', size: '5.2 MB' },
    ]
  },
  {
    id: 'C-1004',
    developer: 'Meraas',
    project: 'City Walk',
    status: 'Expired',
    startDate: '2022-01-01',
    expiryDate: '2023-01-01',
    commission: '5%',
    legalEntity: 'Meraas Holding',
    paymentTerms: '30 Days Net',
    documents: [
      { id: 'd8', name: 'Old_Agreement_Meraas.pdf', size: '2.0 MB' },
    ]
  }
];

export const ContractsList: React.FC = () => {
  const [selectedContract, setSelectedContract] = useState<typeof mockContracts[0] | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': return <span className={`${styles.statusBadge} ${styles.statusActive}`}>Active</span>;
      case 'Expiring': return <span className={`${styles.statusBadge} ${styles.statusExpiring}`}>Expiring Soon</span>;
      case 'Expired': return <span className={`${styles.statusBadge} ${styles.statusExpired}`}>Expired</span>;
      default: return <span className={styles.statusBadge}>{status}</span>;
    }
  };

  const toast = useToast();

  const handleDownload = (docName: string) => {
    toast.info(`${docName} indiriliyor…`);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Developer Contracts</h1>
          <p className={styles.subtitle}>Manage agency agreements and commission structures.</p>
        </div>
      </div>

      <Card>
        <CardBody padding="none">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Developer</TableHeader>
                <TableHeader>Associated Project</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Commission</TableHeader>
                <TableHeader>Expiry Date</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockContracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>{contract.developer}</TableCell>
                  <TableCell>{contract.project}</TableCell>
                  <TableCell>{getStatusBadge(contract.status)}</TableCell>
                  <TableCell>{contract.commission}</TableCell>
                  <TableCell>{contract.expiryDate}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedContract(contract)}>
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Contract Details Modal */}
      {selectedContract && (
        <div className={styles.modalOverlay} onClick={() => setSelectedContract(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <FileText size={24} color="var(--color-primary-purple)" />
                {selectedContract.developer} - Agreement Details
              </div>
              <button className={styles.closeButton} onClick={() => setSelectedContract(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}><Building size={12} style={{display:'inline', marginRight: 4}}/> Legal Entity</span>
                  <span className={styles.detailValue}>{selectedContract.legalEntity}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}><ShieldCheck size={12} style={{display:'inline', marginRight: 4}}/> Status</span>
                  <span className={styles.detailValue}>{getStatusBadge(selectedContract.status)}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}><Calendar size={12} style={{display:'inline', marginRight: 4}}/> Valid From</span>
                  <span className={styles.detailValue}>{selectedContract.startDate}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}><Calendar size={12} style={{display:'inline', marginRight: 4}}/> Valid To (Expiry)</span>
                  <span className={styles.detailValue}>{selectedContract.expiryDate}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}><Percent size={12} style={{display:'inline', marginRight: 4}}/> Commission Rate</span>
                  <span className={styles.detailValue}>{selectedContract.commission}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Payment Terms</span>
                  <span className={styles.detailValue}>{selectedContract.paymentTerms}</span>
                </div>
              </div>

              <div>
                <h3 className={styles.sectionTitle}>
                  <FileText size={18} /> Attached PDF Documents
                </h3>
                <div className={styles.documentsList}>
                  {selectedContract.documents.map(doc => (
                    <div key={doc.id} className={styles.documentItem}>
                      <div className={styles.documentInfo}>
                        <div className={styles.documentIcon}>
                          <FileText size={24} />
                        </div>
                        <div>
                          <div className={styles.documentName}>{doc.name}</div>
                          <div className={styles.documentSize}>{doc.size} • PDF Document</div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(doc.name)}>
                        <Download size={16} style={{ marginRight: 8 }}/> Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
