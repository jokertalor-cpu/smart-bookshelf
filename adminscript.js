// --- ၁။ Configuration & Initialization ---
const supabaseUrl = 'https://cmguamftohgcgwdggwde.supabase.co';
const supabaseKey = 'sb_publishable_xiWtoACTDkbfjmz9RMxWdw_R5W1UtZ9';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Admin email စာရင်း (အများကြီးထည့်လို့ရအောင် Array ပြောင်းထားပါတယ်)
const ADMIN_LIST = [
    "thanhtet2004@gmail.com",
    "khaingzinoo171224@gmail.com"
];

// --- ၂။ Authentication ပိုင်း ---

async function handleLogin() {
    let attempts = parseInt(localStorage.getItem('loginAttempts') || '0');

    if (attempts >= 5) {
        alert("Too many failed attempts. Please wait 15 minutes.");
        return;
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
            alert(`Login failed (${attempts}/5): ` + error.message);
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
        } else {
            localStorage.removeItem('loginAttempts'); 
            await checkUser(); 
        }
    } catch (err) {
        alert("System Error: " + err.message);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
    }
}

async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        // စာရင်းထဲမှာ email ပါသလား စစ်ဆေးခြင်း
        if (ADMIN_LIST.includes(user.email)) {
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            fetchAdminBooks();
        } else {
            alert("Unauthorized access! You are not an admin.");
            await handleLogout();
        }
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    location.reload();
}

// Auth အပြောင်းအလဲ စောင့်ကြည့်
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
    }
});

// Page စဖွင့်ချင်း စစ်ဆေး
checkUser();

// --- ၃။ စာအုပ်များ စီမံခန့်ခွဲခြင်း ---

async function fetchAdminBooks() {
    const { data, error } = await supabase.from('books').select('*').order('id', { ascending: false });
    if (error) {
        console.error(error);
    } else {
        renderAdminTable(data);
    }
}

function renderAdminTable(books) {
    const tbody = document.getElementById('admin-book-list');
    tbody.innerHTML = books.map(book => `
        <tr>
            <td><img src="${book.cover}" class="book-cover-preview" onerror="this.src='https://via.placeholder.com/45x60'"></td>
            <td>
                <div style="font-weight:600;">${book.title}</div>
                <div style="font-size:0.8rem; color:#64748b;">By ${book.author}</div>
            </td>
            <td><span style="text-transform:uppercase; font-size:0.8rem; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${book.category}</span></td>
            <td>
                <div style="font-size:0.85rem;"><i class="fa-solid fa-download"></i> ${book.download_count || 0}</div>
                <div style="font-size:0.85rem;"><i class="fa-solid fa-file"></i> ${book.file_size || 'N/A'}</div>
            </td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-edit" onclick="editBook(${book.id})"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn btn-delete" onclick="deleteBook(${book.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function uploadToStorage(inputElement, folder) {
    const file = inputElement.files[0];
    if (!file) return null;

    const fileName = `${folder}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('book-assets').upload(fileName, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from('book-assets').getPublicUrl(fileName);
    return publicUrl;
}

async function saveBook() {
    const id = document.getElementById('edit-book-id').value;
    const saveBtn = document.getElementById('save-btn');
    
    // UI Validation
    if (!document.getElementById('title').value) {
        alert("စာအုပ်အမည် ထည့်ပါ");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

    try {
        let coverUrl = document.getElementById('cover-url').value;
        let downloadLink = document.getElementById('download-link').value;
        let readLink = document.getElementById('read-link').value;

        const coverFile = document.getElementById('cover-file');
        const pdfFile = document.getElementById('pdf-file');

        if (coverFile.files[0]) {
            coverUrl = await uploadToStorage(coverFile, 'covers');
        }
        
        if (pdfFile.files[0]) {
            const uploadedUrl = await uploadToStorage(pdfFile, 'pdfs');
            downloadLink = uploadedUrl;
            if (!readLink) readLink = uploadedUrl; 
        }

        const bookData = {
            title: document.getElementById('title').value,
            category: document.getElementById('category').value,
            author: document.getElementById('author').value,
            description: document.getElementById('description').value, // Description ထည့်သွင်းခြင်း
            cover: coverUrl,
            file_size: document.getElementById('file-size').value,
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
    if (confirm("Are you sure you want to delete this book?")) {
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
        document.getElementById('description').value = book.description || ''; // Description ကို form ထဲ ပြန်ထည့်ပေးခြင်း
        document.getElementById('cover-url').value = book.cover || '';
        document.getElementById('file-size').value = book.file_size || '';
        document.getElementById('download-link').value = book.download_link || '';
        document.getElementById('read-link').value = book.read_link || '';
        document.getElementById('is-editor-choice').checked = book.is_editor_choice || false;

        document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Book';
        document.getElementById('save-btn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Book';
        document.getElementById('cancel-btn').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function resetForm() {
    document.getElementById('edit-book-id').value = '';
    document.getElementById('title').value = '';
    document.getElementById('author').value = '';
    document.getElementById('description').value = ''; // Description ရှင်းလင်းခြင်း
    document.getElementById('cover-url').value = '';
    document.getElementById('file-size').value = '';
    document.getElementById('download-link').value = '';
    document.getElementById('read-link').value = '';
    document.getElementById('cover-file').value = '';
    document.getElementById('pdf-file').value = '';
    document.getElementById('is-editor-choice').checked = false;
    
    document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Add New Book';
    document.getElementById('save-btn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Book Data';
    document.getElementById('cancel-btn').classList.add('hidden');
}