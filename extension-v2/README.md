# SmartBookshelf AI Extension v2

SmartBookshelf AI ကို လက်ရှိ browser tab ပေါ်တွင် အသုံးပြုနိုင်သော Chrome/Edge Manifest V3 extension ဖြစ်ပါသည်။ v2 တွင် raw Supabase token ကို console မှကူးခြင်း၊ clipboard ဖြင့် paste လုပ်ခြင်းနှင့် website အားလုံးတွင် အလိုအလျောက် inject လုပ်ခြင်းများကို ဖယ်ရှားထားပါသည်။

## တပ်ဆင်နည်း

Chrome တွင် `chrome://extensions` ကိုဖွင့်ပြီး **Developer mode** ကိုဖွင့်ပါ။ **Load unpacked** ကိုနှိပ်ပြီး `extension-v2` folder ကိုရွေးပါ။ Production package သည် fixed signing key ဖြင့် build လုပ်ထားသည့် version ကိုသာ အသုံးပြုရမည်။

## ပထမဆုံးအသုံးပြုနည်း

Toolbar မှ SmartBookshelf AI icon ကိုနှိပ်ပြီး **SmartBookshelf ဖြင့် Sign in ဝင်မည်** ကိုနှိပ်ပါ။ SmartBookshelf login မဝင်ရသေးပါက website login page တွင် ပုံမှန် email/phone/password သို့မဟုတ် Google login အသုံးပြုပါ။ Login အောင်မြင်ပြီးနောက် extension သို့ အလိုအလျောက်ပြန်လာပြီး session ချိတ်ဆက်ပါမည်။ Token ကို console မှကူးရန် မလိုပါ။

Sign in ပြီးပါက **ဤ tab တွင် AI bubble ဖွင့်မည်** ကိုနှိပ်ပါ။ ထို tab တွင်သာ bubble ပေါ်လာပြီး user က မေးခွန်းကို ရိုက်နိုင်ပါသည်။ အခြား tab များတွင် အသုံးပြုလိုပါက ထို tab တစ်ခုချင်းစီတွင် activation ကို ထပ်မံပြုလုပ်ပါ။

## Privacy နှင့် security

Extension သည် Gemini API key ကို မသိမ်းပါ။ AI request သည် SmartBookshelf secure proxy မှတစ်ဆင့်သာ သွားပြီး key ကို server-side account setting မှ ဖတ်ပါသည်။ Extension session သည် browser session storage ထဲတွင်သာရှိပြီး extension/browser restart ပြီးနောက် ပြန်လည် sign in လုပ်ရန်လိုနိုင်ပါသည်။ Sign out button ဖြင့် session ကို ချက်ချင်းရှင်းနိုင်ပါသည်။

Screenshot ခလုတ်ကို user က ကိုယ်တိုင်နှိပ်မှသာ လက်ရှိ tab မြင်ကွင်းကို AI သို့ ပို့ပါမည်။ Password, payment, banking, private mail စသည့် အချက်အလက်များပါဝင်သော page များတွင် screenshot မပူးတွဲမီ သေချာစစ်ဆေးပါ။

## Troubleshooting

AI response မပြည့်စုံပါက extension ကို `chrome://extensions` မှ Reload လုပ်ပြီး popup မှ Sign out ပြုလုပ်ကာ ပြန် Sign in ဝင်ပါ။ Proxy connection error ပေါ်ပါက extension version နှင့် `my-ai-proxy` Worker တွဲဖက် deploy ဖြစ်/မဖြစ် စစ်ပါ။ Website login session သက်တမ်းကုန်ပါက sign-in flow သည် login page ကို ပြန်ဖွင့်ပါမည်။
