/**
 * CORS headers for API routes. Use when the app is served from a different origin (e.g. Vercel).
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Firebase-Uid',
  'Access-Control-Max-Age': '86400',
} as const;

export function withCors(response: Response, request: Request): Response {
  const origin = request.headers.get('Origin');
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin ?? '*');
  Object.entries(CORS_HEADERS).forEach(([k, v]) => {
    if (k !== 'Access-Control-Allow-Origin') headers.set(k, v);
  });
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
