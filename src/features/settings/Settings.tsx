import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardBody } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { User, GearSix as SettingsIcon, Palette, Plug, UsersThree, FloppyDisk, ChatCircle, Globe, Buildings, CheckCircle, Plus, EnvelopeSimple, CalendarBlank, PaperPlaneTilt } from '@phosphor-icons/react';
import { Modal } from '../../core/components/Modal/Modal';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../../core/hooks/useFetch';
import { meApi, googleAuthApi, adminApi } from '../../core/api/resources';
import type { MeResponse, GoogleOAuthStatus, BrandingSettingsDTO, TeamMemberDTO, RoleOptionDTO } from '../../core/types';
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
  const { data: branding, refetch: refetchBranding } = useFetch<BrandingSettingsDTO>(() => adminApi.branding(), []);
  const { data: team, loading: teamLoading, refetch: refetchTeam } = useFetch<TeamMemberDTO[]>(() => adminApi.team(), []);
  const { data: roleOptions } = useFetch<RoleOptionDTO[]>(() => adminApi.roles(), []);
  const [editingMember, setEditingMember] = useState<TeamMemberDTO | null>(null);
  const [editRoleKey, setEditRoleKey] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingMember, setSavingMember] = useState(false);

  const openEditMember = (member: TeamMemberDTO) => {
    setEditingMember(member);
    setEditRoleKey(member.role);
    setEditIsActive(member.isActive);
  };

  const handleSaveMember = async () => {
    if (!editingMember) return;
    setSavingMember(true);
    try {
      await adminApi.updateTeamMember(editingMember.id, { roleKey: editRoleKey, isActive: editIsActive });
      toast.success(t('settings.team.memberUpdated'));
      refetchTeam();
      setEditingMember(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.team.memberUpdateFailed'));
    } finally {
      setSavingMember(false);
    }
  };

  // Yeni üye ekleme (super_admin) — geçici şifreyle Supabase Auth hesabı oluşturur.
  const [addingMember, setAddingMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('consultant');
  const [newPhone, setNewPhone] = useState('');
  const [creatingMember, setCreatingMember] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const openAddMember = () => {
    setNewName('');
    setNewEmail('');
    setNewRoleKey(roleOptions?.[0]?.key ?? 'consultant');
    setNewPhone('');
    setCreatedCredentials(null);
    setAddingMember(true);
  };

  const handleCreateMember = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error(t('settings.team.addMissingFields'));
      return;
    }
    setCreatingMember(true);
    try {
      const res = await adminApi.createTeamMember({
        fullName: newName.trim(),
        email: newEmail.trim(),
        roleKey: newRoleKey,
        phone: newPhone.trim() || undefined,
      });
      refetchTeam();
      // Modal, geçici şifreyi tek seferlik gösterecek ekrana geçer.
      setCreatedCredentials({ email: newEmail.trim(), password: res.tempPassword });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.team.addFailed'));
    } finally {
      setCreatingMember(false);
    }
  };

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

  // Branding sekmesi — /api/admin/branding'den yüklenip düzenlenen alanlar
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#9B5BB3');
  const [offPlanCommission, setOffPlanCommission] = useState('50');
  const [secondaryCommission, setSecondaryCommission] = useState('60');

  // /api/me yüklenince form alanlarını doldur (gerçek kayıtlı değerler).
  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sunucudan gelen veriyle düzenlenebilir form state'ini bir kez dolduruyor
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

  // /api/admin/branding yüklenince form alanlarını doldur.
  useEffect(() => {
    if (!branding) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sunucudan gelen veriyle düzenlenebilir form state'ini bir kez dolduruyor
    setCompanyName(branding.companyName);
    setWebsiteUrl(branding.websiteUrl);
    setPrimaryColor(branding.primaryColor);
    setOffPlanCommission(String(branding.offPlanCommissionPct));
    setSecondaryCommission(String(branding.secondaryCommissionPct));
  }, [branding]);

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      await adminApi.uploadLogo(file);
      refetchBranding();
      toast.success(t('settings.branding.logoUploaded'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.branding.logoUploadFailed'));
    } finally {
      setLogoUploading(false);
    }
  };

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
      } else if (activeTab === 'branding') {
        await adminApi.updateBranding({
          companyName: companyName.trim(),
          websiteUrl: websiteUrl.trim(),
          primaryColor,
        });
        refetchBranding();
      } else if (activeTab === 'team') {
        await adminApi.updateBranding({
          offPlanCommissionPct: Number(offPlanCommission) || 0,
          secondaryCommissionPct: Number(secondaryCommission) || 0,
        });
        refetchBranding();
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
                  <input type="text" className={styles.textInput} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('settings.branding.websiteUrl')}</label>
                  <input type="text" className={styles.textInput} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{t('settings.branding.logo')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '160px', height: '80px', borderRadius: '8px', backgroundColor: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', overflow: 'hidden' }}>
                    {branding?.logoUrl ? (
                      <img src={branding.logoUrl} alt={t('settings.branding.logo')} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <Buildings size={32} color="var(--text-muted)" />
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    style={{ display: 'none' }}
                    onChange={(e) => { void handleLogoUpload(e.target.files?.[0] ?? null); e.target.value = ''; }}
                  />
                  <Button variant="outline" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                    {logoUploading ? t('common.saving') : t('settings.branding.uploadLogo')}
                  </Button>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('settings.branding.logoHint')}</span>
                </div>
              </div>
              <div style={{ marginTop: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{t('settings.branding.primaryColor')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: 'var(--radius-control)', cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{primaryColor} ({t('settings.branding.colorHint')})</span>
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
                <Button variant="primary" onClick={openAddMember}><Plus size={16} /> {t('settings.team.addMember')}</Button>
              </div>
              <p className={styles.sectionSubtitle}>{t('settings.team.subtitle')}</p>

              <div className={styles.teamList}>
                {teamLoading && <div style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</div>}
                {!teamLoading && (team ?? []).map((member) => {
                  const initials = member.name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                  const isAdmin = member.role === 'super_admin';
                  const isManager = member.role === 'manager';
                  const badgeClass = isAdmin ? styles.badgeAdmin : isManager ? styles.badgeManager : styles.badgeAgent;
                  const roleLabel = roleOptions?.find((r) => r.key === member.role)?.name
                    ?? (isAdmin ? t('settings.team.roleAdmin') : isManager ? t('settings.team.roleManager') : t('settings.team.roleAgent'));
                  return (
                    <div className={styles.teamMember} key={member.id}>
                      <div className={styles.memberInfo}>
                        <div className={styles.memberAvatar}>{initials}</div>
                        <div>
                          <div className={styles.memberName}>
                            {member.id === user?.id ? t('settings.team.you', { name: member.name }) : member.name}
                            {!member.isActive && <span className={styles.badge} style={{ marginLeft: '8px' }}>{t('settings.team.inactive')}</span>}
                          </div>
                          <div className={styles.memberRole}>{t('settings.team.clientsRegistered', { count: member.clientsRegistered })}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span className={`${styles.badge} ${badgeClass}`}>{roleLabel}</span>
                        <Button variant="outline" onClick={() => openEditMember(member)}>{t('common.edit')}</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 'var(--spacing-md) 0' }} />

            <div>
              <h3 className={styles.sectionTitle}>{t('settings.team.commissionHeading')}</h3>
              <p className={styles.sectionSubtitle}>{t('settings.team.commissionSubtitle')}</p>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>{t('settings.team.offPlanCommission')}</label>
                  <input type="number" className={styles.textInput} value={offPlanCommission} onChange={(e) => setOffPlanCommission(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('settings.team.secondaryCommission')}</label>
                  <input type="number" className={styles.textInput} value={secondaryCommission} onChange={(e) => setSecondaryCommission(e.target.value)} />
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
                  <Button variant="outline" onClick={() => toast.info(t('settings.integrations.comingSoon'))}>{t('settings.integrations.configure')}</Button>
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
                  <Button variant="outline" onClick={() => toast.info(t('settings.integrations.comingSoon'))}>{t('settings.integrations.configure')}</Button>
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <ChatCircle size={24} color="#25D366" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>WhatsApp Business</div>
                      <div className={styles.integrationDesc}>{t('settings.integrations.whatsappDesc')}</div>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => toast.info(t('settings.integrations.comingSoon'))}>{t('settings.integrations.manage')}</Button>
                </div>

                <div className={styles.integrationCard}>
                  <div className={styles.integrationInfo}>
                    <div className={styles.integrationIcon}>
                      <CalendarBlank size={24} color="#4285F4" />
                    </div>
                    <div>
                      <div className={styles.integrationName}>Google Calendar</div>
                      <div className={styles.integrationDesc}>{t('settings.integrations.gcalDesc')}</div>
                      {gmailStatus?.connected && (
                        <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--data-positive)', fontWeight: 500 }}>
                          {t('settings.integrations.gcalConnectedVia', { email: gmailStatus.email })}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Takvim, Gmail ile AYNI Google OAuth token'ından gelir — ayrı
                      bağlantı yok. Buton aynı akışı tetikler (takvim kapsamı dahil). */}
                  {gmailStatus?.connected ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--data-positive)', fontWeight: 600 }}>
                      {t('settings.integrations.connectedShort')}
                    </span>
                  ) : (
                    <Button variant="outline" onClick={() => void handleGmailConnect()} disabled={gmailConnecting}>
                      {gmailConnecting ? t('settings.integrations.connecting') : t('settings.integrations.connect')}
                    </Button>
                  )}
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
                  <Button variant="outline" onClick={() => toast.info(t('settings.integrations.comingSoon'))}>{t('settings.integrations.connect')}</Button>
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

      <Modal
        isOpen={editingMember !== null}
        onClose={() => setEditingMember(null)}
        title={editingMember ? t('settings.team.editMemberTitle', { name: editingMember.name }) : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingMember(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSaveMember} disabled={savingMember}>
              {savingMember ? t('common.saving') : t('common.saveChanges')}
            </Button>
          </>
        }
      >
        {editingMember && (
          <div className={styles.formGrid}>
            <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
              <label>{t('settings.team.roleLabel')}</label>
              <SelectMenu
                aria-label={t('settings.team.roleLabel')}
                value={editRoleKey}
                onChange={(v) => setEditRoleKey(v)}
                options={(roleOptions ?? []).map((r) => ({ value: r.key, label: r.name }))}
                disabled={editingMember.id === user?.id}
              />
            </div>
            <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={editIsActive}
                  disabled={editingMember.id === user?.id}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                />
                {t('settings.team.activeLabel')}
              </label>
            </div>
            {editingMember.id === user?.id && (
              <p style={{ gridColumn: 'span 2', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {t('settings.team.cannotEditSelf')}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={addingMember}
        onClose={() => setAddingMember(false)}
        title={createdCredentials ? t('settings.team.addedTitle') : t('settings.team.addTitle')}
        footer={
          createdCredentials ? (
            <Button variant="primary" onClick={() => setAddingMember(false)}>{t('common.close')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setAddingMember(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" onClick={handleCreateMember} disabled={creatingMember}>
                {creatingMember ? t('common.saving') : t('settings.team.createMember')}
              </Button>
            </>
          )
        }
      >
        {createdCredentials ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('settings.team.credentialsIntro')}</p>
            <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{t('settings.team.emailLabel')}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{createdCredentials.email}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{t('settings.team.tempPasswordLabel')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{createdCredentials.password}</code>
                  <Button variant="outline" onClick={() => { void navigator.clipboard?.writeText(createdCredentials.password); toast.success(t('settings.team.copied')); }}>
                    {t('settings.team.copy')}
                  </Button>
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--data-warning, var(--text-muted))', lineHeight: 1.5 }}>{t('settings.team.credentialsWarning')}</p>
          </div>
        ) : (
          <div className={styles.formGrid}>
            <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
              <label>{t('settings.team.nameLabel')}</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('settings.team.namePlaceholder')} />
            </div>
            <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
              <label>{t('settings.team.emailLabel')}</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="isim@produality.com" />
            </div>
            <div className={styles.formGroup}>
              <label>{t('settings.team.roleLabel')}</label>
              <SelectMenu
                aria-label={t('settings.team.roleLabel')}
                value={newRoleKey}
                onChange={(v) => setNewRoleKey(v)}
                options={(roleOptions ?? []).map((r) => ({ value: r.key, label: r.name }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label>{t('settings.team.phoneLabel')}</label>
              <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
