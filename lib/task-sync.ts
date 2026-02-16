import { supabase } from './supabase-client';
import type { LocalTask, RemoteTaskRow } from './task-types';

function isNewer(aISO: string, bISO: string) {
  return new Date(aISO).getTime() > new Date(bISO).getTime();
}

function formatSupabaseError(error: any) {
  if (!error) return 'Unknown error';
  const parts = [
    error.message ? `Message: ${error.message}` : null,
    error.details ? `Details: ${error.details}` : null,
    error.hint ? `Hint: ${error.hint}` : null,
    error.code ? `Code: ${error.code}` : null,
  ].filter(Boolean);
  return parts.join('\n');
}

function makeBlockedError(action: string) {
  return new Error(
    `${action} was not applied in Supabase (0 rows affected).\n` +
      `This is usually caused by RLS/policy permissions or a missing row.\n` +
      `Tip: for school projects, test with: alter table public.tasks disable row level security;`
  );
}

export async function pullRemoteTasks(): Promise<RemoteTaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,is_completed,updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.log('SUPABASE PULL ERROR:\n', formatSupabaseError(error));
    throw error;
  }

  return (data ?? []) as RemoteTaskRow[];
}

export async function pushLocalChanges(local: LocalTask[]): Promise<LocalTask[]> {
  let next = [...local];

  for (const task of local) {
    if (!task.deleted) continue;

    if (!task.remoteId) {
      next = next.filter(x => x.localId !== task.localId);
      continue;
    }

    const { data, error } = await supabase.from('tasks').delete().eq('id', task.remoteId).select('id').maybeSingle();

    if (error) {
      console.log('SUPABASE DELETE ERROR:\n', formatSupabaseError(error));
      throw error;
    }

    if (!data) {
      throw makeBlockedError('DELETE');
    }

    next = next.filter(x => x.localId !== task.localId);
  }

  for (const task of next) {
    if (task.deleted || task.synced) continue;

    if (!task.remoteId) {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ title: task.title, is_completed: task.is_completed }])
        .select('id,updated_at')
        .maybeSingle();

      if (error) {
        console.log('SUPABASE INSERT ERROR:\n', formatSupabaseError(error));
        throw error;
      }

      if (!data) {
        throw makeBlockedError('INSERT');
      }

      const remoteId = (data as any)?.id as number | undefined;
      const updatedAt = (data as any)?.updated_at as string | undefined;
      if (!remoteId) {
        throw new Error('INSERT did not complete correctly: missing id from Supabase.');
      }

      next = next.map(x =>
        x.localId === task.localId
          ? {
              ...x,
              remoteId,
              updated_at: updatedAt ?? x.updated_at,
              synced: true,
            }
          : x
      );
      continue;
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({ title: task.title, is_completed: task.is_completed })
      .eq('id', task.remoteId)
      .select('id,updated_at')
      .maybeSingle();

    if (error) {
      console.log('SUPABASE UPDATE ERROR:\n', formatSupabaseError(error));
      throw error;
    }

    if (!data) {
      throw makeBlockedError('UPDATE');
    }

    const updatedAt = (data as any)?.updated_at as string | undefined;
    next = next.map(x =>
      x.localId === task.localId
        ? {
            ...x,
            synced: true,
            updated_at: updatedAt ?? x.updated_at,
          }
        : x
    );
  }

  return next;
}

export function mergeLocalWithRemote(local: LocalTask[], remote: RemoteTaskRow[]) {
  const remoteById = new Map<number, RemoteTaskRow>();
  for (const row of remote) remoteById.set(row.id, row);

  const localByRemoteId = new Map<number, LocalTask>();
  for (const row of local) {
    if (row.remoteId) localByRemoteId.set(row.remoteId, row);
  }

  const merged: LocalTask[] = [];

  for (const localTask of local) {
    if (localTask.deleted) {
      merged.push(localTask);
      continue;
    }

    if (!localTask.remoteId) {
      merged.push(localTask);
      continue;
    }

    const remoteTask = remoteById.get(localTask.remoteId);
    if (!remoteTask) {
      if (!localTask.synced) merged.push({ ...localTask, remoteId: undefined });
      continue;
    }

    // Local unsynced changes are never overwritten by remote data.
    if (!localTask.synced) {
      merged.push(localTask);
      continue;
    }

    if (isNewer(remoteTask.updated_at, localTask.updated_at)) {
      merged.push({
        localId: localTask.localId,
        remoteId: remoteTask.id,
        title: remoteTask.title,
        priority: localTask.priority,
        due_at: localTask.due_at ?? null,
        order: localTask.order,
        is_completed: remoteTask.is_completed,
        updated_at: remoteTask.updated_at,
        synced: true,
      });
    } else {
      merged.push({ ...localTask, synced: true });
    }
  }

  for (const remoteTask of remote) {
    if (localByRemoteId.has(remoteTask.id)) continue;
    const currentMaxOrder = merged.length ? Math.max(...merged.map(task => task.order ?? 0)) : -1;
    merged.push({
      localId: `remote_${remoteTask.id}`,
      remoteId: remoteTask.id,
      title: remoteTask.title,
      priority: 'medium',
      due_at: null,
      order: currentMaxOrder + 1,
      is_completed: remoteTask.is_completed,
      updated_at: remoteTask.updated_at,
      synced: true,
    });
  }

  merged.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
  return merged;
}
