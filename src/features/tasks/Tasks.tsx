import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Clock, CalendarBlank, CheckCircle, Circle, Plus } from '@phosphor-icons/react';
import type { UserDTO, TaskDTO, CreateTaskInput } from '../../core/types';
import { usersApi, tasksApi } from '../../core/api/resources';
import { ApiError } from '../../core/api/client';
import { useToast } from '../../core/components/Toast/ToastProvider';
import { Button } from '../../core/components/Button/Button';
import { Modal } from '../../core/components/Modal/Modal';
import { Field, Input, Textarea, FormRow, Select } from '../../core/components/Form/Form';
import styles from './Tasks.module.css';
import { useTranslation } from 'react-i18next';

interface NewTaskForm {
  title: string;
  description: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  assigneeId: string;
}

const EMPTY_TASK_FORM: NewTaskForm = {
  title: '', description: '', dueDate: '', priority: 'Medium', assigneeId: '',
};

export const Tasks: React.FC = () => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const statusKey = (st: string) => st === 'In Progress' ? 'inProgress' : st.toLowerCase();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<NewTaskForm>(EMPTY_TASK_FORM);
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof NewTaskForm>(key: K, value: NewTaskForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const fetchUsers = useCallback(async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
      if (data.length > 0) {
        setSelectedUserId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      // Normal mod: filtresiz (RLS/super_admin kapsar). Admin mod: seçili kişi.
      const queryUser = isAdminMode ? selectedUserId : null;
      const data = await tasksApi.list(queryUser ?? undefined);
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAdminMode, selectedUserId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mock-faz veri çekme; Faz 1'de useFetch'e taşınacak
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mock-faz veri çekme; Faz 1'de useFetch'e taşınacak
    fetchTasks();
  }, [fetchTasks]);

  const handleToggleComplete = async (task: TaskDTO) => {
    const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      // Optimistic update
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      await tasksApi.update(task.id, { status: newStatus });
    } catch (err) {
      console.error('Failed to update task', err);
      // Revert on error
      fetchTasks();
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setForm(EMPTY_TASK_FORM);
  };

  const handleCreate = async () => {
    const title = form.title.trim();
    if (!title) {
      toast.error(t('tasks.form.titleRequired'));
      return;
    }
    const input: CreateTaskInput = {
      title,
      description: form.description.trim() || undefined,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      priority: form.priority,
      assigneeId: form.assigneeId || undefined,
    };
    setSaving(true);
    try {
      await tasksApi.create(input);
      toast.success(t('tasks.createSuccess'));
      closeModal();
      fetchTasks();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('tasks.createError');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const groupedTasks = {
    'Pending': tasks.filter(t => t.status === 'Pending'),
    'In Progress': tasks.filter(t => t.status === 'In Progress'),
    'Completed': tasks.filter(t => t.status === 'Completed'),
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('tasks.title')}</h1>
        <div className={styles.headerActions}>
          <button
            className={`${styles.adminToggle} ${isAdminMode ? styles.active : ''}`}
            onClick={() => setIsAdminMode(!isAdminMode)}
          >
            <Shield size={16} />
            {isAdminMode ? t('tasks.adminOn') : t('tasks.adminOff')}
          </button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> {t('tasks.newTask')}
          </Button>
        </div>
      </header>

      <div className={styles.mainLayout}>
        {isAdminMode && (
          <aside className={styles.userSelector}>
            <h3>{t('tasks.teamMembers')}</h3>
            {users.map(user => (
              <div 
                key={user.id} 
                className={`${styles.userCard} ${selectedUserId === user.id ? styles.selected : ''}`}
                onClick={() => setSelectedUserId(user.id)}
              >
                <img src={user.avatar} alt={user.name} className={styles.userAvatar} />
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.name}</span>
                  <span className={styles.userRole}>{user.role}</span>
                </div>
              </div>
            ))}
          </aside>
        )}

        <div className={styles.taskBoard}>
          {isLoading ? (
            <div className={styles.loading}>{t('common.loading')}</div>
          ) : (
            <>
              {(['Pending', 'In Progress', 'Completed'] as const).map(status => (
                <div key={status} className={styles.taskColumn}>
                  <div className={styles.columnHeader}>
                    <h3>{t(`tasks.${statusKey(status)}`)}</h3>
                    <span className={styles.taskCount}>{groupedTasks[status].length}</span>
                  </div>
                  
                  {groupedTasks[status].length === 0 ? (
                    <div className={styles.emptyState}>
                      <CheckCircle size={32} />
                      <p>{t('tasks.emptyColumn', { status: t(`tasks.${statusKey(status)}`) })}</p>
                    </div>
                  ) : (
                    groupedTasks[status].map(task => (
                      <div key={task.id} className={styles.taskItem}>
                        <div className={styles.taskHeader}>
                          <span className={`${styles.taskType} ${styles[task.type]}`}>{task.type}</span>
                          <div className={`${styles.taskPriority} ${styles[`priority-${task.priority}`]}`} title={`${task.priority} Priority`} />
                        </div>
                        
                        <h4 className={styles.taskTitle}>{task.title}</h4>
                        <p className={styles.taskDesc}>{task.description}</p>
                        
                        {task.relatedEntity && (
                          <div className={styles.taskDesc} style={{ fontWeight: 500 }}>
                            {task.relatedEntity.type}: {task.relatedEntity.name}
                          </div>
                        )}
                        
                        <div className={styles.taskFooter}>
                          <div className={styles.taskDate}>
                            {task.type === 'Meeting' ? <CalendarBlank size={14} /> : <Clock size={14} />}
                            {formatDate(task.dueDate)}
                          </div>
                          
                          <div className={styles.taskActions}>
                            <button 
                              className={`${styles.actionBtn} ${task.status === 'Completed' ? styles.complete : ''}`}
                              onClick={() => handleToggleComplete(task)}
                              title={task.status === 'Completed' ? t('tasks.markPending') : t('tasks.markCompleted')}
                            >
                              {task.status === 'Completed' ? <CheckCircle size={18} /> : <Circle size={18} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={closeModal}
        title={t('tasks.form.title')}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={saving}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleCreate} disabled={saving}>
              {saving ? t('common.saving') : t('tasks.form.create')}
            </Button>
          </>
        }
      >
        <div className={styles.formStack}>
          <Field label={t('tasks.form.taskTitle')}>
            <Input
              type="text"
              placeholder={t('tasks.form.titlePlaceholder')}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />
          </Field>

          <Field label={t('tasks.form.description')}>
            <Textarea
              placeholder={t('tasks.form.descriptionPlaceholder')}
              rows={3}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </Field>

          <FormRow>
            <Field label={t('tasks.form.dueDate')}>
              <Input
                type="datetime-local"
                value={form.dueDate}
                onChange={(e) => setField('dueDate', e.target.value)}
              />
            </Field>
            <Field label={t('tasks.form.priority')}>
              <Select
                value={form.priority}
                onChange={(e) => setField('priority', e.target.value as NewTaskForm['priority'])}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </Select>
            </Field>
          </FormRow>

          <Field label={t('tasks.form.assignee')}>
            <Select
              value={form.assigneeId}
              onChange={(e) => setField('assigneeId', e.target.value)}
            >
              <option value="">{t('tasks.form.unassigned')}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
};
