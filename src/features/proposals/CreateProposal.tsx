import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { ArrowLeft, CheckCircle, Buildings, Calculator, Image as ImageIcon, PenNib, PaperPlaneTilt, DownloadSimple, User } from '@phosphor-icons/react';
import { Modal } from '../../core/components/Modal/Modal';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { clientsApi, projectsApi, proposalsApi } from '../../core/api/resources';
import { ApiError } from '../../core/api/client';
import { useFetch } from '../../core/hooks/useFetch';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { printProposal } from '../../core/utils/printProposal';
import type { ClientDTO, ProjectDTO } from '../../core/types';
import styles from './CreateProposal.module.css';

interface PaymentPlanRow {
  milestone: string;
  percentage: string;
  date: string;
}

const DEFAULT_PAYMENT_PLAN: PaymentPlanRow[] = [
  { milestone: 'Down Payment', percentage: '20', date: 'On Booking' },
  { milestone: 'During Construction', percentage: '40', date: 'Across 2 Years' },
  { milestone: 'On Handover', percentage: '40', date: 'Handover' },
];

export const CreateProposal: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const { data: clientsData, loading: clientsLoading } = useFetch<ClientDTO[]>(() => clientsApi.list(), []);
  const { data: projectsData, loading: projectsLoading } = useFetch<ProjectDTO[]>(() => projectsApi.list(), []);
  const clients = clientsData ?? [];
  const projects = projectsData ?? [];

  const [selectedClient, setSelectedClient] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [title, setTitle] = useState('');

  const [basePrice, setBasePrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlanRow[]>(DEFAULT_PAYMENT_PLAN);

  const [includeBrochurePdf, setIncludeBrochurePdf] = useState(true);
  const [includeFloorPlans, setIncludeFloorPlans] = useState(true);
  const [includeRoiSheet, setIncludeRoiSheet] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

  const [isSending, setIsSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const selectedClientObj = clients.find((c) => c.id === selectedClient);
  const selectedProjectObj = projects.find((p) => p.id === selectedProject);
  const currency = selectedProjectObj?.currency ?? 'EUR';

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    if (!title.trim()) setTitle(t('proposals.create.titleTemplate', { project: proj.name }));
    if (!basePrice) setBasePrice(String(proj.startingPrice));
    setPaymentPlan(proj.paymentPlan.map((pp) => ({
      milestone: pp.milestone, percentage: String(pp.percentage), date: pp.date,
    })));
    setSelectedPhotos(proj.images);
  };

  const updatePaymentRow = (idx: number, patch: Partial<PaymentPlanRow>) => {
    setPaymentPlan((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const togglePhoto = (url: string) => {
    setSelectedPhotos((cur) => (cur.includes(url) ? cur.filter((u) => u !== url) : [...cur, url]));
  };

  const basePriceNum = Number(basePrice) || 0;
  const discountNum = Number(discountPercent) || 0;
  const totalValue = Math.round(basePriceNum * (1 - discountNum / 100));

  const attachmentLabels = [
    includeBrochurePdf ? t('proposals.create.brochurePdf') : null,
    includeFloorPlans ? t('proposals.create.floorPlansPdf') : null,
    includeRoiSheet ? t('proposals.create.roiSheet') : null,
  ].filter((v): v is string => Boolean(v));

  const handleSaveAndSend = async () => {
    if (!selectedClient || !selectedProject || !title.trim()) {
      toast.error(t('proposals.create.missingFields'));
      setCurrentStep(1);
      return;
    }
    setIsSending(true);
    try {
      await proposalsApi.create({
        title: title.trim(),
        contactId: selectedClient,
        propertyId: selectedProject,
        totalValue,
        currency,
        metadata: {
          basePrice: basePriceNum,
          discountPercent: discountNum,
          paymentPlan,
          includeBrochurePdf,
          includeFloorPlans,
          includeRoiSheet,
          selectedPhotos,
        },
      });
      setShowSuccessModal(true);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('proposals.create.sendError');
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    navigate('/proposals');
  };

  const handleDownloadPdf = () => {
    printProposal();
  };

  const dateLocale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';
  const stepHeading = t(`proposals.create.stepHeadings.${currentStep}`);
  const coverImage = selectedPhotos[0] ?? selectedProjectObj?.images[0] ?? '/images/exterior.png';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={styles.title}>{t('proposals.create.title')}</h1>
            <p className={styles.subtitle}>{t('proposals.create.subtitle')}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={() => navigate(-1)}>{t('proposals.create.cancel')}</Button>
          <Button variant="primary" onClick={handleSaveAndSend} disabled={currentStep !== totalSteps || isSending}>
            <PaperPlaneTilt size={16} style={{ marginRight: 6 }} />
            {isSending ? t('proposals.create.sending') : t('proposals.create.sendProposal')}
          </Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <Card>
            <CardBody className={styles.stepsContainer}>
              <div className={`${styles.stepItem} ${currentStep >= 1 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(1)}>
                <div className={styles.stepCircle}><User size={14} /></div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>{t('proposals.create.steps.target.title')}</div>
                  <div className={styles.stepDesc}>{t('proposals.create.steps.target.desc')}</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 2 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(2)}>
                <div className={styles.stepCircle}><Calculator size={14} /></div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>{t('proposals.create.steps.financial.title')}</div>
                  <div className={styles.stepDesc}>{t('proposals.create.steps.financial.desc')}</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 3 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(3)}>
                <div className={styles.stepCircle}><ImageIcon size={14} /></div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>{t('proposals.create.steps.marketing.title')}</div>
                  <div className={styles.stepDesc}>{t('proposals.create.steps.marketing.desc')}</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 4 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(4)}>
                <div className={styles.stepCircle}><PenNib size={14} /></div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>{t('proposals.create.steps.preview.title')}</div>
                  <div className={styles.stepDesc}>{t('proposals.create.steps.preview.desc')}</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className={styles.main}>
          <Card className={styles.mainCard}>
            <CardHeader>
              <h3 className={styles.cardTitle}>{stepHeading}</h3>
            </CardHeader>
            <CardBody className={styles.cardBodyScroll}>

              {/* STEP 1 */}
              {currentStep === 1 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>{t('proposals.create.selectClient')}</label>
                    <SelectMenu
                      aria-label={t('proposals.create.selectClient')}
                      value={selectedClient}
                      onChange={setSelectedClient}
                      disabled={clientsLoading}
                      placeholder={t('proposals.create.selectClientPh')}
                      options={clients.map((c) => ({ value: c.id, label: c.type === 'VIP' ? `${c.name} (VIP)` : c.name }))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>{t('proposals.create.selectProject')}</label>
                    <SelectMenu
                      aria-label={t('proposals.create.selectProject')}
                      value={selectedProject}
                      onChange={handleProjectChange}
                      disabled={projectsLoading}
                      placeholder={t('proposals.create.selectProjectPh')}
                      options={projects.map((p) => ({ value: p.id, label: `${p.name} (${p.developerName})` }))}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{t('proposals.create.proposalTitle')}</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t('proposals.create.proposalTitle')}
                    />
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {currentStep === 2 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>{t('proposals.create.basePrice')}</label>
                    <input
                      type="number"
                      className={styles.textInput}
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{t('proposals.create.specialDiscount')}</label>
                    <input
                      type="number"
                      className={styles.textInput}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                    />
                  </div>

                  <div className={styles.sectionDivider} style={{ gridColumn: 'span 2' }}>
                    <h4>{t('proposals.create.paymentPlan')}</h4>
                  </div>

                  <div className={styles.paymentPlanBuilder} style={{ gridColumn: 'span 2' }}>
                    {paymentPlan.map((row, idx) => (
                      <div className={styles.paymentRowForm} key={idx}>
                        <input
                          type="text"
                          className={styles.textInput}
                          value={row.milestone}
                          onChange={(e) => updatePaymentRow(idx, { milestone: e.target.value })}
                        />
                        <input
                          type="number"
                          className={styles.textInput}
                          value={row.percentage}
                          onChange={(e) => updatePaymentRow(idx, { percentage: e.target.value })}
                          style={{ width: '100px' }}
                        />
                        <input
                          type="text"
                          className={styles.textInput}
                          value={row.date}
                          onChange={(e) => updatePaymentRow(idx, { date: e.target.value })}
                        />
                      </div>
                    ))}
                    <p className={styles.hintText}>{t('proposals.create.paymentPlanHint')}</p>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {currentStep === 3 && (
                <div className={styles.mediaSelection}>
                  <div className={styles.formGroup}>
                    <label>{t('proposals.create.includeBrochures')}</label>
                    <div className={styles.checkboxList}>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" checked={includeBrochurePdf} onChange={(e) => setIncludeBrochurePdf(e.target.checked)} /> {t('proposals.create.brochurePdf')}
                      </label>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" checked={includeFloorPlans} onChange={(e) => setIncludeFloorPlans(e.target.checked)} /> {t('proposals.create.floorPlansPdf')}
                      </label>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" checked={includeRoiSheet} onChange={(e) => setIncludeRoiSheet(e.target.checked)} /> {t('proposals.create.roiSheet')}
                      </label>
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ marginTop: '24px' }}>
                    <label>{t('proposals.create.selectPhotos')}</label>
                    {selectedProjectObj ? (
                      <div className={styles.photoGrid}>
                        {selectedProjectObj.images.map((img) => (
                          <div
                            key={img}
                            className={`${styles.photoItem} ${selectedPhotos.includes(img) ? styles.photoSelected : ''}`}
                            onClick={() => togglePhoto(img)}
                            role="button"
                            tabIndex={0}
                          >
                            <img src={img} alt="" />
                            {selectedPhotos.includes(img) && <div className={styles.checkOverlay}><CheckCircle size={24} /></div>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.hintText}>{t('proposals.create.selectProjectFirst')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: PREVIEW */}
              {currentStep === 4 && (
                <div className={styles.previewContainer}>
                  <div className={styles.digitalProposal} data-print-root>
                    <div className={styles.proposalHeader}>
                      {/* ProDuality Branding explicitly requested by user */}
                      <div className={styles.brandLogo}>
                        <Buildings size={28} />
                        <span>ProDuality</span>
                      </div>
                      <div className={styles.proposalMeta}>
                        <div>{t('proposals.view.preparedFor', { name: selectedClientObj?.name ?? '—' })}</div>
                        <div className={styles.metaDate}>{t('proposals.view.date', { date: new Date().toLocaleDateString(dateLocale) })}</div>
                      </div>
                    </div>

                    <div className={styles.proposalCover}>
                      <img src={coverImage} alt="Cover" className={styles.coverImage} />
                      <div className={styles.coverText} data-print-cover>
                        <h2>{t('proposals.view.coverTag')}</h2>
                        <h1>{selectedProjectObj?.name ?? '—'}</h1>
                        <p>{selectedProjectObj?.location ?? ''}</p>
                      </div>
                    </div>

                    <div className={styles.proposalBody}>
                      <div className={styles.bodySection}>
                        <h3>{t('proposals.view.financialSummary')}</h3>
                        <div className={styles.financialSummary}>
                          <div className={styles.finBox}>
                            <span>{t('proposals.view.totalInvestment')}</span>
                            <strong>{currency} {totalValue.toLocaleString()}</strong>
                          </div>
                          <div className={styles.finBox}>
                            <span>{t('proposals.view.handover')}</span>
                            <strong>{selectedProjectObj?.completionDate ?? '—'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className={styles.bodySection}>
                        <h3>{t('proposals.view.paymentPlan')}</h3>
                        <table className={styles.previewTable}>
                          <thead>
                            <tr><th>{t('proposals.view.milestone')}</th><th>{t('proposals.view.percentage')}</th><th>{t('proposals.view.planDate')}</th></tr>
                          </thead>
                          <tbody>
                            {paymentPlan.map((row, idx) => (
                              <tr key={idx}><td>{row.milestone}</td><td>{row.percentage}%</td><td>{row.date}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className={styles.attachmentsSectionPreview}>
                        <h3>{t('proposals.view.includedAttachments')}</h3>
                        <div className={styles.attachmentPills}>
                          {attachmentLabels.length > 0
                            ? attachmentLabels.map((label) => (
                              <div className={styles.pill} key={label}><PenNib size={14} /> {label}</div>
                            ))
                            : <span className={styles.hintText}>{t('proposals.create.noAttachments')}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.previewActions}>
                    <Button variant="outline" onClick={handleDownloadPdf}><DownloadSimple size={16} style={{ marginRight: 6 }} /> {t('proposals.create.downloadAsPdf')}</Button>
                    <p className={styles.hintText}>{t('proposals.create.emailHint')}</p>
                  </div>
                </div>
              )}

            </CardBody>
          </Card>

          <div className={styles.navigationFooter}>
            <Button
              variant="outline"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
            >
              {t('proposals.create.previousStep')}
            </Button>
            {currentStep < totalSteps ? (
              <Button
                variant="primary"
                onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
              >
                {t('proposals.create.nextStep')}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSaveAndSend}
                disabled={isSending}
              >
                {isSending ? t('proposals.create.sending') : t('proposals.create.sendToClient')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <Modal
        isOpen={showSuccessModal}
        onClose={handleCloseModal}
        title={t('proposals.create.successTitle')}
        footer={
          <Button variant="primary" onClick={handleCloseModal}>{t('proposals.create.backToProposals')}</Button>
        }
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t('proposals.create.successBody')}<br/>
            {t('proposals.create.successBody2')}
          </p>
        </div>
      </Modal>
    </div>
  );
};
