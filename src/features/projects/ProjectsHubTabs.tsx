// =====================================================================
// PREI | ProjectsHubTabs — "Proje Zekâsı" çatısı altındaki alt sekmeler.
// Sidebar'da tek kalem (Proje Zekâsı); Projeler / Geliştiriciler / Proje
// Girişi bu sekmelerle gezilir (Onur: "yan menü karışmasın, kendi içinde
// ayrılsın"). Rotalar değişmedi — derin linkler aynen çalışır.
// Proje Girişi sekmesinde bekleyen gönderi rozeti gösterilir.
// =====================================================================
import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Briefcase, Buildings, Tray } from '@phosphor-icons/react';
import { AuthContext } from '../../core/auth/AuthContext';
import { can } from '../../core/auth/permissions';
import { useFetch } from '../../core/hooks/useFetch';
import { intakeApi } from '../../core/api/resources';
import styles from './ProjectsHubTabs.module.css';

export const ProjectsHubTabs: React.FC = () => {
  const { t } = useTranslation();
  // useAuth yerine doğrudan context: provider yoksa (izole test render'ı)
  // throw etmez; rol bilinmiyorsa yalnız Projeler sekmesi görünür.
  const auth = useContext(AuthContext);
  const role = auth?.user?.role;
  const showDevelopers = can(role, 'developers');
  const showIntake = can(role, 'projects');
  const { data: pending } = useFetch<{ count: number }>(() => intakeApi.queueCount(), []);

  return (
    <nav className={styles.tabs} aria-label={t('nav.projects')}>
      <NavLink to="/projects" end className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}>
        <Briefcase size={16} /> {t('projectsHub.projects')}
      </NavLink>
      {showDevelopers && (
        <NavLink to="/developers" className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}>
          <Buildings size={16} /> {t('projectsHub.developers')}
        </NavLink>
      )}
      {showIntake && (
        <NavLink to="/projects/intake" className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}>
          <Tray size={16} /> {t('projectsHub.intake')}
          {(pending?.count ?? 0) > 0 && <span className={styles.badge}>{pending!.count}</span>}
        </NavLink>
      )}
    </nav>
  );
};
