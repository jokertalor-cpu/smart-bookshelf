(() => {
  'use strict';
  if (document.getElementById('sb-ai-root')) return;

  const POSITION_KEY = 'bubblePosition';
  let panelOpen = false;
  let sending = false;
  let pendingScreenshot = null;
  let chatHistory = [];
  let activeAssistant = null;
  let dragState = null;
  let suppressNextClick = false;

  const root = document.createElement('div');
  root.id = 'sb-ai-root';
  root.setAttribute('data-smartbookshelf-ai', 'true');

  const bubble = document.createElement('button');
  bubble.id = 'sb-bubble';
  bubble.type = 'button';
  bubble.setAttribute('aria-label', 'Open SmartBookshelf AI');
  bubble.title = 'SmartBookshelf AI — drag to move';
  bubble.textContent = '🤖';
  root.appendChild(bubble);

  const panel = document.createElement('section');
  panel.id = 'sb-panel';
  panel.setAttribute('aria-label', 'SmartBookshelf AI Assistant');
  panel.innerHTML = `
    <header id="sb-header"><div><strong>SmartBookshelf AI</strong><small>Gemini · Secure session</small></div><button id="sb-close" type="button" aria-label="Close">×</button></header>
    <div id="sb-privacy">ဤ tab ၏စာသား/ပုံကို သင်တောင်းဆိုမှသာ AI သို့ ပို့ပါမည်။ အရုပ်ကို ဖိဆွဲပြီး screen အတွင်း မည်သည့်နေရာသို့မဆို ရွှေ့နိုင်ပါသည်။</div>
    <div id="sb-messages"><div class="sb-msg ai">မင်္ဂလာပါ။ ဤ tab အကြောင်း မေးနိုင်ပါသည်။</div></div>
    <div id="sb-preview" hidden><span>📸 Screenshot ပူးတွဲထားသည်</span><button id="sb-clear-shot" type="button">ဖယ်မည်</button></div>
    <div id="sb-input-row"><textarea id="sb-input" rows="1" placeholder="မေးချင်တာ ရိုက်ပါ..." aria-label="Message"></textarea><button id="sb-camera" type="button" title="Screenshot ပူးတွဲမည်">📷</button><button id="sb-send" type="button" title="ပို့မည်">➤</button></div>
    <div id="sb-hint">Enter = ပို့မည် · Shift+Enter = စာကြောင်းအသစ်</div>`;
  root.appendChild(panel);
  document.documentElement.appendChild(root);

  const $ = id => document.getElementById(id);
  const messages = $('sb-messages');

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function clampRootPosition(left, top) {
    const rect = root.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    return {
      left: clamp(Number(left) || 0, 8, maxLeft),
      top: clamp(Number(top) || 0, 8, maxTop)
    };
  }

  function setRootPosition(left, top, persist = false) {
    const position = clampRootPosition(left, top);
    root.style.left = `${position.left}px`;
    root.style.top = `${position.top}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    if (persist) chrome.storage.local.set({ [POSITION_KEY]: position });
    if (panelOpen) positionPanel();
  }

  function restorePosition() {
    chrome.storage.local.get([POSITION_KEY], data => {
      const saved = data?.[POSITION_KEY];
      if (saved && Number.isFinite(Number(saved.left)) && Number.isFinite(Number(saved.top))) {
        setRootPosition(saved.left, saved.top);
      } else {
        const rect = root.getBoundingClientRect();
        setRootPosition(window.innerWidth - rect.width - 24, window.innerHeight - rect.height - 24);
      }
    });
  }

  function positionPanel() {
    if (!panelOpen) return;
    const bubbleRect = root.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || Math.min(390, window.innerWidth - 24);
    const panelHeight = panel.offsetHeight || Math.min(560, window.innerHeight - 32);
    const gap = 12;
    let left = bubbleRect.right - panelWidth;
    let top = bubbleRect.top - panelHeight - gap;
    if (top < 8) top = bubbleRect.bottom + gap;
    left = clamp(left, 8, window.innerWidth - panelWidth - 8);
    top = clamp(top, 8, window.innerHeight - panelHeight - 8);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function toggle() {
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
    if (panelOpen) {
      positionPanel();
      $('sb-input').focus();
    }
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

  function nextPaint() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function takeScreenshot() {
    const button = $('sb-camera');
    if (button.disabled) return;
    button.disabled = true;
    const wasOpen = panelOpen;
    if (wasOpen) {
      panelOpen = false;
      panel.classList.remove('open');
    }
    root.classList.add('sb-capture-hidden');
    try {
      await nextPaint();
      const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
      if (!response?.dataUrl) throw new Error(response?.error || 'Screenshot မရပါ');
      pendingScreenshot = response.dataUrl;
      $('sb-preview').hidden = false;
      button.classList.add('active');
    } catch (error) {
      appendMessage(`Screenshot မရပါ: ${error.message}`, 'error');
    } finally {
      root.classList.remove('sb-capture-hidden');
      if (wasOpen) {
        panelOpen = true;
        panel.classList.add('open');
        positionPanel();
      }
      button.disabled = false;
    }
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

  function beginDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = root.getBoundingClientRect();
    dragState = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, startX: event.clientX, startY: event.clientY, moved: false };
    bubble.setPointerCapture?.(event.pointerId);
    bubble.classList.add('dragging');
    event.preventDefault();
  }

  function moveDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (distance > 4) dragState.moved = true;
    if (!dragState.moved) return;
    setRootPosition(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
    event.preventDefault();
  }

  function endDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const moved = dragState.moved;
    bubble.releasePointerCapture?.(event.pointerId);
    bubble.classList.remove('dragging');
    dragState = null;
    if (moved) {
      const rect = root.getBoundingClientRect();
      setRootPosition(rect.left, rect.top, true);
      suppressNextClick = true;
      setTimeout(() => { suppressNextClick = false; }, 0);
    }
  }

  bubble.addEventListener('pointerdown', beginDrag);
  bubble.addEventListener('pointermove', moveDrag);
  bubble.addEventListener('pointerup', endDrag);
  bubble.addEventListener('pointercancel', endDrag);
  bubble.addEventListener('click', event => {
    if (suppressNextClick) {
      event.preventDefault();
      return;
    }
    toggle();
  });
  $('sb-close').addEventListener('click', toggle);
  $('sb-camera').addEventListener('click', takeScreenshot);
  $('sb-clear-shot').addEventListener('click', clearScreenshot);
  $('sb-send').addEventListener('click', sendMessage);
  $('sb-input').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
  });
  window.addEventListener('resize', () => {
    const rect = root.getBoundingClientRect();
    setRootPosition(rect.left, rect.top);
  });
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'AI_CHUNK' && activeAssistant) updateAssistant(message.fullText || '');
  });

  restorePosition();
})();
