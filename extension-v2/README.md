# SmartBookshelf AI Extension v2.1.1

SmartBookshelf AI သည် Chrome/Edge Manifest V3 browser extension ဖြစ်ပြီး HTTP/HTTPS website များတွင် AI bubble ကို အလိုအလျောက်ပြသပေးပါသည်။ v2.1 တွင် raw Supabase token ကို console မှကူးခြင်း၊ clipboard ဖြင့် paste လုပ်ခြင်းနှင့် tab တစ်ခုချင်းစီတွင် အမြဲတမ်း manual activation လုပ်ရခြင်းကို ဖယ်ရှားထားပါသည်။

## တပ်ဆင်နည်း

Chrome တွင် `chrome://extensions` ကိုဖွင့်ပြီး **Developer mode** ကိုဖွင့်ပါ။ **Load unpacked** ကိုနှိပ်ပြီး extract လုပ်ထားသော `extension-v2` folder ကိုရွေးပါ။ Production package သည် fixed signing key ဖြင့် build လုပ်ထားသည့် version ကိုသာ အသုံးပြုရမည်။

## ပထမဆုံးအသုံးပြုနည်း

Toolbar မှ SmartBookshelf AI icon ကိုနှိပ်ပြီး **SmartBookshelf ဖြင့် Sign in ဝင်မည်** ကိုနှိပ်ပါ။ SmartBookshelf login မဝင်ရသေးပါက website login page တွင် ပုံမှန် password သို့မဟုတ် Google login အသုံးပြုပါ။ Login အောင်မြင်ပြီးနောက် extension သို့ အလိုအလျောက်ပြန်လာပြီး secure session ချိတ်ဆက်ပါမည်။ Token ကို console မှကူးရန် မလိုပါ။

Sign in ပြီးပါက HTTP/HTTPS website အသစ်များနှင့် ဖွင့်ထားပြီးသား page များတွင် AI bubble အလိုအလျောက်ပေါ်ပါမည်။ Extension ကို Reload လုပ်ပြီးသား tab တစ်ခုတွင် bubble မပေါ်သေးပါက popup မှ **လက်ရှိ tab ကို ပြန်ဖွင့်မည်** ကို တစ်ကြိမ်နှိပ်ပါ သို့မဟုတ် page ကို refresh လုပ်ပါ။ Chrome internal pages (`chrome://`), browser store pages နှင့် PDF viewer ကဲ့သို့ browser က ကန့်သတ်ထားသော pages များတွင် content script မထည့်နိုင်ပါ။ Clean screenshot အလုပ်လုပ်ရန် ပုံမှန် HTTP/HTTPS page access ကို host permission အဖြစ် ထည့်ထားရပြီး extension install/reload အချိန်တွင် ထို access ကို Chrome က ပြသမည်ဖြစ်သည်။

Bubble ကို pointer/touch ဖြင့် ဖိဆွဲ၍ screen အတွင်း မည်သည့်နေရာသို့မဆို ရွှေ့နိုင်ပါသည်။ နောက်တစ်ကြိမ် page ဖွင့်သည့်အခါ နောက်ဆုံးထားခဲ့သော နေရာကို extension က local UI preference အဖြစ် ပြန်သုံးမည်။

## Screenshot workflow

AI panel ထဲမှ camera ခလုတ်ကို နှိပ်သောအခါ extension သည် chatbox နှင့် floating bubble နှစ်ခုလုံးကို ယာယီဖျောက်ပြီး page ကို ပြန် render လုပ်ပြီးမှ screenshot ရိုက်ပါသည်။ Screenshot ရပြီးသည်နှင့် panel နှင့် bubble ကို အလိုအလျောက်ပြန်ပေါ်စေပြီး preview အဖြစ် ပြထားပါသည်။ Preview ကို ဖယ်ရှားနိုင်ပြီး user က စာပို့မှသာ screenshot ကို AI သို့ ပူးတွဲပို့ပါမည်။ Password, payment, banking, private mail စသည့် အချက်အလက်များပါဝင်သော page များတွင် screenshot မပူးတွဲမီ သေချာစစ်ဆေးပါ။

## Privacy နှင့် security

Extension သည် Gemini API key ကို မသိမ်းပါ။ AI request သည် SmartBookshelf secure proxy မှတစ်ဆင့်သာ သွားပြီး key ကို server-side account setting မှ ဖတ်ပါသည်။ Extension session သည် `chrome.storage.session` ထဲတွင်သာ ရှိပြီး extension/browser restart ပြီးနောက် ပြန်လည် sign in လုပ်ရန်လိုနိုင်ပါသည်။ Sign out button ဖြင့် session ကို ချက်ချင်းရှင်းနိုင်ပါသည်။ Bubble position နှင့် model preference သာ `chrome.storage.local` တွင် UI preference အဖြစ် သိမ်းထားပါသည်။

## Troubleshooting

Bubble မပေါ်ပါက extension ကို `chrome://extensions` မှ **Reload** လုပ်ပြီး page ကို refresh လုပ်ပါ။ ထို့နောက် popup မှ **လက်ရှိ tab ကို ပြန်ဖွင့်မည်** ကို နှိပ်ပါ။ AI response မပြည့်စုံပါက popup မှ Sign out ပြုလုပ်ကာ ပြန် Sign in ဝင်ပြီး page ကို refresh လုပ်ပါ။ Screenshot မရပါက browser restricted page မဟုတ်ကြောင်း စစ်ပြီး camera ခလုတ်ကို ပြန်နှိပ်ပါ။ Proxy connection error ပေါ်ပါက extension version နှင့် `my-ai-proxy` Worker တွဲဖက် deploy ဖြစ်/မဖြစ် စစ်ပါ။
