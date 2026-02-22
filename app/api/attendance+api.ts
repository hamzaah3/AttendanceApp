/**
 * Expo API Route: /api/attendance
 * GET – list by userId (query: userId), or one by userId+date (query: userId, date)
 * POST – create (body: attendance)
 * PATCH – update (body: { id, ...updates })
 * DELETE – delete (query: id)
 */
import * as mongo from '@/lib/mongodbServer';
import { corsPreflight, withCors } from '@/lib/cors';

function getUserId(request: Request): string | null {
  return request.headers.get('X-User-Id') ?? null;
}

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') ?? getUserId(request);
    const date = url.searchParams.get('date');
    if (!userId) {
      return withCors(Response.json({ error: 'Missing userId' }, { status: 400 }), request);
    }
    if (date) {
      const one = await mongo.mongoGetAttendanceByUserAndDate(userId, date);
      return withCors(Response.json(one ?? null), request);
    }
    const list = await mongo.mongoGetAttendanceByUser(userId);
    return withCors(Response.json(list), request);
  } catch (e) {
    console.error(e);
    return withCors(Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 }), request);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, date, checkInTime, checkOutTime, notes, isManual = false } = body;
    if (!userId || !date || !checkInTime) {
      return withCors(Response.json({ error: 'Missing userId, date, or checkInTime' }, { status: 400 }), request);
    }
    const existing = await mongo.mongoGetAttendanceByUserAndDate(userId, date);
    if (existing) {
      return withCors(Response.json({ error: 'Attendance already exists for this date' }, { status: 409 }), request);
    }
    const checkIn = new Date(`${date}T${checkInTime}`);
    const checkOut = checkOutTime ? new Date(`${date}T${checkOutTime}`) : null;
    const totalWorkedMinutes = checkOut ? Math.max(0, Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000)) : 0;
    const status = checkOut ? (isManual ? 'manual' : 'complete') : 'incomplete';
    const doc = await mongo.mongoCreateAttendance({
      userId,
      date,
      checkInTime,
      checkOutTime,
      totalWorkedMinutes,
      status,
      notes,
      isManual,
      createdAt: new Date().toISOString(),
    });
    return withCors(Response.json(doc), request);
  } catch (e) {
    console.error(e);
    return withCors(Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 }), request);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, checkInTime, checkOutTime, notes } = body;
    if (!id) {
      return withCors(Response.json({ error: 'Missing id' }, { status: 400 }), request);
    }
    const current = await mongo.mongoFindAttendanceById(id);
    if (!current) {
      return withCors(Response.json({ error: 'Not found' }, { status: 404 }), request);
    }
    const c = current as Record<string, unknown>;
    const date = String(c.date);
    const ci = checkInTime ?? c.checkInTime;
    const co = checkOutTime ?? c.checkOutTime;
    const checkIn = new Date(`${date}T${ci}`);
    const checkOut = co ? new Date(`${date}T${co}`) : null;
    const totalWorkedMinutes = checkOut ? Math.max(0, Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000)) : 0;
    const status = checkOut ? 'manual' : 'incomplete';
    await mongo.mongoUpdateAttendance(id, {
      checkInTime: ci,
      checkOutTime: co,
      notes: notes ?? c.notes,
      totalWorkedMinutes,
      status,
      isManual: true,
    });
    const updated = await mongo.mongoFindAttendanceById(id);
    return withCors(Response.json(updated ?? null), request);
  } catch (e) {
    console.error(e);
    return withCors(Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 }), request);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return withCors(Response.json({ error: 'Missing id' }, { status: 400 }), request);
    }
    const ok = await mongo.mongoDeleteAttendance(id);
    return withCors(Response.json({ deleted: ok }), request);
  } catch (e) {
    console.error(e);
    return withCors(Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 }), request);
  }
}
