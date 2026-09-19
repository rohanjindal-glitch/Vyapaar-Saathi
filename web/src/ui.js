// UI strings. English is the fallback for anything not translated.
const en = {
  hello: 'Namaste', todaySoFar: 'Today so far', usually: 'vs usual by now', yesterday: 'Yesterday', last7: 'Last 7 days',
  last30: 'Last 30 days', last30sub: 'Weakest weekday highlighted', doToday: 'What to do today',
  doTodaySub: 'Ranked by rupee impact. You approve, Saathi executes.', approve: 'Approve', notNow: 'Not now', why: 'Why',
  agentsAgreed: 'How the agents agreed', perMonth: '/mo est. impact', needsOk: 'Money action · needs your OK', executing: 'Running…',
  done: 'Done', failed: 'Failed', reverted: 'Reverted', revert: 'Undo', holdout_logged: 'Recorded (control group)', rejected: 'Skipped',
  controlNote: 'You are in the measurement control group: approvals are recorded but nothing is executed.',
  agents: 'Your six agents', askSaathi: 'Talk to Saathi', placeholder: 'Type, or tap the mic…', send: 'Send', listening: 'Listening…',
  activity: 'Activity', impact: 'Measured impact', privacy: 'Privacy & consent', marketing: 'Marketing messages to my customers',
  lending: 'Share my sales data for loan offers', memory: 'What Saathi remembers', system: 'System', shuffle: 'Shuffle look',
  dark: 'Dark', light: 'Light', auto: 'Auto', speak: 'Speak replies', noOpps: 'Nothing needs you right now.', language: 'Language',
  pick: 'Demo merchant', micNo: "Voice input isn't supported in this browser — type instead.", treatment: 'Copilot merchants',
  holdout: 'Control merchants', lift: 'Lift', growthLbl: '30-day GMV growth', consentOn: 'On', consentOff: 'Off', reach: 'shoppers within 2 km',
  itemsLow: 'items running low', pool: 'win-back pool', loanLimit: 'loan limit', invoices: 'invoices to raise', dip: 'weekday dip', listeningLbl: 'ready',
  ag_growth: 'Growth Agent', ag_inventory: 'Inventory Agent', ag_customer: 'Customer Agent', ag_money: 'Money Agent', ag_compliance: 'Compliance Agent', ag_voice: 'Voice Saathi',
  agd_growth: 'Finds slow days, designs and launches offers', agd_inventory: 'Predicts stock-outs, drafts purchase orders', agd_customer: 'Segments buyers, runs WhatsApp win-back',
  agd_money: 'Cashflow view and a loan sized to what you can repay', agd_compliance: 'GST-ready books, invoices, reconciliation', agd_voice: 'Answers in your language, by voice',
  chips: ['Sales today', 'Stock', 'Customers', 'Loan', 'GST', 'What should I do today'], noMem: 'No memories yet — approve an action and Saathi will remember it.',
  synthetic: 'Synthetic demo data', moneyNote: 'Estimates from sales patterns; not a credit decision.', sources: 'Actions run via', memSrc: 'Memory source',
};

