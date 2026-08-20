const signInBtn = document.getElementById('signInBtn');
const activateBtn = document.getElementById('activateBtn');
const signOutBtn = document.getElementById('signOutBtn');
const modelSelect = document.getElementById('modelSelect');
const statusDot = document.getElementById('statusDot');
const statusTitle = document.getElementById('statusTitle');
const statusText = document.getElementById('statusText');
const message = document.getElementById('message');

function send(message) {
  return new Promise(resolve => chrome.runtime.sendMessage(message, resolve));
}

function showMessage(text, ok = false) {
  message.textContent = text;
  message.className = `message${ok ? ' ok' : ''}`;
}

function setStatus(signedIn) {
  statusDot.className = `dot ${signedIn ? 'on' : 'off'}`;
  statusTitle.textContent = signedIn ? 'Signed in ဖြစ်နေပါသည်' : 'Sign in မဝင်ရသေးပါ';
  statusText.textContent = signedIn ? 'HTTP/HTTPS website များတွင် AI bubble အလိုအလျောက်ပေါ်ပါမည်။' : 'Extension ကို အသုံးပြုရန် SmartBookshelf ဖြင့် sign in ဝင်ပါ။';
  activateBtn.disabled = !signedIn;
  signOutBtn.disabled = !signedIn;
  signInBtn.disabled = signedIn;
  signInBtn.textContent = signedIn ? 'Signed in ဖြစ်နေပါသည်' : 'SmartBookshelf ဖြင့် Sign in ဝင်မည်';
}

async function refreshStatus() {
  const result = await send({ type: 'GET_STATUS' });
  setStatus(Boolean(result?.signedIn));
}

modelSelect.addEventListener('change', () => {
  chrome.storage.local.set({ model: modelSelect.value });
});

signInBtn.addEventListener('click', async () => {
  signInBtn.disabled = true;
  showMessage('Sign-in page ကို ဖွင့်နေသည်...', true);
  const result = await send({ type: 'START_SIGN_IN' });
  if (result?.error) showMessage(result.error);
  await refreshStatus();
  if (result?.ok) showMessage('Sign in အောင်မြင်ပါသည်။', true);
});

activateBtn.addEventListener('click', async () => {
  activateBtn.disabled = true;
  const result = await send({ type: 'ACTIVATE_TAB' });
  if (result?.error) showMessage(result.error);
  else showMessage('လက်ရှိ tab တွင် AI bubble ပြန်ဖွင့်ပြီးပါပြီ။', true);
  await refreshStatus();
});

signOutBtn.addEventListener('click', async () => {
  signOutBtn.disabled = true;
  const result = await send({ type: 'SIGN_OUT' });
  if (result?.error) showMessage(result.error);
  else showMessage('Session ကို ဖျက်ပြီးပါပြီ။', true);
  await refreshStatus();
});

chrome.storage.local.get(['model'], data => {
  if (data.model) modelSelect.value = data.model;
});
refreshStatus();
