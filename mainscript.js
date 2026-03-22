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

// ၂။ JSON Data ဖတ်ယူခြင်း
async function loadBooks() {
    try {
        const response = await fetch('books.json');
        allBooks = await response.json();
        
        // အကယ်၍ index.html မှာရှိနေရင် Editor Choice တွေကိုပြမယ်
        if (document.getElementById('book-list-container')) {
            // URL မှာ search query ပါမပါ အရင်စစ်မယ် (authors page က လွှတ်လိုက်တာမျိုး)
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

// ၃။ UI မှာ စာအုပ်ကတ်များ ပြသခြင်း (Detail Page Link ပါဝင်သည်)
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

// ၄။ Search UI Toggle Logic
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

// ၅။ Search Suggestion Logic (စာရေးဆရာအမည်ပါပြသခြင်း)
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
            <div class="suggestion-item" onclick="selectSuggestion('${book.title.replace(/'/g, "\\'")}')">
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

// ၆။ Execute Search Logic (Page Detection ပါဝင်သည်)
function executeSearch() {
    const keyword = searchInput.value.toLowerCase().trim();
    if (keyword === "") return;

    // အရေးကြီးဆုံးအချက် - အကယ်၍ authors.html မှာရောက်နေရင် index.html ကို ရလဒ်နဲ့အတူ လွှတ်ပေးရပါမယ်
    if (window.location.pathname.includes('authors.html') || window.location.pathname.includes('detail.html')) {
        window.location.href = `index.html?q=${encodeURIComponent(keyword)}`;
        return;
    }

    const filtered = allBooks.filter(book => 
        book.title.toLowerCase().includes(keyword) || 
        (book.author && book.author.toLowerCase().includes(keyword))
    );
    
    renderBooks(filtered);
    
    if (sectionTitle) {
        sectionTitle.innerText = "SEARCH RESULT";
    }
    
    if (viewAllBtn) {
        viewAllBtn.innerText = "BACK TO EDITOR CHOICE";
        viewAllBtn.onclick = () => filterBooks('all');
        viewAllBtn.style.backgroundColor = "#f39c12";
    }
    scrollToBooks();
}

// ၇။ Category Filter Logic
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

// Page စတင်ဖွင့်ချိန်တွင် အလုပ်လုပ်ရန်
loadBooks();