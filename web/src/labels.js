// Portal-specific labels on top of ui.js (English fallback everywhere).
import { ui } from './ui.js';

const E = {
  en: {
    navOverview: 'Overview', navActions: 'Actions', navSaathi: 'Saathi', navAgents: 'Agents', navInsights: 'Insights', navSettings: 'Privacy & system',
    avgTicket: 'Avg ticket', winPool: 'Win-back pool', stockRisk: 'Items low', loanLim: 'Loan limit', gstDue: 'GSTR-3B due in', days: 'days',
    topAction: 'Top action for you', seeAll: 'See all actions', stockTitle: 'Stock cover', stockSub: 'Days of stock left at the current pace',
    custTitle: 'Customers', loyal: 'Loyal', lapsed: 'Lapsed', fresh: 'New', cashTitle: 'Cash & tax', monthSales: '30-day sales', surplus: 'Est. monthly surplus',
    pendingSettle: 'Settlement pending', gstPayable: 'GST payable (month)', unbilled: 'Unbilled B2B invoices', recon: 'Short settlements',
    festival: 'Next festival', signals: 'Local signals', footfall: 'Footfall index', competitors: 'Competitors within 2 km', shoppers: 'Shoppers within 2 km',
    executor: 'Action executor', mock: 'Built-in rails (mock)', mixed: 'Built-in + live rails', whatsapp: 'WhatsApp', connected: 'connected', queued: 'queued (no token)',
    outbox: 'Outbox', audit: 'Audit trail', theme: 'Look', history: 'Recent activity', recent: 'Latest',
    holdoutBadge: 'Control group', approving: 'Approving…', rpsDone: 'Completed by',
  },
  hi: {
    navOverview: 'ओवरव्यू', navActions: 'एक्शन', navSaathi: 'साथी', navAgents: 'एजेंट', navInsights: 'इनसाइट्स', navSettings: 'प्राइवेसी और सिस्टम',
    avgTicket: 'औसत बिल', winPool: 'वापसी-पूल', stockRisk: 'कम स्टॉक आइटम', loanLim: 'लोन सीमा', gstDue: 'GSTR-3B में', days: 'दिन',
    topAction: 'आपके लिए सबसे ज़रूरी काम', seeAll: 'सारे एक्शन देखें', stockTitle: 'स्टॉक कवर', custTitle: 'ग्राहक', loyal: 'पक्के', lapsed: 'पुराने', fresh: 'नए',
    cashTitle: 'कैश और टैक्स', history: 'हाल की गतिविधि',
  },
  hinglish: {
    navOverview: 'Overview', navActions: 'Actions', navSaathi: 'Saathi', navAgents: 'Agents', navInsights: 'Insights', navSettings: 'Privacy aur system',
    avgTicket: 'Avg bill', winPool: 'Win-back pool', stockRisk: 'Kam stock items', loanLim: 'Loan limit', gstDue: 'GSTR-3B mein', days: 'din',
    topAction: 'Aapke liye sabse zaroori kaam', seeAll: 'Saare actions dekhein', stockTitle: 'Stock cover', custTitle: 'Customers', loyal: 'Pakke', lapsed: 'Purane', fresh: 'Naye',
    cashTitle: 'Cash aur tax', history: 'Haal ki activity',
  },
};
export const label = (lang, key) => E[lang]?.[key] ?? E.en[key] ?? ui(lang, key);
