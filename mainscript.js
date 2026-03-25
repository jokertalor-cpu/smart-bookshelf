const supabaseUrl = 'https://cmguamftohgcgwdggwde.supabase.co'; // သင့် Project URL
const supabaseKey = 'sb_publishable_xiWtoACTDkbfjmz9RMxWdw_R5W1UtZ9'; // သင့် Publishable Key
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
const menuToggle = document.querySelector('#mobile-menu'); 
const navMenu = document.querySelector('#nav-menu'); 
const overlay = document.querySelector('#menu-overlay'); 
const searchTrigger = document.getElementById('search-trigger');
const searchBox = document.getElementById('search-box');
const searchInput = document.getElementById('search-input');
const suggestionsList = document.getElementById('search-suggestions');
const sectionTitle = document.getElementById('section-title');
const viewAllBtn = document.getElementById('view-all-btn');

let allBooks = [];

// ၁။ Mobile Menu ဖွင့်/ပိတ် Logic
if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        overlay.classList.toggle('active');
    });
}

if (overlay) {
    overlay.addEventListener('click', () => {
        navMenu.classList.remove('active');
        overlay.classList.remove('active');
    });
}

async function loadBooks() {
    try {
        // 'books' ဆိုတာ သင့် Supabase table နာမည်ဖြစ်ရပါမယ်
        const { data, error } = await supabase
            .from('books')
            .select('*');

        if (error) throw error;
        
        allBooks = data; // Supabase ကရတဲ့ data array ကို allBooks ထဲထည့်
        checkURLParameters();

        // UI ပြသခြင်း logic များ
        if (document.getElementById('top-ranking-container')) {
            displayTopRanking(allBooks);
        }

        if (document.getElementById('latest-10-container')) {
            displayLatest10(allBooks);
        }

        if (document.getElementById('book-list-container')) {
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('q');
            
            if (query) {
                searchInput.value = query;
                executeSearch();
            } else {
                filterBooks('all');
            }
        }
    } catch (error) {
        console.error("Supabase Error:", error.message);
        const container = document.getElementById('book-list-container');
        if (container) container.innerHTML = "<p>Data ချိတ်ဆက်မှု အမှားရှိနေပါသည်။</p>";
    }
}
// ၃။ Top 10 Ranking ပြသခြင်း
function displayTopRanking(books) {
    const rankingContainer = document.getElementById('top-ranking-container');
    if (!rankingContainer) return;

    const sortedBooks = [...books].sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    const top10 = sortedBooks.slice(0, 10);

    rankingContainer.innerHTML = top10.map((book, index) => `
        <div class="book-card" onclick="window.location.href='detail.html?id=${book.id}'" style="position: relative; flex: 0 0 140px; cursor: pointer;">
            <div class="rank-badge" style="position: absolute; top: 0; left: 0; background: ${index < 3 ? '#e74c3c' : '#3498db'}; color: white; padding: 2px 8px; font-weight: bold; border-radius: 5px 0 5px 0; font-size: 11px; z-index: 1;">
                #${index + 1}
            </div>
            <img src="${book.cover}" alt="${book.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/140x190?text=No+Cover'">
            <p class="title" style="font-size: 13px; font-weight: bold; margin: 8px 0 2px; height: 32px; overflow: hidden;">${book.title}</p>
            <div style="font-size: 11px; color: #888;">
                <i class="fa-solid fa-download"></i> ${book.download_count?.toLocaleString() || 0}
            </div>
        </div>
    `).join('');
}

// ၄။ Latest 10 ပြသခြင်း
function displayLatest10(books) {
    const latestContainer = document.getElementById('latest-10-container');
    if (!latestContainer) return;

    const sortedByLatest = [...books].sort((a, b) => b.id - a.id);
    const latest10 = sortedByLatest.slice(0, 10);

    latestContainer.innerHTML = latest10.map(book => `
        <div class="book-card" onclick="window.location.href='detail.html?id=${book.id}'" style="flex: 0 0 140px; cursor: pointer;">
            <div style="position: absolute; top: 0; right: 0; background: #2ecc71; color: white; padding: 2px 6px; font-size: 10px; border-radius: 0 5px 0 5px; z-index: 1;">NEW</div>
            <img src="${book.cover}" alt="${book.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/140x190?text=No+Cover'">
            <p class="title" style="font-size: 13px; font-weight: bold; margin: 8px 0 2px; height: 32px; overflow: hidden;">${book.title}</p>
            <small style="color: #888;">${book.category ? book.category.toUpperCase() : 'GENERAL'}</small>
        </div>
    `).join('');
}

