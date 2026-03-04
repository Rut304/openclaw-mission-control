"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertTriangle, Activity } from 'lucide-react';

interface MetricsData {
  metrics: {
    revenue: { daily: string; target: string };
    costs: { api: string; limit: string; overLimit: boolean };
    profit: { daily: string; margin: string };
    kalshi: { pnl: string; balance: string; running: boolean; trades: number };
    content: { tiktok: number; twitter: number; github: number; total: number };
    upwork: { proposals: number; applications: number; responses: number };
  };
  agents: Array<{
    id: string;
    name: string;
    status: string;
    model: string;
    runtime: number;
    tokens: number;
    costEstimate: string;
  }>;
  activities: Array<{
    agent: string;
    action: string;
    details: string;
    timestamp: string;
  }>;
  summary: {
    totalAgents: number;
    activeAgents: number;
    totalTokens: number;
    systemHealth: string;
  };
}

export function LiveMetrics() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/dashboard/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const newData = await response.json();
      setData(newData);
      setLastUpdate(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchMetrics(); // Initial fetch
    const interval = setInterval(fetchMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error loading metrics: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        Loading metrics...
      </div>
    );
  }

  const healthColor = data.summary.systemHealth === 'critical' ? 'text-red-500' :
                     data.summary.systemHealth === 'warning' ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="flex-1 overflow-auto min-h-0 p-4 space-y-6">
      {/* Revenue & Costs Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.revenue.daily}</div>
            <p className="text-xs text-muted-foreground">
              Target: {data.metrics.revenue.target}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Costs</CardTitle>
            {data.metrics.costs.overLimit && <AlertTriangle className="h-4 w-4 text-red-500" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.metrics.costs.overLimit ? 'text-red-500' : ''}`}>
              {data.metrics.costs.api}
            </div>
            <p className="text-xs text-muted-foreground">
              Limit: {data.metrics.costs.limit}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.profit.daily}</div>
            <p className="text-xs text-muted-foreground">
              Margin: {data.metrics.profit.margin}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className={`h-4 w-4 ${healthColor}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold capitalize ${healthColor}`}>
              {data.summary.systemHealth}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.summary.activeAgents}/{data.summary.totalAgents} agents active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Specific Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🎰 Kalshi Trading</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">P&L:</span>
              <span className="font-semibold">{data.metrics.kalshi.pnl}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Balance:</span>
              <span className="font-semibold">{data.metrics.kalshi.balance}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Bot Status:</span>
              <span className={data.metrics.kalshi.running ? 'text-green-500' : 'text-red-500'}>
                {data.metrics.kalshi.running ? '🟢 Running' : '🔴 Stopped'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📱 Content Posted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">TikTok Views:</span>
              <span className="font-semibold">{data.metrics.content.tiktok}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Twitter Followers:</span>
              <span className="font-semibold">{data.metrics.content.twitter}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">GitHub Posts:</span>
              <span className="font-semibold">{data.metrics.content.github}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">💼 Upwork</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Proposals:</span>
              <span className="font-semibold">{data.metrics.upwork.proposals}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Applications:</span>
              <span className="font-semibold">{data.metrics.upwork.applications}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Responses:</span>
              <span className="font-semibold">{data.metrics.upwork.responses}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {data.activities.map((activity, index) => (
              <div key={index} className="flex items-start space-x-2 text-sm">
                <span className="font-semibold min-w-[100px]">{activity.agent}:</span>
                <span className="text-muted-foreground">{activity.details}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}