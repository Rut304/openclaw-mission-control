"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Heart,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Video,
  Send,
  Clock,
  Minus,
  Globe,
  BookOpen,
  Play,
  ThumbsUp,
  Share2,
} from "lucide-react";

// ===== TYPES =====
interface ContentItem {
  filename: string;
  content: string;
  createdAt: string;
  size: number;
}

interface PlatformData {
  handle: string;
  url: string;
  content: ContentItem[];
  metrics: Record<string, unknown>;
}

interface CombinedMetrics {
  total_followers: number;
  total_posts: number;
  total_views: number;
  total_likes: number;
  total_engagement: number;
  platform_breakdown: Record<string, { followers: number; posts: number; views: number }>;
}

interface YouTubeChannel {
  name: string;
  subscribers: number;
  views: number;
  videos: number;
  watch_hours: number;
  history: Array<Record<string, unknown>>;
}

interface SocialData {
  combined: CombinedMetrics;
  x: PlatformData;
  tiktok: PlatformData;
  youtube: PlatformData & { metrics: Record<string, unknown> & { channels?: YouTubeChannel[] } };
  substack: PlatformData;
  recentComms: Array<{ from: string; message: string; timestamp: string; type: string }>;
  lastMetricsUpdate: string | null;
  updatedAt: string;
}

type PlatformTab = "all" | "x" | "tiktok" | "youtube" | "substack";

// ===== SPARKLINE =====
function Sparkline({ data, color, height = 40, width = 120 }: {
  data: number[]; color: string; height?: number; width?: number;
}) {
  if (data.length < 2) return <div className="text-[10px] text-zinc-600">No data yet</div>;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const fillPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polygon points={fillPoints} fill={color} opacity="0.1" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.length > 0 && (
        <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="3" fill={color} />
      )}
    </svg>
  );
}

