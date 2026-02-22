/**
 * Server-only: MongoDB via connection string (used by Expo API routes).
 * Set MONGODB_URI in server env (e.g. from Atlas Connect → Drivers).
 */
import { MongoClient, ObjectId } from 'mongodb';

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DATABASE ?? 'attendance';

let client: MongoClient | null = null;

async function getDb() {
  if (!URI) throw new Error('MONGODB_URI is not set');
  if (!client) {
    client = new MongoClient(URI);
    await client.connect();
  }
  return client.db(DB_NAME);
}

function toDoc<T extends { _id?: unknown }>(d: T | null): (Omit<T, '_id'> & { _id: string }) | null {
  if (!d) return null;
  const id = d._id != null && typeof (d._id as { toString?: () => string }).toString === 'function'
    ? (d._id as { toString: () => string }).toString()
    : String(d._id);
  return { ...d, _id: id } as Omit<T, '_id'> & { _id: string };
}

function toDocs<T extends { _id?: unknown }>(arr: T[]): (Omit<T, '_id'> & { _id: string })[] {
  return arr.map((d) => toDoc(d)!).filter(Boolean);
}

// --- Users ---
export async function mongoGetUserByFirebaseUid(firebaseUid: string) {
  const db = await getDb();
  const doc = await db.collection('users').findOne({ firebaseUid });
  return toDoc(doc);
}

export async function mongoCreateOrUpdateUser(doc: {
  firebaseUid: string;
  name: string;
  email: string;
  committedHoursPerDay: number;
  weeklyOffDays: string[];
  timezone: string;
}) {
  const db = await getDb();
  const col = db.collection('users');
  const existing = await col.findOne({ firebaseUid: doc.firebaseUid });
  const now = new Date().toISOString();
  if (existing) {
    await col.updateOne(
      { _id: existing._id },
      {
        $set: {
          name: doc.name,
          email: doc.email,
          committedHoursPerDay: doc.committedHoursPerDay,
          weeklyOffDays: doc.weeklyOffDays,
          timezone: doc.timezone,
        },
      }
    );
    return toDoc({ ...existing, ...doc, createdAt: (existing as { createdAt?: string }).createdAt ?? now })!;
  }
  const result = await col.insertOne({ ...doc, createdAt: now });
  return toDoc({ ...doc, _id: result.insertedId, createdAt: now })!;
}

// --- Attendance ---
export async function mongoGetAttendanceByUser(userId: string) {
  const db = await getDb();
  const list = await db.collection('attendance').find({ userId }).sort({ date: -1 }).toArray();
  return toDocs(list);
}

export async function mongoGetAttendanceByUserAndDate(userId: string, date: string) {
  const db = await getDb();
  const doc = await db.collection('attendance').findOne({ userId, date });
  return toDoc(doc);
}

export async function mongoCreateAttendance(doc: {
  userId: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
  totalWorkedMinutes: number;
  status: string;
  notes?: string;
  isManual?: boolean;
  createdAt: string;
}) {
  const db = await getDb();
  const result = await db.collection('attendance').insertOne(doc);
  return toDoc({ ...doc, _id: result.insertedId })!;
}

export async function mongoFindAttendanceById(id: string) {
  const db = await getDb();
  if (!ObjectId.isValid(id)) return null;
  const doc = await db.collection('attendance').findOne({ _id: new ObjectId(id) });
  return toDoc(doc);
}

export async function mongoUpdateAttendance(id: string, update: Record<string, unknown>) {
  const db = await getDb();
  if (!ObjectId.isValid(id)) return;
  await db.collection('attendance').updateOne({ _id: new ObjectId(id) }, { $set: update });
}

export async function mongoDeleteAttendance(id: string) {
  const db = await getDb();
  if (!ObjectId.isValid(id)) return false;
  const result = await db.collection('attendance').deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

// --- Holidays ---
export async function mongoGetHolidays(userId: string) {
  const db = await getDb();
  const list = await db.collection('holidays').find({ userId }).sort({ date: 1 }).toArray();
  return toDocs(list);
}

export async function mongoAddHoliday(doc: { userId: string; date: string; title: string }) {
  const db = await getDb();
  const result = await db.collection('holidays').insertOne(doc);
  return toDoc({ ...doc, _id: result.insertedId })!;
}

export async function mongoDeleteHoliday(id: string) {
  const db = await getDb();
  if (!ObjectId.isValid(id)) return false;
  const result = await db.collection('holidays').deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

// --- Commitment history ---
export async function mongoGetCommitmentHistory(userId: string) {
  const db = await getDb();
  const list = await db.collection('commitmentHistory').find({ userId }).sort({ effectiveFromDate: 1 }).toArray();
  return toDocs(list);
}

export async function mongoAddCommitment(doc: { userId: string; hoursPerDay: number; effectiveFromDate: string }) {
  const db = await getDb();
  const result = await db.collection('commitmentHistory').insertOne(doc);
  return toDoc({ ...doc, _id: result.insertedId })!;
}
