// --- ၁။ Configuration & Initialization ---
const supabaseUrl = 'https://mituedqotwbmporkwbqf.supabase.co';
const supabaseKey = 'sb_publishable_gIcm03LyduvN6WgwZek4_Q_ePBBJBUc';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Global state for books to enable searching
let allBooks = [];

// --- ၂။ Authentication ပိုင်း ---

async function handleLogin() {
    let attempts = parseInt(localStorage.getItem('loginAttempts') || '0');
    let lastAttemptTime = parseInt(localStorage.getItem('lastAttemptTime') || '0');
    const now = Date.now();

    if (attempts >= 5 && (now - lastAttemptTime) < 15 * 60 * 1000) {
        const remaining = Math.ceil((15 * 60 * 1000 - (now - lastAttemptTime)) / 60000);
        alert(`Too many failed attempts. Please wait ${remaining} minutes.`);
        return;
    } else if (attempts >= 5) {
        attempts = 0;
        localStorage.setItem('loginAttempts', '0');
    }

    const emailField = document.getElementById('login-email');
    const pwField = document.getElementById('login-pw');
    const btn = document.querySelector('#login-section .btn-main');

    const email = emailField.value.trim();
    const password = pwField.value.trim();

    if (!email || !password) {
        alert("Email နှင့် Password ဖြည့်ပါ");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            attempts++;
            localStorage.setItem('loginAttempts', attempts);
            localStorage.setItem('lastAttemptTime', Date.now());
            alert(`Login failed (${attempts}/5): ` + error.message);
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
        } else {
            localStorage.removeItem('loginAttempts'); 
            localStorage.removeItem('lastAttemptTime');
            await checkUser(); 
        }
    } catch (err) {
        alert("System Error: " + err.message);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    }
}

async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        // Database မှ role ကို တိုက်ရိုက်စစ်ဆေးခြင်း
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile && profile.role === 'admin') {
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            document.getElementById('user-email-display').textContent = user.email;
            fetchAdminBooks();
        } else {
            alert("သင်သည် Admin မဟုတ်သဖြင့် ဝင်ရောက်ခွင့်မရှိပါ။");
            await handleLogout();
        }
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    location.reload();
}

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
    }
});

checkUser();

// --- ၃။ စာအုပ်များ စီမံခန့်ခွဲခြင်း ---

async function fetchAdminBooks() {
    const { data, error } = await supabase.from('books').select('*').order('id', { ascending: false });
    if (error) {
        console.error(error);
    } else {
        allBooks = data || [];
        renderAdminTable(allBooks);
    }
}

function renderAdminTable(books) {
    const tbody = document.getElementById('admin-book-list');
    if (books.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: #64748b;">No books found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = books.map(book => `
        <tr>
            <td><img src="${book.cover}" class="book-cover-preview" onerror="this.src='https://via.placeholder.com/45x65?text=No+Cover'"></td>
            <td>
                <div style="font-weight:600; color: #1e293b;">${book.title}</div>
                <div style="font-size:0.8rem; color:#64748b;">By ${book.author}</div>
            </td>
            <td><span class="badge">${book.category}</span></td>
            <td>
                <div style="font-size:0.85rem; color: #475569;"><i class="fa-solid fa-download" style="width: 16px;"></i> ${book.download_count || 0}</div>
                <div style="font-size:0.85rem; color: #475569;"><i class="fa-solid fa-file" style="width: 16px;"></i> ${book.file_size || 'N/A'}</div>
            </td>
            <td>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-edit" onclick="editBook(${book.id})" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn btn-delete" onclick="deleteBook(${book.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function handleSearch() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    if (!query) {
        renderAdminTable(allBooks);
        return;
    }
    
    const filtered = allBooks.filter(book => 
        (book.title && book.title.toLowerCase().includes(query)) || 
        (book.author && book.author.toLowerCase().includes(query)) ||
        (book.category && book.category.toLowerCase().includes(query))
    );
    
    renderAdminTable(filtered);
}

