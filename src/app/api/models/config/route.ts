import { NextResponse } from "next/server";
import { modelConfig, MODEL_TIERS, COMPLEXITY_LEVELS } from "@/lib/model-config";

/**
 * GET /api/models/config
 *
 * Returns the full model configuration including:
 * - Available model tiers with costs
 * - Complexity levels
 * - Per-agent model overrides
 * - Global defaults
 */
export async function GET() {
  try {
    const config = modelConfig.getFullConfig();
    return NextResponse.json(config);
  } catch (err) {
    console.error("[models/config] GET error:", err);
    return NextResponse.json(
      { error: "Failed to get model config" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/models/config
 *
 * Update model configuration
 * Body options:
 * - { agentId, complexity, modelId } - Set agent-specific model
 * - { globalDefault, complexity, modelId } - Set global default
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.agentId && body.complexity && body.modelId) {
      // Update agent-specific model
      modelConfig.setAgentModel(body.agentId, body.complexity, body.modelId);
      return NextResponse.json({ 
        success: true, 
        message: `Updated ${body.agentId} ${body.complexity} to ${body.modelId}` 
      });
    }

    if (body.globalDefault && body.complexity && body.modelId) {
      // Update global default
      modelConfig.setGlobalDefault(body.complexity, body.modelId);
      return NextResponse.json({ 
        success: true, 
        message: `Updated global ${body.complexity} to ${body.modelId}` 
      });
    }

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[models/config] POST error:", err);
    return NextResponse.json(
      { error: "Failed to update model config" },
      { status: 500 }
    );
  }
}
