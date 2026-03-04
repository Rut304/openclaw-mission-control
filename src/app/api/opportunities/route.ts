import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

const OPPORTUNITIES_DIR = path.resolve(
  process.env.HOME || "/Users/rutroh",
  "shared-context/opportunities"
);

function readJsonFile(filePath: string): unknown[] {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function writeJsonFile(filePath: string, data: unknown[]): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// GET - List opportunities
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status"); // identified | evaluated | all
    const type = searchParams.get("type"); // revenue | optimization | strategic

    const identifiedPath = path.join(OPPORTUNITIES_DIR, "identified.json");
    const evaluatedPath = path.join(OPPORTUNITIES_DIR, "evaluated.json");

    let results: unknown[] = [];

    if (!status || status === "all" || status === "identified") {
      results = results.concat(
        readJsonFile(identifiedPath).map((o) => ({
          ...(o as Record<string, unknown>),
          _status: "identified",
        }))
      );
    }
    if (!status || status === "all" || status === "evaluated") {
      results = results.concat(
        readJsonFile(evaluatedPath).map((o) => ({
          ...(o as Record<string, unknown>),
          _status: "evaluated",
        }))
      );
    }

    if (type) {
      results = results.filter(
        (o) => (o as Record<string, unknown>).type === type
      );
    }

    return NextResponse.json({ opportunities: results, count: results.length });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch opportunities", details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Log a new opportunity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      type,
      trigger,
      source,
      estimated_value,
      effort_required,
      estimated_cost,
      resources_needed,
      risk_assessment,
      recommended_action,
      requires_chairman_approval,
    } = body;

    if (!title || !type || !trigger) {
      return NextResponse.json(
        {
          error:
            "title, type, and trigger are required. Every opportunity must have a real-world trigger.",
        },
        { status: 400 }
      );
    }

    const validTypes = ["revenue", "optimization", "strategic"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const validEfforts = ["low", "medium", "high"];
    if (effort_required && !validEfforts.includes(effort_required)) {
      return NextResponse.json(
        { error: `effort_required must be one of: ${validEfforts.join(", ")}` },
        { status: 400 }
      );
    }

    const opportunity = {
      opportunity_id: randomUUID(),
      title,
      type,
      trigger,
      source: source || "agent",
      estimated_value: estimated_value || "unknown",
      effort_required: effort_required || "medium",
      estimated_cost: estimated_cost || "unknown",
      resources_needed: resources_needed || [],
      risk_assessment: risk_assessment || "",
      recommended_action: recommended_action || "",
      requires_chairman_approval: requires_chairman_approval ?? false,
      created_at: new Date().toISOString(),
      status: "identified",
    };

    const identifiedPath = path.join(OPPORTUNITIES_DIR, "identified.json");
    const existing = readJsonFile(identifiedPath) as Record<string, unknown>[];
    existing.push(opportunity);
    writeJsonFile(identifiedPath, existing);

    return NextResponse.json({ created: true, opportunity });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create opportunity", details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH - Evaluate/update an opportunity
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { opportunity_id, evaluation, decision } = body;

    if (!opportunity_id) {
      return NextResponse.json(
        { error: "opportunity_id is required" },
        { status: 400 }
      );
    }

    const identifiedPath = path.join(OPPORTUNITIES_DIR, "identified.json");
    const evaluatedPath = path.join(OPPORTUNITIES_DIR, "evaluated.json");

    const identified = readJsonFile(identifiedPath) as Record<string, unknown>[];
    const evaluated = readJsonFile(evaluatedPath) as Record<string, unknown>[];

    const idx = identified.findIndex(
      (o) => o.opportunity_id === opportunity_id
    );

    if (idx === -1) {
      // Check if already evaluated
      const evalIdx = evaluated.findIndex(
        (o) => o.opportunity_id === opportunity_id
      );
      if (evalIdx !== -1) {
        // Update existing evaluation
        evaluated[evalIdx] = {
          ...evaluated[evalIdx],
          ...body,
          updated_at: new Date().toISOString(),
        };
        writeJsonFile(evaluatedPath, evaluated);
        return NextResponse.json({ updated: true, opportunity: evaluated[evalIdx] });
      }
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Move from identified to evaluated
    const opp = {
      ...identified[idx],
      evaluation: evaluation || "",
      decision: decision || "pending", // pursue | reject | defer
      evaluated_at: new Date().toISOString(),
      status: "evaluated",
    };

    identified.splice(idx, 1);
    evaluated.push(opp);

    writeJsonFile(identifiedPath, identified);
    writeJsonFile(evaluatedPath, evaluated);

    return NextResponse.json({ evaluated: true, opportunity: opp });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to evaluate opportunity", details: String(error) },
      { status: 500 }
    );
  }
}
