import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getTask, updateTask, logActivity } from "@/lib/db";

// POST /api/tasks/evidence - Add evidence to a task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, type, description, url, data } = body;

    if (!taskId || !type || !description) {
      return NextResponse.json(
        { error: "taskId, type, and description are required" },
        { status: 400 }
      );
    }

    const task = getTask(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Parse existing evidence
    let evidence: Array<{
      id: string;
      type: string;
      description: string;
      url?: string;
      data?: unknown;
      added_at: string;
    }> = [];
    
    try {
      evidence = JSON.parse(task.evidence || "[]");
    } catch {
      evidence = [];
    }

    // Add new evidence item
    const evidenceItem = {
      id: uuidv4(),
      type, // email_sent, file_created, api_call, url_published, trade_executed, etc.
      description,
      url: url || undefined,
      data: data || undefined,
      added_at: new Date().toISOString(),
    };

    evidence.push(evidenceItem);

    // Update task with new evidence
    const updatedTask = updateTask(taskId, {
      evidence: JSON.stringify(evidence),
    });

    logActivity({
      id: uuidv4(),
      type: "evidence_added",
      task_id: taskId,
      message: `Evidence added: ${type} - ${description}`,
      metadata: { evidence_id: evidenceItem.id, evidence_type: type },
    });

    return NextResponse.json({ 
      evidence: evidenceItem, 
      task: updatedTask 
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add evidence", details: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/tasks/evidence?taskId=xxx - Get evidence for a task
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json(
      { error: "taskId is required" },
      { status: 400 }
    );
  }

  const task = getTask(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let evidence = [];
  try {
    evidence = JSON.parse(task.evidence || "[]");
  } catch {
    evidence = [];
  }

  return NextResponse.json({ evidence });
}
