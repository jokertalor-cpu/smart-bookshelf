const supabaseUrl = 'https://cmguamftohgcgwdggwde.supabase.co';
const supabaseKey = 'sb_publishable_xiWtoACTDkbfjmz9RMxWdw_R5W1UtZ9';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- ၁။ LOGIN & AUTH CHECK ---
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

// --- ၂။ FILE UPLOAD & DATABASE SAVE ---
async function uploadBook() {
    const title = document.getElementById('title').value;
    const author = document.getElementById('author').value;
    const category = document.getElementById('category').value;
    const cover = document.getElementById('cover-url').value;
    const fileInput = document.getElementById('pdf-file');
    const btn = document.getElementById('upload-btn');

    if (!fileInput.files[0]) return alert("PDF ဖိုင်ရွေးပေးပါ");
    
    btn.disabled = true;
    btn.innerText = "Uploading...";

    try {
        const file = fileInput.files[0];
        const fileName = `${Date.now()}_${file.name}`;
        
        // A. Supabase Storage ထဲ ဖိုင်တင်မယ်
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('book-files')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        // B. တင်လိုက်တဲ့ဖိုင်ရဲ့ Public URL ကို ယူမယ်
        const { data: { publicUrl } } = supabase.storage
            .from('book-files')
            .getPublicUrl(fileName);

        // C. Database ထဲ အချက်အလက် သိမ်းမယ်
        const { error: dbError } = await supabase.from('books').insert([{
            title, author, category, cover,
            download_link: publicUrl
        }]);

        if (dbError) throw dbError;

        alert("အောင်မြင်စွာ တင်ပြီးပါပြီ!");
        location.reload();

    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Upload & Save";
    }
}
