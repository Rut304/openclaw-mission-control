#!/usr/bin/env node
/**
 * Seed finance data: 4 months of subscriptions + Mac Mini capital expense
 */
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data", "mission-control.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    recurring INTEGER DEFAULT 0,
    recurring_interval TEXT,
    date TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS revenue (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    date TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS api_usage (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT DEFAULT '',
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    requests INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    rate_limit_remaining TEXT DEFAULT '{}',
    snapshot_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const insert = db.prepare(
  `INSERT OR IGNORE INTO expenses (id, category, name, amount, date, recurring, recurring_interval, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

// ---------- Subscriptions (4 months: Mar-Jun 2026) ----------
const months = ["2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"];
const subscriptions = [
  { name: "Anthropic API (Claude Pro)", amount: 20, category: "subscription", notes: "Claude Pro plan - API access" },
  { name: "Claude Max Subscription", amount: 200, category: "subscription", notes: "Claude Max - unlimited usage tier" },
  { name: "GitHub Copilot", amount: 19, category: "subscription", notes: "GitHub Copilot Business" },
  { name: "Cursor Pro", amount: 20, category: "subscription", notes: "Cursor IDE Pro plan" },
  { name: "N8N Cloud", amount: 24, category: "subscription", notes: "N8N Cloud - workflow automation backup" },
  { name: "Vercel Pro", amount: 20, category: "subscription", notes: "Vercel hosting" },
  { name: "Domain (rutroh.ai)", amount: 1.5, category: "hosting", notes: "Monthly amortized - Squarespace domain" },
  { name: "OpenRouter Credits", amount: 10, category: "api_credits", notes: "OpenRouter API credits top-up" },
];

for (const month of months) {
  for (const sub of subscriptions) {
    const id = `exp-${month}-${sub.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    insert.run(id, sub.category, sub.name, sub.amount, month, 1, "monthly", sub.notes);
  }
}

// ---------- Hardware (one-time) ----------
insert.run(
  "exp-2026-02-20-mac-mini",
  "hardware",
  "Mac Mini M4 Pro",
  1300,
  "2026-02-20",
  0,
  null,
  "Apple Mac Mini M4 Pro - primary dev/agent server. Capital expense."
);

// Additional one-time expenses
insert.run(
  "exp-2026-02-22-kalshi-deposit",
  "other",
  "Kalshi Initial Deposit",
  150,
  "2026-02-22",
  0,
  null,
  "Initial trading deposit on Kalshi prediction market"
);

insert.run(
  "exp-2026-02-25-openrouter-credits",
  "api_credits",
  "OpenRouter Credits (Initial)",
  25,
  "2026-02-25",
  0,
  null,
  "Initial OpenRouter credit purchase"
);

const total = db.prepare("SELECT COUNT(*) as cnt, SUM(amount) as total FROM expenses").get();
console.log(`✅ Seeded ${total.cnt} expense records, total: $${total.total.toFixed(2)}`);

db.close();
