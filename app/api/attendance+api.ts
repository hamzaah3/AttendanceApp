/**
 * Expo API Route: /api/attendance
 * GET – list by userId (query: userId), or one by userId+date (query: userId, date)
 * POST – create (body: attendance)
 * PATCH – update (body: { id, ...updates })
 * DELETE – delete (query: id)
 */
import * as mongo from '@/lib/mongodbServer';

function getUserId(request: Request): string | null {
  return request.headers.get('X-User-Id') ?? null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') ?? getUserId(request);
    const date = url.searchParams.get('date');
    if (!userId) {
      return Response.json({ error: 'Missing userId' }, { status: 400 });
    }
    if (date) {
      const one = await mongo.mongoGetAttendanceByUserAndDate(userId, date);
      return Response.json(one ?? null);
    }
    const list = await mongo.mongoGetAttendanceByUser(userId);
    return Response.json(list);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, date, checkInTime, checkOutTime, notes, isManual = false } = body;
    if (!userId || !date || !checkInTime) {
      return Response.json({ error: 'Missing userId, date, or checkInTime' }, { status: 400 });
    }
    const existing = await mongo.mongoGetAttendanceByUserAndDate(userId, date);
    if (existing) {
      return Response.json({ error: 'Attendance already exists for this date' }, { status: 409 });
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
    return Response.json(doc);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, checkInTime, checkOutTime, notes } = body;
    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    const current = await mongo.mongoFindAttendanceById(id);
    if (!current) {
      return Response.json({ error: 'Not found' }, { status: 404 });
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
    return Response.json(updated ?? null);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    const ok = await mongo.mongoDeleteAttendance(id);
    return Response.json({ deleted: ok });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
