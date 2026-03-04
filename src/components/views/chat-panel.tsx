"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Plus,
  Bot,
  User,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Trash2,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

/** Strip <think>...</think> blocks, <final>...</final> wrapper tags, and MC prefix */
function cleanText(text: string): string {
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleaned = cleaned.replace(/<\/?final>/gi, "");
  cleaned = cleaned.replace(/^\[(CEO|Rut) via Mission Control Dashboard\]\s*/i, "");
  return cleaned.trim();
}

function extractText(content: unknown): string {
  if (typeof content === "string") return cleanText(content);
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (typeof block === "string") {
        parts.push(block);
      } else if (block && typeof block === "object") {
        // Skip tool_use and tool_result blocks — they're not human-readable
        if (block.type === "tool_use" || block.type === "tool_result") continue;
        if (block.text) parts.push(block.text);
        else if (block.content) {
          const inner = extractText(block.content);
          if (inner) parts.push(inner);
        }
      }
    }
    return cleanText(parts.join("\n"));
  }
  if (content && typeof content === "object") {
    const obj = content as Record<string, unknown>;
    if (obj.text) return cleanText(String(obj.text));
    if (obj.content) return extractText(obj.content);
  }
  return cleanText(String(content ?? ""));
}

/** Check if a message is a non-response (NO_REPLY, HEARTBEAT_OK, empty, status JSON dumps) */
function isNonResponse(text: string): boolean {
  const t = text.trim();
  const upper = t.toUpperCase();
  if (!t) return true;
  if (
    upper === "NO_REPLY" ||
    upper === "HEARTBEAT_OK" ||
    upper === "NO_REPLY." ||
    upper === "HEARTBEAT_OK."
  ) return true;
  // Detect agent status JSON dumps (e.g. {"agent": "rip", "status": "working"...})
  if (t.startsWith("{") && t.endsWith("}")) {
    try {
      const obj = JSON.parse(t);
      if (obj && typeof obj === "object" && (obj.agent || obj.status || obj.current_task || obj.progress_pct !== undefined)) {
        return true;
      }
    } catch { /* not JSON, let it through */ }
  }
  return false;
}

const DEFAULT_SESSION_KEY = "mission-control:general-chat";
const SESSION_STORAGE_KEY = "mc-chat-session";
const MESSAGE_ARCHIVE_KEY = "mc-chat-messages";
const MAX_ARCHIVED_MESSAGES = 200;

function getStoredSessionKey(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem(SESSION_STORAGE_KEY) || DEFAULT_SESSION_KEY;
  }
  return DEFAULT_SESSION_KEY;
}

function storeSessionKey(key: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_STORAGE_KEY, key);
  }
}

/** Persist messages to localStorage for seamless reload recovery */
function archiveMessages(msgs: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    // Keep only the last N messages to avoid localStorage bloat
    const toSave = msgs.slice(-MAX_ARCHIVED_MESSAGES);
    localStorage.setItem(MESSAGE_ARCHIVE_KEY, JSON.stringify(toSave));
  } catch { /* localStorage full or unavailable */ }
}

