// =====================================================================
// PREI | ProjectIntake — geliştirici proje girişi yönetimi (admin).
// İki sekme: Onay Kuyruğu (bekleyen gönderiler → önizle + onayla/reddet) ve
// Davet Linkleri (geliştirici-bağlı tokenli link üret/kopyala/iptal).
// =====================================================================
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../../core/hooks/useFetch';
import { intakeApi, developersApi } from '../../core/api/resources';
import type { ProjectSubmissionDTO, ProjectInviteDTO, DeveloperDTO } from '../../core/types';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Card, CardBody, CardHeader } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { Field, Input, FormRow } from '../../core/components/Form/Form';
import { SelectMenu } from '../../core/components/Form/SelectMenu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../core/components/Table/Table';
import { Plus, Copy, Trash, CheckCircle, XCircle, FilePdf, LinkSimple, MapPin, Warning } from '@phosphor-icons/react';
import { ProjectsHubTabs } from '../projects/ProjectsHubTabs';
import styles from './ProjectIntake.module.css';

const warnCount = (s: ProjectSubmissionDTO) => (s.checks ?? []).filter((c) => c.level === 'warn').length;
const fmtMoney = (v: number | null, cur: string) => (v == null ? '—' : `${v.toLocaleString('tr-TR')} ${cur}`);
const priceRange = (s: ProjectSubmissionDTO) =>
  s.priceMin != null && s.priceMax != null && s.priceMin !== s.priceMax
    ? `${s.priceMin.toLocaleString('tr-TR')} – ${s.priceMax.toLocaleString('tr-TR')} ${s.currency}`
    : fmtMoney(s.priceMin ?? s.priceMax, s.currency);

