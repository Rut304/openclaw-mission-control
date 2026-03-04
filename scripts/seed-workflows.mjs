#!/usr/bin/env node
/**
 * Seed KanikaBK-style workflows into Mission Control database.
 * Run: node scripts/seed-workflows.mjs
 * 
 * This creates workflow definitions for each mission based on
 * the KanikaBK playbook patterns: X/Twitter ingestion, content
 * pipelines, trading automation, and infrastructure monitoring.
 */

import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "data", "mission-control.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create workflows table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    mission_id TEXT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'error')),
    nodes TEXT DEFAULT '[]',
    connections TEXT DEFAULT '[]',
    last_run TEXT,
    next_run TEXT,
    cron_expression TEXT,
    n8n_workflow_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_workflows_mission ON workflows(mission_id);
`);

// Get existing missions
const missions = db.prepare("SELECT id, name FROM missions").all();
console.log(`Found ${missions.length} missions:`);
missions.forEach((m) => console.log(`  - ${m.name} (${m.id})`));

// Find missions by name
function findMission(nameFragment) {
  return missions.find((m) => m.name.toLowerCase().includes(nameFragment.toLowerCase()));
}

const revenueMission = findMission("Revenue");
const contentMission = findMission("Content");
const tradingMission = findMission("Trading");
const infraMission = findMission("Infrastructure");

// Clear existing workflows
db.prepare("DELETE FROM workflows").run();
console.log("\nCleared existing workflows.");

// Insert helper
const insertWorkflow = db.prepare(`
  INSERT INTO workflows (id, mission_id, name, description, status, nodes, connections, last_run, next_run, cron_expression)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function seed(missionId, name, description, status, nodes, connections, cronExpr, lastRun, nextRun) {
  const id = randomUUID();
  insertWorkflow.run(
    id,
    missionId,
    name,
    description,
    status,
    JSON.stringify(nodes),
    JSON.stringify(connections),
    lastRun || null,
    nextRun || null,
    cronExpr || null
  );
  console.log(`  + ${name} (${status})`);
  return id;
}

