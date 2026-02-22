/**
 * Expo API Route: /api/users
 * GET – get user by firebaseUid (query: firebaseUid)
 * POST – create or update user (body: user)
 */
import * as mongo from '@/lib/mongodbServer';
import { corsPreflight, withCors } from '@/lib/cors';

function getUserId(request: Request): string | null {
  return request.headers.get('X-User-Id') ?? request.headers.get('X-Firebase-Uid') ?? null;
}

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const firebaseUid = url.searchParams.get('firebaseUid') ?? getUserId(request);
    if (!firebaseUid) {
      return withCors(Response.json({ error: 'Missing firebaseUid' }, { status: 400 }), request);
    }
    const user = await mongo.mongoGetUserByFirebaseUid(firebaseUid);
    return withCors(Response.json(user ?? null), request);
  } catch (e) {
    console.error(e);
    return withCors(Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 }), request);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firebaseUid, name, email, committedHoursPerDay = 8, weeklyOffDays = ['Saturday', 'Sunday'], timezone } = body;
    if (!firebaseUid || !email) {
      return withCors(Response.json({ error: 'Missing firebaseUid or email' }, { status: 400 }), request);
    }
    const user = await mongo.mongoCreateOrUpdateUser({
      firebaseUid,
      name: name ?? email.split('@')[0],
      email,
      committedHoursPerDay: Number(committedHoursPerDay) || 8,
      weeklyOffDays: Array.isArray(weeklyOffDays) ? weeklyOffDays : ['Saturday', 'Sunday'],
      timezone: timezone ?? 'UTC',
    });
    return withCors(Response.json(user), request);
  } catch (e) {
    console.error(e);
    return withCors(Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 }), request);
  }
}
