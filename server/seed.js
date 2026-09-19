// Synthetic merchant universe. Stands in for the "anonymised merchant txn sandbox" the deck asks Paytm for.
// Customer-driven generation: each customer has an activity profile, so segments (loyal / lapsed / new)
// and the weekday dip emerge from the data instead of being hard-coded.
import { fileURLToPath } from 'node:url';
import { all, get, run, tx, audit } from './db.js';
import { clock, ymd, addDays, rng, fnv } from './util.js';

const C = {
  kirana: [
    ['MILK500', 'Amul Taaza Milk 500ml', 25, 27, 0, 10, 'Local Dairy'],
    ['BREAD', 'Britannia Bread', 36, 42, 0, 8, 'Local Dairy'],
    ['EGGS30', 'Eggs (tray of 30)', 165, 190, 0, 6, 'Local Dairy'],
    ['MAGGI4', 'Maggi Noodles 4-pack', 52, 60, 12, 7, 'Lucknow Distributors'],
    ['PARLEG', 'Parle-G Biscuit 800g', 70, 84, 18, 6, 'Lucknow Distributors'],
    ['COLA750', 'Coca-Cola 750ml', 32, 40, 18, 5, 'Lucknow Distributors'],
    ['NAMKEEN', 'Haldiram Bhujia 400g', 88, 108, 12, 4, 'Lucknow Distributors'],
    ['SALT1', 'Tata Salt 1kg', 22, 25, 0, 4, 'Gupta Wholesale'],
    ['ATTA5', 'Aashirvaad Atta 5kg', 245, 268, 5, 4, 'Gupta Wholesale'],
    ['OIL1', 'Fortune Sunflower Oil 1L', 128, 142, 5, 3, 'Gupta Wholesale'],
    ['SURF1', 'Surf Excel 1kg', 118, 134, 18, 3, 'Gupta Wholesale'],
    ['TEA250', 'Tata Tea Gold 250g', 118, 136, 5, 4, 'Gupta Wholesale'],
  ],
  sweets: [
    ['KAJU500', 'Kaju Katli 500g', 380, 520, 5, 4, 'Ahmedabad Dryfruit Mart'],
    ['GATHIYA', 'Gathiya 500g', 120, 180, 5, 8, 'Shree Ghee Traders'],
    ['FAFDA', 'Fafda 250g', 60, 95, 5, 9, 'Shree Ghee Traders'],
    ['JALEBI', 'Jalebi 500g', 90, 150, 5, 8, 'Shree Ghee Traders'],
    ['DHOKLA', 'Khaman Dhokla box', 70, 120, 5, 7, 'Shree Ghee Traders'],
    ['MOHAN', 'Mohanthal 500g', 220, 330, 5, 3, 'Ahmedabad Dryfruit Mart'],
    ['CHEVDO', 'Chevdo 500g', 110, 170, 12, 5, 'Shree Ghee Traders'],
    ['CHIKKI', 'Peanut Chikki 250g', 55, 90, 12, 4, 'Ahmedabad Dryfruit Mart'],
  ],
  restaurant: [
    ['IDLI', 'Idli plate (3)', 18, 45, 5, 10, 'Chennai Fresh Batter Co'],
    ['DOSA', 'Masala Dosa', 30, 85, 5, 9, 'Chennai Fresh Batter Co'],
    ['COFFEE', 'Filter Coffee', 8, 30, 5, 10, 'Kumbakonam Coffee Works'],
    ['PONGAL', 'Ven Pongal', 25, 70, 5, 5, 'Chennai Fresh Batter Co'],
    ['VADA', 'Medu Vada (2)', 15, 50, 5, 6, 'Chennai Fresh Batter Co'],
    ['MEALS', 'South Indian Meals', 55, 140, 5, 6, 'T Nagar Grocers'],
  ],
  pharmacy: [
    ['PARA650', 'Paracetamol 650mg strip', 20, 30, 12, 8, 'Kolkata Medico Depot'],
    ['ORS', 'ORS Sachet', 12, 20, 12, 6, 'Kolkata Medico Depot'],
    ['COUGH', 'Cough Syrup 100ml', 62, 92, 12, 5, 'Kolkata Medico Depot'],
    ['VITC', 'Vitamin C Tablets (15)', 45, 70, 12, 4, 'Kolkata Medico Depot'],
    ['SANI', 'Hand Sanitizer 200ml', 55, 85, 18, 3, 'Eastern Health Supplies'],
    ['BANDAGE', 'Crepe Bandage', 40, 65, 12, 3, 'Eastern Health Supplies'],
  ],
  apparel: [
    ['KURTA', 'Cotton Kurta', 420, 749, 5, 6, 'Hyderabad Textile Hub'],
    ['JEANS', 'Slim-fit Jeans', 640, 1099, 12, 5, 'Hyderabad Textile Hub'],
    ['DUPATTA', 'Printed Dupatta', 150, 299, 5, 5, 'Charminar Fabrics'],
    ['TSHIRT', 'Round-neck T-shirt', 190, 399, 5, 7, 'Hyderabad Textile Hub'],
    ['SAREE', 'Cotton Saree', 520, 899, 5, 3, 'Charminar Fabrics'],
  ],
};

