/**
 * Global Script - Navbar, Search & Supabase Initialization
 */
const supabaseUrl = 'https://mituedqotwbmporkwbqf.supabase.co';
const supabaseKey = 'sb_publishable_gIcm03LyduvN6WgwZek4_Q_ePBBJBUc';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
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

// --- Mobile Navigation Logic ---
if (globalElements.menuToggle) {
    globalElements.menuToggle.addEventListener('click', () => {
        globalElements.navMenu.classList.toggle('active');
        globalElements.overlay.classList.toggle('active');
    });
}

if (globalElements.overlay) {
    globalElements.overlay.addEventListener('click', () => {
        globalElements.navMenu.classList.remove('active');
        globalElements.overlay.classList.remove('active');
    });
}window.handleInput = async function(e) {
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
            suggestionBox.innerHTML = data.map(book => `
                <div class="suggestion-item" onclick="window.location.href='detail.html?id=${book.id}'">
                    <div style="font-weight: bold; font-size: 14px; color: #333;">${book.title}</div>
                    <div style="font-size: 12px; color: #777;">${book.author || 'Unknown Author'}</div>
                </div>
            `).join('');
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
            searchInput.style.backgroundImage = `url('${selected.icon_url}')`;
            console.log("Applied Icon:", selected.name);
        }
    } catch (err) {
        console.error("Icon Load Error:", err);
    }
}

// Page load တိုင်း icon ခေါ်ရန်
document.addEventListener('DOMContentLoaded', applySmartSearchIcon);