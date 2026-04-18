/**
 * Index Page Specific - Swiper & Book Feed
 */
const itemsLimit = 4; 
let isFetchingHome = false;
let isFetchingPopular = false;

// Swiper Init (Mouse over pause & PC fix included)
const swiper = new Swiper('.main-slider', {
    speed: 800,
    autoplay: { delay: 3000, disableOnInteraction: false, pauseOnMouseEnter: true },
    loop: true,
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
});

// Loading Placeholder ထုတ်ပေးမည့် Function
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
                <div class="skeleton-text title"></div>
                <div class="skeleton-text author"></div>
            </div>`;
    }
    return skeletons;
}

// ၁။ နောက်ဆုံးတင်ထားသော စာအုပ်များ ဆွဲယူခြင်း
async function loadHomeBooks() {
    if (isFetchingHome) return;
    isFetchingHome = true;
    const container = document.getElementById('book-list-container');
    container.innerHTML = getSkeletons(itemsLimit);

    try {
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .range(0, itemsLimit - 1)
            .order('id', { ascending: false });

        if (error) throw error;
        displayBooks(data, 'book-list-container');
    } catch (err) {
        console.error("Home Books Error:", err);
    } finally { isFetchingHome = false; }
}

// ၂။ လူကြိုက်အများဆုံး စာအုပ်များ ဆွဲယူခြင်း (likes_count သုံးထားသည်)
async function loadPopularBooks() {
    if (isFetchingPopular) return;
    isFetchingPopular = true;
    const container = document.getElementById('popular-books-container');
    container.innerHTML = getSkeletons(itemsLimit);

    try {
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .order('likes_count', { ascending: false }) // likes_count အများဆုံးကနေ စစီမည်
            .limit(itemsLimit);

        if (error) throw error;
        displayBooks(data, 'popular-books-container');
    } catch (err) {
        console.error("Popular Books Error:", err);
    } finally { isFetchingPopular = false; }
}
// ၃။ Download အများဆုံး စာအုပ်များ ဆွဲယူခြင်း
async function loadDownloadBooks() {
    const container = document.getElementById('download-books-container');
    if (!container) return;

    // Loading မျဉ်းလေးတွေအရင်ပြမယ်
    container.innerHTML = getSkeletons(4); 

    try {
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .order('download_count', { ascending: false }) // Download အများဆုံးမှ စစီမည်
            .limit(4);

        if (error) throw error;
        displayBooks(data, 'download-books-container');
    } catch (err) {
        console.error("Download Books Error:", err);
    }
}


function displayBooks(books, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !books) return;

    container.innerHTML = books.map(book => `
        <div class="book-card" onclick="location.href='detail.html?id=${book.id}'">
            <img src="${book.cover}" alt="${book.title}" loading="lazy" onload="this.parentElement.classList.add('loaded')">
            <h3>${book.title}</h3>
            <p>${book.author || 'Unknown'}</p>
        </div>
    `).join('');
}
// Start function ထဲမှာ ခေါ်ပေးဖို့ မမေ့ပါနဲ့
document.addEventListener('DOMContentLoaded', () => {
    loadHomeBooks();     // Latest
    loadPopularBooks();  // Likes
    loadDownloadBooks(); // Downloads
});