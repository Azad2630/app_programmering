import type { LocalTask } from '../lib/tasks';

type CreateTaskCrudHandlersArgs = {
  getTasks: () => LocalTask[];
  persist: (next: LocalTask[]) => Promise<void>;
  scheduleAutoSync: () => void;
  makeLocalId: () => string;
  nowISO: () => string;
};

export function createTaskCrudHandlers({
  getTasks,
  persist,
  scheduleAutoSync,
  makeLocalId,
  nowISO,
}: CreateTaskCrudHandlersArgs) {
  function addTask(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;

    const task: LocalTask = {
      localId: makeLocalId(),
      title: trimmed,
      is_completed: false,
      updated_at: nowISO(),
      synced: false,
    };

    const next = [task, ...getTasks()];
    persist(next);
    scheduleAutoSync();
  }

  function toggleTask(localId: string) {
    const next = getTasks().map(task => {
      if (task.localId !== localId) return task;
      return { ...task, is_completed: !task.is_completed, updated_at: nowISO(), synced: false };
    });
    persist(next);
    scheduleAutoSync();
  }

  function deleteTask(localId: string) {
    const next = getTasks().map(task => {
      if (task.localId !== localId) return task;
      if (!task.remoteId) return { ...task, deleted: true };
      return { ...task, deleted: true, synced: false, updated_at: nowISO() };
    });
    persist(next);
    scheduleAutoSync();
  }

  function clearCompleted() {
    const next: LocalTask[] = [];

    for (const task of getTasks()) {
      if (task.deleted) {
        next.push(task);
        continue;
      }

      if (!task.is_completed) {
        next.push(task);
        continue;
      }

      if (!task.remoteId) {
        continue;
      }

      next.push({ ...task, deleted: true, synced: false, updated_at: nowISO() });
    }

    persist(next);
    scheduleAutoSync();
  }

  return {
    addTask,
    toggleTask,
    deleteTask,
    clearCompleted,
  };
}
