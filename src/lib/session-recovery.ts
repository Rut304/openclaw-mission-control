/**
 * Session Recovery System
 * 
 * Ensures agents can recover from unexpected terminations without missing work.
 * 
 * Key features:
 * - Auto-save session state every 5 seconds
 * - Checkpoint system for long-running tasks
 * - Recovery instructions for each session
 * - Handoff summaries on graceful shutdown
 */

import fs from "fs";
import path from "path";

interface SessionCheckpoint {
  sessionKey: string;
  agentId: string;
  timestamp: number;
  state: {
    currentTask: string | null;
    currentStep: number;
    totalSteps: number;
    context: Record<string, unknown>;
    lastAction: string;
    lastResult: string;
  };
  recoveryInstructions: string;
}

interface SessionState {
  sessionKey: string;
  agentId: string;
  model: string;
  startedAt: number;
  lastActivityAt: number;
  tokenCount: number;
  messageCount: number;
  checkpoints: SessionCheckpoint[];
  status: "active" | "idle" | "terminated" | "rotating";
}

const SESSIONS_DIR = path.join(process.cwd(), "data", "sessions");
const RECOVERY_FILE = path.join(SESSIONS_DIR, "recovery-state.json");

class SessionRecoveryManager {
  private sessions: Map<string, SessionState> = new Map();
  private saveInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.ensureDir();
    this.loadState();
    this.startAutoSave();
  }

  private ensureDir(): void {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
  }

  private loadState(): void {
    try {
      if (fs.existsSync(RECOVERY_FILE)) {
        const data = JSON.parse(fs.readFileSync(RECOVERY_FILE, "utf-8"));
        this.sessions = new Map(Object.entries(data.sessions || {}));
        console.log(`[recovery] Loaded ${this.sessions.size} session states`);
      }
    } catch (err) {
      console.error("[recovery] Failed to load state:", err);
    }
  }

  private saveState(): void {
    try {
      const data = {
        savedAt: Date.now(),
        sessions: Object.fromEntries(this.sessions),
      };
      fs.writeFileSync(RECOVERY_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("[recovery] Failed to save state:", err);
    }
  }

  private startAutoSave(): void {
    // Auto-save every 5 seconds
    this.saveInterval = setInterval(() => {
      this.saveState();
    }, 5000);
  }

  /**
   * Register or update a session
   */
  updateSession(
    sessionKey: string,
    update: Partial<SessionState>
  ): SessionState {
    const existing = this.sessions.get(sessionKey) || {
      sessionKey,
      agentId: update.agentId || "unknown",
      model: update.model || "unknown",
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      tokenCount: 0,
      messageCount: 0,
      checkpoints: [],
      status: "active" as const,
    };

    const updated: SessionState = {
      ...existing,
      ...update,
      lastActivityAt: Date.now(),
    };

    this.sessions.set(sessionKey, updated);
    return updated;
  }

  /**
   * Create a checkpoint for a task in progress
   */
  createCheckpoint(
    sessionKey: string,
    checkpoint: Omit<SessionCheckpoint, "sessionKey" | "timestamp">
  ): void {
    const session = this.sessions.get(sessionKey);
    if (!session) return;

    const fullCheckpoint: SessionCheckpoint = {
      ...checkpoint,
      sessionKey,
      timestamp: Date.now(),
    };

    // Keep only last 5 checkpoints per session
    session.checkpoints = [...session.checkpoints.slice(-4), fullCheckpoint];
    this.sessions.set(sessionKey, session);
    this.saveState(); // Immediate save for checkpoints
  }

  /**
   * Get recovery instructions for a session
   */
  getRecoveryInstructions(sessionKey: string): string | null {
    const session = this.sessions.get(sessionKey);
    if (!session || session.checkpoints.length === 0) return null;

    const lastCheckpoint = session.checkpoints[session.checkpoints.length - 1];
    return lastCheckpoint.recoveryInstructions;
  }

  /**
   * Generate handoff summary before session rotation
   */
  generateHandoffSummary(sessionKey: string): string {
    const session = this.sessions.get(sessionKey);
    if (!session) return "No session data available.";

    const lastCheckpoint = session.checkpoints[session.checkpoints.length - 1];
    const duration = Math.round((Date.now() - session.startedAt) / 1000 / 60);

    let summary = `## Session Handoff Summary\n\n`;
    summary += `**Session:** ${sessionKey}\n`;
    summary += `**Agent:** ${session.agentId}\n`;
    summary += `**Model:** ${session.model}\n`;
    summary += `**Duration:** ${duration} minutes\n`;
    summary += `**Messages:** ${session.messageCount}\n`;
    summary += `**Tokens:** ${session.tokenCount}\n\n`;

    if (lastCheckpoint) {
      summary += `### Last Task State\n`;
      summary += `- **Task:** ${lastCheckpoint.state.currentTask || "None"}\n`;
      summary += `- **Progress:** Step ${lastCheckpoint.state.currentStep} of ${lastCheckpoint.state.totalSteps}\n`;
      summary += `- **Last Action:** ${lastCheckpoint.state.lastAction}\n`;
      summary += `- **Result:** ${lastCheckpoint.state.lastResult}\n\n`;
      summary += `### Recovery Instructions\n`;
      summary += lastCheckpoint.recoveryInstructions;
    }

    return summary;
  }

  /**
   * Mark session as rotating (about to be reset)
   */
  markRotating(sessionKey: string): void {
    this.updateSession(sessionKey, { status: "rotating" });

    // Save handoff to file
    const summary = this.generateHandoffSummary(sessionKey);
    const handoffFile = path.join(
      SESSIONS_DIR,
      `handoff-${sessionKey.replace(/[:/]/g, "-")}-${Date.now()}.md`
    );
    fs.writeFileSync(handoffFile, summary);
    console.log(`[recovery] Handoff saved to ${handoffFile}`);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionState[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "active" || s.status === "idle"
    );
  }

  /**
   * Get sessions needing recovery
   */
  getSessionsNeedingRecovery(): SessionState[] {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return Array.from(this.sessions.values()).filter(
      (s) =>
        s.status === "active" &&
        s.lastActivityAt < oneHourAgo &&
        s.checkpoints.length > 0
    );
  }

  /**
   * Clean up old sessions
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    for (const [key, session] of this.sessions) {
      if (session.lastActivityAt < cutoff) {
        this.sessions.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.saveState();
    }

    return cleaned;
  }
}

// Singleton instance
export const sessionRecovery = new SessionRecoveryManager();

// Export types
export type { SessionState, SessionCheckpoint };
