// --- ၁။ Global Variables ---
let currentPage = 0;
const itemsPerPage = 12; 
let allBooks = [];

const menuToggle = document.querySelector('#mobile-menu'); 
const navMenu = document.querySelector('#nav-menu'); 
const overlay = document.querySelector('#menu-overlay'); 
const searchInput = document.getElementById('search-input');
const suggestionsList = document.getElementById('search-suggestions');
const sectionTitle = document.getElementById('section-title');

// --- ၂။ Initialization ---
async function init() {
    // Supabase ချိတ်ဆက်မှု ရှိမရှိ အရင်စစ်မယ်
    if (typeof supabase === 'undefined') {
        console.error("Supabase is not defined. Make sure config.js is loaded before mainscript.js");
        return;
    }
    await loadBooks();
    checkURLParameters();
}

// --- ၃။ Pagination & Loading Logic ---
async function loadBooks() {
    currentPage = 0;
    allBooks = [];
    await fetchBooksFromSupabase(currentPage);
}

async function fetchBooksFromSupabase(page) {
    try {
        const from = page * itemsPerPage;
        const to = from + itemsPerPage - 1;

        const { data, error } = await supabase
            .from('books')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
            allBooks = page === 0 ? data : [...allBooks, ...data];
            renderBooks(allBooks); // နာမည်ကို renderBooks လို့ ပြင်ထားတယ်

            toggleLoadMoreBtn(data.length === itemsPerPage);
        } else {
            toggleLoadMoreBtn(false);
        }
    } catch (error) {
        console.error("Error loading books:", error);
    }
}

// --- ၄။ UI Rendering ---
function renderBooks(books) {
    const container = document.getElementById('book-list-container');
    if (!container) return;

    if (books.length === 0) {
        container.innerHTML = "<p style='text-align:center; width:100%;'>စာအုပ်ရှာမတွေ့ပါ။</p>";
        return;
    }

    container.innerHTML = books.map(book => `
        <div class="book-card" onclick="location.href='detail.html?id=${book.id}'" style="cursor:pointer;">
            <div class="book-cover">
                <img src="${book.cover}" alt="${book.title}" loading="lazy">
            </div>
            <div class="book-info">
                <p class="book-title">${book.title}</p>
                <p class="book-author">${book.author || 'Unknown'}</p>
            </div>
        </div>
    `).join('');
}

// --- ၅။ Search & Filter Logic (စနစ်တကျ ပေါင်းစည်းထားခြင်း) ---
window.filterBooks = function(category) {
    // လက်ရှိ page က index.html မဟုတ်ရင် redirect လုပ်မယ်
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    
    if (!isIndex) {
        window.location.href = `index.html?category=${encodeURIComponent(category)}`;
        return;
    }

    if (category === 'all') {
        renderBooks(allBooks); 
        if (sectionTitle) sectionTitle.innerText = "ALL BOOKS";
    } else {
        const filtered = allBooks.filter(b => b.category && b.category.toLowerCase() === category.toLowerCase());
        renderBooks(filtered);
        if (sectionTitle) sectionTitle.innerText = category.toUpperCase() + " BOOKS";
    }
    scrollToBooks();
}

function toggleLoadMoreBtn(isVisible) {
    const btn = document.getElementById('load-more-btn');
    const msg = document.getElementById('no-more-books');
    if (btn) btn.style.display = isVisible ? 'inline-block' : 'none';
    if (msg) msg.style.display = isVisible ? 'none' : 'block';
}

// --- ၆။ Event Listeners (Safe implementation) ---
if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        overlay.classList.toggle('active');
    });
}

// စတင်အလုပ်လုပ်ရန် ခေါ်ယူခြင်း
init();