// ဤ function သည် Card နှိပ်ရင် Detail သို့သွားရန် link ပါပြီးသားဖြစ်သည်
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

// --- ၆။ Search & Navigation Logic (Updated) ---

// Search Box ဆန့်ထွက်လာစေရန် (Trigger Logic)
if (searchTrigger) {
    searchTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        const wrapper = document.querySelector('.search-wrapper');
        wrapper.classList.toggle('active');
        
        if (wrapper.classList.contains('active')) {
            searchInput.focus();
        }
    });
}

// စာရိုက်နေစဉ် Suggestion ပြရန်
window.handleInput = function() {
    const keyword = searchInput.value.toLowerCase().trim();
    if (keyword === "") {
        suggestionsList.style.display = 'none';
        return;
    }

    const matches = allBooks.filter(book => 
        book.title.toLowerCase().includes(keyword) || 
        (book.author && book.author.toLowerCase().includes(keyword))
    );
    
    if (matches.length > 0) {
        suggestionsList.innerHTML = matches.slice(0, 6).map(book => `
            <div class="suggestion-item" onclick="selectSuggestion('${book.title.replace(/'/g, "\\\\'")}')">
                <div style="font-weight: bold; font-size: 13px;">${book.title}</div>
                <div style="font-size: 11px; color: #888;">${book.author || ''}</div>
            </div>
        `).join('');
        suggestionsList.style.display = 'block';
    } else {
        suggestionsList.style.display = 'none';
    }
}

// Suggestion ထဲမှ တစ်ခုကို ရွေးလိုက်လျှင်
window.selectSuggestion = function(title) {
    searchInput.value = title;
    suggestionsList.style.display = 'none';
    executeSearch();
}

// Enter ခေါက်လိုက်လျှင်
window.handleKeyDown = function(event) {
    if (event.key === "Enter") {
        executeSearch();
    }
}

// အဓိက ရှာဖွေသည့် Function
function executeSearch() {
    const keyword = searchInput.value.toLowerCase().trim();
    if (keyword === "") return;
    
    // Suggestion box ကို ပိတ်မယ်
    if (suggestionsList) suggestionsList.style.display = 'none';

    // လက်ရှိ page က index.html မဟုတ်ရင် index ကို search parameter နဲ့ လှမ်းပို့မယ်
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = `index.html?search=${encodeURIComponent(keyword)}`;
        return;
    }

    // index.html မှာပဲဆိုရင် ပုံမှန်အတိုင်း ရှာဖွေပြီး result ပြမယ်
    const filtered = allBooks.filter(book => 
        book.title.toLowerCase().includes(keyword) || 
        (book.author && book.author.toLowerCase().includes(keyword))
    );
    
    renderBooks(filtered);
    if (sectionTitle) sectionTitle.innerText = "SEARCH RESULT";
    scrollToBooks();
}

// Category သို့မဟုတ် View All ကို နှိပ်သည့်အခါ
window.filterBooks = function(category) {
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = `index.html?category=${encodeURIComponent(category)}`;
        return;
    }

    if (category === 'all') {
        // View All နှိပ်ရင် Editor Choice မဟုတ်ဘဲ စာအုပ်အားလုံးပြချင်ရင် allBooks ကိုသုံးပါ
        renderBooks(allBooks); 
        if (sectionTitle) sectionTitle.innerText = "ALL BOOKS";
    } else {
        const filtered = allBooks.filter(b => b.category && b.category.toLowerCase() === category.toLowerCase());
        renderBooks(filtered);
        if (sectionTitle) sectionTitle.innerText = category.toUpperCase() + " BOOKS";
    }
    scrollToBooks();
}

