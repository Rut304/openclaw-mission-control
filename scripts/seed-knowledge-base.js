const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('./data/mission-control.db');

// Ensure knowledge_base table exists
db.exec(`
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
`);

const entries = [
  {
    title: "Rip COO Handoff — System Rebuild Complete",
    category: "handoff",
    pinned: true,
    author: "ceo-session",
    tags: ["rip", "handoff", "critical", "system-rebuild"],
    content: `# Rip COO Handoff — Full System Rebuild Complete
## Date: February 27, 2026

Rip, this is your comprehensive handoff. The CEO spent a full session rebuilding the agent system, N8N workflows, Mission Control, and your AGENT.md from scratch. Read this completely before taking any action.

---

## 1. What Changed — Executive Summary

**Everything was rebuilt.** The previous system had zombie processes, broken env files, duplicate missions, and workflows that were blueprints only. Here's what's now in place:

### Agents Rebuilt (5 new agents created/rewritten)
- **Rio** (Chief of Staff) — CEO message processing, mission creation, council coordination
- **Red** (Risk & Compliance) — Reviews risky actions, validates before execution
- **Rex** (CFO/Revenue) — Owns ALL revenue AND expenses. P&L positive by March 22.
- **Rak** (Kalshi Trader) — Dedicated trading agent for Kalshi prediction markets
- **Your AGENT.md** was completely rewritten (~362 lines) from 10 research documents

### N8N Workflows (14 real workflows, running locally)
All workflows moved from N8N Cloud (paid) to **local N8N Docker** (free, unlimited).

### Mission Control Enhancements
- Workflow visualization per mission (KanikaBK-style)
- Knowledge Base (this document lives here)
- "Open in N8N" buttons link directly to local N8N editor
- All 14 workflows wired to missions via \`n8n_workflow_id\` column

### Infrastructure Fixes
- \`.zshrc\` fixed (was loading from deleted \`/tmp/rutroh_master.env\`)
- Zombie \`arbitrage_bot.py\` killed (was running from trashed directory)
- Duplicate missions deleted (4 clean missions remain)
- Session persistence fixed in Mission Control (localStorage)

---

## 2. Your New Powers — What You Can Do Now

### N8N Workflow Management
You have a wrapper script that controls all workflows:

\`\`\`bash
# List all 14 workflows and their status
python3 ~/scripts/n8n-mcp.py list

# Activate a workflow
python3 ~/scripts/n8n-mcp.py activate <workflow-id>

# Deactivate a workflow
python3 ~/scripts/n8n-mcp.py deactivate <workflow-id>

# Execute a workflow manually
python3 ~/scripts/n8n-mcp.py execute <workflow-id>

# Get workflow details
python3 ~/scripts/n8n-mcp.py details <workflow-id>

# Create new workflow from JSON
python3 ~/scripts/n8n-mcp.py create ~/n8n-workflows/new-workflow.json

# Access cloud backup (if needed)
python3 ~/scripts/n8n-mcp.py --cloud list
\`\`\`

### N8N API Direct Access
\`\`\`bash
N8N_KEY="n8n_api_cd810618cc2d0a1777e3fec5762a44adc134703952b682e0"
curl -H "X-N8N-API-KEY: $N8N_KEY" http://localhost:5678/api/v1/workflows
\`\`\`

### Docker Container Management
\`\`\`bash
docker start n8n    # Start N8N
docker stop n8n     # Stop N8N  
docker logs n8n     # View logs
docker restart n8n  # Restart
\`\`\`

### Your Sub-Agents
You can delegate to: **worker, ria, rea, rex, reg, rio, red**
- Rex: Revenue, trading, financial research
- Ria: Content, social media, blog
- Rea: Data analysis, reporting
- Reg: Code generation, technical work
- Rio: Mission creation, CEO comms
- Red: Risk review before risky actions
- Worker: Generic tasks, file ops

### Mission Control API
\`\`\`bash
# Tasks
curl http://localhost:3001/api/tasks
curl -X POST http://localhost:3001/api/tasks -H "Content-Type: application/json" -d '{"title":"...", "status":"inbox"}'

# Missions  
curl http://localhost:3001/api/missions

# Workflows
curl http://localhost:3001/api/workflows
curl http://localhost:3001/api/workflows?missionId=<id>

# Knowledge Base
curl http://localhost:3001/api/knowledge
curl -X POST http://localhost:3001/api/knowledge -H "Content-Type: application/json" -d '{"title":"...", "category":"...", "content":"..."}'
\`\`\`

---

## 3. Current Workflow Status — What's Running vs Off

### ACTIVE (5 workflows — safe monitoring, no external writes)
| N8N ID | Name | Schedule | What It Does |
|---|---|---|---|
| 01-agent-health-monitor | Agent Health Monitor | Every 5 min | Checks agent APIs, alerts on failures |
| 02-daily-ceo-briefing | Daily CEO Briefing | 9AM EST daily | Sends task/agent summary to Telegram |
| 03-cost-monitor | Cost Monitor & Optimizer | Every 6h | Checks Anthropic costs, alerts if over budget |
| 11-kb-sync | Knowledge Base Sync | Every 2h | Audits KB health, creates maintenance tasks |
| 13-hourly-backup | Hourly Backup | Every 1h | Exports all N8N workflows, keeps last 24 |

### INACTIVE (9 workflows — need CEO review or your judgment)
| N8N ID | Name | Schedule | Why Off |
|---|---|---|---|
| 04-content-discovery | Content Discovery | Every 4h | Scrapes GitHub trending + FxTwitter |
| 05-twitter-ingestion | Twitter Ingestion | Every 6h | Fetches RutRoh tweets + AI tweets |
| 06-blog-content | Blog Content Pipeline | Mon/Wed/Fri 10AM | Generates blog topic queue |
| 07-kalshi-scanner | Kalshi Market Scanner | Every 15 min | Scans open markets for opportunities |
| 08-position-monitor | Position Monitor & Exit | Every 5 min | Monitors positions, sends exit signals |
| 09-revenue-aggregator | Revenue Dashboard | Hourly | Aggregates Kalshi + Amazon revenue |
| 10-amazon-affiliate | Amazon Affiliate | Daily 8AM | Generates affiliate content ideas |
| 12-exec-council | Exec Council Trigger | Webhook | Triggered by agents for strategic decisions |
| 14-video-ideas | Video Idea Pipeline | Tue/Thu 11AM | Finds trending repos for video content |

**Your call**: Activate any you think are ready. Use \`python3 ~/scripts/n8n-mcp.py activate <id>\`

---

## 4. Current Missions & Tasks

### 4 Active Missions
| Mission | Workflows | Status |
|---|---|---|
| Infrastructure | 5 (Health, Briefing, KB Sync, Exec Council, Backup) | Active |
| Content & Social | 4 (Twitter, Discovery, Blog, Video) | Active |
| Revenue Generation | 3 (Revenue Aggregator, Amazon, Cost Monitor) | Active |
| Trading Bots | 2 (Kalshi Scanner, Position Monitor) | Active |

### Pending Tasks (in Mission Control)
| Task | Status | Assigned |
|---|---|---|
| Fix Kalshi WebSocket Connection | in_progress | rip |
| Create TikTok content video | inbox | unassigned |
| Research Kalshi markets | inbox | unassigned |
| Write viral tweet thread | inbox | unassigned |
| Write Amazon affiliate blog post | inbox | unassigned |

---

## 5. Follow-Up Items — What Needs Your Attention

### CRITICAL (Do Today)
1. **Review & activate workflows** — The 9 inactive workflows above are ready but need your judgment on which to turn on. Start with \`04-content-discovery\` and \`09-revenue-aggregator\` (low risk).
2. **Kalshi WebSocket task** — This is in_progress and assigned to you. Check if it's stale.
3. **Assign inbox tasks** — 4 tasks sitting unassigned. Delegate to appropriate agents.

### HIGH PRIORITY (This Week)
4. **YouTube channel integration in N8N** — CEO asked about posting to specific YouTube channels. N8N has a YouTube node (\`n8n-nodes-base.youTube\`) that supports OAuth2 per channel. Each channel needs its own Google OAuth credential. Build a workflow that maps content type → channel.
5. **Test Telegram alerts** — The monitoring workflows send alerts via Telegram. Verify \`TELEGRAM_BOT_TOKEN\` and \`TELEGRAM_CHAT_ID\` env vars are set in N8N environment variables (currently only in \`~/.env\`, need to add to Docker container).
6. **N8N environment variables** — The workflow JSONs reference \`{{ $env.KALSHI_API_KEY }}\`, \`{{ $env.TELEGRAM_BOT_TOKEN }}\`, etc. These need to be added to the N8N Docker container. Currently the container only has: N8N_API_KEY, N8N_SECURE_COOKIE, GENERIC_TIMEZONE, TZ.

### MEDIUM PRIORITY
7. **Content pipeline end-to-end test** — Activate blog content workflow, verify it creates actionable queue items in Mission Control.
8. **Revenue tracking** — Rex needs the revenue aggregator running to do his job. Activate it after verifying Kalshi API key works.
9. **Cost monitoring** — The cost monitor is active but needs the Anthropic API headers configured in N8N env vars.

---

## 6. Architecture Reference

### File Locations
| What | Where |
|---|---|
| N8N workflow JSONs | \`~/n8n-workflows/*.json\` |
| N8N data (SQLite, encryption key) | \`~/.n8n/\` |
| N8N wrapper script | \`~/scripts/n8n-mcp.py\` |
| Mission Control app | \`~/openclaw-mission-control/\` |
| Mission Control DB | \`~/openclaw-mission-control/data/mission-control.db\` |
| Agent configs | \`~/.openclaw/agents/*/agent/AGENT.md\` |
| Master env file | \`~/.env\` (loaded by .zshrc) |
| OpenClaw config | \`~/.openclaw/openclaw.json\` |
| Memory logs | \`~/memory/\` |
| Your AGENT.md | \`~/.openclaw/agents/rip/agent/AGENT.md\` (362 lines) |

### Running Services
| Service | Port | How to Start |
|---|---|---|
| N8N Docker | 5678 | \`docker start n8n\` (auto-restarts) |
| Mission Control | 3001 | \`cd ~/openclaw-mission-control && npm run dev -- -p 3001\` |
| OpenClaw Gateway | 18789 | \`openclaw server start\` |

### Environment Variables (Key Ones)
| Var | Location | Purpose |
|---|---|---|
| N8N_LOCAL_API_KEY | ~/.env | Local N8N REST API auth |
| N8N_CLOUD_API_KEY | ~/.env | Cloud N8N backup (don't need normally) |
| KALSHI_API_KEY | ~/.env | Kalshi trading API |
| TELEGRAM_BOT_TOKEN | ~/.env | Alert notifications |
| TELEGRAM_CHAT_ID | ~/.env | Alert chat target |
| ANTHROPIC_API_KEY | ~/.env | Claude API usage tracking |

### Docker Run Command (if N8N needs recreation)
\`\`\`bash
docker run -d --name n8n --restart unless-stopped \\
  -p 5678:5678 \\
  -v /Users/rutroh/.n8n:/home/node/.n8n \\
  -e N8N_API_KEY=n8n_api_cd810618cc2d0a1777e3fec5762a44adc134703952b682e0 \\
  -e N8N_PUBLIC_API_ENABLED=true \\
  -e GENERIC_TIMEZONE=America/New_York \\
  -e TZ=America/New_York \\
  -e N8N_SECURE_COOKIE=false \\
  n8nio/n8n:latest
\`\`\`

**IMPORTANT**: Workflows calling Mission Control API from inside Docker must use \`host.docker.internal:3001\` (not \`localhost:3001\`).

---

## 7. Exec Council Protocol

For strategic decisions (priority conflicts, >$50 impact, risk concerns):
1. You convene: Rip + Rex + Red
2. Rex gives financial perspective
3. Red flags risks
4. **You (Rip) make the final call**
5. Rio documents the decision

Trigger via webhook: \`python3 ~/scripts/n8n-mcp.py activate 12-exec-council\` then POST to \`http://localhost:5678/webhook/exec-council\`

---

## 8. Red Lines (Never Cross)
1. NEVER make external purchases without CEO approval
2. NEVER commit credentials to git or logs
3. NEVER delete production data without explicit confirmation
4. NEVER bypass exec-approvals.json for restricted commands
5. Cost threshold: Stop and ask if action exceeds $5
6. Security: Never expose API keys, passwords, or tokens

---

**End of Handoff. You are now fully briefed. Execute.**`
  },
  {
    title: "N8N Workflow Reference",
    category: "system",
    pinned: false,
    author: "ceo-session",
    tags: ["n8n", "workflows", "reference"],
    content: `# N8N Workflow Quick Reference

## Local N8N Docker
- **URL**: http://localhost:5678
- **API Key env**: \`N8N_LOCAL_API_KEY\`
- **Container**: \`n8n\` (restart: unless-stopped)
- **Data mount**: \`/Users/rutroh/.n8n:/home/node/.n8n\`

## Wrapper Script
\`\`\`bash
python3 ~/scripts/n8n-mcp.py <command>
\`\`\`

Commands: \`list\`, \`details <id>\`, \`execute <id>\`, \`create <file>\`, \`activate <id>\`, \`deactivate <id>\`

Add \`--cloud\` flag to target N8N Cloud backup instead of local.

## Workflow IDs
| ID | Name | Mission |
|---|---|---|
| 01-agent-health-monitor | Agent Health Monitor | Infrastructure |
| 02-daily-ceo-briefing | Daily CEO Briefing | Infrastructure |
| 03-cost-monitor | Cost Monitor & Optimizer | Revenue |
| 04-content-discovery | Content Discovery Pipeline | Content |
| 05-twitter-ingestion | X/Twitter Ingestion | Content |
| 06-blog-content | Blog Content Pipeline | Content |
| 07-kalshi-scanner | Kalshi Market Scanner | Trading |
| 08-position-monitor | Position Monitor & Exit | Trading |
| 09-revenue-aggregator | Revenue Dashboard | Revenue |
| 10-amazon-affiliate | Amazon Affiliate Pipeline | Revenue |
| 11-kb-sync | Knowledge Base Sync | Infrastructure |
| 12-exec-council | Exec Council Trigger | Infrastructure |
| 13-hourly-backup | Hourly Backup | Infrastructure |
| 14-video-ideas | Video Idea Pipeline | Content |

## JSON Source Files
All at \`~/n8n-workflows/*.json\` — edit, then re-import:
\`\`\`bash
docker cp ~/n8n-workflows/XX-name.json n8n:/tmp/wf.json
docker exec n8n n8n import:workflow --input=/tmp/wf.json
\`\`\`

## N8N Cloud Backup (4 workflows parked, all OFF)
- URL: https://rutrohd.app.n8n.cloud
- Free tier: 5 slots, 2,500 exec/month
- Only use if local Docker is down`
  },
  {
    title: "Agent Roster & Capabilities",
    category: "agent",
    pinned: false,
    author: "ceo-session",
    tags: ["agents", "roster", "capabilities"],
    content: `# Agent Roster — February 2026

## Organization
\`\`\`
CEO (Jeff) → Rio (Chief of Staff) → Exec Council (Rip, Rex, Red)
                                     ↓
                               Workers: Ria, Rea, Reg, Worker
                               Specialist: Rak (Kalshi)
\`\`\`

## Agent Details

### Rip — COO (Primary Operator)
- **AGENT.md**: ~/.openclaw/agents/rip/agent/AGENT.md (362 lines)
- **Model**: openrouter/deepseek/deepseek-chat (fallback: claude-opus-4-0, gemini-2.5-pro)
- **Sub-agents**: worker, ria, rea, rex, reg, rio, red
- **Crons**: 12 active (delegation-check, system-monitor, agent-status, etc.)
- **Authority**: Final decision maker on operations. Can activate/deactivate workflows. Spawns workers.

### Rex — CFO/Revenue
- **AGENT.md**: ~/.openclaw/agents/rex/agent/AGENT.md (137 lines)
- **Owns**: ALL revenue AND expenses. P&L positive target: March 22.
- **Focus**: Trading strategy, prediction markets, cost optimization

### Red — Risk & Compliance
- **AGENT.md**: ~/.openclaw/agents/red/agent/AGENT.md (111 lines)
- **Role**: Review risky actions before execution
- **Triggers**: >$50 cost, external purchases, data deletion, credential handling

### Rio — Chief of Staff
- **AGENT.md**: ~/.openclaw/agents/rio/agent/AGENT.md (107 lines)
- **Role**: CEO message processing, mission creation, council coordination

### Rak — Kalshi Trader
- **AGENT.md**: ~/.openclaw/agents/rak/agent/AGENT.md (143 lines)
- **Role**: Dedicated Kalshi prediction market trading
- **Workspace**: ~/kalshi-bot/

### Ria — Content Lead
- **Role**: Social media, blog, X/Twitter, marketing

### Rea — Data Analyst
- **Role**: Research summaries, data analysis, reporting

### Reg — Lead Engineer
- **Role**: Code generation, technical implementation

### Worker — General
- **Role**: File ops, research, any delegated task`
  },
  {
    title: "YouTube Multi-Channel N8N Integration Notes",
    category: "research",
    pinned: false,
    author: "ceo-session",
    tags: ["youtube", "n8n", "channels", "todo"],
    content: `# YouTube Multi-Channel Integration via N8N

## How N8N Handles YouTube Channels

N8N has a built-in YouTube node (\`n8n-nodes-base.youTube\`) that uses **Google OAuth2** credentials.

### Key Points:
- **Each YouTube channel requires its own OAuth2 credential** in N8N
- You create a Google OAuth2 credential per channel, authorizing the specific Google account that owns that channel
- In workflow nodes, you select which credential (channel) to use via a dropdown
- You can have multiple YouTube nodes in one workflow, each targeting a different channel

### Setup Steps (for each channel):
1. Go to N8N credentials (http://localhost:5678/credentials)
2. Add new "Google OAuth2 API" credential
3. Name it clearly: "YouTube - [ChannelName]"
4. Set OAuth scopes to include: \`https://www.googleapis.com/auth/youtube.upload\`
5. Authorize with the Google account that owns that channel
6. Use this credential in YouTube upload nodes

### Workflow Design Pattern:
\`\`\`
Content Queue → Route by Type → YouTube Upload (Channel A credential)
                              → YouTube Upload (Channel B credential)
                              → YouTube Upload (Channel C credential)
\`\`\`

### YouTube Node Capabilities:
- **Upload**: Upload video files with title, description, tags, category, privacy
- **Update**: Change video metadata after upload
- **Delete**: Remove videos
- **Get**: Fetch video details
- **Get All**: List channel videos
- **Playlist**: Add/remove from playlists

### N8N YouTube Node Limitations:
- Cannot create YouTube Shorts metadata directly (use description hack with #Shorts)
- Thumbnail upload requires separate API call
- Rate limits: ~6 uploads per day per channel (YouTube quota)

## TODO for Rip:
1. Identify which YouTube channels need connection
2. Get Google OAuth credentials for each
3. Create channel mapping in N8N credentials
4. Build content-to-channel routing workflow
5. Test with a single upload before automating`
  }
];

const stmt = db.prepare(`
  INSERT OR REPLACE INTO knowledge_base (id, title, category, content, tags, author, pinned)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const entry of entries) {
  const id = crypto.randomUUID();
  stmt.run(
    id,
    entry.title,
    entry.category,
    entry.content,
    JSON.stringify(entry.tags),
    entry.author,
    entry.pinned ? 1 : 0
  );
  console.log(`✅ ${entry.category}: ${entry.title}`);
}

console.log(`\nSeeded ${entries.length} knowledge base entries.`);
db.close();
