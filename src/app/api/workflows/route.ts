import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  logActivity,
} from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const missionId = searchParams.get("mission_id") || undefined;
  const workflows = listWorkflows(missionId);

  // Parse JSON fields for frontend consumption
  const parsed = workflows.map((w) => ({
    ...w,
    nodes: JSON.parse(w.nodes || "[]"),
    connections: JSON.parse(w.connections || "[]"),
  }));

  return NextResponse.json({ workflows: parsed });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description, mission_id, nodes, connections, status, cron_expression, n8n_workflow_id, last_run, next_run } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const workflow = createWorkflow({
    id: uuidv4(),
    name,
    description,
    mission_id,
    nodes,
    connections,
    status,
    cron_expression,
    n8n_workflow_id,
    last_run,
    next_run,
  });

  logActivity({
    id: uuidv4(),
    type: "workflow_created",
    mission_id: mission_id || undefined,
    message: `Workflow "${name}" created`,
  });

  return NextResponse.json(
    {
      workflow: {
        ...workflow,
        nodes: JSON.parse(workflow.nodes || "[]"),
        connections: JSON.parse(workflow.connections || "[]"),
      },
    },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, ...patch } = body;

  if (!id) {
    return NextResponse.json({ error: "Workflow ID is required" }, { status: 400 });
  }

  const existing = getWorkflow(id);
  if (!existing) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const workflow = updateWorkflow(id, patch);
  if (!workflow) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({
    workflow: {
      ...workflow,
      nodes: JSON.parse(workflow.nodes || "[]"),
      connections: JSON.parse(workflow.connections || "[]"),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Workflow ID is required" }, { status: 400 });
  }

  deleteWorkflow(id);
  return NextResponse.json({ ok: true });
}