const hi = {
  hello: 'नमस्ते', todaySoFar: 'आज अब तक', usually: 'सामान्य से', yesterday: 'कल', last7: 'पिछले 7 दिन', last30: 'पिछले 30 दिन', last30sub: 'सबसे कमज़ोर दिन रंगीन',
  doToday: 'आज क्या करें', doTodaySub: 'कमाई के हिसाब से क्रम में। आप मंज़ूरी दें, साथी काम करेगा।', approve: 'मंज़ूर करें', notNow: 'अभी नहीं', why: 'क्यों',
  agentsAgreed: 'एजेंट्स कैसे सहमत हुए', perMonth: '/माह अनुमानित असर', needsOk: 'पैसे का काम · आपकी मंज़ूरी ज़रूरी', executing: 'चल रहा है…', done: 'हो गया',
  failed: 'नहीं हुआ', reverted: 'वापस लिया', revert: 'वापस लें', holdout_logged: 'दर्ज (कंट्रोल ग्रुप)', rejected: 'छोड़ा',
  controlNote: 'आप माप के कंट्रोल ग्रुप में हैं: मंज़ूरी दर्ज होगी, काम चलेगा नहीं।', agents: 'आपके छह एजेंट', askSaathi: 'साथी से बात करें',
  placeholder: 'लिखें या माइक दबाएँ…', send: 'भेजें', listening: 'सुन रहा हूँ…', activity: 'गतिविधि', impact: 'मापा गया असर', privacy: 'प्राइवेसी और सहमति',
  marketing: 'मेरे ग्राहकों को मार्केटिंग मैसेज', lending: 'लोन ऑफ़र के लिए बिक्री डेटा साझा करें', memory: 'साथी को क्या याद है', system: 'सिस्टम',
  shuffle: 'लुक बदलें', dark: 'डार्क', light: 'लाइट', auto: 'ऑटो', speak: 'जवाब बोलकर सुनाएँ', noOpps: 'अभी आपके लिए कुछ नहीं है।', language: 'भाषा',
  pick: 'डेमो व्यापारी', consentOn: 'चालू', consentOff: 'बंद', reach: 'ग्राहक 2 किमी के भीतर', itemsLow: 'आइटम कम हैं', pool: 'वापसी-पूल', loanLimit: 'लोन सीमा',
  invoices: 'इनवॉइस बनाने हैं', dip: 'दिन की गिरावट', ag_growth: 'ग्रोथ एजेंट', ag_inventory: 'इन्वेंटरी एजेंट', ag_customer: 'कस्टमर एजेंट', ag_money: 'मनी एजेंट',
  ag_compliance: 'कंप्लायंस एजेंट', ag_voice: 'वॉइस साथी', chips: ['आज की बिक्री', 'स्टॉक', 'ग्राहक', 'लोन', 'GST', 'आज क्या करूँ'],
};

const hinglish = {
  hello: 'Namaste', todaySoFar: 'Aaj ab tak', usually: 'usual se', yesterday: 'Kal', last7: 'Pichhle 7 din', last30: 'Pichhle 30 din', last30sub: 'Sabse kamzor din highlight',
  doToday: 'Aaj kya karein', doTodaySub: 'Kamai ke hisaab se order mein. Aap approve karo, Saathi kaam karega.', approve: 'Approve karein', notNow: 'Abhi nahi', why: 'Kyun',
  agentsAgreed: 'Agents kaise sahmat hue', perMonth: '/mahina anumaanit asar', needsOk: 'Paise ka kaam · aapki approval zaroori', executing: 'Chal raha hai…', done: 'Ho gaya',
  failed: 'Nahi hua', reverted: 'Wapas liya', revert: 'Wapas lein', holdout_logged: 'Record (control group)', rejected: 'Chhoda',
  controlNote: 'Aap measurement ke control group mein hain: approval record hoga, kaam chalega nahi.', agents: 'Aapke chhe agents', askSaathi: 'Saathi se baat karein',
  placeholder: 'Likhein ya mic dabayein…', send: 'Bhejein', listening: 'Sun raha hoon…', activity: 'Activity', impact: 'Naapa gaya asar', privacy: 'Privacy aur consent',
  marketing: 'Mere customers ko marketing message', lending: 'Loan offers ke liye sale data share karein', memory: 'Saathi ko kya yaad hai', system: 'System',
  shuffle: 'Look badlein', dark: 'Dark', light: 'Light', auto: 'Auto', speak: 'Jawab bolkar sunayein', noOpps: 'Abhi aapke liye kuch nahi hai.', language: 'Bhasha',
  pick: 'Demo merchant', consentOn: 'Chalu', consentOff: 'Band', reach: 'shoppers 2 km ke andar', itemsLow: 'items kam hain', pool: 'win-back pool', loanLimit: 'loan limit',
  invoices: 'invoices banane hain', dip: 'weekday dip', chips: ['Aaj ki sale', 'Stock', 'Customers', 'Loan', 'GST', 'Aaj kya karun'],
};

