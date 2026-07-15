import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { User, GearSix as SettingsIcon, Palette, Plug, UsersThree, FloppyDisk, ChatCircle, Globe, Buildings, CheckCircle, Plus, EnvelopeSimple, CalendarBlank, PaperPlaneTilt } from '@phosphor-icons/react';
import { Modal } from '../../core/components/Modal/Modal';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../../core/hooks/useFetch';
import { meApi, googleAuthApi } from '../../core/api/resources';
import type { MeResponse, GoogleOAuthStatus } from '../../core/types';
import { useAuth } from '../../core/auth/AuthContext';
import { useTheme } from '../../core/theme/ThemeContext';
import { supabase } from '../../core/auth/supabaseClient';
import { ApiError } from '../../core/api/client';
import styles from './Settings.module.css';

type Tab = 'profile' | 'preferences' | 'branding' | 'team' | 'integrations';

const REAL_AUTH = import.meta.env.VITE_USE_REAL_API === 'true';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme: appliedTheme, setTheme: applyTheme } = useTheme();
  const toast = useToast();

  const { data: me } = useFetch<MeResponse>(() => meApi.get(), []);

  // Gmail entegrasyonu (Google OAuth) — Integrations sekmesi
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: gmailStatus, refetch: refetchGmailStatus } = useFetch<GoogleOAuthStatus>(() => googleAuthApi.status(), []);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false);

  // Google callback'i /settings?gmail=connected|error ile geri döner —
  // sayfa açılışında bir kere işlenir, sonra param temizlenir.
  useEffect(() => {
    const gmailParam = searchParams.get('gmail');
    if (!gmailParam) return;
    if (gmailParam === 'connected') {
      toast.success(t('settings.integrations.gmailConnected'));
      refetchGmailStatus();
    } else if (gmailParam === 'error') {
      toast.error(t('settings.integrations.gmailConnectFailed'));
    }
    setSearchParams((prev) => {
      prev.delete('gmail');
      return prev;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGmailConnect = async () => {
    setGmailConnecting(true);
    try {
      const { url } = await googleAuthApi.url();
      window.location.href = url;
    } catch (err) {
      setGmailConnecting(false);
      toast.error(err instanceof Error ? err.message : t('settings.integrations.gmailConnectFailed'));
    }
  };

  const handleGmailDisconnect = async () => {
    setGmailDisconnecting(true);
    try {
      await googleAuthApi.disconnect();
      toast.success(t('settings.integrations.gmailDisconnected'));
      refetchGmailStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.integrations.gmailConnectFailed'));
    } finally {
      setGmailDisconnecting(false);
    }
  };

  // Profil sekmesi — /api/me'den yüklenip düzenlenen alanlar
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [twoFactor, setTwoFactor] = useState(true);

  // Tercihler sekmesi
  const [prefTheme, setPrefTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const [prefLanguage, setPrefLanguage] = useState(i18n.language);
  const [prefTimezone, setPrefTimezone] = useState('dubai');
  const [notifNewLead, setNotifNewLead] = useState(true);
  const [notifTaskDue, setNotifTaskDue] = useState(true);
  const [notifWeeklyReport, setNotifWeeklyReport] = useState(true);
  const [notifSmsHotLeads, setNotifSmsHotLeads] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // /api/me yüklenince form alanlarını doldur (gerçek kayıtlı değerler).
  useEffect(() => {
    if (!me) return;
    setFullName(me.name);
    setJobTitle(me.jobTitle ?? '');
    setPhone(me.phone ?? '');
    setAboutMe(me.aboutMe ?? '');
    setPrefTheme((me.theme as 'light' | 'dark' | 'system') ?? 'dark');
    setPrefTimezone(me.timezone ?? 'dubai');
    setNotifNewLead(me.notificationPrefs.newLead ?? true);
    setNotifTaskDue(me.notificationPrefs.taskDue ?? true);
    setNotifWeeklyReport(me.notificationPrefs.weeklyReport ?? true);
    setNotifSmsHotLeads(me.notificationPrefs.smsHotLeads ?? false);
  }, [me]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (activeTab === 'profile') {
        await meApi.update({
          fullName: fullName.trim(),
          jobTitle: jobTitle.trim(),
          phone: phone.trim(),
          aboutMe: aboutMe.trim(),
        });

        if (newPassword.trim()) {
          if (!REAL_AUTH) {
            toast.info(t('settings.notImplementedTab'));
          } else if (!user?.email) {
            toast.error(t('settings.security.currentPasswordWrong'));
          } else if (!currentPassword.trim()) {
            setIsSaving(false);
            toast.error(t('settings.security.currentPasswordRequired'));
            return;
          } else {
            const { error: reauthError } = await supabase.auth.signInWithPassword({
              email: user.email,
              password: currentPassword,
            });
            if (reauthError) {
              setIsSaving(false);
              toast.error(t('settings.security.currentPasswordWrong'));
              return;
            }
            const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
            if (pwError) throw pwError;
            toast.success(t('settings.security.passwordUpdated'));
          }
          setCurrentPassword('');
          setNewPassword('');
        }
      } else if (activeTab === 'preferences') {
        await meApi.update({
          theme: prefTheme,
          locale: prefLanguage as 'en' | 'tr',
          timezone: prefTimezone,
          notificationPrefs: {
            newLead: notifNewLead,
            taskDue: notifTaskDue,
            weeklyReport: notifWeeklyReport,
            smsHotLeads: notifSmsHotLeads,
          },
        });
        const resolved: 'light' | 'dark' = prefTheme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : prefTheme;
        if (resolved !== appliedTheme) applyTheme(resolved);
      } else {
        setIsSaving(false);
        toast.info(t('settings.notImplementedTab'));
        return;
      }
      setIsSaving(false);
      setShowSaveModal(true);
    } catch (err) {
      setIsSaving(false);
      const message = err instanceof ApiError || err instanceof Error ? err.message : String(err);
      toast.error(t('settings.saveFailed', { error: message }));
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className={styles.content}>
            <div>
              <h3 className={styles.sectionTitle}>{t('settings.profile.heading')}</h3>
              <p className={styles.sectionSubtitle}>{t('settings.profile.subtitle')}</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid var(--border-color)', backgroundColor: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 600 }}>
                    OK
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: 'var(--brand-primary)', color: 'var(--on-brand)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--bg-app)' }}>
                    <Plus size={16} />
                  </div>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--text-primary)' }}>{t('settings.profile.photo')}</h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('settings.profile.photoHint')}</p>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>{t('settings.profile.fullName')}</label>
                  <input type="text" className={styles.textInput} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('settings.profile.jobTitle')}</label>
                  <input type="text" className={styles.textInput} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('settings.profile.emailAddress')}</label>
                  <input type="email" className={styles.textInput} value={me?.email ?? ''} disabled title={t('settings.profile.emailLocked')} />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('common.phone')}</label>
                  <input type="tel" className={styles.textInput} value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>

              <div className={styles.formGroup} style={{ marginTop: '16px' }}>
                <label>{t('settings.profile.aboutMe')}</label>
                <textarea
                  className={styles.textInput}
                  rows={4}
                  placeholder={t('settings.profile.aboutMePlaceholder')}
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 'var(--spacing-md) 0' }} />

            <div>
              <h3 className={styles.sectionTitle}>{t('settings.security.heading')}</h3>
              <p className={styles.sectionSubtitle}>{t('settings.security.subtitle')}</p>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>{t('settings.security.currentPassword')}</label>
                  <input type="password" className={styles.textInput} placeholder="••••••••" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('settings.security.newPassword')}</label>
                  <input type="password" className={styles.textInput} placeholder={t('settings.security.newPasswordPlaceholder')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={twoFactor} onChange={(e) => setTwoFactor(e.target.checked)} />
                  {t('settings.security.twoFactor')}
                </label>
              </div>
            </div>
          </div>
        );

      case 'preferences':
        return (
          <div className={styles.content}>
            <div>
              <h3 className={styles.sectionTitle}>{t('settings.prefs.heading')}</h3>
              <p className={styles.sectionSubtitle}>{t('settings.prefs.subtitle')}</p>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>{t('settings.prefs.theme')}</label>
                  <SelectMenu
                    aria-label={t('settings.prefs.theme')}
                    value={prefTheme}
                    onChange={(v) => setPrefTheme(v as 'light' | 'dark' | 'system')}
                    options={[
                      { value: 'light', label: t('settings.prefs.themeLight') },
                      { value: 'dark', label: t('settings.prefs.themeDark') },
                      { value: 'system', label: t('settings.prefs.themeSystem') },
                    ]}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('settings.prefs.language')}</label>
                  <SelectMenu
                    aria-label={t('settings.prefs.language')}
                    value={prefLanguage}
                    onChange={(v) => {
                      setPrefLanguage(v);
                      void i18n.changeLanguage(v); // kalıcı: config.ts languageChanged -> localStorage
                    }}
                    options={[
                      { value: 'en', label: t('settings.prefs.langEn') },
                      { value: 'tr', label: t('settings.prefs.langTr') },
                    ]}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('settings.prefs.timezone')}</label>
                  <SelectMenu
                    aria-label={t('settings.prefs.timezone')}
                    value={prefTimezone}
                    onChange={setPrefTimezone}
                    options={[
                      { value: 'dubai', label: 'Dubai (GST)' },
                      { value: 'turkey', label: 'Türkiye (TRT)' },
                      { value: 'uk', label: 'United Kingdom (GMT/BST)' },
                      { value: 'spain', label: 'Spain (CET/CEST)' },
                      { value: 'germany', label: 'Germany (CET/CEST)' },
                      { value: 'netherlands', label: 'Netherlands (CET/CEST)' },
                      { value: 'paris', label: 'Paris (CET/CEST)' },
                      { value: 'brussels', label: 'Brussels (CET/CEST)' },
                    ]}
                  />
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 'var(--spacing-md) 0' }} />

            <div>
              <h3 className={styles.sectionTitle}>{t('settings.notif.heading')}</h3>
              <p className={styles.sectionSubtitle}>{t('settings.notif.subtitle')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={notifNewLead} onChange={(e) => setNotifNewLead(e.target.checked)} />
                  {t('settings.notif.newLead')}
                </label>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={notifTaskDue} onChange={(e) => setNotifTaskDue(e.target.checked)} />
                  {t('settings.notif.taskDue')}
                </label>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={notifWeeklyReport} onChange={(e) => setNotifWeeklyReport(e.target.checked)} />
                  {t('settings.notif.weeklyReport')}
                </label>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={notifSmsHotLeads} onChange={(e) => setNotifSmsHotLeads(e.target.checked)} />
                  {t('settings.notif.smsHotLeads')}
                </label>
              </div>
            </div>
          </div>
        );

      case 'branding':
        return (
          <div className={styles.content}>
            <div>
              <h3 className={styles.sectionTitle}>{t('settings.branding.heading')}</h3>
              <p className={styles.sectionSubtitle}>{t('settings.branding.subtitle')}</p>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>{t('settings.branding.companyName')}</label>
                  <input type="text" className={styles.textInput} defaultValue="ProDuality Real Estate" />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('settings.branding.websiteUrl')}</label>
                  <input type="text" className={styles.textInput} defaultValue="https://produality.com" />
                </div>
              </div>
              <div style={{ marginTop: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{t('settings.branding.logo')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '8px', backgroundColor: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)' }}>
                    <Buildings size={32} color="var(--text-muted)" />
                  </div>
                  <Button variant="outline">{t('settings.branding.uploadLogo')}</Button>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('settings.branding.logoHint')}</span>
                </div>
              </div>
              <div style={{ marginTop: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{t('settings.branding.primaryColor')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="color" defaultValue="#9B5BB3" style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: 'var(--radius-control)', cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>#9B5BB3 ({t('settings.branding.colorHint')})</span>
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
                <h3 className={styles.sectionTitle}>{t('settings.team.heading')}</h3>
                <Button variant="primary" onClick={() => toast.info(t('settings.team.addMemberSoon'))}><Plus size={16} /> {t('settings.team.addMember')}</Button>
              </div>
              <p className={styles.sectionSubtitle}>{t('settings.team.subtitle')}</p>

              <div className={styles.teamList}>
                <div className={styles.teamMember}>
                  <div className={styles.memberInfo}>
                    <div className={styles.memberAvatar}>OK</div>
                    <div>
                      <div className={styles.memberName}>{t('settings.team.you', { name: 'Onur Nazım Karataş' })}</div>
                      <div className={styles.memberRole}>onur@produality.com</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className={`${styles.badge} ${styles.badgeAdmin}`}>{t('settings.team.roleAdmin')}</span>
                    <Button variant="outline">{t('common.edit')}</Button>
                  </div>
                </div>

                <div className={styles.teamMember}>
                  <div className={styles.memberInfo}>
                    <div className={styles.memberAvatar} style={{ backgroundColor: 'color-mix(in srgb, var(--data-positive) 12%, transparent)', color: 'var(--data-positive)' }}>MA</div>
                    <div>
                      <div className={styles.memberName}>Mert Aydınlar</div>
                      <div className={styles.memberRole}>mert@produality.com</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className={`${styles.badge} ${styles.badgeManager}`}>{t('settings.team.roleManager')}</span>
                    <Button variant="outline">{t('common.edit')}</Button>
                  </div>
                </div>

                <div className={styles.teamMember}>
                  <div className={styles.memberInfo}>
                    <div className={styles.memberAvatar} style={{ backgroundColor: 'color-mix(in srgb, var(--data-warning) 12%, transparent)', color: 'var(--data-warning)' }}>ER</div>
                    <div>
                      <div className={styles.memberName}>Elena Rodriguez</div>
                      <div className={styles.memberRole}>elena@produality.com</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className={`${styles.badge} ${styles.badgeAgent}`}>{t('settings.team.roleAgent')}</span>
                    <Button variant="outline">{t('common.edit')}</Button>
                  </div>
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 'var(--spacing-md) 0' }} />

            <div>
              <h3 className={styles.sectionTitle}>{t('settings.team.commissionHeading')}</h3>
              <p className={styles.sectionSubtitle}>{t('settings.team.commissionSubtitle')}</p>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>{t('settings.team.offPlanCommission')}</label>
                  <input type="number" className={styles.textInput} defaultValue="50" />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('settings.team.secondaryCommission')}</label>
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
              <h3 className={styles.sectionTitle}>{t('settings.integrations.heading')}</h3>
              <p className={styles.sectionSubtitle}>{t('settings.integrations.subtitle')}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <Globe size={24} color="var(--data-info)" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>PropertyFinder API</div>
                      <div className={styles.integrationDesc}>{t('settings.integrations.propertyFinderDesc')}</div>
                    </div>
                  </div>
                  <Button variant="outline">{t('settings.integrations.configure')}</Button>
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <Globe size={24} color="var(--data-positive)" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>Bayut API</div>
                      <div className={styles.integrationDesc}>{t('settings.integrations.bayutDesc')}</div>
                    </div>
                  </div>
                  <Button variant="outline">{t('settings.integrations.configure')}</Button>
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <ChatCircle size={24} color="#25D366" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>WhatsApp Business</div>
                      <div className={styles.integrationDesc}>{t('settings.integrations.whatsappDesc')}</div>
                      <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--data-positive)', fontWeight: 500 }}>{t('settings.integrations.connectedNumber', { number: '+971 50 *** **67' })}</div>
                    </div>
                  </div>
                  <Button variant="outline">{t('settings.integrations.manage')}</Button>
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <CalendarBlank size={24} color="#4285F4" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>Google Calendar</div>
                      <div className={styles.integrationDesc}>{t('settings.integrations.gcalDesc')}</div>
                    </div>
                  </div>
                  <Button variant="outline">{t('settings.integrations.connect')}</Button>
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <EnvelopeSimple size={24} color="#EA4335" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>Gmail Integration</div>
                      <div className={styles.integrationDesc}>{t('settings.integrations.gmailDesc')}</div>
                      {gmailStatus?.connected && (
                        <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--data-positive)', fontWeight: 500 }}>
                          {t('settings.integrations.connectedAs', { email: gmailStatus.email })}
                        </div>
                      )}
                    </div>
                  </div>
                  {gmailStatus?.connected ? (
                    <Button variant="outline" onClick={() => void handleGmailDisconnect()} disabled={gmailDisconnecting}>
                      {t('settings.integrations.disconnect')}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => void handleGmailConnect()} disabled={gmailConnecting}>
                      {gmailConnecting ? t('settings.integrations.connecting') : t('settings.integrations.connect')}
                    </Button>
                  )}
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <PaperPlaneTilt size={24} color="#229ED9" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>Telegram Bot</div>
                      <div className={styles.integrationDesc}>{t('settings.integrations.telegramDesc')}</div>
                    </div>
                  </div>
                  <Button variant="outline">{t('settings.integrations.connect')}</Button>
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
        <h1 className={styles.title}>{t('settings.title')}</h1>
        <p className={styles.subtitle}>{t('settings.subtitle')}</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <button
            className={`${styles.navItem} ${activeTab === 'profile' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={18} /> {t('settings.tabs.profile')}
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'preferences' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <SettingsIcon size={18} /> {t('settings.tabs.preferences')}
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'branding' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            <Palette size={18} /> {t('settings.tabs.branding')}
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'team' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('team')}
          >
            <UsersThree size={18} /> {t('settings.tabs.team')}
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'integrations' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('integrations')}
          >
            <Plug size={18} /> {t('settings.tabs.integrations')}
          </button>
        </div>

        <Card>
          <CardBody>
            {renderContent()}

            <div className={styles.saveAction}>
              <Button variant="primary" onClick={() => void handleSave()} disabled={isSaving}>
                <FloppyDisk size={16} style={{ marginRight: '8px' }} />
                {isSaving ? t('settings.savingChanges') : t('common.saveChanges')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title={t('settings.savedTitle')}
        footer={<Button variant="primary" onClick={() => setShowSaveModal(false)}>{t('common.close')}</Button>}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t('settings.savedBody1')}<br/>
            {t('settings.savedBody2')}
          </p>
        </div>
      </Modal>
    </div>
  );
};
