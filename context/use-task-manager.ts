import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import type { LocalTask } from '../lib/task-types';
import { loadMeta, loadTasks, resetAllLocalData, saveTasks } from '../lib/task-storage';
import { createTaskCrudHandlers } from './task-crud';
import { createTaskSyncHandlers } from './task-sync';
import type { TaskCtx } from './task-context.types';
import { useTaskManagerState } from './use-task-manager-state';

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
    cloudStatus,
    setCloudStatus,
    lastSyncError,
    setLastSyncError,
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
    setCloudStatus,
    setLastSyncError,
    getCloudSyncEnabled: () => cloudSyncEnabledRef.current,
    setCloudSyncEnabledState,
    getAutoSync: () => autoSyncRef.current,
    setAutoSyncState,
    getLastSync: () => lastSyncRef.current,
    setLastSync,
    nowISO,
  });

  function scheduleAutoSync(delayMs = 700) {
    if (!autoSyncRef.current) return;
    if (!cloudSyncEnabledRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      runAutoSyncPushOnly(false).catch(() => {});
    }, delayMs);
  }

  const { addTask, updateTask, toggleTask, deleteTask, restoreTask, reorderVisibleTasks, clearCompleted } = createTaskCrudHandlers({
    getTasks: () => tasksRef.current,
    persist,
    scheduleAutoSync,
    makeLocalId,
    nowISO,
  });

  async function resetLocalData() {
    await resetAllLocalData();
    tasksRef.current = [];
    setTasks([]);

    setLastSync(undefined);
    setCloudSyncEnabledState(true);
    setAutoSyncState(false);
    setCloudStatus('unknown');
    setLastSyncError(undefined);

    lastSyncRef.current = undefined;
    cloudSyncEnabledRef.current = true;
    autoSyncRef.current = false;
  }

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
        setCloudStatus(meta.cloudSyncEnabled ?? true ? 'unknown' : 'disabled');
        setLastSyncError(undefined);

        lastSyncRef.current = meta.lastSync;
        cloudSyncEnabledRef.current = meta.cloudSyncEnabled ?? true;
        autoSyncRef.current = meta.autoSync ?? false;

        const net = await NetInfo.fetch();
        if ((meta.cloudSyncEnabled ?? true) && (meta.autoSync ?? false) && net.isConnected) {
          await runAutoSyncPushOnly(true);
        }
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Unknown error');
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
    cloudStatus,
    lastSyncError,
    lastSync,
    cloudSyncEnabled,
    setCloudSyncEnabled,
    autoSync,
    setAutoSync,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    restoreTask,
    reorderVisibleTasks,
    clearCompleted,
    resetLocalData,
    syncNow,
  };
}
