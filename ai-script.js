const WORKER_URL = "https://my-ai-proxy.jokertalor.workers.dev/";

// Chat Window အဖွင့်အပိတ်
window.toggleChat = function(e) {
    if (e) e.stopPropagation();
    const win = document.getElementById('chat-window');
    if (!win) return;
    win.style.display = (win.style.display === 'none' || win.style.display === '') ? 'flex' : 'none';
};

// AI ဆီ စာပို့သည့် Function (ဒါမပါလို့ ပို့မရဖြစ်နေတာပါ)
window.sendToAI = async function() {
    const input = document.getElementById('ai-input');
    const chatContent = document.getElementById('chat-content');
    if (!input || !chatContent) return;

    const msg = input.value.trim();
    if (!msg) return;

    // User Message ပြခြင်း
    chatContent.innerHTML += `<div class="user-msg" style="background: #1a73e8; color: white; padding: 10px 15px; border-radius: 15px 15px 2px 15px; align-self: flex-end; max-width: 85%; font-size: 14px; margin-left: auto; margin-bottom: 10px;">${msg}</div>`;
    input.value = '';

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'ai-msg';
    aiMsgDiv.style = "background: #f1f3f4; color: #333; padding: 10px 15px; border-radius: 15px 15px 15px 2px; align-self: flex-start; max-width: 85%; font-size: 14px; margin-bottom: 10px; line-height: 1.5;";
    chatContent.appendChild(aiMsgDiv);
    chatContent.scrollTop = chatContent.scrollHeight;

    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: msg, 
                systemPrompt: "မင်းက Smart Bookshelf ရဲ့ အသိပညာကြွယ်ဝတဲ့ စာကြည့်တိုက်မှူး(SMART AI) ဖြစ်ပါတယ်။ မြန်မာလို ယဉ်ကျေးစွာ ပြန်ဖြေပေးပါ။" 
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

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

// Dragging Logic နှင့် Event Listeners (ယခင်အတိုင်း)
const dragItem = document.getElementById("ai-widget");
let active = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

dragItem.addEventListener("mousedown", dragStart);
document.addEventListener("mouseup", dragEnd);
document.addEventListener("mousemove", drag);

function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (e.target.closest("#robot-icon")) active = true;
}
function dragEnd() { initialX = currentX; initialY = currentY; active = false; }
function drag(e) {
    if (active) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX; yOffset = currentY;
        dragItem.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const aiInput = document.getElementById('ai-input');
    const sendBtn = document.getElementById('send-btn');
    if (aiInput) {
        aiInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); sendToAI(); }
        });
    }
    if (sendBtn) { sendBtn.onclick = sendToAI; }
});