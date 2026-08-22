/*
 * Global helpers, seasonal search icon & Supabase initialization
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
