import React, { useState } from 'react';
import { Card, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { 
  User, 
  Settings as SettingsIcon, 
  Palette, 
  Plug, 
  Users, 
  Save, 
  MessageSquare, 
  Globe, 
  Building2,
  CheckCircle2,
  Plus,
  Mail,
  Calendar,
  Send
} from 'lucide-react';
import { Modal } from '../../core/components/Modal/Modal';
import { useToast } from '../../core/components/Toast/ToastProvider';
import styles from './Settings.module.css';

type Tab = 'profile' | 'preferences' | 'branding' | 'team' | 'integrations';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const toast = useToast();

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setShowSaveModal(true);
    }, 1000);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className={styles.content}>
            <div>
              <h3 className={styles.sectionTitle}>Personal Information</h3>
              <p className={styles.sectionSubtitle}>Update your personal details and contact information.</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                <div style={{ position: 'relative' }}>
                  <img 
                    src="https://ui-avatars.com/api/?name=Jane+Agent&background=60a5fa&color=fff&size=100" 
                    alt="User Avatar" 
                    style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }}
                  />
                  <div style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: 'var(--color-primary-blue)', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--bg-app)' }}>
                    <Plus size={16} />
                  </div>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--text-primary)' }}>Profile Photo</h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Recommended: Square image, max 2MB.</p>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Full Name</label>
                  <input type="text" className={styles.textInput} defaultValue="Jane Agent" />
                </div>
                <div className={styles.formGroup}>
                  <label>Job Title</label>
                  <input type="text" className={styles.textInput} defaultValue="Senior Investment Advisor" />
                </div>
                <div className={styles.formGroup}>
                  <label>Email Address</label>
                  <input type="email" className={styles.textInput} defaultValue="jane@produality.com" />
                </div>
                <div className={styles.formGroup}>
                  <label>Phone Number</label>
                  <input type="tel" className={styles.textInput} defaultValue="+971 50 123 4567" />
                </div>
              </div>
              
              <div className={styles.formGroup} style={{ marginTop: '16px' }}>
                <label>About Me</label>
                <textarea 
                  className={styles.textInput} 
                  rows={4} 
                  placeholder="Tell clients a bit about your experience, specialties, and background..."
                  defaultValue="Senior luxury property consultant with over 8 years of experience in the Dubai market, specializing in off-plan investments and waterfront properties."
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
            
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 'var(--spacing-md) 0' }} />
            
            <div>
              <h3 className={styles.sectionTitle}>Security</h3>
              <p className={styles.sectionSubtitle}>Manage your password and security settings.</p>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Current Password</label>
                  <input type="password" className={styles.textInput} placeholder="••••••••" />
                </div>
                <div className={styles.formGroup}>
                  <label>New Password</label>
                  <input type="password" className={styles.textInput} placeholder="Leave blank to keep current" />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" defaultChecked />
                  Enable Two-Factor Authentication (2FA) via Authenticator App
                </label>
              </div>
            </div>
          </div>
        );

      case 'preferences':
        return (
          <div className={styles.content}>
            <div>
              <h3 className={styles.sectionTitle}>System Preferences</h3>
              <p className={styles.sectionSubtitle}>Customize how the ProDuality OS looks and behaves for you.</p>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Interface Theme</label>
                  <select className={styles.selectInput} defaultValue="dark">
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode (Default)</option>
                    <option value="system">Sync with System</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>System Language</label>
                  <select className={styles.selectInput} defaultValue="en">
                    <option value="en">English</option>
                    <option value="tr">Turkish (Türkçe)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Timezone</label>
                  <select className={styles.selectInput} defaultValue="dubai">
                    <option value="dubai">Dubai (GST)</option>
                    <option value="turkey">Türkiye (TRT)</option>
                    <option value="uk">United Kingdom (GMT/BST)</option>
                    <option value="spain">Spain (CET/CEST)</option>
                    <option value="germany">Germany (CET/CEST)</option>
                    <option value="netherlands">Netherlands (CET/CEST)</option>
                    <option value="paris">Paris (CET/CEST)</option>
                    <option value="brussels">Brussels (CET/CEST)</option>
                  </select>
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 'var(--spacing-md) 0' }} />

            <div>
              <h3 className={styles.sectionTitle}>Notification Settings</h3>
              <p className={styles.sectionSubtitle}>Control when and how you are notified.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" defaultChecked />
                  Email me when a new lead is assigned
                </label>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" defaultChecked />
                  Push notification for upcoming meetings
                </label>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" defaultChecked />
                  Daily digest of pipeline activity
                </label>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" />
                  SMS alerts for hot leads (VIP Clients)
                </label>
              </div>
            </div>
          </div>
        );

      case 'branding':
        return (
          <div className={styles.content}>
            <div>
              <h3 className={styles.sectionTitle}>Company Branding</h3>
              <p className={styles.sectionSubtitle}>Configure your brand identity for proposals and client-facing documents.</p>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Company Name</label>
                  <input type="text" className={styles.textInput} defaultValue="ProDuality Real Estate" />
                </div>
                <div className={styles.formGroup}>
                  <label>Website URL</label>
                  <input type="text" className={styles.textInput} defaultValue="https://produality.com" />
                </div>
              </div>
              <div style={{ marginTop: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Company Logo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '8px', backgroundColor: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)' }}>
                    <Building2 size={32} color="var(--text-muted)" />
                  </div>
                  <Button variant="outline">Upload New Logo</Button>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Recommended: 400x100px PNG</span>
                </div>
              </div>
              <div style={{ marginTop: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Primary Brand Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="color" defaultValue="#60a5fa" style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>#60A5FA (Used in PDF Proposals)</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'team':
        return (
          <div className={styles.content}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 className={styles.sectionTitle}>Team & Roles</h3>
                <Button variant="primary" onClick={() => toast.info('Üye ekleme modülü yakında gelecek')}><Plus size={16} /> Add Member</Button>
              </div>
              <p className={styles.sectionSubtitle}>Manage your organization's users and their permissions.</p>
              
              <div className={styles.teamList}>
                <div className={styles.teamMember}>
                  <div className={styles.memberInfo}>
                    <div className={styles.memberAvatar}>JA</div>
                    <div>
                      <div className={styles.memberName}>Jane Agent (You)</div>
                      <div className={styles.memberRole}>jane@produality.com</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className={`${styles.badge} ${styles.badgeAdmin}`}>Admin</span>
                    <Button variant="outline">Edit</Button>
                  </div>
                </div>
                
                <div className={styles.teamMember}>
                  <div className={styles.memberInfo}>
                    <div className={styles.memberAvatar} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>MS</div>
                    <div>
                      <div className={styles.memberName}>Michael Smith</div>
                      <div className={styles.memberRole}>michael@produality.com</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className={`${styles.badge} ${styles.badgeManager}`}>Manager</span>
                    <Button variant="outline">Edit</Button>
                  </div>
                </div>

                <div className={styles.teamMember}>
                  <div className={styles.memberInfo}>
                    <div className={styles.memberAvatar} style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>ER</div>
                    <div>
                      <div className={styles.memberName}>Elena Rodriguez</div>
                      <div className={styles.memberRole}>elena@produality.com</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className={`${styles.badge} ${styles.badgeAgent}`}>Agent</span>
                    <Button variant="outline">Edit</Button>
                  </div>
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 'var(--spacing-md) 0' }} />

            <div>
              <h3 className={styles.sectionTitle}>Commission Settings</h3>
              <p className={styles.sectionSubtitle}>Set default commission rates for agents.</p>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Default Off-Plan Commission (%)</label>
                  <input type="number" className={styles.textInput} defaultValue="50" />
                </div>
                <div className={styles.formGroup}>
                  <label>Default Secondary Market Commission (%)</label>
                  <input type="number" className={styles.textInput} defaultValue="60" />
                </div>
              </div>
            </div>
          </div>
        );

      case 'integrations':
        return (
          <div className={styles.content}>
            <div>
              <h3 className={styles.sectionTitle}>Connected Apps & APIs</h3>
              <p className={styles.sectionSubtitle}>Link external services to sync leads and property data automatically.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <Globe size={24} color="var(--color-primary-blue)" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>PropertyFinder API</div>
                      <div className={styles.integrationDesc}>Automatically sync listings and receive leads from PropertyFinder.</div>
                    </div>
                  </div>
                  <Button variant="outline">Configure</Button>
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <Globe size={24} color="#10b981" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>Bayut API</div>
                      <div className={styles.integrationDesc}>Sync Dubai property inventory directly with Bayut.</div>
                    </div>
                  </div>
                  <Button variant="outline">Configure</Button>
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <MessageSquare size={24} color="#25D366" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>WhatsApp Business</div>
                      <div className={styles.integrationDesc}>Send automated messages and proposals via WhatsApp.</div>
                      <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>• Connected (Number: +971 50 *** **67)</div>
                    </div>
                  </div>
                  <Button variant="outline">Manage</Button>
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <Calendar size={24} color="#4285F4" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>Google Calendar</div>
                      <div className={styles.integrationDesc}>Sync your meetings and viewing appointments automatically.</div>
                    </div>
                  </div>
                  <Button variant="outline">Connect</Button>
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <Mail size={24} color="#EA4335" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>Gmail Integration</div>
                      <div className={styles.integrationDesc}>Send and track emails directly from the CRM.</div>
                    </div>
                  </div>
                  <Button variant="outline">Connect</Button>
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <Send size={24} color="#229ED9" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>Telegram Bot</div>
                      <div className={styles.integrationDesc}>Receive instant notifications and system alerts via Telegram.</div>
                    </div>
                  </div>
                  <Button variant="outline">Connect</Button>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your account, team, and system preferences</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <button 
            className={`${styles.navItem} ${activeTab === 'profile' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={18} /> My Profile
          </button>
          <button 
            className={`${styles.navItem} ${activeTab === 'preferences' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <SettingsIcon size={18} /> Preferences
          </button>
          <button 
            className={`${styles.navItem} ${activeTab === 'branding' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            <Palette size={18} /> Branding
          </button>
          <button 
            className={`${styles.navItem} ${activeTab === 'team' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('team')}
          >
            <Users size={18} /> Team & Roles
          </button>
          <button 
            className={`${styles.navItem} ${activeTab === 'integrations' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('integrations')}
          >
            <Plug size={18} /> Integrations
          </button>
        </div>

        <Card>
          <CardBody>
            {renderContent()}
            
            <div className={styles.saveAction}>
              <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                <Save size={16} style={{ marginRight: '8px' }} /> 
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal 
        isOpen={showSaveModal} 
        onClose={() => setShowSaveModal(false)}
        title="Settings Saved"
        footer={<Button variant="primary" onClick={() => setShowSaveModal(false)}>Close</Button>}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle2 size={48} color="var(--color-success)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Your settings have been successfully updated.<br/>
            Some preferences may require a page reload to take full effect.
          </p>
        </div>
      </Modal>
    </div>
  );
};
