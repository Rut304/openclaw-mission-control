import { NextRequest, NextResponse } from "next/server";
import { getOpenClawClient } from "@/lib/openclaw-client";
import { getUsageSummary, getOpenRouterUsage } from "@/lib/cost-tracking";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") as "today" | "week" | "month") || "today";

  try {
    // Get real usage data from multiple sources
    const [openClawData, costSummary, openRouterCredits] = await Promise.allSettled([
      (async () => {
        const client = getOpenClawClient();
        await client.connect();
        const [usage, cost] = await Promise.all([
          client.getUsage(),
          client.getUsageCost(),
        ]);
        return { usage, cost };
      })(),
      getUsageSummary(period),
      getOpenRouterUsage(),
    ]);

    const openClawResult = openClawData.status === "fulfilled" ? openClawData.value : null;
    const summary = costSummary.status === "fulfilled" ? costSummary.value : null;
    const credits = openRouterCredits.status === "fulfilled" ? openRouterCredits.value : null;

    // Combine data for comprehensive view
    const openClawUsage = openClawResult?.usage as { activeSessions?: number } | undefined;
    const combinedUsage = {
      inputTokens: summary?.breakdown?.reduce((sum, b) => sum + b.inputTokens, 0) || 0,
      outputTokens: summary?.breakdown?.reduce((sum, b) => sum + b.outputTokens, 0) || 0,
      totalTokens: summary?.totalTokens || 0,
      sessions: summary?.totalRequests || 0,
      activeSessions: openClawUsage?.activeSessions || 0,
    };

    const combinedCost = {
      totalCost: summary?.totalCost || 0,
      total: summary?.totalCost || 0,
      breakdown: summary?.breakdown || [],
      budget: {
        daily: 20.0,
        used: summary?.totalCost || 0,
        remaining: 20.0 - (summary?.totalCost || 0),
      },
    };

    return NextResponse.json({
      usage: combinedUsage,
      cost: combinedCost,
      openRouterCredits: credits,
      period,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Usage API] Error:", error);
    return NextResponse.json(
      { error: String(error), usage: null, cost: null },
      { status: 500 }
    );
  }
}
