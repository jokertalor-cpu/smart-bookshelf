importScripts('config.js');

const EXTENSION_ID = 'egkmdicmnnogofdaepinpcmakmaopedd';
const SESSION_KEY = 'extensionSession';
const SESSION_EXPIRES_KEY = 'extensionSessionExpiresAt';

function hasSession() {
  return new Promise(resolve => {
    chrome.storage.session.get([SESSION_KEY, SESSION_EXPIRES_KEY], data => {
      resolve(Boolean(data[SESSION_KEY] && data[SESSION_EXPIRES_KEY] && Number(data[SESSION_EXPIRES_KEY]) > Date.now()));
    });
  });
}

function getSession() {
  return new Promise(resolve => chrome.storage.session.get([SESSION_KEY, SESSION_EXPIRES_KEY], resolve));
}

function setSession(accessToken, expiresAt) {
  return new Promise((resolve, reject) => {
    chrome.storage.session.set({
      [SESSION_KEY]: accessToken,
      [SESSION_EXPIRES_KEY]: expiresAt ? new Date(expiresAt).getTime() : Date.now() + 12 * 60 * 60 * 1000
    }, () => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve());
  });
}

function clearSession() {
  return new Promise((resolve, reject) => {
    chrome.storage.session.clear(() => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve());
  });
}

async function hashState(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function randomString(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function startSignIn() {
  const code = randomString(48);
  const state = randomString(32);
  const codeHash = await hashState(code);
  const redirectUri = chrome.identity.getRedirectURL('smartbookshelf');
  await chrome.storage.session.set({ pendingExtensionCode: code, pendingExtensionState: state });
  const url = `${PUBLIC_SITE_URL}/extension-auth.html?state=${encodeURIComponent(state)}&code_hash=${encodeURIComponent(codeHash)}&extension_id=${EXTENSION_ID}&redirect_uri=${encodeURIComponent(redirectUri)}#code=${encodeURIComponent(code)}`;
  const callbackUrl = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  const callback = new URL(callbackUrl);
  if (callback.origin !== new URL(redirectUri).origin || callback.searchParams.get('state') !== state) throw new Error('Sign-in state mismatch. Please try again.');
  return await exchangeCode({ code: callback.searchParams.get('code'), state });
}

async function exchangeCode(message) {
  const pending = await new Promise(resolve => chrome.storage.session.get(['pendingExtensionCode', 'pendingExtensionState'], resolve));
  if (!pending.pendingExtensionCode || pending.pendingExtensionState !== message.state) throw new Error('Sign-in state mismatch. Please try again.');
  const response = await fetch(`${AI_PROXY_URL}extension/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Extension-ID': EXTENSION_ID },
    body: JSON.stringify({ code: message.code, state: message.state, extension_id: EXTENSION_ID })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error(result.error || 'Extension sign-in failed');
  await setSession(result.access_token, result.expires_at);
  await chrome.storage.session.remove(['pendingExtensionCode', 'pendingExtensionState', 'pendingExtensionStateHash']);
  return { ok: true, expires_at: result.expires_at };
}

async function revokeSession() {
  const session = await getSession();
  if (session[SESSION_KEY]) {
    await fetch(`${AI_PROXY_URL}extension/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session[SESSION_KEY]}`, 'X-Extension-ID': EXTENSION_ID }
    }).catch(() => {});
  }
  await clearSession();
  return { ok: true };
}

async function parseSSE(response, onText) {
  if (!response.body) throw new Error('AI response stream is unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  const consumeLine = line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'data: [DONE]') return false;
    if (!trimmed.startsWith('data:')) return false;
    const jsonText = trimmed.slice(5).trim();
    if (!jsonText) return false;
    let event;
    try { event = JSON.parse(jsonText); } catch (_) { return false; }
    const error = event.error?.message || event.error;
    if (error) throw new Error(String(error));
    const text = event.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    if (text) {
      fullText += text;
      onText?.(text, fullText);
    }
    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) consumeLine(line);
    if (done) break;
  }
  buffer += decoder.decode();
  if (buffer) consumeLine(buffer);
  if (!fullText) throw new Error('AI returned an empty response');
  return fullText;
}

async function handleAIRequest(payload, sendChunk) {
  const session = await getSession();
  if (!session[SESSION_KEY] || Number(session[SESSION_EXPIRES_KEY]) <= Date.now()) {
    await clearSession();
    throw new Error('Sign in to SmartBookshelf from the extension popup first.');
  }
  const response = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session[SESSION_KEY]}`,
      'X-Extension-ID': EXTENSION_ID
    },
    body: JSON.stringify({
      model: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'].includes(payload.model) ? payload.model : 'gemini-2.5-flash',
      contents: Array.isArray(payload.contents) ? payload.contents.slice(-20) : []
    })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401) await clearSession();
    throw new Error(error.error || `AI proxy error (${response.status})`);
  }
  return parseSSE(response, sendChunk);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'GET_STATUS') return { signedIn: await hasSession() };
      if (message.type === 'START_SIGN_IN') return await startSignIn();
      if (message.type === 'SIGN_OUT') return await revokeSession();
      if (message.type === 'ACTIVATE_TAB') {
        if (!sender?.id || sender.id !== chrome.runtime.id) throw new Error('Invalid extension sender');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !/^https?:/.test(tab.url || '')) throw new Error('This page does not allow extension activation.');
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        return { ok: true };
      }
      if (message.type === 'CAPTURE_SCREENSHOT') {
        if (!sender?.id || sender.id !== chrome.runtime.id) throw new Error('Invalid extension sender');
        const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab?.windowId ?? null, { format: 'jpeg', quality: 70 });
        return { dataUrl };
      }
      if (message.type === 'SEND_TO_AI') {
        if (!sender?.id || sender.id !== chrome.runtime.id) throw new Error('Invalid extension sender');
        return { text: await handleAIRequest(message.payload || {}, (chunk, fullText) => {
          chrome.tabs.sendMessage(sender.tab?.id, { type: 'AI_CHUNK', chunk, fullText }).catch(() => {});
        }) };
      }
      throw new Error('Unknown message type');
    } catch (error) {
      return { error: error?.message || 'Extension request failed' };
    }
  })().then(sendResponse);
  return true;
});
