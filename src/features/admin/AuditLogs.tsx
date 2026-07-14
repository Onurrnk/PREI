import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { ShieldWarning, MagnifyingGlass, UsersThree, X, Pulse, CurrencyDollar } from '@phosphor-icons/react';
import { Button } from '../../core/components/Button/Button';
import { useFetch } from '../../core/hooks/useFetch';
import { adminApi } from '../../core/api/resources';
import { fmtEUR } from '../../core/charts';
import type { TeamMemberDTO, UserDetailDTO } from '../../core/types';
import styles from './AuditLogs.module.css';

const PIPELINE_LABEL_KEY: Record<string, string> = {
  hotLeads: 'admin.pipeline.hotLeads',
  activeLeads: 'admin.pipeline.active',
  negotiating: 'admin.pipeline.negotiating',
  frozen: 'admin.pipeline.frozen',
  lost: 'admin.pipeline.lost',
};

const PIPELINE_CARD_CLASS: Record<string, string> = {
  hotLeads: 'pipeHot',
  activeLeads: 'pipeActive',
  negotiating: 'pipeNegotiating',
  frozen: 'pipeFrozen',
  lost: 'pipeLost',
};

const TRANSACTION_STATUS_KEY: Record<string, string> = {
  won: 'admin.transactionStatus.closedWon',
  open: 'admin.transactionStatus.pending',
  lost: 'admin.transactionStatus.lost',
};

const ROLE_LABEL_KEY: Record<string, string> = {
  super_admin: 'admin.roles.super_admin',
  manager: 'admin.roles.manager',
  finance_manager: 'admin.roles.finance_manager',
  marketing_manager: 'admin.roles.marketing_manager',
  consultant: 'admin.roles.consultant',
  service_agent: 'admin.roles.service_agent',
};

