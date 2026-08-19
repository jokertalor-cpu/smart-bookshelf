/**
 * Index Page Specific - Swiper & Book Feed
 */
const itemsLimit = 4; 
let isFetchingHome = false;
let isFetchingPopular = false;
let swiper = null;
let lastBannerRealIndex = null;
let lastBannerChangeAt = 0;

function initBannerSwiper(slideCount) {
    if (swiper && !swiper.destroyed) swiper.destroy(true, true);

    const shouldLoop = slideCount > 1;
    swiper = new Swiper('.main-slider', {
        speed: 800,
        autoplay: shouldLoop ? {
            delay: 3000,
            disableOnInteraction: false,
            // Do not pause permanently when the pointer rests over the banner.
            pauseOnMouseEnter: false
        } : false,
        loop: shouldLoop,
        pagination: { el: '.swiper-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        observer: true,
        observeParents: true
    });

    lastBannerRealIndex = swiper.realIndex;
    lastBannerChangeAt = Date.now();
    if (shouldLoop && swiper.autoplay) {
        swiper.on('realIndexChange', () => {
            lastBannerRealIndex = swiper.realIndex;
            lastBannerChangeAt = Date.now();
        });
        swiper.autoplay.start();
    }
    return swiper;
}

function restartBannerAutoplay() {
    if (!swiper || swiper.destroyed || !swiper.params.loop || !swiper.autoplay || document.hidden) return;
    swiper.autoplay.stop();
    swiper.autoplay.start();
    lastBannerChangeAt = Date.now();
}

// Recover after returning to the tab, restoring focus, or an interrupted timer.
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(restartBannerAutoplay, 100);
});
window.addEventListener('focus', () => setTimeout(restartBannerAutoplay, 100));
window.addEventListener('pageshow', () => setTimeout(restartBannerAutoplay, 100));
setInterval(() => {
    if (!swiper || swiper.destroyed || document.hidden || !swiper.params.loop) return;
    const delay = swiper.params.autoplay?.delay || 3000;
    const stale = Date.now() - lastBannerChangeAt > (delay * 2 + 1500);
    if (stale || !swiper.autoplay?.running || swiper.autoplay?.paused) restartBannerAutoplay();
}, 5000);
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
            initBannerSwiper(1);
            return;
        }

        // 2. Real banners ထည့်ပါ
        swiperWrapper.innerHTML = banners.map(bn => {
            const imageURL = window.safeAssetURL(bn.image_url, 'https://via.placeholder.com/1200x500?text=Image+Load+Error');
            return `
            <div class="swiper-slide">
                <img src="${imageURL}" alt="Banner" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" loading="lazy">
            </div>`;
        }).join('');

        console.log(`✅ Loaded ${banners.length} banner(s)`);

        setTimeout(() => initBannerSwiper(banners.length), 250);

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
// DOMContentLoaded ထဲမှာ ထည့်ခေါ်ပါ
document.addEventListener('DOMContentLoaded', () => {
    loadDynamicBanners(); // ဒါကို ထပ်ထည့်ပါ
    loadHomeBooks();
    loadPopularBooks();
    loadDownloadBooks();
});
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (swiper) {
            swiper.updateSize();
            swiper.updateSlides();
            swiper.update();

            // ✅ ဒါပေါင်းထည့်ပါ - autoplay ပြန်စပေးရန်
            if (swiper.autoplay && !swiper.autoplay.running) {
                swiper.autoplay.stop();
                swiper.autoplay.start();
            }
        }
    }, 300); // 200 → 300 အနည်းငယ် delay တိုးပါ
});

window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (swiper) {
            swiper.update();
            // ✅ ဒါပေါင်းထည့်ပါ
            if (swiper.autoplay && !swiper.autoplay.running) {
                swiper.autoplay.stop();
                swiper.autoplay.start();
            }
        }
    }, 400); // 300 → 400
});