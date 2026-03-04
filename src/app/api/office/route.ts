import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const HOME = process.env.HOME || "/Users/rutroh";
const COMMS_PATH = path.join(HOME, "shared-context", "agent-comms.json");
const STATUS_DIR = path.join(HOME, "memory", "status");
const LEADERBOARD_PATH = path.join(HOME, "shared-context", "leaderboard.json");
const AGENT_REGISTRY_PATH = path.join(HOME, ".openclaw", "agent-registry.json");
const CRON_JOBS_PATH = path.join(HOME, ".openclaw", "cron", "jobs.json");
const OPENCLAW_CONFIG_PATH = path.join(HOME, ".openclaw", "openclaw.json");

function safeReadJSON(filePath: string, fallback: unknown = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function getAgentStatuses() {
  const statuses: Record<string, unknown> = {};
  try {
    const files = fs.readdirSync(STATUS_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const agentId = file.replace(".json", "");
      statuses[agentId] = safeReadJSON(path.join(STATUS_DIR, file));
    }
  } catch { /* no status dir yet */ }
  return statuses;
}

function getRecentComms(limit = 50) {
  const data = safeReadJSON(COMMS_PATH, { messages: [] });
  const messages = data.messages || [];
  return messages.slice(-limit);
}

function getLeaderboard() {
  return safeReadJSON(LEADERBOARD_PATH, { agents: {}, achievements: [] });
}

// Load agent capabilities, tools, limitations from agent-registry.json
function getAgentRegistry(): Record<string, {
  capabilities: string[];
  tools: string[];
  limitations: string[];
  reportsTo: string;
  manages: string[];
  collaboratesWith: string[];
  memberOf: string[];
  techStack?: Record<string, string[]>;
  riskParameters?: Record<string, number>;
  contentCalendar?: Record<string, string>;
  performanceScore: number;
  inputFormat: string;
  outputFormat: string;
}> {
  const registry: Record<string, ReturnType<typeof getAgentRegistry>[string]> = {};
  try {
    const data = safeReadJSON(AGENT_REGISTRY_PATH, { agents: [] }) as {
      agents: Array<{
        agent_id: string;
        capabilities?: string[];
        tools_available?: string[];
        limitations?: string[];
        reports_to?: string;
        manages?: string[];
        collaborates_with?: string[];
        member_of?: string[];
        tech_stack?: Record<string, string[]>;
        risk_parameters?: Record<string, number>;
        content_calendar?: Record<string, string>;
        performance_score?: number;
        input_format?: string;
        output_format?: string;
      }>;
    };
    for (const agent of (data.agents || [])) {
      registry[agent.agent_id] = {
        capabilities: agent.capabilities || [],
        tools: agent.tools_available || [],
        limitations: agent.limitations || [],
        reportsTo: agent.reports_to || "unknown",
        manages: agent.manages || [],
        collaboratesWith: agent.collaborates_with || [],
        memberOf: agent.member_of || [],
        techStack: agent.tech_stack,
        riskParameters: agent.risk_parameters,
        contentCalendar: agent.content_calendar,
        performanceScore: agent.performance_score || 0,
        inputFormat: agent.input_format || "",
        outputFormat: agent.output_format || "",
      };
    }
  } catch { /* no registry */ }
  return registry;
}

// Load cron jobs grouped by agent
function getCronJobsByAgent(): Record<string, Array<{
  name: string;
  enabled: boolean;
  schedule: string;
  lastStatus: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  consecutiveErrors: number;
  lastDurationMs: number;
  timeoutSeconds: number;
  message: string;
}>> {
  const byAgent: Record<string, ReturnType<typeof getCronJobsByAgent>[string]> = {};
  try {
    const data = safeReadJSON(CRON_JOBS_PATH, { jobs: [] }) as {
      jobs: Array<{
        agentId?: string;
        name?: string;
        enabled?: boolean;
        schedule?: { kind?: string; everyMs?: number; cron?: string };
        state?: {
          lastRunStatus?: string;
          lastRunAtMs?: number;
          nextRunAtMs?: number;
          consecutiveErrors?: number;
          lastDurationMs?: number;
        };
        payload?: { timeoutSeconds?: number; message?: string };
      }>;
    };
    for (const job of (data.jobs || [])) {
      const agentId = job.agentId;
      if (!agentId) continue;
      if (!byAgent[agentId]) byAgent[agentId] = [];

      const sch = job.schedule || {};
      let scheduleStr = "unknown";
      if (sch.kind === "every" && sch.everyMs) {
        const mins = Math.round(sch.everyMs / 60000);
        scheduleStr = mins >= 60 ? `Every ${(mins / 60).toFixed(1)}h` : `Every ${mins}m`;
      } else if (sch.cron) {
        scheduleStr = `Cron: ${sch.cron}`;
      }

      const st = job.state || {};
      byAgent[agentId].push({
        name: job.name || "unnamed",
        enabled: job.enabled !== false,
        schedule: scheduleStr,
        lastStatus: st.lastRunStatus || "unknown",
        lastRunAt: st.lastRunAtMs ? new Date(st.lastRunAtMs).toISOString() : null,
        nextRunAt: st.nextRunAtMs ? new Date(st.nextRunAtMs).toISOString() : null,
        consecutiveErrors: st.consecutiveErrors || 0,
        lastDurationMs: st.lastDurationMs || 0,
        timeoutSeconds: job.payload?.timeoutSeconds || 0,
        message: job.payload?.message || "",
      });
    }
  } catch { /* no cron */ }
  return byAgent;
}

// Get agent model config from openclaw.json
function getAgentModels(): Record<string, { model: string; fallbacks: string[] }> {
  const models: Record<string, { model: string; fallbacks: string[] }> = {};
  try {
    const data = safeReadJSON(OPENCLAW_CONFIG_PATH, {}) as {
      agents?: {
        defaults?: { model?: { primary?: string; fallbacks?: string[] } };
        list?: Array<{ id?: string; model?: { primary?: string; fallbacks?: string[] } }>;
      };
    };
    const agentsConfig = data.agents || {};
    const defaultModel = agentsConfig.defaults?.model?.primary || "unknown";
    const defaultFallbacks = agentsConfig.defaults?.model?.fallbacks || [];
    const agentList = agentsConfig.list || [];

    for (const agent of agentList) {
      if (agent.id) {
        models[agent.id] = {
          model: agent.model?.primary || defaultModel,
          fallbacks: agent.model?.fallbacks || defaultFallbacks,
        };
      }
    }
  } catch { /* no config */ }
  return models;
}

// Get agent-related files from their workspace
function getAgentFiles(agentId: string): string[] {
  const files: string[] = [];
  try {
    // Status files
    const statusFile = path.join(STATUS_DIR, `${agentId}.json`);
    if (fs.existsSync(statusFile)) files.push(`memory/status/${agentId}.json`);

    // Check for agent SOUL/AGENT.md
    const agentDir = path.join(HOME, ".openclaw", "agents", agentId);
    if (fs.existsSync(agentDir)) {
      const agentFiles = fs.readdirSync(agentDir);
      for (const f of agentFiles) {
        files.push(`.openclaw/agents/${agentId}/${f}`);
      }
    }

    // Check for agent-specific memory files
    const memDir = path.join(HOME, "memory");
    if (fs.existsSync(memDir)) {
      const memFiles = fs.readdirSync(memDir).filter(
        (f) => f.toLowerCase().includes(agentId) && !f.startsWith(".")
      );
      for (const f of memFiles) {
        files.push(`memory/${f}`);
      }
    }
  } catch { /* ignore */ }
  return files;
}

// GET /api/office - Returns everything the office view needs
export async function GET() {
  try {
    const statuses = getAgentStatuses();
    const comms = getRecentComms(100);
    const leaderboard = getLeaderboard();
    const registry = getAgentRegistry();
    const cronJobs = getCronJobsByAgent();
    const agentModels = getAgentModels();

    // Determine collaborations (agents messaging each other within last 5 min)
    const now = Date.now();
    const recentWindow = 5 * 60 * 1000;
    const collaborations: Array<{ agents: string[]; topic: string }> = [];
    const recentMessages = comms.filter(
      (m: { timestamp: string }) => now - new Date(m.timestamp).getTime() < recentWindow
    );

    // Find pairs of agents talking to each other
    const pairs = new Map<string, string>();
    for (const msg of recentMessages) {
      if (msg.to && msg.to !== "all" && msg.to !== "council" && msg.from !== "system") {
        const key = [msg.from, msg.to].sort().join("-");
        if (!pairs.has(key)) {
          pairs.set(key, msg.context || msg.message?.substring(0, 50) || "working together");
        }
      }
    }
    for (const [key, topic] of pairs) {
      collaborations.push({ agents: key.split("-"), topic });
    }

    // Build office state for each agent
    const agentIds = ["rip", "rex", "red", "rio", "ria", "rea", "reg", "rak", "worker", "riz", "rox"];
    const officeAgents = agentIds.map((id) => {
      const status = (statuses[id] as Record<string, unknown>) || {};
      const lb = leaderboard.agents?.[id] || {};
      const lastMsg = [...comms]
        .reverse()
        .find((m: { from: string }) => m.from === id);
      const reg = registry[id];
      const crons = cronJobs[id] || [];
      const model = agentModels[id];
      const files = getAgentFiles(id);
      
      // Determine visual state
      const updatedAt = status.updated_at ? new Date(status.updated_at as string).getTime() : 0;
      const minutesSinceUpdate = (now - updatedAt) / 60000;
      
      let visualState: string;
      if (minutesSinceUpdate > 60) {
        visualState = "sleeping"; // head on desk
      } else if (status.status === "working") {
        visualState = "working"; // typing animation
      } else if (status.status === "blocked" || status.status === "error") {
        visualState = "frustrated"; // red exclamation
      } else {
        visualState = "idle"; // sitting at desk
      }

      // Check if in collaboration
      const isCollaborating = collaborations.some((c) => c.agents.includes(id));
      if (isCollaborating) visualState = "collaborating";

      // Count active / errored cron jobs
      const activeCrons = crons.filter((c) => c.enabled).length;
      const erroredCrons = crons.filter((c) => c.enabled && c.consecutiveErrors > 0).length;

      return {
        id,
        name: lb.name || id,
        role: lb.role || (reg ? undefined : "Agent") || "Agent",
        emoji: lb.emoji || "🤖",
        color: lb.color || "#888",
        visualState,
        currentTask: status.current_task || null,
        progressPct: status.progress_pct || 0,
        lastMessage: lastMsg?.message || null,
        lastMessageTime: lastMsg?.timestamp || null,
        score: lb.total_score || 0,
        revenue: lb.revenue_generated || 0,
        streak: lb.streak || 0,
        rank: lb.rank || 99,
        title: lb.title || "Rookie",
        trashTalkStyle: lb.trash_talk_style || "",
        minutesSinceUpdate: Math.round(minutesSinceUpdate),
        // ===== ENRICHED DATA =====
        capabilities: reg?.capabilities || [],
        tools: reg?.tools || [],
        limitations: reg?.limitations || [],
        reportsTo: reg?.reportsTo || "unknown",
        manages: reg?.manages || [],
        collaboratesWith: reg?.collaboratesWith || [],
        memberOf: reg?.memberOf || [],
        performanceScore: reg?.performanceScore || 0,
        techStack: reg?.techStack || null,
        riskParameters: reg?.riskParameters || null,
        contentCalendar: reg?.contentCalendar || null,
        cronJobs: crons,
        activeCrons,
        erroredCrons,
        model: model?.model || "unknown",
        fallbackModels: model?.fallbacks || [],
        files,
        nextAction: (status.next_action as string) || null,
        error: (status.error as string) || null,
        completedThisSession: (status.completed_this_session as string[]) || [],
      };
    });

    // Sort leaderboard by score
    const leaderboardRanked = [...officeAgents].sort((a, b) => b.score - a.score);

    return NextResponse.json({
      agents: officeAgents,
      comms: comms.slice(-50), // last 50 messages for the chat feed
      leaderboard: leaderboardRanked,
      collaborations,
      achievements: leaderboard.achievements || [],
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load office state", details: String(error) },
      { status: 500 }
    );
  }
}
