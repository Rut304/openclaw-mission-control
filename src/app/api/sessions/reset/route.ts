import { NextRequest, NextResponse } from "next/server";
import { OpenClawClient } from "@/lib/openclaw-client";

function getClient() {
  return new OpenClawClient(
    process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789",
    { authToken: process.env.OPENCLAW_AUTH_TOKEN || "" }
  );
}

/**
 * POST /api/sessions/reset — reset (clear) a session's conversation history
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key } = body;

    if (!key?.trim()) {
      return NextResponse.json(
        { error: "Session key is required" },
        { status: 400 }
      );
    }

    const client = getClient();
    const result = await client.resetSession(key.trim());
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    console.error("[sessions/reset] Error:", err);
    return NextResponse.json(
      { error: "Failed to reset session", detail: String(err) },
      { status: 500 }
    );
  }
}
