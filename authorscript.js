const authorSearchInput = document.getElementById('author-search');
const authorContainer = document.getElementById('author-list-container');
const bookSection = document.getElementById('author-book-section');
const resultTitle = document.getElementById('author-result-title');

let authorsList = [];
let allBooksData = [];

async function loadAuthors() {
    try {
        const response = await fetch('books.json');
        allBooksData = await response.json();
        authorsList = [...new Set(allBooksData.map(book => book.author || 'အမည်မသိစာရေးဆရာ'))];
    } catch (error) {
        console.error("Error:", error);
    }
}

// ၁။ Enter ခေါက်လျှင် ရှာဖွေမှုကို တန်းလုပ်ဆောင်ခြင်း
authorSearchInput.addEventListener('keydown', (e) => {
    if (e.key === "Enter") {
        const keyword = authorSearchInput.value.trim();
        if (keyword) executeAuthorSearch(keyword);
        authorContainer.style.display = 'none'; // Enter ခေါက်လျှင် စာရင်းကို ပိတ်လိုက်သည်
    }
});

// ၂။ စာရေးဆရာ ရိုက်ထည့်နေစဉ် Suggestion ပြခြင်း
authorSearchInput.addEventListener('input', () => {
    const keyword = authorSearchInput.value.toLowerCase().trim();
    if (keyword.length > 0) {
        const filtered = authorsList.filter(a => a.toLowerCase().includes(keyword));
        renderAuthorTags(filtered);
        authorContainer.style.display = 'flex';
    } else {
        authorContainer.style.display = 'none';
    }
});

function renderAuthorTags(authors) {
    authorContainer.innerHTML = "";
    authors.forEach(author => {
        const tag = document.createElement('div');
        tag.className = "tag-box";
        tag.style.cursor = "pointer";
        tag.innerHTML = `<i class="fa-solid fa-user-pen"></i> ${author}`;
        tag.onclick = () => {
            authorSearchInput.value = author;
            executeAuthorSearch(author);
            authorContainer.style.display = 'none';
        };
        authorContainer.appendChild(tag);
    });
}

// ၃။ Author Page မှာတင် စာအုပ်များ ပြသခြင်း
function executeAuthorSearch(authorName) {
    const filteredBooks = allBooksData.filter(book => 
        book.author.toLowerCase().includes(authorName.toLowerCase())
    );

    if (filteredBooks.length > 0) {
        renderBooks(filteredBooks); // mainscript.js ထဲက renderBooks ကို လှမ်းသုံးသည်
        resultTitle.innerText = `"${authorName}" ၏ စာအုပ်များ`;
        bookSection.style.display = 'block';
    } else {
        alert("ဤစာရေးဆရာ၏ စာအုပ်များ ရှာမတွေ့ပါ။");
        bookSection.style.display = 'none';
    }
}

loadAuthors();