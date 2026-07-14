import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  SquaresFour,
  Funnel,
  UsersThree,
  Buildings,
  Briefcase,
  PenNib,
  ShieldCheck,
  Vault,
  CalendarBlank,
  CheckSquare,
  FileText,
  ChartLineUp,
  Megaphone,
  GearSix,
  SignOut,
} from '@phosphor-icons/react';
import styles from './Sidebar.module.css';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { can, type Permission } from '../../auth/permissions';

interface NavItem {
  path: string;
  labelKey: string; // i18n anahtarı (nav.*)
  icon: React.ComponentType<{ size?: number; className?: string }>;
  permission: Permission;
}

const navItems: NavItem[] = [
  { path: '/', labelKey: 'nav.dashboard', icon: SquaresFour, permission: 'dashboard' },
  { path: '/leads', labelKey: 'nav.leads', icon: Funnel, permission: 'leads' },
  { path: '/clients', labelKey: 'nav.clients', icon: UsersThree, permission: 'clients' },
  { path: '/developers', labelKey: 'nav.developers', icon: Buildings, permission: 'developers' },
  { path: '/projects', labelKey: 'nav.projects', icon: Briefcase, permission: 'projects' },
  { path: '/proposals', labelKey: 'nav.proposals', icon: PenNib, permission: 'proposals' },
  { path: '/documents', labelKey: 'nav.documents', icon: Vault, permission: 'documents' },
  { path: '/meetings', labelKey: 'nav.meetings', icon: CalendarBlank, permission: 'meetings' },
  { path: '/tasks', labelKey: 'nav.tasks', icon: CheckSquare, permission: 'tasks' },
  { path: '/contracts', labelKey: 'nav.contracts', icon: FileText, permission: 'contracts' },
  { path: '/financials', labelKey: 'nav.financials', icon: ChartLineUp, permission: 'financials' },
  { path: '/marketing', labelKey: 'nav.marketing', icon: Megaphone, permission: 'marketing' },
  { path: '/admin', labelKey: 'nav.admin', icon: ShieldCheck, permission: 'admin' },
  { path: '/settings', labelKey: 'nav.settings', icon: GearSix, permission: 'settings' },
];

interface SidebarProps {
  /** ≤900px çekmece durumu; desktop'ta etkisiz (CSS her zaman görünür tutar) */
  open?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open = false, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // RBAC: only show modules the current role is permitted to see.
  const visibleItems = navItems.filter((item) => can(user?.role, item.permission));

  const handleLogout = () => {
    onClose?.();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
    {open && <div className={styles.overlay} onClick={onClose} aria-hidden="true" />}
    <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
      <div className={styles.logoContainer}>
        <h2 className={styles.logoText}>PREI <span className={styles.logoSub}>Smart Suites</span></h2>
      </div>
      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path} className={styles.navItem}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onClose}
                  className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                >
                  <Icon className={styles.icon} size={20} />
                  <span className={styles.label}>{t(item.labelKey)}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={styles.footer}>
        {user && (
          <button className={styles.logoutBtn} onClick={handleLogout} title={t('nav.logout')}>
            <SignOut size={18} />
            <span>{t('nav.logout')}</span>
          </button>
        )}
        <div className={styles.poweredBy}>Powered by ProDuality</div>
      </div>
    </aside>
    </>
  );
};
