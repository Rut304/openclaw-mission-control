import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getDb } from "@/lib/db";

interface AgentFileInfo {
  name: string;
  size: number;
  updatedAt: string;
  content?: string;
}

interface AgentConfig {
  id: string;
  name: string;
  workspace?: string;
  agentDir?: string;
  model?: string | { primary: string; fallbacks?: string[] };
  identity?: { name: string; emoji: string };
  subagents?: { allowAgents?: string[] };
}

function readOpenClawConfig(): { agents: AgentConfig[] } {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  return {
    agents: (raw.agents?.list ?? []).map((a: Record<string, unknown>) => ({
      id: a.id,
      name: a.name,
      workspace: a.workspace,
      agentDir: a.agentDir,
      model: a.model,
      identity: a.identity,
      subagents: a.subagents,
    })),
  };
}

function getAgentFiles(dirPath: string): AgentFileInfo[] {
  if (!existsSync(dirPath)) return [];
  const files: AgentFileInfo[] = [];
  try {
    for (const entry of readdirSync(dirPath)) {
      const fullPath = join(dirPath, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isFile()) {
          const content =
            entry.endsWith(".md") || entry.endsWith(".json")
              ? readFileSync(fullPath, "utf-8")
              : undefined;
          files.push({
            name: entry,
            size: stat.size,
            updatedAt: stat.mtime.toISOString(),
            content,
          });
        }
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // dir not readable
  }
  return files;
}

// GET /api/agents/[id] — full detail for one agent
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const { agents } = readOpenClawConfig();
    const agentConfig = agents.find((a) => a.id === agentId);

    if (!agentConfig) {
      return NextResponse.json(
        { error: `Agent '${agentId}' not found in config` },
        { status: 404 }
      );
    }

    // Resolve directories
    const defaultAgentDir = join(
      homedir(),
      ".openclaw",
      "agents",
      agentId,
      "agent"
    );
    const agentDir = agentConfig.agentDir || defaultAgentDir;
    const workspace = agentConfig.workspace || homedir();

    // Read agent directory files (AGENT.md, IDENTITY.md, auth.json, models.json)
    const agentFiles = getAgentFiles(agentDir);

    // Read key workspace files
    const workspaceFileNames = [
      "SOUL.md",
      "IDENTITY.md",
      "AGENTS.md",
      "BOOTSTRAP.md",
      "HEARTBEAT.md",
      "TOOLS.md",
      "USER.md",
      "MISSIONS.md",
    ];
    const workspaceFiles: AgentFileInfo[] = [];
    for (const name of workspaceFileNames) {
      const fullPath = join(workspace, name);
      if (existsSync(fullPath)) {
        try {
          const stat = statSync(fullPath);
          workspaceFiles.push({
            name,
            size: stat.size,
            updatedAt: stat.mtime.toISOString(),
            // Only include content for smaller files; AGENT.md is already in agentFiles
            content: stat.size < 50000 ? readFileSync(fullPath, "utf-8") : undefined,
          });
        } catch {
          // skip
        }
      }
    }

    // Read status file
    let status: Record<string, unknown> | null = null;
    const statusPath = join(workspace, "memory", "status", `${agentId}.json`);
    if (existsSync(statusPath)) {
      try {
        status = JSON.parse(readFileSync(statusPath, "utf-8"));
      } catch {
        // invalid JSON
      }
    }

    // Read sessions
    let sessions: unknown[] = [];
    const sessionsPath = join(
      homedir(),
      ".openclaw",
      "agents",
      agentId,
      "sessions",
      "sessions.json"
    );
    if (existsSync(sessionsPath)) {
      try {
        const raw = JSON.parse(readFileSync(sessionsPath, "utf-8"));
        sessions = Array.isArray(raw) ? raw : [];
      } catch {
        // invalid
      }
    }

    // Get tasks from DB
    const db = getDb();
    const tasks = db
      .prepare(
        "SELECT id, title, status, priority, mission_id, created_at, updated_at FROM tasks WHERE assigned_agent_id = ? ORDER BY updated_at DESC"
      )
      .all(agentId);

    // Get missions this agent is involved in (via tasks)
    const missions = db
      .prepare(
        `SELECT DISTINCT m.id, m.name, m.status, m.created_at, m.updated_at
         FROM missions m
         JOIN tasks t ON t.mission_id = m.id
         WHERE t.assigned_agent_id = ?
         ORDER BY m.updated_at DESC`
      )
      .all(agentId);

    // Get recent activity
    const activity = db
      .prepare(
        "SELECT id, type, message, created_at FROM activity_log WHERE agent_id = ? ORDER BY created_at DESC LIMIT 20"
      )
      .all(agentId);

    // Model info
    const model =
      typeof agentConfig.model === "string"
        ? { primary: agentConfig.model, fallbacks: [] }
        : agentConfig.model ?? { primary: "unknown", fallbacks: [] };

    return NextResponse.json({
      agent: {
        id: agentConfig.id,
        name: agentConfig.name,
        identity: agentConfig.identity,
        model,
        workspace,
        agentDir,
        subagents: agentConfig.subagents?.allowAgents ?? [],
      },
      files: {
        agent: agentFiles,
        workspace: workspaceFiles,
      },
      status,
      sessions,
      tasks,
      missions,
      activity,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load agent detail", details: String(error) },
      { status: 500 }
    );
  }
}
