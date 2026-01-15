import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import type { LocalTask } from '../lib/tasks';
import { loadMeta, loadTasks, saveMeta, saveTasks } from '../lib/taskStorage';
import { mergeLocalWithRemote, pullRemoteTasks, pushLocalChanges } from '../lib/taskSync';

type TaskCtx = {
  tasks: LocalTask[];
  visibleTasks: LocalTask[];
  loading: boolean;
  syncing: boolean;
  isOnline: boolean;

  lastSync?: string;

  cloudSyncEnabled: boolean;
  setCloudSyncEnabled: (val: boolean) => Promise<void>;

  autoSync: boolean;
  setAutoSync: (val: boolean) => Promise<void>;

  addTask: (title: string) => void;
  toggleTask: (localId: string) => void;
  deleteTask: (localId: string) => void;
  clearCompleted: () => void;

  syncNow: () => Promise<void>;
};

const Ctx = createContext<TaskCtx | null>(null);

function nowISO() {
  return new Date().toISOString();
}

function makeLocalId() {
  return Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<string | undefined>(undefined);

  // ✅ Cloud ON/OFF
  const [cloudSyncEnabled, setCloudSyncEnabledState] = useState(true);

  // ✅ Auto-sync starter OFF som default (for stabilitet)
  const [autoSync, setAutoSyncState] = useState(false);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleTasks = useMemo(() => tasks.filter(t => !t.deleted), [tasks]);

  // Online/offline status
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsub();
  }, []);

  // Init: load local tasks + meta
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const [local, meta] = await Promise.all([loadTasks(), loadMeta()]);
        setTasks(local);

        setLastSync(meta.lastSync);
        setCloudSyncEnabledState(meta.cloudSyncEnabled ?? true);

        // ✅ autoSync default = false hvis der ikke er gemt noget
        setAutoSyncState(meta.autoSync ?? false);

        // Kun auto-sync hvis alt er “sikkert”
        const net = await NetInfo.fetch();
        const cloudOn = meta.cloudSyncEnabled ?? true;
        const autoOn = meta.autoSync ?? false;

        if (cloudOn && autoOn && net.isConnected) {
          await syncNowInternal(local, true);
        }
      } catch (e: any) {
        Alert.alert('Fejl', e?.message ?? 'Ukendt fejl');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist(next: LocalTask[]) {
    setTasks(next);
    await saveTasks(next);
  }

  function queueAutoSync() {
    if (!autoSync) return;
    if (!isOnline) return;
    if (!cloudSyncEnabled) return;

    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncNow();
    }, 700);
  }

  function addTask(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;

    const t: LocalTask = {
      localId: makeLocalId(),
      title: trimmed,
      is_completed: false,
      updated_at: nowISO(),
      synced: false,
    };

    const next = [t, ...tasks];
    persist(next);
    queueAutoSync();
  }

  function toggleTask(localId: string) {
    const next = tasks.map(t => {
      if (t.localId !== localId) return t;
      return { ...t, is_completed: !t.is_completed, updated_at: nowISO(), synced: false };
    });
    persist(next);
    queueAutoSync();
  }

  function deleteTask(localId: string) {
    const next = tasks.map(t => {
      if (t.localId !== localId) return t;

      // aldrig synced => bare markér deleted
      if (!t.remoteId) return { ...t, deleted: true };

      // remote findes => tombstone så den kan slettes ved sync
      return { ...t, deleted: true, synced: false, updated_at: nowISO() };
    });
    persist(next);
    queueAutoSync();
  }

  function clearCompleted() {
    const next: LocalTask[] = [];

    for (const t of tasks) {
      if (t.deleted) {
        next.push(t);
        continue;
      }

      if (!t.is_completed) {
        next.push(t);
        continue;
      }

      // completed:
      if (!t.remoteId) {
        // aldrig synced => drop helt lokalt
        continue;
      }

      next.push({ ...t, deleted: true, synced: false, updated_at: nowISO() });
    }

    persist(next);
    queueAutoSync();
  }

  // ✅ Cloud-sync ON/OFF
  async function setCloudSyncEnabled(val: boolean) {
    setCloudSyncEnabledState(val);

    // Hvis cloud slås fra: slå auto-sync fra med det samme
    if (!val) {
      setAutoSyncState(false);
    }

    const currentMeta = await loadMeta();
    await saveMeta({
      ...currentMeta,
      cloudSyncEnabled: val,
      autoSync: val ? autoSync : false,
      lastSync,
    });

    // Hvis man tænder cloud igen: sync kun hvis auto-sync er ON
    if (val && isOnline && autoSync) {
      await syncNow();
    }
  }

  // ✅ Auto-sync kan kun være ON hvis cloud-sync er ON
  async function setAutoSync(val: boolean) {
    if (!cloudSyncEnabled && val) {
      Alert.alert('Ikke muligt', 'Slå Cloud-sync til først.');
      return;
    }

    setAutoSyncState(val);

    const currentMeta = await loadMeta();
    await saveMeta({
      ...currentMeta,
      autoSync: val,
      lastSync,
      cloudSyncEnabled,
    });

    if (val && isOnline && cloudSyncEnabled) {
      await syncNow();
    }
  }

  async function syncNowInternal(seedLocal?: LocalTask[], silent?: boolean) {
    if (syncing) return;

    if (!cloudSyncEnabled) {
      if (!silent) Alert.alert('Cloud-sync er slået fra', 'Appen kører kun lokalt lige nu.');
      return;
    }

    if (!isOnline) {
      if (!silent) Alert.alert('Offline', 'Du er offline – kan ikke synkronisere lige nu.');
      return;
    }

    try {
      setSyncing(true);

      const pushedBase = await pushLocalChanges(seedLocal ?? tasks);
      const remote = await pullRemoteTasks();
      const merged = mergeLocalWithRemote(pushedBase, remote);

      const syncTime = nowISO();
      setLastSync(syncTime);

      const currentMeta = await loadMeta();
      await saveMeta({
        ...currentMeta,
        lastSync: syncTime,
        cloudSyncEnabled,
        autoSync,
      });

      await persist(merged);
    } catch (e: any) {
      if (!silent) Alert.alert('Sync-fejl', e?.message ?? 'Kunne ikke synkronisere');
    } finally {
      setSyncing(false);
    }
  }

  async function syncNow() {
    await syncNowInternal(undefined, false);
  }

  const value: TaskCtx = {
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

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTasks() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTasks skal bruges inde i <TaskProvider>');
  return ctx;
}
