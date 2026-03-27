/**
 * Main Common Script (Shared by all pages)
 * Features: Supabase Init, Mobile Menu, Global Search Logic
 */

// --- ၁။ Configuration & Initialization ---
const supabaseUrl = 'https://cmguamftohgcgwdggwde.supabase.co';
const supabaseKey = 'sb_publishable_xiWtoACTDkbfjmz9RMxWdw_R5W1UtZ9';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// DOM Elements
const elements = {
    menuToggle: document.querySelector('#mobile-menu'),
    navMenu: document.querySelector('#nav-menu'),
    overlay: document.querySelector('#menu-overlay'),
    searchTrigger: document.getElementById('search-trigger'),
    searchInput: document.getElementById('search-input'),
    suggestionsList: document.getElementById('search-suggestions'),
    container: document.getElementById('book-list-container'),
    sectionTitle: document.getElementById('section-title'),
    viewAllBtn: document.getElementById('view-all-btn')
};

// Global State
let allBooks = [];

// --- ၂။ Mobile Menu Logic ---
if (elements.menuToggle) {
    elements.menuToggle.addEventListener('click', () => {
        elements.navMenu.classList.toggle('active');
        elements.overlay.classList.toggle('active');
    });
}

if (elements.overlay) {
    elements.overlay.addEventListener('click', () => {
        elements.navMenu.classList.remove('active');
        elements.overlay.classList.remove('active');
    });
}

// --- ၃။ Global Search Logic ---
if (elements.searchTrigger) {
    elements.searchTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        const wrapper = document.querySelector('.search-wrapper');
        wrapper.classList.toggle('active');
        if (wrapper.classList.contains('active')) elements.searchInput.focus();
    });
}

window.handleInput = async function() {
    const keyword = elements.searchInput.value.toLowerCase().trim();
    
    if (keyword === "") {
        elements.suggestionsList.style.display = 'none';
        return;
    }

    try {
        // Database ဆီ တိုက်ရိုက်လှမ်းမေးမယ် (စာအုပ်အားလုံးထဲက ရှာတာပါ)
        const { data, error } = await supabase
            .from('books')
            .select('title, author')
            .ilike('title', `%${keyword}%`) // နာမည်တူတာ ရှာမယ်
            .limit(6); // Suggestion ၆ ခုပဲ ပြမယ်

        if (error) throw error;

        if (data && data.length > 0) {
            elements.suggestionsList.innerHTML = data.map(book => `
                <div class="suggestion-item" onclick="selectSuggestion('${book.title.replace(/'/g, "\\\\'")}')">
                    <div style="font-weight: bold; font-size: 13px;">${book.title}</div>
                    <div style="font-size: 11px; color: #888;">${book.author || ''}</div>
                </div>
            `).join('');
            elements.suggestionsList.style.display = 'block';
        } else {
            elements.suggestionsList.style.display = 'none';
        }
    } catch (err) {
        console.error("Suggestion error:", err);
    }
};
window.executeSearch = function() {
    const keyword = elements.searchInput.value.trim();
    if (keyword === "") return;

    elements.suggestionsList.style.display = 'none';

    // Index.html မှာ မဟုတ်ရင် index.html ဆီကို Keyword ပို့ပြီး လွှတ်မယ်
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = `index.html?search=${encodeURIComponent(keyword)}`;
    } else {
        // Index မှာဆိုရင်တော့ တိုက်ရိုက်ရှာမယ်
        if (typeof window.renderBySearch === 'function') {
            window.renderBySearch(keyword);
        }
    }
};
window.selectSuggestion = function(title) {
    elements.searchInput.value = title;
    elements.suggestionsList.style.display = 'none';
    window.executeSearch();
};

window.handleKeyDown = function(event) {
    if (event.key === "Enter") window.executeSearch();
};