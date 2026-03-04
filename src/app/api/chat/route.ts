import { NextRequest, NextResponse } from "next/server";
import { getOpenClawClient } from "@/lib/openclaw-client";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DEFAULT_SESSION_KEY = "mission-control:general-chat";

/** Detect gateway placeholders that are NOT real agent responses */
function isNonResponse(content: unknown): boolean {
  if (!content) return true;
  // Skip tool-only messages (agent is still working, not a final response)
  if (Array.isArray(content)) {
    const hasText = content.some(
      (block: { type?: string; text?: string }) =>
        typeof block === 'string' ||
        (block && block.type === 'text' && block.text?.trim())
    );
    if (!hasText) return true;
  }
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((c: { text?: string }) => c.text || '').join('')
      : JSON.stringify(content);
  const trimmed = text.trim();
  if (!trimmed) return true;
  const NON_RESPONSES = ['HEARTBEAT_OK', 'NO_REPLY', '(no output)', '(empty response)'];
  if (NON_RESPONSES.includes(trimmed)) return true;
  // Detect agent status JSON dumps (e.g. {"agent": "rip", "status": "working"...})
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === 'object' && (obj.agent || obj.status || obj.current_task || obj.progress_pct !== undefined)) {
        return true;
      }
    } catch { /* not JSON */ }
  }
  return false;
}

// Paths for persistent state
const STATUS_DIR = join(homedir(), "memory", "status");
// RIP_STATUS kept for backward compat — new code uses readAgentStatus(agentId)
const RIP_STATUS = join(STATUS_DIR, "rip.json");
const MEMORY_DIR = join(homedir(), "memory");

/** Determine which agent we're chatting with (default: rip) */
function getAgentId(sessionKey: string): string {
  // Session keys may encode agent: "agent:rip:...", "mission-control:rip-chat-..."
  const agentMatch = sessionKey.match(/^agent:(\w+):/);
  if (agentMatch) return agentMatch[1];
  // Default to rip for mission-control sessions
  return "rip";
}

/** Read an agent's current status from disk (if valid JSON) */
function readAgentStatus(agentId: string): Record<string, unknown> | null {
  try {
    const statusFile = join(STATUS_DIR, `${agentId}.json`);
    if (!existsSync(statusFile)) return null;
    const raw = readFileSync(statusFile, "utf-8").trim();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.agent) return parsed;
  } catch { /* not valid JSON */ }
  return null;
}

/** Write an agent's status to disk */
function writeAgentStatus(agentId: string, status: Record<string, unknown>) {
  try {
    mkdirSync(STATUS_DIR, { recursive: true });
    const statusFile = join(STATUS_DIR, `${agentId}.json`);
    writeFileSync(statusFile, JSON.stringify(status, null, 2) + "\n");
  } catch (err) {
    console.error(`[chat] Failed to write ${agentId} status:`, err);
  }
}

/** Safely read a file, returning null if it doesn't exist or fails */
function safeReadFile(filepath: string, maxBytes = 0): string | null {
  try {
    if (!existsSync(filepath)) return null;
    const content = readFileSync(filepath, "utf-8").trim();
    if (!content) return null;
    if (maxBytes > 0 && content.length > maxBytes) {
      return content.slice(0, maxBytes) + "\n...(truncated)";
    }
    return content;
  } catch { return null; }
}

/** Find recent memory logs (today + fallback to recent days) */
function findRecentMemoryLogs(maxDays = 3, maxTotalChars = 4000): string {
  const logs: string[] = [];
  let totalChars = 0;

  for (let i = 0; i < maxDays; i++) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const mainLog = safeReadFile(join(MEMORY_DIR, `${date}.md`));
    if (mainLog) {
      const remaining = maxTotalChars - totalChars;
      if (remaining <= 0) break;
      const truncated = mainLog.length > remaining ? mainLog.slice(-remaining) : mainLog;
      logs.push(`### ${date}\n${truncated}`);
      totalChars += truncated.length;
    }

    // Also check for dated variant files (e.g., 2026-03-01-evening-update.md)
    try {
      const files = readdirSync(MEMORY_DIR)
        .filter(f => f.startsWith(date) && f.endsWith(".md") && f !== `${date}.md`)
        .sort();
      for (const file of files) {
        const remaining = maxTotalChars - totalChars;
        if (remaining <= 200) break;
        const content = safeReadFile(join(MEMORY_DIR, file), remaining);
        if (content) {
          logs.push(`### ${file}\n${content}`);
          totalChars += content.length;
        }
      }
    } catch { /* ignore dir read errors */ }
  }

  return logs.length > 0 ? logs.join("\n\n") : "(No recent memory logs found)";
}

