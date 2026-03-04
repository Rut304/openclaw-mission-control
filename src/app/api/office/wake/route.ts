import { NextResponse } from "next/server";
import { execSync } from "child_process";

const HOME = process.env.HOME || "/Users/rutroh";

// POST /api/office/wake - Wake all agents (CEO command)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || "CEO says get to work!";

    const result = execSync(
      `python3 ${HOME}/scripts/wake-agents.py "${reason.replace(/"/g, '\\"')}"`,
      { encoding: "utf-8", timeout: 10000 }
    );

    const parsed = JSON.parse(result.trim());
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to wake agents", details: String(error) },
      { status: 500 }
    );
  }
}
