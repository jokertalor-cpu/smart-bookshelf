/**
 * Index Specific Script
 * Features: Pagination, Editor Choice, Category Filter
 */

let currentPage = 0;
const itemsPerPage = 30;
let isFetching = false;
let hasMore = true;
let currentMode = 'editor_choice'; 

async function loadBooks() {
    if (isFetching || !hasMore) return;
    isFetching = true;

    try {
        const from = currentPage * itemsPerPage;
        const to = from + itemsPerPage - 1;

        const { data, error } = await supabase
            .from('books')
            .select('id, title, cover, category, author, is_editor_choice')
            .range(from, to)
            .order('id', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            allBooks = [...allBooks, ...data];
            
            if (currentPage === 0) {
                initializeIndex();
            } else if (currentMode === 'all') {
                renderBooks(data, true);
            }

            currentPage++;
            if (data.length < itemsPerPage) hasMore = false;
        }
    } catch (error) {
        console.error("Index Load Error:", error.message);
    } finally {
        isFetching = false;
    }
}

// URL ကနေ search keyword ပါမပါ စစ်ပြီး အကုန်လုံးထဲက ရှာပေးမယ့်အပိုင်း
function initializeIndex() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchKey = urlParams.get('search');
    const catKey = urlParams.get('category');

    if (searchKey) {
        elements.searchInput.value = searchKey;
        window.renderBySearch(searchKey); // ဒီနေရာမှာ Database search ကို ခေါ်သုံးသွားမှာပါ
    } else if (catKey) {
        window.filterBooks(catKey);
    } else {
        // Default: Editor Choice
        const editorChoices = allBooks.filter(book => book.is_editor_choice === true);
        renderBooks(editorChoices, false);
    }
}
function renderBooks(books, isAppend = false) {
    if (!elements.container) return;
    if (!isAppend) elements.container.innerHTML = "";

    if (books.length === 0 && !isAppend) {
        elements.container.innerHTML = "<p style='text-align:center; width:100%; padding:20px;'>စာအုပ်ရှာမတွေ့ပါ။</p>";
        return;
    }

    const booksHTML = books.map(book => `
        <div class="book-card" onclick="location.href='detail.html?id=${book.id}'" style="cursor:pointer;">
            <div class="book-cover">
                <img src="${book.cover}" alt="${book.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/140x190?text=No+Cover'">
            </div>
            <div class="book-info">
                <p class="book-title">${book.title}</p>
                <p class="book-author">${book.author || 'Unknown'}</p>
            </div>
        </div>
    `).join('');

    elements.container.insertAdjacentHTML('beforeend', booksHTML);
}

// indexscript.js ထဲက ဒီ function လေးကိုပဲ အစားထိုးလိုက်ပါ
window.renderBySearch = async function(keyword) {
    if (!keyword) return;

    currentMode = 'search';
    // Loading ပြမယ်
    elements.container.innerHTML = "<p style='text-align:center; width:100%; padding:20px;'>ရှာဖွေနေပါသည်...</p>";

    try {
        // ဖုန်းထဲက ၃၀ ထဲမှာ မရှာတော့ဘဲ Database ထဲက အကုန်လုံးထဲမှာ သွားရှာမယ်
        const { data, error } = await supabase
            .from('books')
            .select('id, title, cover, category, author')
            .ilike('title', `%${keyword}%`); // စာအုပ်အားလုံးထဲက ရှာပေးမှာပါ

        if (error) throw error;

        renderBooks(data, false); // ရလာတဲ့ ရလဒ် (ဥပမာ- ၁၀၀ ရှိလဲ ၁၀၀ လုံး) ကို ပြမယ်
        if (elements.sectionTitle) elements.sectionTitle.innerText = "SEARCH RESULT";
        if (elements.viewAllBtn) elements.viewAllBtn.innerText = "VIEW ALL";
        
        scrollToBooks();
    } catch (error) {
        console.error("Search Error:", error.message);
    }
};
window.filterBooks = function(category) {
    if (category === 'all') {
        // Mode ကို တိုက်ရိုက်စစ်ပါ (innerText ကို မစစ်ပါနဲ့)
        if (currentMode !== 'all') {
            currentMode = 'all';
            renderBooks(allBooks, false);
            if (elements.sectionTitle) elements.sectionTitle.innerText = "ALL BOOKS";
            if (elements.viewAllBtn) elements.viewAllBtn.innerText = "BACK TO EDITOR CHOICE";
        } else {
            // mode က all ဖြစ်နေရင် editor choice ပြန်ပြမယ်
            currentMode = 'editor_choice';
            const editorChoices = allBooks.filter(book => book.is_editor_choice === true);
            renderBooks(editorChoices, false);
            if (elements.sectionTitle) elements.sectionTitle.innerText = "EDITOR CHOICE";
            if (elements.viewAllBtn) elements.viewAllBtn.innerText = "VIEW ALL";
        }
    } else {
        currentMode = 'category';
        const filtered = allBooks.filter(b => b.category && b.category.toLowerCase() === category.toLowerCase());
        renderBooks(filtered, false);
        if (elements.sectionTitle) elements.sectionTitle.innerText = category.toUpperCase() + " BOOKS";
        if (elements.viewAllBtn) elements.viewAllBtn.innerText = "VIEW ALL";
    }
    scrollToBooks();
};
window.addEventListener('scroll', () => {
    if (currentMode === 'all' && (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        loadBooks();
    }
});

function scrollToBooks() {
    const section = document.getElementById('book-display-section');
    if(section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

loadBooks();
