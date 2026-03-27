
document.addEventListener('DOMContentLoaded', () => {

    fetchLatestAndRanking();

});



async function fetchLatestAndRanking() {

    try {

        // ၁။ TOP 10 RANKING (Download အများဆုံး)

        const { data: topData, error: topError } = await supabase

            .from('books')

            .select('*')

            .order('download_count', { ascending: false })

            .limit(10);



        if (topError) throw topError;

        renderBooks(topData, 'top-ranking-container', true);



        // ၂။ LATEST RELEASES (ID အကြီးဆုံးက နောက်ဆုံးတင်တာလို့ သတ်မှတ်မယ်)

        // created_at မရှိတဲ့အတွက် 'id' ကို သုံးပြီး order စီလိုက်ပါတယ်

        const { data: latestData, error: latestError } = await supabase

            .from('books')

            .select('*')

            .order('id', { ascending: false })

            .limit(10);



        if (latestError) throw latestError;

        renderBooks(latestData, 'latest-10-container', false);



    } catch (err) {

        console.error("Error:", err.message);

        // Error ဖြစ်ရင် UI မှာ ပြပေးမယ်

        const containers = ['top-ranking-container', 'latest-10-container'];

        containers.forEach(id => {

            const el = document.getElementById(id);

            if(el) el.innerHTML = `<p style="color:#ff4757; padding:20px;">Error: ${err.message}</p>`;

        });

    }

}



function renderBooks(books, containerId, isRanking) {

    const container = document.getElementById(containerId);

    if (!container) return;



    if (!books || books.length === 0) {

        container.innerHTML = '<p style="padding: 20px;">စာအုပ်များ မရှိသေးပါ။</p>';

        return;

    }



    container.innerHTML = books.map((book, index) => {

        let rankClass = 'rank-other';

        if (index === 0) rankClass = 'rank-1';

        else if (index === 1) rankClass = 'rank-2';

        else if (index === 2) rankClass = 'rank-3';



        // ဓာတ်ပုံထဲမှာ 'details.html' မတွေ့ဘူး (Cannot GET) ပြနေတဲ့အတွက်

        // ဖိုင်နာမည်ကို 'detail.html' လို့ ပြင်ထားပါတယ် (s မပါပါ)

        return `

        <div class="book-card" onclick="location.href='detail.html?id=${book.id}'" style="cursor:pointer;">

            ${isRanking ? `<div class="rank-tag ${rankClass}">#${index + 1}</div>` : ''}

            <img src="${book.cover}" alt="${book.title}" onerror="this.src='https://via.placeholder.com/150x200?text=No+Cover'">

            <div class="book-info">

                <h3 class="book-title">${book.title}</h3>

                <p class="book-author">${book.author || 'Unknown Author'}</p>

                ${isRanking ? `

                    <div class="download-info">

                        <i class="fa-solid fa-download"></i>

                        <span>${(book.download_count || 0).toLocaleString()}</span>

                    </div>

                ` : ''}

            </div>

        </div>

        `;

    }).join('');

} 
document.addEventListener('DOMContentLoaded', () => {
    fetchLatestAndRanking();
    loadPopular(); // ဒါလေး ထပ်ထည့်ပေးပါ
});

async function loadPopular() {
    const { data, error } = await supabase // supabase client name ကို သတိပြုပါ
        .from('books')
        .select('*')
        .order('likes_count', { ascending: false })
        .limit(10);
    
    if (error || !data) return;
    
    const container = document.getElementById('popular-view');
    
    container.innerHTML = data.map((book, index) => {
        // Rank အရောင် သတ်မှတ်ခြင်း (Ranking container နဲ့ ပုံစံတူအောင်)
        let rankClass = 'rank-other';
        if (index === 0) rankClass = 'rank-1';
        else if (index === 1) rankClass = 'rank-2';
        else if (index === 2) rankClass = 'rank-3';

        return `
        <div class="book-card" onclick="location.href='detail.html?id=${book.id}'" style="cursor:pointer;">
            <div class="rank-tag ${rankClass}">#${index + 1}</div>
            <img src="${book.cover}" alt="${book.title}" onerror="this.src='https://via.placeholder.com/150x200?text=No+Cover'">
            <div class="book-info">
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">${book.author || 'Unknown Author'}</p>
                <div class="download-info">
                    <i class="fa-solid fa-heart" style="color: #ff4757;"></i>
                    <span>${(book.likes_count || 0).toLocaleString()}</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}