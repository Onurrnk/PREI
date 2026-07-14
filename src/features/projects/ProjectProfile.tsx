import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import type { ProjectDTO } from '../../core/types';
import { projectsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { ArrowLeft, MapPin, Buildings, CalendarBlank, CurrencyDollar, CheckCircle, FileText, FilePdf, Table, DownloadSimple, PaperPlaneTilt, Paperclip } from '@phosphor-icons/react';
import styles from './ProjectProfile.module.css';

export const ProjectProfile: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading } = useFetch<ProjectDTO[]>(() => projectsApi.list(), [id]);
  const project = (data ?? []).find(p => p.id === id) ?? null;
  const [selectedImage, setSelectedImage] = useState(0);
  const [shareClient, setShareClient] = useState('');

  const toast = useToast();

  const handleActionClick = (actionName: string) => {
    toast.info(actionName);
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
            </div>
            <p className={styles.subtitle}>
              <Buildings size={14} className={styles.inlineIcon} /> {t('projects.by', { developer: project.developerName })} &bull;
              <MapPin size={14} className={styles.inlineIcon} style={{ marginLeft: '8px' }} /> {project.location}
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={() => handleActionClick('Download Full Media Kit')}><FileText size={16} /> {t('projects.mediaKit')}</Button>
          <Button variant="primary" onClick={() => handleActionClick('Reserve Unit')}>{t('projects.reserveUnit')}</Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.mainContent}>
          <Card className={styles.galleryCard}>
            <div className={styles.galleryMain}>
              <img src={project.images[selectedImage]} alt={project.name} className={styles.mainImage} />
              <span className={styles.galleryCounter}>{selectedImage + 1} / {project.images.length}</span>
            </div>
            {project.images.length > 1 && (
              <div className={styles.galleryThumbnails}>
                {project.images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`${styles.thumbnail} ${selectedImage === idx ? styles.activeThumb : ''}`}
                    onClick={() => setSelectedImage(idx)}
                  >
                    <img src={img} alt={`Thumbnail ${idx}`} />
                  </div>
                ))}
              </div>
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
              <CardHeader><h3 className={styles.cardTitle}>{t('projects.documentsTitle')}</h3></CardHeader>
              <CardBody>
                <div className={styles.docsList}>
                  {project.documents.map(doc => (
                    <div key={doc.id} className={styles.docCard} onClick={() => handleActionClick(t('projects.viewDocument', { title: doc.title }))}>
                      <div className={styles.docIcon} data-type={doc.type}>{docIcon(doc.type)}</div>
                      <div className={styles.docInfo}>
                        <span className={styles.docTitle}>{doc.title}</span>
                        <span className={styles.docSize}>{doc.type} &bull; {doc.size}</span>
                      </div>
                      <button
                        className={styles.docAction}
                        aria-label={t('projects.downloadAria', { title: doc.title })}
                        onClick={(e) => { e.stopPropagation(); handleActionClick(t('projects.download', { title: doc.title })); }}
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
                    options={[
                      { value: 'c1', label: 'Oliver Hartwell (CL-10024)' },
                      { value: 'c2', label: 'Sarah Ahmed (CL-10025)' },
                      { value: 'c3', label: 'Mohammed Al Fayed (VIP)' },
                    ]}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>{t('projects.subject')}</label>
                  <input type="text" className={styles.textInput} defaultValue={t('projects.emailSubject', { project: project.name, developer: project.developerName })} />
                </div>

                <div className={styles.formGroup}>
                  <label>{t('projects.message')}</label>
                  <textarea className={styles.textArea} defaultValue={t('projects.emailBody', { project: project.name, location: project.location, price: formatCurrency(project.startingPrice) })}></textarea>
                </div>

                <div className={styles.attachmentsSection}>
                  <div className={styles.attachmentLabel}>{t('projects.includedAttachments')}</div>
                  {project.documents.map(doc => (
                    <div key={doc.id} className={styles.attachmentPill}>
                      <Paperclip size={12} /> {doc.title}.pdf
                    </div>
                  ))}
                  <div className={styles.attachmentPill}>
                    <Paperclip size={12} /> {project.name}_Gallery.zip
                  </div>
                </div>
              </div>

              <div className={styles.composerFooter}>
                <Button variant="outline" onClick={() => handleActionClick('Preview Email')}>{t('projects.preview')}</Button>
                <Button variant="primary" onClick={() => handleActionClick('Send Email to Client')}><PaperPlaneTilt size={16} style={{ marginRight: '8px' }} /> {t('projects.sendEmail')}</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
