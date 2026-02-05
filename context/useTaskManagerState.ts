import NetInfo from '@react-native-community/netinfo';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { LocalTask } from '../lib/tasks';

export function useTaskManagerState() {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const tasksRef = useRef<LocalTask[]>([]);
  const [loading, setLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const pendingAutoSyncRef = useRef(false);

  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<string | undefined>(undefined);
  const lastSyncRef = useRef<string | undefined>(undefined);

  const [cloudSyncEnabled, setCloudSyncEnabledState] = useState(true);
  const cloudSyncEnabledRef = useRef(true);

  const [autoSync, setAutoSyncState] = useState(false);
  const autoSyncRef = useRef(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleTasks = useMemo(() => tasks.filter(task => !task.deleted), [tasks]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    lastSyncRef.current = lastSync;
  }, [lastSync]);

  useEffect(() => {
    cloudSyncEnabledRef.current = cloudSyncEnabled;
  }, [cloudSyncEnabled]);

  useEffect(() => {
    autoSyncRef.current = autoSync;
  }, [autoSync]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsub();
  }, []);

  return {
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
  };
}
