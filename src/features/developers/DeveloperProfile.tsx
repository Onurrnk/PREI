import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { DeveloperDTO } from '../../core/types';
import { developersApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { ArrowLeft, Mail, Phone, Calendar, Globe, Building2, MapPin, FileText, Plus } from 'lucide-react';
import { EmailClient } from '../clients/components/EmailClient';
import styles from './DeveloperProfile.module.css';

export const DeveloperProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading } = useFetch<DeveloperDTO[]>(() => developersApi.list(), [id]);
  const developer = (data ?? []).find(d => d.id === id) ?? null;

  const toast = useToast();

  const handleActionClick = (actionName: string) => {
    toast.info(actionName);
  };

  if (loading) {
    return <div className={styles.loading}>Loading Developer Profile...</div>;
  }

  if (!developer) {
    return <div className={styles.error}>Developer not found</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => navigate('/developers')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className={styles.titleWrapper}>
              <h1 className={styles.title}>{developer.name}</h1>
              <span className={`${styles.tierBadge} ${styles[developer.tier.toLowerCase().replace(' ', '')]}`}>{developer.tier}</span>
              <span className={`${styles.statusBadge} ${styles[developer.partnershipStatus.toLowerCase()]}`}>
                {developer.partnershipStatus}
              </span>
            </div>
            <p className={styles.subtitle}>Headquarters: {developer.headquarters} &bull; Commission Rate: {developer.commissionRate}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={() => handleActionClick('Visit Website')}><Globe size={16} /> Website</Button>
          <Button variant="outline" onClick={() => handleActionClick('Schedule Meeting')}><Calendar size={16} /> Meeting</Button>
          <Button variant="primary" onClick={() => handleActionClick('Edit Developer Profile')}>Edit Profile</Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <Card>
            <CardHeader>
              <h3 className={styles.cardTitle}>Key Contact Person</h3>
            </CardHeader>
            <CardBody>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Name</span>
                <span className={styles.detailValue} style={{ fontWeight: 600 }}>{developer.keyContactName}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><Mail size={14} /></span>
                <span className={styles.detailValue}>{developer.keyContactEmail}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><Phone size={14} /></span>
                <span className={styles.detailValue}>{developer.keyContactPhone}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className={styles.cardTitle}>Partnership Stats</h3>
            </CardHeader>
            <CardBody>
              <div className={styles.kpiGrid}>
                <div className={styles.kpiBox}>
                  <Building2 size={16} className={styles.kpiIcon} />
                  <span className={styles.kpiLabel}>Active Projects</span>
                  <span className={styles.kpiValue}>{developer.activeProjects}</span>
                </div>
                <div className={styles.kpiBox}>
                  <Building2 size={16} className={styles.kpiIcon} style={{ color: 'var(--color-success)' }} />
                  <span className={styles.kpiLabel}>Completed</span>
                  <span className={styles.kpiValue}>{developer.totalCompletedProjects}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className={styles.quickActions}>
            <CardHeader>
              <h3 className={styles.cardTitle}>Quick Actions</h3>
            </CardHeader>
            <CardBody>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('Request Inventory Update')}><Mail size={16} /> Request Inventory</Button>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('Log Call with Developer')}><Phone size={16} /> Log Call</Button>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('Review Commission Agreement')}><FileText size={16} /> Review Contracts</Button>
            </CardBody>
          </Card>
        </div>

        <div className={styles.main}>
          <Card className={styles.projectsContainer}>
            <CardHeader className={styles.projectsHeader}>
              <h3 className={styles.cardTitle}>Active Projects Portfolio</h3>
              <Button variant="primary" size="sm" onClick={() => navigate('/projects/add')}><Plus size={14} style={{ marginRight: 6 }} /> Add Project</Button>
            </CardHeader>
            <CardBody className={styles.projectsBody}>
              {developer.projects && developer.projects.length > 0 ? (
                <div className={styles.projectsList}>
                  {developer.projects.map((project) => (
                    <div key={project.id} className={styles.projectCard} onClick={() => navigate(`/projects/${project.id}`)} style={{ cursor: 'pointer' }}>
                      <div className={styles.projectHeader}>
                        <h4 className={styles.projectName}>{project.name}</h4>
                        <span className={`${styles.projectStatus} ${styles[project.status.toLowerCase().replace(/ /g, '-')]}`}>
                          {project.status}
                        </span>
                      </div>
                      <div className={styles.projectLocation}>
                        <MapPin size={12} className={styles.mutedIcon} /> {project.location}
                      </div>
                      
                      <div className={styles.projectMetrics}>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>Starting Price</span>
                          <span className={styles.metricValue}>{formatCurrency(project.startingPrice)}</span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>Available</span>
                          <span className={styles.metricValue}>{project.availableUnits} / {project.totalUnits}</span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>Completion</span>
                          <span className={styles.metricValue}>{project.completionDate}</span>
                        </div>
                      </div>

                      <div className={styles.projectManager}>
                        <div className={styles.managerHeader}>Project Manager</div>
                        <div className={styles.managerName}>{project.projectManagerName}</div>
                        <div className={styles.managerContact}>
                          <span><Mail size={10} /> {project.projectManagerEmail}</span>
                          <span><Phone size={10} /> {project.projectManagerPhone}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <Building2 size={48} className={styles.emptyIcon} />
                  <p>No active projects linked to this developer.</p>
                  <Button variant="outline" onClick={() => handleActionClick('Sync Projects from ERP')}>Sync Projects</Button>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className={styles.rightSidebar}>
          {/* Reusing the EmailClient component from Clients module for Gmail Integration */}
          <EmailClient clientEmail={developer.keyContactEmail} clientName={developer.keyContactName} />
        </div>
      </div>
    </div>
  );
};
