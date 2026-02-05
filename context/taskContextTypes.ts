import type { LocalTask } from '../lib/tasks';

export type TaskCtx = {
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
