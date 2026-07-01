import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { ArrowLeft, UploadCloud, Plus, X, FileText, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../core/components/Modal/Modal';
import styles from './AddProject.module.css';

export const AddProject: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={styles.title}>Add New Project</h1>
            <p className={styles.subtitle}>Enter detailed intelligence and media for the new property project.</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            <CheckCircle2 size={16} style={{ marginRight: 6 }} /> 
            {isSaving ? 'Saving...' : 'Save Project'}
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
                  <div className={styles.stepTitle}>General Information</div>
                  <div className={styles.stepDesc}>Basic details and location</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 2 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(2)}>
                <div className={styles.stepCircle}>2</div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>Financials & Planning</div>
                  <div className={styles.stepDesc}>Pricing, units, payment plan</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 3 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(3)}>
                <div className={styles.stepCircle}>3</div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>Media & Documents</div>
                  <div className={styles.stepDesc}>Photos, floor plans, brochures</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 4 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(4)}>
                <div className={styles.stepCircle}>4</div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>Amenities & Features</div>
                  <div className={styles.stepDesc}>Key selling points</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className={styles.main}>
          <Card>
            <CardHeader>
              <h3 className={styles.cardTitle}>
                {currentStep === 1 && "General Information"}
                {currentStep === 2 && "Financials & Payment Plan"}
                {currentStep === 3 && "Media & Documents Upload"}
                {currentStep === 4 && "Amenities & Features"}
              </h3>
            </CardHeader>
            <CardBody>
              
              {/* STEP 1: General Info */}
              {currentStep === 1 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>Project Name</label>
                    <input type="text" className={styles.textInput} placeholder="e.g. Beachfront Residences" />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Developer</label>
                    <select className={styles.selectInput} defaultValue="">
                      <option value="" disabled>Select Developer...</option>
                      <option value="emaar">Emaar Properties</option>
                      <option value="damac">DAMAC Properties</option>
                      <option value="nakheel">Nakheel</option>
                    </select>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Status</label>
                    <select className={styles.selectInput} defaultValue="off-plan">
                      <option value="off-plan">Off-plan</option>
                      <option value="under-construction">Under Construction</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>Location / Area</label>
                    <input type="text" className={styles.textInput} placeholder="e.g. Dubai Marina" />
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>Project Description</label>
                    <textarea className={styles.textArea} placeholder="Enter an enticing description for marketing..." rows={4}></textarea>
                  </div>
                </div>
              )}

              {/* STEP 2: Financials */}
              {currentStep === 2 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Starting Price (USD)</label>
                    <input type="number" className={styles.textInput} placeholder="e.g. 2500000" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Expected Handover Date</label>
                    <input type="text" className={styles.textInput} placeholder="e.g. Q4 2027" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Total Units</label>
                    <input type="number" className={styles.textInput} placeholder="e.g. 350" />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Available Units</label>
                    <input type="number" className={styles.textInput} placeholder="e.g. 42" />
                  </div>

                  <div className={styles.sectionDivider} style={{ gridColumn: 'span 2' }}>
                    <h4>Payment Plan Builder</h4>
                    <p>Define the payment milestones for this project.</p>
                  </div>

                  <div className={styles.paymentPlanBuilder} style={{ gridColumn: 'span 2' }}>
                    {paymentPlans.map((_, idx) => (
                      <div key={idx} className={styles.paymentRowForm}>
                        <input type="text" className={styles.textInput} placeholder="Milestone (e.g. Down Payment)" />
                        <input type="number" className={styles.textInput} placeholder="%" style={{ width: '100px' }} />
                        <input type="text" className={styles.textInput} placeholder="Date/Condition" />
                        <button className={styles.iconBtnDanger} onClick={() => handleRemovePaymentPlan(idx)}>
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <Button variant="outline" onClick={handleAddPaymentPlan} style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                      <Plus size={16} /> Add Milestone
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: Media */}
              {currentStep === 3 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>High-Resolution Photos (Gallery)</label>
                    <div className={styles.dropZone}>
                      <UploadCloud size={32} className={styles.dropIcon} />
                      <p>Drag and drop exterior, interior, and amenity images here</p>
                      <span className={styles.dropHint}>Supports JPG, PNG (Max 10MB per file)</span>
                      <Button variant="outline" style={{ marginTop: '12px' }}>Browse Files</Button>
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>Documents (Brochures, Floor Plans, Payment Terms)</label>
                    <div className={styles.dropZone}>
                      <FileText size={32} className={styles.dropIcon} />
                      <p>Drag and drop PDF documents here</p>
                      <span className={styles.dropHint}>Supports PDF, Excel (Max 50MB per file)</span>
                      <Button variant="outline" style={{ marginTop: '12px' }}>Browse Files</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Amenities */}
              {currentStep === 4 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>Add Project Amenities</label>
                    <input 
                      type="text" 
                      className={styles.textInput} 
                      placeholder="Type amenity and press Enter (e.g. Infinity Pool, Smart Home...)" 
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
              Previous Step
            </Button>
            {currentStep < totalSteps ? (
              <Button 
                variant="primary" 
                onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
              >
                Next Step
              </Button>
            ) : (
              <Button 
                variant="primary" 
                onClick={handleSave}
              >
                Complete & Save Project
              </Button>
            )}
          </div>
        </div>
      </div>
      <Modal 
        isOpen={showSuccessModal} 
        onClose={handleModalClose}
        title="Project Created Successfully"
        footer={
          <Button variant="primary" onClick={handleModalClose}>Go to Projects List</Button>
        }
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle2 size={48} color="var(--color-success)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            The new property project has been saved successfully.<br/>
            It is now available in the intelligence database and can be included in proposals.
          </p>
        </div>
      </Modal>
    </div>
  );
};
