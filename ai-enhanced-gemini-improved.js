// ============================================
// SmartBookshelf AI Engine (Gemini-Powered Backend)
// Netflix-Level AI Features with Real-time Streaming
// ============================================

// backend URL (Cloudflare Worker or your Node.js server)
const WORKER_URL = "https://my-supabase-proxy.jokertalor.workers.dev/"; 
const db = new Dexie("MyDigitalLibrary");
db.version(3).stores({ 
    savedBooks: "id, title, author, cover, fileData, lastPage, lastReadDate, readingProgress",
    downloadQueue: "id, bookId, status, retryCount, createdAt"
});
let chatHistory = []; 
let aiContext = {
    readingHistory: [],
    userPreferences: {},
    currentBook: null
};

// ============================================
// 1. Reading History Analysis (Context Aware)
// ============================================
async function loadReadingContext() {
    try {
        const books = await db.savedBooks.toArray();
        const recentBooks = books
            .filter(b => b.lastReadDate)
            .sort((a, b) => new Date(b.lastReadDate) - new Date(a.lastReadDate))
            .slice(0, 10);

        aiContext.readingHistory = recentBooks.map(b => ({
            title: b.title,
            author: b.author,
            lastRead: new Date(b.lastReadDate).toLocaleDateString('my-MM'),
            progress: b.readingProgress || 0
        }));

        analyzeUserPreferences(recentBooks);
    } catch (err) {
        console.error("Error loading reading context:", err);
    }
}

function analyzeUserPreferences(books) {
    const genres = {};
    const authors = {};
    
    books.forEach(book => {
        const titleLower = book.title.toLowerCase();
        if (titleLower.includes('mystery') || titleLower.includes('crime')) genres['Mystery'] = (genres['Mystery'] || 0) + 1;
        if (titleLower.includes('romance') || titleLower.includes('love')) genres['Romance'] = (genres['Romance'] || 0) + 1;
        if (titleLower.includes('fantasy') || titleLower.includes('magic')) genres['Fantasy'] = (genres['Fantasy'] || 0) + 1;
        if (titleLower.includes('science') || titleLower.includes('sci-fi')) genres['Sci-Fi'] = (genres['Sci-Fi'] || 0) + 1;
        if (titleLower.includes('history') || titleLower.includes('historical')) genres['History'] = (genres['History'] || 0) + 1;
        
        authors[book.author] = (authors[book.author] || 0) + 1;
    });

    aiContext.userPreferences = {
        favoriteGenres: Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]),
        favoriteAuthors: Object.entries(authors).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]),
        totalBooksRead: books.length,
        averageProgress: Math.round(books.reduce((a, b) => a + (b.readingProgress || 0), 0) / (books.length || 1))
    };
}

// ============================================
// 2. Chat Window Toggle
// ============================================
window.toggleChat = function(e) {
    if (e) e.stopPropagation();
    const win = document.getElementById('chat-window');
    if (!win) return;
    win.style.display = (win.style.display === 'none' || win.style.display === '') ? 'flex' : 'none';
};

// ============================================
// 3. SSE Parser Helper Function
// ============================================
// Gemini ရဲ့ SSE format ကို parse လုပ်ပေးသည့် helper function
function parseGeminiSSELine(line) {
    if (!line.startsWith('data: ')) return null;
    
    const jsonStr = line.replace('data: ', '').trim();
    if (!jsonStr || jsonStr === '[DONE]') return null;
    
    try {
        const json = JSON.parse(jsonStr);
        // Gemini streaming response structure
        const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
        return content || null;
    } catch (e) {
        console.error("SSE JSON Parsing Error:", e, "String:", jsonStr);
        return null;
    }
}

