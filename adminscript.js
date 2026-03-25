const supabaseUrl = 'https://cmguamftohgcgwdggwde.supabase.co';
// မှတ်ချက် - ဒီ Key နေရာမှာ သင့် Dashboard ကရတဲ့ eyJ... နဲ့စတဲ့ Key အရှည်ကြီးကို ထည့်ပါ
const supabaseKey = 'sb_publishable_xiWtoACTDkbfjmz9RMxWdw_R5W1UtZ9'; 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let allBooks = [];

// --- ၁။ LOGIN & AUTH ---
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pw').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        alert("Login failed: " + error.message);
    } else {
        checkUser();
    }
}

async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        fetchAdminBooks(); // Login အောင်မြင်ရင် table ဆွဲထုတ်မယ်
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    location.reload();
}

// --- ၂။ CRUD OPERATIONS (SAVE / UPDATE) ---
// HTML က uploadBook() လို့ခေါ်ထားလို့ ဒီမှာ နာမည်ကို ညှိထားပါတယ်
async function uploadBook() {
    // Edit လုပ်နေတာလား သိဖို့ ID ယူမယ်
    const editId = document.getElementById('edit-book-id') ? document.getElementById('edit-book-id').value : null;
    const btn = document.getElementById('upload-btn');
    
    const bookData = {
        title: document.getElementById('title').value,
        author: document.getElementById('author').value,
        category: document.getElementById('category').value,
        cover: document.getElementById('cover-url').value,
        is_editor_choice: document.getElementById('is_editor_choice').checked,
        file_size: document.getElementById('file-size').value,
        download_link: document.getElementById('download-link').value
    };

    if (!bookData.title || !bookData.download_link) {
        return alert("စာအုပ်အမည်နဲ့ Download Link ထည့်ပေးပါ");
    }

    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        if (editId) {
            const { error } = await supabase.from('books').update(bookData).eq('id', editId);
            if (error) throw error;
            alert("ပြင်ဆင်ပြီးပါပြီ");
        } else {
            bookData.download_count = 0;
            const { error } = await supabase.from('books').insert([bookData]);
            if (error) throw error;
            alert("အသစ်သိမ်းဆည်းပြီးပါပြီ");
        }
        location.reload(); // Page ကို refresh လုပ်ပြီး table ပြန်ပြမယ်
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Upload & Save";
    }
}

// Table ဆွဲထုတ်ခြင်း
async function fetchAdminBooks() {
    const { data, error } = await supabase.from('books').select('*').order('id', { ascending: false });
    if (!error) {
        allBooks = data;
        renderAdminTable(data);
    }
}

function renderAdminTable(books) {
    const tbody = document.getElementById('admin-book-list');
    if(!tbody) return;
    tbody.innerHTML = books.map(book => `
        <tr>
            <td>${book.id}</td>
            <td><img src="${book.cover}" style="width:40px;height:55px;object-fit:cover;"></td>
            <td>${book.title}</td>
            <td>${book.category}</td>
            <td>${book.author || '-'}</td>
            <td>${book.is_editor_choice ? '✅' : '❌'}</td>
            <td>${book.download_count || 0}</td>
            <td>${book.file_size || '-'}</td>
            <td>
                <button onclick="editBook(${book.id})">Edit</button>
                <button onclick="deleteBook(${book.id})" style="color:red;">Del</button>
            </td>
        </tr>
    `).join('');
}

// Edit Mode သို့ပြောင်းရန်
window.editBook = function(id) {
    const book = allBooks.find(b => b.id === id);
    if (!book) return;

    // hidden input တစ်ခု HTML မှာ ထည့်ထားဖို့လိုပါတယ် (ဥပမာ- <input type="hidden" id="edit-book-id">)
    if(document.getElementById('edit-book-id')) document.getElementById('edit-book-id').value = book.id;
    
    document.getElementById('title').value = book.title;
    document.getElementById('author').value = book.author;
    document.getElementById('category').value = book.category;
    document.getElementById('cover-url').value = book.cover;
    document.getElementById('file-size').value = book.file_size;
    document.getElementById('download-link').value = book.download_link;
    document.getElementById('is_editor_choice').checked = book.is_editor_choice;
    
    document.getElementById('upload-btn').innerText = "Update Book";
    window.scrollTo(0, 0);
};

// ဖျက်ရန်
window.deleteBook = async function(id) {
    if (confirm("ဖျက်မှာ သေချာပါသလား?")) {
        const { error } = await supabase.from('books').delete().eq('id', id);
        if (!error) fetchAdminBooks();
    }
};

// စတင်အလုပ်လုပ်ရန်
checkUser();