/** Load archived messages from localStorage */
function loadArchivedMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MESSAGE_ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* corrupt data */ }
  return [];
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextOverflow, setContextOverflow] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [sessionKey, setSessionKey] = useState(DEFAULT_SESSION_KEY);

  // Load persisted session key AND archived messages on mount
  useEffect(() => {
    const stored = getStoredSessionKey();
    if (stored !== sessionKey) {
      setSessionKey(stored);
    }
    // Immediately show archived messages while we fetch live history
    const archived = loadArchivedMessages();
    if (archived.length > 0) {
      setMessages(archived);
      setLoading(false); // Don't show loading spinner if we have cached messages
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Archive messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      archiveMessages(messages);
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  /** Abort + reset a session on the gateway (saves state before clearing) */
  const cleanupSession = useCallback(async (key: string, skipSave = false) => {
    try {
      await fetch("/api/chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey: key, skipSave }),
      });
    } catch {
      // Non-critical — old session will idle out
    }
  }, []);

  /** Send a startup/restoration prompt to the new session so the agent restores context */
  const restoreSession = useCallback(
    async (key: string) => {
      setRestoring(true);
      try {
        const res = await fetch("/api/chat", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey: key }),
        });
        const data = await res.json();
        if (data.reply) {
          setMessages((prev) => [
            {
              role: "system" as const,
              content: "[Session restored — agent received priorities and context]",
              timestamp: new Date().toISOString(),
            },
            ...prev,
            data.reply,
          ]);
          setConsecutiveFailures(0);
        } else if (data.timeout) {
          setError(
            "Agent is still loading context — click refresh in a moment."
          );
        }
      } catch {
        setError("Failed to send restoration prompt");
      } finally {
        setRestoring(false);
      }
    },
    []
  );

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/chat?sessionKey=${encodeURIComponent(sessionKey)}&limit=50`
      );
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
        // If session has messages, we're in a live session — no restore needed
        if (data.messages.length > 0) {
          setError(null);
          return;
        }
      }
      // If no messages and we haven't already restored, auto-restore context
      // This handles the page-reload case: session is fresh/empty, agent needs context
      if (!restoring) {
        const lastRestore = typeof window !== "undefined"
          ? localStorage.getItem("mc-chat-last-restore") : null;
        const timeSinceRestore = lastRestore
          ? Date.now() - parseInt(lastRestore, 10) : Infinity;
        // Only auto-restore if we haven't done it in the last 30 seconds
        // (prevents infinite restore loops)
        if (timeSinceRestore > 30000) {
          console.log("[chat-panel] Empty session detected on load — auto-restoring context");
          if (typeof window !== "undefined") {
            localStorage.setItem("mc-chat-last-restore", String(Date.now()));
          }
          restoreSession(sessionKey);
        }
      }
      setError(null);
    } catch (err) {
      setError("Failed to load chat history");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [sessionKey, restoring, restoreSession]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /** Silently rotate the backend session when context overflows.
   *  Keeps all messages in the UI — user never sees a break. */
  const silentSessionRotate = useCallback(async (retryMessage?: string) => {
    const oldKey = sessionKey;
    const newKey = `mission-control:chat-${Date.now()}`;

    // Save state from old session
    await cleanupSession(oldKey);

    // Switch to new backend session
    setSessionKey(newKey);
    storeSessionKey(newKey);
    setContextOverflow(false);
    setConsecutiveFailures(0);

    // Add a subtle system indicator (visible in UI as a divider)
    setMessages((prev) => [...prev, {
      role: "system" as const,
      content: "[Context refreshed — conversation continues seamlessly]",
      timestamp: new Date().toISOString(),
    }]);

    if (typeof window !== "undefined") {
      localStorage.setItem("mc-chat-last-restore", String(Date.now()));
    }

    // Restore context in new session
    await restoreSession(newKey);

    // If we had a message that failed due to overflow, retry it
    if (retryMessage) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: retryMessage, sessionKey: newKey }),
        });
        const data = await res.json();
        if (data.reply && !isNonResponse(extractText(data.reply.content))) {
          setMessages((prev) => [...prev, data.reply]);
        }
      } catch {
        setError("Failed to resend message after session refresh. Try again.");
      }
    }
  }, [sessionKey, cleanupSession, restoreSession]);

  /** Abort + reset the current session, then create a fresh one with auto-restore.
   *  This is the MANUAL version — keeps messages in UI but rotates backend. */
  const startNewSession = useCallback(async () => {
    const oldKey = sessionKey;
    const newKey = `mission-control:chat-${Date.now()}`;

    // Save state from old session, then clean it up on the gateway
    await cleanupSession(oldKey);

    setSessionKey(newKey);
    storeSessionKey(newKey);
    // DON'T clear messages — keep conversation visible
    setError(null);
    setContextOverflow(false);
    setConsecutiveFailures(0);

    setMessages((prev) => [...prev, {
      role: "system" as const,
      content: "[Backend session refreshed — conversation continues]",
      timestamp: new Date().toISOString(),
    }]);

    // Track last restore time to prevent loops
    if (typeof window !== "undefined") {
      localStorage.setItem("mc-chat-last-restore", String(Date.now()));
    }

    // Auto-restore: send startup prompt with saved priorities + missions
    setTimeout(() => restoreSession(newKey), 500);
  }, [sessionKey, cleanupSession, restoreSession]);

  /** Clear the entire chat history (UI + backend) — fresh start */
  const clearEntireChat = useCallback(async () => {
    await cleanupSession(sessionKey);
    setMessages([]);
    setError(null);
    setContextOverflow(false);
    setConsecutiveFailures(0);

    // Clear the local archive too
    if (typeof window !== "undefined") {
      localStorage.removeItem(MESSAGE_ARCHIVE_KEY);
      localStorage.setItem("mc-chat-last-restore", String(Date.now()));
    }

    // Auto-restore context after clear
    setTimeout(() => restoreSession(sessionKey), 500);
  }, [sessionKey, cleanupSession, restoreSession]);

  /** Reset the current session (backend only, keep UI messages) */
  const resetCurrentSession = useCallback(async () => {
    await silentSessionRotate();
  }, [silentSessionRotate]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    setError(null);
    setContextOverflow(false);

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionKey }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setConsecutiveFailures((c) => c + 1);
        return;
      }

      if (data.reply) {
        // Check for context overflow → SILENT ROTATION (no UI disruption)
        const errMsg = data.reply.errorMessage || "";
        if (
          errMsg.includes("context length") ||
          errMsg.includes("maximum context") ||
          errMsg.includes("too many tokens")
        ) {
          // Silently rotate and retry the failed message
          await silentSessionRotate(text);
          return;
        }
        if (data.reply.stopReason === "error" && errMsg) {
          setError(`Agent error: ${errMsg.slice(0, 200)}`);
          setConsecutiveFailures((c) => c + 1);
          return;
        }

        // Check for non-response patterns (NO_REPLY, empty, etc.)
        const replyText = extractText(data.reply.content);
        if (isNonResponse(replyText)) {
          const fails = consecutiveFailures + 1;
          setConsecutiveFailures(fails);
          if (fails >= 2) {
            setError(
              "Agent is not responding properly. The session may be stale — try resetting or starting a new session."
            );
          } else {
            setError(
              "Agent returned an empty response. Try sending your message again."
            );
          }
          // Still show the message in history
          setMessages((prev) => [...prev, data.reply]);
        } else {
          // Successful real response — reset failure counter
          setConsecutiveFailures(0);
          setMessages((prev) => [...prev, data.reply]);
        }
      } else if (data.timeout) {
        setConsecutiveFailures((c) => c + 1);
        setError(
          "Agent is still processing — click refresh to check for a response."
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to send: ${msg}`);
      setConsecutiveFailures((c) => c + 1);
      console.error(err);
    } finally {
      setSending(true);
      // Small delay ensures state settles before re-enabling
      setTimeout(() => {
        setSending(false);
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const visibleMessages = messages.filter((m) => {
    // Show system messages that are session refresh markers
    if (m.role === "system") {
      const text = typeof m.content === "string" ? m.content : "";
      return text.includes("Context refreshed") || text.includes("Session restored") || text.includes("Backend session refreshed");
    }
    if (m.role === "assistant") {
      // Hide messages that are purely tool calls with no human-readable text
      const text = extractText(m.content);
      if (!text || isNonResponse(text)) return false;
    }
    return true;
  });
  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const sessionAge =
    userMsgCount > 8 ? "high" : userMsgCount > 4 ? "medium" : "low";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{ flexShrink: 0 }}
        className="flex items-center justify-between px-4 py-3 border-b border-border"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Agent Chat
            </h2>
            <p className="text-[10px] text-muted-foreground font-mono">
              {sessionKey.replace("mission-control:", "")}
              {sessionAge === "high" && (
                <span className="ml-2 text-amber-400">
                  ● context filling up
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={resetCurrentSession}
            className="p-2 rounded-lg text-muted-foreground hover:text-amber-400 hover:bg-amber-400/5 transition-all"
            title="Refresh backend session (keeps chat history)"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={clearEntireChat}
            className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/5 transition-all"
            title="Clear entire chat history"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={startNewSession}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New Backend
          </button>
        </div>
      </div>

      {/* Messages — scrollable middle */}
      <div
        ref={scrollContainerRef}
        style={{ flex: "1 1 0%", overflowY: "auto", minHeight: 0 }}
        className="px-4 py-3 space-y-3"
      >
        {loading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading conversation…
          </div>
        )}

        {!loading && visibleMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Bot className="w-7 h-7 text-primary/60" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              Start a conversation
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Chat directly with your agent. Ask questions, give instructions,
              or just say hello.
            </p>
          </div>
        )}

        {visibleMessages.map((msg, i) => {
          const isUser = msg.role === "user";
          const isSystem = msg.role === "system";
          const text = extractText(msg.content);
          const isStale = !isUser && !isSystem && isNonResponse(text);
          const time = msg.timestamp
            ? new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : null;

          // System messages render as subtle dividers
          if (isSystem) {
            return (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] text-muted-foreground/60 font-mono whitespace-nowrap">
                  {text} {time && `· ${time}`}
                </span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            );
          }

          return (
            <div
              key={i}
              className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isUser
                    ? "bg-primary/20 text-primary"
                    : isStale
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {isUser ? (
                  <User className="w-3.5 h-3.5" />
                ) : (
                  <Bot className="w-3.5 h-3.5" />
                )}
              </div>
              {/* Bubble */}
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                  isUser
                    ? "bg-primary text-primary-foreground rounded-tr-md"
                    : isStale
                      ? "bg-amber-500/5 border border-amber-500/20 rounded-tl-md"
                      : "bg-card border border-border rounded-tl-md"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {text || (
                    <span className="text-muted-foreground italic text-xs">
                      (empty response)
                    </span>
                  )}
                  {isStale && text && (
                    <span className="block text-[10px] text-amber-400 mt-1">
                      Agent did not respond to this message
                    </span>
                  )}
                </div>
                {time && (
                  <div
                    className={`text-[10px] mt-1 ${
                      isUser
                        ? "text-primary-foreground/60"
                        : "text-muted-foreground"
                    }`}
                  >
                    {time}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Sending indicator */}
        {sending && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-md px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Agent is thinking…
              </div>
            </div>
          </div>
        )}

        {/* Error / warning banner */}
        {error && (
          <div className="mx-auto max-w-md text-center text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-medium text-xs">Error</span>
            </div>
            <p>{error}</p>
            {(contextOverflow || consecutiveFailures >= 2) && (
              <div className="flex justify-center gap-2 mt-2">
                <button
                  onClick={resetCurrentSession}
                  className="px-3 py-1 rounded-lg text-[10px] font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all"
                >
                  Refresh Session
                </button>
                <button
                  onClick={clearEntireChat}
                  className="px-3 py-1 rounded-lg text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                >
                  Clear Chat
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input — pinned bottom */}
      <div
        style={{ flexShrink: 0 }}
        className="px-4 py-3 border-t border-border"
      >
        <div className="flex items-end gap-2 bg-card border border-border rounded-2xl px-3.5 py-2.5 focus-within:border-primary/50 focus-within:shadow-[0_0_10px_oklch(0.58_0.2_260/0.15)] transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={2}
            disabled={sending}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-y outline-none max-h-48 py-1 disabled:opacity-50"
            style={{ minHeight: "48px" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-30 hover:bg-primary/90 transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
