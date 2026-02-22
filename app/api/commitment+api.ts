/**
 * Expo API Route: /api/commitment
 * GET – list by userId (query: userId)
 * POST – add (body: { userId, hoursPerDay, effectiveFromDate })
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
    if (!userId) {
      return withCors(Response.json({ error: 'Missing userId' }, { status: 400 }), request);
    }
    const list = await mongo.mongoGetCommitmentHistory(userId);
    return withCors(Response.json(list), request);
  } catch (e) {
    console.error(e);
    return withCors(Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 }), request);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, hoursPerDay, effectiveFromDate } = body;
    if (!userId || hoursPerDay == null || !effectiveFromDate) {
      return withCors(Response.json({ error: 'Missing userId, hoursPerDay, or effectiveFromDate' }, { status: 400 }), request);
    }
    const doc = await mongo.mongoAddCommitment({
      userId,
      hoursPerDay: Number(hoursPerDay) || 8,
      effectiveFromDate,
    });
    return withCors(Response.json(doc), request);
  } catch (e) {
    console.error(e);
    return withCors(Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 }), request);
  }
}
