import React from 'react';
import { MagnifyingGlass, Bell, CalendarBlank, Moon, Sun, Globe } from '@phosphor-icons/react';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import styles from './Topbar.module.css';

export const Topbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const initials =
    user?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? 'PR';

  return (
    <header className={styles.topbar}>
      <div className={styles.searchContainer}>
        <MagnifyingGlass className={styles.searchIcon} size={20} />
        <input 
          type="text" 
          placeholder="Global Search (Leads, Clients, Projects...)" 
          className={styles.searchInput}
        />
        <div className={styles.searchShortcut}>Ctrl+K</div>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionButton} title="Calendar">
          <CalendarBlank size={20} />
        </button>
        <button className={styles.actionButton} title="Notifications">
          <Bell size={20} />
          <span className={styles.notificationBadge}>3</span>
        </button>
        <div className={styles.divider}></div>
        <button className={styles.actionButton} onClick={toggleTheme} title="Toggle Theme">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <button className={styles.actionButton} title="Language">
          <Globe size={20} />
        </button>
        <div className={styles.divider}></div>
        <button className={styles.userProfile}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name ?? 'Misafir'}</span>
            <span className={styles.userRole}>{user?.role ?? ''}</span>
          </div>
        </button>
      </div>
    </header>
  );
};
