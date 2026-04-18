async function filterByCategory(categoryName) {
    const container = document.getElementById('category-book-list');
    const titleDisplay = document.getElementById('category-title');
    
    titleDisplay.innerText = `${categoryName} အမျိုးအစား စာအုပ်များ`;
    container.innerHTML = '<p>ခေတ္တစောင့်ပါ...</p>';

    // --- အမျိုးအစားဆီသို့ Scroll ဆင်းသွားစေရန် ---
    titleDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .eq('category', categoryName)
            .order('id', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            container.innerHTML = '<p style="padding: 20px;">ဤအမျိုးအစားတွင် စာအုပ်မရှိသေးပါ။</p>';
            return;
        }

        container.innerHTML = data.map(book => `
            <div class="book-card">
                <a href="detail.html?id=${book.id}">
                    <img src="${book.cover}" alt="${book.title}">
                    <h3>${book.title}</h3>
                    <p style="font-size: 12px; color: #777;">${book.author || ''}</p>
                </a>
            </div>
        `).join('');

    } catch (err) {
        console.error("Error:", err.message);
    }
}
