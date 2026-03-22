// ၁။ Database ကို detailscript.js မှာပေးခဲ့တဲ့ နာမည်အတိုင်း ပြန်ဖွင့်ခြင်း
const db = new Dexie("MyBookLibrary");
db.version(1).stores({
    books: "id, title, author, cover, category, pdfBlob"
});

const libraryContainer = document.getElementById('downloaded-list-container');

// ၂။ Database ထဲက စာအုပ်များကို ဆွဲထုတ်ပြီး UI မှာပြသခြင်း
async function loadLibrary() {
    try {
        const savedBooks = await db.books.toArray(); // သိမ်းထားသမျှ အကုန်ယူသည်

        if (savedBooks.length === 0) {
            libraryContainer.innerHTML = `
                <div class="empty-message" style="grid-column: 1/-1; text-align: center; padding: 50px;">
                    <i class="fa-solid fa-cloud-arrow-down" style="font-size: 50px; color: #ddd;"></i>
                    <p>ဒေါင်းလုဒ်ဆွဲထားသော စာအုပ်မရှိသေးပါ။</p>
                    <a href="index.html" style="color: #2196F3; text-decoration: none;">စာအုပ်များ သွားရှာရန်</a>
                </div>
            `;
            return;
        }

        renderLibrary(savedBooks);
    } catch (error) {
        console.error("Failed to load library:", error);
    }
}

function renderLibrary(books) {
    libraryContainer.innerHTML = ""; // Container ကို အရင်ရှင်းထုတ်သည်

    books.forEach(book => {
        const bookCard = document.createElement('div');
        bookCard.className = "book-card";
        bookCard.style.position = "relative";
        
        bookCard.innerHTML = `
            <img src="${book.cover}" alt="${book.title}" style="width: 100%; border-radius: 5px;">
            <p class="title" style="font-size: 13px; font-weight: bold; margin: 8px 0 2px;">${book.title}</p>
            <small style="color: #777;">${book.author}</small>
            
            <div style="display: flex; gap: 5px; margin-top: 10px;">
                <button onclick="readOffline(${book.id})" class="download-btn" style="flex: 1; padding: 8px; font-size: 11px; background: #4CAF50;">
                    <i class="fa-solid fa-book-open"></i> READ
                </button>
                <button onclick="deleteBook(${book.id}, '${book.title.replace(/'/g, "\\'")}')" class="download-btn" style="padding: 8px; background: #e74c3c;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        libraryContainer.appendChild(bookCard);
    });
}

// ၃။ အရေးကြီးဆုံးအပိုင်း - Offline ဖတ်ရှုခြင်း Logic
async function readOffline(bookId) {
    const book = await db.books.get(bookId);
    if (book && book.pdfBlob) {
        // Blob Data ကို Browser က နားလည်တဲ့ URL အဖြစ် ခေတ္တပြောင်းလဲခြင်း
        const fileURL = URL.createObjectURL(book.pdfBlob);
        
        // Tab အသစ်မှာ PDF ကို ဖွင့်ပြသည် (အင်တာနက်မလိုပါ)
        window.open(fileURL, '_blank');
        
        // Memory ရှင်းလင်းရန် (Optional)
        // URL.revokeObjectURL(fileURL); 
    } else {
        alert("စာအုပ်ဖိုင် ရှာမတွေ့ပါ။");
    }
}

// ၄။ စာအုပ်ကို Library ထဲမှ ပြန်ဖျက်ခြင်း (Storage နေရာလွတ်စေရန်)
async function deleteBook(bookId, title) {
    if (confirm(`"${title}" ကို Library ထဲမှ ဖျက်လိုပါသလား?`)) {
        await db.books.delete(bookId);
        loadLibrary(); // စာရင်းကို Update လုပ်ရန်
    }
}

// Page Load ဖြစ်ချိန်တွင် ခေါ်ယူခြင်း
loadLibrary();