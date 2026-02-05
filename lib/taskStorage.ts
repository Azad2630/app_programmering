import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocalTask } from './tasks';

const TASKS_KEY = 'dtm_tasks_v1';
const META_KEY = 'dtm_meta_v1';

type Meta = {
  lastSync?: string;
  autoSync?: boolean;
  userName?: string;
  cloudSyncEnabled?: boolean;
};

export async function loadTasks(): Promise<LocalTask[]> {
  const raw = await AsyncStorage.getItem(TASKS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LocalTask[];
  } catch {
    return [];
  }
}

export async function saveTasks(tasks: LocalTask[]): Promise<void> {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export async function loadMeta(): Promise<Meta> {
  const raw = await AsyncStorage.getItem(META_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Meta;
  } catch {
    return {};
  }
}

export async function saveMeta(meta: Meta): Promise<void> {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

export async function resetAllLocalData(): Promise<void> {
  await AsyncStorage.multiRemove([TASKS_KEY, META_KEY]);
}

