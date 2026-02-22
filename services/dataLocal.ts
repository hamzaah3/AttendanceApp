/**
 * Local DB – AsyncStorage (no backend). Used when MongoDB env vars are not set.
 */
import dayjs from 'dayjs';
import type { User, Attendance, Holiday, CommitmentHistory, Weekday } from '@/types';
import { getItem, setItem } from '@/lib/storage';

const USERS_KEY = 'users';
const ATTENDANCE_KEY = 'attendance';
const HOLIDAYS_KEY = 'holidays';
const COMMITMENT_KEY = 'commitmentHistory';

function id(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function localGetUsers(): Promise<User[]> {
  const list = await getItem<User[]>(USERS_KEY);
  return list ?? [];
}

export async function localGetUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
  const list = await localGetUsers();
  return list.find((u) => u.firebaseUid === firebaseUid) ?? null;
}

export async function localGetUserById(idStr: string): Promise<User | null> {
  const list = await localGetUsers();
  return list.find((u) => u._id === idStr) ?? null;
}

export async function localCreateOrUpdateUser(user: Omit<User, '_id' | 'createdAt'>): Promise<User> {
  const list = await localGetUsers();
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
  const newUser: User = { ...user, _id: id(), createdAt: now };
  await setItem(USERS_KEY, [...list, newUser]);
  return newUser;
}

export async function localGetAttendanceList(): Promise<Attendance[]> {
  const list = await getItem<Attendance[]>(ATTENDANCE_KEY);
  return list ?? [];
}

export async function localGetAttendanceByUser(userId: string): Promise<Attendance[]> {
  const list = await localGetAttendanceList();
  return list.filter((a) => a.userId === userId).sort((a, b) => b.date.localeCompare(a.date));
}

export async function localGetAttendanceByUserAndDate(userId: string, date: string): Promise<Attendance | null> {
  const list = await localGetAttendanceByUser(userId);
  return list.find((a) => a.date === date) ?? null;
}

export async function localCreateAttendance(
  userId: string,
  date: string,
  checkInTime: string,
  checkOutTime?: string,
  notes?: string,
  isManual = false
): Promise<Attendance> {
  const list = await localGetAttendanceList();
  const existing = list.find((a) => a.userId === userId && a.date === date);
  if (existing) throw new Error('Attendance already exists for this date');
  const checkIn = dayjs(`${date}T${checkInTime}`);
  const checkOut = checkOutTime ? dayjs(`${date}T${checkOutTime}`) : null;
  const totalWorkedMinutes = checkOut ? Math.max(0, checkOut.diff(checkIn, 'minute')) : 0;
  const status: Attendance['status'] = checkOut ? (isManual ? 'manual' : 'complete') : 'incomplete';
  const att: Attendance = {
    _id: id(),
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
  return att;
}

export async function localUpdateAttendance(idStr: string, updates: Partial<Pick<Attendance, 'checkInTime' | 'checkOutTime' | 'notes'>>): Promise<Attendance | null> {
  const list = await localGetAttendanceList();
  const idx = list.findIndex((a) => a._id === idStr);
  if (idx === -1) return null;
  const att = list[idx];
  const date = att.date;
  const checkInTime = updates.checkInTime ?? att.checkInTime;
  const checkOutTime = updates.checkOutTime ?? att.checkOutTime;
  const checkIn = dayjs(`${date}T${checkInTime}`);
  const checkOut = checkOutTime ? dayjs(`${date}T${checkOutTime}`) : null;
  const totalWorkedMinutes = checkOut ? Math.max(0, checkOut.diff(checkIn, 'minute')) : 0;
  const status: Attendance['status'] = checkOut ? 'manual' : 'incomplete';
  const updated: Attendance = { ...att, ...updates, totalWorkedMinutes, status, isManual: true };
  list[idx] = updated;
  await setItem(ATTENDANCE_KEY, list);
  return updated;
}

export async function localDeleteAttendance(idStr: string): Promise<boolean> {
  const list = await localGetAttendanceList();
  const filtered = list.filter((a) => a._id !== idStr);
  if (filtered.length === list.length) return false;
  await setItem(ATTENDANCE_KEY, filtered);
  return true;
}

export async function localGetHolidays(userId: string): Promise<Holiday[]> {
  const list = (await getItem<Holiday[]>(HOLIDAYS_KEY)) ?? [];
  return list.filter((h) => h.userId === userId).sort((a, b) => a.date.localeCompare(b.date));
}

export async function localAddHoliday(userId: string, date: string, title: string): Promise<Holiday> {
  const list = (await getItem<Holiday[]>(HOLIDAYS_KEY)) ?? [];
  const h: Holiday = { _id: id(), userId, date, title };
  await setItem(HOLIDAYS_KEY, [...list, h]);
  return h;
}

export async function localDeleteHoliday(idStr: string): Promise<boolean> {
  const list = (await getItem<Holiday[]>(HOLIDAYS_KEY)) ?? [];
  const filtered = list.filter((h) => h._id !== idStr);
  if (filtered.length === list.length) return false;
  await setItem(HOLIDAYS_KEY, filtered);
  return true;
}

export async function localGetCommitmentHistory(userId: string): Promise<CommitmentHistory[]> {
  const list = (await getItem<CommitmentHistory[]>(COMMITMENT_KEY)) ?? [];
  return list.filter((c) => c.userId === userId).sort((a, b) => a.effectiveFromDate.localeCompare(b.effectiveFromDate));
}

export async function localAddCommitment(userId: string, hoursPerDay: number, effectiveFromDate: string): Promise<CommitmentHistory> {
  const list = (await getItem<CommitmentHistory[]>(COMMITMENT_KEY)) ?? [];
  const c: CommitmentHistory = { _id: id(), userId, hoursPerDay, effectiveFromDate };
  await setItem(COMMITMENT_KEY, [...list, c]);
  return c;
}