// dowFactor index 0 = Sunday
const MERCHANTS = [
  { id: 'm_sharma', name: 'Sharma General Store', owner: 'Ramesh Sharma', phone: '919800000001', city: 'Lucknow', locality: 'Aliganj', category: 'kirana', lang: 'hinglish', device: 'Soundbox 4.0', plan: 'pro', cohort: 'treatment', footfall: 1.15, comp: 6, consumers: 5200, scale: 1, dow: [1.12, 1.0, 0.79, 1.0, 1.02, 1.06, 1.1], risky: ['MAGGI4', 'COLA750', 'EGGS30'] },
  { id: 'm_patel', name: 'Patel Farsan & Sweets', owner: 'Hitesh Patel', phone: '919800000002', city: 'Ahmedabad', locality: 'Navrangpura', category: 'sweets', lang: 'gu', device: 'Soundbox 4.0', plan: 'pro', cohort: 'treatment', footfall: 1.3, comp: 9, consumers: 7400, scale: 0.55, dow: [1.35, 0.85, 0.9, 0.9, 0.95, 1.05, 1.3], risky: ['KAJU500', 'GATHIYA'] },
  { id: 'm_iyer', name: 'Iyer Tiffin Centre', owner: 'Lakshmi Iyer', phone: '919800000003', city: 'Chennai', locality: 'T Nagar', category: 'restaurant', lang: 'ta', device: 'Soundbox 3.0', plan: 'free', cohort: 'treatment', footfall: 1.4, comp: 12, consumers: 9100, scale: 0.7, dow: [1.25, 1.0, 0.95, 0.95, 1.0, 1.0, 1.15], risky: ['COFFEE'] },
  { id: 'm_banerjee', name: 'Banerjee Medico', owner: 'Sourav Banerjee', phone: '919800000004', city: 'Kolkata', locality: 'Gariahat', category: 'pharmacy', lang: 'bn', device: 'Soundbox 4.0', plan: 'pro', cohort: 'treatment', footfall: 1.05, comp: 8, consumers: 6100, scale: 0.5, dow: [0.9, 1.05, 1.05, 1.0, 1.0, 1.0, 1.0], risky: ['ORS'] },
  { id: 'm_deshmukh', name: 'Deshmukh Kirana', owner: 'Sunita Deshmukh', phone: '919800000005', city: 'Pune', locality: 'Kothrud', category: 'kirana', lang: 'mr', device: 'Soundbox 3.0', plan: 'free', cohort: 'holdout', footfall: 1.0, comp: 5, consumers: 4300, scale: 0.6, dow: [1.1, 1.0, 1.0, 0.85, 1.0, 1.05, 1.1], risky: ['MAGGI4'] },
  { id: 'm_khan', name: 'Khan Fashion Point', owner: 'Imran Khan', phone: '919800000006', city: 'Hyderabad', locality: 'Charminar', category: 'apparel', lang: 'hi', device: 'Soundbox 4.0', plan: 'pro', cohort: 'holdout', footfall: 1.25, comp: 14, consumers: 8800, scale: 0.35, dow: [1.3, 0.8, 0.85, 0.9, 0.95, 1.2, 1.4], risky: ['KURTA'] },
];

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const HOUR_W = [3, 6, 7, 5, 4, 4, 3, 3, 4, 6, 8, 8, 5, 2];
const pick = (r, weights) => {
  let t = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((t -= weights[i]) < 0) return i;
  return weights.length - 1;
};

