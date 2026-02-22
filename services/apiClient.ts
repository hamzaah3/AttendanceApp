/**
 * Client for Expo API routes (/api/users, /api/attendance, etc.).
 * Used when EXPO_PUBLIC_API_ORIGIN is set (backend-in-Expo).
 * On device/emulator, localhost is replaced with the dev server host so requests reach your machine.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { User, Attendance, Holiday, CommitmentHistory } from '@/types';

const ORIGIN = process.env.EXPO_PUBLIC_API_ORIGIN ?? '';

function getApiBaseUrl(): string {
  const base = ORIGIN.replace(/\/$/, '');
  if (!base) return '';
  if (Platform.OS === 'web') return base;
  if (!base.includes('localhost') && !base.includes('127.0.0.1')) return base;
  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const devHost = hostUri.replace(/^exp:\/\//, '').replace(/^exp:/, '');
  if (!devHost) return base;
  const devHostIp = devHost.split(':')[0];
  try {
    const originUrl = new URL(base);
    const port = originUrl.port || (originUrl.protocol === 'https:' ? '443' : '80');
    return `${originUrl.protocol}//${devHostIp}:${port}`;
  } catch {
    return `http://${devHost}`;
  }
}

export function isApiRoutesConfigured(): boolean {
  return Boolean(ORIGIN);
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function withUserId(path: string, userId: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}userId=${encodeURIComponent(userId)}`;
}

function withHeader(headers: HeadersInit | undefined, userId: string): HeadersInit {
  return { ...(headers as Record<string, string>), 'X-User-Id': userId };
}

// --- Users ---
export async function apiGetUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
  const doc = await apiFetch<unknown>(`/api/users?firebaseUid=${encodeURIComponent(firebaseUid)}`);
  return doc as User | null;
}

export async function apiCreateOrUpdateUser(user: Omit<User, '_id' | 'createdAt'>): Promise<User> {
  return apiFetch<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
}

// --- Attendance ---
export async function apiGetAttendanceByUser(userId: string): Promise<Attendance[]> {
  return apiFetch<Attendance[]>(withUserId('/api/attendance', userId), {
    headers: withHeader(undefined, userId),
  });
}

export async function apiGetAttendanceByUserAndDate(userId: string, date: string): Promise<Attendance | null> {
  const doc = await apiFetch<unknown>(`/api/attendance?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`);
  return doc as Attendance | null;
}

export async function apiCreateAttendance(
  userId: string,
  date: string,
  checkInTime: string,
  checkOutTime?: string,
  notes?: string,
  isManual = false
): Promise<Attendance> {
  return apiFetch<Attendance>('/api/attendance', {
    method: 'POST',
    body: JSON.stringify({ userId, date, checkInTime, checkOutTime, notes, isManual }),
  });
}

export async function apiUpdateAttendance(id: string, updates: Partial<Pick<Attendance, 'checkInTime' | 'checkOutTime' | 'notes'>>): Promise<Attendance | null> {
  return apiFetch<Attendance | null>('/api/attendance', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...updates }),
  });
}

export async function apiDeleteAttendance(id: string): Promise<boolean> {
  const r = await apiFetch<{ deleted: boolean }>(`/api/attendance?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  return r.deleted;
}

// --- Holidays ---
export async function apiGetHolidays(userId: string): Promise<Holiday[]> {
  return apiFetch<Holiday[]>(withUserId('/api/holidays', userId), {
    headers: withHeader(undefined, userId),
  });
}

export async function apiAddHoliday(userId: string, date: string, title: string): Promise<Holiday> {
  return apiFetch<Holiday>('/api/holidays', {
    method: 'POST',
    body: JSON.stringify({ userId, date, title }),
  });
}

export async function apiDeleteHoliday(id: string): Promise<boolean> {
  const r = await apiFetch<{ deleted: boolean }>(`/api/holidays?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  return r.deleted;
}

// --- Commitment ---
export async function apiGetCommitmentHistory(userId: string): Promise<CommitmentHistory[]> {
  return apiFetch<CommitmentHistory[]>(withUserId('/api/commitment', userId), {
    headers: withHeader(undefined, userId),
  });
}

export async function apiAddCommitment(userId: string, hoursPerDay: number, effectiveFromDate: string): Promise<CommitmentHistory> {
  return apiFetch<CommitmentHistory>('/api/commitment', {
    method: 'POST',
    body: JSON.stringify({ userId, hoursPerDay, effectiveFromDate }),
  });
}
