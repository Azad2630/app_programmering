import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import type { LocalTask } from '../lib/tasks';
import { loadMeta, loadTasks, saveTasks } from '../lib/taskStorage';
import { createTaskCrudHandlers } from './taskManagerCrud';
import { createTaskSyncHandlers } from './taskManagerSync';
import type { TaskCtx } from './taskContextTypes';
import { useTaskManagerState } from './useTaskManagerState';

function nowISO() {
  return new Date().toISOString();
}

function makeLocalId() {
  return Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
}

export function useTaskManager(): TaskCtx {
  const {
    tasks,
    setTasks,
    tasksRef,
    loading,
    setLoading,
    syncing,
    setSyncing,
    syncingRef,
    pendingAutoSyncRef,
    isOnline,
    setIsOnline,
    lastSync,
    setLastSync,
    lastSyncRef,
    cloudSyncEnabled,
    setCloudSyncEnabledState,
    cloudSyncEnabledRef,
    autoSync,
    setAutoSyncState,
    autoSyncRef,
    timerRef,
    visibleTasks,
  } = useTaskManagerState();

  async function persist(next: LocalTask[]) {
    tasksRef.current = next;
    setTasks(next);
    await saveTasks(next);
  }

  const { setCloudSyncEnabled, setAutoSync, runAutoSyncPushOnly, syncNow } = createTaskSyncHandlers({
    getTasks: () => tasksRef.current,
    persist,
    syncingRef,
    pendingAutoSyncRef,
    setSyncing,
    setIsOnline,
    getCloudSyncEnabled: () => cloudSyncEnabledRef.current,
    setCloudSyncEnabledState,
    getAutoSync: () => autoSyncRef.current,
    setAutoSyncState,
    getLastSync: () => lastSyncRef.current,
    setLastSync,
    nowISO,
  });

  function scheduleAutoSync() {
    if (!autoSyncRef.current) return;
    if (!cloudSyncEnabledRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      runAutoSyncPushOnly(false).catch(() => {});
    }, 700);
  }

  const { addTask, toggleTask, deleteTask, clearCompleted } = createTaskCrudHandlers({
    getTasks: () => tasksRef.current,
    persist,
    scheduleAutoSync,
    makeLocalId,
    nowISO,
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [local, meta] = await Promise.all([loadTasks(), loadMeta()]);

        tasksRef.current = local;
        setTasks(local);

        setLastSync(meta.lastSync);
        setCloudSyncEnabledState(meta.cloudSyncEnabled ?? true);
        setAutoSyncState(meta.autoSync ?? false);

        lastSyncRef.current = meta.lastSync;
        cloudSyncEnabledRef.current = meta.cloudSyncEnabled ?? true;
        autoSyncRef.current = meta.autoSync ?? false;

        const net = await NetInfo.fetch();
        if ((meta.cloudSyncEnabled ?? true) && (meta.autoSync ?? false) && net.isConnected) {
          await runAutoSyncPushOnly(true);
        }
      } catch (e: any) {
        Alert.alert('Fejl', e?.message ?? 'Ukendt fejl');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOnline && autoSync && cloudSyncEnabled) {
      runAutoSyncPushOnly(true).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, autoSync, cloudSyncEnabled]);

  return {
    tasks,
    visibleTasks,
    loading,
    syncing,
    isOnline,
    lastSync,
    cloudSyncEnabled,
    setCloudSyncEnabled,
    autoSync,
    setAutoSync,
    addTask,
    toggleTask,
    deleteTask,
    clearCompleted,
    syncNow,
  };
}
