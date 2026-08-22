/**
 * Global Script - Navbar, Search & Supabase Initialization
 */
const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_KEY;
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Shared safety helpers. Keep the existing public asset hosts and block unsafe schemes.
const SAFE_ASSET_HOSTS = new Set([
    'mituedqotwbmporkwbqf.supabase.co',
    'admin-vercel.jokertalor.workers.dev',
    'via.placeholder.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
    'www.svgrepo.com',
    'www.panoramyanmar.com',
    'dzge6hlvluam4.cloudfront.net'
]);
window.escapeHTML = window.escapeHTML || function(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
};
window.safeAssetURL = window.safeAssetURL || function(value, fallback = '') {
    try {
        const url = new URL(String(value || ''), window.location.href);
        if (url.protocol !== 'https:' || !SAFE_ASSET_HOSTS.has(url.hostname)) return fallback;
        return url.href;
    } catch (_) {
        return fallback;
    }
};
window.safeBookID = window.safeBookID || function(value) {
    const id = Number.parseInt(value, 10);
    return Number.isSafeInteger(id) && id > 0 ? String(id) : '';
};

// --- Search Toggle Logic ---
const searchTrigger = document.getElementById('search-trigger');
const searchBox = document.getElementById('search-box');
const searchInput = document.getElementById('search-input');

// Global Elements
const globalElements = {
    menuToggle: document.querySelector('#mobile-menu'),
    navMenu: document.querySelector('#nav-menu'),
    overlay: document.querySelector('#menu-overlay'),
};

// --- Responsive Navigation Logic ---
const closeNavigation = () => {
    if (!globalElements.navMenu || !globalElements.overlay) return;
    globalElements.navMenu.classList.remove('active');
    globalElements.overlay.classList.remove('active');
    document.body.classList.remove('menu-open');
};

if (globalElements.menuToggle && globalElements.navMenu && globalElements.overlay) {
    globalElements.menuToggle.addEventListener('click', () => {
        const isOpen = globalElements.navMenu.classList.toggle('active');
        globalElements.overlay.classList.toggle('active', isOpen);
        document.body.classList.toggle('menu-open', isOpen);
        globalElements.menuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    globalElements.overlay.addEventListener('click', closeNavigation);
    globalElements.navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeNavigation);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeNavigation();
    });
}

window.handleInput = async function(e) {
    const keyword = e.target.value.trim();
    const suggestionBox = document.getElementById('search-suggestions');

    if (!suggestionBox) return;

    // ၁။ စာရိုက်ကွက် အားသွားရင် (သို့) စာလုံးရေ ၂ လုံးအောက်ဆိုရင် ချက်ချင်းပိတ်
    if (keyword === "" || keyword.length < 2) {
        suggestionBox.innerHTML = '';
        suggestionBox.style.display = 'none';
        return; 
    }

    try {
        const { data, error } = await supabase
            .from('books')
            .select('id, title, author')
            .ilike('title', `%${keyword}%`)
            .limit(5);

        // ၂။ Database က data ပြန်လာချိန်မှာ User က စာတွေကို အကုန်ဖျက်လိုက်ပြီလားဆိုတာ ထပ်စစ်မယ်
        // (ဒါက အင်တာနက်နှေးလို့ Result တက်လာချိန်မှာ စာမရှိတော့ရင် ပိတ်ပေးဖို့ပါ)
        const currentKeyword = document.getElementById('search-input').value.trim();
        if (currentKeyword === "" || currentKeyword.length < 2) {
            suggestionBox.innerHTML = '';
            suggestionBox.style.display = 'none';
            return;
        }

        if (data && data.length > 0) {
            suggestionBox.innerHTML = data.map(book => {
                const id = window.safeBookID(book.id);
                if (!id) return '';
                return `
                <a class="suggestion-item" href="detail.html?id=${encodeURIComponent(id)}">
                    <div style="font-weight: bold; font-size: 14px; color: #333;">${window.escapeHTML(book.title)}</div>
                    <div style="font-size: 12px; color: #777;">${window.escapeHTML(book.author || 'Unknown Author')}</div>
                </a>`;
            }).join('');
            suggestionBox.style.display = 'block';
        } else {
            suggestionBox.style.display = 'none';
        }
    } catch (err) {
        console.error("Suggestion Error:", err);
        suggestionBox.style.display = 'none';
    }
};

// --- Enter ခေါက်ရင် Search Page ကို သွားမည့် Logic ---
window.handleKeyDown = function(e) {
    if (e.key === 'Enter') {
        const keyword = e.target.value.trim();
        if (keyword) {
            document.getElementById('search-suggestions').style.display = 'none';
            // search.html ကို သွားမယ် (query ဆိုတဲ့ parameter သုံးမယ်)
            window.location.href = `search.html?query=${encodeURIComponent(keyword)}`;
        }
    }
};
// အရင်ပါပြီးသား Search Trigger Logic ကို ရှာပြီး ဖျက်လိုက်ပါ သို့မဟုတ် Comment ပေးထားပါ
/*
searchTrigger.addEventListener('click', () => { ... }); 
*/

async function applySmartSearchIcon() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    try {
        const { data: themes, error } = await supabase
            .from('seasonal_themes')
            .select('*')
            .eq('is_active', true);

        if (error || !themes || themes.length === 0) return;

        const today = new Date();
        const month = today.getMonth() + 1;
        const mmdd = `${String(month).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        // ပွဲတော်ရက် သို့မဟုတ် ရာသီအလိုက် ရွေးချယ်ခြင်း
        let pool = themes.filter(t => t.category === 'festival' && mmdd >= t.start_date && mmdd <= t.end_date);
        if (pool.length === 0) {
            const season = (month >= 3 && month <= 5) ? "summer" : (month >= 6 && month <= 10) ? "rainy" : "winter";
            pool = themes.filter(t => t.category === season);
        }

        if (pool.length > 0) {
            const selected = pool[Math.floor(Math.random() * pool.length)];
            
            // Icon ကို တိုက်ရိုက် Assign လုပ်ခြင်း
            const safeIconURL = window.safeAssetURL(selected.icon_url, '');
            if (safeIconURL) {
                searchInput.style.backgroundImage = `url("${safeIconURL}")`;
            }
            console.log("Applied Icon:", selected.name);
        }
    } catch (err) {
        console.error("Icon Load Error:", err);
    }
}

// Page load တိုင်း icon ခေါ်ရန်
document.addEventListener('DOMContentLoaded', applySmartSearchIcon);


// Register the versioned offline cache only on the deployed HTTPS origin.
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.warn('Service worker registration failed:', error);
        });
    });
}
