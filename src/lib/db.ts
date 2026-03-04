import Database from "better-sqlite3";
import path from "path";

// Use globalThis to ensure a true singleton across Next.js module boundaries.
// Turbopack/webpack may re-instantiate module-level variables for different API routes.
const globalForDb = globalThis as typeof globalThis & {
  __missionControlDb?: Database.Database;
};

export function getDb(): Database.Database {
  if (globalForDb.__missionControlDb) return globalForDb.__missionControlDb;

  const dbPath = path.resolve(process.cwd(), "data", "mission-control.db");

  // Ensure data directory exists
  const fs = require("fs");
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initializeSchema(db);
  globalForDb.__missionControlDb = db;
  return db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'archived')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'inbox' CHECK(status IN ('inbox', 'assigned', 'in_progress', 'review', 'verification', 'blocked', 'failed', 'done')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      mission_id TEXT,
      assigned_agent_id TEXT,
      openclaw_session_key TEXT,
      sort_order INTEGER DEFAULT 0,
      evidence TEXT DEFAULT '[]',
      outcome_summary TEXT DEFAULT '',
      revenue_connection TEXT DEFAULT '',
      attempts TEXT DEFAULT '[]',
      escalation_history TEXT DEFAULT '[]',
      parent_task_id TEXT,
      subtasks TEXT DEFAULT '[]',
      estimated_cost TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      agent_id TEXT,
      author_type TEXT DEFAULT 'agent' CHECK(author_type IN ('agent', 'user', 'system')),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      agent_id TEXT,
      task_id TEXT,
      mission_id TEXT,
      message TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

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

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_mission ON tasks(mission_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent_id);
    CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(type);
    CREATE INDEX IF NOT EXISTS idx_workflows_mission ON workflows(mission_id);

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      author TEXT DEFAULT 'system',
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category);
    CREATE INDEX IF NOT EXISTS idx_kb_pinned ON knowledge_base(pinned);

    -- Finance: Expenses & Subscriptions
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK(category IN ('subscription', 'hardware', 'api_credits', 'hosting', 'other')),
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      recurring INTEGER DEFAULT 0,
      recurring_interval TEXT CHECK(recurring_interval IN ('monthly', 'yearly', NULL)),
      date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

    -- Finance: API Usage Snapshots
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

    CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON api_usage(provider);
    CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(snapshot_date);

    -- Finance: Revenue entries
    CREATE TABLE IF NOT EXISTS revenue (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_revenue_source ON revenue(source);
    CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue(date);

    -- Agent performance metrics
    CREATE TABLE IF NOT EXISTS agent_metrics (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      metric_date TEXT NOT NULL,
      tasks_completed INTEGER DEFAULT 0,
      tasks_failed INTEGER DEFAULT 0,
      tasks_escalated INTEGER DEFAULT 0,
      avg_completion_time_hours REAL DEFAULT 0,
      evidence_provided_rate REAL DEFAULT 0,
      accuracy_score REAL DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      revenue_attributed REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_metrics_date ON agent_metrics(metric_date);

    -- Post-mortems for failed tasks
    CREATE TABLE IF NOT EXISTS post_mortems (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      agent_id TEXT,
      failure_type TEXT NOT NULL CHECK(failure_type IN ('technical', 'capability_gap', 'bad_delegation', 'external_dependency', 'hallucination', 'confabulation', 'memory_loss', 'timeout', 'other')),
      root_cause TEXT NOT NULL,
      what_was_tried TEXT DEFAULT '[]',
      could_have_been_prevented INTEGER DEFAULT 0,
      prevention_measure TEXT DEFAULT '',
      implemented INTEGER DEFAULT 0,
      affects_other_agents INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_post_mortems_task ON post_mortems(task_id);
    CREATE INDEX IF NOT EXISTS idx_post_mortems_agent ON post_mortems(agent_id);
    CREATE INDEX IF NOT EXISTS idx_post_mortems_type ON post_mortems(failure_type);
  `);

  // --- Migrations for evidence tracking ---
  // Add evidence and outcome_summary columns if they don't exist
  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN evidence TEXT DEFAULT '[]'`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN outcome_summary TEXT DEFAULT ''`);
  } catch (e) {
    // Column already exists
  }

  // --- Migrations for governance v2 ---
  // New task columns for v2 task lifecycle
  const v2TaskColumns: [string, string][] = [
    ['revenue_connection', "TEXT DEFAULT ''"],
    ['attempts', "TEXT DEFAULT '[]'"],
    ['escalation_history', "TEXT DEFAULT '[]'"],
    ['parent_task_id', 'TEXT'],
    ['subtasks', "TEXT DEFAULT '[]'"],
    ['estimated_cost', "TEXT DEFAULT ''"],
  ];
  for (const [col, type] of v2TaskColumns) {
    try {
      db.exec(`ALTER TABLE tasks ADD COLUMN ${col} ${type}`);
    } catch (e) {
      // Column already exists
    }
  }

  // New post-mortem column for v2
  try {
    db.exec(`ALTER TABLE post_mortems ADD COLUMN affects_other_agents INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists
  }

  // Reviewer tracking for tasks in review status
  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN reviewer_id TEXT DEFAULT 'rut'`);
  } catch (e) {
    // Column already exists
  }
}

// --- Missions ---

export interface Mission {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function listMissions(): Mission[] {
  return getDb()
    .prepare("SELECT * FROM missions ORDER BY created_at DESC")
    .all() as Mission[];
}

export function getMission(id: string): Mission | undefined {
  return getDb().prepare("SELECT * FROM missions WHERE id = ?").get(id) as
    | Mission
    | undefined;
}

export function createMission(data: {
  id: string;
  name: string;
  description?: string;
}): Mission {
  getDb()
    .prepare(
      "INSERT INTO missions (id, name, description) VALUES (?, ?, ?)"
    )
    .run(data.id, data.name, data.description ?? "");
  return getMission(data.id)!;
}

export function updateMission(
  id: string,
  patch: Partial<{ name: string; description: string; status: string }>
): Mission | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.description !== undefined) {
    fields.push("description = ?");
    values.push(patch.description);
  }
  if (patch.status !== undefined) {
    fields.push("status = ?");
    values.push(patch.status);
  }

  if (fields.length === 0) return getMission(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  getDb()
    .prepare(`UPDATE missions SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
  return getMission(id);
}

export function deleteMission(id: string): void {
  getDb().prepare("DELETE FROM missions WHERE id = ?").run(id);
}

// --- Tasks ---

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  mission_id: string | null;
  assigned_agent_id: string | null;
  openclaw_session_key: string | null;
  sort_order: number;
  evidence: string; // JSON array of evidence items
  outcome_summary: string;
  revenue_connection: string;
  attempts: string; // JSON array of attempt records
  escalation_history: string; // JSON array of escalation records
  parent_task_id: string | null;
  subtasks: string; // JSON array of subtask ids
  estimated_cost: string;
  created_at: string;
  updated_at: string;
}

