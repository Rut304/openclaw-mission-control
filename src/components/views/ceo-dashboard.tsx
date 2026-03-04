"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Bot,
  Rocket,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  RefreshCw,
  Loader2,
  Wallet,
  Zap,
  MessageSquare,
  GitBranch,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Plus,
  Trash2,
  Crown,
  Users,
  Share2,
  Target,
  Newspaper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// ============================================================
// T Y P E S
// ============================================================

interface AgentStatus {
  id: string;
  name: string;
  status: "active" | "idle" | "error" | "working" | "blocked";
  model?: string;
  lastActivity?: string;
  currentTask?: string;
  tokenUsage?: number;
  cost?: number;
  progressPct?: number;
}

interface CostMetric {
  provider: string;
  model: string;
  cost: number;
  tokens: number;
  requests: number;
}

interface KalshiPosition {
  ticker: string;
  contracts: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
}

interface ActivityItem {
  id: string;
  type: string;
  agent: string;
  message: string;
  time: string;
}

interface Priority {
  id: string;
  text: string;
  setBy: string;
  overriddenBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SocialPlatform {
  name: string;
  handle: string;
  followers: number;
  posts: number;
  engagement: number;
  trend: "up" | "down" | "flat";
  icon: string;
  color: string;
}

// ============================================================
// S U B - C O M P O N E N T S
// ============================================================

function SparkBars({ data, color = "bg-primary" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-t ${color} opacity-80`}
          style={{ height: `${Math.max((v / max) * 100, 4)}%` }}
        />
      ))}
    </div>
  );
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor,
  sparkData,
  onClick,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "flat";
  accentColor?: string;
  sparkData?: number[];
  onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 transition-all ${
        onClick ? "cursor-pointer hover:ring-2 hover:ring-primary/40 hover:shadow-lg" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentColor || "bg-primary/10"}`}>
          <Icon className={`w-3.5 h-3.5 ${accentColor ? "text-white" : "text-primary"}`} />
        </div>
      </div>
      <div className="text-2xl font-bold font-mono tracking-tight">{value}</div>
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {trend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
          {trend === "down" && <TrendingDown className="w-3 h-3 text-red-400" />}
          {trend === "flat" && <Minus className="w-3 h-3" />}
          <span>{subtitle}</span>
        </div>
        {sparkData && <SparkBars data={sparkData} color={accentColor || "bg-primary"} />}
      </div>
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentStatus }) {
  const statusConfig: Record<string, { dot: string; label: string }> = {
    active: { dot: "bg-green-500 shadow-[0_0_6px_lime]", label: "Active" },
    working: { dot: "bg-green-500 animate-pulse shadow-[0_0_6px_lime]", label: "Working" },
    idle: { dot: "bg-yellow-500", label: "Idle" },
    blocked: { dot: "bg-red-500 animate-pulse", label: "Blocked" },
    error: { dot: "bg-red-500", label: "Error" },
  };
  const s = statusConfig[agent.status] || statusConfig.idle;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/40 transition-colors">
      <div className="relative">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${s.dot}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{agent.name || agent.id}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
            agent.status === "active" || agent.status === "working"
              ? "bg-green-500/10 text-green-500"
              : agent.status === "blocked" || agent.status === "error"
              ? "bg-red-500/10 text-red-400"
              : "bg-yellow-500/10 text-yellow-500"
          }`}>
            {s.label}
          </span>
        </div>
        {agent.currentTask && (
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">{agent.currentTask}</div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-mono text-muted-foreground">${(agent.cost || 0).toFixed(2)}</div>
      </div>
    </div>
  );
}

function PriorityItem({ priority, onDelete }: { priority: Priority; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-start gap-2 group py-1.5">
      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm">{priority.text}</span>
        <span className="text-[10px] text-muted-foreground ml-2">
          — {priority.overriddenBy ? `${priority.overriddenBy} (override)` : priority.setBy}
        </span>
      </div>
      <button
        onClick={() => onDelete(priority.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all shrink-0 mt-0.5"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function ActivityEntry({ item }: { item: ActivityItem }) {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    task_completed: CheckCircle2,
    task_started: Activity,
    error: AlertTriangle,
    message: MessageSquare,
    trade: DollarSign,
    deploy: Rocket,
  };
  const Icon = iconMap[item.type] || Activity;

  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className="w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-2.5 h-2.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] leading-snug">{item.message}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
          <span className="font-mono">{item.agent}</span>
          <span>·</span>
          <span>{item.time}</span>
        </div>
      </div>
    </div>
  );
}

function SocialCard({ platform, onClick }: { platform: SocialPlatform; onClick?: () => void }) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-3 hover:ring-1 hover:ring-primary/30 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{platform.icon}</span>
        <div className="flex items-center gap-1 text-[10px]">
          {platform.trend === "up" && <ArrowUpRight className="w-3 h-3 text-green-500" />}
          {platform.trend === "down" && <ArrowDownRight className="w-3 h-3 text-red-400" />}
          {platform.trend === "flat" && <Minus className="w-3 h-3 text-muted-foreground" />}
        </div>
      </div>
      <div className="font-bold text-sm">{platform.name}</div>
      <div className="text-[10px] text-muted-foreground font-mono">{platform.handle}</div>
      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-border/50">
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Followers</div>
          <div className="text-xs font-mono font-bold">{formatCompact(platform.followers)}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Posts</div>
          <div className="text-xs font-mono font-bold">{platform.posts}</div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Engage</div>
          <div className="text-xs font-mono font-bold">{platform.engagement}%</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// H E L P E R S
// ============================================================

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return date.toLocaleDateString();
}

type ViewId = "overview" | "office" | "board" | "agents" | "missions" | "workflows" | "knowledge" | "tools" | "usage" | "finance" | "models" | "approvals" | "cron" | "logs" | "settings" | "chat" | "news" | "social" | "docs";

// ============================================================
// M A I N   C O M P O N E N T
// ============================================================

export function CEODashboard({ onNavigate }: { onNavigate?: (view: ViewId) => void }) {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [costs, setCosts] = useState<CostMetric[]>([]);
  const [kalshi, setKalshi] = useState<{ balance: number; positions: KalshiPosition[] } | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [newPriority, setNewPriority] = useState("");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [socialPlatforms, setSocialPlatforms] = useState<SocialPlatform[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, costsRes, kalshiRes, statusRes, prioritiesRes, socialRes] =
        await Promise.allSettled([
          fetch("/api/openclaw/status"),
          fetch("/api/costs?period=today"),
          fetch("/api/kalshi?action=overview"),
          fetch("/api/dashboard/status"),
          fetch("/api/ceo-board"),
          fetch("/api/social"),
        ]);

      if (agentsRes.status === "fulfilled") {
        const data = await agentsRes.value.json();
        if (data.sessions) {
          const list: AgentStatus[] = [];
          for (const [key, session] of Object.entries(data.sessions || {})) {
            const s = session as Record<string, unknown>;
            list.push({
              id: key,
              name: (s.name as string) || key.split(":").pop() || key,
              status: s.status === "idle" ? "idle" : s.active ? "active" : "idle",
              model: s.model as string | undefined,
              lastActivity: s.lastActivity as string | undefined,
              currentTask: (s.currentTask || s.task) as string | undefined,
              tokenUsage: (s.tokens as number) || 0,
              cost: (s.cost as number) || 0,
              progressPct: (s.progress as number) || 0,
            });
          }
          setAgents(list);
        }
      }

      if (costsRes.status === "fulfilled") {
        const data = await costsRes.value.json();
        if (data.breakdown) {
          setCosts(data.breakdown);
          setTotalCost(data.totalCost || 0);
        }
      }

      if (kalshiRes.status === "fulfilled") {
        const data = await kalshiRes.value.json();
        if (data.balance) {
          setKalshi({
            balance: data.balance.availableBalance || 0,
            positions: data.positions || [],
          });
        }
      }

      if (statusRes.status === "fulfilled") {
        const data = await statusRes.value.json();
        if (data.activities) {
          setActivities(
            data.activities.slice(0, 15).map((a: Record<string, unknown>) => ({
              id: a.id as string,
              type: a.type as string,
              agent: (a.agent_id as string) || "system",
              message: a.message as string,
              time: formatTime(a.created_at as string),
            }))
          );
        }
      }

      if (prioritiesRes.status === "fulfilled") {
        const data = await prioritiesRes.value.json();
        setPriorities(data.priorities || []);
      }

      if (socialRes.status === "fulfilled") {
        const data = await socialRes.value.json();
        const platforms: SocialPlatform[] = [];
        if (data.metrics) {
          const m = data.metrics;
          if (m.x) platforms.push({ name: "X / Twitter", handle: "@RohRut_AI", followers: m.x.followers || 0, posts: m.x.totalPosts || 0, engagement: m.x.engagement || 0, trend: "up", icon: "\ud835\udd4f", color: "bg-black" });
          if (m.youtube) platforms.push({ name: "YouTube", handle: "8 Channels", followers: m.youtube.subscribers || 0, posts: m.youtube.videos || 0, engagement: m.youtube.engagement || 0, trend: "up", icon: "\u25b6\ufe0f", color: "bg-red-600" });
          if (m.tiktok) platforms.push({ name: "TikTok", handle: "@rutroh", followers: m.tiktok.followers || 0, posts: m.tiktok.videos || 0, engagement: m.tiktok.engagement || 0, trend: "flat", icon: "\ud83c\udfb5", color: "bg-black" });
          if (m.substack) platforms.push({ name: "Substack", handle: "rutroh.org", followers: m.substack.subscribers || 0, posts: m.substack.posts || 0, engagement: m.substack.engagement || 0, trend: "up", icon: "\ud83d\udcf0", color: "bg-orange-500" });
        }
        if (platforms.length === 0) {
          platforms.push(
            { name: "X / Twitter", handle: "@RohRut_AI", followers: 0, posts: data.x?.length || 0, engagement: 0, trend: "flat", icon: "\ud835\udd4f", color: "bg-black" },
            { name: "YouTube", handle: "8 Channels", followers: 0, posts: data.youtube?.length || 0, engagement: 0, trend: "flat", icon: "\u25b6\ufe0f", color: "bg-red-600" },
            { name: "TikTok", handle: "@rutroh", followers: 0, posts: data.tiktok?.length || 0, engagement: 0, trend: "flat", icon: "\ud83c\udfb5", color: "bg-black" },
            { name: "Substack", handle: "rutroh.org", followers: 0, posts: data.substack?.length || 0, engagement: 0, trend: "flat", icon: "\ud83d\udcf0", color: "bg-orange-500" },
          );
        }
        setSocialPlatforms(platforms);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const addPriority = async () => {
    if (!newPriority.trim()) return;
    try {
      await fetch("/api/ceo-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newPriority.trim(), setBy: "rut" }),
      });
      setNewPriority("");
      fetchData();
    } catch { /* swallow */ }
  };

  const deletePriority = async (id: string) => {
    try {
      await fetch("/api/ceo-board", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchData();
    } catch { /* swallow */ }
  };

  const netProfit = totalRevenue - totalCost;
  const kalshiPnL = kalshi?.positions.reduce((sum, p) => sum + p.pnl, 0) || 0;
  const activeAgents = agents.filter((a) => a.status === "active" || a.status === "working").length;
  const totalAgentCost = agents.reduce((sum, a) => sum + (a.cost || 0), 0);

  const revenueSpark = [2, 5, 3, 8, 6, 12, 9, 15, 11, 18, 14, 20];
  const costSpark = [3, 4, 5, 3, 6, 4, 7, 5, 8, 6, 7, 5];
  const profitSpark = revenueSpark.map((r, i) => Math.max(r - costSpark[i], 0));
  const kalshiSpark = [10, 12, 8, 15, 11, 18, 14, 20, 16, 22, 19, 25];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading command center...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Crown className="w-6 h-6 text-primary" />
              Rut&apos;s Home
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time command center &mdash; {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 font-mono text-xs">
              <div className={`w-1.5 h-1.5 rounded-full ${activeAgents > 0 ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
              {activeAgents}/{agents.length} agents
            </Badge>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* KPI ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Today&apos;s Revenue"
            value={`$${totalRevenue.toFixed(2)}`}
            subtitle={totalRevenue > 0 ? "From all sources" : "Build it up!"}
            icon={DollarSign}
            trend={totalRevenue > 0 ? "up" : "flat"}
            accentColor="bg-green-500"
            sparkData={revenueSpark}
            onClick={() => onNavigate?.("finance")}
          />
          <KPICard
            title="API Costs"
            value={`$${totalCost.toFixed(2)}`}
            subtitle={`${costs.length} providers`}
            icon={Zap}
            trend={totalCost > 10 ? "down" : "flat"}
            accentColor="bg-orange-500"
            sparkData={costSpark}
            onClick={() => onNavigate?.("finance")}
          />
          <KPICard
            title="Net Profit"
            value={`${netProfit >= 0 ? "" : "-"}$${Math.abs(netProfit).toFixed(2)}`}
            subtitle={netProfit >= 0 ? "In the green" : "Investing phase"}
            icon={BarChart3}
            trend={netProfit >= 0 ? "up" : "down"}
            accentColor={netProfit >= 0 ? "bg-blue-500" : "bg-red-500"}
            sparkData={profitSpark}
            onClick={() => onNavigate?.("finance")}
          />
          <KPICard
            title="Kalshi Balance"
            value={`$${(kalshi?.balance || 0).toFixed(2)}`}
            subtitle={`P&L: ${kalshiPnL >= 0 ? "+" : ""}$${kalshiPnL.toFixed(2)}`}
            icon={Wallet}
            trend={kalshiPnL >= 0 ? "up" : "down"}
            accentColor="bg-purple-500"
            sparkData={kalshiSpark}
            onClick={() => onNavigate?.("finance")}
          />
        </div>

        {/* MAIN 3-COL GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Priority Board + Social */}
          <div className="space-y-6">
            <div className="rounded-xl border border-primary/20 bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Priority Board
                </h2>
                <Badge variant="outline" className="text-[10px]">{priorities.length} active</Badge>
              </div>
              <div className="space-y-0.5 mb-3">
                {priorities.length > 0 ? (
                  priorities.map((p) => <PriorityItem key={p.id} priority={p} onDelete={deletePriority} />)
                ) : (
                  <p className="text-xs text-muted-foreground py-3 text-center">
                    No active priorities. Add one below or Rip will set them.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Add priority..."
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPriority()}
                />
                <Button size="sm" onClick={addPriority} disabled={!newPriority.trim()}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div>
              <div
                className="flex items-center justify-between mb-3 cursor-pointer hover:text-primary transition-colors"
                onClick={() => onNavigate?.("social")}
              >
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Social Channels
                </h2>
                <span className="text-[10px] text-muted-foreground hover:text-primary">View all &rarr;</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {socialPlatforms.map((p) => (
                  <SocialCard key={p.name} platform={p} onClick={() => onNavigate?.("social")} />
                ))}
              </div>
            </div>
          </div>

          {/* CENTER: Agent Team + Costs */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-4">
              <div
                className="flex items-center justify-between mb-3 cursor-pointer hover:text-primary transition-colors"
                onClick={() => onNavigate?.("office")}
              >
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Agent Team
                </h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {activeAgents} working
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">&rarr;</span>
                </div>
              </div>
              <ScrollArea className="h-[280px]">
                <div className="space-y-0.5">
                  {agents.length > 0 ? (
                    agents
                      .sort((a, b) => {
                        const order: Record<string, number> = { working: 0, active: 1, idle: 2, blocked: 3, error: 4 };
                        return (order[a.status] ?? 5) - (order[b.status] ?? 5);
                      })
                      .map((agent) => <AgentRow key={agent.id} agent={agent} />)
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No agents connected</p>
                  )}
                </div>
              </ScrollArea>
              <div className="pt-3 mt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Total agent cost today</span>
                <span className="font-mono font-bold text-foreground">${totalAgentCost.toFixed(2)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div
                className="flex items-center justify-between mb-3 cursor-pointer hover:text-primary transition-colors"
                onClick={() => onNavigate?.("finance")}
              >
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Top Costs
                </h2>
                <Badge variant="secondary" className="text-[10px]">${totalCost.toFixed(2)}</Badge>
              </div>
              <div className="space-y-2">
                {costs.length > 0 ? (
                  costs.slice(0, 5).map((cost, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono text-muted-foreground w-4">{i + 1}.</span>
                        <span className="text-sm truncate">{cost.model.split("/").pop()}</span>
                      </div>
                      <span className="text-sm font-mono font-bold shrink-0">${cost.cost.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">No cost data yet</p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Activity + Kalshi */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-4">
              <div
                className="flex items-center justify-between mb-3 cursor-pointer hover:text-primary transition-colors"
                onClick={() => onNavigate?.("logs")}
              >
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Live Activity
                </h2>
                <Badge variant="secondary" className="text-[10px]">{activities.length} events</Badge>
              </div>
              <ScrollArea className="h-[280px]">
                <div className="divide-y divide-border/30">
                  {activities.length > 0 ? (
                    activities.map((item) => <ActivityEntry key={item.id} item={item} />)
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">Waiting for activity...</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-purple-400" />
                Kalshi Trading
              </h2>
              {kalshi && kalshi.positions.length > 0 ? (
                <div className="space-y-2">
                  {kalshi.positions.slice(0, 5).map((pos, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{pos.ticker}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {pos.contracts} @ ${(pos.avgPrice ?? 0).toFixed(2)}
                        </div>
                      </div>
                      <div className={`text-sm font-mono font-bold ${(pos.pnl ?? 0) >= 0 ? "text-green-500" : "text-red-400"}`}>
                        {(pos.pnl ?? 0) >= 0 ? "+" : ""}${(pos.pnl ?? 0).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Total P&L</span>
                    <span className={`font-mono font-bold ${kalshiPnL >= 0 ? "text-green-500" : "text-red-400"}`}>
                      {kalshiPnL >= 0 ? "+" : ""}${kalshiPnL.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No active positions</p>
              )}
            </div>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/50">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-2">Quick:</span>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={() => onNavigate?.("office")}>
            <Bot className="w-3.5 h-3.5" /> Agents
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={() => onNavigate?.("missions")}>
            <Rocket className="w-3.5 h-3.5" /> Missions
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={() => onNavigate?.("cron")}>
            <Clock className="w-3.5 h-3.5" /> Schedules
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={() => onNavigate?.("chat")}>
            <MessageSquare className="w-3.5 h-3.5" /> Chat
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={() => onNavigate?.("news")}>
            <Newspaper className="w-3.5 h-3.5" /> News
          </Button>
        </div>
      </div>
    </div>
  );
}
