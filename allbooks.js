/**
 * All Books Page Logic with Efficient Pagination
 */
const itemsPerPage = 20;
let currentPage = 1;
const urlParams = new URLSearchParams(window.location.search);
const sortType = urlParams.get('sort') || 'latest'; // Default က နောက်ဆုံးတင်တာပြမယ်

async function loadAllBooks(page) {
    const container = document.getElementById('all-books-container');
    const sortText = document.getElementById('sort-display-text');
    
    // Skeleton loading ပြရန် (indexscript.js ထဲက getSkeletons ကို သုံးနိုင်သည်)
    container.innerHTML = typeof getSkeletons === 'function' ? getSkeletons(8) : 'Loading...';

    // Sort Logic သတ်မှတ်ခြင်း
    let orderBy = 'id';
    let label = "နောက်ဆုံးတင်ထားသော စာအုပ်များ";

    if (sortType === 'popular') {
        orderBy = 'likes_count';
        label = "လူကြိုက်အများဆုံး စာအုပ်များ";
    } else if (sortType === 'downloads') {
        orderBy = 'download_count';
        label = "Download အများဆုံး စာအုပ်များ";
    }
    sortText.innerText = label;

    // Range တွက်ချက်ခြင်း (0-19, 20-39, ...)
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    try {
        // Data နဲ့ Total Count ကို တစ်ခါတည်း ဆွဲယူခြင်း
        const { data, error, count } = await supabase
            .from('books')
            .select('*', { count: 'exact' })
            .order(orderBy, { ascending: false })
            .range(from, to);

        if (error) throw error;

        renderBooks(data);
        renderPagination(count, page);
    } catch (err) {
        console.error("Error loading books:", err);
        container.innerHTML = "Error loading data.";
    }
}

function renderBooks(books) {
    const container = document.getElementById('all-books-container');
    if (!books || books.length === 0) {
        container.innerHTML = "<p>စာအုပ်များ မရှိသေးပါ။</p>";
        return;
    }

    container.innerHTML = books.map(book => `
        <div class="book-card" onclick="location.href='detail.html?id=${book.id}'">
            <img src="${book.cover}" alt="${book.title}" loading="lazy" onload="this.parentElement.classList.add('loaded')">
            <h3>${book.title}</h3>
            <p>${book.author || 'Unknown'}</p>
        </div>
    `).join('');
}
/**
 * Pagination ကို ပိုမိုကောင်းမွန်အောင် ပြင်ဆင်ခြင်း
 */
function renderPagination(totalItems, activePage) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationControls = document.getElementById('pagination-controls');
    paginationControls.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevBtn.disabled = activePage === 1;
    prevBtn.onclick = () => {
        currentPage--;
        goToPage(currentPage);
    };
    paginationControls.appendChild(prevBtn);

    // Page Numbers Logic (1, 2, 3 ... 25, 26 ပုံစံမျိုး ထွက်လာစေရန်)
    const range = 2; // Active page ရဲ့ ဘေးတစ်ဖက်တစ်ချက်မှာ ပြချင်တဲ့ အရေအတွက်
    let pages = [];

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= activePage - range && i <= activePage + range)) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== "...") {
            pages.push("...");
        }
    }

    pages.forEach(p => {
        if (p === "...") {
            const span = document.createElement('span');
            span.innerText = "...";
            span.style.padding = "0 10px";
            paginationControls.appendChild(span);
        } else {
            const btn = document.createElement('button');
            btn.className = `page-btn ${p === activePage ? 'active' : ''}`;
            btn.innerText = p;
            btn.onclick = () => goToPage(p);
            paginationControls.appendChild(btn);
        }
    });

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextBtn.disabled = activePage === totalPages;
    nextBtn.onclick = () => {
        currentPage++;
        goToPage(currentPage);
    };
    paginationControls.appendChild(nextBtn);
}

function goToPage(page) {
    currentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Smooth scroll ဖြစ်စေရန်
    loadAllBooks(currentPage);
}
   

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadAllBooks(currentPage);
});