// mr / gu / ta / bn: core flow translated; everything else falls back to English
const mr = { hello: 'नमस्कार', todaySoFar: 'आज आतापर्यंत', yesterday: 'काल', last7: 'मागील 7 दिवस', doToday: 'आज काय करावे', approve: 'मंजूर करा', notNow: 'आता नको', why: 'का', agents: 'तुमचे सहा एजंट', askSaathi: 'साथीशी बोला', placeholder: 'लिहा किंवा माइक दाबा…', send: 'पाठवा', listening: 'ऐकत आहे…', activity: 'हालचाल', privacy: 'गोपनीयता आणि संमती', executing: 'सुरू आहे…', done: 'झाले', chips: ['आजची विक्री', 'स्टॉक', 'ग्राहक', 'कर्ज', 'GST', 'आज काय करू'] };
const gu = { hello: 'નમસ્તે', todaySoFar: 'આજે અત્યાર સુધી', yesterday: 'ગઈકાલ', last7: 'છેલ્લા 7 દિવસ', doToday: 'આજે શું કરવું', approve: 'મંજૂર કરો', notNow: 'હમણાં નહીં', why: 'કેમ', agents: 'તમારા છ એજન્ટ', askSaathi: 'સાથી સાથે વાત કરો', placeholder: 'લખો અથવા માઇક દબાવો…', send: 'મોકલો', listening: 'સાંભળું છું…', activity: 'પ્રવૃત્તિ', privacy: 'ગોપનીયતા અને સંમતિ', executing: 'ચાલુ છે…', done: 'થઈ ગયું', chips: ['આજનું વેચાણ', 'સ્ટોક', 'ગ્રાહક', 'લોન', 'GST', 'આજે શું કરું'] };
const ta = { hello: 'வணக்கம்', todaySoFar: 'இன்று இதுவரை', yesterday: 'நேற்று', last7: 'கடந்த 7 நாட்கள்', doToday: 'இன்று என்ன செய்யலாம்', approve: 'ஒப்புதல்', notNow: 'இப்போது வேண்டாம்', why: 'ஏன்', agents: 'உங்கள் ஆறு ஏஜெண்டுகள்', askSaathi: 'சாத்தியுடன் பேசுங்கள்', placeholder: 'தட்டச்சு செய்யுங்கள் அல்லது மைக்கை அழுத்துங்கள்…', send: 'அனுப்பு', listening: 'கேட்கிறேன்…', activity: 'செயல்பாடு', privacy: 'தனியுரிமை & ஒப்புதல்', executing: 'நடக்கிறது…', done: 'முடிந்தது', chips: ['இன்றைய விற்பனை', 'ஸ்டாக்', 'வாடிக்கையாளர்', 'கடன்', 'GST', 'இன்று என்ன செய்யலாம்'] };
const bn = { hello: 'নমস্কার', todaySoFar: 'আজ এখন পর্যন্ত', yesterday: 'গতকাল', last7: 'গত ৭ দিন', doToday: 'আজ কী করবেন', approve: 'অনুমোদন', notNow: 'এখন নয়', why: 'কেন', agents: 'আপনার ছয় এজেন্ট', askSaathi: 'সাথীর সঙ্গে কথা বলুন', placeholder: 'লিখুন বা মাইক চাপুন…', send: 'পাঠান', listening: 'শুনছি…', activity: 'কার্যকলাপ', privacy: 'গোপনীয়তা ও সম্মতি', executing: 'চলছে…', done: 'হয়েছে', chips: ['আজকের বিক্রি', 'স্টক', 'গ্রাহক', 'লোন', 'GST', 'আজ কী করব'] };

const D = { en, hi, hinglish, mr, gu, ta, bn };
export const LANG_LABELS = { en: 'English', hi: 'हिन्दी', hinglish: 'Hinglish', mr: 'मराठी', gu: 'ગુજરાતી', ta: 'தமிழ்', bn: 'বাংলা' };
export const SPEECH = { en: 'en-IN', hinglish: 'hi-IN', hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', ta: 'ta-IN', bn: 'bn-IN' };
export const ui = (lang, key) => D[lang]?.[key] ?? D.en[key] ?? key;

