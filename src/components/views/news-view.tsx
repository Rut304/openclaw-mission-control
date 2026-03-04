"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Newspaper,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  Clock,
  AlertTriangle,
  Zap,
  Globe,
  Search,
  Filter,
} from "lucide-react";

interface NewsItem {
  source: string;
  title: string;
  url: string;
  score?: number;
  fetched_at: string;
}

interface KalshiOpportunity {
  ticker: string;
  title: string;
  yes_price: number;
  no_price: number;
  volume: number;
  scanned_at: string;
}

interface NewsData {
  news: NewsItem[];
  bySource: Record<string, NewsItem[]>;
  opportunities: KalshiOpportunity[];
  totalItems: number;
  latestFetch: string | null;
  updatedAt: string;
}

const SOURCE_COLORS: Record<string, string> = {
  HackerNews: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  Reddit: "text-red-400 bg-red-400/10 border-red-400/20",
  Twitter: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  RSS: "text-green-400 bg-green-400/10 border-green-400/20",
  Google: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
};

const SOURCE_ICONS: Record<string, string> = {
  HackerNews: "🟠",
  Reddit: "🔴",
  Twitter: "🐦",
  RSS: "📡",
  Google: "🔍",
};

export function NewsView() {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshNews = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/news", { method: "POST" });
      await new Promise((r) => setTimeout(r, 1000));
      await fetchNews();
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchNews]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">📰</div>
          <p className="text-muted-foreground">Loading News Feed...</p>
        </div>
      </div>
    );
  }

  const sources = data ? Object.keys(data.bySource) : [];
  const filteredNews = data?.news.filter((item) => {
    const matchesSearch = !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = sourceFilter === "all" || item.source === sourceFilter;
    return matchesSearch && matchesSource;
  }) || [];

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ===== MAIN NEWS FEED ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-zinc-900/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <Newspaper className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-foreground text-lg">News Feed</h2>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="w-3 h-3" />
              {data?.totalItems || 0} items
            </div>
          </div>
          <div className="flex items-center gap-3">
            {data?.latestFetch && (
              <span className="text-[10px] text-muted-foreground">
                Last fetch: {formatTime(data.latestFetch)}
              </span>
            )}
            <button
              onClick={refreshNews}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Fetching..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Search + Filter bar */}
        <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-zinc-950/50">
          <div className="flex items-center gap-2 flex-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-foreground placeholder-zinc-500 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-zinc-500 hover:text-foreground text-xs">✕</button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-zinc-500" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs px-2 py-1.5 text-foreground outline-none"
            >
              <option value="all">All Sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* News list */}
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: "thin" }}>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {filteredNews.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-muted-foreground text-sm">No news items yet.</p>
              <p className="text-[11px] text-zinc-600 mt-1">Click Refresh to fetch news from sources.</p>
              <button
                onClick={refreshNews}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30 transition-all"
              >
                Fetch News Now
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNews.map((item, i) => {
                const sourceStyle = SOURCE_COLORS[item.source] || "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
                const icon = SOURCE_ICONS[item.source] || "📰";
                return (
                  <div
                    key={`${item.url}-${i}`}
                    className="flex items-start gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/60 hover:border-zinc-700 transition-all group"
                  >
                    <span className="text-lg shrink-0 mt-0.5">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-foreground hover:text-blue-400 transition-colors group-hover:underline leading-snug block"
                      >
                        {item.title}
                        <ExternalLink className="w-3 h-3 inline ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded border ${sourceStyle}`}>
                          {item.source}
                        </span>
                        {item.score !== undefined && item.score > 0 && (
                          <span className="flex items-center gap-0.5 text-yellow-400">
                            <TrendingUp className="w-3 h-3" />
                            {item.score} pts
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 text-zinc-500">
                          <Clock className="w-3 h-3" />
                          {formatTime(item.fetched_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== SIDEBAR: Kalshi Opportunities ===== */}
      <div className="w-80 border-l border-border bg-zinc-900/80 backdrop-blur flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-foreground">Kalshi Opportunities</span>
          <span className="ml-auto text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-zinc-800">
            {data?.opportunities?.length || 0}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: "thin" }}>
          {(!data?.opportunities || data.opportunities.length === 0) ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <div className="text-3xl mb-2">📊</div>
              No opportunities scanned yet.
              <br />Kalshi monitor runs every 30 min.
            </div>
          ) : (
            data.opportunities.map((opp, i) => (
              <div key={`${opp.ticker}-${i}`}
                className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800/40 transition-all">
                <div className="text-xs font-mono text-yellow-400 font-bold">{opp.ticker}</div>
                <div className="text-[11px] text-foreground mt-1 leading-snug line-clamp-2">{opp.title}</div>
                <div className="flex items-center gap-3 mt-2 text-[10px]">
                  <span className="text-green-400">Yes: {opp.yes_price}¢</span>
                  <span className="text-red-400">No: {opp.no_price}¢</span>
                  <span className="text-zinc-500 ml-auto">Vol: {opp.volume}</span>
                </div>
                <div className="text-[9px] text-zinc-600 mt-1">
                  Scanned {formatTime(opp.scanned_at)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Source summary at bottom */}
        <div className="p-3 border-t border-border">
          <div className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">Sources</div>
          <div className="space-y-1">
            {sources.map((source) => (
              <div key={source} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span>{SOURCE_ICONS[source] || "📰"}</span>
                  <span className="text-foreground">{source}</span>
                </span>
                <span className="text-zinc-500 font-mono">{data?.bySource[source]?.length || 0}</span>
              </div>
            ))}
            {sources.length === 0 && (
              <div className="text-xs text-zinc-600">No sources active</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
