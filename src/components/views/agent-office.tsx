"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Trophy, MessageSquare, Zap, Coffee, Users, Crown, ChevronDown, Search, AlarmClock, Settings, FileText, Brain, Clock, AlertTriangle, ChevronRight, X, Activity, Shield } from "lucide-react";

// ========== TYPES ==========
interface CronJob {
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
}

interface OfficeAgent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  visualState: "working" | "idle" | "sleeping" | "collaborating" | "frustrated";
  currentTask: string | null;
  progressPct: number;
  lastMessage: string | null;
  lastMessageTime: string | null;
  score: number;
  revenue: number;
  streak: number;
  rank: number;
  title: string;
  trashTalkStyle: string;
  minutesSinceUpdate: number;
  // Enriched data
  capabilities: string[];
  tools: string[];
  limitations: string[];
  reportsTo: string;
  manages: string[];
  collaboratesWith: string[];
  memberOf: string[];
  performanceScore: number;
  techStack: Record<string, string[]> | null;
  riskParameters: Record<string, number> | null;
  contentCalendar: Record<string, string> | null;
  cronJobs: CronJob[];
  activeCrons: number;
  erroredCrons: number;
  model: string;
  fallbackModels: string[];
  files: string[];
  nextAction: string | null;
  error: string | null;
  completedThisSession: string[];
}

interface CommMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  message: string;
  context?: string;
  timestamp: string;
}

interface Collaboration {
  agents: string[];
  topic: string;
}

interface OfficeData {
  agents: OfficeAgent[];
  comms: CommMessage[];
  leaderboard: OfficeAgent[];
  collaborations: Collaboration[];
  achievements: unknown[];
  updatedAt: string;
}

// ========== CUSTOM CSS KEYFRAMES ==========
const OFFICE_STYLES = `
@keyframes typing {
  0%, 100% { transform: translateY(0px); }
  25% { transform: translateY(-2px) rotate(-2deg); }
  75% { transform: translateY(-1px) rotate(2deg); }
}
@keyframes walkBob {
  0%, 100% { transform: translateY(0px) scaleX(1); }
  25% { transform: translateY(-4px) scaleX(0.97); }
  50% { transform: translateY(0px) scaleX(1); }
  75% { transform: translateY(-4px) scaleX(1.03); }
}
@keyframes floatZzz {
  0% { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(12px, -28px) scale(0.5); }
}
@keyframes headBob {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(8deg); }
}
@keyframes frustrated {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-3px); }
  40% { transform: translateX(3px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}
@keyframes collabPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
  50% { box-shadow: 0 0 16px 4px rgba(168, 85, 247, 0.2); }
}
@keyframes taskBubblePop {
  0% { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.8); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}
@keyframes speechBubble {
  0% { opacity: 0; transform: translateX(-50%) scale(0.7); }
  10% { opacity: 1; transform: translateX(-50%) scale(1.05); }
  15% { transform: translateX(-50%) scale(1); }
  85% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes progressGlow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
`;

// ========== MSG TYPE VISUALS ==========
const MSG_STYLES: Record<string, { color: string; label: string; bg: string }> = {
  info:        { color: "text-blue-400",    label: "\ud83d\udcac", bg: "bg-blue-500/5" },
  question:    { color: "text-cyan-400",    label: "\u2753",       bg: "bg-cyan-500/5" },
  celebration: { color: "text-emerald-400", label: "\ud83c\udf89", bg: "bg-emerald-500/5" },
  alert:       { color: "text-red-400",     label: "\ud83d\udea8", bg: "bg-red-500/5" },
  help_needed: { color: "text-orange-400",  label: "\ud83c\udd98", bg: "bg-orange-500/5" },
  task_update: { color: "text-green-400",   label: "\u2705",       bg: "bg-green-500/5" },
  trash_talk:  { color: "text-yellow-400",  label: "\ud83d\udd25", bg: "bg-yellow-500/5" },
  collaborate: { color: "text-purple-400",  label: "\ud83e\udd1d", bg: "bg-purple-500/5" },
  report:      { color: "text-green-400",   label: "\ud83d\udcca", bg: "bg-green-500/5" },
};

