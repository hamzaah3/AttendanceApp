/**
 * Expo API Route: /api/commitment
 * GET – list by userId (query: userId)
 * POST – add (body: { userId, hoursPerDay, effectiveFromDate })
 */
import * as mongo from '@/lib/mongodbServer';

function getUserId(request: Request): string | null {
  return request.headers.get('X-User-Id') ?? null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') ?? getUserId(request);
    if (!userId) {
      return Response.json({ error: 'Missing userId' }, { status: 400 });
    }
    const list = await mongo.mongoGetCommitmentHistory(userId);
    return Response.json(list);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, hoursPerDay, effectiveFromDate } = body;
    if (!userId || hoursPerDay == null || !effectiveFromDate) {
      return Response.json({ error: 'Missing userId, hoursPerDay, or effectiveFromDate' }, { status: 400 });
    }
    const doc = await mongo.mongoAddCommitment({
      userId,
      hoursPerDay: Number(hoursPerDay) || 8,
      effectiveFromDate,
    });
    return Response.json(doc);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
