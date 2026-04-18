// searchscript.js
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const keyword = urlParams.get('query'); // URL က query ကို ဖတ်မယ်
    const container = document.getElementById('search-results-container');
    const titleText = document.getElementById('search-title');

    if (!keyword) {
        container.innerHTML = "<p style='padding:20px;'>ရှာဖွေမည့် စကားလုံး မရှိပါ။</p>";
        return;
    }

    titleText.innerText = `"${keyword}" ရှာဖွေမှုရလဒ်`;
    container.innerHTML = "<p>ရှာဖွေနေပါသည်...</p>";

    try {
        // Supabase ကနေ ရှာမယ်
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .ilike('title', `%${keyword}%`);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = "<p style='padding:20px;'>စာအုပ်ရှာမတွေ့ပါ။</p>";
            return;
        }

        // ရှာတွေ့တဲ့ စာအုပ်တွေကို ပြမယ်
        container.innerHTML = data.map(book => `
            <div class="book-card" onclick="location.href='detail.html?id=${book.id}'">
                <img src="${book.cover}" alt="${book.title}" onerror="this.src='https://via.placeholder.com/150x200?text=No+Cover'">
                <h3>${book.title}</h3>
                <p>${book.author || 'Unknown'}</p>
            </div>
        `).join('');

    } catch (err) {
        console.error("Search Error:", err);
        container.innerHTML = "<p>Error တစ်ခုခု ဖြစ်ပွားခဲ့ပါသည်။</p>";
    }
});