function profiles(s) {
  // [count, startFrom, startTo, endFrom, endTo, p]  (values are "days ago")
  const n = (x) => Math.max(6, Math.round(x * s));
  return {
    loyal: [n(150), 89, 60, 0, 0, 0.3],
    regular: [n(250), 89, 40, 0, 0, 0.09],
    occasional: [n(300), 89, 20, 0, 0, 0.03],
    lapsed: [n(360), 89, 75, 70, 31, 0.15],
    fresh: [n(150), 58, 1, 0, 0, 0.2],
  };
}

export function seed() {
  const now = clock.now();
  const today = ymd(now);
  const hourNow = now.getHours();
  const d = (n) => ymd(addDays(now, -n));

  tx(() => {
    for (const t of ['merchants', 'products', 'customers', 'txns', 'txn_items', 'settlements', 'invoices', 'actions', 'consents', 'messages', 'memories', 'audit', 'chat_state', 'outbound'])
      run(`DELETE FROM ${t}`);
  });

  for (const m of MERCHANTS) {
    const r = rng(fnv(m.id));
    tx(() => {
      run('INSERT INTO merchants VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', m.id, m.name, m.owner, m.phone, m.city, m.locality, m.category, m.lang, m.device, m.plan, m.cohort, m.footfall, m.comp, m.consumers, today);
      const prods = C[m.category];
      for (const [sku, name, cost, price, gst, , supplier] of prods)
        run('INSERT INTO products(merchant_id,sku,name,cost,price,gst_rate,stock,lead_days,supplier) VALUES(?,?,?,?,?,?,?,?,?)', m.id, sku, name, cost, price, gst, 0, 2, supplier);
      run('INSERT INTO consents VALUES(?,?,?,?)', m.id, 'marketing', 1, Date.now());
      run('INSERT INTO consents VALUES(?,?,?,?)', m.id, 'lending', 1, Date.now());

      // customers + visits
      const custs = [];
      for (const [kind, [count, sFrom, sTo, eFrom, eTo, p]] of Object.entries(profiles(m.scale))) {
        for (let i = 0; i < count; i++) {
          const start = Math.round(sFrom - r() * (sFrom - sTo));
          const end = Math.round(eFrom - r() * (eFrom - eTo));
          const handle = 'tok_' + fnv(`${m.id}${kind}${i}`).toString(16);
          const info = run('INSERT INTO customers(merchant_id,handle,name,first_seen,last_seen,consent) VALUES(?,?,?,?,?,?)', m.id, handle, `Customer ${handle.slice(-4)}`, d(start), d(start), r() < 0.88 ? 1 : 0);
          custs.push({ id: Number(info.lastInsertRowid), start, end, p, visits: 0, spend: 0, first: null, last: null });
        }
      }
      const weights = prods.map((x) => x[5]);
      for (let ago = 89; ago >= 0; ago--) {
        const date = addDays(now, -ago);
        const day = ymd(date);
        const dow = date.getDay();
        for (const c of custs) {
          if (ago > c.start || ago < c.end) continue;
          if (r() >= c.p * m.dow[dow]) continue;
          const hour = HOURS[pick(r, HOUR_W)];
          if (day === today && hour > hourNow) continue;
          const k = 1 + pick(r, [0.35, 0.3, 0.2, 0.15]);
          const chosen = new Set();
          while (chosen.size < Math.min(k, prods.length)) chosen.add(pick(r, weights));
          let amount = 0;
          const lines = [];
          for (const idx of chosen) {
            const qty = 1 + Math.floor(r() * (prods[idx][3] > 300 ? 1.6 : 3));
            amount += qty * prods[idx][3];
            lines.push([prods[idx][0], qty]);
          }
          const mode = ['UPI QR', 'UPI QR', 'UPI QR', 'Soundbox', 'Card'][Math.floor(r() * 5)];
          const ts = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, Math.floor(r() * 60)).getTime();
          const t = run('INSERT INTO txns(merchant_id,customer_id,ts,day,dow,hour,amount,mode) VALUES(?,?,?,?,?,?,?,?)', m.id, c.id, ts, day, dow, hour, amount, mode);
          for (const [sku, qty] of lines) run('INSERT INTO txn_items VALUES(?,?,?,?,?)', Number(t.lastInsertRowid), m.id, sku, qty, day);
          c.visits++;
          c.spend += amount;
          c.first ??= day;
          c.last = day;
        }
      }
      for (const c of custs) {
        if (c.visits) run('UPDATE customers SET first_seen=?, last_seen=?, visits=?, spend=? WHERE id=?', c.first, c.last, c.visits, c.spend, c.id);
        else run('DELETE FROM customers WHERE id=?', c.id);
      }

      // stock levels from real velocity: risky SKUs get ~1-2 days of cover, others 8-25
      const vel = Object.fromEntries(all('SELECT sku, SUM(qty)/14.0 v FROM txn_items WHERE merchant_id=? AND day>=? AND day<? GROUP BY sku', m.id, d(14), today).map((x) => [x.sku, x.v]));
      for (const [sku] of prods) {
        const cover = m.risky.includes(sku) ? 1 + r() * 1.1 : 8 + r() * 17;
        run('UPDATE products SET stock=? WHERE merchant_id=? AND sku=?', Math.max(2, Math.round((vel[sku] || 1) * cover)), m.id, sku);
      }

      // settlements (two silently short days on some merchants -> reconciliation demo)
      const totals = all('SELECT day, SUM(amount) t FROM txns WHERE merchant_id=? AND day>=? GROUP BY day', m.id, d(30));
      const shortDays = new Set(['m_sharma', 'm_patel', 'm_iyer'].includes(m.id) ? [d(9), d(17)] : []);
      for (const x of totals) {
        const fee = Math.round(x.t * 0.0025);
        const pending = x.day >= d(1);
        const short = shortDays.has(x.day) ? 120 + Math.round(r() * 360) : 0;
        run('INSERT INTO settlements VALUES(?,?,?,?,?,?)', m.id, x.day, x.t, pending ? 0 : x.t - fee - short, fee, pending ? 'pending' : 'settled');
      }

      // B2B invoices not yet raised
      const buyers = ['Lucknow Public School Canteen', 'Hotel Saraswati', 'Shri Ram Caterers', 'City Hospital Mess'];
      const nInv = m.id === 'm_sharma' ? 3 : m.id === 'm_patel' ? 2 : m.id === 'm_iyer' ? 1 : 0;
      for (let i = 0; i < nInv; i++)
        run('INSERT INTO invoices(merchant_id,buyer,gstin,amount,gst_rate,status,day) VALUES(?,?,?,?,?,?,?)', m.id, buyers[i], `09AAB${i}${fnv(m.id + i) % 9000 + 1000}Z1Z5`, 6000 + Math.round(r() * 16000), 5, 'pending', d(2 + i));
    });
  }
  return all('SELECT id FROM merchants').length;
}

export function ensureSeeded() {
  const last = get('SELECT MAX(day) d FROM txns')?.d;
  if (!last || last < ymd(addDays(clock.now(), -1))) {
    const n = seed();
    audit('system', 'seeded', { merchants: n });
    return true;
  }
  return false;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`seeded ${seed()} merchants`);
  console.log(all('SELECT merchant_id, COUNT(*) txns, ROUND(SUM(amount)) gmv FROM txns GROUP BY merchant_id'));
}



