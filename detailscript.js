// ၁။ Database တည်ဆောက်ခြင်း (Dexie.js ကိုသုံးသည်)
const db = new Dexie("MyBookLibrary");
db.version(1).stores({
    books: "id, title, author, cover, category, pdfBlob"
});

let allBooksData = [];

// ၂။ စာမျက်နှာ စတင်ဖွင့်ချိန်တွင် စာအုပ်အချက်အလက်များကို ဖတ်ယူရန်
async function loadDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = parseInt(urlParams.get('id'));

    try {
        const response = await fetch('books.json');
        allBooksData = await response.json();
        
        const book = allBooksData.find(b => b.id === bookId);

        if (book) {
            renderDetailView(book);
            checkIfAlreadyDownloaded(bookId); // သိမ်းပြီးသားစာအုပ်လား စစ်ဆေးရန်
        } else {
            document.getElementById('book-detail-display').innerHTML = "စာအုပ်ရှာမတွေ့ပါ။";
        }
    } catch (error) {
        console.error("Error loading detail:", error);
    }
}

// ၃။ UI မှာ စာအုပ်အချက်အလက်များကို ပြသခြင်း
function renderDetailView(book) {
    const display = document.getElementById('book-detail-display');
    const pdfUrl = book.pdf_url || "#";
    const fileSize = book.file_size || "N/A";

    display.innerHTML = `
        <div class="detail-content" style="text-align: center; padding: 10px;">
            <img src="${book.cover}" class="detail-img" style="width: 150px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <h2 style="margin: 15px 0 5px;">${book.title}</h2>
            <p style="color: #666; margin-bottom: 20px;">Author: ${book.author || 'Unknown'}</p>
            
            <hr style="border: 0; border-top: 1px solid #eee; margin-bottom: 20px;">

            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button onclick='saveToLibrary(${JSON.stringify(book).replace(/'/g, "&apos;")})' 
                        id="down-btn" class="download-btn" 
                        style="border:none; cursor:pointer; background-color: #2196F3; display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 5px; color: white; font-weight: bold;">
                    <i class="fa-solid fa-download"></i> DOWNLOAD (${fileSize})
                </button>

                <a href="${pdfUrl}" target="_blank" class="download-btn" 
                   style="background-color: #4CAF50; display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 5px; color: white; text-decoration: none; font-weight: bold;">
                    <i class="fa-solid fa-book-open"></i> ONLINE READ
                </a>
            </div>
        </div>
    `;
    
    // ဆက်စပ်စာအုပ်များပြသခြင်း
    showRecommendations(book, allBooksData);
}

// ၄။ အရေးကြီးဆုံးအပိုင်း - ဖိုင်ကို Fetch လုပ်ပြီး Database ထဲသိမ်းဆည်းခြင်း
async function saveToLibrary(book) {
    const btn = document.getElementById('down-btn');
    const originalHTML = btn.innerHTML;
    
    // Loading အခြေအနေပြရန်
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Downloading...';
    btn.disabled = true;

    try {
        // PDF ဖိုင်ကို Network မှ Fetch လုပ်ယူခြင်း
        const response = await fetch(book.pdf_url);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const blob = await response.blob(); // ဖိုင်ကို Binary Data (Blob) အဖြစ်ပြောင်းလဲခြင်း

        // Database (IndexedDB) ထဲသို့ အချက်အလက်များ သိမ်းဆည်းခြင်း
        await db.books.put({
            id: book.id,
            title: book.title,
            author: book.author,
            cover: book.cover,
            category: book.category,
            pdfBlob: blob // PDF ဖိုင်တစ်ခုလုံးကို သိမ်းလိုက်ပြီ
        });

        // အောင်မြင်ကြောင်းပြရန်
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved in Library';
        btn.style.backgroundColor = "#28a745";
        alert(`"${book.title}" ကို Library ထဲတွင် သိမ်းဆည်းပြီးပါပြီ။ Offline ဖတ်နိုင်ပါပြီ။`);

    } catch (error) {
        console.error("Save failed:", error);
        alert("ဒေါင်းလုဒ်ဆွဲရာတွင် အခက်အခဲရှိနေပါသည်။");
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// ၅။ စာအုပ်ဒေါင်းပြီးသားလား ကြိုတင်စစ်ဆေးရန်
async function checkIfAlreadyDownloaded(bookId) {
    const downloadedBook = await db.books.get(bookId);
    if (downloadedBook) {
        const btn = document.getElementById('down-btn');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Already in Library';
            btn.style.backgroundColor = "#28a745";
        }
    }
}

// ၆။ Related Books ပြသခြင်း (နဂိုအတိုင်း)
function showRecommendations(currentBook, allBooks) {
    const recContainer = document.getElementById('recommended-books-container');
    if (!recContainer) return;

    const recommendations = allBooks.filter(b => 
        b.id !== currentBook.id && (b.category === currentBook.category)
    ).slice(0, 4);

    recContainer.innerHTML = recommendations.map(b => `
        <div class="book-card" onclick="window.location.href='detail.html?id=${b.id}'" style="cursor:pointer;">
            <img src="${b.cover}" alt="${b.title}" style="width: 100%; border-radius: 5px;">
            <p class="title" style="font-size: 12px; margin-top: 5px; font-weight: bold;">${b.title}</p>
        </div>
    `).join('');
}

loadDetail();