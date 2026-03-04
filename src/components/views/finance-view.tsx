"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Loader2,
  Wallet,
  BarChart3,
  CreditCard,
  Zap,
  ArrowDownRight,
  ArrowUpRight,
  Server,
  Activity,
  PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// Types
interface Expense {
  id: string;
  category: string;
  name: string;
  amount: number;
  date: string;
  recurring: number;
  recurring_interval: string | null;
  notes: string;
}

interface KalshiSettlement {
  ticker: string;
  marketResult: string;
  yesCount: number;
  noCount: number;
  yesTotalCost: number;
  noTotalCost: number;
  revenue: number;
  totalCost: number;
  profit: number;
  settledTime: string;
}

interface KalshiPosition {
  ticker: string;
  yesContracts: number;
  noContracts: number;
  avgPrice: number;
  pnl: number;
}

interface KalshiFill {
  id: string;
  ticker: string;
  side: string;
  action: string;
  count: number;
  price: number;
  createdTime: string;
}

interface PnLSummary {
  totalRevenue: number;
  totalExpenses: number;
  netPnL: number;
  revenueBySource: Record<string, number>;
  expensesByCategory: Record<string, number>;
}

interface ApiPlan {
  plan: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  requestsPerMinute: number;
  monthlyBudget: number;
  currentSpend: number;
}

interface KalshiData {
  balance: { availableBalance: number; totalBalance: number; portfolioValue: number };
  positions: KalshiPosition[];
  fills: KalshiFill[];
  settlements: KalshiSettlement[];
  settledPnL: number;
  openPnL: number;
  totalPnL: number;
  tradeCount: number;
  error?: string;
}

interface FinanceData {
  pnl: PnLSummary | null;
  expenses: Expense[];
  apiPlan: ApiPlan | null;
  kalshi: KalshiData | null;
  loading: boolean;
  error: string | null;
}

// Formatters
function fmt(n: number): string {
  return n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`;
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

// -- Stat Card --
function StatCard({
  title, value, subtitle,
  icon: Icon, trend, accentColor,
}: {
  title: string; value: string; subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "flat"; accentColor?: string;
}) {
  return (
    <div className="glass-panel rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
        <div className={`w-8 h-8 rounded flex items-center justify-center ${accentColor || "bg-primary/10"}`}>
          <Icon className={`w-4 h-4 ${accentColor ? "text-white" : "text-primary"}`} />
        </div>
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      {subtitle && (
        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
          {trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-green-500" />}
          {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          {trend === "flat" && <Minus className="w-3.5 h-3.5" />}
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
}

// -- Category Badge --
function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    subscription: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    hardware: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    api_credits: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    hosting: "bg-green-500/10 text-green-400 border-green-500/20",
    other: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[category] || colors.other}`}>
      {category.replace("_", " ").toUpperCase()}
    </Badge>
  );
}