export const ProjectIntake: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState<'queue' | 'invites'>('queue');

  const { data: queue, refetch: refetchQueue } = useFetch<ProjectSubmissionDTO[]>(() => intakeApi.queue(), []);
  const { data: invites, refetch: refetchInvites } = useFetch<ProjectInviteDTO[]>(() => intakeApi.listInvites(), []);
  const { data: developers } = useFetch<DeveloperDTO[]>(() => developersApi.list(), []);

  // --- Onay kuyruğu ---
  const [review, setReview] = useState<ProjectSubmissionDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const doApprove = async (id: string, mode: 'new' | 'update' = 'new') => {
    setBusy(true);
    try {
      const res = await intakeApi.approve(id, mode);
      toast.success(res.updated ? t('intake.admin.updatedOk') : t('intake.admin.approved'));
      setReview(null);
      refetchQueue();
    } catch (e) {
      toast.error(`${t('intake.admin.actionError')}: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };
  const doReject = async (id: string) => {
    setBusy(true);
    try {
      await intakeApi.reject(id);
      toast.success(t('intake.admin.rejected'));
      setReview(null);
      refetchQueue();
    } catch (e) {
      toast.error(`${t('intake.admin.actionError')}: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };

  // --- Davet linkleri ---
  const [invDev, setInvDev] = useState('');
  const [invLabel, setInvLabel] = useState('');
  const [invDays, setInvDays] = useState('');
  const [invMax, setInvMax] = useState('');
  const [creating, setCreating] = useState(false);

  const createInvite = async () => {
    setCreating(true);
    try {
      const inv = await intakeApi.createInvite({
        developerId: invDev || undefined,
        label: invLabel.trim() || undefined,
        expiresInDays: invDays ? Number(invDays) : undefined,
        maxUses: invMax ? Number(invMax) : undefined,
      });
      await navigator.clipboard.writeText(inv.url).catch(() => {});
      toast.success(t('intake.admin.inviteCreated'));
      setInvLabel(''); setInvDays(''); setInvMax('');
      refetchInvites();
    } catch (e) {
      toast.error(`${t('intake.admin.actionError')}: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setCreating(false); }
  };

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success(t('intake.admin.copied'));
  };
  const revoke = async (id: string) => {
    try {
      await intakeApi.revokeInvite(id);
      toast.success(t('intake.admin.revoked'));
      refetchInvites();
    } catch (e) {
      toast.error(`${t('intake.admin.actionError')}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const pending = queue ?? [];
  const devOptions = [{ value: '', label: t('intake.admin.noDeveloper') },
    ...(developers ?? []).map((d) => ({ value: d.id, label: d.name }))];

  return (
    <div className={styles.page}>
      <ProjectsHubTabs />
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('intake.admin.title')}</h1>
          <p className={styles.subtitle}>{t('intake.admin.subtitle')}</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'queue' ? styles.tabActive : ''}`} onClick={() => setTab('queue')}>
          {t('intake.admin.queueTab')}{pending.length > 0 && <span className={styles.badge}>{pending.length}</span>}
        </button>
        <button className={`${styles.tab} ${tab === 'invites' ? styles.tabActive : ''}`} onClick={() => setTab('invites')}>
          {t('intake.admin.invitesTab')}
        </button>
      </div>

      {tab === 'queue' && (
        <Card padding="none">
          <CardBody padding="none">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>{t('intake.admin.col.project')}</TableHeader>
                  <TableHeader>{t('intake.admin.col.developer')}</TableHeader>
                  <TableHeader>{t('intake.admin.col.location')}</TableHeader>
                  <TableHeader align="right">{t('intake.admin.col.price')}</TableHeader>
                  <TableHeader align="right">{t('intake.admin.col.commission')}</TableHeader>
                  <TableHeader align="right">{t('intake.admin.col.review')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {pending.map((s) => (
                  <TableRow key={s.id} className={styles.clickRow} onClick={() => setReview(s)}>
                    <TableCell style={{ fontWeight: 600 }}>
                      <span className={styles.titleCell}>
                        {s.title}
                        {s.duplicate && (
                          <span className={styles.dupChip}><Warning size={12} weight="fill" /> {t('intake.admin.dupChip')}</span>
                        )}
                        {warnCount(s) > 0 && (
                          <span className={styles.warnChip}><Warning size={12} weight="fill" /> {warnCount(s)}</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{s.developerName ?? '—'}</TableCell>
                    <TableCell>{[s.city, s.marketCode].filter(Boolean).join(' · ') || '—'}</TableCell>
                    <TableCell align="right"><span className={styles.mono}>{priceRange(s)}</span></TableCell>
                    <TableCell align="right"><span className={styles.mono}>{s.commissionPct != null ? `%${s.commissionPct}` : '—'}</span></TableCell>
                    <TableCell align="right"><Button variant="outline" onClick={(e) => { e.stopPropagation(); setReview(s); }}>{t('intake.admin.reviewBtn')}</Button></TableCell>
                  </TableRow>
                ))}
                {pending.length === 0 && (
                  <TableRow><TableCell colSpan={6}><span className={styles.empty}>{t('intake.admin.queueEmpty')}</span></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      {tab === 'invites' && (
        <>
          <Card padding="md">
            <div className={styles.cardTitle}>{t('intake.admin.newInvite')}</div>
            <FormRow>
              <Field label={t('intake.admin.developer')}>
                <SelectMenu aria-label={t('intake.admin.developer')} value={invDev} onChange={setInvDev} options={devOptions} />
              </Field>
              <Field label={t('intake.admin.label')}>
                <Input value={invLabel} onChange={(e) => setInvLabel(e.target.value)} placeholder="Emaar 2026 Q3" />
              </Field>
            </FormRow>
            <FormRow>
              <Field label={t('intake.admin.expiresDays')} hint={t('intake.admin.expiresHint')}>
                <Input type="number" min={1} max={365} value={invDays} onChange={(e) => setInvDays(e.target.value)} />
              </Field>
              <Field label={t('intake.admin.maxUses')} hint={t('intake.admin.maxUsesHint')}>
                <Input type="number" min={1} value={invMax} onChange={(e) => setInvMax(e.target.value)} />
              </Field>
            </FormRow>
            <div className={styles.actions}>
              <Button variant="primary" onClick={createInvite} disabled={creating}>
                <Plus size={16} /> {creating ? t('common.saving') : t('intake.admin.createInvite')}
              </Button>
            </div>
          </Card>

          <Card padding="none">
            <CardHeader><div className={styles.cardTitle}>{t('intake.admin.invitesTab')}</div></CardHeader>
            <CardBody padding="none">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>{t('intake.admin.col.developer')}</TableHeader>
                    <TableHeader>{t('intake.admin.label')}</TableHeader>
                    <TableHeader>{t('intake.admin.col.status')}</TableHeader>
                    <TableHeader align="right">{t('intake.admin.col.uses')}</TableHeader>
                    <TableHeader align="right">{t('intake.admin.col.actions')}</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(invites ?? []).map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.developerName ?? '—'}</TableCell>
                      <TableCell>{i.label ?? '—'}</TableCell>
                      <TableCell><span className={`${styles.statusChip} ${styles[`st_${i.status}`]}`}>{t(`intake.admin.status.${i.status}`)}</span></TableCell>
                      <TableCell align="right"><span className={styles.mono}>{i.usedCount}{i.maxUses != null ? `/${i.maxUses}` : ''}</span></TableCell>
                      <TableCell align="right">
                        <div className={styles.rowActions}>
                          <button className={styles.langCopyBtn} title={t('intake.admin.copyLinkTr')} onClick={() => copyLink(`${i.url}?lang=tr`)}><Copy size={13} /> TR</button>
                          <button className={styles.langCopyBtn} title={t('intake.admin.copyLinkEn')} onClick={() => copyLink(`${i.url}?lang=en`)}><Copy size={13} /> EN</button>
                          {i.status === 'active' && (
                            <button className={styles.iconBtn} title={t('common.delete')} onClick={() => revoke(i.id)}><Trash size={16} /></button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(invites ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={5}><span className={styles.empty}>{t('intake.admin.invitesEmpty')}</span></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </>
      )}

      {/* İnceleme modalı */}
      <Modal
        isOpen={!!review}
        onClose={() => setReview(null)}
        title={review?.title ?? ''}
        size="lg"
        footer={review && (
          <>
            <Button variant="outline" disabled={busy} onClick={() => doReject(review.id)}><XCircle size={16} /> {t('intake.admin.reject')}</Button>
            {review.duplicate?.refType === 'property' ? (
              <>
                <Button variant="outline" disabled={busy} onClick={() => doApprove(review.id, 'new')}><CheckCircle size={16} /> {t('intake.admin.approveAsNew')}</Button>
                <Button variant="primary" disabled={busy} onClick={() => doApprove(review.id, 'update')}><CheckCircle size={16} /> {t('intake.admin.approveAsUpdate')}</Button>
              </>
            ) : (
              <Button variant="primary" disabled={busy} onClick={() => doApprove(review.id, 'new')}><CheckCircle size={16} /> {t('intake.admin.approve')}</Button>
            )}
          </>
        )}
      >
        {review && (
          <div className={styles.review}>
            {review.duplicate && (
              <div className={styles.dupBanner}>
                <Warning size={18} weight="fill" />
                <span>
                  {t(review.duplicate.refType === 'property' ? 'intake.admin.dupBannerProperty' : 'intake.admin.dupBannerSubmission', {
                    title: review.duplicate.refTitle,
                    by: t(`intake.admin.dupBy.${review.duplicate.matchedBy}`, review.duplicate.matchedBy),
                  })}
                </span>
              </div>
            )}
            <div className={styles.checksBox}>
              <span className={styles.checksTitle}>{t('intake.admin.checksTitle')}</span>
              {(review.checks ?? []).length === 0 ? (
                <span className={styles.checksClean}><CheckCircle size={14} weight="fill" /> {t('intake.admin.checksClean')}</span>
              ) : (
                <ul className={styles.checksList}>
                  {review.checks.map((c) => (
                    <li key={c.code} className={c.level === 'warn' ? styles.checkWarn : styles.checkInfo}>
                      <Warning size={13} weight={c.level === 'warn' ? 'fill' : 'regular'} />
                      {t(`intake.admin.check.${c.code}`, c.code)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.reviewMeta}>
              <div><span className={styles.metaLabel}>{t('intake.admin.col.developer')}</span><span>{review.developerName ?? '—'}</span></div>
              <div><span className={styles.metaLabel}>{t('intake.admin.col.location')}</span><span>{[review.neighborhood, review.district, review.city, review.marketCode].filter(Boolean).join(', ') || '—'}</span></div>
              <div><span className={styles.metaLabel}>{t('intake.admin.col.price')}</span><span className={styles.mono}>{priceRange(review)}</span></div>
              <div><span className={styles.metaLabel}>{t('intake.admin.col.commission')}</span><span className={styles.mono}>{review.commissionPct != null ? `%${review.commissionPct}` : '—'}</span></div>
              <div><span className={styles.metaLabel}>{t('intake.form.unitTypes')}</span><span>{review.unitTypes.join(', ') || '—'}</span></div>
              <div>
                <span className={styles.metaLabel}>{t('intake.form.paymentSection')}</span>
                <span>
                  {review.downPaymentPct != null || review.installmentMonths != null || review.paymentNote
                    ? [
                        review.downPaymentPct != null ? `%${review.downPaymentPct} ${t('intake.admin.downShort')}` : null,
                        review.installmentMonths != null ? `${review.installmentMonths} ${t('intake.admin.monthsShort')}` : null,
                        review.paymentNote,
                      ].filter(Boolean).join(' · ')
                    : '—'}
                </span>
              </div>
            </div>
            {review.description && <p className={styles.desc}>{review.description}</p>}
            <div className={styles.linkRow}>
              {review.brochureUrl && (
                <a className={styles.brochure} href={review.brochureUrl} target="_blank" rel="noreferrer">
                  <FilePdf size={18} /> {t('intake.admin.viewBrochure')} <LinkSimple size={13} />
                </a>
              )}
              {review.mapUrl && (
                <a className={styles.brochure} href={review.mapUrl} target="_blank" rel="noreferrer">
                  <MapPin size={18} /> {t('intake.admin.viewMap')} <LinkSimple size={13} />
                </a>
              )}
              {review.listingUrl && (
                <a className={styles.brochure} href={review.listingUrl} target="_blank" rel="noreferrer">
                  <LinkSimple size={18} /> {t('intake.admin.viewListing')}
                </a>
              )}
            </div>
            {review.imageUrls.length > 0 && (
              Object.keys(review.imagesByCategory ?? {}).length > 0 ? (
                (['exterior', 'interior', 'social', 'general'] as const)
                  .filter((cat) => (review.imagesByCategory[cat] ?? []).length > 0)
                  .map((cat) => (
                    <div key={cat}>
                      <div className={styles.galleryLabel}>{t(`intake.admin.imgCat.${cat}`)}</div>
                      <div className={styles.gallery}>
                        {review.imagesByCategory[cat].map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer" className={styles.thumb}>
                            <img src={u} alt="" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
              ) : (
                <div className={styles.gallery}>
                  {review.imageUrls.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" className={styles.thumb}>
                      <img src={u} alt="" />
                    </a>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
