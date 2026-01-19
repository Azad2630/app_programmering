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

  // Manuel fuld sync (push + pull + merge)
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
  const tasksRef = useRef<LocalTask[]>([]);
  const [loading, setLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  // hvis der kommer nye ændringer mens vi synker, så kører vi igen bagefter
  const pendingAutoSyncRef = useRef(false);

  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<string | undefined>(undefined);

  const [cloudSyncEnabled, setCloudSyncEnabledState] = useState(true);
  const [autoSync, setAutoSyncState] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleTasks = useMemo(() => tasks.filter(t => !t.deleted), [tasks]);

  // hold ref opdateret
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // online/offline
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsub();
  }, []);

  // init
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

        // hvis auto-sync er on og vi er online => push pending ændringer ved start
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
  }, []);

  async function persist(next: LocalTask[]) {
    tasksRef.current = next;
    setTasks(next);
    await saveTasks(next);
  }

  function scheduleAutoSync() {
    if (!autoSync) return;
    if (!cloudSyncEnabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      runAutoSyncPushOnly(false).catch(() => {});
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

    const next = [t, ...tasksRef.current];
    persist(next);
    scheduleAutoSync();
  }

  function toggleTask(localId: string) {
    const next = tasksRef.current.map(t => {
      if (t.localId !== localId) return t;
      return { ...t, is_completed: !t.is_completed, updated_at: nowISO(), synced: false };
    });
    persist(next);
    scheduleAutoSync();
  }

  function deleteTask(localId: string) {
    const next = tasksRef.current.map(t => {
      if (t.localId !== localId) return t;

      // aldrig synced => fjern lokalt via deleted
      if (!t.remoteId) return { ...t, deleted: true };

      // remote => tombstone
      return { ...t, deleted: true, synced: false, updated_at: nowISO() };
    });
    persist(next);
    scheduleAutoSync();
  }

  function clearCompleted() {
    const next: LocalTask[] = [];

    for (const t of tasksRef.current) {
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
    scheduleAutoSync();
  }

  async function setCloudSyncEnabled(val: boolean) {
    setCloudSyncEnabledState(val);

    // cloud off => auto-sync off
    if (!val) setAutoSyncState(false);

    const currentMeta = await loadMeta();
    await saveMeta({
      ...currentMeta,
      cloudSyncEnabled: val,
      autoSync: val ? autoSync : false,
      lastSync,
    });
  }

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
      cloudSyncEnabled,
      lastSync,
    });

    // hvis man tænder auto-sync og er online => push nu
    if (val) {
      await runAutoSyncPushOnly(false);
    }
  }

  // ✅ Auto-sync = kun PUSH til Supabase (stabilt, overskriver ikke UI)
  async function runAutoSyncPushOnly(silent: boolean) {
    if (!cloudSyncEnabled) return;
    if (!autoSync) return;

    // check online “live” (ikke kun state)
    const net = await NetInfo.fetch();
    const onlineNow = !!net.isConnected;
    setIsOnline(onlineNow);
    if (!onlineNow) return;

    // hvis vi allerede synker, så markér at vi skal køre igen bagefter
    if (syncingRef.current) {
      pendingAutoSyncRef.current = true;
      return;
    }

    try {
      syncingRef.current = true;
      setSyncing(true);

      // snapshot af NYESTE tasks
      const snapshot = tasksRef.current;

      // push ændringer
      const pushed = await pushLocalChanges(snapshot);

      // gem lokalt (remoteId/updated_at/synced bliver opdateret)
      await persist(pushed);

      const syncTime = nowISO();
      setLastSync(syncTime);

      const currentMeta = await loadMeta();
      await saveMeta({
        ...currentMeta,
        lastSync: syncTime,
        cloudSyncEnabled,
        autoSync,
      });
    } catch (e: any) {
      if (!silent) {
        Alert.alert('Auto-sync fejl', e?.message ?? 'Kunne ikke sende til Supabase');
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);

      // hvis der kom nye ændringer under sync, kør igen
      if (pendingAutoSyncRef.current) {
        pendingAutoSyncRef.current = false;
        // kør igen straks
        await runAutoSyncPushOnly(true);
      }
    }
  }

  // ✅ Manuel fuld sync (push + pull + merge)
  async function syncNow() {
    if (!cloudSyncEnabled) {
      Alert.alert('Cloud-sync er slået fra', 'Appen kører kun lokalt lige nu.');
      return;
    }

    const net = await NetInfo.fetch();
    const onlineNow = !!net.isConnected;
    setIsOnline(onlineNow);
    if (!onlineNow) {
      Alert.alert('Offline', 'Du er offline – kan ikke synkronisere lige nu.');
      return;
    }

    if (syncingRef.current) return;

    try {
      syncingRef.current = true;
      setSyncing(true);

      const localSnapshot = tasksRef.current;

      const pushedBase = await pushLocalChanges(localSnapshot);
      const remote = await pullRemoteTasks();
      const merged = mergeLocalWithRemote(pushedBase, remote);

      await persist(merged);

      const syncTime = nowISO();
      setLastSync(syncTime);

      const currentMeta = await loadMeta();
      await saveMeta({
        ...currentMeta,
        lastSync: syncTime,
        cloudSyncEnabled,
        autoSync,
      });
    } catch (e: any) {
      Alert.alert('Sync-fejl', e?.message ?? 'Kunne ikke synkronisere');
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  // kør auto-sync når man bliver online igen
  useEffect(() => {
    if (isOnline && autoSync && cloudSyncEnabled) {
      runAutoSyncPushOnly(true).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, autoSync, cloudSyncEnabled]);

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
