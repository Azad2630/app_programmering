import { supabase } from './supabase';
import type { LocalTask, RemoteTaskRow } from './tasks';

function isNewer(aISO: string, bISO: string) {
  return new Date(aISO).getTime() > new Date(bISO).getTime();
}

function formatSupabaseError(e: any) {
  if (!e) return 'Ukendt fejl';
  const parts = [
    e.message ? `Message: ${e.message}` : null,
    e.details ? `Details: ${e.details}` : null,
    e.hint ? `Hint: ${e.hint}` : null,
    e.code ? `Code: ${e.code}` : null,
  ].filter(Boolean);
  return parts.join('\n');
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

  // 1) Slet (tombstones)
  for (const t of local) {
    if (!t.deleted) continue;

    // fjern lokalt uanset hvad
    next = next.filter(x => x.localId !== t.localId);

    // slet remote hvis vi har remoteId
    if (t.remoteId) {
      const { error } = await supabase.from('tasks').delete().eq('id', t.remoteId);
      if (error) {
        console.log('SUPABASE DELETE ERROR:\n', formatSupabaseError(error));
        throw error;
      }
    }
  }

  // 2) Push ændringer (insert/update)
  for (const t of next) {
    if (t.deleted) continue;
    if (t.synced) continue;

    // INSERT (vi sender IKKE updated_at ved insert)
    if (!t.remoteId) {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ title: t.title, is_completed: t.is_completed }])
        .select('id,updated_at')
        .single();

      if (error) {
        console.log('SUPABASE INSERT ERROR:\n', formatSupabaseError(error));
        throw error;
      }

      const remoteId = (data as any)?.id as number | undefined;
      const updated_at = (data as any)?.updated_at as string | undefined;

      next = next.map(x =>
        x.localId === t.localId
          ? {
              ...x,
              remoteId,
              // brug server updated_at så merge ikke “hopper”
              updated_at: updated_at ?? x.updated_at,
              synced: true,
            }
          : x
      );

      continue;
    }

    // UPDATE (hent updated_at tilbage fra server)
    const { data, error } = await supabase
      .from('tasks')
      .update({ title: t.title, is_completed: t.is_completed })
      .eq('id', t.remoteId)
      .select('updated_at')
      .single();

    if (error) {
      console.log('SUPABASE UPDATE ERROR:\n', formatSupabaseError(error));
      throw error;
    }

    const updated_at = (data as any)?.updated_at as string | undefined;

    next = next.map(x =>
      x.localId === t.localId
        ? {
            ...x,
            synced: true,
            updated_at: updated_at ?? x.updated_at,
          }
        : x
    );
  }

  return next;
}

export function mergeLocalWithRemote(local: LocalTask[], remote: RemoteTaskRow[]) {
  const remoteById = new Map<number, RemoteTaskRow>();
  for (const r of remote) remoteById.set(r.id, r);

  const localByRemoteId = new Map<number, LocalTask>();
  for (const l of local) if (l.remoteId) localByRemoteId.set(l.remoteId, l);

  const merged: LocalTask[] = [];

  // A) Gå lokale igennem først
  for (const l of local) {
    // tombstone: behold så den kan push-slettes næste gang
    if (l.deleted) {
      merged.push(l);
      continue;
    }

    // kun lokal (har ikke remoteId endnu)
    if (!l.remoteId) {
      merged.push(l);
      continue;
    }

    const r = remoteById.get(l.remoteId);

    // Remote findes ikke længere
    if (!r) {
      // hvis lokal ikke var synket, så behold og lad den re-insertes
      if (!l.synced) merged.push({ ...l, remoteId: undefined });
      // hvis den var synced og remote er væk => drop
      continue;
    }

    // ✅ NØGLEREGEL: lokale, ikke-synkede ændringer bliver ALDRIG overskrevet af remote
    if (!l.synced) {
      merged.push(l);
      continue;
    }

    // Ellers: remote må overskrive hvis den er nyere
    if (isNewer(r.updated_at, l.updated_at)) {
      merged.push({
        localId: l.localId,
        remoteId: r.id,
        title: r.title,
        is_completed: r.is_completed,
        updated_at: r.updated_at,
        synced: true,
      });
    } else {
      merged.push({ ...l, synced: true });
    }
  }

  // B) Tilføj remote tasks som ikke findes lokalt
  for (const r of remote) {
    if (localByRemoteId.has(r.id)) continue;

    merged.push({
      localId: `remote_${r.id}`,
      remoteId: r.id,
      title: r.title,
      is_completed: r.is_completed,
      updated_at: r.updated_at,
      synced: true,
    });
  }

  // sortér nyeste først
  merged.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return merged;
}
