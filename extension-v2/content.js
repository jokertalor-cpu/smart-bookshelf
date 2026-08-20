(() => {
  'use strict';
  if (document.getElementById('sb-ai-root')) return;

  let panelOpen = false;
  let sending = false;
  let pendingScreenshot = null;
  let chatHistory = [];
  let activeAssistant = null;

  const root = document.createElement('div');
  root.id = 'sb-ai-root';
  root.innerHTML = '<button id="sb-bubble" aria-label="Open SmartBookshelf AI" title="SmartBookshelf AI">🤖</button>';
  document.documentElement.appendChild(root);

  const panel = document.createElement('section');
  panel.id = 'sb-panel';
  panel.setAttribute('aria-label', 'SmartBookshelf AI Assistant');
  panel.innerHTML = `
    <header id="sb-header"><div><strong>SmartBookshelf AI</strong><small>Gemini · Secure session</small></div><button id="sb-close" aria-label="Close">×</button></header>
    <div id="sb-privacy">ဤ tab ၏စာသား/ပုံကို သင်တောင်းဆိုမှသာ AI သို့ ပို့ပါမည်။</div>
    <div id="sb-messages"><div class="sb-msg ai">မင်္ဂလာပါ။ ဤ tab အကြောင်း မေးနိုင်ပါသည်။</div></div>
    <div id="sb-preview" hidden><span>📸 Screenshot ပူးတွဲထားသည်</span><button id="sb-clear-shot">ဖယ်မည်</button></div>
    <div id="sb-input-row"><textarea id="sb-input" rows="1" placeholder="မေးချင်တာ ရိုက်ပါ..." aria-label="Message"></textarea><button id="sb-camera" title="Screenshot ပူးတွဲမည်">📷</button><button id="sb-send" title="ပို့မည်">➤</button></div>
    <div id="sb-hint">Enter = ပို့မည် · Shift+Enter = စာကြောင်းအသစ်</div>`;
  document.documentElement.appendChild(panel);

  const $ = id => document.getElementById(id);
  const messages = $('sb-messages');

  function toggle() {
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
    if (panelOpen) $('sb-input').focus();
  }

  function appendMessage(text, role) {
    const el = document.createElement('div');
    el.className = `sb-msg ${role}`;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function updateAssistant(text) {
    if (!activeAssistant) activeAssistant = appendMessage('', 'ai');
    activeAssistant.textContent = text;
    messages.scrollTop = messages.scrollHeight;
  }

  async function takeScreenshot() {
    const button = $('sb-camera');
    button.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
      if (!response?.dataUrl) throw new Error(response?.error || 'Screenshot မရပါ');
      pendingScreenshot = response.dataUrl;
      $('sb-preview').hidden = false;
      button.classList.add('active');
    } catch (error) {
      appendMessage(`Screenshot မရပါ: ${error.message}`, 'error');
    } finally { button.disabled = false; }
  }

  function clearScreenshot() {
    pendingScreenshot = null;
    $('sb-preview').hidden = true;
    $('sb-camera').classList.remove('active');
  }

  async function sendMessage() {
    const input = $('sb-input');
    const text = input.value.trim();
    if (!text || sending) return;
    sending = true;
    $('sb-send').disabled = true;
    appendMessage(text, 'user');
    input.value = '';
    const parts = pendingScreenshot
      ? [{ inlineData: { mimeType: 'image/jpeg', data: pendingScreenshot.split(',')[1] } }, { text }]
      : [{ text: `${text}\n\n[Current page: ${location.href}]` }];
    chatHistory.push({ role: 'user', parts });
    clearScreenshot();
    activeAssistant = appendMessage('စဉ်းစားနေသည်...', 'ai loading');
    try {
      const settings = await new Promise(resolve => chrome.storage.local.get(['model'], resolve));
      const response = await chrome.runtime.sendMessage({ type: 'SEND_TO_AI', payload: { contents: chatHistory, model: settings.model || 'gemini-2.5-flash' } });
      if (response?.error) throw new Error(response.error);
      const answer = response?.text || 'AI response မရပါ';
      updateAssistant(answer);
      chatHistory.push({ role: 'model', parts: [{ text: answer }] });
    } catch (error) {
      updateAssistant(`မအောင်မြင်ပါ: ${error.message}`);
      activeAssistant.classList.add('error');
    } finally {
      activeAssistant?.classList.remove('loading');
      activeAssistant = null;
      sending = false;
      $('sb-send').disabled = false;
    }
  }

  $('sb-bubble').addEventListener('click', toggle);
  $('sb-close').addEventListener('click', toggle);
  $('sb-camera').addEventListener('click', takeScreenshot);
  $('sb-clear-shot').addEventListener('click', clearScreenshot);
  $('sb-send').addEventListener('click', sendMessage);
  $('sb-input').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
  });
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'AI_CHUNK' && activeAssistant) updateAssistant(message.fullText || '');
  });
})();
