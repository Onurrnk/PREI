import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { Button } from '../../core/components/Button/Button';
import { ShieldCheck } from '@phosphor-icons/react';
import styles from './Login.module.css';
import { useTranslation } from 'react-i18next';

interface LocationState {
  from?: { pathname: string };
}

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as LocationState)?.from?.pathname ?? '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch {
      setError(t('login.invalid'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.brand}>
          <ShieldCheck size={28} />
          <h1 className={styles.title}>PREI <span className={styles.sub}>Smart Suites</span></h1>
        </div>
        <p className={styles.subtitle}>{t('login.subtitle')}</p>

        {error && <div className={styles.error}>{error}</div>}

        <label className={styles.label}>
          {t('login.emailLabel')}
          <input
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@prei.app"
            autoComplete="username"
            required
          />
        </label>

        <label className={styles.label}>
          {t('login.passwordLabel')}
          <input
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </label>

        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? t('login.signingIn') : t('login.signIn')}
        </Button>

        {import.meta.env.VITE_USE_REAL_API !== 'true' && (
          <div className={styles.hint}>
            Demo hesapları (şifre fark etmez):<br />
            admin@prei.app · sarah@prei.app · elif@prei.app
          </div>
        )}
      </form>
    </div>
  );
};
