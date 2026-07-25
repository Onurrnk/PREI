// =====================================================================
// PREI | Komuta Merkezi — Görev Paneli
// Basit listeden çıkıp yönetilebilir panele: 3 durumlu kontrol (Bekliyor /
// Devam ediyor / Bitti), görev içeriğini görüntüleme ve HER İŞLEMDE rapor
// yazılabilen geniş not alanı. Raporlar append-only günlükte tutulur
// (kim, ne zaman, hangi durum geçişi) — silinmez, geçmiş korunur.
// =====================================================================
import React, { useMemo, useState } from 'react';
import {
  CheckCircle, CircleDashed, CircleHalf, ClipboardText, ListChecks,
  CalendarBlank, ArrowRight, NotePencil, Warning,
} from '@phosphor-icons/react';
import { Modal } from '../../../core/components/Modal/Modal';
import { Button } from '../../../core/components/Button/Button';
import { EmptyState } from '../../../core/components/EmptyState/EmptyState';
import { useToast } from '../../../core/components/Toast/ToastProvider';
import { tasksApi } from '../../../core/api/resources';
import { ApiError } from '../../../core/api/client';
import type { TaskDTO, TaskStatus } from '../../../core/types';
import { useTranslation } from 'react-i18next';
import styles from './TaskPanel.module.css';

const STATUSES: TaskStatus[] = ['Pending', 'In Progress', 'Completed'];

const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  Pending: <CircleDashed size={15} weight="bold" />,
  'In Progress': <CircleHalf size={15} weight="fill" />,
  Completed: <CheckCircle size={15} weight="fill" />,
};

// Durum renkleri: bekliyor nötr, devam ediyor mavi, bitti yeşil.
const STATUS_CLASS: Record<TaskStatus, string> = {
  Pending: 'stPending',
  'In Progress': 'stProgress',
  Completed: 'stDone',
};

const STATUS_KEY: Record<TaskStatus, string> = {
  Pending: 'tasks.status.pending',
  'In Progress': 'tasks.status.inProgress',
  Completed: 'tasks.status.completed',
};

const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

interface Props {
  tasks: TaskDTO[];
  loading?: boolean;
  onChanged: () => void;
  onSeeAll: () => void;
}