export function listTasks(filters?: {
  status?: string;
  mission_id?: string;
  assigned_agent_id?: string;
}): Task[] {
  let sql = "SELECT * FROM tasks WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.status) {
    sql += " AND status = ?";
    params.push(filters.status);
  }
  if (filters?.mission_id) {
    sql += " AND mission_id = ?";
    params.push(filters.mission_id);
  }
  if (filters?.assigned_agent_id) {
    sql += " AND assigned_agent_id = ?";
    params.push(filters.assigned_agent_id);
  }

  sql += " ORDER BY sort_order ASC, created_at DESC";
  return getDb().prepare(sql).all(...params) as Task[];
}

export function getTask(id: string): Task | undefined {
  return getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
    | Task
    | undefined;
}

export function createTask(data: {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  mission_id?: string;
  assigned_agent_id?: string;
}): Task {
  const maxOrder = getDb()
    .prepare(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM tasks WHERE status = ?"
    )
    .get(data.status ?? "inbox") as { next: number };

  getDb()
    .prepare(
      `INSERT INTO tasks (id, title, description, status, priority, mission_id, assigned_agent_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.id,
      data.title,
      data.description ?? "",
      data.status ?? "inbox",
      data.priority ?? "medium",
      data.mission_id ?? null,
      data.assigned_agent_id ?? null,
      maxOrder.next
    );
  return getTask(data.id)!;
}

export function updateTask(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    mission_id: string | null;
    assigned_agent_id: string | null;
    openclaw_session_key: string | null;
    sort_order: number;
    evidence: string;
    outcome_summary: string;
    revenue_connection: string;
    attempts: string;
    escalation_history: string;
    parent_task_id: string | null;
    subtasks: string;
    estimated_cost: string;
  }>
): Task | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getTask(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  getDb()
    .prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
  return getTask(id);
}

export function deleteTask(id: string): void {
  getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
}

// --- Comments ---

export interface TaskComment {
  id: string;
  task_id: string;
  agent_id: string | null;
  author_type: string;
  content: string;
  created_at: string;
}

export function listComments(taskId: string): TaskComment[] {
  return getDb()
    .prepare(
      "SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC"
    )
    .all(taskId) as TaskComment[];
}

export function addComment(data: {
  id: string;
  task_id: string;
  agent_id?: string;
  author_type?: string;
  content: string;
}): TaskComment {
  getDb()
    .prepare(
      `INSERT INTO task_comments (id, task_id, agent_id, author_type, content)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      data.id,
      data.task_id,
      data.agent_id ?? null,
      data.author_type ?? "agent",
      data.content
    );
  return getDb()
    .prepare("SELECT * FROM task_comments WHERE id = ?")
    .get(data.id) as TaskComment;
}

