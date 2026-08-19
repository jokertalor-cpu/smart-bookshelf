/**
 * SmartBookshelf Supabase storage/admin proxy.
 * Public site: read-only public storage objects.
 * Admin site: authenticated Supabase operations and uploads.
 */
const PUBLIC_ORIGIN = 'https://smart-bookshelf.vercel.app';
const ADMIN_ORIGIN = 'https://smart-bookshelf-admin.vercel.app';
const PUBLIC_STORAGE_PREFIX = '/storage/v1/object/public/';

function corsFor(origin, isAdmin = false) {
  const headers = new Headers({
    'Access-Control-Allow-Methods': isAdmin ? 'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS' : 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, x-supabase-api-version, apikey, accept-profile, content-profile, prefer, range, if-match, cache-control, x-upsert',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, ETag, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  });
  if (origin === PUBLIC_ORIGIN || origin === ADMIN_ORIGIN) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function isRealJWT(value) {
  return typeof value === 'string' && /^Bearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}
function binding(name) { return globalThis[name] || ''; }

async function handle(request) {
  const env = { SUPABASE_URL: binding('SUPABASE_URL'), SUPABASE_KEY: binding('SUPABASE_KEY') };
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const isAdmin = origin === ADMIN_ORIGIN;
    const isPublic = origin === PUBLIC_ORIGIN;

    if (origin && !isAdmin && !isPublic) {
      return new Response('Origin not allowed', { status: 403, headers: corsFor(origin) });
    }
    if (request.method === 'OPTIONS') {
      if (isPublic && !url.pathname.startsWith(PUBLIC_STORAGE_PREFIX)) {
        return new Response('Path not allowed', { status: 403, headers: corsFor(origin, false) });
      }
      return new Response(null, { status: 204, headers: corsFor(origin, isAdmin) });
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
      return new Response('Internal Server Error', { status: 500, headers: corsFor(origin, isAdmin) });
    }
    if (isPublic && (!['GET', 'HEAD'].includes(request.method) || !url.pathname.startsWith(PUBLIC_STORAGE_PREFIX))) {
      return new Response('Public proxy is read-only', { status: 403, headers: corsFor(origin, false) });
    }

    try {
      const headers = new Headers(request.headers);
      headers.set('apikey', env.SUPABASE_KEY);
      const authorization = request.headers.get('Authorization');
      headers.set('Authorization', isRealJWT(authorization) ? authorization : `Bearer ${env.SUPABASE_KEY}`);
      headers.delete('Host');
      headers.delete('Origin');
      headers.delete('Referer');

      const target = `${String(env.SUPABASE_URL).replace(/\/$/, '')}${url.pathname}${url.search}`;
      const init = { method: request.method, headers, redirect: 'follow' };
      if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.arrayBuffer();
      const response = await fetch(target, init);
      const responseHeaders = new Headers(response.headers);
      const cors = corsFor(origin, isAdmin);
      cors.forEach((value, key) => responseHeaders.set(key, value));
      responseHeaders.set('X-Content-Type-Options', 'nosniff');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
    } catch (error) {
      return new Response('Proxy Error', { status: 502, headers: corsFor(origin, isAdmin) });
    }
}

addEventListener('fetch', event => event.respondWith(handle(event.request)));