export const TaskPanel: React.FC<Props> = ({ tasks, onChanged, onSeeAll }) => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [showDone, setShowDone] = useState(false);
  const [selected, setSelected] = useState<TaskDTO | null>(null);
  const [draftStatus, setDraftStatus] = useState<TaskStatus>('Pending');
  const [report, setReport] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const dateLocale = i18n.language === 'tr' ? 'tr-TR' : 'en-GB';
  const fmtDate = (iso: string): string =>
    iso ? new Date(iso).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }) : '';
  const fmtStamp = (iso: string): string =>
    iso ? new Date(iso).toLocaleString(dateLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  const visible = useMemo(() => {
    const list = tasks.filter((x) => (showDone ? true : x.status !== 'Completed'));
    return [...list]
      .sort((a, b) => {
        const p = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
        if (p !== 0) return p;
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      })
      .slice(0, 6);
  }, [tasks, showDone]);

  const openTask = (task: TaskDTO) => {
    setSelected(task);
    setDraftStatus(task.status);
    setReport('');
  };

  /** Listeden hızlı durum değişimi (rapor notu olmadan). */
  const quickStatus = async (task: TaskDTO, status: TaskStatus) => {
    if (task.status === status) return;
    setBusyId(task.id);
    try {
      await tasksApi.update(task.id, { status });
      toast.success(t('dashboard.tasks.statusUpdated'));
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('dashboard.tasks.updateError'));
    } finally {
      setBusyId(null);
    }
  };

  /** Detay modalından kaydet: durum + (varsa) rapor notu birlikte gider. */
  const saveDetail = async () => {
    if (!selected) return;
    const note = report.trim();
    if (draftStatus === selected.status && !note) {
      toast.info(t('dashboard.tasks.nothingToSave'));
      return;
    }
    setSaving(true);
    try {
      await tasksApi.update(selected.id, {
        ...(draftStatus !== selected.status ? { status: draftStatus } : {}),
        ...(note ? { report: note } : {}),
      });
      toast.success(t('dashboard.tasks.saved'));
      setSelected(null);
      setReport('');
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('dashboard.tasks.updateError'));
    } finally {
      setSaving(false);
    }
  };

  const overdue = (task: TaskDTO): boolean =>
    !!task.dueDate && task.status !== 'Completed' && new Date(task.dueDate) < new Date(new Date().toDateString());

  const activeCount = tasks.filter((x) => x.status !== 'Completed').length;

  return (
    <>
      <div className={styles.head}>
        <span className={styles.count}>
          {t('dashboard.tasks.activeCount', { count: activeCount })}
        </span>
        <button
          className={`${styles.toggle} ${showDone ? styles.toggleOn : ''}`}
          onClick={() => setShowDone((v) => !v)}
        >
          {showDone ? t('dashboard.tasks.hideDone') : t('dashboard.tasks.showDone')}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            compact
            icon={<ListChecks size={22} weight="duotone" />}
            title={t('dashboard.noTasks')}
            actionLabel={t('dashboard.empty.goToTasks')}
            onAction={onSeeAll}
          />
        </div>
      ) : (
        <div className={styles.list}>
          {visible.map((task) => (
            <div key={task.id} className={`${styles.row} ${busyId === task.id ? styles.rowBusy : ''}`}>
              {/* 3 durumlu kontrol — tek tıkla değiştir */}
              <div className={styles.statusGroup} role="group" aria-label={t('dashboard.tasks.status')}>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    className={`${styles.statusBtn} ${styles[STATUS_CLASS[s]]} ${task.status === s ? styles.statusActive : ''}`}
                    title={t(STATUS_KEY[s])}
                    aria-label={t(STATUS_KEY[s])}
                    aria-pressed={task.status === s}
                    disabled={busyId === task.id}
                    onClick={() => void quickStatus(task, s)}
                  >
                    {STATUS_ICON[s]}
                  </button>
                ))}
              </div>

              <button className={styles.main} onClick={() => openTask(task)}>
                <span className={`${styles.title} ${task.status === 'Completed' ? styles.titleDone : ''}`}>
                  {task.title}
                </span>
                <span className={styles.meta}>
                  {task.dueDate && (
                    <span className={overdue(task) ? styles.due : styles.dueMuted}>
                      <CalendarBlank size={12} /> {fmtDate(task.dueDate)}
                    </span>
                  )}
                  {task.relatedEntity?.name && (
                    <span className={styles.related}>{task.relatedEntity.name}</span>
                  )}
                  {task.reports.length > 0 && (
                    <span className={styles.reportCount} title={t('dashboard.tasks.reportCount', { count: task.reports.length })}>
                      <ClipboardText size={12} /> {task.reports.length}
                    </span>
                  )}
                </span>
              </button>

              <span className={`${styles.prio} ${task.priority === 'High' ? styles.prioHigh : task.priority === 'Low' ? styles.prioLow : styles.prioMid}`}>
                {t(`tasks.priority.${task.priority === 'High' ? 'high' : task.priority === 'Low' ? 'low' : 'medium'}`)}
              </span>
            </div>
          ))}
        </div>
      )}

      <button className={styles.seeAll} onClick={onSeeAll}>
        {t('dashboard.tasks.seeAll')} <ArrowRight size={13} />
      </button>

      {/* Detay + rapor modalı */}
      {selected && (
        <Modal
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          title={t('dashboard.tasks.detailTitle')}
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setSelected(null)} disabled={saving}>
                {t('common.close')}
              </Button>
              <Button variant="primary" onClick={saveDetail} disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </>
          }
        >
          <div className={styles.detail}>
            <h3 className={styles.detailTitle}>{selected.title}</h3>

            <div className={styles.detailMeta}>
              {selected.dueDate && (
                <span className={overdue(selected) ? styles.due : styles.dueMuted}>
                  <CalendarBlank size={13} /> {fmtDate(selected.dueDate)}
                  {overdue(selected) && ` · ${t('dashboard.tasks.overdue')}`}
                </span>
              )}
              <span className={`${styles.prio} ${selected.priority === 'High' ? styles.prioHigh : selected.priority === 'Low' ? styles.prioLow : styles.prioMid}`}>
                {t(`tasks.priority.${selected.priority === 'High' ? 'high' : selected.priority === 'Low' ? 'low' : 'medium'}`)}
              </span>
              {selected.relatedEntity?.name && (
                <span className={styles.related}>{selected.relatedEntity.name}</span>
              )}
            </div>

            {selected.description ? (
              <p className={styles.desc}>{selected.description}</p>
            ) : (
              <p className={styles.descEmpty}>{t('dashboard.tasks.noDescription')}</p>
            )}

            {/* Durum seçimi — geniş, etiketli */}
            <div className={styles.field}>
              <label className={styles.label}>{t('dashboard.tasks.status')}</label>
              <div className={styles.statusPicker}>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    className={`${styles.statusOption} ${styles[STATUS_CLASS[s]]} ${draftStatus === s ? styles.statusOptionActive : ''}`}
                    onClick={() => setDraftStatus(s)}
                    aria-pressed={draftStatus === s}
                  >
                    {STATUS_ICON[s]} {t(STATUS_KEY[s])}
                  </button>
                ))}
              </div>
            </div>

            {/* Geniş rapor alanı — her işlemde not bırakılabilir */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="task-report">
                <NotePencil size={14} /> {t('dashboard.tasks.reportLabel')}
              </label>
              <textarea
                id="task-report"
                className={styles.textarea}
                rows={6}
                value={report}
                onChange={(e) => setReport(e.target.value)}
                placeholder={t('dashboard.tasks.reportPlaceholder')}
                maxLength={5000}
              />
              <span className={styles.hint}>{t('dashboard.tasks.reportHint')}</span>
            </div>

            {/* Rapor günlüğü (append-only) */}
            {selected.reports.length > 0 && (
              <div className={styles.field}>
                <label className={styles.label}>{t('dashboard.tasks.reportHistory')}</label>
                <div className={styles.timeline}>
                  {[...selected.reports].reverse().map((r, i) => (
                    <div key={`${r.at}-${i}`} className={styles.entry}>
                      <div className={styles.entryHead}>
                        <span className={styles.entryWho}>{r.byName || '—'}</span>
                        <span className={styles.entryAt}>{fmtStamp(r.at)}</span>
                      </div>
                      {r.toStatus && (
                        <div className={styles.entryTransition}>
                          {r.fromStatus ? t(STATUS_KEY[r.fromStatus]) : '—'}
                          <ArrowRight size={11} />
                          <strong>{t(STATUS_KEY[r.toStatus])}</strong>
                        </div>
                      )}
                      {r.text && <p className={styles.entryText}>{r.text}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.status === 'Completed' && (
              <div className={styles.doneNote}>
                <Warning size={14} /> {t('dashboard.tasks.reopenHint')}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
