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

function makeBlockedError(action: string) {
  return new Error(
    `${action} blev ikke udført i Supabase (0 rækker påvirket).\n` +
      `Det skyldes næsten altid RLS/policy (manglende tilladelser) eller at rækken ikke findes.\n` +
      `Tip: slå RLS fra i skoleprojekt: alter table public.tasks disable row level security;`
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

  // 1) Slet (tombstones)
  for (const t of local) {
    if (!t.deleted) continue;

    // Hvis den aldrig har været i cloud, kan vi bare fjerne lokalt
    if (!t.remoteId) {
      next = next.filter(x => x.localId !== t.localId);
      continue;
    }

    // Hvis den har remoteId: prøv at slette i cloud først
    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', t.remoteId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.log('SUPABASE DELETE ERROR:\n', formatSupabaseError(error));
      throw error;
    }

    // ✅ Hvis data er null, blev 0 rækker slettet (typisk RLS/policy)
    if (!data) {
      throw makeBlockedError('DELETE');
    }

    // Cloud delete lykkedes -> fjern lokalt
    next = next.filter(x => x.localId !== t.localId);
  }

  // 2) Push ændringer (insert/update)
  for (const t of next) {
    if (t.deleted) continue;
    if (t.synced) continue;

    // INSERT (send IKKE updated_at)
    if (!t.remoteId) {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ title: t.title, is_completed: t.is_completed }])
        .select('id,updated_at')
        .maybeSingle();

      if (error) {
        console.log('SUPABASE INSERT ERROR:\n', formatSupabaseError(error));
        throw error;
      }

      // ✅ Hvis data er null, blev 0 rækker indsat (typisk RLS/policy)
      if (!data) {
        throw makeBlockedError('INSERT');
      }

      const remoteId = (data as any)?.id as number | undefined;
      const updated_at = (data as any)?.updated_at as string | undefined;

      if (!remoteId) {
        throw new Error('INSERT lykkedes ikke korrekt: mangler id fra Supabase.');
      }

      next = next.map(x =>
        x.localId === t.localId
          ? {
              ...x,
              remoteId,
              // brug server updated_at for stabil merge
              updated_at: updated_at ?? x.updated_at,
              synced: true,
            }
          : x
      );

      continue;
    }

    // UPDATE (hent updated_at tilbage)
    const { data, error } = await supabase
      .from('tasks')
      .update({ title: t.title, is_completed: t.is_completed })
      .eq('id', t.remoteId)
      .select('id,updated_at')
      .maybeSingle();

    if (error) {
      console.log('SUPABASE UPDATE ERROR:\n', formatSupabaseError(error));
      throw error;
    }

    // ✅ Hvis data er null, blev 0 rækker opdateret (typisk RLS/policy)
    // og det er PRÆCIS det der giver “1 sekund og tilbage”.
    if (!data) {
      throw makeBlockedError('UPDATE');
    }

    const updated_at = (data as any)?.updated_at as string | undefined;

    next = next.map(x =>
      x.localId === t.localId
        ? {
            ...x,
            // nu er den RIGTIGT synced
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

  // A) lokale først
  for (const l of local) {
    if (l.deleted) {
      merged.push(l);
      continue;
    }

    if (!l.remoteId) {
      merged.push(l);
      continue;
    }

    const r = remoteById.get(l.remoteId);

    if (!r) {
      // Remote findes ikke længere
      // Hvis lokal ikke var synced, behold og lad den blive re-insertet senere
      if (!l.synced) merged.push({ ...l, remoteId: undefined });
      continue;
    }

    // ✅ NØGLEREGEL: lokale, ikke-synkede ændringer bliver ALDRIG overskrevet af remote
    if (!l.synced) {
      merged.push(l);
      continue;
    }

    // Hvis remote er nyere, må den overskrive
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

  // B) remote tasks som ikke findes lokalt
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

  merged.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return merged;
}
