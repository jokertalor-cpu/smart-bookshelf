const PUBLIC_ORIGIN = 'https://smart-bookshelf.vercel.app';
const ADMIN_ORIGIN = 'https://smart-bookshelf-admin.vercel.app';
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const IP_THROTTLE_MS = 8000;
const KEY_COOLDOWN_MS = 60000;
const CACHE_TTL_SEC = 604800;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY = 6;
const MAX_BOOKS = 5;
const ipThrottleMap = new Map();
const keyCooldowns = new Map();

function cors(origin) {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Expose-Headers': 'Content-Type',
    'Vary': 'Origin'
  });
  if (origin === PUBLIC_ORIGIN || origin === ADMIN_ORIGIN) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}
function json(data, status, origin) {
  const headers = cors(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers });
}
function envValue(env, name) {
  return env[name] || env[`${name} `] || '';
}
function extractTextFromSSE(raw) {
  let result = '';
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const value = line.slice(6).trim();
    if (!value || value === '[DONE]') continue;
    try { result += JSON.parse(value).candidates?.[0]?.content?.parts?.[0]?.text || ''; } catch (_) {}
  }
  return result.trim();
}
async function cachePut(kv, key, value) {
  if (!kv || !value) return;
  try { await kv.put(key, value, { expirationTtl: CACHE_TTL_SEC }); } catch (_) {}
}
async function fetchBooks(message, env) {
  const base = envValue(env, 'SUPABASE_URL');
  const key = env.SUPABASE_ANON_KEY || '';
  if (!base || !key) return null;
  const lower = message.toLowerCase();
  let order = '';
  let filter = '';
  if (lower.includes('popular') || lower.includes('လူကြိုက်') || lower.includes('လူသိများ')) order = 'likes_count';
  else if (lower.includes('download') || lower.includes('ဒေါင်း')) order = 'download_count';
  else if (lower.includes('latest') || lower.includes('နောက်ဆုံး') || lower.includes('အသစ်') || lower.includes('ထွက်သစ်')) order = 'id';
  else if (lower.includes('editor') || lower.includes('အကြံပြု') || lower.includes('အကောင်းဆုံး')) { order = 'likes_count'; filter = '&is_editor_choice=eq.true'; }
  else if (lower.includes('novel') || lower.includes('ဝတ္ထု') || lower.includes('xianxia')) order = 'likes_count';
  else return null;
  try {
    const response = await fetch(`${String(base).replace(/\/$/, '')}/rest/v1/books?select=title,author,likes_count,download_count${filter}&order=${order}.desc&limit=${MAX_BOOKS}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) return null;
    const books = await response.json();
    return Array.isArray(books) && books.length ? books : null;
  } catch (_) { return null; }
}
function buildPrompt(context, books) {
  let prompt = 'မင်းက Smart Bookshelf ဝက်ဘ်ဆိုဒ်ရဲ့ AI စာကြည့်တိုက်မှူး (SMART AI) ဖြစ်တယ်။\nမြန်မာဘာသာဖြင့် ယဉ်ကျေးပျူငှာစွာ ပြန်ဖြေပေးပါ။ အောက်ပါ data များကိုသာ အခြေခံပြီး ဖြေပါ။ data မပါသောအချက်များကို မဖြည့်စွက်ပါနဲ့။\n\n';
  if (books?.length) {
    prompt += '=== Smart Bookshelf ရှိ စာအုပ်များ (Real Data) ===\n';
    books.forEach((book, index) => { prompt += `${index + 1}. "${book.title}"${book.author ? ` - ${book.author}` : ''}${book.likes_count != null ? ` | Likes: ${book.likes_count}` : ''}${book.download_count != null ? ` | Downloads: ${book.download_count}` : ''}\n`; });
    prompt += '\n';
  }
  if (context?.readingHistory?.length) {
    prompt += '=== User ဖတ်ရှုမှုမှတ်တမ်း ===\n';
    context.readingHistory.slice(0, 3).forEach(book => { prompt += `- "${book.title}" by ${book.author} | Progress: ${book.progress}%\n`; });
    prompt += '\n';
  }
  if (context?.userPreferences?.favoriteGenres?.length) prompt += `=== User ကြိုက်နှစ်သက်သော အမျိုးအစား ===\n${context.userPreferences.favoriteGenres.slice(0, 3).join(', ')}\n\n`;
  return prompt;
}
async function callGemini(keys, body) {
  const now = Date.now();
  for (const model of MODELS) {
    const available = keys.filter(key => (keyCooldowns.get(`${model}:${key}`) || 0) < now);
    while (available.length) {
      const index = Math.floor(Math.random() * available.length);
      const key = available[index];
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (response.ok) return response;
        if (response.status === 429) keyCooldowns.set(`${model}:${key}`, Date.now() + KEY_COOLDOWN_MS);
        available.splice(index, 1);
      } catch (_) { available.splice(index, 1); }
    }
  }
  throw new Error('AI service unavailable');
}
async function handlePurge(env, origin) {
  if (origin !== ADMIN_ORIGIN) return json({ error: 'Origin not allowed' }, 403, origin);
  const kv = env.AI_CACHE_KV;
  let deleted = 0;
  if (kv) {
    try {
      const listed = await kv.list();
      for (const key of listed.keys) { await kv.delete(key.name); deleted++; }
    } catch (_) {}
  }
  return json({ success: true, deleted_kv: deleted }, 200, origin);
}

async function handle(request, env, ctx) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== PUBLIC_ORIGIN && origin !== ADMIN_ORIGIN) return json({ error: 'Origin not allowed' }, 403, origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/purge-cache') {
      const expected = envValue(env, 'PURGE_SECRET');
      const supplied = url.searchParams.get('secret') || '';
      if (!expected || supplied !== expected) return json({ error: 'Unauthorized' }, 401, origin);
      return handlePurge(env, origin);
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413, origin);
    let body;
    try { body = JSON.parse(new TextDecoder().decode(raw)); } catch (_) { return json({ error: 'Invalid JSON' }, 400, origin); }
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return json({ error: 'message required' }, 400, origin);
    if (message.length > MAX_MESSAGE_CHARS) return json({ error: 'message too long' }, 413, origin);
    const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
    if (history.some(item => !item || !Array.isArray(item.parts) || item.parts.some(part => String(part?.text || '').length > MAX_MESSAGE_CHARS))) return json({ error: 'history item too large' }, 400, origin);

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    const last = ipThrottleMap.get(ip) || 0;
    if (now - last < IP_THROTTLE_MS) {
      const headers = cors(origin);
      headers.set('Content-Type', 'text/event-stream; charset=utf-8');
      headers.set('Cache-Control', 'no-store');
      return new Response(`data: ${JSON.stringify({ error: 'ခဏစောင့်ပြီးမှ ထပ်မေးပါ။' })}\n\ndata: [DONE]\n\n`, { status: 429, headers });
    }
    ipThrottleMap.set(ip, now);

    const keys = [1, 2, 3, 4, 5, 6].map(index => env[`GEMINI_API_KEY_${index}`]).filter(key => typeof key === 'string' && key.trim());
    if (!keys.length) return json({ error: 'AI service configuration unavailable' }, 503, origin);
    const cacheKey = `exact:${message.toLowerCase()}`;
    if (env.AI_CACHE_KV) {
      try {
        const cached = await env.AI_CACHE_KV.get(cacheKey);
        if (cached) {
          const headers = cors(origin);
          headers.set('Content-Type', 'text/event-stream; charset=utf-8');
          headers.set('Cache-Control', 'no-store');
          return new Response(`data: ${JSON.stringify({ text: cached })}\n\ndata: [DONE]\n\n`, { headers });
        }
      } catch (_) {}
    }
    const books = await fetchBooks(message, env);
    const prompt = buildPrompt(!history.length ? body.aiContext : null, books);
    const geminiBody = { contents: [...history, { role: 'user', parts: [{ text: `${prompt}User Question: ${message}` }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 800 } };
    try {
      const upstream = await callGemini(keys, geminiBody);
      const decoder = new TextDecoder();
      let rawSSE = '';
      const stream = new TransformStream({
        transform(chunk, controller) { rawSSE += decoder.decode(chunk, { stream: true }); controller.enqueue(chunk); },
        flush() { const clean = extractTextFromSSE(rawSSE); if (clean && env.AI_CACHE_KV) ctx.waitUntil(cachePut(env.AI_CACHE_KV, cacheKey, clean)); }
      });
      upstream.body.pipeTo(stream.writable);
      const headers = cors(origin);
      headers.set('Content-Type', 'text/event-stream; charset=utf-8');
      headers.set('Cache-Control', 'no-cache, no-store');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(stream.readable, { status: 200, headers });
    } catch (_) { return json({ error: 'AI service unavailable' }, 502, origin); }
}

function binding(name) { return globalThis[name] || globalThis[`${name} `] || ''; }
addEventListener('fetch', event => {
  const env = {
    SUPABASE_URL: binding('SUPABASE_URL'),
    SUPABASE_ANON_KEY: binding('SUPABASE_ANON_KEY'),
    GEMINI_API_KEY_1: binding('GEMINI_API_KEY_1'),
    GEMINI_API_KEY_2: binding('GEMINI_API_KEY_2'),
    GEMINI_API_KEY_3: binding('GEMINI_API_KEY_3'),
    GEMINI_API_KEY_4: binding('GEMINI_API_KEY_4'),
    GEMINI_API_KEY_5: binding('GEMINI_API_KEY_5'),
    GEMINI_API_KEY_6: binding('GEMINI_API_KEY_6'),
    PURGE_SECRET: binding('PURGE_SECRET'),
    AI_CACHE_KV: globalThis.AI_CACHE_KV,
    AI: globalThis.AI,
    AI_SEMANTIC_CACHE: globalThis.AI_SEMANTIC_CACHE,
  };
  const ctx = { waitUntil: promise => event.waitUntil(promise) };
  event.respondWith(handle(event.request, env, ctx));
});
