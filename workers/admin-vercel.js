/**
 * SmartBookshelf Supabase storage/admin proxy.
 * Public site: read-only public storage objects.
 * Admin site: authenticated Supabase operations and uploads.
 */
const PUBLIC_ORIGIN = 'https://smart-bookshelf.vercel.app';
const ADMIN_ORIGIN = 'https://smart-bookshelf-admin.vercel.app';
const PUBLIC_STORAGE_PREFIX = '/storage/v1/object/public/';
const ADMIN_ROUTE_PREFIXES = ['/rest/v1/', '/storage/v1/object/', '/storage/v1/bucket'];
const ADMIN_AUTH_ROUTES = new Set(['/auth/v1/token', '/auth/v1/user', '/auth/v1/logout']);

function corsFor(origin, isAdmin = false) {
  const headers = new Headers({
    'Access-Control-Allow-Methods': isAdmin ? 'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS' : 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, x-supabase-api-version, apikey, accept-profile, content-profile, prefer, range, if-match, cache-control, x-upsert',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, ETag, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  });
  if (origin === PUBLIC_ORIGIN || isAdmin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function isRealJWT(value) {
  return typeof value === 'string' && /^Bearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function binding(name) {
  return String(globalThis[name] || '').trim();
}

function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function isAllowedAdminOrigin(origin) {
  const configured = normalizeOrigin(binding('ALLOWED_ORIGIN'));
  return origin === ADMIN_ORIGIN || (configured && origin === configured);
}

function isAllowedAdminPath(pathname) {
  return ADMIN_AUTH_ROUTES.has(pathname) || ADMIN_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function isAuthTokenRequest(pathname, method) {
  return pathname === '/auth/v1/token' && method === 'POST';
}

function safeStorageSegment(segment) {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch (_) {
    // Keep the original segment if it is not valid percent-encoding.
  }
  if (Array.from(decoded).every((char) => /^[A-Za-z0-9._-]$/.test(char))) return decoded;

  const bytes = new TextEncoder().encode(decoded);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const compact = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `u_${compact}`;
}

function normalizeStoragePath(pathname) {
  const marker = '/storage/v1/object/';
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex < 0) return pathname;

  const prefix = pathname.slice(0, markerIndex + marker.length);
  const rest = pathname.slice(markerIndex + marker.length);
  const parts = rest.split('/');
  const publicMode = parts[0] === 'public';
  const bucketIndex = publicMode ? 1 : 0;
  if (!parts[bucketIndex]) return pathname;

  // Keep operation prefix and bucket name unchanged; normalize only object key segments.
  const objectStart = bucketIndex + 1;
  if (parts.length <= objectStart) return pathname;
  const normalized = parts.slice(0, objectStart)
    .concat(parts.slice(objectStart).map(safeStorageSegment));
  return prefix + normalized.join('/');
}

function denied(origin, isAdmin, message = 'Request not allowed') {
  return new Response(message, { status: 403, headers: corsFor(origin, isAdmin) });
}

async function handle(request) {
  const env = { SUPABASE_URL: binding('SUPABASE_URL'), SUPABASE_KEY: binding('SUPABASE_KEY') };
  const url = new URL(request.url);
  const origin = normalizeOrigin(request.headers.get('Origin'));
  const anonymousPublicStorage = !origin && ['GET', 'HEAD'].includes(request.method) && url.pathname.startsWith(PUBLIC_STORAGE_PREFIX);
  const isAdmin = isAllowedAdminOrigin(origin);
  const isPublic = origin === PUBLIC_ORIGIN || anonymousPublicStorage;
  const isPreflight = request.method === 'OPTIONS';
  const requestedMethod = request.headers.get('Access-Control-Request-Method') || '';

  // Browser requests must identify one of the two known applications. The only
  // no-Origin exception is a read-only public Storage object request, which is
  // required by normal cross-origin image/PDF navigation.
  if ((!origin && !anonymousPublicStorage) || (origin && !isAdmin && !isPublic)) {
    return denied(origin, false, 'Origin not allowed');
  }

  if (isPreflight) {
    if (isPublic && (requestedMethod && !['GET', 'HEAD'].includes(requestedMethod) || !url.pathname.startsWith(PUBLIC_STORAGE_PREFIX))) {
      return denied(origin, false, 'Public path or method not allowed');
    }
    if (isAdmin && !isAllowedAdminPath(url.pathname)) return denied(origin, true, 'Admin path not allowed');
    return new Response(null, { status: 204, headers: corsFor(origin, isAdmin) });
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
    return new Response('Internal Server Error', { status: 500, headers: corsFor(origin, isAdmin) });
  }

  if (isPublic) {
    if (!['GET', 'HEAD'].includes(request.method) || !url.pathname.startsWith(PUBLIC_STORAGE_PREFIX)) {
      return denied(origin, false, 'Public proxy is read-only');
    }
  }

  if (isAdmin) {
    if (!isAllowedAdminPath(url.pathname)) return denied(origin, true, 'Admin path not allowed');
    const authorization = request.headers.get('Authorization');
    // Password/refresh-token exchange is the only Admin write route that is allowed
    // without a prior JWT. All other Admin operations require the current Supabase JWT.
    if (!isAuthTokenRequest(url.pathname, request.method) && !isRealJWT(authorization)) {
      return new Response('Authentication required', { status: 401, headers: corsFor(origin, true) });
    }
  }

  try {
    const headers = new Headers(request.headers);
    headers.set('apikey', env.SUPABASE_KEY);
    const authorization = request.headers.get('Authorization');
    if (isRealJWT(authorization)) {
      headers.set('Authorization', authorization);
    } else if (isPublic || isAuthTokenRequest(url.pathname, request.method)) {
      headers.set('Authorization', `Bearer ${env.SUPABASE_KEY}`);
    } else {
      headers.delete('Authorization');
    }
    headers.delete('Host');
    headers.delete('Origin');
    headers.delete('Referer');

    const targetPath = normalizeStoragePath(url.pathname);
    const target = `${env.SUPABASE_URL.replace(/\/$/, '')}${targetPath}${url.search}`;
    const init = { method: request.method, headers, redirect: 'follow' };
    if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body;
    const response = await fetch(target, init);
    const responseHeaders = new Headers(response.headers);
    const cors = corsFor(origin, isAdmin);
    cors.forEach((value, key) => responseHeaders.set(key, value));
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    if (url.pathname.startsWith('/auth/v1/')) responseHeaders.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
  } catch (_) {
    return new Response('Proxy Error', { status: 502, headers: corsFor(origin, isAdmin) });
  }
}

addEventListener('fetch', event => event.respondWith(handle(event.request)));
