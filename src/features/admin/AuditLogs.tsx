import React, { useState } from 'react';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { ShieldAlert, Search, Users, X, Activity, DollarSign } from 'lucide-react';
import { Button } from '../../core/components/Button/Button';
import styles from './AuditLogs.module.css';

// --- MOCK DATA FOR ACCOUNT SUMMARIES ---
const mockAdminUsers = [
  {
    id: 'U-101',
    name: 'Sarah Connor',
    role: 'Senior Consultant',
    status: 'Active',
    lastActive: '2 mins ago',
    clientsRegistered: 42,
    kpis: {
      salesVolume: '$12,450,000',
      commission: '$373,500',
      activeDeals: 8,
      conversionRate: '18%'
    },
    pipeline: {
      hotLeads: 2,
      activeLeads: 1,
      negotiating: 1,
      frozen: 2,
      lost: 1
    },
    pipelineClients: [
      { id: 'pc1', status: 'hotLeads', name: 'John Doe', property: 'Marina Vista', date: 'Today', reason: 'Ready with cash offer.' },
      { id: 'pc2', status: 'hotLeads', name: 'Al Fayed', property: 'Downtown Views II', date: 'Yesterday', reason: 'Loved the penthouse viewing.' },
      { id: 'pc3', status: 'activeLeads', name: 'Alice Smith', property: 'Emaar Beachfront', date: 'Monday', reason: 'Browsing options.' },
      { id: 'pc4', status: 'negotiating', name: 'Bob Johnson', property: 'Palm Jumeirah', date: 'Last Week', reason: 'Negotiating 5% discount.' },
      { id: 'pc5', status: 'frozen', name: 'Charlie Brown', property: 'City Walk', date: 'Jan 10', reason: 'Budget constraints, revisiting in 6 months.' },
      { id: 'pc6', status: 'frozen', name: 'Diana Prince', property: 'Damac Hills', date: 'Feb 15', reason: 'Relocation delayed.' },
      { id: 'pc7', status: 'lost', name: 'Bruce Wayne', property: 'JBR Penthouse', date: 'Mar 01', reason: 'Bought with a competitor agency.' }
    ],
    transactions: [
      { id: 'tx1', property: 'Marina Vista 2BR', client: 'John Doe', amount: '$1,200,000', status: 'Closed Won' },
      { id: 'tx2', property: 'Emaar Beachfront', client: 'Alice Smith', amount: '$3,500,000', status: 'Pending' },
      { id: 'tx3', property: 'Downtown Views II', client: 'Mr. Al Fayed', amount: '$850,000', status: 'Closed Won' }
    ],
    timeline: [
      { id: 'tl1', time: 'Today, 10:45 AM', text: 'Registered a new client: Mr. Al Fayed.' },
      { id: 'tl2', time: 'Yesterday, 14:20 PM', text: 'Downloaded Emaar Agency Agreement PDF.' },
      { id: 'tl3', time: 'Monday, 09:00 AM', text: 'Closed deal for Marina Vista 2BR ($1.2M).' }
    ]
  },
  {
    id: 'U-102',
    name: 'Michael Scott',
    role: 'Sales Manager',
    status: 'Active',
    lastActive: '1 hour ago',
    clientsRegistered: 120,
    kpis: {
      salesVolume: '$4,100,000',
      commission: '$123,000',
      activeDeals: 3,
      conversionRate: '12%'
    },
    pipeline: {
      hotLeads: 1,
      activeLeads: 1,
      negotiating: 0,
      frozen: 1,
      lost: 0
    },
    pipelineClients: [
      { id: 'pc8', status: 'hotLeads', name: 'Dunder Mifflin', property: 'Office Space', date: 'Today', reason: 'Needs expansion immediately.' },
      { id: 'pc9', status: 'activeLeads', name: 'Jim Halpert', property: 'Townhouse', date: 'Yesterday', reason: 'Checking family homes.' },
      { id: 'pc10', status: 'frozen', name: 'Pam Beesly', property: 'Art Studio', date: 'Last Month', reason: 'Waiting for loan approval.' }
    ],
    transactions: [
      { id: 'tx4', property: 'Palm Jumeirah Villa', client: 'Dunder Mifflin', amount: '$4,100,000', status: 'Closed Won' }
    ],
    timeline: [
      { id: 'tl4', time: 'Yesterday, 16:00 PM', text: 'Exported Leads CSV for Q2 Pipeline.' },
      { id: 'tl5', time: 'Last Week', text: 'Sent Weekly Performance Report to Team.' }
    ]
  },
  {
    id: 'U-103',
    name: 'Jane Foster',
    role: 'Junior Agent',
    status: 'Inactive',
    lastActive: '3 days ago',
    clientsRegistered: 8,
    kpis: {
      salesVolume: '$0',
      commission: '$0',
      activeDeals: 1,
      conversionRate: '0%'
    },
    pipeline: {
      hotLeads: 0,
      activeLeads: 0,
      negotiating: 0,
      frozen: 0,
      lost: 1
    },
    pipelineClients: [
      { id: 'pc11', status: 'lost', name: 'Thor Odinson', property: 'Asgard Villa', date: 'Dec 01, 2025', reason: 'Moved out of country.' }
    ],
    transactions: [
      { id: 'tx5', property: 'City Walk 1BR', client: 'Thor Odinson', amount: '$600,000', status: 'Lost' }
    ],
    timeline: [
      { id: 'tl6', time: 'Dec 01, 2025', text: 'Registered client Thor Odinson.' }
    ]
  }
];