// ============================================
// 4. AI Message Sending (Gemini Backend Format with Real-time Streaming)
// ============================================
// စကားပြောမှတ်တမ်း သိမ်းရန် (ဖိုင်ရဲ့ အပေါ်ပိုင်းမှာ ထားပါ)
window.sendToAI = async function() {
    console.log("AI Script started..."); // Debug
    const input = document.getElementById('ai-input');
    const chatContent = document.getElementById('chat-content');
    if (!input || !chatContent) return;

    const msg = input.value.trim();
    if (!msg) return;

    console.log("Loading context...");
    await loadReadingContext();

    // UI Updates
    chatContent.innerHTML += `
        <div class="user-msg" style="background: #1a73e8; color: white; padding: 12px 16px; border-radius: 18px 18px 4px 18px; align-self: flex-end; max-width: 85%; font-size: 14px; margin-left: auto; margin-bottom: 12px;">
            ${msg}
        </div>
    `;
    input.value = '';

    chatHistory.push({ role: "user", parts: [{ text: msg }] });

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.style = "background: #f1f3f4; color: #333; padding: 12px 16px; border-radius: 18px 18px 18px 4px; align-self: flex-start; max-width: 85%; font-size: 14px; margin-bottom: 12px;";
    aiMsgDiv.innerHTML = 'Thinking...';
    chatContent.appendChild(aiMsgDiv);
    chatContent.scrollTop = chatContent.scrollHeight;

    try {
        console.log("Sending request to Worker...");
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: msg, 
                systemPrompt: buildContextPrompt(msg),
                history: chatHistory 
            })
        });

        console.log("Response status:", response.status);

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        aiMsgDiv.innerHTML = ""; 
        let buffer = ""; // Line buffer အတွက်

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Complete lines ကို ခွဲထုတ်ခြင်း
            const lines = buffer.split('\n');
            
            // အနောက်ဆုံး line မ complete ဖြစ်နိုင်သည့်အတွက် buffer မှာ ထားခြင်း
            buffer = lines.pop() || "";
            
            for (const line of lines) {
                const content = parseGeminiSSELine(line);
                
                if (content) {
                    fullText += content;
                    // HTML tags တွေကို parse လုပ်ခြင်း (ဥပမာ \n ကို <br>)
                    aiMsgDiv.innerHTML = fullText.replace(/\n/g, "<br>");
                    chatContent.scrollTop = chatContent.scrollHeight;
                }
            }
        }
        
        // Remaining buffer ကို process လုပ်ခြင်း
        if (buffer.trim()) {
            const content = parseGeminiSSELine(buffer);
            if (content) {
                fullText += content;
                aiMsgDiv.innerHTML = fullText.replace(/\n/g, "<br>");
                chatContent.scrollTop = chatContent.scrollHeight;
            }
        }

        chatHistory.push({ role: "model", parts: [{ text: fullText }] });
        if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

    } catch (error) {
        console.error("Critical Error:", error);
        aiMsgDiv.innerHTML = "Error: " + error.message;
    }
};
        
function buildContextPrompt(userMessage) {
    let prompt = "မင်းက Smart Bookshelf ရဲ့ အသိပညာကြွယ်ဝတဲ့ AI စာကြည့်တိုက်မှူး (SMART AI) ဖြစ်ပါတယ်။ မြန်မာလို ယဉ်ကျေးစွာ ပြန်ဖြေပေးပါ။\n\n";
    if (aiContext.readingHistory.length > 0) {
        prompt += `User ရဲ့ အဖတ်အလျှောက်:\n`;
        aiContext.readingHistory.slice(0, 5).forEach(book => {
            prompt += `- "${book.title}" (${book.author}) - အဖတ်: ${book.progress}%\n`;
        });
        prompt += "\n";
    }
    if (aiContext.userPreferences.favoriteGenres?.length > 0) {
        prompt += `User ကြိုက်နှစ်သက်တဲ့ အမျိုးအစား: ${aiContext.userPreferences.favoriteGenres.join(', ')}\n`;
    }
    return prompt;
}

let isDragging = false;
let startX, startY;
const robot = document.getElementById('robot-icon');

// Dragging စတင်ခြင်း
function startDragging(e) {
    isDragging = false; // စစချင်းမှာ Drag မဟုတ်သေးဘူးလို့ သတ်မှတ်
    startX = e.clientX;
    startY = e.clientY;
    
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDragging);
}

// ရွေ့လျားခြင်း (Mouse ရွေ့တဲ့ தూरम 5px ထက်ကျော်မှ Drag လို့ သတ်မှတ်)
function onDrag(e) {
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    
    if (dx > 5 || dy > 5) {
        isDragging = true;
        robot.style.position = 'fixed';
        robot.style.left = (e.clientX - 40) + 'px'; // 40px က အရုပ်ရဲ့ အလယ်ဗဟို
        robot.style.top = (e.clientY - 40) + 'px';
        robot.style.right = 'auto';
        robot.style.bottom = 'auto';
    }
}

// Mouse လွှတ်လိုက်ချိန်
function stopDragging(e) {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDragging);
}

// Click ပြုလုပ်ခြင်း (Drag မဖြစ်မှသာ Chat Box ကို ပွင့်စေမည်)
function handleRobotClick(e) {
    if (!isDragging) {
        toggleChat(e);
    }
}

// Robot Icon တွင် Event များ ချိတ်ဆက်ခြင်း
robot.addEventListener('mousedown', startDragging);
robot.addEventListener('click', handleRobotClick);
