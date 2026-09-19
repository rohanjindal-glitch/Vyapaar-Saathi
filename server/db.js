// Single place that touches the SQL driver. Every query is scoped by merchant_id and the
// schema is plain portable SQL, so swapping node:sqlite for Postgres (pg / Cloud SQL) means
// re-implementing only all/get/run/tx below (see README > Scaling).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS merchants(
  id TEXT PRIMARY KEY, name TEXT, owner TEXT, phone TEXT UNIQUE, city TEXT, locality TEXT,
  category TEXT, lang TEXT, device TEXT, plan TEXT, cohort TEXT DEFAULT 'treatment',
  footfall_idx REAL, competitors_2km INTEGER, consumers_2km INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id TEXT, sku TEXT, name TEXT, cost REAL, price REAL,
  gst_rate REAL, stock INTEGER, lead_days INTEGER, supplier TEXT, UNIQUE(merchant_id, sku));
CREATE TABLE IF NOT EXISTS customers(
  id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id TEXT, handle TEXT, name TEXT, first_seen TEXT,
  last_seen TEXT, visits INTEGER DEFAULT 0, spend REAL DEFAULT 0, consent INTEGER DEFAULT 1);
CREATE INDEX IF NOT EXISTS idx_cust_m ON customers(merchant_id, last_seen);
CREATE TABLE IF NOT EXISTS txns(
  id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id TEXT, customer_id INTEGER, ts INTEGER, day TEXT,
  dow INTEGER, hour INTEGER, amount REAL, mode TEXT);
CREATE INDEX IF NOT EXISTS idx_txn_m_day ON txns(merchant_id, day);
CREATE TABLE IF NOT EXISTS txn_items(txn_id INTEGER, merchant_id TEXT, sku TEXT, qty INTEGER, day TEXT);
CREATE INDEX IF NOT EXISTS idx_items_m_day ON txn_items(merchant_id, day, sku);
CREATE TABLE IF NOT EXISTS settlements(
  merchant_id TEXT, day TEXT, txn_total REAL, settled REAL, fee REAL, status TEXT, PRIMARY KEY(merchant_id, day));
CREATE TABLE IF NOT EXISTS invoices(
  id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id TEXT, buyer TEXT, gstin TEXT, amount REAL,
  gst_rate REAL, status TEXT, day TEXT);
CREATE TABLE IF NOT EXISTS actions(
  id TEXT PRIMARY KEY, merchant_id TEXT, dedupe_key TEXT, type TEXT, agent TEXT, copy TEXT, impact REAL,
  confidence REAL, money_moving INTEGER, payload TEXT, trace TEXT, status TEXT, cohort TEXT, method TEXT,
  callback_token TEXT, result TEXT, created_at INTEGER, updated_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_actions_m ON actions(merchant_id, status);
CREATE TABLE IF NOT EXISTS consents(
  merchant_id TEXT, scope TEXT, granted INTEGER, ts INTEGER, PRIMARY KEY(merchant_id, scope));
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id TEXT, role TEXT, text TEXT, channel TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS memories(
  id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id TEXT, kind TEXT, text TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS audit(
  id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id TEXT, event TEXT, detail TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS chat_state(merchant_id TEXT PRIMARY KEY, pending_action_id TEXT);
CREATE TABLE IF NOT EXISTS outbound(
  id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id TEXT, channel TEXT, text TEXT, status TEXT, ts INTEGER);
`);

const cache = new Map();
const stmt = (sql) => {
  let s = cache.get(sql);
  if (!s) cache.set(sql, (s = db.prepare(sql)));
  return s;
};
const clean = (p) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));

export const all = (sql, ...p) => stmt(sql).all(...clean(p));
export const get = (sql, ...p) => stmt(sql).get(...clean(p));
export const run = (sql, ...p) => stmt(sql).run(...clean(p));

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const audit = (merchantId, event, detail = {}) =>
  run('INSERT INTO audit(merchant_id,event,detail,ts) VALUES(?,?,?,?)', merchantId, event, JSON.stringify(detail), Date.now());
