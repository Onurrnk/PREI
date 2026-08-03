// =====================================================================
// PREI | Entegrasyon listesi — TEK uçtan beslenir (/api/integrations).
//
// Eskiden bu ekranda sabit "yakında" kutuları vardı: PropertyFinder, Bayut,
// WhatsApp. Tıklayınca hiçbir şey olmuyordu ve NEDEN olmadığı da yazmıyordu.
// Artık her sağlayıcı gerçek durumunu ve hazır değilse GEREKÇESİNİ söylüyor
// (Meta App Review bekliyor, LinkedIn partner onayı gerektiriyor gibi).
//
// Yeni platform eklemek için bu dosyaya dokunmaya gerek yok — backend'deki
// sağlayıcı kayıt defterine bir satır eklemek yeterli.
// =====================================================================
import { useTranslation } from 'react-i18next';
import { Plugs, CheckCircle, Clock } from '@phosphor-icons/react';
import type { IntegrationDTO } from '../../core/types';
import { integrationsApi } from '../../core/api/resources';
import { useFetch } from '../../core/hooks/useFetch';
import { Button } from '../../core/components/Button/Button';
import styles from './IntegrationList.module.css';

/** Google kendi bölümünde ayrıca gösteriliyor — burada tekrar etme. */
const HARIC = new Set(['google']);

export function IntegrationList() {
  const { t, i18n } = useTranslation();
  const { data, loading } = useFetch<IntegrationDTO[]>(
    () => integrationsApi.list(i18n.language), [i18n.language],
  );

  if (loading) return <p className={styles.muted}>{t('common.loading')}</p>;
  const liste = (data ?? []).filter((x) => !HARIC.has(x.id));
  if (liste.length === 0) return null;

  return (
    <div className={styles.list}>
      {liste.map((p) => (
        <div key={p.id} className={styles.card}>
          <div className={styles.info}>
            <div className={styles.icon} data-connected={p.connected}>
              <Plugs size={22} />
            </div>
            <div className={styles.text}>
              <div className={styles.name}>
                {p.label}
                <span className={styles.scope}>
                  {p.scope === 'user'
                    ? t('settings.integrations.scopeUser')
                    : t('settings.integrations.scopeTenant')}
                </span>
              </div>
              <div className={styles.desc}>{p.description}</div>
              {p.connected && p.accountLabel && (
                <div className={styles.connected}>
                  <CheckCircle size={13} /> {p.accountLabel}
                </div>
              )}
              {/* Hazır değilse SEBEBİ yazılır — kullanıcı boşuna uğraşmasın. */}
              {!p.available && p.blockedReason && (
                <div className={styles.blocked}>
                  <Clock size={13} /> {p.blockedReason}
                </div>
              )}
            </div>
          </div>

          {p.connected ? (
            <span className={styles.connectedTag}>{t('settings.integrations.connectedShort')}</span>
          ) : (
            <Button variant="outline" disabled={!p.available}>
              {p.available
                ? t('settings.integrations.connect')
                : t('common.comingSoon')}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
