import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeveloperDTO } from '../../core/types';
import { developersApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { Plus, DotsThree, FunnelSimple, DownloadSimple, MagnifyingGlass, Buildings, MapPin } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import styles from './Developers.module.css';

export const DevelopersList: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading } = useFetch<DeveloperDTO[]>(() => developersApi.list(), []);
  const developers = data ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const toast = useToast();

  const handleActionClick = (actionName: string) => {
    toast.info(actionName);
  };

  if (loading) {
    return <div className={styles.loading}>{t('developers.loading')}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('developers.title')}</h1>
          <p className={styles.subtitle}>{t('developers.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBar}>
            <MagnifyingGlass size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={t('developers.searchPlaceholder')}
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => handleActionClick('Filter Developers')}><FunnelSimple size={16} /> {t('developers.filter')}</Button>
          <Button variant="outline" onClick={() => handleActionClick('Export Developers Data')}><DownloadSimple size={16} /> {t('developers.export')}</Button>
          <Button variant="primary" onClick={() => handleActionClick('Add New Developer')}><Plus size={16} /> {t('developers.addDeveloper')}</Button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.scrollContainer}>
          <Table style={{ minWidth: '1200px' }}>
            <TableHead>
              <TableRow>
                <TableHeader>{t('developers.table.name')}</TableHeader>
                <TableHeader>{t('developers.table.tier')}</TableHeader>
                <TableHeader>{t('developers.table.headquarters')}</TableHeader>
                <TableHeader>{t('developers.table.portfolio')}</TableHeader>
                <TableHeader>{t('developers.table.partnershipStatus')}</TableHeader>
                <TableHeader>{t('developers.table.commission')}</TableHeader>
                <TableHeader>{t('developers.table.keyContact')}</TableHeader>
                <TableHeader align="right">{t('developers.table.actions')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {developers.filter(dev =>
                dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                dev.headquarters.toLowerCase().includes(searchQuery.toLowerCase()) ||
                dev.keyContactName.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(dev => (
                <TableRow key={dev.id} className={styles.clickableRow} onClick={() => navigate(`/developers/${dev.id}`)}>
                  <TableCell>
                    <div className={styles.developerNameCell}>
                      <div className={styles.developerAvatar}>
                        <Buildings size={16} />
                      </div>
                      <span className={styles.developerName}>{dev.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`${styles.tierBadge} ${styles[dev.tier.toLowerCase().replace(' ', '')]}`}>
                      {dev.tier}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className={styles.locationCell}>
                      <MapPin size={12} className={styles.iconMuted} />
                      {dev.headquarters}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.portfolioStats}>
                      <span className={styles.statActive} title={t('developers.activeProjects')}>{t('developers.activeCount', { count: dev.activeProjects })}</span>
                      <span className={styles.statTotal} title={t('developers.completed')}>{t('developers.completedCount', { count: dev.totalCompletedProjects })}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`${styles.statusBadge} ${styles[dev.partnershipStatus.toLowerCase()]}`}>
                      {dev.partnershipStatus}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={styles.commissionRate}>{dev.commissionRate}</span>
                  </TableCell>
                  <TableCell>
                    <div className={styles.contactCell}>
                      <span className={styles.contactName}>{dev.keyContactName}</span>
                      <span className={styles.contactEmail}>{dev.keyContactEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <button
                      className={styles.moreButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleActionClick(`Options for ${dev.name}`);
                      }}
                    >
                      <DotsThree size={16} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
