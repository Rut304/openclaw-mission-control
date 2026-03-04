/**
 * Finance API Routes
 * GET /api/finance?view=pnl|expenses|usage|kalshi|overview
 * POST /api/finance - Create expense/revenue entries
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listExpenses, createExpense,
  listRevenue, createRevenue,
  listApiUsage, createApiUsage,
  getPnLSummary,
} from '@/lib/db';
import { getAnthropicUsage, getAnthropicPlanInfo } from '@/lib/anthropic-usage';
import { getKalshiClient } from '@/lib/kalshi-client';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'overview';
  const since = searchParams.get('since') || undefined;
  const until = searchParams.get('until') || undefined;

  try {
    switch (view) {
      // -------- P&L Summary --------
      case 'pnl': {
        const pnl = getPnLSummary(since, until);
        return NextResponse.json({ ...pnl, lastUpdated: new Date().toISOString() });
      }

      // -------- Expenses --------
      case 'expenses': {
        const category = searchParams.get('category') || undefined;
        const expenses = listExpenses({ category, since, until });
        const total = expenses.reduce((s, e) => s + Math.abs(e.amount), 0);
        return NextResponse.json({ expenses, total, count: expenses.length });
      }

      // -------- Revenue --------
      case 'revenue': {
        const source = searchParams.get('source') || undefined;
        const revenue = listRevenue({ source, since });
        const total = revenue.reduce((s, r) => s + r.amount, 0);
        return NextResponse.json({ revenue, total, count: revenue.length });
      }

      // -------- API Usage --------
      case 'usage': {
        const provider = searchParams.get('provider') || undefined;
        const usage = listApiUsage({ provider, since });
        const planInfo = getAnthropicPlanInfo();

        // Optionally do a live check
        const live = searchParams.get('live') === 'true';
        let liveUsage = null;
        if (live) {
          liveUsage = await getAnthropicUsage();
          // Store snapshot
          if (liveUsage) {
            const today = new Date().toISOString().split('T')[0];
            createApiUsage({
              id: `usage-anthropic-${today}-${Date.now()}`,
              provider: 'anthropic',
              model: liveUsage.modelId,
              input_tokens: liveUsage.inputTokensUsed,
              output_tokens: liveUsage.outputTokensUsed,
              requests: liveUsage.requestsUsed,
              cost_usd: liveUsage.estimatedCostUsd,
              rate_limit_remaining: liveUsage.rateLimits as any,
              snapshot_date: today,
            });
          }
        }

        return NextResponse.json({
          usage,
          planInfo,
          liveUsage,
          lastUpdated: new Date().toISOString(),
        });
      }

      // -------- Kalshi Trading P&L --------
      case 'kalshi': {
        try {
          const client = getKalshiClient();
          const [balance, positions, settlementsData] = await Promise.all([
            client.getBalance(),
            client.getPositions(),
            client.getAllSettlements(),
          ]);

          const fills = await client.getAllFills();

          const settlements = settlementsData.map(s => ({
            ...s,
            totalCost: s.yesTotalCost + s.noTotalCost,
            profit: s.revenue - (s.yesTotalCost + s.noTotalCost),
          }));

          const settledPnL = settlements.reduce((sum, s) => sum + s.profit, 0);
          const openPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

          return NextResponse.json({
            balance,
            positions,
            fills,
            settlements,
            settledPnL,
            openPnL,
            totalPnL: settledPnL + openPnL,
            tradeCount: fills.length,
            lastUpdated: new Date().toISOString(),
          });
        } catch (err) {
          return NextResponse.json({
            error: 'Kalshi API error',
            detail: String(err),
            balance: null,
            positions: [],
            fills: [],
            settlements: [],
            settledPnL: 0,
            openPnL: 0,
            totalPnL: 0,
          });
        }
      }

      // -------- Full Overview --------
      case 'overview':
      default: {
        const pnl = getPnLSummary(since, until);
        const expenses = listExpenses({ since, until });
        const revenue = listRevenue({ since });
        const planInfo = getAnthropicPlanInfo();

        // Try Kalshi (non-blocking)
        let kalshiData = null;
        try {
          const client = getKalshiClient();
          const [balance, positions] = await Promise.all([
            client.getBalance(),
            client.getPositions(),
          ]);
          kalshiData = {
            balance,
            positions,
            openPnL: positions.reduce((sum, p) => sum + p.pnl, 0),
          };
        } catch {
          kalshiData = null;
        }

        return NextResponse.json({
          pnl,
          expenses: { items: expenses, total: pnl.totalExpenses },
          revenue: { items: revenue, total: pnl.totalRevenue },
          apiPlan: planInfo,
          kalshi: kalshiData,
          lastUpdated: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('[Finance API] Error:', err);
    return NextResponse.json(
      { error: 'Finance API error', detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    switch (type) {
      case 'expense': {
        const id = data.id || `exp-${randomUUID().slice(0, 8)}`;
        createExpense({ ...data, id });
        return NextResponse.json({ success: true, id });
      }

      case 'revenue': {
        const id = data.id || `rev-${randomUUID().slice(0, 8)}`;
        createRevenue({ ...data, id });
        return NextResponse.json({ success: true, id });
      }

      default:
        return NextResponse.json({ error: 'Unknown type. Use: expense, revenue' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Finance API] POST error:', err);
    return NextResponse.json(
      { error: 'Failed to create entry', detail: String(err) },
      { status: 500 }
    );
  }
}
