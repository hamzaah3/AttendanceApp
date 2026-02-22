import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@attendance_';

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + key);
}

export async function multiGet(keys: string[]): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  const prefixed = keys.map((k) => PREFIX + k);
  const pairs = await AsyncStorage.multiGet(prefixed);
  pairs.forEach(([p, raw]) => {
    const k = p.replace(PREFIX, '');
    result[k] = raw ? JSON.parse(raw) : null;
  });
  return result;
}

// Offline queue for syncing when back online
const QUEUE_KEY = 'sync_queue';
export interface QueuedAction {
  id: string;
  type: 'attendance' | 'user' | 'holiday' | 'commitment';
  payload: unknown;
  createdAt: string;
}

export async function getSyncQueue(): Promise<QueuedAction[]> {
  const q = await getItem<QueuedAction[]>(QUEUE_KEY);
  return q ?? [];
}

export async function addToSyncQueue(action: Omit<QueuedAction, 'id' | 'createdAt'>): Promise<void> {
  const queue = await getSyncQueue();
  queue.push({
    ...action,
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
  });
  await setItem(QUEUE_KEY, queue);
}

export async function clearSyncQueue(): Promise<void> {
  await setItem(QUEUE_KEY, []);
}

export async function setSyncQueue(queue: QueuedAction[]): Promise<void> {
  await setItem(QUEUE_KEY, queue);
}