// ================================
// Main Finance P&L View
// ================================
export function FinanceView() {
  const [data, setData] = useState<FinanceData>({
    pnl: null, expenses: [], apiPlan: null, kalshi: null, loading: true, error: null
  });
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "kalshi" | "usage">("overview");

  const fetchData = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true, error: null }));
    try {
      const [pnlRes, expRes, kalshiRes, usageRes] = await Promise.allSettled([
        fetch("/api/finance?view=pnl"),
        fetch("/api/finance?view=expenses"),
        fetch("/api/finance?view=kalshi"),
        fetch("/api/finance?view=usage"),
      ]);

      const pnl = pnlRes.status === "fulfilled" ? await pnlRes.value.json() : null;
      const exp = expRes.status === "fulfilled" ? await expRes.value.json() : { expenses: [] };
      const kal = kalshiRes.status === "fulfilled" ? await kalshiRes.value.json() : null;
      const usg = usageRes.status === "fulfilled" ? await usageRes.value.json() : null;

      setData({
        pnl,
        expenses: exp.expenses || [],
        apiPlan: usg?.planInfo || null,
        kalshi: kal,
        loading: false,
        error: null,
      });
    } catch (err) {
      setData(prev => ({ ...prev, loading: false, error: String(err) }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (data.loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const pnl = data.pnl;
  const kalshi = data.kalshi;
  const kalshiPnL = kalshi?.totalPnL || 0;
  const grandNetPnL = (pnl?.netPnL || 0) + kalshiPnL;

  return (
    <div className="flex-1 overflow-auto min-h-0 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial P&L</h1>
          <p className="text-sm text-muted-foreground">
            RutRoh Inc — Complete financial picture
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(["overview", "expenses", "kalshi", "usage"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ============ OVERVIEW TAB ============ */}
      {activeTab === "overview" && (
        <>
          {/* Top Stats */}
          <div className="grid grid-cols-5 gap-4">
            <StatCard
              title="Total Revenue"
              value={fmt(pnl?.totalRevenue || 0)}
              subtitle="All sources"
              icon={TrendingUp}
              trend={(pnl?.totalRevenue || 0) > 0 ? "up" : "flat"}
              accentColor="bg-green-500"
            />
            <StatCard
              title="Total Expenses"
              value={fmt(pnl?.totalExpenses || 0)}
              subtitle={`${data.expenses.length} entries`}
              icon={CreditCard}
              trend="down"
              accentColor="bg-red-500"
            />
            <StatCard
              title="Net P&L"
              value={fmt(grandNetPnL)}
              subtitle={grandNetPnL >= 0 ? "Profit" : "Loss"}
              icon={BarChart3}
              trend={grandNetPnL >= 0 ? "up" : "down"}
              accentColor={grandNetPnL >= 0 ? "bg-blue-500" : "bg-red-500"}
            />
            <StatCard
              title="Kalshi P&L"
              value={fmt(kalshiPnL)}
              subtitle={`${kalshi?.tradeCount || 0} trades`}
              icon={Wallet}
              trend={kalshiPnL >= 0 ? "up" : "down"}
              accentColor="bg-purple-500"
            />
            <StatCard
              title="Kalshi Balance"
              value={fmt(kalshi?.balance?.availableBalance || 0)}
              subtitle={`Portfolio: ${fmt(kalshi?.balance?.portfolioValue || 0)}`}
              icon={DollarSign}
              trend="flat"
              accentColor="bg-indigo-500"
            />
          </div>

          {/* Two-Column: Expense Breakdown + Revenue Breakdown */}
          <div className="grid grid-cols-2 gap-6">
            {/* Expense Breakdown by Category */}
            <div className="glass-panel rounded-lg p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Expenses by Category
              </h3>
              <div className="space-y-3">
                {pnl?.expensesByCategory && Object.entries(pnl.expensesByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => {
                    const pct = pnl.totalExpenses > 0 ? (amount / pnl.totalExpenses) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{cat.replace("_", " ")}</span>
                          <span className="font-mono">{fmt(amount)}</span>
                        </div>
                        <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* API Plan Info */}
            <div className="glass-panel rounded-lg p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4" />
                API Subscription Status
              </h3>
              {data.apiPlan && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <Badge>{data.apiPlan.plan}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Input Token Limit</span>
                    <span className="font-mono text-sm">{fmtK(data.apiPlan.inputTokenLimit)} / min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Output Token Limit</span>
                    <span className="font-mono text-sm">{fmtK(data.apiPlan.outputTokenLimit)} / min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Requests/min</span>
                    <span className="font-mono text-sm">{fmtK(data.apiPlan.requestsPerMinute)}</span>
                  </div>
                  <div className="border-t border-border pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Monthly Budget</span>
                      <span className="font-mono text-sm">{fmt(data.apiPlan.monthlyBudget)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-muted-foreground">Current Spend</span>
                      <span className="font-mono text-sm text-orange-400">{fmt(data.apiPlan.currentSpend)}</span>
                    </div>
                    <div className="mt-2">
                      <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full"
                          style={{ width: `${Math.min(100, (data.apiPlan.currentSpend / data.apiPlan.monthlyBudget) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 block">
                        {((data.apiPlan.currentSpend / data.apiPlan.monthlyBudget) * 100).toFixed(1)}% of budget
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Subscription Burn */}
          <div className="glass-panel rounded-lg p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Monthly Recurring Costs
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {data.expenses
                .filter(e => e.recurring === 1)
                .filter((e, i, arr) => arr.findIndex(x => x.name === e.name) === i)
                .sort((a, b) => b.amount - a.amount)
                .map(e => (
                  <div key={e.name} className="p-3 rounded bg-muted/20 border border-border">
                    <div className="text-sm font-medium truncate">{e.name}</div>
                    <div className="text-lg font-mono mt-1">{fmt(e.amount)}<span className="text-xs text-muted-foreground">/mo</span></div>
                    <CategoryBadge category={e.category} />
                  </div>
                ))}
            </div>
            <div className="pt-2 border-t border-border flex justify-between text-sm">
              <span className="text-muted-foreground">Total Monthly Burn</span>
              <span className="font-mono font-bold">
                {fmt(
                  data.expenses
                    .filter(e => e.recurring === 1)
                    .filter((e, i, arr) => arr.findIndex(x => x.name === e.name) === i)
                    .reduce((s, e) => s + e.amount, 0)
                )}
                /mo
              </span>
            </div>
          </div>
        </>
      )}

      {/* ============ EXPENSES TAB ============ */}
      {activeTab === "expenses" && (
        <div className="glass-panel rounded-lg p-5 space-y-4">
          <h3 className="font-semibold">All Expenses</h3>
          <ScrollArea className="h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="p-2">Date</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Category</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.expenses.map(e => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-2 font-mono text-xs">{fmtDate(e.date)}</td>
                    <td className="p-2 font-medium">{e.name}</td>
                    <td className="p-2"><CategoryBadge category={e.category} /></td>
                    <td className="p-2 text-right font-mono text-red-400">{fmt(e.amount)}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">
                        {e.recurring ? "Recurring" : "One-time"}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground truncate max-w-[200px]">
                      {e.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">{data.expenses.length} entries</span>
            <span className="font-mono font-bold">
              Total: {fmt(data.expenses.reduce((s, e) => s + Math.abs(e.amount), 0))}
            </span>
          </div>
        </div>
      )}

      {/* ============ KALSHI TAB ============ */}
      {activeTab === "kalshi" && (
        <div className="space-y-6">
          {kalshi?.error ? (
            <div className="glass-panel rounded-lg p-5 text-center text-orange-400">
              <p>Kalshi API Error: {kalshi.error}</p>
              <p className="text-xs text-muted-foreground mt-1">{(kalshi as any).detail}</p>
            </div>
          ) : (
            <>
              {/* Kalshi Stats */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard
                  title="Available Balance"
                  value={fmt(kalshi?.balance?.availableBalance || 0)}
                  icon={Wallet}
                  accentColor="bg-purple-500"
                />
                <StatCard
                  title="Settled P&L"
                  value={fmt(kalshi?.settledPnL || 0)}
                  subtitle="Resolved markets"
                  icon={BarChart3}
                  trend={(kalshi?.settledPnL || 0) >= 0 ? "up" : "down"}
                  accentColor="bg-green-500"
                />
                <StatCard
                  title="Open P&L"
                  value={fmt(kalshi?.openPnL || 0)}
                  subtitle={`${kalshi?.positions?.length || 0} positions`}
                  icon={Activity}
                  trend={(kalshi?.openPnL || 0) >= 0 ? "up" : "down"}
                  accentColor="bg-blue-500"
                />
                <StatCard
                  title="Total P&L"
                  value={fmt(kalshi?.totalPnL || 0)}
                  subtitle={`${kalshi?.tradeCount || 0} total trades`}
                  icon={DollarSign}
                  trend={(kalshi?.totalPnL || 0) >= 0 ? "up" : "down"}
                  accentColor={(kalshi?.totalPnL || 0) >= 0 ? "bg-green-500" : "bg-red-500"}
                />
              </div>

              {/* Open Positions */}
              {(kalshi?.positions?.length || 0) > 0 && (
                <div className="glass-panel rounded-lg p-5 space-y-3">
                  <h3 className="font-semibold">Open Positions</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {kalshi!.positions.map((pos, i) => (
                      <div key={i} className="p-3 rounded bg-muted/20 border border-border">
                        <div className="font-medium text-sm truncate">{pos.ticker}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {pos.yesContracts} YES / {pos.noContracts} NO @ {fmt(pos.avgPrice)}
                        </div>
                        <div className={`text-lg font-mono mt-2 ${pos.pnl >= 0 ? "text-green-500" : "text-red-400"}`}>
                          {pos.pnl >= 0 ? "+" : ""}{fmt(pos.pnl)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settlements (Resolved Trades) */}
              {(kalshi?.settlements?.length || 0) > 0 && (
                <div className="glass-panel rounded-lg p-5 space-y-3">
                  <h3 className="font-semibold">Settled Markets (P&L by Trade)</h3>
                  <ScrollArea className="h-[400px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                          <th className="p-2">Ticker</th>
                          <th className="p-2">Result</th>
                          <th className="p-2 text-right">Cost</th>
                          <th className="p-2 text-right">Revenue</th>
                          <th className="p-2 text-right">Profit</th>
                          <th className="p-2">Settled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kalshi!.settlements.map((s, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="p-2 font-mono text-xs">{s.ticker}</td>
                            <td className="p-2">
                              <Badge variant="outline" className={`text-[10px] ${
                                s.marketResult === "yes"
                                  ? "text-green-400 border-green-500/20"
                                  : s.marketResult === "no"
                                  ? "text-red-400 border-red-500/20"
                                  : ""
                              }`}>
                                {s.marketResult?.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-2 text-right font-mono">{fmt(s.totalCost)}</td>
                            <td className="p-2 text-right font-mono">{fmt(s.revenue)}</td>
                            <td className={`p-2 text-right font-mono font-bold ${
                              s.profit >= 0 ? "text-green-500" : "text-red-400"
                            }`}>
                              {s.profit >= 0 ? "+" : ""}{fmt(s.profit)}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">{fmtDate(s.settledTime)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              )}

              {/* Recent Fills */}
              {(kalshi?.fills?.length || 0) > 0 && (
                <div className="glass-panel rounded-lg p-5 space-y-3">
                  <h3 className="font-semibold">Recent Trade Fills</h3>
                  <ScrollArea className="h-[300px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                          <th className="p-2">Time</th>
                          <th className="p-2">Ticker</th>
                          <th className="p-2">Side</th>
                          <th className="p-2">Action</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kalshi!.fills.slice(0, 50).map((f, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="p-2 text-xs text-muted-foreground">{fmtDate(f.createdTime)}</td>
                            <td className="p-2 font-mono text-xs">{f.ticker}</td>
                            <td className="p-2">
                              <Badge variant="outline" className={`text-[10px] ${
                                f.side === "yes" ? "text-green-400 border-green-500/20" : "text-red-400 border-red-500/20"
                              }`}>
                                {f.side.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-2">
                              <span className={`text-xs ${f.action === "buy" ? "text-green-400" : "text-red-400"}`}>
                                {f.action.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-2 text-right font-mono">{f.count}</td>
                            <td className="p-2 text-right font-mono">{fmt(f.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              )}

              {/* Empty state */}
              {(!kalshi?.fills?.length && !kalshi?.settlements?.length && !kalshi?.positions?.length) && (
                <div className="glass-panel rounded-lg p-10 text-center text-muted-foreground">
                  <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No Kalshi trading data found</p>
                  <p className="text-xs mt-1">Trades will appear here once executed</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============ USAGE TAB ============ */}
      {activeTab === "usage" && (
        <div className="space-y-6">
          {/* API Plan Card */}
          {data.apiPlan && (
            <div className="glass-panel rounded-lg p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Server className="w-4 h-4" />
                Anthropic API — {data.apiPlan.plan}
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Input Tokens / min</div>
                  <div className="text-xl font-mono">{fmtK(data.apiPlan.inputTokenLimit)}</div>
                  <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: "0%" }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Output Tokens / min</div>
                  <div className="text-xl font-mono">{fmtK(data.apiPlan.outputTokenLimit)}</div>
                  <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: "0%" }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Requests / min</div>
                  <div className="text-xl font-mono">{fmtK(data.apiPlan.requestsPerMinute)}</div>
                  <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: "0%" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Budget Tracking */}
          {data.apiPlan && (
            <div className="glass-panel rounded-lg p-5 space-y-3">
              <h3 className="font-semibold">Budget Tracking</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded bg-muted/20 border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Monthly API Budget</div>
                  <div className="text-2xl font-mono mt-2">{fmt(data.apiPlan.monthlyBudget)}</div>
                  <div className="w-full h-3 bg-muted/30 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full ${
                        data.apiPlan.currentSpend / data.apiPlan.monthlyBudget > 0.8
                          ? "bg-red-500"
                          : data.apiPlan.currentSpend / data.apiPlan.monthlyBudget > 0.5
                          ? "bg-orange-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(100, (data.apiPlan.currentSpend / data.apiPlan.monthlyBudget) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>Spent: {fmt(data.apiPlan.currentSpend)}</span>
                    <span>Remaining: {fmt(data.apiPlan.monthlyBudget - data.apiPlan.currentSpend)}</span>
                  </div>
                </div>
                <div className="p-4 rounded bg-muted/20 border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Monthly Subscriptions</div>
                  <div className="text-2xl font-mono mt-2">
                    {fmt(
                      data.expenses
                        .filter(e => e.recurring === 1)
                        .filter((e, i, arr) => arr.findIndex(x => x.name === e.name) === i)
                        .reduce((s, e) => s + e.amount, 0)
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    per month across{" "}
                    {data.expenses
                      .filter(e => e.recurring === 1)
                      .filter((e, i, arr) => arr.findIndex(x => x.name === e.name) === i).length}{" "}
                    subscriptions
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
