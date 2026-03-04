import { NextRequest, NextResponse } from "next/server";
import {
  listPostMortems,
  createPostMortem,
  updatePostMortem,
  getPostMortemStats,
  FailureType,
} from "@/lib/db";
import { randomUUID } from "crypto";

// GET - List post-mortems with filters or get stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const task_id = searchParams.get("task_id") || undefined;
    const agent_id = searchParams.get("agent_id") || undefined;
    const failure_type = searchParams.get("failure_type") as FailureType | undefined;
    const implemented = searchParams.get("implemented");
    const since = searchParams.get("since") || undefined;
    const stats = searchParams.get("stats") === "true";
    const days = parseInt(searchParams.get("days") || "30", 10);

    // Return aggregated stats
    if (stats) {
      const statsData = getPostMortemStats(days);
      return NextResponse.json(statsData);
    }

    // Return filtered list
    const postMortems = listPostMortems({
      task_id,
      agent_id,
      failure_type,
      implemented: implemented === "true" ? true : implemented === "false" ? false : undefined,
      since,
    });
    
    return NextResponse.json({ postMortems });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch post-mortems", details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Create a new post-mortem
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      task_id,
      agent_id,
      failure_type,
      root_cause,
      what_was_tried,
      could_have_been_prevented,
      prevention_measure,
      affects_other_agents,
    } = body;

    if (!task_id || !failure_type || !root_cause) {
      return NextResponse.json(
        { error: "task_id, failure_type, and root_cause are required" },
        { status: 400 }
      );
    }

    const validTypes: FailureType[] = [
      'technical', 'capability_gap', 'bad_delegation', 
      'external_dependency', 'hallucination', 'confabulation',
      'memory_loss', 'timeout', 'other'
    ];
    
    if (!validTypes.includes(failure_type)) {
      return NextResponse.json(
        { error: `failure_type must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const id = randomUUID();
    const postMortem = createPostMortem({
      id,
      task_id,
      agent_id,
      failure_type,
      root_cause,
      what_was_tried,
      could_have_been_prevented,
      prevention_measure,
      affects_other_agents,
    });

    return NextResponse.json({ created: true, postMortem });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create post-mortem", details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH - Update post-mortem (mark as implemented, add prevention measure)
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { prevention_measure, implemented, reviewed_at } = body;

    const updated = updatePostMortem(id, {
      prevention_measure,
      implemented,
      reviewed_at: reviewed_at || (implemented ? new Date().toISOString() : undefined),
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Post-mortem not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ updated: true, postMortem: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update post-mortem", details: String(error) },
      { status: 500 }
    );
  }
}
