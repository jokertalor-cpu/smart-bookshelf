/**
 * All Books Page Logic with Efficient Pagination
 */
const itemsPerPage = 20;
let currentPage = 1;
const urlParams = new URLSearchParams(window.location.search);
const sortType = urlParams.get('sort') || 'latest'; // Default က နောက်ဆုံးတင်တာပြမယ်
// စာအုပ်တစ်အုပ်ချင်းစီအတွက် Loading Skeleton ထုတ်ပေးမည့် function
function getSkeletons(count) {
    let skeletons = '';
    for (let i = 0; i < count; i++) {
        skeletons += `
            <div class="book-card skeleton-card">
                <div class="skeleton-img">
                    <div class="jump-bar-container">
                        <div class="jump-bar"></div>
                        <div class="jump-bar"></div>
                        <div class="jump-bar"></div>
                    </div>
                </div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
            </div>`;
    }
    return skeletons;
}

async function loadAllBooks(page) {
    const container = document.getElementById('all-books-container');
    const sortText = document.getElementById('sort-display-text');
    
    // --- Skeleton loading ကို Jump Bar animation နဲ့ ပြခြင်း ---
    container.innerHTML = getSkeletons(itemsPerPage);

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

    // Range တွက်ချက်ခြင်း (0-19, 20-39, ...)[cite: 5]
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    try {
        const { data, error, count } = await supabase
            .from('books')
            .select('*', { count: 'exact' })
            .order(orderBy, { ascending: false })
            .range(from, to);

        if (error) throw error;

        // ဒေတာ ရလာပြီဆိုရင် Skeleton များကို ဖျက်ပြီး စာအုပ်အစစ်များ ပြပါမည်[cite: 5]
        renderBooks(data);
        renderPagination(count, page);
    } catch (err) {
        console.error("Error loading books:", err);
        container.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>Error loading data.</p>";
    }
}
function renderBooks(books) {
    const container = document.getElementById('all-books-container');
    if (!books || books.length === 0) {
        container.innerHTML = "<p>စာအုပ်များ မရှိသေးပါ။</p>";
        return;
    }

    container.innerHTML = books.map(book => {
        const id = window.safeBookID(book.id);
        if (!id) return '';
        const cover = window.safeAssetURL(book.cover, 'https://via.placeholder.com/140x190?text=No+Cover');
        return `
        <a class="book-card" href="detail.html?id=${encodeURIComponent(id)}">
            <img src="${cover}" alt="${window.escapeHTML(book.title)}" loading="lazy">
            <h3>${window.escapeHTML(book.title)}</h3>
            <p>${window.escapeHTML(book.author || 'Unknown')}</p>
        </a>`;
    }).join('');
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