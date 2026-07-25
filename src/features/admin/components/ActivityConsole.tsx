// =====================================================================
// PREI | ActivityConsole — süper admin denetim konsolu.
//
// "Kullanıcılardan birisi ne işlem yapıyorsa görebilmeliyiz" sorusunun
// cevabı: her satır KİM, NE ZAMAN, HANGİ KAYDA, NE yaptığını söyler;
// satıra tıklayınca ne değiştiği açılır, kaydın kendisine gidilir.
//
// İki kaynak birleşik: kullanıcı eylemleri (audit_log) ve sistem/Eylül
// olayları (events). Kaynak filtresiyle ayrılabilir.
// =====================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../core/components/Card/Card';
import { Button } from '../../../core/components/Button/Button';
import { auditConsoleApi } from '../../../core/api/resources';
import type { ActivityRowDTO, AuditActorDTO } from '../../../core/types';
import styles from './ActivityConsole.module.css';

const PAGE = 40;

const ENTITY_LABEL: Record<string, string> = {
  contact: 'Müşteri', client: 'Müşteri', lead: 'Müşteri adayı', deal: 'Anlaşma',
  project: 'Proje', property: 'Proje', developer: 'Geliştirici', proposal: 'Teklif',
  task: 'Görev', meeting: 'Toplantı', document: 'Belge', user: 'Kullanıcı',
  tenant: 'Ayarlar', project_submission: 'Proje başvurusu',
  project_invite: 'Proje daveti', marketing: 'Pazarlama',
};

/** Alan adlarını okunabilir Türkçeye çevirir; bilinmeyeni olduğu gibi bırakır. */
const FIELD_LABEL: Record<string, string> = {
  status: 'Durum', score: 'Skor', notes: 'Notlar', priority: 'Öncelik',
  first_name: 'Ad', last_name: 'Soyad', email: 'E-posta', phone: 'Telefon',
  budget_min: 'Bütçe (alt)', budget_max: 'Bütçe (üst)', currency: 'Para birimi',
  owner_id: 'Sorumlu', title: 'Başlık', amount: 'Tutar',
  target_market_code: 'Hedef pazar', pref_city: 'Tercih edilen şehir',
  investment_purpose: 'Yatırım amacı', lost_reason: 'Kayıp nedeni',
  marketing_consent: 'Pazarlama izni', is_active: 'Aktif',
};

function relTime(iso: string, locale: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diff < 60) return rtf.format(-Math.round(diff), 'second');
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 2592000) return rtf.format(-Math.round(diff / 86400), 'day');
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Props {
  /** Dışarıdan seçilen kullanıcı (üstteki ekip listesiyle bağ). */
  actorId?: string | null;
}

