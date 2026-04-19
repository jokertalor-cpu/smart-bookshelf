// ============================================
// SmartBookshelf AI Engine (Groq-Powered)
// Netflix-Level AI Features
// ============================================

const WORKER_URL = "https://my-ai-proxy.jokertalor.workers.dev/";
const db = new Dexie("MyDigitalLibrary");
db.version(3).stores({ 
    savedBooks: "id, title, author, cover, fileData, lastPage, lastReadDate, readingProgress",
    downloadQueue: "id, bookId, status, retryCount, createdAt"
});

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

        // Extract user preferences from reading history
        analyzeUserPreferences(recentBooks);
    } catch (err) {
        console.error("Error loading reading context:", err);
    }
}

function analyzeUserPreferences(books) {
    const genres = {};
    const authors = {};
    
    books.forEach(book => {
        // Simple genre detection based on title keywords
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
        averageProgress: Math.round(books.reduce((a, b) => a + (b.readingProgress || 0), 0) / books.length)
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
// 3. AI Message Sending (Enhanced with Context)
// ============================================
window.sendToAI = async function() {
    const input = document.getElementById('ai-input');
    const chatContent = document.getElementById('chat-content');
    if (!input || !chatContent) return;

    const msg = input.value.trim();
    if (!msg) return;

    // Load reading context before sending
    await loadReadingContext();

    // User Message Display
    chatContent.innerHTML += `
        <div class="user-msg" style="background: #1a73e8; color: white; padding: 12px 16px; border-radius: 18px 18px 4px 18px; align-self: flex-end; max-width: 85%; font-size: 14px; margin-left: auto; margin-bottom: 12px; word-wrap: break-word;">
            ${msg}
        </div>
    `;
    input.value = '';

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'ai-msg';
    aiMsgDiv.style = "background: #f1f3f4; color: #333; padding: 12px 16px; border-radius: 18px 18px 18px 4px; align-self: flex-start; max-width: 85%; font-size: 14px; margin-bottom: 12px; line-height: 1.6; word-wrap: break-word;";
    
    const loadingSpinner = document.createElement('div');
    loadingSpinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i> စဉ်းစားနေသည်...';
    aiMsgDiv.appendChild(loadingSpinner);
    chatContent.appendChild(aiMsgDiv);
    chatContent.scrollTop = chatContent.scrollHeight;

    try {
        // Build context-aware system prompt
        const contextPrompt = buildContextPrompt(msg);
        
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: msg, 
                systemPrompt: contextPrompt
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        aiMsgDiv.innerHTML = ''; // Clear loading spinner

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const json = JSON.parse(line.replace('data: ', ''));
                        const content = json.choices[0].delta.content;
                        if (content) {
                            fullText += content;
                            aiMsgDiv.innerHTML = fullText.replace(/\n/g, "<br>");
                            chatContent.scrollTop = chatContent.scrollHeight;
                        }
                    } catch (e) { }
                }
            }
        }
    } catch (error) {
        console.error("Error:", error);
        aiMsgDiv.innerHTML = "ခေတ္တအခက်အခဲဖြစ်နေလို့ နောက်မှ ပြန်စမ်းကြည့်ပေးပါ။";
    }
};

