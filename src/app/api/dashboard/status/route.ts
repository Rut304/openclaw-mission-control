import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'mission-control.db');
    const db = new Database(dbPath);
    
    // Check if gateway is reachable
    let gatewayStatus = 'offline';
    try {
      const response = await fetch('http://127.0.0.1:18789/ping', {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      });
      if (response.ok) {
        gatewayStatus = 'online';
      }
    } catch (e) {
      // Gateway not reachable
    }
    
    // Get quick stats from database
    let agentCount = { count: 0 };
    try {
      agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get() as any || { count: 0 };
    } catch {
      // agents table may not exist - that's ok, we get agent count from gateway
    }
    let taskCount = { count: 0 };
    let recentActivity = { count: 0 };
    try {
      taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as any || { count: 0 };
    } catch {
      // tasks table may not exist
    }
    try {
      recentActivity = db.prepare("SELECT COUNT(*) as count FROM activity_log WHERE created_at > datetime('now', '-5 minutes')").get() as any || { count: 0 };
    } catch {
      // activity_log table may not exist
    }
    
    // Get recent activities for the feed
    let activities: any[] = [];
    try {
      activities = db.prepare(
        'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20'
      ).all();
    } catch (e) {
      // Table might not exist yet
    }
    
    db.close();
    
    return NextResponse.json({
      status: gatewayStatus,
      gateway: {
        url: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
        connected: gatewayStatus === 'online'
      },
      stats: {
        agents: agentCount?.count || 0,
        tasks: taskCount?.count || 0,
        recentActivityCount: recentActivity?.count || 0
      },
      activities,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Dashboard status error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error.message,
        activities: [],
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}