async function uploadToStorage(inputElement, folder) {
    const file = inputElement.files[0];
    if (!file) return null;

    const fileName = `${folder}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { data, error } = await supabase.storage.from('book-assets').upload(fileName, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from('book-assets').getPublicUrl(fileName);
    return publicUrl;
}
async function uploadSeasonalIcon() {
    const file = document.getElementById('theme-file').files[0];
    const name = document.getElementById('theme-name').value;
    const category = document.getElementById('theme-category').value;
    const start = document.getElementById('theme-start')?.value || null;
    const end = document.getElementById('theme-end')?.value || null;

    if (!file || !name) return alert("ဖိုင်နှင့် အမည်ကို ဖြည့်စွက်ပါ");

    try {
        const fileName = `seasonal/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('seasonal-assets')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('seasonal-assets')
            .getPublicUrl(fileName);

        const { error: dbError } = await supabase
            .from('seasonal_themes')
            .insert([{ 
                name, category, icon_url: publicUrl, 
                start_date: start, end_date: end, is_active: true 
            }]);

        if (dbError) throw dbError;
        alert("အောင်မြင်စွာ တင်ပြီးပါပြီ");
        location.reload();
    } catch (err) {
        alert("Error: " + err.message);
    }
}
async function saveBook() {
    const id = document.getElementById('edit-book-id').value;
    const saveBtn = document.getElementById('save-btn');
    
    const title = document.getElementById('title').value.trim();
    if (!title) {
        alert("စာအုပ်အမည် ထည့်ပါ");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

    try {
        let coverUrl = document.getElementById('cover-url').value.trim();
        let downloadLink = document.getElementById('download-link').value.trim();
        let readLink = document.getElementById('read-link').value.trim();

        const coverFile = document.getElementById('cover-file');
        const pdfFile = document.getElementById('pdf-file');

        // File upload handling
        if (coverFile.files[0]) {
            coverUrl = await uploadToStorage(coverFile, 'covers');
        }
        
        if (pdfFile.files[0]) {
            const uploadedUrl = await uploadToStorage(pdfFile, 'pdfs');
            downloadLink = uploadedUrl;
            // Auto-update read link if it's empty or was previously the same as download link
            if (!readLink || readLink === document.getElementById('download-link').getAttribute('data-prev-val')) {
                readLink = uploadedUrl;
            }
        }

        const bookData = {
            title: title,
            category: document.getElementById('category').value,
            author: document.getElementById('author').value.trim(),
            description: document.getElementById('description').value.trim(),
            cover: coverUrl,
            file_size: document.getElementById('file-size').value.trim(),
            download_link: downloadLink,
            read_link: readLink,
            is_editor_choice: document.getElementById('is-editor-choice').checked
        };

        if (id) {
            const { error } = await supabase.from('books').update(bookData).eq('id', id);
            if (error) throw error;
            alert("Updated Successfully!");
        } else {
            bookData.download_count = 0;
            const { error } = await supabase.from('books').insert([bookData]);
            if (error) throw error;
            alert("Added Successfully!");
        }

        resetForm();
        fetchAdminBooks();
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = id ? '<i class="fa-solid fa-floppy-disk"></i> Update Book' : '<i class="fa-solid fa-floppy-disk"></i> Save Book Data';
    }
}

async function deleteBook(id) {
    if (confirm("Are you sure you want to delete this book? This action cannot be undone.")) {
        const { error } = await supabase.from('books').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchAdminBooks();
    }
}

async function editBook(id) {
    const { data: book } = await supabase.from('books').select('*').eq('id', id).single();
    if (book) {
        document.getElementById('edit-book-id').value = book.id;
        document.getElementById('title').value = book.title || '';
        document.getElementById('category').value = book.category || 'novel';
        document.getElementById('author').value = book.author || '';
        document.getElementById('description').value = book.description || '';
        document.getElementById('cover-url').value = book.cover || '';
        document.getElementById('file-size').value = book.file_size || '';
        document.getElementById('download-link').value = book.download_link || '';
        document.getElementById('download-link').setAttribute('data-prev-val', book.download_link || '');
        document.getElementById('read-link').value = book.read_link || '';
        document.getElementById('is-editor-choice').checked = book.is_editor_choice || false;

        document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-pen-to-square" style="color: var(--primary);"></i> Edit Book';
        document.getElementById('save-btn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Book';
        document.getElementById('cancel-btn').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function resetForm() {
    document.getElementById('edit-book-id').value = '';
    document.getElementById('title').value = '';
    document.getElementById('author').value = '';
    document.getElementById('description').value = '';
    document.getElementById('cover-url').value = '';
    document.getElementById('file-size').value = '';
    document.getElementById('download-link').value = '';
    document.getElementById('download-link').removeAttribute('data-prev-val');
    document.getElementById('read-link').value = '';
    document.getElementById('cover-file').value = '';
    document.getElementById('pdf-file').value = '';
    document.getElementById('is-editor-choice').checked = false;
    
    document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-plus-circle" style="color: var(--success);"></i> Add New Book';
    document.getElementById('save-btn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Book Data';
    document.getElementById('cancel-btn').classList.add('hidden');
}
// ၁။ Icon စာရင်းကို Database ကနေ ဆွဲထုတ်ပြီး ပြပေးတဲ့ Function
async function loadSeasonalIcons() {
    const listBody = document.getElementById('seasonal-list');
    if (!listBody) return;

    const { data, error } = await supabase
        .from('seasonal_themes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return console.error(error);

    listBody.innerHTML = data.map(item => `
        <tr>
            <td><img src="${item.icon_url}" style="width: 40px; height: 40px; object-fit: contain;"></td>
            <td><strong>${item.name}</strong></td>
            <td><span class="badge">${item.category}</span></td>
            <td>${item.start_date || '-'} to ${item.end_date || '-'}</td>
            <td>
                <button class="btn" onclick="deleteSeasonalIcon('${item.id}', '${item.icon_url}')" style="background: var(--danger); color: white; padding: 5px 10px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ၂။ Icon ကို ဖျက်တဲ့ Function
async function deleteSeasonalIcon(id, imageUrl) {
    if (!confirm("ဒီ Icon ကို ဖျက်မှာ သေချာပါသလား?")) return;

    try {
        // (က) Database ထဲက အရင်ဖျက်မယ်
        const { error: dbError } = await supabase
            .from('seasonal_themes')
            .delete()
            .eq('id', id);

        if (dbError) throw dbError;

        // (ခ) Storage ထဲက ပုံကိုလည်း ဖျက်ချင်ရင် (Optional)
        // မှတ်ချက် - URL ထဲကနေ ဖိုင်နာမည်ကို ခွဲထုတ်ဖို့ လိုပါတယ်
        const fileName = imageUrl.split('/').pop();
        await supabase.storage.from('seasonal-assets').remove([`seasonal/${fileName}`]);

        alert("ဖျက်ပြီးပါပြီ။");
        loadSeasonalIcons(); // List ကို Refresh လုပ်မယ်
    } catch (err) {
        alert("Error deleting: " + err.message);
    }
}

// Page load တဲ့အခါ Icon List ကိုပါ တစ်ခါတည်း ခေါ်ခိုင်းမယ်
document.addEventListener('DOMContentLoaded', () => {
    loadSeasonalIcons();
});
// Banner တင်ရန် (ပိုကောင်းအောင် ပြင်ဆင်ထားသော ဗားရှင်း)
async function uploadBanner() {
    const file = document.getElementById('banner-file').files[0];
    let imageUrl = document.getElementById('banner-url').value.trim();
    const linkUrl = document.getElementById('banner-link').value.trim();

    if (!file && !imageUrl) {
        return alert("ပုံဖိုင် ရွေးပါ သို့မဟုတ် Image URL ထည့်ပါ");
    }

    try {
        if (file) {
            const fileName = `banners/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const { error: uploadError } = await supabase.storage
                .from('book-assets')
                .upload(fileName, file);
            
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('book-assets')
                .getPublicUrl(fileName);
            
            imageUrl = publicUrl;
        }

        // Insert with better fields
        const { error: dbError } = await supabase.from('banners').insert([{
            image_url: imageUrl,
            link_url: linkUrl || null,
            created_at: new Date().toISOString()
        }]);

        if (dbError) throw dbError;

        alert("Banner အောင်မြင်စွာ တင်ပြီးပါပြီ!");
        
        // Form ကို ရှင်းပါ
        document.getElementById('banner-file').value = '';
        document.getElementById('banner-url').value = '';
        document.getElementById('banner-link').value = '';
        
        loadBannersAdmin();   // ချက်ချင်း refresh
    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    }
}
// ၂။ လက်ရှိ Banner များပြရန်
async function loadBannersAdmin() {
    const { data, error } = await supabase.from('banners').select('*').order('id', { ascending: false });
    const listBody = document.getElementById('banner-list');
    if (error || !listBody) return;

    listBody.innerHTML = data.map(bn => `
        <tr>
            <td><img src="${bn.image_url}" style="width: 150px; height: 60px; object-fit: cover; border-radius: 4px;"></td>
            <td>${bn.link_url || '-'}</td>
            <td>
                <button class="btn btn-delete" onclick="deleteBanner(${bn.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// ၃။ Banner ဖျက်ရန်
async function deleteBanner(id) {
    if (!confirm("ဒီပုံကို ဖျက်မှာ သေချာလား?")) return;
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) alert(error.message);
    else loadBannersAdmin();
}

// Page load တဲ့အခါ function ကို ခေါ်ထားပါ
document.addEventListener('DOMContentLoaded', () => {
    loadBannersAdmin();
});