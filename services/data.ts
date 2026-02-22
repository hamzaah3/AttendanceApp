import dayjs from 'dayjs';
import type { User, Attendance, Holiday, CommitmentHistory, Weekday } from '@/types';
import { getItem, setItem, getSyncQueue, addToSyncQueue, setSyncQueue } from '@/lib/storage';
import type { QueuedAction } from '@/lib/storage';
import { isApiRoutesConfigured } from './apiClient';
import * as api from './apiClient';

function isLikelyNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /network|fetch|failed to load|timeout|offline/i.test(msg);
}

const USERS_KEY = 'users';
const ATTENDANCE_KEY = 'attendance';
const HOLIDAYS_KEY = 'holidays';
const COMMITMENT_KEY = 'commitmentHistory';

function id(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const useApi = () => isApiRoutesConfigured();

// --- Users ---
export async function getUsers(): Promise<User[]> {
  if (useApi()) return [];
  const list = await getItem<User[]>(USERS_KEY);
  return list ?? [];
}

export async function getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
  if (useApi()) return api.apiGetUserByFirebaseUid(firebaseUid);
  const list = await getUsers();
  return list.find((u) => u.firebaseUid === firebaseUid) ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const list = await getUsers();
  return list.find((u) => u._id === id) ?? null;
}

export async function createOrUpdateUser(user: Omit<User, '_id' | 'createdAt'>): Promise<User> {
  if (useApi()) return api.apiCreateOrUpdateUser(user);
  const list = await getUsers();
  const existing = list.find((u) => u.firebaseUid === user.firebaseUid);
  const now = dayjs().toISOString();
  if (existing) {
    const updated: User = {
      ...existing,
      name: user.name,
      email: user.email,
      committedHoursPerDay: user.committedHoursPerDay,
      weeklyOffDays: user.weeklyOffDays,
      timezone: user.timezone,
    };
    await setItem(USERS_KEY, list.map((u) => (u._id === existing._id ? updated : u)));
    return updated;
  }
  const newUser: User = {
    ...user,
    _id: id(),
    createdAt: now,
  };
  await setItem(USERS_KEY, [...list, newUser]);
  return newUser;
}

// --- Attendance ---
export async function getAttendanceList(): Promise<Attendance[]> {
  const list = await getItem<Attendance[]>(ATTENDANCE_KEY);
  return list ?? [];
}

export async function getAttendanceByUser(userId: string): Promise<Attendance[]> {
  if (!useApi()) {
    const list = await getAttendanceList();
    return list.filter((a) => a.userId === userId).sort((a, b) => b.date.localeCompare(a.date));
  }
  try {
    const serverList = await api.apiGetAttendanceByUser(userId);
    const queue = await getSyncQueue();
    const localList = (await getItem<Attendance[]>(ATTENDANCE_KEY)) ?? [];
    const unsyncedLocalIds = new Set(
      queue.filter((q) => q.type === 'attendance' && (q.payload as { localId?: string })?.localId).map((q) => (q.payload as { localId: string }).localId)
    );
    const unsynced = localList.filter((a) => a.userId === userId && unsyncedLocalIds.has(a._id));
    const merged = [...serverList];
    for (const u of unsynced) {
      if (!merged.some((m) => m.date === u.date)) merged.push(u);
    }
    const otherUsers = localList.filter((a) => a.userId !== userId);
    await setItem(ATTENDANCE_KEY, [...otherUsers, ...merged]);
    return merged.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    const list = await getAttendanceList();
    return list.filter((a) => a.userId === userId).sort((a, b) => b.date.localeCompare(a.date));
  }
}

/** Returns all sessions for the given user and date (multiple check-in/out per day). */
export async function getAttendancesByUserAndDate(userId: string, date: string): Promise<Attendance[]> {
  if (!useApi()) {
    const list = await getAttendanceByUser(userId);
    return list.filter((a) => a.date === date).sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));
  }
  try {
    const list = await api.apiGetAttendancesByUserAndDate(userId, date);
    const localList = (await getItem<Attendance[]>(ATTENDANCE_KEY)) ?? [];
    const next = localList.filter((a) => !(a.userId === userId && a.date === date));
    await setItem(ATTENDANCE_KEY, [...next, ...list]);
    return list;
  } catch {
    const list = await getAttendanceList();
    return list.filter((a) => a.userId === userId && a.date === date).sort((a, b) => a.checkInTime.localeCompare(b.checkInTime));
  }
}

