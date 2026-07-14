import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarBlank, Moon, Sun, Globe, List } from '@phosphor-icons/react';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import { NotificationCenter } from '../Notifications/NotificationCenter';
import { GlobalSearch } from '../Search/GlobalSearch';
import styles from './Topbar.module.css';

interface TopbarProps {
  /** ≤900px'te görünen hamburger; sidebar çekmecesini açar */
  onMenuClick?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick }) => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  // Hızlı dil değiştirici — Settings > Preferences ile aynı mekanizma.
  const toggleLanguage = () => void i18n.changeLanguage(i18n.language === 'tr' ? 'en' : 'tr');
  const initials =
    user?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? 'PR';

  return (
    <header className={styles.topbar}>
      <button className={styles.menuButton} onClick={onMenuClick} aria-label={t('topbar.openMenu')}>
        <List size={22} />
      </button>
      <GlobalSearch />

      <div className={styles.actions}>
        <button className={styles.actionButton} title={t('nav.meetings')} onClick={() => navigate('/meetings')}>
          <CalendarBlank size={20} />
        </button>
        <NotificationCenter />
        <div className={styles.divider}></div>
        <button className={styles.actionButton} onClick={toggleTheme} title={t('topbar.toggleTheme')}>
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <button className={styles.actionButton} title={i18n.language === 'tr' ? 'English' : 'Türkçe'} onClick={toggleLanguage}>
          <Globe size={20} />
        </button>
        <div className={styles.divider}></div>
        <button className={styles.userProfile}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name ?? t('topbar.guest')}</span>
            <span className={styles.userRole}>{user?.role ?? ''}</span>
          </div>
        </button>
      </div>
    </header>
  );
};
