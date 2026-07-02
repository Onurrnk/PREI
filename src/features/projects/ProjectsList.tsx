import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectDTO } from '../../core/types';
import { projectsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Button } from '../../core/components/Button/Button';
import { Plus, MagnifyingGlass, Buildings } from '@phosphor-icons/react';
import styles from './ProjectsList.module.css';

export const ProjectsList: React.FC = () => {
  const { data, loading } = useFetch<ProjectDTO[]>(() => projectsApi.list(), []);
  const projects = data ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // projects loaded via useFetch above

  if (loading) return <div className={styles.loading}>Loading Projects...</div>;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Projects Intelligence</h1>
          <p className={styles.subtitle}>Global database of off-plan and ready properties</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchBar}>
            <MagnifyingGlass size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search projects..." 
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="primary" onClick={() => navigate('/projects/add')}><Plus size={16} /> Add Project</Button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Project</TableHeader>
              <TableHeader>Developer</TableHeader>
              <TableHeader>Location</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Price (From)</TableHeader>
              <TableHeader>Available / Total</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.filter(proj => 
              proj.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              proj.developerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
              proj.location.toLowerCase().includes(searchQuery.toLowerCase())
            ).map(proj => (
              <TableRow key={proj.id} className={styles.clickableRow} onClick={() => navigate(`/projects/${proj.id}`)}>
                <TableCell>
                  <div className={styles.projectNameCell}>
                    <Buildings size={16} className={styles.iconMuted} />
                    <span className={styles.projectName}>{proj.name}</span>
                  </div>
                </TableCell>
                <TableCell>{proj.developerName}</TableCell>
                <TableCell>{proj.location}</TableCell>
                <TableCell>
                  <span className={`${styles.statusBadge} ${styles[proj.status.toLowerCase().replace(/ /g, '-')]}`}>
                    {proj.status}
                  </span>
                </TableCell>
                <TableCell style={{ fontWeight: 600 }}>{formatCurrency(proj.startingPrice)}</TableCell>
                <TableCell>{proj.availableUnits} / {proj.totalUnits}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