export async function createAttendance(
  userId: string,
  date: string,
  checkInTime: string,
  checkOutTime?: string,
  notes?: string,
  isManual = false
): Promise<Attendance> {
  const checkIn = dayjs(`${date}T${checkInTime}`);
  const checkOut = checkOutTime ? dayjs(`${date}T${checkOutTime}`) : null;
  const totalWorkedMinutes = checkOut ? Math.max(0, checkOut.diff(checkIn, 'minute')) : 0;
  const status: Attendance['status'] = checkOut ? (isManual ? 'manual' : 'complete') : 'incomplete';

  if (useApi()) {
    try {
      const att = await api.apiCreateAttendance(userId, date, checkInTime, checkOutTime, notes, isManual);
      const list = (await getItem<Attendance[]>(ATTENDANCE_KEY)) ?? [];
      await setItem(ATTENDANCE_KEY, [...list, att]);
      return att;
    } catch (e) {
      if (!isLikelyNetworkError(e)) throw e;
    }
  }

  const list = await getAttendanceList();

  const localId = id();
  const att: Attendance = {
    _id: localId,
    userId,
    date,
    checkInTime,
    checkOutTime: checkOutTime ?? undefined,
    totalWorkedMinutes,
    status,
    notes,
    isManual,
    createdAt: dayjs().toISOString(),
  };
  await setItem(ATTENDANCE_KEY, [...list, att]);
  if (useApi()) {
    await addToSyncQueue({
      type: 'attendance',
      payload: { action: 'create', localId, userId, date, checkInTime, checkOutTime, notes, isManual },
    });
  }
  return att;
}

export async function updateAttendance(
  id: string,
  updates: Partial<Pick<Attendance, 'checkInTime' | 'checkOutTime' | 'notes' | 'isManual'>>
): Promise<Attendance | null> {
  const list = await getAttendanceList();
  const idx = list.findIndex((a) => a._id === id);
  if (idx === -1) return null;
  const att = list[idx];
  const date = att.date;
  const checkInTime = updates.checkInTime ?? att.checkInTime;
  const checkOutTime = updates.checkOutTime ?? att.checkOutTime;
  const checkIn = dayjs(`${date}T${checkInTime}`);
  const checkOut = checkOutTime ? dayjs(`${date}T${checkOutTime}`) : null;
  const totalWorkedMinutes = checkOut ? Math.max(0, checkOut.diff(checkIn, 'minute')) : 0;
  const status: Attendance['status'] = checkOut ? 'manual' : 'incomplete';
  const updated: Attendance = {
    ...att,
    ...updates,
    totalWorkedMinutes,
    status,
    isManual: updates.isManual ?? att.isManual,
  };

  if (useApi()) {
    try {
      const result = await api.apiUpdateAttendance(id, updates);
      list[idx] = result ?? updated;
      await setItem(ATTENDANCE_KEY, list);
      return result ?? updated;
    } catch (e) {
      if (!isLikelyNetworkError(e)) throw e;
    }
  }

  list[idx] = updated;
  await setItem(ATTENDANCE_KEY, list);
  if (useApi()) {
    await addToSyncQueue({
      type: 'attendance',
      payload: { action: 'update', id, updates },
    });
  }
  return updated;
}

export async function deleteAttendance(id: string): Promise<boolean> {
  if (useApi()) return api.apiDeleteAttendance(id);
  const list = await getAttendanceList();
  const filtered = list.filter((a) => a._id !== id);
  if (filtered.length === list.length) return false;
  await setItem(ATTENDANCE_KEY, filtered);
  return true;
}

// --- Holidays ---
export async function getHolidays(userId: string): Promise<Holiday[]> {
  if (useApi()) return api.apiGetHolidays(userId);
  const list = await getItem<Holiday[]>(HOLIDAYS_KEY);
  const all = list ?? [];
  return all.filter((h) => h.userId === userId).sort((a, b) => a.date.localeCompare(b.date));
}

