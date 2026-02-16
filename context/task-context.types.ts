import type { LocalTask, TaskPriority } from '../lib/task-types';

export type CloudSyncStatus = 'unknown' | 'connected' | 'unavailable' | 'disabled';

export type TaskCtx = {
  tasks: LocalTask[];
  visibleTasks: LocalTask[];
  loading: boolean;
  syncing: boolean;
  isOnline: boolean;
  cloudStatus: CloudSyncStatus;
  lastSyncError?: string;
  lastSync?: string;
  cloudSyncEnabled: boolean;
  setCloudSyncEnabled: (val: boolean) => Promise<void>;
  autoSync: boolean;
  setAutoSync: (val: boolean) => Promise<void>;
  addTask: (title: string, options?: { priority?: TaskPriority; dueAt?: string | null }) => void;
  updateTask: (localId: string, updates: { title?: string; priority?: TaskPriority; dueAt?: string | null }) => void;
  toggleTask: (localId: string) => void;
  deleteTask: (localId: string) => void;
  restoreTask: (localId: string) => void;
  reorderVisibleTasks: (orderedVisibleIds: string[]) => void;
  clearCompleted: () => void;
  resetLocalData: () => Promise<void>;
  syncNow: () => Promise<void>;
};
