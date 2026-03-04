import { NextResponse } from "next/server";
import os from "os";

const startedAt = Date.now();

export async function GET() {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const mem = process.memoryUsage();

  // Check gateway connectivity
  let gatewayStatus = "unknown";
  try {
    const res = await fetch("http://127.0.0.1:18789", {
      signal: AbortSignal.timeout(2000),
    });
    gatewayStatus = res.ok ? "connected" : `http-${res.status}`;
  } catch {
    gatewayStatus = "offline";
  }

  return NextResponse.json({
    status: "ok",
    version: process.env.npm_package_version || "dev",
    uptime: uptimeSeconds,
    uptimeHuman: formatUptime(uptimeSeconds),
    startedAt: new Date(startedAt).toISOString(),
    node: process.version,
    platform: `${os.platform()}/${os.arch()}`,
    memory: {
      rss: formatBytes(mem.rss),
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal),
    },
    system: {
      hostname: os.hostname(),
      cpus: os.cpus().length,
      loadAvg: os.loadavg().map((l) => Math.round(l * 100) / 100),
      freeMemGB: Math.round((os.freemem() / 1073741824) * 10) / 10,
      totalMemGB: Math.round((os.totalmem() / 1073741824) * 10) / 10,
    },
    gateway: gatewayStatus,
    timestamp: new Date().toISOString(),
  });
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1048576)}MB`;
}