export async function addHoliday(userId: string, date: string, title: string): Promise<Holiday> {
  if (useApi()) return api.apiAddHoliday(userId, date, title);
  const list = (await getItem<Holiday[]>(HOLIDAYS_KEY)) ?? [];
  const h: Holiday = { _id: id(), userId, date, title };
  await setItem(HOLIDAYS_KEY, [...list, h]);
  return h;
}

export async function deleteHoliday(id: string): Promise<boolean> {
  if (useApi()) return api.apiDeleteHoliday(id);
  const list = (await getItem<Holiday[]>(HOLIDAYS_KEY)) ?? [];
  const filtered = list.filter((h) => h._id !== id);
  if (filtered.length === list.length) return false;
  await setItem(HOLIDAYS_KEY, filtered);
  return true;
}

// --- Commitment history ---
export async function getCommitmentHistory(userId: string): Promise<CommitmentHistory[]> {
  if (useApi()) return api.apiGetCommitmentHistory(userId);
  const list = (await getItem<CommitmentHistory[]>(COMMITMENT_KEY)) ?? [];
  return list.filter((c) => c.userId === userId).sort((a, b) => a.effectiveFromDate.localeCompare(b.effectiveFromDate));
}

export async function addCommitment(userId: string, hoursPerDay: number, effectiveFromDate: string): Promise<CommitmentHistory> {
  if (useApi()) return api.apiAddCommitment(userId, hoursPerDay, effectiveFromDate);
  const list = (await getItem<CommitmentHistory[]>(COMMITMENT_KEY)) ?? [];
  const c: CommitmentHistory = { _id: id(), userId, hoursPerDay, effectiveFromDate };
  await setItem(COMMITMENT_KEY, [...list, c]);
  return c;
}

// --- Committed hours for a date (considering history and off/holiday) ---
export function getCommittedMinutesForDate(
  user: User,
  date: string,
  holidays: Holiday[],
  commitmentHistory: CommitmentHistory[]
): number {
  const weekdays: Weekday[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = dayjs(date);
  const dayName = weekdays[d.day()];
  if (user.weeklyOffDays.includes(dayName)) return 0;
  if (holidays.some((h) => h.date === date)) return 0;
  const sorted = [...commitmentHistory].sort((a, b) => b.effectiveFromDate.localeCompare(a.effectiveFromDate));
  const effective = sorted.find((c) => c.effectiveFromDate <= date);
  const hours = effective ? effective.hoursPerDay : user.committedHoursPerDay;
  return hours * 60;
}

// --- Offline sync: process queued actions when back online ---
export async function processSyncQueue(): Promise<void> {
  if (!useApi()) return;
  const queue = await getSyncQueue();
  if (queue.length === 0) return;
  const localList = (await getItem<Attendance[]>(ATTENDANCE_KEY)) ?? [];
  let list = [...localList];
  const remaining: QueuedAction[] = [];
  const localToServer: Record<string, string> = {};

  for (const item of queue) {
    if (item.type !== 'attendance') {
      remaining.push(item);
      continue;
    }
    const payload = item.payload as { action: string; localId?: string; id?: string; userId?: string; date?: string; checkInTime?: string; checkOutTime?: string; notes?: string; isManual?: boolean; updates?: Partial<Pick<Attendance, 'checkInTime' | 'checkOutTime' | 'notes'>> };
    try {
      if (payload.action === 'create' && payload.localId && payload.userId && payload.date && payload.checkInTime !== undefined) {
        const att = await api.apiCreateAttendance(
          payload.userId,
          payload.date,
          payload.checkInTime,
          payload.checkOutTime,
          payload.notes,
          payload.isManual ?? false
        );
        localToServer[payload.localId] = att._id;
        const idx = list.findIndex((a) => a._id === payload.localId);
        if (idx >= 0) list[idx] = att;
        else list.push(att);
      } else if (payload.action === 'update' && payload.id && payload.updates) {
        const recordId = localToServer[payload.id] ?? payload.id;
        const record = list.find((a) => a._id === recordId || a._id === payload.id);
        if (record) {
          const updated = await api.apiUpdateAttendance(record._id, payload.updates);
          if (updated) {
            const i = list.findIndex((a) => a._id === record._id);
            if (i >= 0) list[i] = updated;
          }
        }
      }
    } catch {
      remaining.push(item);
    }
  }

  await setItem(ATTENDANCE_KEY, list);
  await setSyncQueue(remaining);
}