export function ActivityConsole({ actorId }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';

  const [rows, setRows] = useState<ActivityRowDTO[]>([]);
  const [actors, setActors] = useState<AuditActorDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filtreler
  const [actorFilter, setActorFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'' | 'human' | 'system'>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  // Üstten kullanıcı seçilince filtre otomatik ona geçer.
  useEffect(() => {
    if (actorId) { setActorFilter(actorId); setOffset(0); }
  }, [actorId]);

  const load = useCallback(async (append: boolean) => {
    setLoading(true);
    try {
      const res = await auditConsoleApi.activity({
        actorId: actorFilter || undefined,
        source: sourceFilter || undefined,
        entityType: entityFilter || undefined,
        search: search.trim() || undefined,
        limit: PAGE,
        offset: append ? offset : 0,
      });
      setRows((prev) => (append ? [...prev, ...res.rows] : res.rows));
      setTotal(res.total);
      setHasMore(res.hasMore);
      if (!append) setOffset(0);
    } catch {
      if (!append) setRows([]);
    } finally {
      setLoading(false);
    }
  }, [actorFilter, sourceFilter, entityFilter, search, offset]);

  useEffect(() => { void load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [actorFilter, sourceFilter, entityFilter]);

  useEffect(() => { void auditConsoleApi.actors().then(setActors).catch(() => setActors([])); }, []);

  const entityTypes = useMemo(
    () => [...new Set(rows.map((r) => r.entityType))].sort(), [rows]);

  const loadMore = async () => {
    const next = offset + PAGE;
    setOffset(next);
    const res = await auditConsoleApi.activity({
      actorId: actorFilter || undefined,
      source: sourceFilter || undefined,
      entityType: entityFilter || undefined,
      search: search.trim() || undefined,
      limit: PAGE, offset: next,
    });
    setRows((prev) => [...prev, ...res.rows]);
    setHasMore(res.hasMore);
  };

  const openRecord = (row: ActivityRowDTO) => {
    if (row.entityRoute) navigate(row.entityRoute);
  };

  return (
    <Card padding="md">
      <header className={styles.head}>
        <div>
          <h2 className={styles.headTitle}>{t('admin.activity.title')}</h2>
          <span className={styles.headMeta}>
            {t('admin.activity.subtitle')}
            {total > 0 && ` · ${total.toLocaleString(locale)} ${t('admin.activity.records')}`}
          </span>
        </div>
      </header>

      <div className={styles.filters}>
        <input
          className={styles.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void load(false); }}
          placeholder={t('admin.activity.searchPlaceholder')}
        />
        <select
          className={styles.select}
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
        >
          <option value="">{t('admin.activity.allActors')}</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} {a.actions > 0 ? `(${a.actions})` : ''}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as '' | 'human' | 'system')}
        >
          <option value="">{t('admin.activity.allSources')}</option>
          <option value="human">{t('admin.activity.sourceHuman')}</option>
          <option value="system">{t('admin.activity.sourceSystem')}</option>
        </select>
        {entityTypes.length > 1 && (
          <select
            className={styles.select}
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
          >
            <option value="">{t('admin.activity.allEntities')}</option>
            {entityTypes.map((e) => (
              <option key={e} value={e}>{ENTITY_LABEL[e] ?? e}</option>
            ))}
          </select>
        )}
        {(actorFilter || sourceFilter || entityFilter || search) && (
          <Button size="sm" variant="ghost" onClick={() => {
            setActorFilter(''); setSourceFilter(''); setEntityFilter(''); setSearch('');
          }}>
            {t('admin.activity.clear')}
          </Button>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <p className={styles.empty}>{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>{t('admin.activity.empty')}</p>
      ) : (
        <ul className={styles.feed}>
          {rows.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <li key={`${r.source}-${r.id}`} className={styles.row}>
                <button
                  type="button"
                  className={styles.rowMain}
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  aria-expanded={isOpen}
                >
                  <span className={`${styles.dot} ${styles[`dot_${r.severity}`]}`} />
                  <span className={styles.rowBody}>
                    <span className={styles.rowTop}>
                      <b className={styles.actor}>{r.actorName}</b>
                      <span className={styles.action}>{r.actionLabel}</span>
                      {r.entityLabel && (
                        <span className={styles.entity}>
                          — {r.entityLabel}
                        </span>
                      )}
                    </span>
                    <span className={styles.rowBottom}>
                      <span className={styles.type}>{ENTITY_LABEL[r.entityType] ?? r.entityType}</span>
                      {r.source === 'system' && (
                        <span className={styles.sysBadge}>{t('admin.activity.sourceSystem')}</span>
                      )}
                      {r.changes.length > 0 && (
                        <span className={styles.changeCount}>
                          {t('admin.activity.changeCount', { count: r.changes.length })}
                        </span>
                      )}
                    </span>
                  </span>
                  <time className={styles.time} dateTime={r.occurredAt}>
                    {relTime(r.occurredAt, locale)}
                  </time>
                </button>

                {isOpen && (
                  <div className={styles.detail}>
                    {r.changes.length === 0 ? (
                      <p className={styles.noChange}>{t('admin.activity.noChanges')}</p>
                    ) : (
                      <table className={styles.changes}>
                        <tbody>
                          {r.changes.map((c) => (
                            <tr key={c.field}>
                              <td className={styles.field}>{FIELD_LABEL[c.field] ?? c.field}</td>
                              <td className={styles.before}>{c.before ?? '—'}</td>
                              <td className={styles.arrow}>→</td>
                              <td className={styles.after}>{c.after ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <div className={styles.detailFoot}>
                      <span className={styles.exact}>
                        {new Date(r.occurredAt).toLocaleString(locale)}
                      </span>
                      {r.entityRoute && (
                        <Button size="sm" variant="secondary" onClick={() => openRecord(r)}>
                          {t('admin.activity.openRecord')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className={styles.more}>
          <Button size="sm" variant="ghost" onClick={loadMore}>
            {t('admin.activity.loadMore')}
          </Button>
        </div>
      )}
    </Card>
  );
}
