import { NextRequest, NextResponse } from "next/server";
import {
  listAgentMetrics,
  createAgentMetric,
  getAgentPerformanceSummary,
  AgentMetric,
} from "@/lib/db";
import { randomUUID } from "crypto";

// GET - List agent metrics with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent_id = searchParams.get("agent_id") || undefined;
    const since = searchParams.get("since") || undefined;
    const until = searchParams.get("until") || undefined;
    const summary = searchParams.get("summary") === "true";
    const days = parseInt(searchParams.get("days") || "30", 10);

    // If summary requested for a specific agent
    if (summary && agent_id) {
      const summaryData = getAgentPerformanceSummary(agent_id, days);
      return NextResponse.json({ agent_id, days, ...summaryData });
    }

    // If summary requested for all agents
    if (summary) {
      const agents = ["rip", "rex", "red", "rio", "ria", "rea", "reg", "rak", "worker"];
      const summaries = agents.map((id) => ({
        agent_id: id,
        ...getAgentPerformanceSummary(id, days),
      }));
      return NextResponse.json({ days, agents: summaries });
    }

    // Regular list with filters
    const metrics = listAgentMetrics({ agent_id, since, until });
    return NextResponse.json({ metrics });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch agent metrics", details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Record a new metric entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agent_id,
      metric_date,
      tasks_completed,
      tasks_failed,
      tasks_escalated,
      avg_completion_time_hours,
      evidence_provided_rate,
      accuracy_score,
      cost_usd,
      revenue_attributed,
      notes,
    } = body;

    if (!agent_id) {
      return NextResponse.json(
        { error: "agent_id is required" },
        { status: 400 }
      );
    }

    const id = randomUUID();
    const date = metric_date || new Date().toISOString().split("T")[0];

    const metric = createAgentMetric({
      id,
      agent_id,
      metric_date: date,
      tasks_completed,
      tasks_failed,
      tasks_escalated,
      avg_completion_time_hours,
      evidence_provided_rate,
      accuracy_score,
      cost_usd,
      revenue_attributed,
      notes,
    });

    return NextResponse.json({ created: true, metric });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create agent metric", details: String(error) },
      { status: 500 }
    );
  }
}