/** Find the most recent session handoff */
function findLatestHandoff(): string | null {
  const handoffDir = join(homedir(), "session_handoffs");
  try {
    if (!existsSync(handoffDir)) return null;
    const files = readdirSync(handoffDir)
      .filter(f => f.includes("rip") && f.endsWith(".md"))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    return safeReadFile(join(handoffDir, files[0]), 2000);
  } catch { return null; }
}

/** Build a context-restoration prompt that gives the agent everything it needs */
function buildStartupPrompt(): string {
  const parts: string[] = [];

  parts.push(
    `[SYSTEM — Session Restored via Mission Control Dashboard]\n` +
    `⚠️ LANGUAGE: You MUST respond in ENGLISH only. Never respond in Chinese or any other language.\n` +
    `This is a NEW session. Your previous conversation history was cleared.\n` +
    `Your context has been reset BUT your work is NOT lost — read the state below carefully.\n` +
    `DO NOT start old/completed tasks. Focus on what the status says is CURRENT.\n` +
    `If you're unsure what to do, ask the user rather than reverting to old missions.\n`
  );

  // 1. Inject SYSTEM_KNOWLEDGE.md — the most important context file
  // Include first ~200 lines (infrastructure, env files, accounts, services)
  const sysKnowledge = safeReadFile(join(homedir(), "SYSTEM_KNOWLEDGE.md"));
  if (sysKnowledge) {
    const lines = sysKnowledge.split("\n");
    const truncated = lines.slice(0, 200).join("\n");
    parts.push(
      `## SYSTEM_KNOWLEDGE.md (Critical Reference — first 200 lines)\n` +
      `This is your canonical reference. If anything conflicts, this file wins.\n` +
      truncated
    );
  }

  // 2. Inject AGENTS.md — org structure and role expectations
  const agentsMd = safeReadFile(join(homedir(), "AGENTS.md"), 4000);
  if (agentsMd) {
    parts.push(`## AGENTS.md (Org Structure & Roles)\n${agentsMd}`);
  }

  // 3. Inject saved status for the agent
  const agentId = "rip"; // Default for Mission Control chat
  const status = readAgentStatus(agentId);
  if (status) {
    parts.push(
      `## Last Saved Agent Status (memory/status/${agentId}.json)\n` +
      `\`\`\`json\n${JSON.stringify(status, null, 2)}\n\`\`\`\n` +
      `⚠️ If current_task says something generic like "Agent status check", ` +
      `it means the status file is stale. Ask the user what to work on.`
    );
  } else {
    parts.push(`## Status: No valid status file found. Ask the user for current priorities.`);
  }

  // 4. Inject conversation summary from last session (if saved)
  const convSummaryFile = join(STATUS_DIR, `${agentId}_last_session_summary.md`);
  const convSummary = safeReadFile(convSummaryFile, 3000);
  if (convSummary) {
    parts.push(`## Last Session Summary (What you were doing before reset)\n${convSummary}`);
  }

  // 5. Inject latest handoff
  const handoff = findLatestHandoff();
  if (handoff && handoff.length > 50) {
    parts.push(`## Latest Session Handoff\n${handoff}`);
  }

  // 6. Inject recent memory logs (today + fallback to recent days)
  const memoryLogs = findRecentMemoryLogs(3, 4000);
  parts.push(`## Recent Memory Logs\n${memoryLogs}`);

  // 7. Inject MISSIONS.md (full file, not just 60 lines — missions change)
  const missions = safeReadFile(join(homedir(), "MISSIONS.md"), 5000);
  if (missions) {
    parts.push(`## Active Missions (MISSIONS.md)\n${missions}`);
  }

  // 8. Check for a "rip-priority-override" file that user/agents can create
  // to force specific priorities on session recovery
  const priorityOverride = safeReadFile(join(homedir(), "RIP_READ_THIS.md"), 3000);
  if (priorityOverride) {
    parts.push(
      `## 🚨 PRIORITY OVERRIDE (RIP_READ_THIS.md) — READ THIS FIRST\n` +
      priorityOverride
    );
  }

  parts.push(
    `\n---\n` +
    `## Instructions for Recovery\n` +
    `1. Read ALL the context above carefully before acting.\n` +
    `2. DO NOT restart tasks that the status/summary says are already completed.\n` +
    `3. If "current_task" is stale or generic, check RIP_READ_THIS.md or ask the user.\n` +
    `4. Update memory/status/rip.json with your ACTUAL current state.\n` +
    `5. State what you're picking up and your immediate next action.\n` +
    `6. If the Kalshi API or any system was previously fixed, DO NOT try to re-fix it.\n`
  );

  return parts.join("\n\n");
}

/**
 * GET /api/chat — fetch chat history for a session
 */
