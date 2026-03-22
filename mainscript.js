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

// ၂။ JSON Data ဖတ်ယူခြင်းနှင့် Ranking ခေါ်ယူခြင်း
async function loadBooks() {
    try {
        const response = await fetch('books.json');
        allBooks = await response.json();
        
        // Ranking Container ရှိလျှင် Ranking ကို အရင်ပြမည်
        if (document.getElementById('top-ranking-container')) {
            displayTopRanking(allBooks);
        }

        // Editor Choice သို့မဟုတ် Search Result ပြသခြင်း
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
        console.error("Error loading JSON:", error);
    }
}

// ၃။ Top 10 Ranking ပြသသည့် Logic (New Added)
function displayTopRanking(books) {
    const rankingContainer = document.getElementById('top-ranking-container');
    if (!rankingContainer) return;

    // Download အရေအတွက်အလိုက် Sort လုပ်ပြီး Top 10 ယူခြင်း
    const sortedBooks = [...books].sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    const top10 = sortedBooks.slice(0, 10);

    rankingContainer.innerHTML = top10.map((book, index) => `
        <div class="book-card" onclick="window.location.href='detail.html?id=${book.id}'" style="position: relative; flex: 0 0 140px; cursor: pointer;">
            <div class="rank-badge" style="
                position: absolute; top: 0; left: 0; 
                background: ${index < 3 ? '#e74c3c' : '#3498db'}; 
                color: white; padding: 2px 8px; font-weight: bold; 
                border-radius: 5px 0 5px 0; font-size: 11px; z-index: 1;">
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


// --- နောက်ဆုံးတင်သော စာအုပ် ၁၀ အုပ်ပြသသည့် Function ---
function displayLatest10(books) {
    const latestContainer = document.getElementById('latest-10-container');
    if (!latestContainer) return;

    // ၁။ ID အရသော်လည်းကောင်း၊ Date အရသော်လည်းကောင်း နောက်ဆုံးတင်တာကို ရှေ့ဆုံးပို့ရန်
    // ဒီမှာတော့ ID အကြီးဆုံးက နောက်ဆုံးတင်တာလို့ ယူဆပြီး Sort လုပ်ပါမယ်
    const sortedByLatest = [...books].sort((a, b) => b.id - a.id);
    const latest10 = sortedByLatest.slice(0, 10);

    latestContainer.innerHTML = latest10.map(book => `
        <div class="book-card" onclick="window.location.href='detail.html?id=${book.id}'" style="flex: 0 0 140px; cursor: pointer;">
            <div style="position: absolute; top: 0; right: 0; background: #2ecc71; color: white; padding: 2px 6px; font-size: 10px; border-radius: 0 5px 0 5px; z-index: 1;">
                NEW
            </div>
            <img src="${book.cover}" alt="${book.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/140x190?text=No+Cover'">
            <p class="title" style="font-size: 13px; font-weight: bold; margin: 8px 0 2px; height: 32px; overflow: hidden;">${book.title}</p>
            <small style="color: #888;">${book.category.toUpperCase()}</small>
        </div>
    `).join('');
}

// loadBooks function ကို Update လုပ်ရန်
async function loadBooks() {
    try {
        const response = await fetch('books.json');
        allBooks = await response.json();
        
        // Ranking ပြရန်
        if (document.getElementById('top-ranking-container')) {
            displayTopRanking(allBooks);
        }

        // Latest 10 ပြရန် (အသစ်ထည့်သော line)
        if (document.getElementById('latest-10-container')) {
            displayLatest10(allBooks);
        }

        // ကျန်တဲ့ Editor Choice/Search စသည်တို့
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
        console.error("Error loading JSON:", error);
    }
}




// ၄။ UI မှာ စာအုပ်ကတ်များ ပြသခြင်း
function renderBooks(books) {
    const container = document.getElementById('book-list-container');
    if (!container) return; 

    container.innerHTML = ""; 

    if (books.length === 0) {
        container.innerHTML = "<p style='padding:20px; width:100%; text-align:center;'>ရလဒ်မရှိပါ။</p>";
        return;
    }

    books.forEach(book => {
        const bookHTML = `
            <div class="book-card" onclick="window.location.href='detail.html?id=${book.id}'" style="cursor:pointer;">
                <img src="${book.cover}" alt="${book.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/140x190?text=No+Cover'">
                <p class="title">${book.title}</p>
                <small>${book.category.toUpperCase()}</small>
            </div>
        `;
        container.innerHTML += bookHTML;
    });
}

// ၅။ Search UI Toggle Logic
if (searchTrigger) {
    searchTrigger.addEventListener('click', () => {
        searchBox.classList.toggle('active');
        if (searchBox.classList.contains('active')) {
            searchInput.focus();
        } else {
            suggestionsList.style.display = 'none';
            searchInput.value = '';
        }
    });
}

// ၆။ Search Suggestion Logic
function handleInput() {
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
        const limitedMatches = matches.slice(0, 6); 
        suggestionsList.innerHTML = limitedMatches.map(book => `
            <div class="suggestion-item" onclick="selectSuggestion('${book.title.replace(/'/g, "\\\\'")}')">
                <div style="font-weight: bold; font-size: 13px;">${book.title}</div>
                <div style="font-size: 11px; color: #888;">${book.author || 'Unknown Author'}</div>
            </div>
        `).join('');
        suggestionsList.style.display = 'block';
    } else {
        suggestionsList.innerHTML = '<div class="suggestion-item">ရှာမတွေ့ပါ။</div>';
        suggestionsList.style.display = 'block';
    }
}

function selectSuggestion(title) {
    searchInput.value = title;
    suggestionsList.style.display = 'none';
    executeSearch();
}

function handleKeyDown(event) {
    if (event.key === "Enter") {
        suggestionsList.style.display = 'none';
        executeSearch();
    }
}

// ၇။ Execute Search Logic
function executeSearch() {
    const keyword = searchInput.value.toLowerCase().trim();
    if (keyword === "") return;

    if (window.location.pathname.includes('authors.html') || window.location.pathname.includes('detail.html')) {
        window.location.href = `index.html?q=${encodeURIComponent(keyword)}`;
        return;
    }

    const filtered = allBooks.filter(book => 
        book.title.toLowerCase().includes(keyword) || 
        (book.author && book.author.toLowerCase().includes(keyword))
    );
    
    renderBooks(filtered);
    
    if (sectionTitle) sectionTitle.innerText = "SEARCH RESULT";
    
    if (viewAllBtn) {
        viewAllBtn.innerText = "BACK TO EDITOR CHOICE";
        viewAllBtn.onclick = () => filterBooks('all');
        viewAllBtn.style.backgroundColor = "#f39c12";
    }
    scrollToBooks();
}

// ၈။ Category Filter Logic
function filterBooks(category) {
    if (!document.getElementById('book-list-container')) return;

    if (category === 'all') {
        const editorChoices = allBooks.filter(book => book.is_editor_choice === true);
        renderBooks(editorChoices.length > 0 ? editorChoices : allBooks);
        if (sectionTitle) sectionTitle.innerText = "EDITOR CHOICE";
        if (viewAllBtn) {
            viewAllBtn.innerText = "View All";
            viewAllBtn.onclick = () => filterBooks('show-all-latest');
            viewAllBtn.style.backgroundColor = "#007bff";
        }
    } else if (category === 'show-all-latest') {
        renderBooks(allBooks);
        if (sectionTitle) sectionTitle.innerText = "ALL BOOKS";
        if (viewAllBtn) {
            viewAllBtn.innerText = "BACK TO EDITOR CHOICE";
            viewAllBtn.onclick = () => filterBooks('all');
            viewAllBtn.style.backgroundColor = "#f39c12";
        }
    } else {
        const filtered = allBooks.filter(b => b.category.toLowerCase() === category.toLowerCase());
        renderBooks(filtered);
        if (sectionTitle) sectionTitle.innerText = category.toUpperCase() + " BOOKS";
        if (viewAllBtn) {
            viewAllBtn.innerText = "BACK TO EDITOR CHOICE";
            viewAllBtn.onclick = () => filterBooks('all');
            viewAllBtn.style.backgroundColor = "#f39c12";
        }
    }
    scrollToBooks();
}

function scrollToBooks() {
    const section = document.getElementById('book-display-section');
    if(section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

loadBooks();