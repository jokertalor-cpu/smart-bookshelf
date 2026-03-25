const supabaseUrl = 'https://cmguamftohgcgwdggwde.supabase.co';
const supabaseKey = 'sb_publishable_xiWtoACTDkbfjmz9RMxWdw_R5W1UtZ9'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- ၁။ Authentication ပိုင်း ---
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pw').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Login failed: " + error.message);
    } else {
        checkUser();
    }
}

async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        fetchAdminBooks();
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    location.reload();
}

// Page ဖွင့်တာနဲ့ login ဝင်ပြီးသားလား စစ်မယ်
checkUser();

// --- ၂။ စာအုပ်များ ဆွဲထုတ်ခြင်း ---
async function fetchAdminBooks() {
    const { data, error } = await supabase.from('books').select('*').order('id', { ascending: false });
    if (error) console.error(error);
    else renderAdminTable(data);
}

function renderAdminTable(books) {
    const tbody = document.getElementById('admin-book-list');
    tbody.innerHTML = books.map(book => `
        <tr>
            <td>${book.id}</td>
            <td><img src="${book.cover}" width="40"></td>
            <td>${book.title}</td>
            <td>${book.category}</td>
            <td>${book.download_count || 0}</td>
            <td>
                <button class="btn-edit" onclick="editBook(${book.id})">Edit</button>
                <button class="btn-delete" onclick="deleteBook(${book.id})">Del</button>
            </td>
        </tr>
    `).join('');
}

// --- ၃။ Storage သို့ File Upload တင်ခြင်း ---
async function uploadToStorage(inputElement, folder) {
    const file = inputElement.files[0];
    if (!file) return null;

    const fileName = `${folder}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('book-assets').upload(fileName, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from('book-assets').getPublicUrl(fileName);
    return publicUrl;
}

// --- ၄။ သိမ်းဆည်းခြင်း (Add / Update) ---
async function saveBook() {
    const id = document.getElementById('edit-book-id').value;
    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;
    saveBtn.innerText = "Processing...";

    try {
        let coverUrl = document.getElementById('cover-url').value;
        let downloadLink = document.getElementById('download-link').value;

        // File တွေ ရွေးထားရင် အရင်တင်မယ်
        const coverFile = document.getElementById('cover-file');
        const pdfFile = document.getElementById('pdf-file');

        if (coverFile.files[0]) coverUrl = await uploadToStorage(coverFile, 'covers');
        if (pdfFile.files[0]) downloadLink = await uploadToStorage(pdfFile, 'pdfs');

        const bookData = {
            title: document.getElementById('title').value,
            category: document.getElementById('category').value,
            author: document.getElementById('author').value,
            cover: coverUrl,
            file_size: document.getElementById('file-size').value,
            download_link: downloadLink,
            read_link: document.getElementById('read-link').value,
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
        saveBtn.innerText = "Save Book";
    }
}

// --- ၅။ ဖျက်ခြင်း (Delete) ---
async function deleteBook(id) {
    if (confirm("Are you sure?")) {
        const { error } = await supabase.from('books').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchAdminBooks();
    }
}

// --- ၆။ ပြင်ဆင်ခြင်း (Edit) ---
async function editBook(id) {
    const { data: book } = await supabase.from('books').select('*').eq('id', id).single();
    if (book) {
        document.getElementById('edit-book-id').value = book.id;
        document.getElementById('title').value = book.title;
        document.getElementById('category').value = book.category;
        document.getElementById('author').value = book.author;
        document.getElementById('cover-url').value = book.cover;
        document.getElementById('file-size').value = book.file_size;
        document.getElementById('download-link').value = book.download_link;
        document.getElementById('read-link').value = book.read_link;
        document.getElementById('is-editor-choice').checked = book.is_editor_choice;

        document.getElementById('form-title').innerText = "Edit Book";
        document.getElementById('save-btn').innerText = "Update Book";
        document.getElementById('cancel-btn').classList.remove('hidden');
        window.scrollTo(0,0);
    }
}

function resetForm() {
    document.getElementById('edit-book-id').value = '';
    document.getElementById('title').value = '';
    document.getElementById('author').value = '';
    document.getElementById('cover-url').value = '';
    document.getElementById('file-size').value = '';
    document.getElementById('download-link').value = '';
    document.getElementById('read-link').value = '';
    document.getElementById('cover-file').value = '';
    document.getElementById('pdf-file').value = '';
    document.getElementById('is-editor-choice').checked = false;
    document.getElementById('form-title').innerText = "Add New Book";
    document.getElementById('save-btn').innerText = "Save Book";
    document.getElementById('cancel-btn').classList.add('hidden');
}
