import React, { useState } from 'react';
import type { DeveloperDTO } from '../../core/types';
import { developersApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { Plus, MoreHorizontal, Filter, Download, Search, Building2, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './Developers.module.css';

export const DevelopersList: React.FC = () => {
  const { data, loading } = useFetch<DeveloperDTO[]>(() => developersApi.list(), []);
  const developers = data ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const toast = useToast();

  const handleActionClick = (actionName: string) => {
    toast.info(actionName);
  };

  if (loading) {
    return <div className={styles.loading}>Loading Developers...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Developer CRM</h1>
          <p className={styles.subtitle}>Manage relationships with property developers and contractors</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBar}>
            <Search size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search developers..." 
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => handleActionClick('Filter Developers')}><Filter size={16} /> Filter</Button>
          <Button variant="outline" onClick={() => handleActionClick('Export Developers Data')}><Download size={16} /> Export</Button>
          <Button variant="primary" onClick={() => handleActionClick('Add New Developer')}><Plus size={16} /> Add Developer</Button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.scrollContainer}>
          <Table style={{ minWidth: '1200px' }}>
            <TableHead>
              <TableRow>
                <TableHeader>Developer Name</TableHeader>
                <TableHeader>Tier</TableHeader>
                <TableHeader>Headquarters</TableHeader>
                <TableHeader>Portfolio</TableHeader>
                <TableHeader>Partnership Status</TableHeader>
                <TableHeader>Commission</TableHeader>
                <TableHeader>Key Contact</TableHeader>
                <TableHeader align="right">Actions</TableHeader>
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
                        <Building2 size={16} />
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
                      <span className={styles.statActive} title="Active Projects">{dev.activeProjects} Active</span>
                      <span className={styles.statTotal} title="Completed Projects">{dev.totalCompletedProjects} Completed</span>
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
                      <MoreHorizontal size={16} />
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
