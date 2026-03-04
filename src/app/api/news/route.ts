import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const HOME = process.env.HOME || "/Users/rutroh";
const NEWS_FILE = path.join(HOME, "memory", "news-feed.json");
const OPPORTUNITIES_FILE = path.join(HOME, "memory", "kalshi-opportunities.json");

function safeReadJSON(filePath: string, fallback: unknown = []) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

// GET /api/news - Returns news feed data
export async function GET() {
  try {
    const news = safeReadJSON(NEWS_FILE, []) as Array<{
      source: string;
      title: string;
      url: string;
      score?: number;
      fetched_at: string;
    }>;

    const opportunities = safeReadJSON(OPPORTUNITIES_FILE, []) as Array<{
      ticker: string;
      title: string;
      yes_price: number;
      no_price: number;
      volume: number;
      scanned_at: string;
    }>;

    // Group news by source
    const bySource: Record<string, typeof news> = {};
    for (const item of news) {
      const src = item.source || "Unknown";
      if (!bySource[src]) bySource[src] = [];
      bySource[src].push(item);
    }

    // Get latest fetch time
    const latestFetch = news.length > 0
      ? news[news.length - 1].fetched_at
      : null;

    return NextResponse.json({
      news: news.slice(-50).reverse(), // Latest 50, newest first
      bySource,
      opportunities: opportunities.slice(-20).reverse(),
      totalItems: news.length,
      latestFetch,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load news", details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/news/refresh - Trigger content pipeline to fetch fresh news
export async function POST() {
  try {
    const { execSync } = await import("child_process");
    execSync(`python3 ${HOME}/scripts/content-pipeline.py`, {
      encoding: "utf-8",
      timeout: 30000,
    });
    return NextResponse.json({ success: true, message: "News refreshed" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to refresh news", details: String(error) },
      { status: 500 }
    );
  }
}
