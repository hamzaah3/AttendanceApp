/**
 * Expo API Route: /api/holidays
 * GET – list by userId (query: userId)
 * POST – add (body: { userId, date, title })
 * DELETE – remove (query: id)
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
    const list = await mongo.mongoGetHolidays(userId);
    return withCors(Response.json(list), request);
  } catch (e) {
    console.error(e);
    return withCors(Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 }), request);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, date, title } = body;
    if (!userId || !date || !title) {
      return withCors(Response.json({ error: 'Missing userId, date, or title' }, { status: 400 }), request);
    }
    const doc = await mongo.mongoAddHoliday({ userId, date, title });
    return withCors(Response.json(doc), request);
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
    const ok = await mongo.mongoDeleteHoliday(id);
    return withCors(Response.json({ deleted: ok }), request);
  } catch (e) {
    console.error(e);
    return withCors(Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 }), request);
  }
}