// URL Parameter များကို စစ်ဆေးသည့် Function
async function checkURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchKey = urlParams.get('search');
    const catKey = urlParams.get('category');

    if (searchKey || catKey) {
        const waitForData = setInterval(() => {
            if (typeof allBooks !== 'undefined' && allBooks.length > 0) {
                if (searchKey) {
                    searchInput.value = searchKey;
                    const filtered = allBooks.filter(book => 
                        book.title.toLowerCase().includes(searchKey.toLowerCase())
                    );
                    renderBooks(filtered);
                    if (sectionTitle) sectionTitle.innerText = "SEARCH RESULT";
                } else if (catKey) {
                    filterBooks(catKey);
                }
                clearInterval(waitForData);
            }
        }, 300);
    }
}
// ၇။ Category Filter
window.filterBooks = function(category) {
    if (category === 'all') {
        const editorChoices = allBooks.filter(book => book.is_editor_choice === true);
        renderBooks(editorChoices.length > 0 ? editorChoices : allBooks);
        if (sectionTitle) sectionTitle.innerText = "EDITOR CHOICE";
    } else {
        const filtered = allBooks.filter(b => b.category && b.category.toLowerCase() === category.toLowerCase());
        renderBooks(filtered);
        if (sectionTitle) sectionTitle.innerText = category.toUpperCase() + " BOOKS";
    }
    scrollToBooks();
}

function scrollToBooks() {
    const section = document.getElementById('book-display-section');
    if(section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Download ဆွဲချိန်မှာ အကုန်လုံးကို တစ်ခါတည်းလုပ်ပေးမယ့် function
async function handleDownload(bookId, currentCount) {
    // ၁။ Library ထဲသို့ ထည့်ခြင်း
    let library = JSON.parse(localStorage.getItem('myLibrary')) || [];
    if (!library.includes(bookId)) {
        library.push(bookId);
        localStorage.setItem('myLibrary', JSON.stringify(library));
        console.log("Added to Library");
    }

    // ၂။ Database မှာ Count တိုးခြင်း
    try {
        await supabase
            .from('books')
            .update({ download_count: (currentCount || 0) + 1 })
            .eq('id', bookId);
        console.log("Count Updated");
    } catch (err) {
        console.error("Update failed:", err);
    }
    
    // မှတ်ချက် - HTML ထဲက <a> tag ရဲ့ href ကြောင့် download က အလိုအလျောက် ကျလာပါလိမ့်မယ်။
}
function removeFromLibrary(bookId) {
    if (confirm("ဤစာအုပ်ကို Library ထဲမှ ဖျက်ထုတ်ရန် သေချာပါသလား?")) {
        let library = JSON.parse(localStorage.getItem('myLibrary')) || [];
        library = library.filter(id => id !== bookId);
        localStorage.setItem('myLibrary', JSON.stringify(library));
        
        // library.html မှာ ရှိနေရင် list ကို ချက်ချင်း refresh လုပ်မယ်
        if (typeof renderLibrary === 'function') {
            renderLibrary();
        }
    }
}
// --- ၇။ Hybrid Offline Download System ---

// Offline Database တည်ဆောက်ခြင်း
const db = new Dexie("MmBookshelfDB");
db.version(1).stores({
    downloaded_books: 'id, title, author, cover, fileBlob, file_size'
});

async function handleHybridDownload(book) {
    try {
        console.log("Downloading...", book.title);
        
        // ၁။ ဖိုင်ကို Fetch လုပ်ယူမယ်
        const response = await fetch(book.download_link);
        if (!response.ok) throw new Error("ဖိုင်ဒေါင်းလုဒ်ဆွဲ၍ မရပါ။");
        const blob = await response.blob();

        // ၂။ IndexedDB (App Library) ထဲမှာ အရင်သိမ်းမယ်
        await db.downloaded_books.put({
            id: book.id,
            title: book.title,
            author: book.author,
            cover: book.cover,
            file_size: book.file_size,
            fileBlob: blob // ဒီ Blob ရှိမှ Offline ဖတ်လို့ရမှာပါ
        });

        // ၃။ Device Storage ထဲသို့ Save လုပ်မယ် (Auto Download)
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${book.title}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // ၄။ Supabase မှာ Count တိုးမယ်
        updateDownloadCount(book.id);

        alert("Library ထဲသို့ ထည့်သွင်းပြီးပါပြီ။ Offline ဖတ်ရှုနိုင်ပါသည်။");
        
    } catch (error) {
        console.error("Download failed:", error);
        alert("Error: " + error.message);
    }
}
async function updateDownloadCount(bookId) {
    try {
        const { data, error } = await supabase.rpc('increment_download', { row_id: bookId });
        if (error) throw error;
        console.log("Download count updated!");
    } catch (err) {
        console.error("Error updating count:", err);
    }
}
// စတင်အလုပ်လုပ်ရန်
loadBooks();
