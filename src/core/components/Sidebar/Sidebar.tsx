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
  GearSix,
  SignOut,
} from '@phosphor-icons/react';
import styles from './Sidebar.module.css';
import { useAuth } from '../../auth/AuthContext';
import { can, type Permission } from '../../auth/permissions';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  permission: Permission;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: SquaresFour, permission: 'dashboard' },
  { path: '/leads', label: 'Leads', icon: Funnel, permission: 'leads' },
  { path: '/clients', label: 'Clients', icon: UsersThree, permission: 'clients' },
  { path: '/developers', label: 'Developers', icon: Buildings, permission: 'developers' },
  { path: '/projects', label: 'Projects Intelligence', icon: Briefcase, permission: 'projects' },
  { path: '/proposals', label: 'Proposal Center', icon: PenNib, permission: 'proposals' },
  { path: '/documents', label: 'Document Vault', icon: Vault, permission: 'documents' },
  { path: '/meetings', label: 'Meetings', icon: CalendarBlank, permission: 'meetings' },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare, permission: 'tasks' },
  { path: '/contracts', label: 'Contracts', icon: FileText, permission: 'contracts' },
  { path: '/financials', label: 'Financials', icon: ChartLineUp, permission: 'financials' },
  { path: '/admin', label: 'Admin & Audit', icon: ShieldCheck, permission: 'admin' },
  { path: '/settings', label: 'Settings', icon: GearSix, permission: 'settings' },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // RBAC: only show modules the current role is permitted to see.
  const visibleItems = navItems.filter((item) => can(user?.role, item.permission));

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className={styles.sidebar}>
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
                  className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                >
                  <Icon className={styles.icon} size={20} />
                  <span className={styles.label}>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={styles.footer}>
        {user && (
          <button className={styles.logoutBtn} onClick={handleLogout} title="Çıkış Yap">
            <SignOut size={18} />
            <span>Çıkış Yap</span>
          </button>
        )}
        <div className={styles.poweredBy}>Powered by ProDuality</div>
      </div>
    </aside>
  );
};