// ========================================
// CONTENT & SOCIAL MISSION WORKFLOWS
// ========================================
if (contentMission) {
  console.log(`\nSeeding workflows for "${contentMission.name}":`);

  // 1. X/Twitter Ingestion Pipeline (KanikaBK core workflow)
  seed(
    contentMission.id,
    "X/Twitter Ingestion Pipeline",
    "Monitor target accounts via FxTwitter API, extract tweets, enrich with context, store in knowledge base. Based on KanikaBK pattern.",
    "active",
    [
      { id: "n1", name: "Cron (5min)", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "FxTwitter Fetch", type: "action", position: { x: 1, y: 0 }, config: { api: "api.fxtwitter.com", accounts: ["@aiagents", "@kanikabk", "@MatthewBerman"] } },
      { id: "n3", name: "Content Filter", type: "logic", position: { x: 2, y: 0 }, config: { minEngagement: 100, topics: ["AI", "agents", "automation"] } },
      { id: "n4", name: "Enrich Context", type: "action", position: { x: 3, y: 0 }, config: { model: "gemini-2.0-flash", prompt: "Extract key insights and reply angle" } },
      { id: "n5", name: "Store in KB", type: "data", position: { x: 4, y: 0 }, config: { db: "sqlite", table: "knowledge_base" } },
      { id: "n6", name: "Generate Reply", type: "action", position: { x: 5, y: 0 }, config: { model: "claude-sonnet", tone: "insightful" } },
      { id: "n7", name: "Quality Gate", type: "logic", position: { x: 6, y: 0 }, config: { minConfidence: 0.8, autoApprove: true } },
      { id: "n8", name: "Post via Playwright", type: "action", position: { x: 7, y: 0 }, config: { method: "browser_automation", account: "@rohrut_ai" } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
      { from: "n7", to: "n8" },
    ],
    "*/5 * * * *",
    new Date(Date.now() - 300000).toISOString(),
    new Date(Date.now() + 300000).toISOString()
  );

  // 2. Content Discovery & Viral Detection
  seed(
    contentMission.id,
    "Content Discovery Pipeline",
    "Scan Reddit, HN, and RSS feeds for viral AI content. Detect trending topics and queue for response generation.",
    "active",
    [
      { id: "n1", name: "Cron (15min)", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "Reddit RSS Scan", type: "action", position: { x: 1, y: 0 }, config: { subreddits: ["r/artificial", "r/MachineLearning", "r/LocalLLaMA"] } },
      { id: "n3", name: "HN Frontpage", type: "action", position: { x: 1, y: 1 }, config: { endpoint: "hn.algolia.com/api/v1" } },
      { id: "n4", name: "Viral Detector", type: "logic", position: { x: 2, y: 0 }, config: { threshold: "2x avg engagement", timeWindow: "2h" } },
      { id: "n5", name: "Topic Extraction", type: "action", position: { x: 3, y: 0 }, config: { model: "gemini-2.0-flash" } },
      { id: "n6", name: "Queue for Reply", type: "data", position: { x: 4, y: 0 }, config: { queue: "content_queue", priority: "engagement_score" } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n1", to: "n3" },
      { from: "n2", to: "n4" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
    ],
    "*/15 * * * *",
    new Date(Date.now() - 900000).toISOString(),
    new Date(Date.now() + 900000).toISOString()
  );

  // 3. Blog & Long-Form Content Pipeline
  seed(
    contentMission.id,
    "Blog Content Pipeline",
    "Generate blog posts from knowledge base insights. SEO optimize, create social snippets, schedule publication.",
    "active",
    [
      { id: "n1", name: "Daily (9am)", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "KB Topic Mining", type: "data", position: { x: 1, y: 0 }, config: { source: "knowledge_base", strategy: "trending+gaps" } },
      { id: "n3", name: "Draft Generator", type: "action", position: { x: 2, y: 0 }, config: { model: "claude-sonnet", wordCount: 1500 } },
      { id: "n4", name: "SEO Optimizer", type: "action", position: { x: 3, y: 0 }, config: { keywords: "auto", readability: "grade8" } },
      { id: "n5", name: "Social Snippets", type: "action", position: { x: 4, y: 0 }, config: { platforms: ["twitter", "reddit", "linkedin"] } },
      { id: "n6", name: "CEO Approval", type: "logic", position: { x: 5, y: 0 }, config: { requireApproval: true, channel: "dashboard" } },
      { id: "n7", name: "Publish", type: "action", position: { x: 6, y: 0 }, config: { targets: ["substack", "blog"] } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
    ],
    "0 9 * * *",
    null,
    null
  );

  // 4. TikTok/Short-Form Video Pipeline
  seed(
    contentMission.id,
    "Video Idea Pipeline",
    "KanikaBK-style video idea generation. Mine trending topics, create scripts, generate thumbnails, queue for production.",
    "inactive",
    [
      { id: "n1", name: "Trend Scanner", type: "trigger", position: { x: 0, y: 0 }, config: { sources: ["tiktok", "youtube_shorts", "x_trending"] } },
      { id: "n2", name: "Idea Generator", type: "action", position: { x: 1, y: 0 }, config: { model: "claude-sonnet", format: "hook+value+cta" } },
      { id: "n3", name: "Script Writer", type: "action", position: { x: 2, y: 0 }, config: { duration: "60s", style: "educational" } },
      { id: "n4", name: "Thumbnail Gen", type: "action", position: { x: 3, y: 0 }, config: { tool: "dall-e-3", style: "bold_text_overlay" } },
      { id: "n5", name: "Queue & Schedule", type: "data", position: { x: 4, y: 0 }, config: { calendar: "content_calendar" } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
    ],
    null,
    null,
    null
  );
}

// ========================================
// TRADING BOTS MISSION WORKFLOWS
// ========================================
if (tradingMission) {
  console.log(`\nSeeding workflows for "${tradingMission.name}":`);

  // 1. Kalshi Market Scanner
  seed(
    tradingMission.id,
    "Kalshi Market Scanner",
    "Scan Kalshi prediction markets for opportunities. Research context, evaluate edge, size positions. Reports to Rak agent.",
    "active",
    [
      { id: "n1", name: "Cron (30min)", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "Kalshi API Scan", type: "action", position: { x: 1, y: 0 }, config: { endpoint: "trading-api.kalshi.com", markets: "active" } },
      { id: "n3", name: "Opportunity Filter", type: "logic", position: { x: 2, y: 0 }, config: { minVolume: 1000, maxSpread: 0.15, categories: ["politics", "economics", "tech"] } },
      { id: "n4", name: "Research Sprint", type: "action", position: { x: 3, y: 0 }, config: { model: "claude-sonnet", duration: "1hr PhD-level", sources: ["news", "data", "expert"] } },
      { id: "n5", name: "Edge Calculator", type: "logic", position: { x: 4, y: 0 }, config: { minEdge: 0.05, kellyFraction: 0.25 } },
      { id: "n6", name: "Risk Check (Red)", type: "logic", position: { x: 5, y: 0 }, config: { maxPosition: 10, dailyLossHalt: 20, stopLoss: true } },
      { id: "n7", name: "Place Trade", type: "action", position: { x: 6, y: 0 }, config: { api: "kalshi", maxPerTrade: "$10" } },
      { id: "n8", name: "Log & Monitor", type: "data", position: { x: 7, y: 0 }, config: { logFile: "trade_journal.json", alertOnLoss: true } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
      { from: "n7", to: "n8" },
    ],
    "*/30 * * * *",
    new Date(Date.now() - 1800000).toISOString(),
    new Date(Date.now() + 1800000).toISOString()
  );

  // 2. Position Monitor & Exit
  seed(
    tradingMission.id,
    "Position Monitor & Exit",
    "Monitor open Kalshi positions. Auto-exit on stop-loss triggers or target profit. Report P&L to Rex.",
    "active",
    [
      { id: "n1", name: "Cron (5min)", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "Fetch Positions", type: "data", position: { x: 1, y: 0 }, config: { source: "kalshi_portfolio" } },
      { id: "n3", name: "Price Check", type: "action", position: { x: 2, y: 0 }, config: { api: "kalshi", realtime: true } },
      { id: "n4", name: "Stop-Loss Check", type: "logic", position: { x: 3, y: 0 }, config: { stopLossPct: 0.5, takeProfitPct: 0.3 } },
      { id: "n5", name: "Exit Trade", type: "action", position: { x: 4, y: 0 }, config: { orderType: "market", reason: "auto" } },
      { id: "n6", name: "P&L Report", type: "data", position: { x: 5, y: 0 }, config: { reportTo: "Rex", format: "json" } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
    ],
    "*/5 * * * *",
    new Date(Date.now() - 300000).toISOString(),
    new Date(Date.now() + 300000).toISOString()
  );
}

// ========================================
// REVENUE GENERATION MISSION WORKFLOWS
// ========================================
if (revenueMission) {
  console.log(`\nSeeding workflows for "${revenueMission.name}":`);

  // 1. Revenue Dashboard Aggregator
  seed(
    revenueMission.id,
    "Revenue Dashboard Aggregator",
    "Aggregate all revenue streams (trading P&L, affiliate, content). Calculate burn rate, runway, and performance vs targets.",
    "active",
    [
      { id: "n1", name: "Hourly Cron", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "Kalshi P&L", type: "data", position: { x: 1, y: 0 }, config: { source: "kalshi_api" } },
      { id: "n3", name: "Affiliate Revenue", type: "data", position: { x: 1, y: 1 }, config: { source: "amazon_associates" } },
      { id: "n4", name: "Content Revenue", type: "data", position: { x: 1, y: 2 }, config: { source: "substack_analytics" } },
      { id: "n5", name: "Aggregate & Calc", type: "action", position: { x: 2, y: 0 }, config: { metrics: ["total_revenue", "burn_rate", "runway_days", "pnl_vs_target"] } },
      { id: "n6", name: "Update Dashboard", type: "action", position: { x: 3, y: 0 }, config: { endpoint: "/api/dashboard/metrics" } },
      { id: "n7", name: "Alert if Behind", type: "logic", position: { x: 4, y: 0 }, config: { target: "positive_pnl_by_march22", alertChannel: "ceo" } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n1", to: "n3" },
      { from: "n1", to: "n4" },
      { from: "n2", to: "n5" },
      { from: "n3", to: "n5" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
    ],
    "0 * * * *",
    new Date(Date.now() - 3600000).toISOString(),
    new Date(Date.now() + 3600000).toISOString()
  );

  // 2. Amazon Affiliate Content Pipeline
  seed(
    revenueMission.id,
    "Amazon Affiliate Pipeline",
    "Generate SEO-optimized product reviews and comparison articles with affiliate links. Track clicks and conversions.",
    "active",
    [
      { id: "n1", name: "Daily (9am)", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "Product Research", type: "action", position: { x: 1, y: 0 }, config: { categories: ["AI tools", "dev tools", "productivity"], trending: true } },
      { id: "n3", name: "Write Review", type: "action", position: { x: 2, y: 0 }, config: { model: "claude-sonnet", style: "honest_review", wordCount: 2000 } },
      { id: "n4", name: "Insert Affiliate Links", type: "action", position: { x: 3, y: 0 }, config: { tag: "rutroh-20", program: "amazon_associates" } },
      { id: "n5", name: "SEO Optimize", type: "action", position: { x: 4, y: 0 }, config: { keywords: "auto", schema: "product_review" } },
      { id: "n6", name: "Publish & Share", type: "action", position: { x: 5, y: 0 }, config: { targets: ["blog", "reddit", "twitter"] } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
    ],
    "0 9 * * *",
    null,
    null
  );

  // 3. Cost Monitor
  seed(
    revenueMission.id,
    "Cost Monitor & Optimizer",
    "Track API costs (Claude, OpenAI, Gemini), infrastructure costs, and identify optimization opportunities. Rex owns this.",
    "active",
    [
      { id: "n1", name: "Every 6h", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "Fetch API Costs", type: "data", position: { x: 1, y: 0 }, config: { sources: ["anthropic", "openai", "google"] } },
      { id: "n3", name: "Infra Costs", type: "data", position: { x: 1, y: 1 }, config: { sources: ["docker", "servers", "domains"] } },
      { id: "n4", name: "Cost Analysis", type: "action", position: { x: 2, y: 0 }, config: { compare: "yesterday", detectSpikes: true } },
      { id: "n5", name: "Optimization Recs", type: "logic", position: { x: 3, y: 0 }, config: { rules: ["switch_to_cheaper_model", "batch_requests", "cache_results"] } },
      { id: "n6", name: "Report to Rex", type: "data", position: { x: 4, y: 0 }, config: { format: "cost_report", alertOnSpike: true } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n1", to: "n3" },
      { from: "n2", to: "n4" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
    ],
    "0 */6 * * *",
    new Date(Date.now() - 21600000).toISOString(),
    new Date(Date.now() + 21600000).toISOString()
  );
}

// ========================================
// INFRASTRUCTURE MISSION WORKFLOWS
// ========================================
if (infraMission) {
  console.log(`\nSeeding workflows for "${infraMission.name}":`);

  // 1. Agent Health Monitor  
  seed(
    infraMission.id,
    "Agent Health Monitor",
    "Check all agent status files, detect dead/stuck agents, auto-restart if possible, alert Rip if manual intervention needed.",
    "active",
    [
      { id: "n1", name: "Every 30min", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "Read Status Files", type: "data", position: { x: 1, y: 0 }, config: { path: "memory/status/*.json", maxAge: "1h" } },
      { id: "n3", name: "Heartbeat Check", type: "logic", position: { x: 2, y: 0 }, config: { maxSilence: "60min", checkFields: ["status", "updated_at"] } },
      { id: "n4", name: "Dead Agent Detection", type: "logic", position: { x: 3, y: 0 }, config: { rules: ["no_update_1h", "error_state", "progress_stuck"] } },
      { id: "n5", name: "Auto-Restart", type: "action", position: { x: 4, y: 0 }, config: { method: "openclaw_session_restart", maxRetries: 2 } },
      { id: "n6", name: "Alert Rip", type: "action", position: { x: 5, y: 0 }, config: { channel: "dashboard", severity: "high" } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
    ],
    "*/30 * * * *",
    new Date(Date.now() - 1800000).toISOString(),
    new Date(Date.now() + 1800000).toISOString()
  );

  // 2. Daily Briefing (KanikaBK 7am pattern)
  seed(
    infraMission.id,
    "Daily CEO Briefing",
    "KanikaBK-style 7am daily briefing. Collect all agent statuses, mission progress, P&L, blockers. Generate executive summary for CEO.",
    "active",
    [
      { id: "n1", name: "Daily 7am", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "Agent Statuses", type: "data", position: { x: 1, y: 0 }, config: { source: "memory/status/*.json" } },
      { id: "n3", name: "Mission Progress", type: "data", position: { x: 1, y: 1 }, config: { source: "MISSIONS.md" } },
      { id: "n4", name: "Revenue P&L", type: "data", position: { x: 1, y: 2 }, config: { source: "rex_report" } },
      { id: "n5", name: "Generate Briefing", type: "action", position: { x: 2, y: 0 }, config: { model: "claude-sonnet", format: "exec_summary", sections: ["highlights", "blockers", "financials", "next24h"] } },
      { id: "n6", name: "Send to CEO", type: "action", position: { x: 3, y: 0 }, config: { channels: ["dashboard", "email"], pinToTop: true } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n1", to: "n3" },
      { from: "n1", to: "n4" },
      { from: "n2", to: "n5" },
      { from: "n3", to: "n5" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
    ],
    "0 7 * * *",
    null,
    null
  );

  // 3. Knowledge Base Sync
  seed(
    infraMission.id,
    "Knowledge Base Sync",
    "KanikaBK-style knowledge base. Sync all ingested content (tweets, articles, research) into SQLite + vector embeddings for semantic search.",
    "active",
    [
      { id: "n1", name: "Hourly Cron", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "Collect New Items", type: "data", position: { x: 1, y: 0 }, config: { sources: ["tweet_queue", "article_queue", "research_queue"] } },
      { id: "n3", name: "Generate Embeddings", type: "action", position: { x: 2, y: 0 }, config: { model: "text-embedding-3-small", dimensions: 1536 } },
      { id: "n4", name: "Store in SQLite+Vec", type: "data", position: { x: 3, y: 0 }, config: { db: "knowledge_base.db", tables: ["documents", "embeddings"] } },
      { id: "n5", name: "Update Index", type: "action", position: { x: 4, y: 0 }, config: { index: "semantic_search", rebuild: false } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
    ],
    "0 * * * *",
    new Date(Date.now() - 3600000).toISOString(),
    new Date(Date.now() + 3600000).toISOString()
  );

  // 4. Exec Council Automation
  seed(
    infraMission.id,
    "Exec Council Trigger",
    "Auto-detect when Exec Council should convene: resource conflicts, >$50 actions, risk flags, priority changes. Spawn Rip/Rex/Red.",
    "active",
    [
      { id: "n1", name: "Event Listener", type: "trigger", position: { x: 0, y: 0 }, config: { events: ["cost_threshold", "risk_flag", "priority_change", "resource_conflict"] } },
      { id: "n2", name: "Evaluate Trigger", type: "logic", position: { x: 1, y: 0 }, config: { rules: ["cost>50", "red_flag", "multi_mission_resource"] } },
      { id: "n3", name: "Spawn Council", type: "action", position: { x: 2, y: 0 }, config: { agents: ["rip", "rex", "red"], format: "council_session" } },
      { id: "n4", name: "Collect Votes", type: "data", position: { x: 3, y: 0 }, config: { perspectives: ["operations", "revenue", "risk"] } },
      { id: "n5", name: "Rip Final Call", type: "logic", position: { x: 4, y: 0 }, config: { decisionMaker: "rip", logDecision: true } },
      { id: "n6", name: "Execute & Log", type: "action", position: { x: 5, y: 0 }, config: { createTasks: true, logTo: "decision_journal" } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
    ],
    null,
    null,
    null
  );

  // 5. Hourly Backup (KanikaBK pattern)
  seed(
    infraMission.id,
    "Hourly Backup",
    "KanikaBK pattern: Hourly backup of all critical data - DB, configs, agent memory, knowledge base.",
    "active",
    [
      { id: "n1", name: "Hourly Cron", type: "trigger", position: { x: 0, y: 0 } },
      { id: "n2", name: "Backup DB", type: "action", position: { x: 1, y: 0 }, config: { source: "mission-control.db", dest: "backups/" } },
      { id: "n3", name: "Backup Configs", type: "action", position: { x: 1, y: 1 }, config: { source: "~/.openclaw/", dest: "backups/config/" } },
      { id: "n4", name: "Backup Memory", type: "action", position: { x: 1, y: 2 }, config: { source: "memory/", dest: "backups/memory/" } },
      { id: "n5", name: "Verify Integrity", type: "logic", position: { x: 2, y: 0 }, config: { checks: ["file_size", "checksum", "readable"] } },
      { id: "n6", name: "Cleanup Old", type: "action", position: { x: 3, y: 0 }, config: { retention: "7d", maxBackups: 168 } },
    ],
    [
      { from: "n1", to: "n2" },
      { from: "n1", to: "n3" },
      { from: "n1", to: "n4" },
      { from: "n2", to: "n5" },
      { from: "n3", to: "n5" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
    ],
    "0 * * * *",
    new Date(Date.now() - 3600000).toISOString(),
    new Date(Date.now() + 3600000).toISOString()
  );
}

// Summary
const totalWorkflows = db.prepare("SELECT COUNT(*) as count FROM workflows").get();
console.log(`\n✅ Seeded ${totalWorkflows.count} workflows total.`);
console.log("Verify: sqlite3 data/mission-control.db \"SELECT mission_id, name, status FROM workflows;\"");

db.close();
