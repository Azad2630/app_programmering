export type TaskPriority = 'low' | 'medium' | 'high';

export type LocalTask = {
  localId: string;
  remoteId?: number;
  title: string;
  priority: TaskPriority;
  due_at?: string | null;
  order: number;
  is_completed: boolean;
  updated_at: string;
  synced: boolean;
  deleted?: boolean;
};

export type RemoteTaskRow = {
  id: number;
  title: string;
  is_completed: boolean;
  updated_at: string;
};

export function normalizeLocalTasks(tasks: LocalTask[]): LocalTask[] {
  return tasks.map((task, index) => ({
    ...task,
    priority: task.priority ?? 'medium',
    due_at: task.due_at ?? null,
    order: typeof task.order === 'number' ? task.order : index,
  }));
}