export const AuditLogs: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<typeof mockAdminUsers[0] | null>(null);
  const [selectedPipelineCategory, setSelectedPipelineCategory] = useState<string | null>(null);

  const filteredUsers = mockAdminUsers.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <ShieldAlert size={28} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>User Management & Performance</h1>
            <p className={styles.subtitle}>Track user accounts, business performance, and operational activities.</p>
          </div>
        </div>
      </div>

      <Card className={styles.tableCard}>
        <CardHeader className={styles.tableHeaderSection}>
          <div className={styles.filters}>
            <div className={styles.searchBar}>
              <Search size={16} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Search by name or role..." 
                className={styles.searchInput}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardBody className={styles.tableBody}>
          <div className={styles.tableWrapper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>User Name</TableHeader>
                  <TableHeader>Role</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Last Active</TableHeader>
                  <TableHeader>Total Clients</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <button className={styles.nameLink} onClick={() => setSelectedUser(user)}>
                        {user.name}
                      </button>
                    </TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>
                      <span className={user.status === 'Active' ? styles.statusSuccess : styles.statusWarning}>
                        {user.status}
                      </span>
                    </TableCell>
                    <TableCell className={styles.monoText}>{user.lastActive}</TableCell>
                    <TableCell>{user.clientsRegistered}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      {/* User Account Summary Modal */}
      {selectedUser && (
        <div className={styles.modalOverlay} onClick={() => {
          setSelectedUser(null);
          setSelectedPipelineCategory(null);
        }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <Users size={24} color="var(--color-primary-purple)" />
                {selectedUser.name} - Account Summary
              </div>
              <button className={styles.closeButton} onClick={() => {
                setSelectedUser(null);
                setSelectedPipelineCategory(null);
              }}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              
              {/* KPIs Section */}
              <div className={styles.summaryGrid}>
                <div className={styles.summaryKpiCard}>
                  <span className={styles.summaryKpiLabel}>Sales Volume</span>
                  <span className={styles.summaryKpiValue} style={{color: 'var(--color-primary-blue)'}}>{selectedUser.kpis.salesVolume}</span>
                </div>
                <div className={styles.summaryKpiCard}>
                  <span className={styles.summaryKpiLabel}>Commission Earned</span>
                  <span className={styles.summaryKpiValue} style={{color: 'var(--color-success)'}}>{selectedUser.kpis.commission}</span>
                </div>
                <div className={styles.summaryKpiCard}>
                  <span className={styles.summaryKpiLabel}>Active Deals</span>
                  <span className={styles.summaryKpiValue} style={{color: 'var(--color-primary-purple)'}}>{selectedUser.kpis.activeDeals}</span>
                </div>
                <div className={styles.summaryKpiCard}>
                  <span className={styles.summaryKpiLabel}>Conversion Rate</span>
                  <span className={styles.summaryKpiValue} style={{color: 'var(--color-secondary-orange)'}}>{selectedUser.kpis.conversionRate}</span>
                </div>
              </div>

              {/* Lead Pipeline Breakdown */}
              <div>
                <h3 className={styles.sectionTitle}><Users size={20}/> Lead Pipeline Breakdown</h3>
                <div className={styles.pipelineGrid}>
                  <div 
                    className={`${styles.pipelineCard} ${styles.pipeHot} ${selectedPipelineCategory === 'hotLeads' ? styles.activePipelineCard : ''}`}
                    onClick={() => setSelectedPipelineCategory(selectedPipelineCategory === 'hotLeads' ? null : 'hotLeads')}
                  >
                    <span className={styles.pipelineValue}>{selectedUser.pipeline.hotLeads}</span>
                    <span className={styles.pipelineLabel}>Hot Leads</span>
                  </div>
                  <div 
                    className={`${styles.pipelineCard} ${styles.pipeActive} ${selectedPipelineCategory === 'activeLeads' ? styles.activePipelineCard : ''}`}
                    onClick={() => setSelectedPipelineCategory(selectedPipelineCategory === 'activeLeads' ? null : 'activeLeads')}
                  >
                    <span className={styles.pipelineValue}>{selectedUser.pipeline.activeLeads}</span>
                    <span className={styles.pipelineLabel}>Active</span>
                  </div>
                  <div 
                    className={`${styles.pipelineCard} ${styles.pipeNegotiating} ${selectedPipelineCategory === 'negotiating' ? styles.activePipelineCard : ''}`}
                    onClick={() => setSelectedPipelineCategory(selectedPipelineCategory === 'negotiating' ? null : 'negotiating')}
                  >
                    <span className={styles.pipelineValue}>{selectedUser.pipeline.negotiating}</span>
                    <span className={styles.pipelineLabel}>Negotiating</span>
                  </div>
                  <div 
                    className={`${styles.pipelineCard} ${styles.pipeFrozen} ${selectedPipelineCategory === 'frozen' ? styles.activePipelineCard : ''}`}
                    onClick={() => setSelectedPipelineCategory(selectedPipelineCategory === 'frozen' ? null : 'frozen')}
                  >
                    <span className={styles.pipelineValue}>{selectedUser.pipeline.frozen}</span>
                    <span className={styles.pipelineLabel}>Frozen</span>
                  </div>
                  <div 
                    className={`${styles.pipelineCard} ${styles.pipeLost} ${selectedPipelineCategory === 'lost' ? styles.activePipelineCard : ''}`}
                    onClick={() => setSelectedPipelineCategory(selectedPipelineCategory === 'lost' ? null : 'lost')}
                  >
                    <span className={styles.pipelineValue}>{selectedUser.pipeline.lost}</span>
                    <span className={styles.pipelineLabel}>Lost</span>
                  </div>
                </div>

                {selectedPipelineCategory && (
                  <div className={styles.drillDownContainer}>
                    <div className={styles.drillDownHeader}>
                      <span className={styles.drillDownTitle}>
                        Details for: {selectedPipelineCategory.replace('Leads', ' Leads').toUpperCase()}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedPipelineCategory(null)}>Close</Button>
                    </div>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeader>Client Name</TableHeader>
                          <TableHeader>Property / Interest</TableHeader>
                          <TableHeader>Date</TableHeader>
                          <TableHeader>Reason / Notes</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedUser.pipelineClients.filter(c => c.status === selectedPipelineCategory).map(client => (
                          <TableRow key={client.id}>
                            <TableCell style={{fontWeight: 600}}>{client.name}</TableCell>
                            <TableCell>{client.property}</TableCell>
                            <TableCell>{client.date}</TableCell>
                            <TableCell style={{color: 'var(--text-secondary)'}}>{client.reason}</TableCell>
                          </TableRow>
                        ))}
                        {selectedUser.pipelineClients.filter(c => c.status === selectedPipelineCategory).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} style={{textAlign:'center', color:'var(--text-muted)'}}>No clients found in this category.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Transactions Section */}
              <div>
                <h3 className={styles.sectionTitle}><DollarSign size={20}/> Transactions & Deals</h3>
                <Card>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Property / Project</TableHeader>
                        <TableHeader>Client</TableHeader>
                        <TableHeader>Amount</TableHeader>
                        <TableHeader>Status</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedUser.transactions.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell style={{fontWeight: 500}}>{tx.property}</TableCell>
                          <TableCell>{tx.client}</TableCell>
                          <TableCell>{tx.amount}</TableCell>
                          <TableCell>
                            <span className={
                              tx.status === 'Closed Won' ? styles.statusSuccess :
                              tx.status === 'Lost' ? styles.statusFailed : styles.statusWarning
                            }>
                              {tx.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {selectedUser.transactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} style={{textAlign:'center', color:'var(--text-muted)'}}>No transactions found.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              {/* Operational Activity Timeline */}
              <div>
                <h3 className={styles.sectionTitle}><Activity size={20}/> Activity & Operations Log</h3>
                <div className={styles.timelineContainer}>
                  {selectedUser.timeline.map(tl => (
                    <div key={tl.id} className={styles.timelineItem}>
                      <span className={styles.timelineTime}>{tl.time}</span>
                      <span className={styles.timelineText}>{tl.text}</span>
                    </div>
                  ))}
                  {selectedUser.timeline.length === 0 && (
                    <span style={{color:'var(--text-muted)'}}>No recent activity.</span>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