// ========== CARTOON AGENT CHARACTER ==========
function CartoonAgent({
  agent, isSelected, onClick, bubbleText,
}: {
  agent: OfficeAgent; isSelected: boolean; onClick: () => void; bubbleText: string | null;
}) {
  const [showBubble, setShowBubble] = useState(false);
  const [zzKey, setZzKey] = useState(0);

  // Re-trigger ZZZ animation for sleeping/idle agents
  useEffect(() => {
    if (agent.visualState === "sleeping" || agent.visualState === "idle") {
      const iv = setInterval(() => setZzKey((k) => k + 1), 3000);
      return () => clearInterval(iv);
    }
  }, [agent.visualState]);

  // Show speech bubble when new message arrives
  useEffect(() => {
    if (bubbleText) {
      setShowBubble(true);
      const t = setTimeout(() => setShowBubble(false), 6000);
      return () => clearTimeout(t);
    }
  }, [bubbleText]);

  const isWorking = agent.visualState === "working";
  const isSleeping = agent.visualState === "sleeping";
  const isIdle = agent.visualState === "idle";
  const isFrustrated = agent.visualState === "frustrated";
  const isCollab = agent.visualState === "collaborating";

  // Character body animation per state
  const bodyAnim = isWorking ? "typing 0.6s ease-in-out infinite"
    : isSleeping ? "headBob 2s ease-in-out infinite"
    : isFrustrated ? "frustrated 0.4s ease-in-out infinite"
    : isCollab ? "walkBob 0.8s ease-in-out infinite"
    : isIdle ? "headBob 3s ease-in-out infinite"
    : "none";

  const borderColor = isWorking ? "border-green-500/50"
    : isCollab ? "border-purple-500/50"
    : isFrustrated ? "border-red-500/50"
    : isSleeping ? "border-zinc-600/40"
    : "border-zinc-700/40";

  const glowStyle = isWorking ? "0 0 20px rgba(34,197,94,0.25)"
    : isCollab ? "0 0 20px rgba(168,85,247,0.25)"
    : isFrustrated ? "0 0 20px rgba(239,68,68,0.2)"
    : "none";

  return (
    <div className="relative" style={{ width: 160, height: 180 }}>
      {/* Speech bubble (from comms) */}
      {showBubble && bubbleText && (
        <div className="absolute z-40 max-w-[180px] pointer-events-none"
          style={{ top: -8, left: "50%", animation: "speechBubble 6s ease-in-out forwards" }}>
          <div className="bg-zinc-800 border border-zinc-500 rounded-xl px-3 py-2 text-[11px] text-zinc-200 shadow-xl relative">
            <p className="line-clamp-2 leading-snug">{bubbleText}</p>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-800 border-r border-b border-zinc-500 rotate-45" />
          </div>
        </div>
      )}

      {/* Task bubble (what they are working on) */}
      {isWorking && agent.currentTask && !showBubble && (
        <div className="absolute z-30 max-w-[170px] pointer-events-none"
          style={{ top: -4, left: "50%", animation: "taskBubblePop 0.3s ease-out forwards" }}>
          <div className="bg-green-900/80 border border-green-500/40 rounded-lg px-2.5 py-1.5 text-[10px] text-green-200 shadow-lg">
            <span className="text-green-400 font-semibold">{"\ud83d\udccb"} </span>
            <span className="line-clamp-1">{agent.currentTask}</span>
            {agent.progressPct > 0 && (
              <div className="mt-1 h-1 bg-green-950 rounded-full overflow-hidden">
                <div className="h-full bg-green-400 rounded-full transition-all duration-1000"
                  style={{ width: `${agent.progressPct}%`, animation: "progressGlow 2s infinite" }} />
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-green-900/80 border-r border-b border-green-500/40 rotate-45" />
        </div>
      )}

      {/* Frustrated exclamation */}
      {isFrustrated && (
        <div className="absolute -top-1 right-2 z-20 text-lg animate-bounce">{"\u2757"}</div>
      )}

      {/* The desk/station card */}
      <div
        onClick={onClick}
        className={`relative w-full h-full rounded-xl border-2 cursor-pointer transition-all duration-300 bg-zinc-900/60 backdrop-blur-sm overflow-visible ${borderColor} ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.03]" : "hover:scale-[1.02]"}`}
        style={{ boxShadow: glowStyle }}
      >
        {/* Status indicator dot */}
        <div className="absolute top-2.5 right-2.5">
          <div
            className={`w-2 h-2 rounded-full ${isWorking ? "bg-green-400" : isCollab ? "bg-purple-400" : isFrustrated ? "bg-red-400" : isSleeping ? "bg-zinc-600" : "bg-yellow-400"}`}
            style={{ animation: isWorking ? "progressGlow 1.5s infinite" : "none" }}
          />
        </div>

        {/* Rank badge */}
        {agent.rank <= 3 && agent.score > 0 && (
          <div className="absolute top-1.5 left-2 text-sm">
            {agent.rank === 1 ? "\ud83d\udc51" : agent.rank === 2 ? "\ud83e\udd48" : "\ud83e\udd49"}
          </div>
        )}

        {/* Streak fire */}
        {agent.streak >= 3 && (
          <div className="absolute top-1.5 left-2 text-[11px]">{"\ud83d\udd25"}{agent.streak}</div>
        )}

        {/* Agent character */}
        <div className="flex flex-col items-center justify-center h-full pt-6 pb-4">
          <div className="relative" style={{ animation: bodyAnim }}>
            {/* Sleeping ZZZs or coffee for idle */}
            {(isSleeping || isIdle) && (
              <div key={zzKey} className="absolute -top-3 -right-3 pointer-events-none">
                <span className="text-xs text-zinc-400 absolute"
                  style={{ animation: "floatZzz 2.5s ease-out forwards" }}>
                  {isSleeping ? "z" : ""}
                </span>
                <span className="text-sm text-zinc-500 absolute"
                  style={{ animation: "floatZzz 2.5s ease-out 0.4s forwards", opacity: 0 }}>
                  {isSleeping ? "Z" : "\u2615"}
                </span>
                <span className="text-base text-zinc-400 absolute"
                  style={{ animation: "floatZzz 2.5s ease-out 0.8s forwards", opacity: 0 }}>
                  {isSleeping ? "z" : ""}
                </span>
              </div>
            )}

            {/* Typing dots for working */}
            {isWorking && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                <span className="inline-block w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="inline-block w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="inline-block w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}

            {/* The emoji character */}
            <div className="text-4xl select-none" style={{ filter: isSleeping ? "grayscale(0.4)" : "none" }}>
              {isSleeping ? "\ud83d\ude34" : isFrustrated ? "\ud83d\ude24" : isCollab ? "\ud83e\udd1d" : agent.emoji}
            </div>

            {/* Prop under character */}
            <div className="text-sm mt-0.5 text-center opacity-60">
              {isWorking ? "\ud83d\udcbb" : isSleeping ? "\ud83d\udecf\ufe0f" : isFrustrated ? "\ud83d\udd34" : isIdle ? "\u2615" : "\ud83d\udcac"}
            </div>
          </div>

          {/* Name plate */}
          <div className="mt-2 text-center">
            <div className="text-xs font-bold leading-tight" style={{ color: agent.color }}>
              {agent.name}
            </div>
            <div className="text-[10px] text-zinc-500 leading-tight">{agent.role}</div>
          </div>
        </div>

        {/* Progress bar at bottom */}
        {isWorking && agent.progressPct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800 rounded-b-xl overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-1000"
              style={{ width: `${agent.progressPct}%` }} />
          </div>
        )}

        {/* Collab pulse ring */}
        {isCollab && (
          <div className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ animation: "collabPulse 2s infinite" }} />
        )}
      </div>

      {/* Score badge below desk */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800/90 border border-zinc-600 text-[10px] font-mono text-zinc-300 whitespace-nowrap backdrop-blur z-20">
        {agent.score > 0 ? `⭐ ${agent.score}` : agent.title}
        {agent.activeCrons > 0 && (
          <span className="text-zinc-500">
            · {agent.activeCrons}⏱
            {agent.erroredCrons > 0 && (
              <span className="text-red-400 ml-0.5">{agent.erroredCrons}❌</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

// ========== COLLABORATION LINES (SVG) ==========
function CollabLines({ collaborations, agentPositions }: {
  collaborations: Collaboration[]; agentPositions: Map<string, { x: number; y: number }>;
}) {
  if (collaborations.length === 0) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none z-10 w-full h-full overflow-visible">
      <defs>
        <linearGradient id="collabGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(168, 85, 247, 0.6)" />
          <stop offset="100%" stopColor="rgba(59, 130, 246, 0.6)" />
        </linearGradient>
      </defs>
      {collaborations.map((c, i) => {
        const from = agentPositions.get(c.agents[0]);
        const to = agentPositions.get(c.agents[1]);
        if (!from || !to) return null;
        return (
          <g key={i}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="url(#collabGrad)" strokeWidth="2" strokeDasharray="8 4" opacity="0.6">
              <animate attributeName="stroke-dashoffset" values="0;24" dur="2s" repeatCount="indefinite" />
            </line>
            <circle cx={(from.x + to.x) / 2} cy={(from.y + to.y) / 2} r="5" fill="rgba(168,85,247,0.7)">
              <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

// ========== COMMS FEED WITH SCROLLBAR ==========
function CommsFeed({ messages, agents, searchQuery }: {
  messages: CommMessage[]; agents: OfficeAgent[]; searchQuery: string;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [prevCount, setPrevCount] = useState(messages.length);
  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  // Auto-scroll only when at bottom
  useEffect(() => {
    if (messages.length > prevCount && isAtBottom && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
    setPrevCount(messages.length);
  }, [messages.length, isAtBottom, prevCount]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 40);
  };

  const scrollToBottom = () => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  };

  // Filter messages by search
  const filtered = searchQuery
    ? messages.filter((m) =>
        m.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.from.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  return (
    <div className="relative flex flex-col h-full">
      <div ref={feedRef} onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 scroll-smooth"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#52525b #18181b" }}>
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-8">
            {searchQuery ? "No messages match your search" : "No agent comms yet..."}
          </div>
        )}
        {filtered.map((msg) => {
          const style = MSG_STYLES[msg.type] || MSG_STYLES.info;
          const fromAgent = agentMap[msg.from];
          const toAgent = agentMap[msg.to];
          const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const isRut = msg.from === "rut";

          return (
            <div key={msg.id}
              className={`flex gap-2 items-start rounded-lg px-2 py-1.5 mb-1 transition-colors ${style.bg} hover:bg-zinc-800/60`}>
              <span className="text-sm shrink-0 mt-0.5">{isRut ? "\ud83d\udc54" : style.label}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs font-bold"
                    style={{ color: isRut ? "#FBBF24" : fromAgent?.color || "#888" }}>
                    {isRut ? "Rut" : fromAgent?.name || msg.from}
                  </span>
                  {msg.to !== "all" && (
                    <>
                      <span className="text-[10px] text-zinc-500">{"\u2192"}</span>
                      <span className="text-xs font-medium" style={{ color: toAgent?.color || "#888" }}>
                        {msg.to === "council" ? "Council" : toAgent?.name || msg.to}
                      </span>
                    </>
                  )}
                  <span className="text-[10px] text-zinc-600 ml-auto">{time}</span>
                </div>
                <p className={`text-xs ${style.color} leading-snug mt-0.5 break-words`}>{msg.message}</p>
                {msg.context && (
                  <span className="text-[9px] text-zinc-600 mt-0.5 block">{msg.context}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <button onClick={scrollToBottom}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-medium shadow-lg hover:bg-primary transition-all z-20">
          <ChevronDown className="w-3 h-3" />
          New messages
        </button>
      )}
    </div>
  );
}

// ========== LEADERBOARD ==========
function Leaderboard({ agents }: { agents: OfficeAgent[] }) {
  const medals = ["\ud83e\udd47", "\ud83e\udd48", "\ud83e\udd49"];

  return (
    <div className="flex flex-col gap-1 px-3 py-2 overflow-y-auto h-full"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#52525b #18181b" }}>
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-bold text-foreground">Leaderboard</span>
      </div>
      {agents.map((agent, i) => (
        <div key={agent.id}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
            i === 0 && agent.score > 0 ? "bg-yellow-500/10 border border-yellow-500/30" : "hover:bg-zinc-800/50"
          }`}>
          <span className="text-sm w-6 text-center">
            {i < 3 && agent.score > 0 ? medals[i] : `#${i + 1}`}
          </span>
          <span className="text-xs font-semibold flex-1" style={{ color: agent.color }}>
            {agent.emoji} {agent.name}
          </span>
          <div className="text-right">
            <div className="text-xs font-mono text-foreground">{agent.score}</div>
            {agent.revenue > 0 && (
              <div className="text-[10px] text-green-400 font-mono">${agent.revenue.toFixed(2)}</div>
            )}
          </div>
          {agent.streak >= 3 && <span className="text-xs">{"\ud83d\udd25"}</span>}
        </div>
      ))}
      <div className="mt-3 pt-2 border-t border-zinc-700">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Total Revenue</span>
          <span className="font-mono text-green-400">${agents.reduce((s, a) => s + a.revenue, 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-muted-foreground">Total Score</span>
          <span className="font-mono text-foreground">{agents.reduce((s, a) => s + a.score, 0)}</span>
        </div>
      </div>
    </div>
  );
}

// ========== AGENT DETAIL PANEL (FULL TABBED VIEW) ==========
function AgentDetail({ agent, onClose }: { agent: OfficeAgent; onClose: () => void }) {
  const [tab, setTab] = useState<"overview" | "skills" | "tasks" | "files">("overview");

  const stateLabel = agent.visualState === "working" ? "⌨️ Grinding"
    : agent.visualState === "sleeping" ? "😴 Asleep"
    : agent.visualState === "collaborating" ? "🤝 Collaborating"
    : agent.visualState === "frustrated" ? "😤 Blocked"
    : "☕ Idle";

  const stateColor = agent.visualState === "working" ? "text-green-400"
    : agent.visualState === "sleeping" ? "text-zinc-500"
    : agent.visualState === "collaborating" ? "text-purple-400"
    : agent.visualState === "frustrated" ? "text-red-400"
    : "text-yellow-400";

  // Format capability name for display
  const formatCap = (c: string) => c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  const formatModel = (m: string) => {
    if (m.includes("/")) return m.split("/").pop() || m;
    return m;
  };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Activity },
    { id: "skills" as const, label: "Skills", icon: Brain },
    { id: "tasks" as const, label: `Tasks (${agent.cronJobs.length})`, icon: Clock },
    { id: "files" as const, label: `Files (${agent.files.length})`, icon: FileText },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 bg-zinc-900/98 backdrop-blur-xl border-t border-zinc-700 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{ maxHeight: "65vh", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-zinc-800 shrink-0">
        <div className="text-4xl">{agent.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg" style={{ color: agent.color }}>{agent.name}</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700">{agent.role}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700 ${stateColor}`}>{stateLabel}</span>
            {agent.performanceScore > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
                {Math.round(agent.performanceScore * 100)}% perf
              </span>
            )}
          </div>
          <div className="flex gap-4 mt-1 text-xs flex-wrap">
            <span className="text-foreground font-mono">🏆 {agent.score} pts</span>
            <span className="text-green-400 font-mono">💰 ${agent.revenue.toFixed(2)}</span>
            <span className="text-foreground">🏅 {agent.title}</span>
            {agent.streak >= 3 && <span>🔥 {agent.streak} streak</span>}
            <span className="text-zinc-500">Updated {agent.minutesSinceUpdate}m ago</span>
            <span className="text-zinc-600 font-mono text-[10px]">🤖 {formatModel(agent.model)}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-foreground p-1 rounded-lg hover:bg-zinc-800 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 shrink-0 px-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === t.id ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground hover:border-zinc-600"
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#52525b #18181b" }}>

        {/* ===== OVERVIEW TAB ===== */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Current Task */}
            {agent.currentTask && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                <span className="text-sm mt-0.5">📋</span>
                <div>
                  <div className="text-[10px] text-green-500 font-semibold uppercase tracking-wider">Current Task</div>
                  <p className="text-sm text-zinc-200 mt-0.5">{agent.currentTask}</p>
                  {agent.progressPct > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${agent.progressPct}%` }} />
                      </div>
                      <span className="text-[10px] text-green-400 font-mono">{agent.progressPct}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {agent.error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Error</div>
                  <p className="text-xs text-red-300 mt-0.5">{agent.error}</p>
                </div>
              </div>
            )}

            {/* Next Action */}
            {agent.nextAction && (
              <div className="flex items-start gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Next Action</div>
                  <p className="text-xs text-zinc-300 mt-0.5">{agent.nextAction}</p>
                </div>
              </div>
            )}

            {/* Org Chart */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Reports To</div>
                <div className="text-sm text-zinc-200 mt-1 capitalize">{agent.reportsTo}</div>
              </div>
              {agent.manages.length > 0 && (
                <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                  <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Manages</div>
                  <div className="text-sm text-zinc-200 mt-1 capitalize">{agent.manages.join(", ")}</div>
                </div>
              )}
              {agent.memberOf.length > 0 && (
                <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                  <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Member Of</div>
                  <div className="text-sm text-zinc-200 mt-1 capitalize">{agent.memberOf.join(", ").replace(/_/g, " ")}</div>
                </div>
              )}
            </div>

            {/* Completed This Session */}
            {agent.completedThisSession.length > 0 && (
              <div>
                <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">Completed This Session</div>
                <div className="space-y-1">
                  {agent.completedThisSession.slice(0, 8).map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                  {agent.completedThisSession.length > 8 && (
                    <span className="text-[10px] text-zinc-600">+{agent.completedThisSession.length - 8} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Last Message */}
            {agent.lastMessage && (
              <div className="text-xs text-zinc-400 italic border-l-2 border-zinc-700 pl-3 py-1">
                &ldquo;{agent.lastMessage}&rdquo;
              </div>
            )}
          </div>
        )}

        {/* ===== SKILLS TAB ===== */}
        {tab === "skills" && (
          <div className="space-y-5">
            {/* Capabilities */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-zinc-200">Capabilities ({agent.capabilities.length})</span>
                {agent.capabilities.length > 10 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                    ⚠️ &gt;10 skills — fragmentation risk
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {agent.capabilities.map((cap) => (
                  <span key={cap} className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                    {formatCap(cap)}
                  </span>
                ))}
              </div>
            </div>

            {/* Tools */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-zinc-200">Tools ({agent.tools.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {agent.tools.map((tool) => (
                  <span key={tool} className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                    {formatCap(tool)}
                  </span>
                ))}
              </div>
            </div>

            {/* Limitations */}
            {agent.limitations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-bold text-zinc-200">Limitations ({agent.limitations.length})</span>
                </div>
                <div className="space-y-1.5">
                  {agent.limitations.map((lim) => (
                    <div key={lim} className="flex items-center gap-2 text-xs text-orange-300/80">
                      <span className="text-orange-500">⊘</span>
                      {formatCap(lim)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tech Stack (if agent has one) */}
            {agent.techStack && (
              <div>
                <div className="text-xs font-bold text-zinc-200 mb-2">Tech Stack</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(agent.techStack).map(([cat, items]) => (
                    <div key={cat} className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{cat}</div>
                      <div className="flex flex-wrap gap-1">
                        {items.map((item) => (
                          <span key={item} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-300">
                            {item.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Parameters (for Rak) */}
            {agent.riskParameters && (
              <div>
                <div className="text-xs font-bold text-zinc-200 mb-2">Risk Parameters</div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(agent.riskParameters).map(([key, val]) => (
                    <div key={key} className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-center">
                      <div className="text-[10px] text-zinc-500 capitalize">{key.replace(/_/g, " ")}</div>
                      <div className="text-sm font-mono text-zinc-200">{typeof val === "number" && key.includes("percent") ? `${val}%` : `$${val}`}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Calendar (for Ria) */}
            {agent.contentCalendar && (
              <div>
                <div className="text-xs font-bold text-zinc-200 mb-2">Content Calendar</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(agent.contentCalendar).map(([day, task]) => (
                    <div key={day} className="flex items-center gap-2 text-xs p-1.5 rounded bg-zinc-800/50">
                      <span className="text-zinc-500 capitalize font-medium w-16">{day}</span>
                      <span className="text-zinc-300">{task.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Model Config */}
            <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">Model Configuration</div>
              <div className="text-xs text-zinc-300 font-mono">{agent.model}</div>
              {agent.fallbackModels.length > 0 && (
                <div className="text-[10px] text-zinc-500 mt-1">
                  Fallbacks: {agent.fallbackModels.map(formatModel).join(" → ")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== TASKS TAB ===== */}
        {tab === "tasks" && (
          <div className="space-y-3">
            {agent.cronJobs.length === 0 ? (
              <div className="text-center text-zinc-500 text-xs py-8">No scheduled tasks for this agent</div>
            ) : (
              <>
                <div className="flex items-center gap-3 text-xs text-zinc-400 mb-2">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> {agent.activeCrons} active</span>
                  {agent.erroredCrons > 0 && (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {agent.erroredCrons} errored</span>
                  )}
                </div>
                {agent.cronJobs.map((job) => (
                  <CronJobCard key={job.name} job={job} agentColor={agent.color} />
                ))}
              </>
            )}
          </div>
        )}

        {/* ===== FILES TAB ===== */}
        {tab === "files" && (
          <div className="space-y-2">
            {agent.files.length === 0 ? (
              <div className="text-center text-zinc-500 text-xs py-8">No associated files found</div>
            ) : (
              agent.files.map((file) => (
                <div key={file} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-colors">
                  <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="text-xs text-zinc-300 font-mono truncate">{file}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== CRON JOB CARD ==========
function CronJobCard({ job, agentColor }: { job: CronJob; agentColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const isError = job.consecutiveErrors > 0;
  const isOk = job.lastStatus === "ok";

  const statusColor = isError ? "text-red-400" : isOk ? "text-green-400" : "text-zinc-500";
  const statusIcon = isError ? "❌" : isOk ? "✅" : "⏳";
  const borderColor = isError ? "border-red-500/20" : "border-zinc-700/50";

  const timeAgo = (iso: string | null) => {
    if (!iso) return "never";
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  return (
    <div className={`rounded-lg bg-zinc-800/40 border ${borderColor} transition-all`}>
      <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-zinc-800/60 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <span className="text-sm">{statusIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-200 truncate">{job.name}</span>
            {!job.enabled && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-500">disabled</span>}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-0.5">
            <span>{job.schedule}</span>
            <span className={statusColor}>Last: {timeAgo(job.lastRunAt)}</span>
            {job.lastDurationMs > 0 && <span>{(job.lastDurationMs / 1000).toFixed(1)}s</span>}
          </div>
        </div>
        {isError && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
            {job.consecutiveErrors} err
          </span>
        )}
        <ChevronRight className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-zinc-700/30 pt-2">
          <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">{job.message}</p>
          <div className="flex gap-3 mt-2 text-[10px] text-zinc-600">
            <span>Timeout: {job.timeoutSeconds}s</span>
            {job.nextRunAt && <span>Next: {timeAgo(job.nextRunAt)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ========== MAIN OFFICE VIEW ==========
export function AgentOffice() {
  const [data, setData] = useState<OfficeData | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCommsCount, setLastCommsCount] = useState(0);
  const [bubbleAgentMsg, setBubbleAgentMsg] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"comms" | "leaderboard">("comms");
  const [commsSearch, setCommsSearch] = useState("");
  const [waking, setWaking] = useState(false);
  const [wakeFlash, setWakeFlash] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/office");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);

      // Trigger speech bubbles for new messages
      if (json.comms?.length > lastCommsCount && json.comms.length > 0) {
        const newMsgs = json.comms.slice(lastCommsCount);
        const bubbles: Record<string, string> = {};
        for (const msg of newMsgs) {
          if (msg.from !== "system" && msg.from !== "rut") {
            bubbles[msg.from] = msg.message;
          }
        }
        if (Object.keys(bubbles).length > 0) {
          setBubbleAgentMsg(bubbles);
          setTimeout(() => setBubbleAgentMsg({}), 6000);
        }
      }
      setLastCommsCount(json.comms?.length || 0);
    } catch (e) {
      setError(String(e));
    }
  }, [lastCommsCount]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const wakeAllAgents = useCallback(async () => {
    setWaking(true);
    try {
      const res = await fetch("/api/office/wake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "CEO hit the WAKE UP button!" }),
      });
      if (res.ok) {
        setWakeFlash(true);
        setTimeout(() => setWakeFlash(false), 2000);
        setTimeout(fetchData, 500);
      }
    } catch (e) {
      console.error("Wake failed:", e);
    } finally {
      setWaking(false);
    }
  }, [fetchData]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <style>{OFFICE_STYLES}</style>
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">{"\ud83c\udfe2"}</div>
          <p className="text-muted-foreground">Loading Agent Office...</p>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  const agentMap = Object.fromEntries(data.agents.map((a) => [a.id, a]));
  const selected = selectedAgent ? agentMap[selectedAgent] : null;

  const workingCount = data.agents.filter((a) => a.visualState === "working").length;
  const sleepingCount = data.agents.filter((a) => a.visualState === "sleeping" || a.visualState === "idle").length;
  const totalScore = data.agents.reduce((s, a) => s + a.score, 0);

  // Approximate positions for collab lines
  const agentGridPositions = new Map<string, { x: number; y: number }>();
  const execIds = ["rip", "rex", "red"];
  const staffIds = ["rio", "ria", "rea"];
  const engIds = ["reg", "rak", "worker"];
  const specialistIds = ["riz", "rox"];

  execIds.forEach((id, i) => agentGridPositions.set(id, { x: 100 + i * 190, y: 140 }));
  staffIds.forEach((id, i) => agentGridPositions.set(id, { x: 100 + i * 190, y: 340 }));
  engIds.forEach((id, i) => agentGridPositions.set(id, { x: 100 + i * 190, y: 540 }));
  specialistIds.forEach((id, i) => agentGridPositions.set(id, { x: 100 + i * 190, y: 740 }));

  return (
    <div className="flex h-full w-full overflow-hidden">
      <style>{OFFICE_STYLES}</style>

      {/* ===== MAIN OFFICE FLOOR ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-zinc-900/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-lg">{"\ud83c\udfe2"}</span>
            <h2 className="font-bold text-foreground">Agent Office</h2>
            <div className="flex items-center gap-1 text-xs text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {/* WAKE UP BUTTON */}
            <button
              onClick={wakeAllAgents}
              disabled={waking}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                wakeFlash
                  ? "bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                  : waking
                  ? "bg-yellow-500/30 text-yellow-300 cursor-wait"
                  : "bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] border border-red-500/30"
              }`}
            >
              <AlarmClock className={`w-4 h-4 ${waking ? "animate-spin" : ""}`} />
              {wakeFlash ? "WOKE!" : waking ? "WAKING..." : "WAKE UP"}
            </button>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-green-400" />
              {workingCount} working
            </span>
            <span className="flex items-center gap-1">
              <Coffee className="w-3 h-3 text-zinc-400" />
              {sleepingCount} idle
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-purple-400" />
              {data.collaborations.length} collab
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-yellow-400" />
              {totalScore} pts
            </span>
          </div>
        </div>

        {/* Office floor with agents */}
        <div className="flex-1 relative overflow-auto p-6 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900">
          <CollabLines collaborations={data.collaborations} agentPositions={agentGridPositions} />

          {/* Rut CEO badge at top */}
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-yellow-500/15 border border-yellow-500/30">
              <span className="text-sm">{"\ud83d\udc54"}</span>
              <span className="text-xs font-bold text-yellow-400">{"Rut \u00b7 CEO"}</span>
              <span className="text-[10px] text-yellow-500/50">(watching)</span>
            </div>
          </div>

          {/* ===== EXEC COUNCIL ===== */}
          <div className="relative mb-8">
            <div className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-yellow-500/5 via-amber-500/8 to-yellow-500/5 border border-yellow-500/15" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4 ml-2">
                <Crown className="w-4 h-4 text-yellow-400" />
                <span className="text-[11px] font-bold text-yellow-400/90 tracking-wider uppercase">Exec Council</span>
                <div className="flex-1 h-px bg-gradient-to-r from-yellow-500/20 to-transparent" />
              </div>
              <div className="flex gap-8 justify-center flex-wrap">
                {execIds.map((id) => {
                  const agent = agentMap[id];
                  return agent ? (
                    <CartoonAgent key={id} agent={agent}
                      isSelected={selectedAgent === id}
                      onClick={() => setSelectedAgent(selectedAgent === id ? null : id)}
                      bubbleText={bubbleAgentMsg[id] || null} />
                  ) : null;
                })}
              </div>
            </div>
          </div>

          {/* ===== STAFF ===== */}
          <div className="relative mb-8 mt-10">
            <div className="flex items-center gap-2 mb-4 ml-2">
              <Coffee className="w-3.5 h-3.5 text-pink-400/70" />
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">Staff</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <div className="flex gap-8 justify-center flex-wrap">
              {staffIds.map((id) => {
                const agent = agentMap[id];
                return agent ? (
                  <CartoonAgent key={id} agent={agent}
                    isSelected={selectedAgent === id}
                    onClick={() => setSelectedAgent(selectedAgent === id ? null : id)}
                    bubbleText={bubbleAgentMsg[id] || null} />
                ) : null;
              })}
            </div>
          </div>

          {/* ===== ENGINEERS ===== */}
          <div className="relative mb-8">
            <div className="flex items-center gap-2 mb-4 ml-2">
              <Zap className="w-3.5 h-3.5 text-emerald-400/70" />
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">Engineers</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <div className="flex gap-8 justify-center flex-wrap">
              {engIds.map((id) => {
                const agent = agentMap[id];
                return agent ? (
                  <CartoonAgent key={id} agent={agent}
                    isSelected={selectedAgent === id}
                    onClick={() => setSelectedAgent(selectedAgent === id ? null : id)}
                    bubbleText={bubbleAgentMsg[id] || null} />
                ) : null;
              })}
            </div>
          </div>

          {/* ===== SPECIALISTS ===== */}
          <div className="relative mb-8">
            <div className="flex items-center gap-2 mb-4 ml-2">
              <Shield className="w-3.5 h-3.5 text-cyan-400/70" />
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">Specialists</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <div className="flex gap-8 justify-center flex-wrap">
              {specialistIds.map((id) => {
                const agent = agentMap[id];
                return agent ? (
                  <CartoonAgent key={id} agent={agent}
                    isSelected={selectedAgent === id}
                    onClick={() => setSelectedAgent(selectedAgent === id ? null : id)}
                    bubbleText={bubbleAgentMsg[id] || null} />
                ) : null;
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 justify-center mt-4 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Working</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Idle</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-600" /> Asleep</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> Collab</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Blocked</span>
          </div>

          {/* Agent detail panel (click to expand) */}
          {selected && <AgentDetail agent={selected} onClose={() => setSelectedAgent(null)} />}
        </div>
      </div>

      {/* ===== SIDEBAR ===== */}
      <div className="w-80 border-l border-border bg-zinc-900/80 backdrop-blur flex flex-col shrink-0">
        {/* Tab switcher */}
        <div className="flex border-b border-border">
          <button onClick={() => setActiveTab("comms")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "comms" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            <MessageSquare className="w-3.5 h-3.5" />
            Comms
            {data.comms.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">
                {data.comms.length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab("leaderboard")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "leaderboard" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Trophy className="w-3.5 h-3.5" />
            Board
          </button>
        </div>

        {/* Search bar for comms */}
        {activeTab === "comms" && (
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
              <Search className="w-3.5 h-3.5 text-zinc-500" />
              <input type="text" placeholder="Search comms history..."
                value={commsSearch} onChange={(e) => setCommsSearch(e.target.value)}
                className="flex-1 bg-transparent text-xs text-foreground placeholder-zinc-500 outline-none" />
              {commsSearch && (
                <button onClick={() => setCommsSearch("")} className="text-zinc-500 hover:text-foreground text-xs">{"\u2715"}</button>
              )}
            </div>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "comms" ? (
            <CommsFeed messages={data.comms} agents={data.agents} searchQuery={commsSearch} />
          ) : (
            <Leaderboard agents={data.leaderboard} />
          )}
        </div>
      </div>
    </div>
  );
}
