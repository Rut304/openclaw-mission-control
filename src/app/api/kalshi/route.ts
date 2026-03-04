/**
 * Kalshi Trading API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKalshiClient } from '@/lib/kalshi-client';

/**
 * GET /api/kalshi - Get account overview
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'overview';

  try {
    const client = getKalshiClient();

    switch (action) {
      case 'balance': {
        const balance = await client.getBalance();
        return NextResponse.json({ balance });
      }

      case 'positions': {
        const positions = await client.getPositions();
        return NextResponse.json({ positions });
      }

      case 'orders': {
        const orders = await client.getOrders();
        return NextResponse.json({ orders });
      }

      case 'market': {
        const ticker = searchParams.get('ticker');
        if (!ticker) {
          return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
        }
        const market = await client.getMarket(ticker);
        return NextResponse.json({ market });
      }

      case 'status': {
        const status = await client.getExchangeStatus();
        return NextResponse.json({ status });
      }

      case 'fills': {
        const ticker = searchParams.get('ticker') || undefined;
        const fills = ticker
          ? (await client.getFills({ ticker })).fills
          : await client.getAllFills();
        return NextResponse.json({ fills });
      }

      case 'settlements': {
        const settlements = await client.getAllSettlements();
        // Calculate P&L per settlement
        const settlementsWithPnl = settlements.map(s => {
          const totalCost = s.yesTotalCost + s.noTotalCost;
          const profit = s.revenue - totalCost;
          return { ...s, totalCost, profit };
        });
        const totalPnL = settlementsWithPnl.reduce((sum, s) => sum + s.profit, 0);
        return NextResponse.json({ settlements: settlementsWithPnl, totalPnL });
      }

      case 'pnl': {
        // Comprehensive P&L: positions + settlements
        const [bal, pos, settl] = await Promise.all([
          client.getBalance(),
          client.getPositions(),
          client.getAllSettlements(),
        ]);
        const settlementsCalc = settl.map(s => ({
          ...s,
          totalCost: s.yesTotalCost + s.noTotalCost,
          profit: s.revenue - (s.yesTotalCost + s.noTotalCost),
        }));
        const settledPnL = settlementsCalc.reduce((sum, s) => sum + s.profit, 0);
        const openPnL = pos.reduce((sum, p) => sum + p.pnl, 0);
        return NextResponse.json({
          balance: bal,
          settledPnL,
          openPnL,
          totalPnL: settledPnL + openPnL,
          positions: pos,
          settlements: settlementsCalc,
        });
      }

      case 'overview':
      default: {
        const [balance, positions, orders, status] = await Promise.all([
          client.getBalance(),
          client.getPositions(),
          client.getOrders(),
          client.getExchangeStatus(),
        ]);

        return NextResponse.json({
          balance,
          positions,
          orders,
          exchangeStatus: status,
          lastUpdated: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('[Kalshi API] Error:', err);
    return NextResponse.json(
      { error: 'Kalshi API error', detail: String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kalshi - Place orders
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    const client = getKalshiClient();

    switch (action) {
      case 'order': {
        const { ticker, side, type, count, price } = params;
        
        if (!ticker || !side || !type || !count) {
          return NextResponse.json(
            { error: 'Missing required fields: ticker, side, type, count' },
            { status: 400 }
          );
        }

        const order = await client.placeOrder({
          ticker,
          side,
          type,
          count,
          price,
        });

        return NextResponse.json({ order, success: true });
      }

      case 'cancel': {
        const { orderId } = params;
        if (!orderId) {
          return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
        }

        await client.cancelOrder(orderId);
        return NextResponse.json({ success: true, cancelled: orderId });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[Kalshi API] Order error:', err);
    return NextResponse.json(
      { error: 'Order failed', detail: String(err) },
      { status: 500 }
    );
  }
}
