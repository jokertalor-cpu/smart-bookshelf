const ALLOWED_ORIGINS = new Set([
  'https://smart-bookshelf.vercel.app',
  'https://smart-bookshelf-admin.vercel.app'
]);
const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']);
const MAX_BODY_BYTES = 128 * 1024;
const MAX_TIMEOUT_MS = 45000;

function cors(origin) {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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
  return new Response(JSON.stringify(data), { status, headers });
}

function isJWT(value) {
  return typeof value === 'string' && /^Bearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}
function binding(name) { return globalThis[name] || ''; }

async function handle(request) {
  const env = {
    SUPABASE_URL: String(binding('SUPABASE_URL')).trim(),
    SUPABASE_ANON_KEY: String(binding('SUPABASE_ANON_KEY')).trim()
  };
    const origin = request.headers.get('Origin');
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origin not allowed' }, 403, origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
    if (!isJWT(request.headers.get('Authorization'))) return json({ error: 'Authentication required' }, 401, origin);
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json({ error: 'Service configuration unavailable' }, 503, origin);

    try {
      const raw = await request.arrayBuffer();
      if (raw.byteLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413, origin);
      const token = request.headers.get('Authorization').slice(7);
      const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
      });
      if (!userResponse.ok) return json({ error: 'Invalid session' }, 401, origin);
      const user = await userResponse.json();
      const settingsResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/user_settings?select=gemini_api_key&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, {
        headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
      });
      if (!settingsResponse.ok) return json({ error: 'Unable to load account settings' }, 502, origin);
      const settings = await settingsResponse.json();
      const apiKey = settings[0]?.gemini_api_key;
      if (!apiKey || typeof apiKey !== 'string' || apiKey.length > 256) return json({ error: 'Gemini API Key မတွေ့ရှိပါ။ Account Settings မှာ ထည့်ပါ။' }, 400, origin);

      const payload = JSON.parse(new TextDecoder().decode(raw));
      const model = ALLOWED_MODELS.has(payload.model) ? payload.model : 'gemini-2.5-flash';
      const geminiBody = { ...payload };
      delete geminiBody.model;
      if (!Array.isArray(geminiBody.contents) || geminiBody.contents.length > 20) return json({ error: 'Conversation history is too long' }, 400, origin);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), MAX_TIMEOUT_MS);
      const requestOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://smart-bookshelf.vercel.app';
      let response;
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            // Preserve the allowlisted site identity for API keys restricted by HTTP referrer.
            'Origin': requestOrigin,
            'Referer': `${requestOrigin}/`
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