// ============================================
// 4. Context-Aware System Prompt Builder
// ============================================
function buildContextPrompt(userMessage) {
    let prompt = "မင်းက Smart Bookshelf ရဲ့ အသိပညာကြွယ်ဝတဲ့ AI စာကြည့်တိုက်မှူး (SMART AI) ဖြစ်ပါတယ်။ မြန်မာလို ယဉ်ကျေးစွာ ပြန်ဖြေပေးပါ။\n\n";

    // Add user reading context
    if (aiContext.readingHistory.length > 0) {
        prompt += `User ရဲ့ အဖတ်အလျှောက်:\n`;
        aiContext.readingHistory.slice(0, 5).forEach(book => {
            prompt += `- "${book.title}" (${book.author}) - အဖတ်: ${book.progress}%\n`;
        });
        prompt += "\n";
    }

    // Add user preferences
    if (aiContext.userPreferences.favoriteGenres && aiContext.userPreferences.favoriteGenres.length > 0) {
        prompt += `User ကြိုက်နှစ်သက်တဲ့ အမျိုးအစား: ${aiContext.userPreferences.favoriteGenres.join(', ')}\n`;
    }

    if (aiContext.userPreferences.favoriteAuthors && aiContext.userPreferences.favoriteAuthors.length > 0) {
        prompt += `User ကြိုက်နှစ်သက်တဲ့ စာရေးဆရာများ: ${aiContext.userPreferences.favoriteAuthors.join(', ')}\n`;
    }

    // Detect intent and add specific instructions
    if (userMessage.toLowerCase().includes('recommend') || userMessage.toLowerCase().includes('အကြံပြု')) {
        prompt += "\n📚 User က စာအုပ်အကြံပြုခိုင်းနေတာ ဖြစ်တယ်။ သူ့ရဲ့ အဖတ်အလျှောက်အပေါ်အခြေခံပြီး အကောင်းဆုံး အကြံပြုချက်တွေ ပေးပါ။";
    }

    if (userMessage.toLowerCase().includes('summary') || userMessage.toLowerCase().includes('အနှစ်ချုပ်')) {
        prompt += "\n📖 User က စာအုပ်အနှစ်ချုပ်ခိုင်းနေတာ ဖြစ်တယ်။ အဓိက အချက်တွေကို ကျေးဇူးတင်း အနှစ်ချုပ်ပြပါ။";
    }

    if (userMessage.toLowerCase().includes('genre') || userMessage.toLowerCase().includes('အမျိုးအစား')) {
        prompt += "\n🎭 User က အမျိုးအစားအကြောင်း မေးနေတာ ဖြစ်တယ်။ အသေးစိတ် ရှင်းပြပါ။";
    }

    return prompt;
}

// ============================================
// 5. Smart Recommendations (Netflix-Style)
// ============================================
window.getAIRecommendations = async function() {
    await loadReadingContext();

    const chatContent = document.getElementById('chat-content');
    if (!chatContent) return;

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'ai-msg';
    aiMsgDiv.style = "background: #f1f3f4; color: #333; padding: 12px 16px; border-radius: 18px 18px 18px 4px; align-self: flex-start; max-width: 85%; font-size: 14px; margin-bottom: 12px; line-height: 1.6;";
    
    const loadingSpinner = document.createElement('div');
    loadingSpinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i> အကြံပြုချက်များ ရယူနေသည်...';
    aiMsgDiv.appendChild(loadingSpinner);
    chatContent.appendChild(aiMsgDiv);
    chatContent.scrollTop = chatContent.scrollHeight;

    try {
        const recommendationPrompt = `
User ရဲ့ အဖတ်အလျှောက်အပေါ်အခြေခံပြီး အကောင်းဆုံး စာအုပ်အကြံပြုချက် (၅)ခု ပေးပါ။

User ရဲ့ အကြိုက်အမြစ်များ:
- အမျိုးအစား: ${aiContext.userPreferences.favoriteGenres?.join(', ') || 'အမျိုးအစားမသိ'}
- စာရေးဆရာများ: ${aiContext.userPreferences.favoriteAuthors?.join(', ') || 'စာရေးဆရာမသိ'}
- ဖတ်ပြီးတဲ့စာအုပ်များ: ${aiContext.readingHistory.slice(0, 3).map(b => b.title).join(', ') || 'အရင်ဖတ်ထားတဲ့စာအုပ်မသိ'}

ပုံစံ:
📚 စာအုပ်ခေါင်းစဉ် - စာရေးဆရာ
အကြောင်းအရာ: [အကျဉ်းချုပ်]
ဘာကြောင့်အကြံပြုတယ်: [သင့်အကြိုက်အမြစ်နဲ့ ကိုက်ညီတဲ့ အကြောင်း]
        `;

        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: recommendationPrompt, 
                systemPrompt: "မင်းက စာအုပ်အကြံပြုချက်ပေးတဲ့ AI ဖြစ်ပါတယ်။ မြန်မာလို ယဉ်ကျေးစွာ ပြန်ဖြေပေးပါ။"
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        aiMsgDiv.innerHTML = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const json = JSON.parse(line.replace('data: ', ''));
                        const content = json.choices[0].delta.content;
                        if (content) {
                            fullText += content;
                            aiMsgDiv.innerHTML = fullText.replace(/\n/g, "<br>");
                            chatContent.scrollTop = chatContent.scrollHeight;
                        }
                    } catch (e) { }
                }
            }
        }
    } catch (error) {
        console.error("Error:", error);
        aiMsgDiv.innerHTML = "အကြံပြုချက်များ ရယူ၍မရပါ။ နောက်မှ ပြန်စမ်းကြည့်ပေးပါ။";
    }
};