export const AuditLogs: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedPipelineCategory, setSelectedPipelineCategory] = useState<string | null>(null);

  const { data: team } = useFetch<TeamMemberDTO[]>(() => adminApi.team(), []);
  const { data: detail } = useFetch<UserDetailDTO | null>(
    () => (selectedUserId ? adminApi.userDetail(selectedUserId) : Promise.resolve(null)),
    [selectedUserId],
  );

  const filteredUsers = useMemo(
    () => (team ?? []).filter((u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())),
    [team, searchQuery],
  );

  const formatDateTime = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—';

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat(dateLocale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

  const closeModal = () => {
    setSelectedUserId(null);
    setSelectedPipelineCategory(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <ShieldWarning size={28} className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>{t('admin.title')}</h1>
            <p className={styles.subtitle}>{t('admin.subtitle')}</p>
          </div>
        </div>
      </div>

      <Card className={styles.tableCard}>
        <CardHeader className={styles.tableHeaderSection}>
          <div className={styles.filters}>
            <div className={styles.searchBar}>
              <MagnifyingGlass size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder={t('admin.searchPlaceholder')}
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
                  <TableHeader>{t('admin.table.userName')}</TableHeader>
                  <TableHeader>{t('admin.table.role')}</TableHeader>
                  <TableHeader>{t('admin.table.status')}</TableHeader>
                  <TableHeader>{t('admin.table.lastActive')}</TableHeader>
                  <TableHeader>{t('admin.table.totalClients')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <button className={styles.nameLink} onClick={() => setSelectedUserId(user.id)}>
                        {user.name}
                      </button>
                    </TableCell>
                    <TableCell>{t(ROLE_LABEL_KEY[user.role] ?? user.role)}</TableCell>
                    <TableCell>
                      <span className={user.isActive ? styles.statusSuccess : styles.statusWarning}>
                        {user.isActive ? t('admin.status.active') : t('admin.status.inactive')}
                      </span>
                    </TableCell>
                    <TableCell className={styles.monoText}>{formatDateTime(user.lastActiveAt)}</TableCell>
                    <TableCell>{user.clientsRegistered}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>

      {/* User Account Summary Modal */}
      {selectedUserId && detail && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <UsersThree size={24} color="var(--color-primary-purple)" />
                {t('admin.accountSummary', { name: detail.name })}
              </div>
              <button className={styles.closeButton} onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>

              {/* KPIs Section */}
              <div className={styles.summaryGrid}>
                <div className={styles.summaryKpiCard}>
                  <span className={styles.summaryKpiLabel}>{t('admin.kpi.salesVolume')}</span>
                  <span className={styles.summaryKpiValue} style={{color: 'var(--data-info)'}}>{fmtEUR(detail.kpis.salesVolumeEur)}</span>
                </div>
                <div className={styles.summaryKpiCard}>
                  <span className={styles.summaryKpiLabel}>{t('admin.kpi.commission')}</span>
                  <span className={styles.summaryKpiValue} style={{color: 'var(--color-success)'}}>{fmtEUR(detail.kpis.commissionEur)}</span>
                </div>
                <div className={styles.summaryKpiCard}>
                  <span className={styles.summaryKpiLabel}>{t('admin.kpi.activeDeals')}</span>
                  <span className={styles.summaryKpiValue} style={{color: 'var(--color-primary-purple)'}}>{detail.kpis.activeDeals}</span>
                </div>
                <div className={styles.summaryKpiCard}>
                  <span className={styles.summaryKpiLabel}>{t('admin.kpi.conversionRate')}</span>
                  <span className={styles.summaryKpiValue} style={{color: 'var(--color-secondary-orange)'}}>{detail.kpis.conversionRatePct.toFixed(1)}%</span>
                </div>
              </div>

              {/* Lead Pipeline Breakdown */}
              <div>
                <h3 className={styles.sectionTitle}><UsersThree size={20}/> {t('admin.pipelineBreakdown')}</h3>
                <div className={styles.pipelineGrid}>
                  {detail.pipeline.map((bucket) => (
                    <div
                      key={bucket.key}
                      className={`${styles.pipelineCard} ${styles[PIPELINE_CARD_CLASS[bucket.key]]} ${selectedPipelineCategory === bucket.key ? styles.activePipelineCard : ''}`}
                      onClick={() => setSelectedPipelineCategory(selectedPipelineCategory === bucket.key ? null : bucket.key)}
                    >
                      <span className={styles.pipelineValue}>{bucket.count}</span>
                      <span className={styles.pipelineLabel}>{t(PIPELINE_LABEL_KEY[bucket.key])}</span>
                    </div>
                  ))}
                </div>

                {selectedPipelineCategory && (
                  <div className={styles.drillDownContainer}>
                    <div className={styles.drillDownHeader}>
                      <span className={styles.drillDownTitle}>
                        {t('admin.detailsFor', { category: t(PIPELINE_LABEL_KEY[selectedPipelineCategory]).toUpperCase() })}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedPipelineCategory(null)}>{t('admin.close')}</Button>
                    </div>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeader>{t('admin.pipelineTable.clientName')}</TableHeader>
                          <TableHeader>{t('admin.pipelineTable.propertyInterest')}</TableHeader>
                          <TableHeader>{t('admin.pipelineTable.date')}</TableHeader>
                          <TableHeader>{t('admin.pipelineTable.reasonNotes')}</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detail.pipelineClients.filter(c => c.bucket === selectedPipelineCategory).map(client => (
                          <TableRow key={client.id}>
                            <TableCell style={{fontWeight: 600}}>{client.name}</TableCell>
                            <TableCell>{client.interest ?? '—'}</TableCell>
                            <TableCell>{formatDateTime(client.date)}</TableCell>
                            <TableCell style={{color: 'var(--text-secondary)'}}>{client.reason ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                        {detail.pipelineClients.filter(c => c.bucket === selectedPipelineCategory).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} style={{textAlign:'center', color:'var(--text-muted)'}}>{t('admin.noClientsInCategory')}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Transactions Section */}
              <div>
                <h3 className={styles.sectionTitle}><CurrencyDollar size={20}/> {t('admin.transactionsDeals')}</h3>
                <Card>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>{t('admin.transactionsTable.propertyProject')}</TableHeader>
                        <TableHeader>{t('admin.transactionsTable.client')}</TableHeader>
                        <TableHeader>{t('admin.transactionsTable.amount')}</TableHeader>
                        <TableHeader>{t('admin.transactionsTable.status')}</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detail.transactions.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell style={{fontWeight: 500}}>{tx.property}</TableCell>
                          <TableCell>{tx.client}</TableCell>
                          <TableCell>{formatCurrency(tx.amount, tx.currency)}</TableCell>
                          <TableCell>
                            <span className={
                              tx.status === 'won' ? styles.statusSuccess :
                              tx.status === 'lost' ? styles.statusFailed : styles.statusWarning
                            }>
                              {t(TRANSACTION_STATUS_KEY[tx.status])}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {detail.transactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} style={{textAlign:'center', color:'var(--text-muted)'}}>{t('admin.noTransactions')}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              {/* Operational Activity Timeline */}
              <div>
                <h3 className={styles.sectionTitle}><Pulse size={20}/> {t('admin.activityLog')}</h3>
                <div className={styles.timelineContainer}>
                  {detail.timeline.map(tl => (
                    <div key={tl.id} className={styles.timelineItem}>
                      <span className={styles.timelineTime}>{formatDateTime(tl.occurredAt)}</span>
                      <span className={styles.timelineText}>{tl.label}</span>
                    </div>
                  ))}
                  {detail.timeline.length === 0 && (
                    <span style={{color:'var(--text-muted)'}}>{t('admin.noRecentActivity')}</span>
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
