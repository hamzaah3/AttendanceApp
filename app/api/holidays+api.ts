/**
 * Expo API Route: /api/holidays
 * GET – list by userId (query: userId)
 * POST – add (body: { userId, date, title })
 * DELETE – remove (query: id)
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
    const list = await mongo.mongoGetHolidays(userId);
    return Response.json(list);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, date, title } = body;
    if (!userId || !date || !title) {
      return Response.json({ error: 'Missing userId, date, or title' }, { status: 400 });
    }
    const doc = await mongo.mongoAddHoliday({ userId, date, title });
    return Response.json(doc);
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
    const ok = await mongo.mongoDeleteHoliday(id);
    return Response.json({ deleted: ok });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
