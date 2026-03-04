import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'mission-control.db');
    const db = new Database(dbPath);
    
    // Get metrics
    const metrics = db.prepare('SELECT id, value, updated_at FROM metrics').all();
    const metricsMap: Record<string, any> = {};
    metrics.forEach((m: any) => {
      metricsMap[m.id] = {
        value: m.value,
        updated: m.updated_at
      };
    });
    
    // Get agents
    const agents = db.prepare('SELECT * FROM agents ORDER BY updated_at DESC').all();
    
    // Get recent activity
    const activities = db.prepare(
      'SELECT * FROM activity_feed ORDER BY timestamp DESC LIMIT 20'
    ).all();
    
    // Get Kalshi bot status from file
    const fs = require('fs');
    let kalshiRunning = false;
    try {
      const psResult = require('child_process')
        .execSync('ps aux | grep kalshi | grep -v grep | wc -l')
        .toString()
        .trim();
      kalshiRunning = parseInt(psResult) > 0;
    } catch (e) {
      console.error('Error checking Kalshi status:', e);
    }
    
    // Calculate totals
    const totalRevenue = parseFloat(metricsMap.daily_revenue?.value?.replace('$', '') || '0');
    const apiCosts = parseFloat(metricsMap.api_costs?.value?.replace('$', '').replace('+', '') || '0');
    const profit = totalRevenue - apiCosts;
    
    const response = {
      metrics: {
        revenue: {
          daily: metricsMap.daily_revenue?.value || '$0',
          total: metricsMap.total_revenue?.value || '$0',
          target: '$500/day'
        },
        costs: {
          api: metricsMap.api_costs?.value || '$0',
          limit: '$10/day',
          overLimit: apiCosts > 10
        },
        profit: {
          daily: profit < 0 ? `-$${Math.abs(profit)}` : `$${profit}`,
          margin: totalRevenue > 0 ? `${((profit / totalRevenue) * 100).toFixed(1)}%` : '0%'
        },
        kalshi: {
          pnl: metricsMap.kalshi_pnl?.value || '$0',
          balance: metricsMap.kalshi_balance?.value || '$108.13',
          running: kalshiRunning,
          trades: 0
        },
        content: {
          tiktok: parseInt(metricsMap.tiktok_views?.value || '0'),
          twitter: parseInt(metricsMap.twitter_followers?.value || '0'),
          github: parseInt(metricsMap.github_blog_posts?.value || '2'),
          total: parseInt(metricsMap.content_posted?.value || '1')
        },
        upwork: {
          proposals: parseInt(metricsMap.upwork_proposals?.value || '2'),
          applications: 0,
          responses: 0
        }
      },
      agents: agents.map((a: any) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        model: a.model,
        runtime: a.runtime,
        tokens: a.tokens,
        costEstimate: `$${((a.tokens || 0) * 0.00001).toFixed(2)}`
      })),
      activities: activities.map((a: any) => ({
        agent: a.agent,
        action: a.action,
        details: a.details,
        timestamp: a.timestamp
      })),
      summary: {
        totalAgents: agents.length,
        activeAgents: agents.filter((a: any) => a.status === 'active').length,
        totalTokens: agents.reduce((sum: number, a: any) => sum + (a.tokens || 0), 0),
        systemHealth: apiCosts > 250 ? 'critical' : apiCosts > 100 ? 'warning' : 'healthy'
      }
    };
    
    db.close();
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Dashboard metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', details: error.message },
      { status: 500 }
    );
  }
}