import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { ArrowLeft, Plus, X, CheckCircle } from '@phosphor-icons/react';
import { Modal } from '../../core/components/Modal/Modal';
import { UploadZone } from '../../core/components/Form/UploadZone';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import styles from './AddProject.module.css';

export const AddProject: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const [developer, setDeveloper] = useState('');
  const [projectStatus, setProjectStatus] = useState('off-plan');
  const [paymentPlans, setPaymentPlans] = useState([{ milestone: '', percentage: '', date: '' }]);
  const [amenities, setAmenities] = useState<string[]>(['Pool', 'Gym']);
  const [newAmenity, setNewAmenity] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleAddPaymentPlan = () => {
    setPaymentPlans([...paymentPlans, { milestone: '', percentage: '', date: '' }]);
  };

  const handleRemovePaymentPlan = (index: number) => {
    setPaymentPlans(paymentPlans.filter((_, i) => i !== index));
  };

  const handleAddAmenity = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newAmenity.trim() !== '') {
      e.preventDefault();
      setAmenities([...amenities, newAmenity.trim()]);
      setNewAmenity('');
    }
  };

  const handleRemoveAmenity = (amenity: string) => {
    setAmenities(amenities.filter(a => a !== amenity));
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccessModal(true);
    }, 1500);
  };

  const handleModalClose = () => {
    setShowSuccessModal(false);
    navigate('/projects');
  };

  const stepHeading = t(`projects.add.stepHeadings.${currentStep}`);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={styles.title}>{t('projects.add.title')}</h1>
            <p className={styles.subtitle}>{t('projects.add.subtitle')}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={() => navigate(-1)}>{t('projects.add.cancel')}</Button>
          {/* DS §5.4: sayfada tek primary — sihirbazın asıl CTA'sı alttaki Next/Complete */}
          <Button variant="secondary" onClick={handleSave} disabled={isSaving}>
            <CheckCircle size={16} style={{ marginRight: 6 }} />
            {isSaving ? t('projects.add.saving') : t('projects.add.saveDraft')}
          </Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <Card>
            <CardBody className={styles.stepsContainer}>
              <div className={`${styles.stepItem} ${currentStep >= 1 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(1)}>
                <div className={styles.stepCircle}>1</div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>{t('projects.add.steps.general.title')}</div>
                  <div className={styles.stepDesc}>{t('projects.add.steps.general.desc')}</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 2 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(2)}>
                <div className={styles.stepCircle}>2</div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>{t('projects.add.steps.financial.title')}</div>
                  <div className={styles.stepDesc}>{t('projects.add.steps.financial.desc')}</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 3 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(3)}>
                <div className={styles.stepCircle}>3</div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>{t('projects.add.steps.media.title')}</div>
                  <div className={styles.stepDesc}>{t('projects.add.steps.media.desc')}</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 4 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(4)}>
                <div className={styles.stepCircle}>4</div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>{t('projects.add.steps.amenities.title')}</div>
                  <div className={styles.stepDesc}>{t('projects.add.steps.amenities.desc')}</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className={styles.main}>
          <Card>
            <CardHeader>
              <h3 className={styles.cardTitle}>{stepHeading}</h3>
            </CardHeader>
            <CardBody>

              {/* STEP 1: General Info */}
              {currentStep === 1 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{t('projects.add.projectName')}</label>
                    <input type="text" className={styles.textInput} placeholder={t('projects.add.projectNamePh')} />
                  </div>

                  <div className={styles.formGroup}>
                    <label>{t('projects.add.developer')}</label>
                    <SelectMenu
                      aria-label={t('projects.add.developer')}
                      value={developer}
                      onChange={setDeveloper}
                      placeholder={t('projects.add.developerPh')}
                      options={[
                        { value: 'emaar', label: 'Emaar Properties' },
                        { value: 'damac', label: 'DAMAC Properties' },
                        { value: 'nakheel', label: 'Nakheel' },
                      ]}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>{t('projects.add.status')}</label>
                    <SelectMenu
                      aria-label={t('projects.add.status')}
                      value={projectStatus}
                      onChange={setProjectStatus}
                      options={[
                        { value: 'off-plan', label: t('projects.add.statusOptions.offPlan') },
                        { value: 'under-construction', label: t('projects.add.statusOptions.underConstruction') },
                        { value: 'completed', label: t('projects.add.statusOptions.completed') },
                      ]}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{t('projects.add.location')}</label>
                    <input type="text" className={styles.textInput} placeholder={t('projects.add.locationPh')} />
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{t('projects.add.description')}</label>
                    <textarea className={styles.textArea} placeholder={t('projects.add.descriptionPh')} rows={4}></textarea>
                  </div>
                </div>
              )}

              {/* STEP 2: Financials */}
              {currentStep === 2 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>{t('projects.add.startingPrice')}</label>
                    <input type="number" className={styles.textInput} placeholder={t('projects.add.startingPricePh')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{t('projects.add.handoverDate')}</label>
                    <input type="text" className={styles.textInput} placeholder={t('projects.add.handoverDatePh')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{t('projects.add.totalUnits')}</label>
                    <input type="number" className={styles.textInput} placeholder={t('projects.add.totalUnitsPh')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>{t('projects.add.availableUnits')}</label>
                    <input type="number" className={styles.textInput} placeholder={t('projects.add.availableUnitsPh')} />
                  </div>

                  <div className={styles.sectionDivider} style={{ gridColumn: 'span 2' }}>
                    <h4>{t('projects.add.paymentPlanBuilder')}</h4>
                    <p>{t('projects.add.paymentPlanBuilderDesc')}</p>
                  </div>

                  <div className={styles.paymentPlanBuilder} style={{ gridColumn: 'span 2' }}>
                    {paymentPlans.map((_, idx) => (
                      <div key={idx} className={styles.paymentRowForm}>
                        <input type="text" className={styles.textInput} placeholder={t('projects.add.milestonePh')} />
                        <input type="number" className={styles.textInput} placeholder="%" style={{ width: '100px' }} />
                        <input type="text" className={styles.textInput} placeholder={t('projects.add.datePh')} />
                        <button className={styles.iconBtnDanger} onClick={() => handleRemovePaymentPlan(idx)}>
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <Button variant="outline" onClick={handleAddPaymentPlan} style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                      <Plus size={16} /> {t('projects.add.addMilestone')}
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: Media */}
              {currentStep === 3 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{t('projects.add.galleryLabel')}</label>
                    <UploadZone
                      kind="image"
                      accept="image/jpeg,image/png,image/webp"
                      prompt={t('projects.add.galleryPrompt')}
                      hint={t('projects.add.galleryHint')}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{t('projects.add.videoLabel')}</label>
                    <UploadZone
                      kind="video"
                      accept="video/mp4,video/quicktime,video/webm"
                      prompt={t('projects.add.videoPrompt')}
                      hint={t('projects.add.videoHint')}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{t('projects.add.documentsLabel')}</label>
                    <UploadZone
                      kind="document"
                      accept=".pdf,.xls,.xlsx,application/pdf"
                      prompt={t('projects.add.documentsPrompt')}
                      hint={t('projects.add.documentsHint')}
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: Amenities */}
              {currentStep === 4 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>{t('projects.add.addAmenities')}</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder={t('projects.add.addAmenitiesPh')}
                      value={newAmenity}
                      onChange={(e) => setNewAmenity(e.target.value)}
                      onKeyDown={handleAddAmenity}
                    />
                  </div>

                  <div className={styles.amenitiesContainer} style={{ gridColumn: 'span 2' }}>
                    {amenities.map(am => (
                      <div key={am} className={styles.amenityTag}>
                        {am}
                        <button className={styles.removeAmenityBtn} onClick={() => handleRemoveAmenity(am)}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
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
              {t('projects.add.previousStep')}
            </Button>
            {currentStep < totalSteps ? (
              <Button
                variant="primary"
                onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
              >
                {t('projects.add.nextStep')}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSave}
              >
                {t('projects.add.completeSave')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <Modal
        isOpen={showSuccessModal}
        onClose={handleModalClose}
        title={t('projects.add.successTitle')}
        footer={
          <Button variant="primary" onClick={handleModalClose}>{t('projects.add.goToList')}</Button>
        }
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t('projects.add.successBody')}<br/>
            {t('projects.add.successBody2')}
          </p>
        </div>
      </Modal>
    </div>
  );
};
