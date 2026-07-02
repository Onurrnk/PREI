import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { ArrowLeft, CheckCircle, User, Buildings, Calculator, Image as ImageIcon, PenNib, PaperPlaneTilt, DownloadSimple } from '@phosphor-icons/react';
import { Modal } from '../../core/components/Modal/Modal';
import styles from './CreateProposal.module.css';

export const CreateProposal: React.FC = () => {
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={styles.title}>Create New Proposal</h1>
            <p className={styles.subtitle}>Build a customized, professional property pitch for your client.</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveAndSend} disabled={currentStep !== totalSteps || isSending}>
            <PaperPlaneTilt size={16} style={{ marginRight: 6 }} /> 
            {isSending ? 'Sending...' : 'Send Proposal'}
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
                  <div className={styles.stepTitle}>Target Selection</div>
                  <div className={styles.stepDesc}>Client & Project</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 2 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(2)}>
                <div className={styles.stepCircle}><Calculator size={14} /></div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>Financial Offer</div>
                  <div className={styles.stepDesc}>Pricing & Payment</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 3 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(3)}>
                <div className={styles.stepCircle}><ImageIcon size={14} /></div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>Marketing Assets</div>
                  <div className={styles.stepDesc}>Brochures & Photos</div>
                </div>
              </div>
              <div className={`${styles.stepItem} ${currentStep >= 4 ? styles.stepActive : ''}`} onClick={() => setCurrentStep(4)}>
                <div className={styles.stepCircle}><PenNib size={14} /></div>
                <div className={styles.stepInfo}>
                  <div className={styles.stepTitle}>Preview & Send</div>
                  <div className={styles.stepDesc}>Final review</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className={styles.main}>
          <Card className={styles.mainCard}>
            <CardHeader>
              <h3 className={styles.cardTitle}>
                {currentStep === 1 && "Select Client and Project"}
                {currentStep === 2 && "Configure Financial Offer"}
                {currentStep === 3 && "Include Marketing Assets"}
                {currentStep === 4 && "Proposal Preview"}
              </h3>
            </CardHeader>
            <CardBody className={styles.cardBodyScroll}>
              
              {/* STEP 1 */}
              {currentStep === 1 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Select Client</label>
                    <select className={styles.selectInput} value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
                      <option value="" disabled>Choose a client...</option>
                      <option value="c1">John Doe (VIP)</option>
                      <option value="c2">Sarah Ahmed</option>
                      <option value="c3">Mohammed Al Fayed</option>
                    </select>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Select Project</label>
                    <select className={styles.selectInput} value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                      <option value="" disabled>Choose a project...</option>
                      <option value="p1">Beachfront Residences (Emaar)</option>
                      <option value="p2">Downtown Heights (Emaar)</option>
                      <option value="p3">DAMAC Hills Villas</option>
                    </select>
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label>Proposal Title</label>
                    <input type="text" className={styles.textInput} defaultValue="Exclusive Investment Opportunity: Beachfront Residences" />
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {currentStep === 2 && (
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Base Price (USD)</label>
                    <input type="number" className={styles.textInput} defaultValue={2500000} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Special Discount (%)</label>
                    <input type="number" className={styles.textInput} defaultValue={0} />
                  </div>

                  <div className={styles.sectionDivider} style={{ gridColumn: 'span 2' }}>
                    <h4>Proposed Payment Plan</h4>
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
                    <p className={styles.hintText}>* You can customize the developer's default payment plan to offer better terms to VIP clients.</p>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {currentStep === 3 && (
                <div className={styles.mediaSelection}>
                  <div className={styles.formGroup}>
                    <label>Include Brochures & Documents</label>
                    <div className={styles.checkboxList}>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" defaultChecked /> Project Brochure (PDF)
                      </label>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" defaultChecked /> Floor Plans (PDF)
                      </label>
                      <label className={styles.checkboxItem}>
                        <input type="checkbox" /> ROI Calculation Sheet (Excel)
                      </label>
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ marginTop: '24px' }}>
                    <label>Select Project Photos to Include</label>
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
                        <div>Prepared for: <strong>John Doe</strong></div>
                        <div>Date: {new Date().toLocaleDateString()}</div>
                      </div>
                    </div>
                    
                    <div className={styles.proposalCover}>
                      <img src="/images/exterior.png" alt="Cover" className={styles.coverImage} />
                      <div className={styles.coverText}>
                        <h2>Exclusive Investment Opportunity</h2>
                        <h1>Beachfront Residences</h1>
                        <p>Dubai Marina</p>
                      </div>
                    </div>

                    <div className={styles.proposalBody}>
                      <div className={styles.bodySection}>
                        <h3>Financial Summary</h3>
                        <div className={styles.financialSummary}>
                          <div className={styles.finBox}>
                            <span>Total Investment</span>
                            <strong>$2,500,000</strong>
                          </div>
                          <div className={styles.finBox}>
                            <span>Expected ROI</span>
                            <strong>7.5% p.a.</strong>
                          </div>
                          <div className={styles.finBox}>
                            <span>Handover</span>
                            <strong>Q4 2027</strong>
                          </div>
                        </div>
                      </div>

                      <div className={styles.bodySection}>
                        <h3>Proposed Payment Plan</h3>
                        <table className={styles.previewTable}>
                          <thead>
                            <tr><th>Milestone</th><th>Percentage</th><th>Date</th></tr>
                          </thead>
                          <tbody>
                            <tr><td>Down Payment</td><td>20%</td><td>On Booking</td></tr>
                            <tr><td>During Construction</td><td>40%</td><td>Across 2 Years</td></tr>
                            <tr><td>On Handover</td><td>40%</td><td>Q4 2027</td></tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div className={styles.attachmentsSectionPreview}>
                        <h3>Included Attachments</h3>
                        <div className={styles.attachmentPills}>
                          <div className={styles.pill}><PenNib size={14}/> Project_Brochure.pdf</div>
                          <div className={styles.pill}><PenNib size={14}/> Floor_Plans.pdf</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.previewActions}>
                    <Button variant="outline"><DownloadSimple size={16} style={{marginRight: 6}}/> Download as PDF</Button>
                    <p className={styles.hintText}>The client will receive an email with a secure link to this digital proposal. You will be notified when they open it.</p>
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
                onClick={handleSaveAndSend}
              >
                Send Proposal to Client
              </Button>
            )}
          </div>
        </div>
      </div>
      <Modal 
        isOpen={showSuccessModal} 
        onClose={handleCloseModal}
        title="Proposal Sent Successfully"
        footer={
          <Button variant="primary" onClick={handleCloseModal}>Back to Proposals</Button>
        }
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            The proposal has been successfully generated and sent to the client.<br/>
            You can track its status in the Proposal Center.
          </p>
        </div>
      </Modal>
    </div>
  );
};
