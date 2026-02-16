import type { LocalTask, TaskPriority } from '../lib/task-types';

type CreateTaskCrudHandlersArgs = {
  getTasks: () => LocalTask[];
  persist: (next: LocalTask[]) => Promise<void>;
  scheduleAutoSync: (delayMs?: number) => void;
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
  function getNextOrder(tasks: LocalTask[]) {
    if (!tasks.length) return 0;
    return Math.max(...tasks.map(task => task.order ?? 0)) + 1;
  }

  function addTask(title: string, options?: { priority?: TaskPriority; dueAt?: string | null }) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const current = getTasks();

    const task: LocalTask = {
      localId: makeLocalId(),
      title: trimmed,
      priority: options?.priority ?? 'medium',
      due_at: options?.dueAt ?? null,
      order: getNextOrder(current),
      is_completed: false,
      updated_at: nowISO(),
      synced: false,
    };

    const next = [...current, task];
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

  function updateTask(localId: string, updates: { title?: string; priority?: TaskPriority; dueAt?: string | null }) {
    const next = getTasks().map(task => {
      if (task.localId !== localId) return task;

      const nextTitle = updates.title !== undefined ? updates.title.trim() : task.title;
      if (!nextTitle) return task;

      const nextPriority = updates.priority ?? task.priority;
      const nextDueAt = updates.dueAt !== undefined ? updates.dueAt : (task.due_at ?? null);

      if (task.title === nextTitle && task.priority === nextPriority && (task.due_at ?? null) === nextDueAt) {
        return task;
      }

      return {
        ...task,
        title: nextTitle,
        priority: nextPriority,
        due_at: nextDueAt,
        updated_at: nowISO(),
        synced: false,
      };
    });

    persist(next);
    scheduleAutoSync();
  }

  function deleteTask(localId: string) {
    const next = getTasks().map(task => {
      if (task.localId !== localId) return task;
      if (!task.remoteId) return { ...task, deleted: true, updated_at: nowISO(), synced: false };
      return { ...task, deleted: true, synced: false, updated_at: nowISO() };
    });
    persist(next);
    // Give undo-delete UI a short grace period before auto sync deletes remotely.
    scheduleAutoSync(5000);
  }

  function restoreTask(localId: string) {
    const next = getTasks().map(task => {
      if (task.localId !== localId) return task;
      if (!task.deleted) return task;
      return { ...task, deleted: false, synced: false, updated_at: nowISO() };
    });
    persist(next);
    scheduleAutoSync();
  }

  function reorderVisibleTasks(orderedVisibleIds: string[]) {
    const tasks = getTasks();
    const visibleSet = new Set(orderedVisibleIds);
    const visibleTasks = tasks.filter(task => !task.deleted && visibleSet.has(task.localId));
    if (visibleTasks.length !== orderedVisibleIds.length) return;

    const orderById = new Map<string, number>();
    orderedVisibleIds.forEach((id, index) => orderById.set(id, index));

    const next = tasks.map(task => {
      if (task.deleted) return task;
      const nextOrder = orderById.get(task.localId);
      if (nextOrder === undefined) return task;
      return { ...task, order: nextOrder, synced: false, updated_at: nowISO() };
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
    updateTask,
    toggleTask,
    deleteTask,
    restoreTask,
    reorderVisibleTasks,
    clearCompleted,
  };
}
