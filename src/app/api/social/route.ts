import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const HOME = process.env.HOME || "/Users/rutroh";
const CONTENT_DIR = path.join(HOME, "content");
const SOCIAL_METRICS_FILE = path.join(HOME, "memory", "social-metrics.json");
const COMMS_FILE = path.join(HOME, "shared-context", "agent-comms.json");

function safeReadJSON(filePath: string, fallback: unknown = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function scanContentDir(subdir: string) {
  const dir = path.join(CONTENT_DIR, subdir);
  const items: Array<{
    filename: string;
    content: string;
    createdAt: string;
    size: number;
  }> = [];

  try {
    if (!fs.existsSync(dir)) return items;
    const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
    for (const file of files.slice(-20)) {
      const fp = path.join(dir, file);
      const stat = fs.statSync(fp);
      if (stat.isFile()) {
        const content = fs.readFileSync(fp, "utf-8").substring(0, 500);
        items.push({ filename: file, content, createdAt: stat.birthtime.toISOString(), size: stat.size });
      }
    }
  } catch { /* dir doesn't exist */ }
  return items.reverse();
}

interface SocialMetricsFile {
  x?: Record<string, unknown>;
  tiktok?: Record<string, unknown>;
  youtube?: Record<string, unknown>;
  substack?: Record<string, unknown>;
  lastUpdated?: string;
}

// GET /api/social - Returns unified social media data for all platforms
export async function GET() {
  try {
    const xContent = [...scanContentDir("x"), ...scanContentDir("twitter")].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const tiktokContent = scanContentDir("tiktok");
    const youtubeContent = scanContentDir("youtube");
    const substackContent = [...scanContentDir("blog"), ...scanContentDir("substack")].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const metrics = safeReadJSON(SOCIAL_METRICS_FILE, {}) as SocialMetricsFile;

    const commsData = safeReadJSON(COMMS_FILE, { messages: [] }) as { messages: Array<{ from: string; to: string; type: string; message: string; timestamp: string }> };
    const socialKeywords = ["post", "tweet", "tiktok", "content", "x.com", "youtube", "substack", "blog", "video", "upload", "publish"];
    const socialComms = (commsData.messages || []).filter(
      (m) => socialKeywords.some(kw => m.message?.toLowerCase().includes(kw)) || m.from === "ria"
    ).slice(-50);

    const xM = { followers: 0, following: 0, posts: 0, impressions: 0, views: 0, likes: 0, engagement_rate: 0, history: [] as Record<string, unknown>[], ...(metrics.x || {}) };
    const tkM = { followers: 0, likes: 0, videos: 0, posts: 0, views: 0, engagement_rate: 0, history: [] as Record<string, unknown>[], ...(metrics.tiktok || {}) };
    const ytM = {
      subscribers: 0, followers: 0, videos: 0, views: 0, likes: 0, posts: 0, watch_hours: 0,
      comments: 0, engagement_rate: 0, history: [] as Record<string, unknown>[],
      channels: [] as Array<{ name: string; subscribers: number; views: number; videos: number; watch_hours: number; history: Record<string, unknown>[] }>,
      ...(metrics.youtube || {})
    };
    const ssM = { subscribers: 0, followers: 0, posts: 0, views: 0, likes: 0, engagement_rate: 0, comments: 0, history: [] as Record<string, unknown>[], ...(metrics.substack || {}) };

    const combined = {
      total_followers: (xM.followers || 0) + (tkM.followers || 0) + (ytM.subscribers || ytM.followers || 0) + (ssM.subscribers || ssM.followers || 0),
      total_posts: (xM.posts || 0) + (tkM.videos || tkM.posts || 0) + (ytM.videos || ytM.posts || 0) + (ssM.posts || 0),
      total_views: (xM.impressions || xM.views || 0) + (tkM.views || 0) + (ytM.views || 0) + (ssM.views || 0),
      total_likes: (xM.likes || 0) + (tkM.likes || 0) + (ytM.likes || 0) + (ssM.likes || 0),
      total_engagement: 0,
      platform_breakdown: {
        x: { followers: xM.followers || 0, posts: xM.posts || 0, views: xM.impressions || xM.views || 0 },
        tiktok: { followers: tkM.followers || 0, posts: tkM.videos || tkM.posts || 0, views: tkM.views || 0 },
        youtube: { followers: ytM.subscribers || ytM.followers || 0, posts: ytM.videos || ytM.posts || 0, views: ytM.views || 0 },
        substack: { followers: ssM.subscribers || ssM.followers || 0, posts: ssM.posts || 0, views: ssM.views || 0 },
      }
    };

    const engagements = [xM, tkM, ytM, ssM].map(m => m.engagement_rate || 0).filter(e => e > 0);
    combined.total_engagement = engagements.length > 0
      ? Number((engagements.reduce((a, b) => a + b, 0) / engagements.length).toFixed(2)) : 0;

    return NextResponse.json({
      combined,
      x: { handle: "@rohrut_ai", url: "https://x.com/rohrut_ai", content: xContent.slice(0, 20), metrics: xM },
      tiktok: { handle: "@rutroh_ai", url: "https://tiktok.com/@rutroh_ai", content: tiktokContent.slice(0, 20), metrics: tkM },
      youtube: { handle: "RutRoh AI", url: "https://youtube.com", content: youtubeContent.slice(0, 20), metrics: ytM },
      substack: { handle: "@rutrohd", url: "https://rutrohd.substack.com", content: substackContent.slice(0, 20), metrics: ssM },
      recentComms: socialComms,
      lastMetricsUpdate: metrics.lastUpdated || null,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load social data", details: String(error) },
      { status: 500 }
    );
  }
}
