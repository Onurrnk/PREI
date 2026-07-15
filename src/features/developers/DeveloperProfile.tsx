import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import type { CreateDeveloperInput, DeveloperDTO } from '../../core/types';
import { developersApi } from '../../core/api/resources';
import { ApiError } from '../../core/api/client';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { Field, Input, FormRow } from '../../core/components/Form/Form';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { ArrowLeft, EnvelopeSimple, Phone, CalendarBlank, Globe, Buildings, MapPin, FileText, Plus } from '@phosphor-icons/react';
import { EmailClient } from '../clients/components/EmailClient';
import styles from './DeveloperProfile.module.css';

const toForm = (d: DeveloperDTO): CreateDeveloperInput => ({
  name: d.name, tier: d.tier, headquarters: d.headquarters, partnershipStatus: d.partnershipStatus,
  commissionRate: d.commissionRate, keyContactName: d.keyContactName, keyContactEmail: d.keyContactEmail,
  keyContactPhone: d.keyContactPhone, website: d.website,
});

export const DeveloperProfile: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, refetch } = useFetch<DeveloperDTO[]>(() => developersApi.list(), [id]);
  const developer = (data ?? []).find(d => d.id === id) ?? null;

  const toast = useToast();

  const handleActionClick = (actionName: string) => {
    toast.info(actionName);
  };

  const handleVisitWebsite = () => {
    if (!developer?.website) {
      toast.error(t('developers.websiteMissing'));
      return;
    }
    const url = developer.website.startsWith('http') ? developer.website : `https://${developer.website}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<CreateDeveloperInput | null>(null);
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    if (!developer) return;
    setEditForm(toForm(developer));
    setShowEditModal(true);
  };

  const setEditField = <K extends keyof CreateDeveloperInput>(key: K, value: CreateDeveloperInput[K]) =>
    setEditForm((f) => (f ? { ...f, [key]: value } : f));

  const handleSaveEdit = async () => {
    if (!developer || !editForm) return;
    const name = editForm.name.trim();
    if (!name) {
      toast.error(t('developers.form.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await developersApi.update(developer.id, { ...editForm, name });
      setShowEditModal(false);
      refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('developers.form.updateError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>{t('developers.loadingProfile')}</div>;
  }

  if (!developer) {
    return <div className={styles.error}>{t('developers.notFound')}</div>;
  }

  const formatCurrency = (value: number, currency = 'EUR') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(value);
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
            <p className={styles.subtitle}>{t('developers.headquartersLine', { headquarters: developer.headquarters, rate: developer.commissionRate })}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={handleVisitWebsite}><Globe size={16} /> {t('developers.website')}</Button>
          <Button variant="outline" onClick={() => handleActionClick('Schedule Meeting')}><CalendarBlank size={16} /> {t('developers.meeting')}</Button>
          <Button variant="primary" onClick={openEdit}>{t('developers.editProfile')}</Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <Card>
            <CardHeader>
              <h3 className={styles.cardTitle}>{t('developers.keyContactPerson')}</h3>
            </CardHeader>
            <CardBody>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{t('developers.name')}</span>
                <span className={styles.detailValue} style={{ fontWeight: 600 }}>{developer.keyContactName}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}><EnvelopeSimple size={14} /></span>
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
              <h3 className={styles.cardTitle}>{t('developers.partnershipStats')}</h3>
            </CardHeader>
            <CardBody>
              <div className={styles.kpiGrid}>
                <div className={styles.kpiBox}>
                  <Buildings size={16} className={styles.kpiIcon} />
                  <span className={styles.kpiLabel}>{t('developers.activeProjects')}</span>
                  <span className={styles.kpiValue}>{developer.activeProjects}</span>
                </div>
                <div className={styles.kpiBox}>
                  <Buildings size={16} className={styles.kpiIcon} style={{ color: 'var(--color-success)' }} />
                  <span className={styles.kpiLabel}>{t('developers.completed')}</span>
                  <span className={styles.kpiValue}>{developer.totalCompletedProjects}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className={styles.quickActions}>
            <CardHeader>
              <h3 className={styles.cardTitle}>{t('developers.quickActions')}</h3>
            </CardHeader>
            <CardBody>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('Request Inventory Update')}><EnvelopeSimple size={16} /> {t('developers.requestInventory')}</Button>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('Log Call with Developer')}><Phone size={16} /> {t('developers.logCall')}</Button>
              <Button variant="outline" fullWidth className={styles.actionBtn} onClick={() => handleActionClick('Review Commission Agreement')}><FileText size={16} /> {t('developers.reviewContracts')}</Button>
            </CardBody>
          </Card>
        </div>

        <div className={styles.main}>
          <Card className={styles.projectsContainer}>
            <CardHeader className={styles.projectsHeader}>
              <h3 className={styles.cardTitle}>{t('developers.activePortfolio')}</h3>
              <Button variant="primary" size="sm" onClick={() => navigate('/projects/add')}><Plus size={14} style={{ marginRight: 6 }} /> {t('developers.addProject')}</Button>
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
                          <span className={styles.metricLabel}>{t('developers.startingPrice')}</span>
                          <span className={styles.metricValue}>{formatCurrency(project.startingPrice, project.currency)}</span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>{t('developers.available')}</span>
                          <span className={styles.metricValue}>{project.availableUnits} / {project.totalUnits}</span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>{t('developers.completion')}</span>
                          <span className={styles.metricValue}>{project.completionDate}</span>
                        </div>
                      </div>

                      <div className={styles.projectManager}>
                        <div className={styles.managerHeader}>{t('developers.projectManager')}</div>
                        <div className={styles.managerName}>{project.projectManagerName}</div>
                        <div className={styles.managerContact}>
                          <span><EnvelopeSimple size={10} /> {project.projectManagerEmail}</span>
                          <span><Phone size={10} /> {project.projectManagerPhone}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <Buildings size={48} className={styles.emptyIcon} />
                  <p>{t('developers.emptyProjects')}</p>
                  <Button variant="outline" onClick={() => handleActionClick('Sync Projects from ERP')}>{t('developers.syncProjects')}</Button>
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

      {editForm && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title={t('developers.form.editTitle')}
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={saving}>{t('common.cancel')}</Button>
              <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? t('common.saving') : t('developers.form.save')}
              </Button>
            </>
          }
        >
          <div className={styles.formStack}>
            <FormRow>
              <Field label={t('developers.form.name')}>
                <Input type="text" value={editForm.name} onChange={(e) => setEditField('name', e.target.value)} />
              </Field>
              <Field label={t('developers.form.tier')}>
                <SelectMenu
                  aria-label={t('developers.form.tier')}
                  value={editForm.tier ?? 'Boutique'}
                  onChange={(v) => setEditField('tier', v as DeveloperDTO['tier'])}
                  options={[
                    { value: 'Tier 1', label: 'Tier 1' },
                    { value: 'Tier 2', label: 'Tier 2' },
                    { value: 'Boutique', label: 'Boutique' },
                  ]}
                />
              </Field>
            </FormRow>

            <FormRow>
              <Field label={t('developers.form.headquarters')}>
                <Input type="text" value={editForm.headquarters} onChange={(e) => setEditField('headquarters', e.target.value)} />
              </Field>
              <Field label={t('developers.form.partnershipStatus')}>
                <SelectMenu
                  aria-label={t('developers.form.partnershipStatus')}
                  value={editForm.partnershipStatus ?? 'Active'}
                  onChange={(v) => setEditField('partnershipStatus', v as DeveloperDTO['partnershipStatus'])}
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Negotiating', label: 'Negotiating' },
                    { value: 'Inactive', label: 'Inactive' },
                  ]}
                />
              </Field>
            </FormRow>

            <FormRow>
              <Field label={t('developers.form.commissionRate')}>
                <Input type="text" value={editForm.commissionRate} onChange={(e) => setEditField('commissionRate', e.target.value)} />
              </Field>
              <Field label={t('developers.form.website')}>
                <Input type="text" value={editForm.website} onChange={(e) => setEditField('website', e.target.value)} />
              </Field>
            </FormRow>

            <FormRow>
              <Field label={t('developers.form.keyContactName')}>
                <Input type="text" value={editForm.keyContactName} onChange={(e) => setEditField('keyContactName', e.target.value)} />
              </Field>
              <Field label={t('developers.form.keyContactEmail')}>
                <Input type="email" value={editForm.keyContactEmail} onChange={(e) => setEditField('keyContactEmail', e.target.value)} />
              </Field>
            </FormRow>

            <Field label={t('developers.form.keyContactPhone')}>
              <Input type="tel" value={editForm.keyContactPhone} onChange={(e) => setEditField('keyContactPhone', e.target.value)} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
};