// ============================================
// 6. Book Summarization (One-Click)
// ============================================
window.getBookSummary = async function(bookTitle, bookAuthor) {
    const chatContent = document.getElementById('chat-content');
    if (!chatContent) return;

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'ai-msg';
    aiMsgDiv.style = "background: #f1f3f4; color: #333; padding: 12px 16px; border-radius: 18px 18px 18px 4px; align-self: flex-start; max-width: 85%; font-size: 14px; margin-bottom: 12px; line-height: 1.6;";
    
    const loadingSpinner = document.createElement('div');
    loadingSpinner.innerHTML = `<i class="fas fa-spinner fa-spin"></i> "${bookTitle}" အနှစ်ချုပ် ရယူနေသည်...`;
    aiMsgDiv.appendChild(loadingSpinner);
    chatContent.appendChild(aiMsgDiv);
    chatContent.scrollTop = chatContent.scrollHeight;

    try {
        const summaryPrompt = `
"${bookTitle}" (${bookAuthor}) စာအုပ်ကို အနှစ်ချုပ်ပြပါ။

အပြည့်အစုံ အနှစ်ချုပ် (၃-၅ အပိုဒ်):
- အဓိက အကျန်းအစီ
- အဓိက အက္ခရာများ
- ကမ္ဘာအဆက်အစပ်
- အဓိက အဖြေများ
- စာအုပ်ရဲ့ အဓိပ္ပါယ်

မြန်မာလို ယဉ်ကျေးစွာ ရေးပြပါ။
        `;

        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: summaryPrompt, 
                systemPrompt: "မင်းက စာအုပ်အနှစ်ချုပ်ပေးတဲ့ AI ဖြစ်ပါတယ်။ အသေးစိတ်ပြီး ယဉ်ကျေးစွာ အနှစ်ချုပ်ပြပါ။"
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        aiMsgDiv.innerHTML = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const json = JSON.parse(line.replace('data: ', ''));
                        const content = json.choices[0].delta.content;
                        if (content) {
                            fullText += content;
                            aiMsgDiv.innerHTML = fullText.replace(/\n/g, "<br>");
                            chatContent.scrollTop = chatContent.scrollHeight;
                        }
                    } catch (e) { }
                }
            }
        }
    } catch (error) {
        console.error("Error:", error);
        aiMsgDiv.innerHTML = "အနှစ်ချုပ် ရယူ၍မရပါ။ နောက်မှ ပြန်စမ်းကြည့်ပေးပါ။";
    }
};

// ============================================
// 7. Dragging Logic & Event Listeners
// ============================================
const dragItem = document.getElementById("ai-widget");
if (dragItem) {
    let active = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

    dragItem.addEventListener("mousedown", dragStart);
    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("mousemove", drag);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        if (e.target.closest("#robot-icon")) active = true;
    }

    function dragEnd() { 
        initialX = currentX; 
        initialY = currentY; 
        active = false; 
    }

    function drag(e) {
        if (active) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX; 
            yOffset = currentY;
            dragItem.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }
    }
}

// ============================================
// 8. Initialize Event Listeners
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const aiInput = document.getElementById('ai-input');
    const sendBtn = document.getElementById('send-btn');
    const recommendBtn = document.getElementById('recommend-btn');

    if (aiInput) {
        aiInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                sendToAI(); 
            }
        });
    }

    if (sendBtn) { 
        sendBtn.onclick = sendToAI; 
    }

    if (recommendBtn) {
        recommendBtn.onclick = getAIRecommendations;
    }

    // Load reading context on page load
    loadReadingContext();
});

// ============================================
// 9. Export Functions for Global Use
// ============================================
window.loadReadingContext = loadReadingContext;
window.getAIRecommendations = getAIRecommendations;
window.getBookSummary = getBookSummary;
