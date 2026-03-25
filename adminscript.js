const supabaseUrl = 'https://cmguamftohgcgwdggwde.supabase.co';
const supabaseKey = 'sb_publishable_xiWtoACTDkbfjmz9RMxWdw_R5W1UtZ9';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- ၁။ LOGIN & AUTH CHECK ---
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pw').value;

   const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
});;

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
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    location.reload();
}

// စာမျက်နှာစဖွင့်ချင်း user ရှိမရှိစစ်မယ်
checkUser();

// အရင်ရှိပြီးသား saveBook function ကို ဒါလေးနဲ့ အစားထိုးလိုက်ပါ
async function saveBook() {
    const id = document.getElementById('edit-book-id').value;
    const btn = document.getElementById('upload-btn');
    
    // Form ထဲက Data များကို ယူခြင်း
    const bookData = {
        title: document.getElementById('title').value,
        author: document.getElementById('author').value,
        category: document.getElementById('category').value,
        cover: document.getElementById('cover-url').value,
        is_editor_choice: document.getElementById('is_editor_choice').checked,
        file_size: document.getElementById('file-size').value, // အသစ်ထည့်ထားသော field
        download_link: document.getElementById('download-link').value,
        // download_count ကို အသစ်တင်ရင် 0 ကစမယ်၊ Edit ဆိုရင်တော့ မပြင်ဘူး
    };

    if (!bookData.title || !bookData.download_link) {
        return alert("စာအုပ်အမည်နဲ့ Download Link အနည်းဆုံး ထည့်ပေးရပါမယ်");
    }

    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        if (id) {
            // Update လုပ်ခြင်း
            const { error } = await supabase.from('books').update(bookData).eq('id', id);
            if (error) throw error;
            alert("စာအုပ်ပြင်ဆင်ပြီးပါပြီ");
        } else {
            // အသစ်ထည့်ခြင်း (download_count ကို 0 ထားမယ်)
            bookData.download_count = 0;
            const { error } = await supabase.from('books').insert([bookData]);
            if (error) throw error;
            alert("စာအုပ်အသစ် သိမ်းဆည်းပြီးပါပြီ");
        }
        resetForm();
        fetchAdminBooks(); // Table ကို Refresh လုပ်မယ်
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Book";
    }
}

// Table မှာ ပြသတဲ့ function ကိုလည်း update လုပ်ပါ
function renderAdminTable(books) {
    const tbody = document.getElementById('admin-book-list');
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
                <button class="btn-edit" onclick="editBook(${book.id})">Edit</button>
                <button class="btn-delete" onclick="deleteBook(${book.id})" style="color:red;">Del</button>
            </td>
        </tr>
    `).join('');
}