// ===== BAR CHART =====
function BarChartMini({ data, labels, color, height = 60, width = 200 }: {
  data: number[]; labels: string[]; color: string; height?: number; width?: number;
}) {
  if (data.length === 0) return <div className="text-[10px] text-zinc-600">No data</div>;
  const max = Math.max(...data) || 1;
  const barWidth = Math.min(20, (width / data.length) * 0.7);
  const gap = (width - barWidth * data.length) / (data.length + 1);
  return (
    <svg width={width} height={height + 16} className="overflow-visible">
      {data.map((v, i) => {
        const barHeight = (v / max) * height;
        const x = gap + i * (barWidth + gap);
        const y = height - barHeight;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={2} fill={color} opacity={0.7} />
            <text x={x + barWidth / 2} y={height + 12} textAnchor="middle" fontSize="8" fill="#71717a">{labels[i] || ""}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ===== DONUT CHART (for platform breakdown) =====
function DonutChart({ data, colors, size = 120 }: {
  data: { label: string; value: number }[]; colors: string[]; size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  let cumAngle = -Math.PI / 2;

  return (
    <svg width={size} height={size} className="overflow-visible">
      {data.map((d, i) => {
        const angle = (d.value / total) * 2 * Math.PI;
        const startX = cx + r * Math.cos(cumAngle);
        const startY = cy + r * Math.sin(cumAngle);
        cumAngle += angle;
        const endX = cx + r * Math.cos(cumAngle);
        const endY = cy + r * Math.sin(cumAngle);
        const largeArc = angle > Math.PI ? 1 : 0;
        if (d.value === 0) return null;
        return (
          <path key={i}
            d={`M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`}
            fill={colors[i % colors.length]} opacity={0.8} stroke="#18181b" strokeWidth="1"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="#09090b" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fontWeight="bold" fill="white">
        {total.toLocaleString()}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#71717a">TOTAL</text>
    </svg>
  );
}

// ===== METRIC CARD =====
function MetricCard({ label, value, icon: Icon, trend, color }: {
  label: string; value: string | number; icon: React.ElementType; trend?: number; color: string;
}) {
  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus;
  const trendColor = trend && trend > 0 ? "text-green-400" : trend && trend < 0 ? "text-red-400" : "text-zinc-500";
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
        <div className="text-lg font-bold text-foreground font-mono">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-0.5 text-[10px] ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />{Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}

// ===== PLATFORM BADGE =====
function PlatformBadge({ platform, active, onClick }: { platform: PlatformTab; active: boolean; onClick: () => void }) {
  const config: Record<PlatformTab, { icon: string; label: string; color: string }> = {
    all: { icon: "🌐", label: "All Platforms", color: "#A855F7" },
    x: { icon: "𝕏", label: "X / Twitter", color: "#3B82F6" },
    tiktok: { icon: "🎵", label: "TikTok", color: "#EF4444" },
    youtube: { icon: "▶️", label: "YouTube", color: "#FF0000" },
    substack: { icon: "📝", label: "Substack", color: "#FF6719" },
  };
  const c = config[platform];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-lg ${
        active
          ? "text-white border-2 shadow-lg shadow-black/20"
          : "text-muted-foreground hover:text-foreground border border-zinc-800 hover:border-zinc-600 bg-zinc-900/30"
      }`}
      style={active ? { borderColor: c.color, backgroundColor: `${c.color}20` } : {}}
    >
      <span className="text-base">{c.icon}</span>
      {c.label}
    </button>
  );
}

// ===== CONTENT LIST =====
function ContentList({ items, platform }: { items: ContentItem[]; platform: string }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">📄</div>
        <p className="text-sm text-muted-foreground">No content yet</p>
        <p className="text-[10px] text-zinc-600 mt-1">Content will appear in ~/content/{platform}/</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.slice(0, 10).map((item, i) => {
        const isPosted = item.filename.includes("posted") || item.filename.includes("published");
        const isDraft = item.filename.includes("draft");
        return (
          <div key={`${item.filename}-${i}`} className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800/40 transition-all">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs">{isPosted ? "✅" : isDraft ? "📝" : "📄"}</span>
              <span className="text-xs font-mono text-foreground truncate flex-1">{item.filename}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                isPosted ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                isDraft ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                "bg-zinc-800 text-zinc-500 border border-zinc-700"
              }`}>
                {isPosted ? "Posted" : isDraft ? "Draft" : "File"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">{item.content.substring(0, 200)}</p>
            <div className="flex items-center gap-2 mt-1.5 text-[9px] text-zinc-600">
              <Clock className="w-2.5 h-2.5" />
              {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              <span className="ml-auto">{(item.size / 1024).toFixed(1)}KB</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== YOUTUBE CHANNEL CARD =====
function YouTubeChannelCard({ channel }: { channel: YouTubeChannel }) {
  return (
    <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-950/50">
      <div className="flex items-center gap-2 mb-3">
        <Play className="w-4 h-4 text-red-500" />
        <span className="text-sm font-bold text-foreground">{channel.name}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-zinc-500 uppercase">Subscribers</div>
          <div className="text-sm font-bold font-mono">{channel.subscribers.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 uppercase">Views</div>
          <div className="text-sm font-bold font-mono">{channel.views.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 uppercase">Videos</div>
          <div className="text-sm font-bold font-mono">{channel.videos.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 uppercase">Watch Hours</div>
          <div className="text-sm font-bold font-mono">{channel.watch_hours.toLocaleString()}</div>
        </div>
      </div>
      {channel.history?.length > 1 && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <div className="text-[10px] text-zinc-500 mb-1">Subscriber Trend</div>
          <Sparkline data={channel.history.map((h) => (h.subscribers as number) || 0)} color="#FF0000" width={180} height={30} />
        </div>
      )}
    </div>
  );
}

// ===== COMBINED OVERVIEW =====
function CombinedOverview({ data }: { data: SocialData }) {
  const { combined } = data;
  const bd = combined.platform_breakdown;

  const followerData = [
    { label: "X", value: bd.x.followers },
    { label: "TikTok", value: bd.tiktok.followers },
    { label: "YouTube", value: bd.youtube.followers },
    { label: "Substack", value: bd.substack.followers },
  ];
  const platformColors = ["#3B82F6", "#EF4444", "#FF0000", "#FF6719"];

  return (
    <div className="space-y-6">
      {/* Combined Metrics */}
      <div>
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Combined Metrics — All Platforms</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard label="Total Followers" value={combined.total_followers} icon={Users} color="#A855F7" />
          <MetricCard label="Total Posts" value={combined.total_posts} icon={Send} color="#8B5CF6" />
          <MetricCard label="Total Views" value={combined.total_views} icon={Eye} color="#10B981" />
          <MetricCard label="Total Likes" value={combined.total_likes} icon={Heart} color="#F59E0B" />
          <MetricCard label="Avg Engagement" value={`${combined.total_engagement}%`} icon={TrendingUp} color="#EC4899" />
        </div>
      </div>

      {/* Platform Breakdown */}
      <div>
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Platform Breakdown</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Follower donut */}
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-950/50 flex flex-col items-center">
            <div className="text-[10px] text-zinc-500 mb-3 uppercase">Followers by Platform</div>
            <DonutChart data={followerData} colors={platformColors} />
            <div className="flex flex-wrap gap-3 mt-3">
              {followerData.map((d, i) => (
                <div key={d.label} className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: platformColors[i] }} />
                  <span className="text-zinc-400">{d.label}</span>
                  <span className="font-bold text-foreground">{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Posts breakdown */}
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-950/50">
            <div className="text-[10px] text-zinc-500 mb-3 uppercase">Posts by Platform</div>
            <BarChartMini
              data={[bd.x.posts, bd.tiktok.posts, bd.youtube.posts, bd.substack.posts]}
              labels={["X", "TikTok", "YT", "Sub"]}
              color="#8B5CF6"
            />
          </div>

          {/* Views breakdown */}
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-950/50">
            <div className="text-[10px] text-zinc-500 mb-3 uppercase">Views by Platform</div>
            <BarChartMini
              data={[bd.x.views, bd.tiktok.views, bd.youtube.views, bd.substack.views]}
              labels={["X", "TikTok", "YT", "Sub"]}
              color="#10B981"
            />
          </div>
        </div>
      </div>

      {/* Platform Status Cards */}
      <div>
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Platform Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {([
            { key: "x", icon: "𝕏", name: "X / Twitter", color: "#3B82F6", handle: data.x.handle, url: data.x.url, followers: bd.x.followers, posts: bd.x.posts },
            { key: "tiktok", icon: "🎵", name: "TikTok", color: "#EF4444", handle: data.tiktok.handle, url: data.tiktok.url, followers: bd.tiktok.followers, posts: bd.tiktok.posts },
            { key: "youtube", icon: "▶️", name: "YouTube", color: "#FF0000", handle: data.youtube.handle, url: data.youtube.url, followers: bd.youtube.followers, posts: bd.youtube.posts },
            { key: "substack", icon: "📝", name: "Substack", color: "#FF6719", handle: data.substack.handle, url: data.substack.url, followers: bd.substack.followers, posts: bd.substack.posts },
          ] as const).map((p) => (
            <div key={p.key} className="p-4 rounded-lg border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800/30 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{p.icon}</span>
                <span className="text-sm font-bold" style={{ color: p.color }}>{p.name}</span>
              </div>
              <div className="text-[10px] text-zinc-500 mb-2">{p.handle}</div>
              <div className="flex gap-4">
                <div>
                  <div className="text-[9px] text-zinc-600 uppercase">Followers</div>
                  <div className="text-sm font-bold font-mono">{p.followers.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[9px] text-zinc-600 uppercase">Posts</div>
                  <div className="text-sm font-bold font-mono">{p.posts.toLocaleString()}</div>
                </div>
              </div>
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 mt-2 text-[10px] hover:underline" style={{ color: p.color }}>
                <ExternalLink className="w-2.5 h-2.5" />Visit
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== PLATFORM DETAIL VIEW =====
function PlatformDetail({ platform, data }: { platform: "x" | "tiktok" | "youtube" | "substack"; data: SocialData }) {
  const platformData = data[platform];
  const m = platformData.metrics as Record<string, unknown>;
  const history = (m.history || []) as Array<Record<string, unknown>>;

  const metricConfigs: Record<string, Array<{ label: string; key: string; icon: React.ElementType; color: string }>> = {
    x: [
      { label: "Followers", key: "followers", icon: Users, color: "#3B82F6" },
      { label: "Posts", key: "posts", icon: Send, color: "#8B5CF6" },
      { label: "Impressions", key: "impressions", icon: Eye, color: "#10B981" },
      { label: "Engagement", key: "engagement_rate", icon: Heart, color: "#F59E0B" },
    ],
    tiktok: [
      { label: "Followers", key: "followers", icon: Users, color: "#EF4444" },
      { label: "Videos", key: "videos", icon: Video, color: "#EC4899" },
      { label: "Total Views", key: "views", icon: Eye, color: "#8B5CF6" },
      { label: "Total Likes", key: "likes", icon: Heart, color: "#F59E0B" },
    ],
    youtube: [
      { label: "Subscribers", key: "subscribers", icon: Users, color: "#FF0000" },
      { label: "Videos", key: "videos", icon: Video, color: "#8B5CF6" },
      { label: "Total Views", key: "views", icon: Eye, color: "#10B981" },
      { label: "Watch Hours", key: "watch_hours", icon: Clock, color: "#F59E0B" },
      { label: "Likes", key: "likes", icon: ThumbsUp, color: "#EC4899" },
      { label: "Comments", key: "comments", icon: MessageSquare, color: "#3B82F6" },
    ],
    substack: [
      { label: "Subscribers", key: "subscribers", icon: Users, color: "#FF6719" },
      { label: "Posts", key: "posts", icon: BookOpen, color: "#8B5CF6" },
      { label: "Views", key: "views", icon: Eye, color: "#10B981" },
      { label: "Likes", key: "likes", icon: Heart, color: "#F59E0B" },
    ],
  };

  const configs = metricConfigs[platform] || [];

  // Build history chart data
  const historyKeys: Record<string, string[]> = {
    x: ["followers", "impressions", "engagement"],
    tiktok: ["followers", "views", "likes"],
    youtube: ["subscribers", "views", "watch_hours"],
    substack: ["subscribers", "views", "likes"],
  };
  const historyLabels = history.map((h) => String(h.date || "").slice(5));
  const historyCharts = (historyKeys[platform] || []).map((key) => ({
    key,
    data: history.map((h) => Number(h[key] || 0)),
    labels: historyLabels,
  }));

  const chartColors: Record<string, string> = {
    followers: "#3B82F6", subscribers: "#FF0000", impressions: "#10B981",
    engagement: "#F59E0B", views: "#8B5CF6", likes: "#EC4899", watch_hours: "#F59E0B",
  };

  // YouTube channels
  const ytChannels = platform === "youtube" ? ((m.channels || []) as YouTubeChannel[]) : [];

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div>
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
          {platform === "x" ? "X / Twitter" : platform === "tiktok" ? "TikTok" : platform === "youtube" ? "YouTube" : "Substack"} Metrics
        </h3>
        <div className={`grid grid-cols-2 ${configs.length > 4 ? "lg:grid-cols-6" : "lg:grid-cols-4"} gap-3`}>
          {configs.map((c) => {
            const val = m[c.key];
            const display = c.key.includes("rate") ? `${Number(val || 0).toFixed(1)}%` : Number(val || 0);
            return <MetricCard key={c.key} label={c.label} value={display} icon={c.icon} color={c.color} />;
          })}
        </div>
      </div>

      {/* YouTube Channel Breakdown */}
      {platform === "youtube" && ytChannels.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Channel Breakdown</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ytChannels.map((ch) => (
              <YouTubeChannelCard key={ch.name} channel={ch} />
            ))}
          </div>
        </div>
      )}

      {/* History Charts */}
      {historyCharts.length > 0 && historyCharts[0].data.length > 1 ? (
        <div>
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Trends</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {historyCharts.map((ch) => (
              <div key={ch.key} className="p-4 rounded-lg border border-zinc-800 bg-zinc-950/50">
                <div className="text-[10px] text-zinc-500 mb-2 uppercase">{ch.key.replace(/_/g, " ")} Over Time</div>
                <Sparkline data={ch.data} color={chartColors[ch.key] || "#A855F7"} width={200} height={50} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-lg border border-zinc-800 bg-zinc-950/50 text-center">
          <BarChart3 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No historical metrics data yet</p>
          <p className="text-[10px] text-zinc-600 mt-1">Metrics tracked every 6h → ~/memory/social-metrics.json</p>
        </div>
      )}

      {/* Content */}
      <div>
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
          Content ({platformData.content.length || 0} items)
        </h3>
        <ContentList items={platformData.content} platform={platform} />
      </div>
    </div>
  );
}

// ===== MAIN COMPONENT =====
export function SocialMediaView() {
  const [data, setData] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PlatformTab>("all");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/social");
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

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">📱</div>
          <p className="text-muted-foreground">Loading Social Media...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-zinc-900/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-foreground text-lg">Social Media Command Center</h2>
            {data?.combined && (
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                {data.combined.total_followers.toLocaleString()} total followers
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {data?.lastMetricsUpdate && (
              <span className="text-[10px] text-muted-foreground">
                Updated: {new Date(data.lastMetricsUpdate).toLocaleString()}
              </span>
            )}
            <button onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 transition-all">
              <RefreshCw className="w-3.5 h-3.5" />Refresh
            </button>
          </div>
        </div>

        {/* Platform Filter Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          {(["all", "x", "tiktok", "youtube", "substack"] as PlatformTab[]).map((tab) => (
            <PlatformBadge key={tab} platform={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: "thin" }}>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {data && activeTab === "all" && <CombinedOverview data={data} />}
          {data && activeTab !== "all" && <PlatformDetail platform={activeTab} data={data} />}
        </div>
      </div>

      {/* ===== SIDEBAR: Social Activity Feed ===== */}
      <div className="w-72 border-l border-border bg-zinc-900/80 backdrop-blur flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-green-400" />
          <span className="text-sm font-bold text-foreground">Social Activity</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5" style={{ scrollbarWidth: "thin" }}>
          {(!data?.recentComms || data.recentComms.length === 0) ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <div className="text-3xl mb-2">💬</div>
              No social-related activity yet
            </div>
          ) : (
            data.recentComms.map((comm, i) => (
              <div key={i} className="p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="font-bold text-blue-400">{comm.from}</span>
                  <span className="text-zinc-600">
                    {new Date(comm.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{comm.message}</p>
              </div>
            ))
          )}
        </div>

        {/* Quick links */}
        <div className="p-3 border-t border-border space-y-1.5">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Quick Links</div>
          <a href="https://x.com/rohrut_ai" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <ExternalLink className="w-3 h-3" />@rohrut_ai on X
          </a>
          <a href="https://tiktok.com/@rutroh_ai" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-pink-400 hover:text-pink-300 transition-colors">
            <ExternalLink className="w-3 h-3" />@rutroh_ai on TikTok
          </a>
          <a href="https://youtube.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors">
            <ExternalLink className="w-3 h-3" />RutRoh AI on YouTube
          </a>
          <a href="https://rutrohd.substack.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-orange-400 hover:text-orange-300 transition-colors">
            <ExternalLink className="w-3 h-3" />@rutrohd on Substack
          </a>
        </div>
      </div>
    </div>
  );
}
