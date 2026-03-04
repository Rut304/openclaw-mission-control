/**
 * Cost Tracking API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUsageSummary, getOpenRouterUsage, getLangfuseUsage } from '@/lib/cost-tracking';

/**
 * GET /api/costs - Get cost and usage data
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get('period') as 'today' | 'week' | 'month') || 'today';
  const source = searchParams.get('source'); // optional: openrouter, langfuse, all

  try {
    if (source === 'openrouter') {
      const usage = await getOpenRouterUsage();
      return NextResponse.json({
        source: 'openrouter',
        data: usage,
        lastUpdated: new Date().toISOString(),
      });
    }

    if (source === 'langfuse') {
      const periodDays = period === 'today' ? 1 : period === 'week' ? 7 : 30;
      const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
      const breakdown = await getLangfuseUsage({ since });
      return NextResponse.json({
        source: 'langfuse',
        period,
        breakdown,
        lastUpdated: new Date().toISOString(),
      });
    }

    // Default: comprehensive summary
    const summary = await getUsageSummary(period);
    
    return NextResponse.json({
      ...summary,
      // Add formatted values for display
      formatted: {
        totalCost: `$${summary.totalCost.toFixed(2)}`,
        totalTokens: formatNumber(summary.totalTokens),
        totalRequests: formatNumber(summary.totalRequests),
      },
      // Add daily budget tracking
      budget: {
        daily: 20.0, // $20/day budget
        used: summary.period === 'today' ? summary.totalCost : summary.totalCost / (period === 'week' ? 7 : 30),
        remaining: 20.0 - (summary.period === 'today' ? summary.totalCost : summary.totalCost / (period === 'week' ? 7 : 30)),
        percentUsed: Math.min(100, (summary.totalCost / 20.0) * 100),
      },
    });
  } catch (err) {
    console.error('[Costs API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch cost data', detail: String(err) },
      { status: 500 }
    );
  }
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}
