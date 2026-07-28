import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import type { ClientDTO, ProjectDTO } from '../../core/types';
import { clientsApi, gmailApi, projectsApi, documentsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { Modal } from '../../core/components/Modal/Modal';
import { Field, Input, Textarea, FormRow } from '../../core/components/Form/Form';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { useAuth } from '../../core/auth/AuthContext';
import { ArrowLeft, MapPin, Buildings, CalendarBlank, CurrencyDollar, CheckCircle, FileText, FilePdf, Table, DownloadSimple, PaperPlaneTilt, Paperclip, PencilSimple, Trash, Plus, DotsThreeVertical } from '@phosphor-icons/react';
import { ProjectAudience } from './components/ProjectAudience';
import styles from './ProjectProfile.module.css';

export const ProjectProfile: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, refetch } = useFetch<ProjectDTO[]>(() => projectsApi.list(), [id]);
  const project = (data ?? []).find(p => p.id === id) ?? null;
  const [lifecycleSaving, setLifecycleSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [edit, setEdit] = useState({
    title: '', status: 'Off-plan', city: '', district: '', description: '',
    price: '', currency: 'EUR', completionDate: '', totalUnits: '', availableUnits: '',
  });
  const patchEdit = (p: Partial<typeof edit>) => setEdit((e) => ({ ...e, ...p }));

  const openEdit = () => {
    if (!project) return;
    setEdit({
      title: project.name,
      status: project.status,
      city: project.city ?? '',
      district: project.district ?? '',
      description: project.description ?? '',
      price: project.startingPrice ? String(project.startingPrice) : '',
      currency: project.currency || 'EUR',
      completionDate: project.completionDate ?? '',
      totalUnits: project.totalUnits ? String(project.totalUnits) : '',
      availableUnits: project.availableUnits ? String(project.availableUnits) : '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!project) return;
    if (!edit.title.trim()) { toast.error(t('projects.edit.titleRequired')); return; }
    setEditSaving(true);
    try {
      await projectsApi.update(project.id, {
        title: edit.title.trim(),
        status: edit.status as ProjectDTO['status'],
        city: edit.city.trim(),
        district: edit.district.trim(),
        description: edit.description.trim(),
        price: edit.price.trim() ? Number(edit.price) : undefined,
        currency: edit.currency,
        completionDate: edit.completionDate.trim(),
        totalUnits: edit.totalUnits.trim() ? Number(edit.totalUnits) : undefined,
        availableUnits: edit.availableUnits.trim() ? Number(edit.availableUnits) : undefined,
      });
      toast.success(t('projects.edit.saved'));
      setEditOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('projects.edit.saveError'));
    } finally { setEditSaving(false); }
  };
  const { data: clientsData } = useFetch<ClientDTO[]>(() => clientsApi.list(), []);
  const clients = clientsData ?? [];
  const [selectedImage, setSelectedImage] = useState(0);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removingImage, setRemovingImage] = useState<string | null>(null);
  // Projeyi sil (soft) — yalnız super_admin; iki aşamalı onay.
  const canDelete = user?.role === 'super_admin';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Foto ekle — gizli input, "Fotoğraf ekle" düğmesi tetikler.
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // İşlemler kebap menüsü (Onur: düğmeler yan yana kalabalıktı) —
  // ClientProfile'daki desenle aynı: dışarı tıklayınca kapanır.
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [moreOpen]);

  const confirmRemoveImage = async () => {
    if (!project || !removeTarget) return;
    setRemovingImage(removeTarget);
    try {
      await projectsApi.removeImage(project.id, removeTarget);
      toast.success(t('projects.gallery.removed'));
      // Silinen kare son görselse seçim dışarı taşmasın.
      setSelectedImage((i) => Math.max(0, Math.min(i, project.images.length - 2)));
      setRemoveTarget(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('projects.gallery.removeFailed'));
    } finally {
      setRemovingImage(null);
    }
  };
  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await projectsApi.remove(project.id);
      toast.success(t('projects.delete.done', { name: project.name }));
      navigate('/projects');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('projects.delete.failed'));
    } finally {
      setDeleting(false);
    }
  };

  const handleAddPhotos = async (files: FileList | null) => {
    if (!project || !files || files.length === 0) return;
    setUploading(true);
    try {
      await projectsApi.uploadImages(project.id, Array.from(files));
      toast.success(t('projects.gallery.added'));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('projects.gallery.addFailed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const [shareClient, setShareClient] = useState('');
  const [emailSubject, setEmailSubject] = useState<string | null>(null);
  const [emailBody, setEmailBody] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const toast = useToast();

  const handleActionClick = (actionName: string) => {
    toast.info(actionName);
  };

  const handleLifecycleChange = async (status: string) => {
    if (!project || status === project.lifecycleStatus) return;
    setLifecycleSaving(true);
    try {
      await projectsApi.setLifecycle(project.id, status as ProjectDTO['lifecycleStatus']);
      toast.success(t('projects.lifecycle.saved'));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('projects.lifecycle.saveError'));
    } finally { setLifecycleSaving(false); }
  };

  const handleDownloadDoc = async (docId: string) => {
    try {
      const { url } = await documentsApi.downloadUrl(docId);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('projects.downloadFailed'));
    }
  };

  if (loading) {
    return <div className={styles.loading}>{t('projects.loadingProfile')}</div>;
  }

  if (!project) {
    return <div className={styles.error}>{t('projects.notFound')}</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: project.currency || 'EUR', maximumFractionDigits: 0 }).format(value);
  };

  // totalUnits 0/eksikse sıfıra bölmeyi önle (metadata olmayan properties).
  const soldPct = project.totalUnits > 0
    ? Math.round(((project.totalUnits - project.availableUnits) / project.totalUnits) * 100)
    : 0;
  // Segment tonları: marka morunun kademeli opaklığı — ilk taksit en koyu.
  const segmentAlpha = (i: number, total: number) => 1 - (i / Math.max(total, 1)) * 0.62;
  const docIcon = (type: string) =>
    type === 'PDF' ? <FilePdf size={20} /> : type === 'Spreadsheet' ? <Table size={20} /> : <FileText size={20} />;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className={styles.titleWrapper}>
              <h1 className={styles.title}>{project.name}</h1>
              <span className={`${styles.statusBadge} ${styles[project.status.toLowerCase().replace(/ /g, '-')]}`}>
                {project.status}
              </span>
              {project.lifecycleStatus !== 'active' && (
                <span className={`${styles.lifecycleBadge} ${styles[`lc_${project.lifecycleStatus}`]}`}>
                  {t(`projects.lifecycle.status.${project.lifecycleStatus}`)}
                </span>
              )}
            </div>
            <p className={styles.subtitle}>
              {/* Geliştirici atanmadıysa "— tarafından" gibi boş kalıp gösterme;
                  satır yalnız konumla devam eder. */}
              {project.developerName && project.developerName !== '—' && (
                <>
                  <Buildings size={14} className={styles.inlineIcon} /> {t('projects.by', { developer: project.developerName })} &bull;{' '}
                </>
              )}
              <MapPin size={14} className={styles.inlineIcon} /> {project.location}
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.lifecycleControl}>
            <span className={styles.lifecycleLabel}>{t('projects.lifecycle.label')}</span>
            <SelectMenu
              aria-label={t('projects.lifecycle.label')}
              value={project.lifecycleStatus}
              disabled={lifecycleSaving}
              onChange={handleLifecycleChange}
              options={(['active', 'sold', 'paused', 'archived'] as const).map((s) => ({
                value: s, label: t(`projects.lifecycle.status.${s}`),
              }))}
            />
          </div>
          {/* Foto ekle — gizli çoklu dosya girişi (menüden tetiklenir) */}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => handleAddPhotos(e.target.files)} />

          {/* Silme onayı menü dışında görünür kalır (yanlışlıkla kapanmasın) */}
          {confirmDelete && (
            <>
              <Button variant="outline" disabled={deleting} onClick={handleDeleteProject}
                style={{ color: 'var(--data-negative)', borderColor: 'var(--data-negative)' }}>
                <Trash size={16} /> {deleting ? t('projects.delete.deleting') : t('projects.delete.confirm')}
              </Button>
              <Button variant="ghost" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                {t('projects.delete.cancel')}
              </Button>
            </>
          )}

          {/* Tüm işlemler tek kebap menüsünde (Onur: yan yana kalabalıktı) */}
          <div className={styles.moreWrap} ref={moreRef}>
            <Button
              variant="outline"
              aria-label={t('projects.moreActions')}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((o) => !o)}
            >
              <DotsThreeVertical size={18} weight="bold" />
            </Button>
            {moreOpen && (
              <div className={styles.moreMenu} role="menu">
                <button type="button" role="menuitem" className={styles.moreItem}
                  onClick={() => { setMoreOpen(false); openEdit(); }}>
                  <PencilSimple size={16} /> {t('projects.edit.button')}
                </button>
                <button type="button" role="menuitem" className={styles.moreItem}
                  disabled={uploading}
                  onClick={() => { setMoreOpen(false); fileRef.current?.click(); }}>
                  <Plus size={16} /> {uploading ? t('projects.gallery.adding') : t('projects.gallery.add')}
                </button>
                <button type="button" role="menuitem" className={styles.moreItem}
                  onClick={() => { setMoreOpen(false); handleActionClick('Download Full Media Kit'); }}>
                  <FileText size={16} /> {t('projects.mediaKit')}
                </button>
                {canDelete && (
                  <>
                    <div className={styles.moreDivider} />
                    <button type="button" role="menuitem"
                      className={`${styles.moreItem} ${styles.moreItemDanger}`}
                      onClick={() => { setMoreOpen(false); setConfirmDelete(true); }}>
                      <Trash size={16} /> {t('projects.delete.button')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Projeyi Düzenle */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('projects.edit.title')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? t('common.saving') : t('projects.edit.save')}
            </Button>
          </>
        }
      >
        <Field label={t('projects.edit.projectTitle')}>
          <Input value={edit.title} onChange={(e) => patchEdit({ title: e.target.value })} />
        </Field>
        <FormRow>
          <Field label={t('projects.edit.status')}>
            <SelectMenu
              value={edit.status}
              onChange={(v) => patchEdit({ status: v })}
              options={['Off-plan', 'Under Construction', 'Completed'].map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label={t('projects.edit.completionDate')}>
            <Input value={edit.completionDate} onChange={(e) => patchEdit({ completionDate: e.target.value })} placeholder={t('projects.edit.completionPlaceholder')} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label={t('projects.edit.city')}>
            <Input value={edit.city} onChange={(e) => patchEdit({ city: e.target.value })} />
          </Field>
          <Field label={t('projects.edit.district')}>
            <Input value={edit.district} onChange={(e) => patchEdit({ district: e.target.value })} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label={t('projects.edit.price')}>
            <Input type="number" min="0" value={edit.price} onChange={(e) => patchEdit({ price: e.target.value })} />
          </Field>
          <Field label={t('projects.edit.currency')}>
            <SelectMenu
              value={edit.currency}
              onChange={(v) => patchEdit({ currency: v })}
              options={['EUR', 'USD', 'GBP', 'AED', 'TRY'].map((c) => ({ value: c, label: c }))}
            />
          </Field>
        </FormRow>
        <FormRow>
          <Field label={t('projects.edit.totalUnits')}>
            <Input type="number" min="0" value={edit.totalUnits} onChange={(e) => patchEdit({ totalUnits: e.target.value })} />
          </Field>
          <Field label={t('projects.edit.availableUnits')}>
            <Input type="number" min="0" value={edit.availableUnits} onChange={(e) => patchEdit({ availableUnits: e.target.value })} />
          </Field>
        </FormRow>
        <Field label={t('projects.edit.description')}>
          <Textarea rows={4} value={edit.description} onChange={(e) => patchEdit({ description: e.target.value })} />
        </Field>
      </Modal>

      <Modal
        isOpen={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={t('projects.gallery.removeTitle')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removingImage !== null}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={confirmRemoveImage} disabled={removingImage !== null}>
              {removingImage ? t('projects.gallery.removing') : t('common.delete')}
            </Button>
          </>
        }
      >
        {removeTarget && (
          <>
            <img src={removeTarget} alt="" className={styles.removePreview} />
            <p className={styles.removeNote}>{t('projects.gallery.removeBody')}</p>
          </>
        )}
      </Modal>

      <div className={styles.content}>
        <div className={styles.mainContent}>
          <Card className={styles.galleryCard}>
            {project.images.length > 0 && (
              <div className={styles.galleryMain}>
                <img src={project.images[selectedImage]} alt={project.name} className={styles.mainImage} />
                <span className={styles.galleryCounter}>{selectedImage + 1} / {project.images.length}</span>
                {/* Beğenilmeyen görseli kaldır — geliştiriciden gelen galeride
                    her kare işe yaramıyor (madde 19). */}
                <button
                  type="button"
                  className={styles.imageDelete}
                  title={t('projects.gallery.removeImage')}
                  disabled={removingImage !== null}
                  onClick={() => setRemoveTarget(project.images[selectedImage])}
                >
                  <Trash size={15} />
                </button>
              </div>
            )}
            {project.images.length > 1 && (
              <div className={styles.galleryThumbnails}>
                {project.images.map((img, idx) => (
                  <div
                    key={img}
                    className={`${styles.thumbnail} ${selectedImage === idx ? styles.activeThumb : ''}`}
                    onClick={() => setSelectedImage(idx)}
                  >
                    <img src={img} alt={`Thumbnail ${idx}`} />
                  </div>
                ))}
              </div>
            )}
            {project.images.length === 0 && (
              <p className={styles.galleryEmpty}>{t('projects.gallery.empty')}</p>
            )}
          </Card>

          <div className={styles.infoGrid}>
            <Card>
              <CardHeader><h3 className={styles.cardTitle}>{t('projects.overview')}</h3></CardHeader>
              <CardBody>
                <p className={styles.description}>{project.description}</p>
                <div className={styles.statsGrid}>
                  <div className={styles.statBox}>
                    <CurrencyDollar size={16} className={styles.statIcon} />
                    <span className={styles.statLabel}>{t('projects.startingPrice')}</span>
                    <span className={styles.statValue}>{formatCurrency(project.startingPrice)}</span>
                  </div>
                  <div className={styles.statBox}>
                    <Buildings size={16} className={styles.statIcon} />
                    <span className={styles.statLabel}>{t('projects.availability')}</span>
                    <span className={styles.statValue}>{t('projects.unitsCount', { available: project.availableUnits, total: project.totalUnits })}</span>
                    <div className={styles.availabilityTrack} role="img" aria-label={`${soldPct}% sold`}>
                      <div className={styles.availabilityFill} style={{ width: `${soldPct}%` }} />
                    </div>
                    <span className={styles.availabilityNote}>{t('projects.soldPct', { pct: soldPct })}</span>
                  </div>
                  <div className={styles.statBox}>
                    <CalendarBlank size={16} className={styles.statIcon} />
                    <span className={styles.statLabel}>{t('projects.handover')}</span>
                    <span className={styles.statValue}>{project.completionDate}</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className={styles.cardTitle}>{t('projects.amenitiesTitle')}</h3></CardHeader>
              <CardBody>
                <ul className={styles.amenitiesList}>
                  {project.amenities.map((amenity, i) => (
                    <li key={i}><CheckCircle size={14} className={styles.checkIcon} /> {amenity}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>

          <div className={styles.infoGrid}>
            <Card>
              <CardHeader><h3 className={styles.cardTitle}>{t('projects.paymentPlanTitle')}</h3></CardHeader>
              <CardBody>
                <div className={styles.paymentPlan}>
                  <div className={styles.planBar} role="img" aria-label="Payment plan distribution">
                    {project.paymentPlan.map((plan, i) => (
                      <div
                        key={i}
                        className={styles.planSegment}
                        style={{ width: `${plan.percentage}%`, opacity: segmentAlpha(i, project.paymentPlan.length) }}
                      >
                        {plan.percentage >= 15 && <span className={styles.planSegmentLabel}>{plan.percentage}%</span>}
                      </div>
                    ))}
                  </div>
                  {project.paymentPlan.map((plan, i) => (
                    <div key={i} className={styles.paymentRow}>
                      <span
                        className={styles.paymentDot}
                        style={{ opacity: segmentAlpha(i, project.paymentPlan.length) }}
                      />
                      <div className={styles.paymentMilestone}>{plan.milestone}</div>
                      <div className={styles.paymentPercent}>{plan.percentage}%</div>
                      <div className={styles.paymentDate}>{plan.date}</div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className={styles.cardTitle}>{t('projects.audience.title')}</h3>
              </CardHeader>
              <CardBody>
                <ProjectAudience projectId={project.id} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className={styles.cardTitle}>{t('projects.documentsTitle')}</h3></CardHeader>
              <CardBody>
                <div className={styles.docsList}>
                  {project.documents.length === 0 && (
                    <span style={{ color: 'var(--text-muted)' }}>{t('projects.noDocuments')}</span>
                  )}
                  {project.documents.map(doc => (
                    <div key={doc.id} className={styles.docCard} onClick={() => handleDownloadDoc(doc.id)}>
                      <div className={styles.docIcon} data-type={doc.type}>{docIcon(doc.type)}</div>
                      <div className={styles.docInfo}>
                        <span className={styles.docTitle}>{doc.title}</span>
                        <span className={styles.docSize}>{doc.type} &bull; {doc.size}</span>
                      </div>
                      <button
                        className={styles.docAction}
                        aria-label={t('projects.downloadAria', { title: doc.title })}
                        onClick={(e) => { e.stopPropagation(); handleDownloadDoc(doc.id); }}
                      >
                        <DownloadSimple size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* The Right Sidebar with Email Composer to instantly send info */}
        <div className={styles.rightSidebar}>
          <Card className={styles.composerCard}>
            <CardHeader className={styles.composerHeader}>
              <h3 className={styles.cardTitle}>{t('projects.sendInfo')}</h3>
              <span className={styles.integrationBadge}>{t('projects.gmailConnected')}</span>
            </CardHeader>
            <CardBody className={styles.composerBody}>
              <div className={styles.composerForm}>
                <div className={styles.formGroup}>
                  <label>{t('projects.toClient')}</label>
                  <SelectMenu
                    aria-label={t('projects.toClient')}
                    value={shareClient}
                    onChange={setShareClient}
                    placeholder={t('projects.selectClientPh')}
                    options={clients.map(c => ({ value: c.id, label: `${c.name} (${c.clientId})` }))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>{t('projects.subject')}</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={emailSubject ?? t('projects.emailSubject', { project: project.name, developer: project.developerName })}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>{t('projects.message')}</label>
                  <textarea
                    className={styles.textArea}
                    value={emailBody ?? t('projects.emailBody', { project: project.name, location: project.location, price: formatCurrency(project.startingPrice) })}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                </div>

                {project.documents.length > 0 && (
                  <div className={styles.attachmentsSection}>
                    <div className={styles.attachmentLabel}>{t('projects.includedAttachments')}</div>
                    {project.documents.map(doc => (
                      <div key={doc.id} className={styles.attachmentPill}>
                        <Paperclip size={12} /> {doc.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.composerFooter}>
                <Button variant="outline" onClick={() => handleActionClick('Preview Email')}>{t('projects.preview')}</Button>
                <Button
                  variant="primary"
                  disabled={!shareClient || sendingEmail}
                  onClick={async () => {
                    const client = clients.find(c => c.id === shareClient);
                    if (!client) {
                      toast.error(t('projects.selectClientFirst'));
                      return;
                    }
                    const subject = emailSubject ?? t('projects.emailSubject', { project: project.name, developer: project.developerName });
                    const body = emailBody ?? t('projects.emailBody', { project: project.name, location: project.location, price: formatCurrency(project.startingPrice) });
                    setSendingEmail(true);
                    try {
                      await gmailApi.send({ to: client.email, subject, body, recipientName: client.name });
                      toast.success(t('projects.emailSentTo', { name: client.name }));
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : t('projects.emailSendFailed'));
                    } finally {
                      setSendingEmail(false);
                    }
                  }}
                >
                  <PaperPlaneTilt size={16} style={{ marginRight: '8px' }} /> {sendingEmail ? t('clients.email.sending') : t('projects.sendEmail')}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
