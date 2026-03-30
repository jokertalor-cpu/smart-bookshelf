// Cloudflare Worker URL ကို ဒီနေရာမှာ ထည့်ပါ
    const WORKER_URL = "https://my-ai-proxy.jokertalor.workers.dev/";

    window.toggleChat = function(e) {
        if (e) e.stopPropagation();
        const win = document.getElementById('chat-window');
        if (win.style.display === 'none' || win.style.display === '') {
            win.style.display = 'flex';
        } else {
            win.style.display = 'none';
        }
    };

    window.sendToAI = async function() {
        const input = document.getElementById('ai-input');
        const chatContent = document.getElementById('chat-content');
        const msg = input.value.trim();
        if (!msg) return;

        chatContent.innerHTML += `<div style="background: #1a73e8; color: white; padding: 10px 15px; border-radius: 15px 15px 2px 15px; align-self: flex-end; max-width: 85%; font-size: 14px; margin-left: auto; margin-bottom: 10px;">${msg}</div>`;
        input.value = '';

        try {
            // --- အဆင့် (၁): Supabase မှ စာအုပ်ဒေတာများကို ဆွဲယူခြင်း ---
            const { data: books, error: dbError } = await supabase
                .from('books') 
                .select('title, category, author');

            let bookContext = "လက်ရှိ စာအုပ်စင်ထဲတွင် စာအုပ်စာရင်း မရရှိသေးပါ။";
            if (books && books.length > 0) {
                bookContext = books.map(b => `- ${b.title} (${b.category}) - ရေးသူ: ${b.author}`).join('\n');
            }

            // စနစ်တကျ ပြင်ဆင်ထားသော System Prompt
            const systemPrompt = `မင်းက "Smart Bookshelf" ရဲ့ တရားဝင် AI Assistant ဖြစ်ပါတယ်။ 
            [Role & Identity]:
- မင်းရဲ့အမည်က "Smart AI" ဖြစ်ပြီး ယဉ်ကျေးပျူငှာတဲ့ စာကြည့်တိုက်မှူးတစ်ယောက်လို ပြုမူရပါမယ်။
- စာဖတ်သူတွေကို စာအုပ်လမ်းညွှန်ပေးခြင်းနဲ့ ဗဟုသုတမျှဝေခြင်းမှာ ကျွမ်းကျင်သူဖြစ်ရပါမယ်။
              [Context - ကျွန်ုပ်တို့၏စာအုပ်များ]:
ဒီစာရင်းကတော့ Website ထဲမှာ လက်ရှိရှိနေတဲ့ စာအုပ်တွေ ဖြစ်ပါတယ်-
${bookContext}

[Role & Guidelines]:
၁။ အထက်ပါစာရင်းထဲက စာအုပ်တွေအကြောင်းမေးရင် အဲဒီစာအုပ်တွေ Website မှာ ရှိကြောင်းနဲ့ အသေးစိတ်ကို ရှင်းပြပေးပါ။
၂။ စာရင်းထဲမှာ မရှိတဲ့စာအုပ်တွေ (ဥပမာ- ကမ္ဘာကျော်စာအုပ်တွေ) အကြောင်းမေးရင် မင်းရဲ့ Global Knowledge ကိုသုံးပြီး ဗဟုသုတအဖြစ် ဖြေကြားပေးပါ။
၃။ အဖြေကို မြန်မာလိုပဲ ယဉ်ကျေးပျူငှာစွာ ဖြေပါ။ (ခင်ဗျာ/ရှင် ထည့်သုံးပါ)။
၄။ စာဖတ်သူကို စာဖတ်ချင်စိတ်ဖြစ်လာအောင် အားပေးစကားလေးတွေ ထည့်ပြောပေးပါ။`

            // --- အဆင့် (၂): Cloudflare Worker ဆီသို့ လှမ်းပို့ခြင်း (API Key မလိုတော့ပါ) ---
            const response = await fetch(WORKER_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: msg,
                    systemPrompt: systemPrompt
                })
            });

            const data = await response.json();
            
            if (data.choices && data.choices[0]) {
                const aiText = data.choices[0].message.content;
                chatContent.innerHTML += `<div style="background: #f1f3f4; color: #333; padding: 10px 15px; border-radius: 15px 15px 15px 2px; align-self: flex-start; max-width: 85%; font-size: 14px; margin-bottom: 10px;">${aiText}</div>`;
            } else {
                throw new Error("AI Response Error");
            }

        } catch (error) {
            console.error("Error:", error);
            chatContent.innerHTML += `<div style="font-size:12px; color:red; margin-bottom:10px;">ခေတ္တအဆင်မပြေဖြစ်နေပါသည်။ ခဏကြာမှ ပြန်စမ်းကြည့်ပေးပါခင်ဗျာ။</div>`;
        } finally {
            chatContent.scrollTop = chatContent.scrollHeight;
        }
    };

    // Widget Dragging Logic
    const dragItem = document.getElementById("ai-widget");
    let active = false;
    let currentX, currentY, initialX, initialY;
    let xOffset = 0, yOffset = 0;

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
            setTranslate(currentX, currentY, dragItem);
        }
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)";
    }

    document.getElementById('ai-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendToAI();
    });