const PUBLIC_ORIGIN = 'https://smart-bookshelf.vercel.app';
const ADMIN_ORIGIN = 'https://smart-bookshelf-admin.vercel.app';
// Stable production ID generated for the signed extension-v2 package.
const EXTENSION_ID = 'egkmdicmnnogofdaepinpcmakmaopedd';
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;
const ALLOWED_ORIGINS = new Set([PUBLIC_ORIGIN, ADMIN_ORIGIN, EXTENSION_ORIGIN]);
const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.0-flash']);
const MAX_BODY_BYTES = 128 * 1024;
const MAX_TIMEOUT_MS = 45000;
const EXTENSION_ID_PATTERN = /^[a-z]{32}$/;
const EXTENSION_SESSION_PATTERN = /^sbext_[A-Za-z0-9_-]{40,80}$/;

function cors(origin) {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Extension-ID',
    'Access-Control-Expose-Headers': 'Content-Type',
    'Vary': 'Origin'
  });
  if (ALLOWED_ORIGINS.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function json(data, status, origin) {
  const headers = cors(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(data), { status, headers });
}

function binding(name) { return globalThis[name] || ''; }
function isJWT(value) { return typeof value === 'string' && /^Bearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value); }
function isExtensionSession(value) { return typeof value === 'string' && EXTENSION_SESSION_PATTERN.test(value); }
function isExtensionRequest(request, origin) { return origin === EXTENSION_ORIGIN && request.headers.get('X-Extension-ID') === EXTENSION_ID; }
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function extensionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `sbext_${base64url(bytes)}`;
}

async function rpc(env, name, body) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) return { ok: false, status: response.status, data: null };
  return { ok: true, status: response.status, data: await response.json() };
}

async function resolveWebsiteIdentity(env, authorization) {
  if (!isJWT(authorization)) return null;
  const token = authorization.slice(7);
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  const settingsResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/user_settings?select=gemini_api_key&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!settingsResponse.ok) return null;
  const settings = await settingsResponse.json();
  const apiKey = settings[0]?.gemini_api_key;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length > 256) return { invalidKey: true };
  return { userId: user.id, apiKey };
}

async function resolveExtensionIdentity(env, request) {
  const authorization = request.headers.get('Authorization') || '';
  if (!isExtensionSession(authorization.slice(7))) return null;
  if (!isExtensionRequest(request, request.headers.get('Origin'))) return null;
  const sessionHash = await sha256Hex(authorization.slice(7));
  const result = await rpc(env, 'get_extension_session', {
    p_session_hash: sessionHash,
    p_extension_id: EXTENSION_ID
  });
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!result.ok || !row?.user_id || !row?.gemini_api_key || row.gemini_api_key.length > 256) return null;
  return { userId: row.user_id, apiKey: row.gemini_api_key };
}

async function handleExtensionSession(request, env, origin) {
  if (origin !== EXTENSION_ORIGIN) return json({ error: 'Extension origin not allowed' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (request.headers.get('X-Extension-ID') !== EXTENSION_ID) return json({ error: 'Extension origin not allowed' }, 403, origin);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400, origin); }
  if (typeof body.code !== 'string' || body.code.length < 32 || body.code.length > 160 || body.extension_id !== EXTENSION_ID) return json({ error: 'Invalid extension exchange data' }, 400, origin);
  if (typeof body.state !== 'string' || body.state.length < 32 || body.state.length > 160) return json({ error: 'Invalid extension state' }, 400, origin);
  const codeHash = await sha256Hex(body.code);
  const token = extensionToken();
  const result = await rpc(env, 'exchange_extension_code', {
    p_code_hash: codeHash,
    p_state_hash: await sha256Hex(body.state),
    p_extension_id: EXTENSION_ID,
    p_session_hash: await sha256Hex(token),
    p_session_ttl_seconds: 43200
  });
  if (!result.ok) return json({ error: result.status === 400 ? 'Extension sign-in expired. Please try again.' : 'Extension sign-in unavailable' }, result.status === 400 ? 400 : 502, origin);
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return json({ access_token: token, expires_at: row?.expires_at || null }, 200, origin);
}

async function handleExtensionRevoke(request, env, origin) {
  if (origin !== EXTENSION_ORIGIN) return json({ error: 'Extension origin not allowed' }, 403, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (request.headers.get('X-Extension-ID') !== EXTENSION_ID) return json({ error: 'Extension origin not allowed' }, 403, origin);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  const authorization = request.headers.get('Authorization') || '';
  if (!isExtensionSession(authorization.slice(7))) return json({ error: 'Extension session required' }, 401, origin);
  const result = await rpc(env, 'revoke_extension_session', {
    p_session_hash: await sha256Hex(authorization.slice(7)),
    p_extension_id: EXTENSION_ID
  });
  if (!result.ok) return json({ error: 'Unable to revoke extension session' }, 502, origin);
  return json({ ok: true }, 200, origin);
}

async function handle(request) {
  const env = {
    SUPABASE_URL: String(binding('SUPABASE_URL')).trim(),
    SUPABASE_ANON_KEY: String(binding('SUPABASE_ANON_KEY')).trim()
  };
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origin not allowed' }, 403, origin);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json({ error: 'Service configuration unavailable' }, 503, origin);

  try {
    if (url.pathname === '/extension/session') return await handleExtensionSession(request, env, origin);
    if (url.pathname === '/extension/revoke') return await handleExtensionRevoke(request, env, origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413, origin);
    const authorization = request.headers.get('Authorization') || '';
    let identity = null;
    if (isExtensionSession(authorization.slice(7))) identity = await resolveExtensionIdentity(env, request);
    else if (isJWT(authorization)) identity = await resolveWebsiteIdentity(env, authorization);
    if (!identity) return json({ error: 'Invalid or expired session' }, 401, origin);
    if (identity.invalidKey) return json({ error: 'Gemini API Key မတွေ့ရှိပါ။ Account Settings မှာ ထည့်ပါ။' }, 400, origin);

    const payload = JSON.parse(new TextDecoder().decode(raw));
    const model = ALLOWED_MODELS.has(payload.model) ? payload.model : 'gemini-2.5-flash';
    const geminiBody = { ...payload };
    delete geminiBody.model;
    if (!Array.isArray(geminiBody.contents) || geminiBody.contents.length > 20) return json({ error: 'Conversation history is too long' }, 400, origin);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MAX_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(identity.apiKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Origin': PUBLIC_ORIGIN,
          'Referer': `${PUBLIC_ORIGIN}/`
        },
        body: JSON.stringify(geminiBody),
        signal: controller.signal
      });
    } finally { clearTimeout(timer); }
    if (!response.ok) return json({ error: `Gemini API Error: ${response.status}` }, 502, origin);
    const headers = cors(origin);
    headers.set('Content-Type', 'text/event-stream; charset=utf-8');
    headers.set('Cache-Control', 'no-cache, no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    console.error('AI proxy failure:', error?.name || 'UnknownError');
    return json({ error: error?.name === 'AbortError' ? 'AI request timed out' : 'AI request failed' }, 502, origin);
  }
}

addEventListener('fetch', event => event.respondWith(handle(event.request)));
