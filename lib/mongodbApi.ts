/**
 * MongoDB Atlas Data API client – runs inside the Expo app (no separate backend).
 * Set EXPO_PUBLIC_MONGODB_DATA_API_URL and EXPO_PUBLIC_MONGODB_DATA_API_KEY in .env for live DB.
 */

const DATA_API_URL = process.env.EXPO_PUBLIC_MONGODB_DATA_API_URL?.replace(/\/$/, '');
const API_KEY = process.env.EXPO_PUBLIC_MONGODB_DATA_API_KEY;
const DATA_SOURCE = process.env.EXPO_PUBLIC_MONGODB_DATA_SOURCE ?? 'Cluster0';
const DATABASE = process.env.EXPO_PUBLIC_MONGODB_DATABASE ?? 'attendance';

export function isMongoDbConfigured(): boolean {
  return Boolean(DATA_API_URL && API_KEY);
}

async function dataApiAction<T>(action: string, body: Record<string, unknown>): Promise<T> {
  if (!DATA_API_URL || !API_KEY) throw new Error('MongoDB Data API not configured');
  const url = `${DATA_API_URL}/action/${action}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api-key': API_KEY,
    },
    body: JSON.stringify({
      dataSource: DATA_SOURCE,
      database: DATABASE,
      ...body,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MongoDB Data API: ${res.status} ${err}`);
  }
  return res.json() as Promise<T>;
}

const COLLECTIONS = {
  users: 'users',
  attendance: 'attendance',
  holidays: 'holidays',
  commitmentHistory: 'commitmentHistory',
} as const;

// --- Users ---
export async function mongoGetUsers(): Promise<{ document: { _id: string; firebaseUid: string; name: string; email: string; committedHoursPerDay: number; weeklyOffDays: string[]; timezone: string; createdAt: string } }[]> {
  const r = await dataApiAction<{ documents: unknown[] }>('find', { collection: COLLECTIONS.users, filter: {} });
  return (r.documents ?? []) as { document: { _id: string; firebaseUid: string; name: string; email: string; committedHoursPerDay: number; weeklyOffDays: string[]; timezone: string; createdAt: string } }[];
}

export async function mongoGetUserByFirebaseUid(firebaseUid: string) {
  const r = await dataApiAction<{ document: unknown }>('findOne', { collection: COLLECTIONS.users, filter: { firebaseUid } });
  return r.document ?? null;
}

export async function mongoCreateOrUpdateUser(doc: { firebaseUid: string; name: string; email: string; committedHoursPerDay: number; weeklyOffDays: string[]; timezone: string }) {
  const existing = await mongoGetUserByFirebaseUid(doc.firebaseUid);
  const now = new Date().toISOString();
  if (existing && typeof existing === 'object' && '_id' in existing) {
    const id = (existing as { _id: string })._id;
    await dataApiAction('updateOne', {
      collection: COLLECTIONS.users,
      filter: { _id: { $oid: id } },
      update: { $set: { name: doc.name, email: doc.email, committedHoursPerDay: doc.committedHoursPerDay, weeklyOffDays: doc.weeklyOffDays, timezone: doc.timezone } },
    });
    return { ...existing, ...doc, _id: id, createdAt: (existing as { createdAt?: string }).createdAt ?? now } as { _id: string; firebaseUid: string; name: string; email: string; committedHoursPerDay: number; weeklyOffDays: string[]; timezone: string; createdAt: string };
  }
  const insert = await dataApiAction<{ insertedId: string }>('insertOne', {
    collection: COLLECTIONS.users,
    document: { ...doc, createdAt: now },
  });
  return { ...doc, _id: insert.insertedId, createdAt: now } as { _id: string; firebaseUid: string; name: string; email: string; committedHoursPerDay: number; weeklyOffDays: string[]; timezone: string; createdAt: string };
}

// --- Attendance ---
export async function mongoGetAttendanceByUser(userId: string) {
  const r = await dataApiAction<{ documents: unknown[] }>('find', { collection: COLLECTIONS.attendance, filter: { userId }, sort: { date: -1 } });
  return (r.documents ?? []) as { _id: string; userId: string; date: string; checkInTime: string; checkOutTime?: string; totalWorkedMinutes: number; status: string; notes?: string; isManual?: boolean; createdAt?: string }[];
}

export async function mongoGetAttendanceByUserAndDate(userId: string, date: string) {
  const r = await dataApiAction<{ document: unknown }>('findOne', { collection: COLLECTIONS.attendance, filter: { userId, date } });
  return r.document ?? null;
}

export async function mongoCreateAttendance(doc: { userId: string; date: string; checkInTime: string; checkOutTime?: string; totalWorkedMinutes: number; status: string; notes?: string; isManual?: boolean; createdAt: string }) {
  const r = await dataApiAction<{ insertedId: string }>('insertOne', { collection: COLLECTIONS.attendance, document: doc });
  return { ...doc, _id: r.insertedId } as { _id: string; userId: string; date: string; checkInTime: string; checkOutTime?: string; totalWorkedMinutes: number; status: string; notes?: string; isManual?: boolean; createdAt: string };
}

export async function mongoFindAttendanceById(id: string) {
  const r = await dataApiAction<{ document: unknown }>('findOne', { collection: COLLECTIONS.attendance, filter: { _id: { $oid: id } } });
  return r.document ?? null;
}

export async function mongoUpdateAttendance(id: string, update: Record<string, unknown>) {
  await dataApiAction('updateOne', {
    collection: COLLECTIONS.attendance,
    filter: { _id: { $oid: id } },
    update: { $set: update },
  });
}

export async function mongoDeleteAttendance(id: string) {
  const r = await dataApiAction<{ deletedCount: number }>('deleteOne', { collection: COLLECTIONS.attendance, filter: { _id: { $oid: id } } });
  return r.deletedCount === 1;
}

// --- Holidays ---
export async function mongoGetHolidays(userId: string) {
  const r = await dataApiAction<{ documents: unknown[] }>('find', { collection: COLLECTIONS.holidays, filter: { userId }, sort: { date: 1 } });
  return (r.documents ?? []) as { _id: string; userId: string; date: string; title: string }[];
}

export async function mongoAddHoliday(doc: { userId: string; date: string; title: string }) {
  const r = await dataApiAction<{ insertedId: string }>('insertOne', { collection: COLLECTIONS.holidays, document: doc });
  return { ...doc, _id: r.insertedId } as { _id: string; userId: string; date: string; title: string };
}

export async function mongoDeleteHoliday(id: string) {
  const r = await dataApiAction<{ deletedCount: number }>('deleteOne', { collection: COLLECTIONS.holidays, filter: { _id: { $oid: id } } });
  return r.deletedCount === 1;
}

// --- Commitment history ---
export async function mongoGetCommitmentHistory(userId: string) {
  const r = await dataApiAction<{ documents: unknown[] }>('find', { collection: COLLECTIONS.commitmentHistory, filter: { userId }, sort: { effectiveFromDate: 1 } });
  return (r.documents ?? []) as { _id: string; userId: string; hoursPerDay: number; effectiveFromDate: string }[];
}

export async function mongoAddCommitment(doc: { userId: string; hoursPerDay: number; effectiveFromDate: string }) {
  const r = await dataApiAction<{ insertedId: string }>('insertOne', { collection: COLLECTIONS.commitmentHistory, document: doc });
  return { ...doc, _id: r.insertedId } as { _id: string; userId: string; hoursPerDay: number; effectiveFromDate: string };
}
