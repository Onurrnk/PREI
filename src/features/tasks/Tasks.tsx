import React, { useState, useEffect } from 'react';
import { Shield, Clock, Calendar, CheckCircle2, Circle } from 'lucide-react';
import type { UserDTO, TaskDTO } from '../../core/types';
import { usersApi, tasksApi } from '../../core/api/resources';
import styles from './Tasks.module.css';

export const Tasks: React.FC = () => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hardcoded "current user" for normal mode
  const currentUserId = 'u2'; // Sarah Ahmed

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [isAdminMode, selectedUserId]);

  const fetchUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
      if (data.length > 0) {
        setSelectedUserId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const queryUser = isAdminMode ? selectedUserId : currentUserId;
      const data = await tasksApi.list(queryUser ?? undefined);
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setIsLoading(false);
    }
  };

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

  const groupedTasks = {
    'Pending': tasks.filter(t => t.status === 'Pending'),
    'In Progress': tasks.filter(t => t.status === 'In Progress'),
    'Completed': tasks.filter(t => t.status === 'Completed'),
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Tasks & Meetings</h1>
        <div className={styles.headerActions}>
          <button 
            className={`${styles.adminToggle} ${isAdminMode ? styles.active : ''}`}
            onClick={() => setIsAdminMode(!isAdminMode)}
          >
            <Shield size={16} />
            {isAdminMode ? 'Admin Mode On' : 'Admin Mode Off'}
          </button>
        </div>
      </header>

      <div className={styles.mainLayout}>
        {isAdminMode && (
          <aside className={styles.userSelector}>
            <h3>Team Members</h3>
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
            <div className={styles.loading}>Loading tasks...</div>
          ) : (
            <>
              {(['Pending', 'In Progress', 'Completed'] as const).map(status => (
                <div key={status} className={styles.taskColumn}>
                  <div className={styles.columnHeader}>
                    <h3>{status}</h3>
                    <span className={styles.taskCount}>{groupedTasks[status].length}</span>
                  </div>
                  
                  {groupedTasks[status].length === 0 ? (
                    <div className={styles.emptyState}>
                      <CheckCircle2 size={32} />
                      <p>No {status.toLowerCase()} tasks</p>
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
                            {task.type === 'Meeting' ? <Calendar size={14} /> : <Clock size={14} />}
                            {formatDate(task.dueDate)}
                          </div>
                          
                          <div className={styles.taskActions}>
                            <button 
                              className={`${styles.actionBtn} ${task.status === 'Completed' ? styles.complete : ''}`}
                              onClick={() => handleToggleComplete(task)}
                              title={task.status === 'Completed' ? 'Mark as Pending' : 'Mark as Completed'}
                            >
                              {task.status === 'Completed' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
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
    </div>
  );
};
