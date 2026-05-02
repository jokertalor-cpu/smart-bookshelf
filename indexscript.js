/**
 * Index Page Specific - Swiper & Book Feed
 */
const itemsLimit = 4; 
let isFetchingHome = false;
let isFetchingPopular = false;
const swiper = new Swiper('.main-slider', {
    speed: 800,
    autoplay: {
        delay: 3000,
        disableOnInteraction: false,
        pauseOnMouseEnter: true
    },
    loop: false,   // ❗ loop ပိတ်ထား
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
});
// Loading Skeleton
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
async function loadDynamicBanners() {
    console.log("🚀 Starting to load banners...");

    const swiperWrapper = document.querySelector('.main-slider .swiper-wrapper');
    if (!swiperWrapper) return;

    // 1. Loading Skeleton ပြပါ
    swiperWrapper.innerHTML = `
        <div class="swiper-slide banner-skeleton">
            <div class="jump-bar-container">
                <div class="jump-bar"></div>
                <div class="jump-bar"></div>
                <div class="jump-bar"></div>
            </div>
        </div>`;

    swiper.update();

    try {
        // အကောင်းဆုံး အစဉ်လိုက် ဆွဲထုတ်ပါ (created_at အဟောင်းကနေ အသစ်ဆုံး)
        const { data: banners, error } = await supabase
            .from('banners')
            .select('*')
            .order('created_at', { ascending: true });   // ← ဒီနေရာ အရေးကြီးတယ်

        if (error || !banners || banners.length === 0) {
            console.error("Banner error:", error);
            swiperWrapper.innerHTML = `<div class="swiper-slide banner-skeleton" style="background:#ffebee;color:#c62828;display:flex;align-items:center;justify-content:center;">
                No Banners Available
            </div>`;
            swiper.update();
            return;
        }

        // 2. Real banners ထည့်ပါ
        swiperWrapper.innerHTML = banners.map(bn => `
            <div class="swiper-slide">
                <img src="${bn.image_url}" 
                     alt="Banner" 
                     style="width: 100%; height: 100%; object-fit: cover; object-position: center;"
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/1200x500?text=Image+Load+Error'">
            </div>
        `).join('');

        console.log(`✅ Loaded ${banners.length} banner(s)`);

        // 3. Loop + Swiper ကို လုံးဝ ပြန်ဆောက်ပေး (အရေးကြီးဆုံး)
        setTimeout(() => {
            swiper.updateSize();
            swiper.updateSlides();
            swiper.update();

            if (swiper.params.loop && banners.length > 1) {
                swiper.loopDestroy();   // ဟောင်း loop ဖျက်
                swiper.loopCreate();    // အသစ် loop ပြန်ဆောက်
            }

            if (swiper.autoplay) {
                swiper.autoplay.stop();
                swiper.autoplay.start();
            }

            // နောက်ဆုံး တည်ငြိမ်စေရန်
            setTimeout(() => swiper.update(), 200);
        }, 250);

    } catch (err) {
        console.error("💥 Unexpected error:", err);
    }
}
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

// DOMContentLoaded ထဲမှာ ထည့်ခေါ်ပါ
document.addEventListener('DOMContentLoaded', () => {
    loadDynamicBanners(); // ဒါကို ထပ်ထည့်ပါ
    loadHomeBooks();
    loadPopularBooks();
    loadDownloadBooks();
});
// Resize နဲ့ Orientation ပြောင်းရင် ပိုတည်ငြိမ်အောင်
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (swiper) {
            swiper.updateSize();
            swiper.updateSlides();
            swiper.update();
        }
    }, 200);
});

window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (swiper) swiper.update();
    }, 300);
});