// --- Activity Log ---

export interface ActivityEntry {
  id: string;
  type: string;
  agent_id: string | null;
  task_id: string | null;
  mission_id: string | null;
  message: string;
  metadata: string;
  created_at: string;
}

export function logActivity(data: {
  id: string;
  type: string;
  agent_id?: string;
  task_id?: string;
  mission_id?: string;
  message: string;
  metadata?: Record<string, unknown>;
}): void {
  getDb()
    .prepare(
      `INSERT INTO activity_log (id, type, agent_id, task_id, mission_id, message, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.id,
      data.type,
      data.agent_id ?? null,
      data.task_id ?? null,
      data.mission_id ?? null,
      data.message,
      JSON.stringify(data.metadata ?? {})
    );
}

export function listActivity(opts?: {
  limit?: number;
  type?: string;
}): ActivityEntry[] {
  let sql = "SELECT * FROM activity_log WHERE 1=1";
  const params: unknown[] = [];

  if (opts?.type) {
    sql += " AND type = ?";
    params.push(opts.type);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(opts?.limit ?? 50);

  return getDb().prepare(sql).all(...params) as ActivityEntry[];
}

// --- Workflows ---

export interface WorkflowRecord {
  id: string;
  mission_id: string | null;
  name: string;
  description: string;
  status: string;
  nodes: string; // JSON stringified
  connections: string; // JSON stringified
  last_run: string | null;
  next_run: string | null;
  cron_expression: string | null;
  n8n_workflow_id: string | null;
  created_at: string;
  updated_at: string;
}

export function listWorkflows(missionId?: string): WorkflowRecord[] {
  if (missionId) {
    return getDb()
      .prepare("SELECT * FROM workflows WHERE mission_id = ? ORDER BY created_at ASC")
      .all(missionId) as WorkflowRecord[];
  }
  return getDb()
    .prepare("SELECT * FROM workflows ORDER BY created_at DESC")
    .all() as WorkflowRecord[];
}

export function getWorkflow(id: string): WorkflowRecord | undefined {
  return getDb().prepare("SELECT * FROM workflows WHERE id = ?").get(id) as
    | WorkflowRecord
    | undefined;
}

export function createWorkflow(data: {
  id: string;
  mission_id?: string;
  name: string;
  description?: string;
  status?: string;
  nodes?: unknown[];
  connections?: unknown[];
  last_run?: string;
  next_run?: string;
  cron_expression?: string;
  n8n_workflow_id?: string;
}): WorkflowRecord {
  getDb()
    .prepare(
      `INSERT INTO workflows (id, mission_id, name, description, status, nodes, connections, last_run, next_run, cron_expression, n8n_workflow_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.id,
      data.mission_id ?? null,
      data.name,
      data.description ?? "",
      data.status ?? "active",
      JSON.stringify(data.nodes ?? []),
      JSON.stringify(data.connections ?? []),
      data.last_run ?? null,
      data.next_run ?? null,
      data.cron_expression ?? null,
      data.n8n_workflow_id ?? null
    );
  return getWorkflow(data.id)!;
}

export function updateWorkflow(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    status: string;
    nodes: unknown[];
    connections: unknown[];
    last_run: string;
    next_run: string;
    cron_expression: string;
    n8n_workflow_id: string;
    mission_id: string | null;
  }>
): WorkflowRecord | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      if (key === "nodes" || key === "connections") {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
  }

  if (fields.length === 0) return getWorkflow(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  getDb()
    .prepare(`UPDATE workflows SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
  return getWorkflow(id);
}

export function deleteWorkflow(id: string): void {
  getDb().prepare("DELETE FROM workflows WHERE id = ?").run(id);
}

// --- Knowledge Base ---

export interface KBEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string; // JSON stringified
  author: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}

export function listKBEntries(category?: string): KBEntry[] {
  if (category) {
    return getDb()
      .prepare("SELECT * FROM knowledge_base WHERE category = ? ORDER BY pinned DESC, updated_at DESC")
      .all(category) as KBEntry[];
  }
  return getDb()
    .prepare("SELECT * FROM knowledge_base ORDER BY pinned DESC, updated_at DESC")
    .all() as KBEntry[];
}

export function getKBEntry(id: string): KBEntry | undefined {
  return getDb().prepare("SELECT * FROM knowledge_base WHERE id = ?").get(id) as
    | KBEntry
    | undefined;
}

export function createKBEntry(data: {
  id: string;
  title: string;
  category?: string;
  content: string;
  tags?: string[];
  author?: string;
  pinned?: boolean;
}): KBEntry {
  getDb()
    .prepare(
      `INSERT INTO knowledge_base (id, title, category, content, tags, author, pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.id,
      data.title,
      data.category ?? "general",
      data.content,
      JSON.stringify(data.tags ?? []),
      data.author ?? "system",
      data.pinned ? 1 : 0
    );
  return getKBEntry(data.id)!;
}

export function updateKBEntry(
  id: string,
  patch: Partial<{
    title: string;
    category: string;
    content: string;
    tags: string[];
    author: string;
    pinned: boolean;
  }>
): KBEntry | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      if (key === "tags") {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else if (key === "pinned") {
        fields.push(`${key} = ?`);
        values.push(value ? 1 : 0);
      } else {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
  }

  if (fields.length === 0) return getKBEntry(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  getDb()
    .prepare(`UPDATE knowledge_base SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
  return getKBEntry(id);
}

export function deleteKBEntry(id: string): void {
  getDb().prepare("DELETE FROM knowledge_base WHERE id = ?").run(id);
}

// --- Finance: Expenses ---

export interface Expense {
  id: string;
  category: string;
  name: string;
  amount: number;
  currency: string;
  recurring: number;
  recurring_interval: string | null;
  date: string;
  notes: string;
  created_at: string;
}

export function listExpenses(opts?: { category?: string; since?: string; until?: string }): Expense[] {
  let sql = "SELECT * FROM expenses WHERE 1=1";
  const params: unknown[] = [];
  if (opts?.category) { sql += " AND category = ?"; params.push(opts.category); }
  if (opts?.since) { sql += " AND date >= ?"; params.push(opts.since); }
  if (opts?.until) { sql += " AND date <= ?"; params.push(opts.until); }
  sql += " ORDER BY date DESC";
  return getDb().prepare(sql).all(...params) as Expense[];
}

export function createExpense(data: {
  id: string; category: string; name: string; amount: number;
  date: string; recurring?: boolean; recurring_interval?: string | null; notes?: string;
}): void {
  getDb().prepare(
    `INSERT OR IGNORE INTO expenses (id, category, name, amount, date, recurring, recurring_interval, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(data.id, data.category, data.name, data.amount, data.date, data.recurring ? 1 : 0, data.recurring_interval ?? null, data.notes ?? "");
}

// --- Finance: API Usage ---

export interface ApiUsage {
  id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  requests: number;
  cost_usd: number;
  rate_limit_remaining: string;
  snapshot_date: string;
  created_at: string;
}

export function listApiUsage(opts?: { provider?: string; since?: string }): ApiUsage[] {
  let sql = "SELECT * FROM api_usage WHERE 1=1";
  const params: unknown[] = [];
  if (opts?.provider) { sql += " AND provider = ?"; params.push(opts.provider); }
  if (opts?.since) { sql += " AND snapshot_date >= ?"; params.push(opts.since); }
  sql += " ORDER BY snapshot_date DESC";
  return getDb().prepare(sql).all(...params) as ApiUsage[];
}

export function createApiUsage(data: {
  id: string; provider: string; model?: string; input_tokens?: number; output_tokens?: number;
  requests?: number; cost_usd?: number; rate_limit_remaining?: Record<string, unknown>; snapshot_date: string;
}): void {
  getDb().prepare(
    `INSERT OR IGNORE INTO api_usage (id, provider, model, input_tokens, output_tokens, requests, cost_usd, rate_limit_remaining, snapshot_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(data.id, data.provider, data.model ?? "", data.input_tokens ?? 0, data.output_tokens ?? 0, data.requests ?? 0, data.cost_usd ?? 0, JSON.stringify(data.rate_limit_remaining ?? {}), data.snapshot_date);
}

// --- Finance: Revenue ---

export interface Revenue {
  id: string;
  source: string;
  amount: number;
  currency: string;
  date: string;
  notes: string;
  created_at: string;
}

export function listRevenue(opts?: { source?: string; since?: string }): Revenue[] {
  let sql = "SELECT * FROM revenue WHERE 1=1";
  const params: unknown[] = [];
  if (opts?.source) { sql += " AND source = ?"; params.push(opts.source); }
  if (opts?.since) { sql += " AND date >= ?"; params.push(opts.since); }
  sql += " ORDER BY date DESC";
  return getDb().prepare(sql).all(...params) as Revenue[];
}

export function createRevenue(data: {
  id: string; source: string; amount: number; date: string; notes?: string;
}): void {
  getDb().prepare(
    `INSERT OR IGNORE INTO revenue (id, source, amount, date, notes) VALUES (?, ?, ?, ?, ?)`
  ).run(data.id, data.source, data.amount, data.date, data.notes ?? "");
}

// --- Finance: P&L Summary ---

export function getPnLSummary(since?: string, until?: string): {
  totalRevenue: number; totalExpenses: number; netPnL: number;
  revenueBySource: Record<string, number>; expensesByCategory: Record<string, number>;
} {
  const db = getDb();
  let revSql = "SELECT source, SUM(amount) as total FROM revenue WHERE 1=1";
  let expSql = "SELECT category, SUM(amount) as total FROM expenses WHERE 1=1";
  const revParams: unknown[] = [];
  const expParams: unknown[] = [];

  if (since) {
    revSql += " AND date >= ?"; revParams.push(since);
    expSql += " AND date >= ?"; expParams.push(since);
  }
  if (until) {
    revSql += " AND date <= ?"; revParams.push(until);
    expSql += " AND date <= ?"; expParams.push(until);
  }

  revSql += " GROUP BY source";
  expSql += " GROUP BY category";

  const revRows = db.prepare(revSql).all(...revParams) as { source: string; total: number }[];
  const expRows = db.prepare(expSql).all(...expParams) as { category: string; total: number }[];

  const revenueBySource: Record<string, number> = {};
  let totalRevenue = 0;
  for (const r of revRows) { revenueBySource[r.source] = r.total; totalRevenue += r.total; }

  const expensesByCategory: Record<string, number> = {};
  let totalExpenses = 0;
  for (const e of expRows) { expensesByCategory[e.category] = Math.abs(e.total); totalExpenses += Math.abs(e.total); }

  return { totalRevenue, totalExpenses, netPnL: totalRevenue - totalExpenses, revenueBySource, expensesByCategory };
}

// --- Agent Metrics ---

export interface AgentMetric {
  id: string;
  agent_id: string;
  metric_date: string;
  tasks_completed: number;
  tasks_failed: number;
  tasks_escalated: number;
  avg_completion_time_hours: number;
  evidence_provided_rate: number;
  accuracy_score: number;
  cost_usd: number;
  revenue_attributed: number;
  notes: string;
  created_at: string;
}

export function listAgentMetrics(opts?: { 
  agent_id?: string; 
  since?: string; 
  until?: string;
}): AgentMetric[] {
  let sql = "SELECT * FROM agent_metrics WHERE 1=1";
  const params: unknown[] = [];
  if (opts?.agent_id) { sql += " AND agent_id = ?"; params.push(opts.agent_id); }
  if (opts?.since) { sql += " AND metric_date >= ?"; params.push(opts.since); }
  if (opts?.until) { sql += " AND metric_date <= ?"; params.push(opts.until); }
  sql += " ORDER BY metric_date DESC, agent_id ASC";
  return getDb().prepare(sql).all(...params) as AgentMetric[];
}

export function getAgentMetric(id: string): AgentMetric | undefined {
  return getDb().prepare("SELECT * FROM agent_metrics WHERE id = ?").get(id) as AgentMetric | undefined;
}

export function createAgentMetric(data: {
  id: string;
  agent_id: string;
  metric_date: string;
  tasks_completed?: number;
  tasks_failed?: number;
  tasks_escalated?: number;
  avg_completion_time_hours?: number;
  evidence_provided_rate?: number;
  accuracy_score?: number;
  cost_usd?: number;
  revenue_attributed?: number;
  notes?: string;
}): AgentMetric {
  getDb().prepare(`
    INSERT INTO agent_metrics (
      id, agent_id, metric_date, tasks_completed, tasks_failed, tasks_escalated,
      avg_completion_time_hours, evidence_provided_rate, accuracy_score,
      cost_usd, revenue_attributed, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.agent_id,
    data.metric_date,
    data.tasks_completed ?? 0,
    data.tasks_failed ?? 0,
    data.tasks_escalated ?? 0,
    data.avg_completion_time_hours ?? 0,
    data.evidence_provided_rate ?? 0,
    data.accuracy_score ?? 0,
    data.cost_usd ?? 0,
    data.revenue_attributed ?? 0,
    data.notes ?? ""
  );
  return getAgentMetric(data.id)!;
}

export function updateAgentMetric(
  id: string,
  patch: Partial<Omit<AgentMetric, "id" | "created_at">>
): AgentMetric | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getAgentMetric(id);

  values.push(id);
  getDb().prepare(`UPDATE agent_metrics SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getAgentMetric(id);
}

export function getAgentPerformanceSummary(agent_id: string, days: number = 30): {
  total_tasks_completed: number;
  total_tasks_failed: number;
  total_tasks_escalated: number;
  avg_evidence_rate: number;
  avg_accuracy: number;
  total_cost: number;
  total_revenue: number;
  net_value: number;
} {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const metrics = listAgentMetrics({ agent_id, since });
  
  if (metrics.length === 0) {
    return {
      total_tasks_completed: 0,
      total_tasks_failed: 0,
      total_tasks_escalated: 0,
      avg_evidence_rate: 0,
      avg_accuracy: 0,
      total_cost: 0,
      total_revenue: 0,
      net_value: 0
    };
  }

  const total_tasks_completed = metrics.reduce((sum, m) => sum + m.tasks_completed, 0);
  const total_tasks_failed = metrics.reduce((sum, m) => sum + m.tasks_failed, 0);
  const total_tasks_escalated = metrics.reduce((sum, m) => sum + m.tasks_escalated, 0);
  const avg_evidence_rate = metrics.reduce((sum, m) => sum + m.evidence_provided_rate, 0) / metrics.length;
  const avg_accuracy = metrics.reduce((sum, m) => sum + m.accuracy_score, 0) / metrics.length;
  const total_cost = metrics.reduce((sum, m) => sum + m.cost_usd, 0);
  const total_revenue = metrics.reduce((sum, m) => sum + m.revenue_attributed, 0);

  return {
    total_tasks_completed,
    total_tasks_failed,
    total_tasks_escalated,
    avg_evidence_rate,
    avg_accuracy,
    total_cost,
    total_revenue,
    net_value: total_revenue - total_cost
  };
}

// --- Post-Mortems ---

export type FailureType = 'technical' | 'capability_gap' | 'bad_delegation' | 'external_dependency' | 'hallucination' | 'confabulation' | 'memory_loss' | 'timeout' | 'other';

export interface PostMortem {
  id: string;
  task_id: string;
  agent_id: string | null;
  failure_type: FailureType;
  root_cause: string;
  what_was_tried: string;
  could_have_been_prevented: number;
  prevention_measure: string;
  implemented: number;
  affects_other_agents: number;
  created_at: string;
  reviewed_at: string | null;
}

export function listPostMortems(opts?: {
  task_id?: string;
  agent_id?: string;
  failure_type?: FailureType;
  implemented?: boolean;
  since?: string;
}): PostMortem[] {
  let sql = "SELECT * FROM post_mortems WHERE 1=1";
  const params: unknown[] = [];
  
  if (opts?.task_id) { sql += " AND task_id = ?"; params.push(opts.task_id); }
  if (opts?.agent_id) { sql += " AND agent_id = ?"; params.push(opts.agent_id); }
  if (opts?.failure_type) { sql += " AND failure_type = ?"; params.push(opts.failure_type); }
  if (opts?.implemented !== undefined) { 
    sql += " AND implemented = ?"; 
    params.push(opts.implemented ? 1 : 0); 
  }
  if (opts?.since) { sql += " AND created_at >= ?"; params.push(opts.since); }
  
  sql += " ORDER BY created_at DESC";
  return getDb().prepare(sql).all(...params) as PostMortem[];
}

export function getPostMortem(id: string): PostMortem | undefined {
  return getDb().prepare("SELECT * FROM post_mortems WHERE id = ?").get(id) as PostMortem | undefined;
}

export function createPostMortem(data: {
  id: string;
  task_id: string;
  agent_id?: string;
  failure_type: FailureType;
  root_cause: string;
  what_was_tried?: string[];
  could_have_been_prevented?: boolean;
  prevention_measure?: string;
  affects_other_agents?: boolean;
}): PostMortem {
  getDb().prepare(`
    INSERT INTO post_mortems (
      id, task_id, agent_id, failure_type, root_cause, what_was_tried,
      could_have_been_prevented, prevention_measure, affects_other_agents
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.task_id,
    data.agent_id ?? null,
    data.failure_type,
    data.root_cause,
    JSON.stringify(data.what_was_tried ?? []),
    data.could_have_been_prevented ? 1 : 0,
    data.prevention_measure ?? "",
    data.affects_other_agents ? 1 : 0
  );
  return getPostMortem(data.id)!;
}

export function updatePostMortem(
  id: string,
  patch: Partial<{
    prevention_measure: string;
    implemented: boolean;
    reviewed_at: string;
  }>
): PostMortem | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.prevention_measure !== undefined) {
    fields.push("prevention_measure = ?");
    values.push(patch.prevention_measure);
  }
  if (patch.implemented !== undefined) {
    fields.push("implemented = ?");
    values.push(patch.implemented ? 1 : 0);
  }
  if (patch.reviewed_at !== undefined) {
    fields.push("reviewed_at = ?");
    values.push(patch.reviewed_at);
  }

  if (fields.length === 0) return getPostMortem(id);

  values.push(id);
  getDb().prepare(`UPDATE post_mortems SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getPostMortem(id);
}

export function getPostMortemStats(days: number = 30): {
  total: number;
  by_type: Record<FailureType, number>;
  prevention_rate: number;
  implemented_rate: number;
} {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const all = listPostMortems({ since });
  
  const by_type: Record<FailureType, number> = {
    technical: 0,
    capability_gap: 0,
    bad_delegation: 0,
    external_dependency: 0,
    hallucination: 0,
    confabulation: 0,
    memory_loss: 0,
    timeout: 0,
    other: 0
  };
  
  let preventable = 0;
  let implemented = 0;
  
  for (const pm of all) {
    by_type[pm.failure_type]++;
    if (pm.could_have_been_prevented) preventable++;
    if (pm.implemented) implemented++;
  }
  
  return {
    total: all.length,
    by_type,
    prevention_rate: all.length > 0 ? preventable / all.length : 0,
    implemented_rate: all.length > 0 ? implemented / all.length : 0
  };
}
