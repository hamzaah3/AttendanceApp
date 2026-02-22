/**
 * Expo API Route: /api/users
 * GET – get user by firebaseUid (query: firebaseUid)
 * POST – create or update user (body: user)
 */
import * as mongo from '@/lib/mongodbServer';

function getUserId(request: Request): string | null {
  return request.headers.get('X-User-Id') ?? request.headers.get('X-Firebase-Uid') ?? null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const firebaseUid = url.searchParams.get('firebaseUid') ?? getUserId(request);
    if (!firebaseUid) {
      return Response.json({ error: 'Missing firebaseUid' }, { status: 400 });
    }
    const user = await mongo.mongoGetUserByFirebaseUid(firebaseUid);
    return Response.json(user ?? null);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firebaseUid, name, email, committedHoursPerDay = 8, weeklyOffDays = ['Saturday', 'Sunday'], timezone } = body;
    if (!firebaseUid || !email) {
      return Response.json({ error: 'Missing firebaseUid or email' }, { status: 400 });
    }
    const user = await mongo.mongoCreateOrUpdateUser({
      firebaseUid,
      name: name ?? email.split('@')[0],
      email,
      committedHoursPerDay: Number(committedHoursPerDay) || 8,
      weeklyOffDays: Array.isArray(weeklyOffDays) ? weeklyOffDays : ['Saturday', 'Sunday'],
      timezone: timezone ?? 'UTC',
    });
    return Response.json(user);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
