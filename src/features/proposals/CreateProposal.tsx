import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { ArrowLeft, CheckCircle, User, Buildings, Calculator, Image as ImageIcon, PenNib, PaperPlaneTilt, DownloadSimple } from '@phosphor-icons/react';
import { Modal } from '../../core/components/Modal/Modal';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import styles from './CreateProposal.module.css';

export const CreateProposal: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const [selectedClient, setSelectedClient] = useState('');
  const [selectedProject, setSelectedProject] = useState('');

  const [isSending, setIsSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSaveAndSend = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setShowSuccessModal(true);
    }, 1500);
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    navigate('/proposals');
  };

  const dateLocale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';
  const stepHeading = t(`proposals.create.stepHeadings.${currentStep}`);

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
                      placeholder={t('proposals.create.selectClientPh')}
                      options={[
                        { value: 'c1', label: 'Oliver Hartwell (VIP)' },
                        { value: 'c2', label: 'Sarah Ahmed' },
                        { value: 'c3', label: 'Mohammed Al Fayed' },
                      ]}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>{t('proposals.create.selectProject')}</label>
                    <SelectMenu
                      aria-label={t('proposals.create.selectProject')}
                      value={selectedProject}
                      onChange={setSelectedProject}
                      placeholder={t('proposals.create.selectProjectPh')}
                      options={[
                        { value: 'p1', label: 'Beachfront Residences (Emaar)' },
                        { value: 'p2', label: 'Downtown Heights (Emaar)' },
                        { value: 'p3', label: 'DAMAC Hills Villas' },
                      ]}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{t('proposals.create.proposalTitle')}</label>
                    <input type="text" className={styles.textInput} defaultValue="Exclusive Investment Opportunity: Beachfront Residences" />
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {currentStep === 2 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>{t('proposals.create.basePrice')}</label>
                    <input type="number" className={styles.textInput} defaultValue={2500000} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{t('proposals.create.specialDiscount')}</label>
                    <input type="number" className={styles.textInput} defaultValue={0} />
                  </div>

                  <div className={styles.sectionDivider} style={{ gridColumn: 'span 2' }}>
                    <h4>{t('proposals.create.paymentPlan')}</h4>
                  </div>

                  <div className={styles.paymentPlanBuilder} style={{ gridColumn: 'span 2' }}>
                    <div className={styles.paymentRowForm}>
                      <input type="text" className={styles.textInput} defaultValue="Down Payment" />
                      <input type="number" className={styles.textInput} defaultValue={20} style={{ width: '100px' }} />
                      <input type="text" className={styles.textInput} defaultValue="On Booking" />
                    </div>
                    <div className={styles.paymentRowForm}>
                      <input type="text" className={styles.textInput} defaultValue="During Construction" />
                      <input type="number" className={styles.textInput} defaultValue={40} style={{ width: '100px' }} />
                      <input type="text" className={styles.textInput} defaultValue="Across 2 Years" />
                    </div>
                    <div className={styles.paymentRowForm}>
                      <input type="text" className={styles.textInput} defaultValue="On Handover" />
                      <input type="number" className={styles.textInput} defaultValue={40} style={{ width: '100px' }} />
                      <input type="text" className={styles.textInput} defaultValue="Q4 2027" />
                    </div>
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
                        <input type="checkbox" defaultChecked /> {t('proposals.create.brochurePdf')}
                      </label>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" defaultChecked /> {t('proposals.create.floorPlansPdf')}
                      </label>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" /> {t('proposals.create.roiSheet')}
                      </label>
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ marginTop: '24px' }}>
                    <label>{t('proposals.create.selectPhotos')}</label>
                    <div className={styles.photoGrid}>
                      <div className={`${styles.photoItem} ${styles.photoSelected}`}>
                        <img src="/images/exterior.png" alt="Exterior" />
                        <div className={styles.checkOverlay}><CheckCircle size={24} /></div>
                      </div>
                      <div className={`${styles.photoItem} ${styles.photoSelected}`}>
                        <img src="/images/interior.png" alt="Interior" />
                        <div className={styles.checkOverlay}><CheckCircle size={24} /></div>
                      </div>
                      <div className={styles.photoItem}>
                        <img src="/images/amenities.png" alt="Amenities" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: PREVIEW */}
              {currentStep === 4 && (
                <div className={styles.previewContainer}>
                  <div className={styles.digitalProposal}>
                    <div className={styles.proposalHeader}>
                      {/* ProDuality Branding explicitly requested by user */}
                      <div className={styles.brandLogo}>
                        <Buildings size={28} />
                        <span>ProDuality</span>
                      </div>
                      <div className={styles.proposalMeta}>
                        <div>{t('proposals.view.preparedFor', { name: 'Oliver Hartwell' })}</div>
                        <div>{t('proposals.view.date', { date: new Date().toLocaleDateString(dateLocale) })}</div>
                      </div>
                    </div>

                    <div className={styles.proposalCover}>
                      <img src="/images/exterior.png" alt="Cover" className={styles.coverImage} />
                      <div className={styles.coverText}>
                        <h2>{t('proposals.view.coverTag')}</h2>
                        <h1>Beachfront Residences</h1>
                        <p>{t('proposals.view.locationPlaceholder')}</p>
                      </div>
                    </div>

                    <div className={styles.proposalBody}>
                      <div className={styles.bodySection}>
                        <h3>{t('proposals.view.financialSummary')}</h3>
                        <div className={styles.financialSummary}>
                          <div className={styles.finBox}>
                            <span>{t('proposals.view.totalInvestment')}</span>
                            <strong>$2,500,000</strong>
                          </div>
                          <div className={styles.finBox}>
                            <span>{t('proposals.view.expectedRoi')}</span>
                            <strong>7.5% p.a.</strong>
                          </div>
                          <div className={styles.finBox}>
                            <span>{t('proposals.view.handover')}</span>
                            <strong>Q4 2027</strong>
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
                            <tr><td>{t('proposals.view.downPayment')}</td><td>20%</td><td>{t('proposals.view.onBooking')}</td></tr>
                            <tr><td>{t('proposals.view.duringConstruction')}</td><td>40%</td><td>{t('proposals.view.acrossTwoYears')}</td></tr>
                            <tr><td>{t('proposals.view.onHandover')}</td><td>40%</td><td>Q4 2027</td></tr>
                          </tbody>
                        </table>
                      </div>

                      <div className={styles.attachmentsSectionPreview}>
                        <h3>{t('proposals.view.includedAttachments')}</h3>
                        <div className={styles.attachmentPills}>
                          <div className={styles.pill}><PenNib size={14}/> Project_Brochure.pdf</div>
                          <div className={styles.pill}><PenNib size={14}/> Floor_Plans.pdf</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.previewActions}>
                    <Button variant="outline"><DownloadSimple size={16} style={{marginRight: 6}}/> {t('proposals.create.downloadAsPdf')}</Button>
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
              >
                {t('proposals.create.sendToClient')}
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
