import NetInfo from '@react-native-community/netinfo';
import type { MutableRefObject } from 'react';
import { Alert } from 'react-native';

import { loadMeta, saveMeta } from '../lib/task-storage';
import { mergeLocalWithRemote, pullRemoteTasks, pushLocalChanges } from '../lib/task-sync';
import type { LocalTask } from '../lib/task-types';
import type { CloudSyncStatus } from './task-context.types';

type CreateTaskSyncHandlersArgs = {
  getTasks: () => LocalTask[];
  persist: (next: LocalTask[]) => Promise<void>;
  syncingRef: MutableRefObject<boolean>;
  pendingAutoSyncRef: MutableRefObject<boolean>;
  setSyncing: (val: boolean) => void;
  setIsOnline: (val: boolean) => void;
  setCloudStatus: (val: CloudSyncStatus) => void;
  setLastSyncError: (val: string | undefined) => void;
  getCloudSyncEnabled: () => boolean;
  setCloudSyncEnabledState: (val: boolean) => void;
  getAutoSync: () => boolean;
  setAutoSyncState: (val: boolean) => void;
  getLastSync: () => string | undefined;
  setLastSync: (val: string | undefined) => void;
  nowISO: () => string;
};

export function createTaskSyncHandlers({
  getTasks,
  persist,
  syncingRef,
  pendingAutoSyncRef,
  setSyncing,
  setIsOnline,
  setCloudStatus,
  setLastSyncError,
  getCloudSyncEnabled,
  setCloudSyncEnabledState,
  getAutoSync,
  setAutoSyncState,
  getLastSync,
  setLastSync,
  nowISO,
}: CreateTaskSyncHandlersArgs) {
  function errorMessage(e: any, fallback: string) {
    const message = typeof e?.message === 'string' ? e.message.trim() : '';
    return message || fallback;
  }

  async function setCloudSyncEnabled(val: boolean) {
    setCloudSyncEnabledState(val);
    if (!val) {
      setAutoSyncState(false);
      setCloudStatus('disabled');
      setLastSyncError(undefined);
    } else {
      setCloudStatus('unknown');
    }

    const currentMeta = await loadMeta();
    await saveMeta({
      ...currentMeta,
      cloudSyncEnabled: val,
      autoSync: val ? getAutoSync() : false,
      lastSync: getLastSync(),
    });
  }

  async function setAutoSync(val: boolean) {
    if (!getCloudSyncEnabled() && val) {
      Alert.alert('Not Available', 'Enable cloud sync first.');
      return;
    }

    setAutoSyncState(val);

    const currentMeta = await loadMeta();
    await saveMeta({
      ...currentMeta,
      autoSync: val,
      cloudSyncEnabled: getCloudSyncEnabled(),
      lastSync: getLastSync(),
    });

    if (val) {
      await runAutoSyncPushOnly(false);
    }
  }

  async function runAutoSyncPushOnly(silent: boolean) {
    if (!getCloudSyncEnabled()) return;
    if (!getAutoSync()) return;

    const net = await NetInfo.fetch();
    const onlineNow = !!net.isConnected;
    setIsOnline(onlineNow);
    if (!onlineNow) {
      setCloudStatus('unavailable');
      setLastSyncError('No internet connection.');
      return;
    }

    if (syncingRef.current) {
      pendingAutoSyncRef.current = true;
      return;
    }

    try {
      syncingRef.current = true;
      setSyncing(true);
      setLastSyncError(undefined);

      const pushed = await pushLocalChanges(getTasks());
      await persist(pushed);

      const syncTime = nowISO();
      setLastSync(syncTime);
      setCloudStatus('connected');

      const currentMeta = await loadMeta();
      await saveMeta({
        ...currentMeta,
        lastSync: syncTime,
        cloudSyncEnabled: getCloudSyncEnabled(),
        autoSync: getAutoSync(),
      });
    } catch (e: any) {
      setCloudStatus('unavailable');
      const message = errorMessage(e, 'Unable to push changes to Supabase.');
      setLastSyncError(message);
      if (!silent) {
        Alert.alert('Auto Sync Error', message);
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);

      if (pendingAutoSyncRef.current) {
        pendingAutoSyncRef.current = false;
        await runAutoSyncPushOnly(true);
      }
    }
  }

  async function syncNow() {
    if (!getCloudSyncEnabled()) {
      setCloudStatus('disabled');
      setLastSyncError(undefined);
      Alert.alert('Cloud Sync Disabled', 'The app is currently running in local-only mode.');
      return;
    }

    const net = await NetInfo.fetch();
    const onlineNow = !!net.isConnected;
    setIsOnline(onlineNow);
    if (!onlineNow) {
      setCloudStatus('unavailable');
      setLastSyncError('No internet connection.');
      Alert.alert('Offline', 'You are offline and cannot sync right now.');
      return;
    }

    if (syncingRef.current) return;

    try {
      syncingRef.current = true;
      setSyncing(true);
      setLastSyncError(undefined);

      const pushedBase = await pushLocalChanges(getTasks());
      const remote = await pullRemoteTasks();
      const merged = mergeLocalWithRemote(pushedBase, remote);

      await persist(merged);

      const syncTime = nowISO();
      setLastSync(syncTime);
      setCloudStatus('connected');

      const currentMeta = await loadMeta();
      await saveMeta({
        ...currentMeta,
        lastSync: syncTime,
        cloudSyncEnabled: getCloudSyncEnabled(),
        autoSync: getAutoSync(),
      });
    } catch (e: any) {
      setCloudStatus('unavailable');
      const message = errorMessage(e, 'Unable to sync with Supabase.');
      setLastSyncError(message);
      Alert.alert('Sync Error', message);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  return {
    setCloudSyncEnabled,
    setAutoSync,
    runAutoSyncPushOnly,
    syncNow,
  };
}