export async function GET(req: NextRequest) {
  const sessionKey =
    req.nextUrl.searchParams.get("sessionKey") || DEFAULT_SESSION_KEY;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);

  try {
    const client = getOpenClawClient();
    const messages = await client.getChatHistory(sessionKey, { limit });
    // Filter out tool-only and non-response assistant messages to reduce payload size
    const filtered = messages.filter((msg: { role: string; content: unknown }) => {
      if (msg.role !== 'assistant') return true;
      if (isNonResponse(msg.content)) return false;
      const content = msg.content;
      if (!content) return false;
      if (Array.isArray(content)) {
        return content.some(
          (block: { type?: string; text?: string }) =>
            typeof block === 'string' ||
            (block && block.type === 'text' && block.text?.trim())
        );
      }
      return typeof content === 'string' && content.trim().length > 0;
    });
    return NextResponse.json({ messages: filtered, sessionKey });
  } catch (err: unknown) {
    console.error("[chat] Error fetching history:", err);
    return NextResponse.json(
      { error: "Failed to fetch chat history", detail: String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat — send a message and poll for the assistant reply
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionKey: customSessionKey } = body;

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const sessionKey = customSessionKey || DEFAULT_SESSION_KEY;
    const client = getOpenClawClient();

    // Prefix with context so Rip knows this is Rut chatting via Mission Control
    const prefixedMessage = `[Rut via Mission Control Dashboard] ${message.trim()}`;

    // Get message count before sending so we know what's "new"
    const beforeHistory = await client.getChatHistory(sessionKey, { limit: 3 });
    const beforeCount = beforeHistory.length;

    // Send the message
    const sendTime = Date.now();
    await client.sendMessage(sessionKey, prefixedMessage);

    // Poll for assistant reply (up to 90s with adaptive intervals)
    const maxWaitMs = 90_000;
    const elapsed = () => Date.now() - sendTime;

    while (elapsed() < maxWaitMs) {
      // Adaptive polling: fast at first, slower later
      const waitMs = elapsed() < 10_000 ? 1500 : elapsed() < 30_000 ? 2500 : 4000;
      await new Promise((r) => setTimeout(r, waitMs));

      const history = await client.getChatHistory(sessionKey, { limit: 10 });

      // Look for a NEW assistant message (one that wasn't there before)
      if (history.length > beforeCount) {
        // Find the last assistant message
        for (let i = history.length - 1; i >= 0; i--) {
          const msg = history[i];
          if (msg.role === "assistant") {
            // Skip gateway placeholders (HEARTBEAT_OK, NO_REPLY, empty)
            if (isNonResponse(msg.content)) continue;

            // Verify it's recent by timestamp (if available)
            if (msg.timestamp) {
              const msgTime = new Date(msg.timestamp).getTime();
              if (msgTime >= sendTime - 2000) {
                return NextResponse.json({
                  reply: msg,
                  sessionKey,
                  history: history.slice(-10),
                });
              }
            } else {
              // No timestamp — trust that new messages at the end are replies
              return NextResponse.json({
                reply: msg,
                sessionKey,
                history: history.slice(-10),
              });
            }
          }
        }
      }
    }

    // Timeout — return what we have
    const finalHistory = await client.getChatHistory(sessionKey, { limit: 10 });
    return NextResponse.json({
      reply: null,
      timeout: true,
      sessionKey,
      history: finalHistory.slice(-10),
    });
  } catch (err: unknown) {
    console.error("[chat] Error sending message:", err);
    return NextResponse.json(
      { error: "Failed to send message", detail: String(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat — save agent state, abort + reset session, return clean state
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionKey, skipSave } = body;

    if (!sessionKey?.trim()) {
      return NextResponse.json(
        { error: "sessionKey is required" },
        { status: 400 }
      );
    }

    const client = getOpenClawClient();
    const key = sessionKey.trim();

    // Before clearing: save a comprehensive snapshot of the conversation
    // This includes extracting actual tasks, priorities, and accomplishments
    if (!skipSave) {
      try {
        const history = await client.getChatHistory(key, { limit: 30 });
        if (history.length > 0) {
          // Extract assistant and user messages for context
          const assistantMsgs = history
            .filter((m) => m.role === "assistant")
            .map((m) => {
              const c = m.content;
              if (typeof c === "string") return c;
              if (Array.isArray(c)) {
                return (c as Array<{ type?: string; text?: string }>)
                  .filter((b) => b.type === "text" && b.text)
                  .map((b) => b.text)
                  .join("\n");
              }
              return JSON.stringify(c);
            })
            .filter((t) => t && !isNonResponse(t));

          const userMsgs = history
            .filter((m) => m.role === "user")
            .map((m) => String(m.content))
            .filter((t) => t && !isNonResponse(t));

          // Build a conversation summary from the last meaningful messages
          const recentAssistant = assistantMsgs.slice(-5);
          const recentUser = userMsgs.slice(-5);
          const agentId = getAgentId(key);

          // Save a session summary as markdown
          const summaryParts: string[] = [
            `# Session Summary (auto-saved ${new Date().toISOString()})`,
            ``,
            `## Last User Messages`,
            ...recentUser.map((m) => `- ${m.slice(0, 500)}`),
            ``,
            `## Last Agent Responses (summaries)`,
            ...recentAssistant.map((m) => `- ${m.slice(0, 800)}`),
            ``,
            `## Session Stats`,
            `- Total messages: ${history.length}`,
            `- Session key: ${key}`,
            `- Saved at: ${new Date().toISOString()}`,
          ];

          try {
            mkdirSync(STATUS_DIR, { recursive: true });
            writeFileSync(
              join(STATUS_DIR, `${agentId}_last_session_summary.md`),
              summaryParts.join("\n") + "\n"
            );
          } catch (err) {
            console.error("[chat] Warning: could not save session summary:", err);
          }

          // Also save a structured status file
          const lastAssistant = [...history]
            .reverse()
            .find((m) => m.role === "assistant" && !isNonResponse(m.content));
          const lastUser = [...history]
            .reverse()
            .find((m) => m.role === "user" && !isNonResponse(m.content));

          const statusSnapshot: Record<string, unknown> = {
            agent: agentId,
            updated_at: new Date().toISOString(),
            status: "session-reset",
            session_key: key,
            message_count: history.length,
            last_user_message: lastUser
              ? String(lastUser.content).slice(0, 500)
              : null,
            last_assistant_summary: lastAssistant
              ? String(
                  typeof lastAssistant.content === "string"
                    ? lastAssistant.content
                    : JSON.stringify(lastAssistant.content)
                ).slice(0, 1000)
              : null,
            saved_reason: "session-reset-from-dashboard",
            next_action:
              "Read session summary and resume most recent work",
          };

          // Merge with existing status if it has useful fields
          const existing = readAgentStatus(agentId);
          if (existing) {
            // Preserve any existing fields the agent set (like revenue_blocking_task)
            for (const k of [
              "active_tasks",
              "workers_spawned",
              "revenue_blocking_task",
              "current_task",
              "progress_pct",
            ]) {
              if (existing[k] != null && statusSnapshot[k] == null) {
                statusSnapshot[k] = existing[k];
              }
            }
          }

          writeAgentStatus(agentId, statusSnapshot);
        }
      } catch (err) {
        console.error("[chat] Warning: could not save state before reset:", err);
        // Non-blocking — proceed with cleanup
      }
    }

    // Abort any in-flight processing, then reset the session
    try {
      await client.abortChat(key);
    } catch {
      // Ignore abort errors
    }

    try {
      await client.resetSession(key);
    } catch {
      // Ignore reset errors
    }

    return NextResponse.json({ ok: true, sessionKey: key });
  } catch (err: unknown) {
    console.error("[chat] Error cleaning up session:", err);
    return NextResponse.json(
      { error: "Failed to clean up session", detail: String(err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chat — send startup/restoration prompt to a new session
 * This bootstraps the agent with its last saved state so it can resume autonomously.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionKey: customSessionKey } = body;

    const sessionKey = customSessionKey || DEFAULT_SESSION_KEY;
    const client = getOpenClawClient();

    const startupPrompt = buildStartupPrompt();

    // Get message count before sending
    const beforeHistory = await client.getChatHistory(sessionKey, { limit: 3 });
    const beforeCount = beforeHistory.length;

    // Send the startup prompt
    const sendTime = Date.now();
    await client.sendMessage(sessionKey, startupPrompt);

    // Poll for acknowledgment (up to 90s)
    const maxWaitMs = 90_000;
    const elapsed = () => Date.now() - sendTime;

    while (elapsed() < maxWaitMs) {
      const waitMs =
        elapsed() < 10_000 ? 1500 : elapsed() < 30_000 ? 2500 : 4000;
      await new Promise((r) => setTimeout(r, waitMs));

      const history = await client.getChatHistory(sessionKey, { limit: 10 });

      if (history.length > beforeCount) {
        for (let i = history.length - 1; i >= 0; i--) {
          const msg = history[i];
          if (msg.role === "assistant") {
            // Skip gateway placeholders
            if (isNonResponse(msg.content)) continue;

            if (msg.timestamp) {
              const msgTime = new Date(msg.timestamp).getTime();
              if (msgTime >= sendTime - 2000) {
                return NextResponse.json({
                  reply: msg,
                  sessionKey,
                  restored: true,
                });
              }
            } else {
              return NextResponse.json({
                reply: msg,
                sessionKey,
                restored: true,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      reply: null,
      timeout: true,
      sessionKey,
      restored: false,
    });
  } catch (err: unknown) {
    console.error("[chat] Error sending startup prompt:", err);
    return NextResponse.json(
      { error: "Failed to send startup prompt", detail: String(err) },
      { status: 500 }
    );
  }
}
