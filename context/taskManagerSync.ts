import NetInfo from '@react-native-community/netinfo';
import type { MutableRefObject } from 'react';
import { Alert } from 'react-native';

import { loadMeta, saveMeta } from '../lib/taskStorage';
import { mergeLocalWithRemote, pullRemoteTasks, pushLocalChanges } from '../lib/taskSync';
import type { LocalTask } from '../lib/tasks';

type CreateTaskSyncHandlersArgs = {
  getTasks: () => LocalTask[];
  persist: (next: LocalTask[]) => Promise<void>;
  syncingRef: MutableRefObject<boolean>;
  pendingAutoSyncRef: MutableRefObject<boolean>;
  setSyncing: (val: boolean) => void;
  setIsOnline: (val: boolean) => void;
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
  getCloudSyncEnabled,
  setCloudSyncEnabledState,
  getAutoSync,
  setAutoSyncState,
  getLastSync,
  setLastSync,
  nowISO,
}: CreateTaskSyncHandlersArgs) {
  async function setCloudSyncEnabled(val: boolean) {
    setCloudSyncEnabledState(val);
    if (!val) setAutoSyncState(false);

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
      Alert.alert('Ikke muligt', 'Slaa Cloud-sync til foerst.');
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
    if (!onlineNow) return;

    if (syncingRef.current) {
      pendingAutoSyncRef.current = true;
      return;
    }

    try {
      syncingRef.current = true;
      setSyncing(true);

      const pushed = await pushLocalChanges(getTasks());
      await persist(pushed);

      const syncTime = nowISO();
      setLastSync(syncTime);

      const currentMeta = await loadMeta();
      await saveMeta({
        ...currentMeta,
        lastSync: syncTime,
        cloudSyncEnabled: getCloudSyncEnabled(),
        autoSync: getAutoSync(),
      });
    } catch (e: any) {
      if (!silent) {
        Alert.alert('Auto-sync fejl', e?.message ?? 'Kunne ikke sende til Supabase');
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
      Alert.alert('Cloud-sync er slaaet fra', 'Appen koerer kun lokalt lige nu.');
      return;
    }

    const net = await NetInfo.fetch();
    const onlineNow = !!net.isConnected;
    setIsOnline(onlineNow);
    if (!onlineNow) {
      Alert.alert('Offline', 'Du er offline - kan ikke synkronisere lige nu.');
      return;
    }

    if (syncingRef.current) return;

    try {
      syncingRef.current = true;
      setSyncing(true);

      const pushedBase = await pushLocalChanges(getTasks());
      const remote = await pullRemoteTasks();
      const merged = mergeLocalWithRemote(pushedBase, remote);

      await persist(merged);

      const syncTime = nowISO();
      setLastSync(syncTime);

      const currentMeta = await loadMeta();
      await saveMeta({
        ...currentMeta,
        lastSync: syncTime,
        cloudSyncEnabled: getCloudSyncEnabled(),
        autoSync: getAutoSync(),
      });
    } catch (e: any) {
      Alert.alert('Sync-fejl', e?.message ?? 'Kunne ikke synkronisere');
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
