// ============================================
// SmartBookshelf AI Engine - FINAL OPTIMIZED VERSION
// Worker_final.js နဲ့ တွဲသုံးရန် (Rate Limit Protection + Context Optimization)
// ============================================

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

// Client-side Safeguard Variables (Rate Limit Protection)
let isProcessing = false;
let lastRequestTime = 0;
const MIN_INTERVAL = 12000; // 12 စက္ကန့် (worker မှာ 5s throttling ရှိပြီး ဖြစ်လို့ လုံခြုံစွာ)

// ============================================
// 1. Reading History & Preferences Analysis
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
        console.log("Reading context loaded:", aiContext);
    } catch (err) {
        console.error("Error loading reading context:", err);
    }
}

function analyzeUserPreferences(books) {
    const genres = {};
    books.forEach(book => {
        const titleLower = book.title.toLowerCase();
        if (titleLower.includes('mystery') || titleLower.includes('crime')) genres['Mystery'] = (genres['Mystery'] || 0) + 1;
        if (titleLower.includes('romance') || titleLower.includes('love')) genres['Romance'] = (genres['Romance'] || 0) + 1;
        if (titleLower.includes('fantasy') || titleLower.includes('magic')) genres['Fantasy'] = (genres['Fantasy'] || 0) + 1;
        if (titleLower.includes('science') || titleLower.includes('sci-fi')) genres['Sci-Fi'] = (genres['Sci-Fi'] || 0) + 1;
        if (titleLower.includes('history') || titleLower.includes('historical')) genres['History'] = (genres['History'] || 0) + 1;
    });

    aiContext.userPreferences = {
        favoriteGenres: Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]),
    };
}
// ============================================
// 2. SSE Parser (Fixed)
// ============================================
function parseGeminiSSELine(line) {
    // "data: " ဆိုတဲ့ စာသားကို အရင်ဖြုတ်
    if (!line.startsWith('data: ')) return null;
    let jsonStr = line.replace('data: ', '').trim();
    
    if (!jsonStr || jsonStr === '[DONE]') return null;

    try {
        const json = JSON.parse(jsonStr);
        
        // 1. Worker ကနေ {text: "..."} ဆိုပြီး ပို့လာရင်
        if (json.text) return json.text;
        
        // 2. မူရင်း Gemini Streaming format (candidates...) အတွက်
        return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
        
    } catch (e) {
        // အကယ်၍ JSON မဟုတ်ဘဲ စာသားသက်သက် ဖြစ်နေရင်
        return jsonStr; 
    }
}
// ============================================
// 3. Chat Window Toggle (အရင်ကုဒ်မှ ထိန်းထားတယ်)
// ============================================
window.toggleChat = function(e) {
    if (e) e.stopPropagation();
    const win = document.getElementById('chat-window');
    if (!win) return;
    win.style.display = (win.style.display === 'none' || win.style.display === '') ? 'flex' : 'none';
};

// ============================================
// 4. Optimized sendToAI (Worker_final နဲ့ အပြည့်အစုံ တွဲလုပ်ရန်)
// ============================================
window.sendToAI = async function() {
    const input = document.getElementById('ai-input');
    const chatContent = document.getElementById('chat-content');
    if (!input || !chatContent) return;

    const msg = input.value.trim();
    if (!msg) return;

    // 1. Debounce & Processing Guard
    const now = Date.now();
    if (isProcessing) {
        console.log("Request is already in progress...");
        return;
    }
    if (now - lastRequestTime < MIN_INTERVAL) {
        const wait = Math.ceil((MIN_INTERVAL - (now - lastRequestTime)) / 1000);
        alert(`Please wait ${wait} seconds before sending another message.`);
        return;
    }

    // 2. Lock UI
    isProcessing = true;
    lastRequestTime = now;
    input.disabled = true;

    // 3. Load context only on first message
    if (chatHistory.length === 0) {
        console.log("Loading reading context for first message...");
        await loadReadingContext();
    }

    // User message UI
    chatContent.innerHTML += `
        <div class="user-msg" style="background: #1a73e8; color: white; padding: 12px 16px; border-radius: 18px 18px 4px 18px; align-self: flex-end; max-width: 85%; font-size: 14px; margin-left: auto; margin-bottom: 12px;">
            ${msg}
        </div>
    `;
    input.value = '';

    // AI thinking message
    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.style = "background: #f1f3f4; color: #333; padding: 12px 16px; border-radius: 18px 18px 18px 4px; align-self: flex-start; max-width: 85%; font-size: 14px; margin-bottom: 12px;";
    aiMsgDiv.innerHTML = 'Thinking...';
    chatContent.appendChild(aiMsgDiv);
    chatContent.scrollTop = chatContent.scrollHeight;

    let retryCount = 0;
    const maxRetries = 2;

    const attemptFetch = async () => {
        try {
            const payload = {
                message: msg,
                history: chatHistory,
                aiContext: (chatHistory.length === 0) ? aiContext : null   // ပထမ တစ်ခါပဲ context ပို့
            };

            console.log("Sending to worker:", payload);

            const response = await fetch(WORKER_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            aiMsgDiv.innerHTML = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const content = parseGeminiSSELine(line);
                    if (content) {
                        fullText += content;
                        aiMsgDiv.innerHTML = fullText.replace(/\n/g, "<br>");
                        chatContent.scrollTop = chatContent.scrollHeight;
                    }
                }
            }

            // Save conversation to history
            chatHistory.push({ role: "user", parts: [{ text: msg }] });
            chatHistory.push({ role: "model", parts: [{ text: fullText }] });
            if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

        } catch (error) {
            console.error("Fetch error:", error);
            if (retryCount < maxRetries) {
                retryCount++;
                const delay = Math.pow(2, retryCount) * 3000; // 3s → 6s → 12s
                aiMsgDiv.innerHTML = `Retrying in ${delay/1000}s... (${retryCount}/${maxRetries})`;
                await new Promise(r => setTimeout(r, delay));
                return attemptFetch();
            }
            aiMsgDiv.innerHTML = `Error: ${error.message}. Please try again later.`;
        } finally {
            isProcessing = false;
            input.disabled = false;
            input.focus();
        }
    };

    await attemptFetch();
};

// ============================================
// 5. Robot Icon Dragging & Click (အရင်ကုဒ်မှ မထိပါနဲ့)
// ============================================
let isDragging = false;
let startX, startY;
const robot = document.getElementById('robot-icon');

function startDragging(e) {
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDragging);
}

function onDrag(e) {
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > 5 || dy > 5) {
        isDragging = true;
        robot.style.position = 'fixed';
        robot.style.left = (e.clientX - 40) + 'px';
        robot.style.top = (e.clientY - 40) + 'px';
        robot.style.right = 'auto';
        robot.style.bottom = 'auto';
    }
}

function stopDragging() {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDragging);
}

function handleRobotClick(e) {
    if (!isDragging) {
        toggleChat(e);
    }
}

if (robot) {
    robot.addEventListener('mousedown', startDragging);
    robot.addEventListener('click', handleRobotClick);
}

console.log("SmartBookshelf AI Engine (Final Optimized) loaded successfully.");