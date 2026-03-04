/**
 * Model Management Configuration
 * 
 * Centralized model routing based on:
 * - Task complexity (simple → complex)
 * - Agent type (ceo, cto, worker, research)
 * - Cost tiers (free → premium)
 */

import fs from "fs";
import path from "path";

// Model cost tiers with pricing info
export const MODEL_TIERS = {
  free: {
    name: "FREE (Local)",
    models: [
      { id: "ollama/llama3.1:8b", name: "Llama 3.1 8B", costPer1k: 0 },
      { id: "ollama/mistral:7b", name: "Mistral 7B", costPer1k: 0 },
      { id: "ollama/codellama:13b", name: "Code Llama 13B", costPer1k: 0 },
    ],
    description: "Local Ollama models - no API cost, limited capability",
  },
  cheap: {
    name: "Budget ($)",
    models: [
      { id: "openrouter/deepseek/deepseek-chat", name: "DeepSeek Chat", costPer1k: 0.0001 },
      { id: "openrouter/google/gemini-2.0-flash", name: "Gemini 2.0 Flash", costPer1k: 0.0005 },
    ],
    description: "Fast, cheap models for routine tasks",
  },
  standard: {
    name: "Standard ($$)",
    models: [
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", costPer1k: 0.00125 },
      { id: "openrouter/anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4", costPer1k: 0.003 },
    ],
    description: "Balanced capability and cost",
  },
  premium: {
    name: "Premium ($$$)",
    models: [
      { id: "anthropic/claude-opus-4-6", name: "Claude Opus 4", costPer1k: 0.015 },
      { id: "openrouter/openai/gpt-4o", name: "GPT-4o", costPer1k: 0.0025 },
    ],
    description: "Maximum capability, use sparingly",
  },
};

// Complexity levels - BUDGET FIRST: Start cheap, escalate only when needed
export const COMPLEXITY_LEVELS = {
  trivial: {
    name: "Trivial",
    description: "Status checks, simple lookups, file reads",
    defaultTier: "free",
    examples: ["heartbeat checks", "read config", "list files"],
  },
  simple: {
    name: "Simple",
    description: "Single-step tasks, formatting, basic analysis",
    defaultTier: "free",  // START FREE - escalate if needed
    examples: ["format data", "simple cron jobs", "status reports"],
  },
  moderate: {
    name: "Moderate", 
    description: "Multi-step tasks, code review, content creation",
    defaultTier: "cheap",  // START CHEAP - only escalate for quality issues
    examples: ["write blog post", "review PR", "debug issue"],
  },
  complex: {
    name: "Complex",
    description: "Architecture, security review, critical decisions",
    defaultTier: "standard",  // START STANDARD - premium only for critical
    examples: ["design system", "security audit", "major refactor"],
  },
};

/**
 * BUDGET-FIRST MODEL ROUTING PHILOSOPHY:
 * 
 * Agents should START with the cheapest viable model and only escalate when:
 * 1. Task explicitly requires advanced reasoning (math, code architecture)
 * 2. Previous attempt with cheaper model failed
 * 3. Output quality is visibly poor
 * 4. Security/financial implications require extra caution
 * 
 * This embeds in the agent prompt via MODEL_ROUTING.md instructions.
 */

// Agent types with their default model preferences
export interface AgentModelConfig {
  agentId: string;
  name: string;
  defaultComplexity: keyof typeof COMPLEXITY_LEVELS;
  modelOverrides: {
    [complexity: string]: string; // complexity -> model ID
  };
}

const CONFIG_FILE = path.join(process.cwd(), "data", "model-config.json");

interface ModelConfigData {
  agents: AgentModelConfig[];
  globalDefaults: {
    [complexity: string]: string;
  };
  lastUpdated: string;
}

class ModelConfigManager {
  private config: ModelConfigData;

  constructor() {
    this.config = this.loadConfig();
  }

  private getDefaultConfig(): ModelConfigData {
    return {
      agents: [
        {
          agentId: "rip",
          name: "Rip (COO)",
          defaultComplexity: "moderate",
          modelOverrides: {
            complex: "anthropic/claude-opus-4-6",
          },
        },
        {
          agentId: "rex",
          name: "Rex (CTO)",
          defaultComplexity: "moderate",
          modelOverrides: {
            complex: "anthropic/claude-opus-4-6",
            moderate: "google/gemini-2.5-pro",
          },
        },
        {
          agentId: "worker",
          name: "Worker",
          defaultComplexity: "simple",
          modelOverrides: {
            simple: "openrouter/deepseek/deepseek-chat",
            moderate: "google/gemini-2.5-pro",
          },
        },
        {
          agentId: "ria",
          name: "Ria (Research)",
          defaultComplexity: "moderate",
          modelOverrides: {
            moderate: "google/gemini-2.5-pro",
          },
        },
      ],
      globalDefaults: {
        trivial: "ollama/llama3.1:8b",
        simple: "ollama/llama3.1:8b",  // Budget first - try free
        moderate: "openrouter/deepseek/deepseek-chat",  // Budget first - try cheap
        complex: "google/gemini-2.5-pro",  // Budget first - standard before premium
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  private loadConfig(): ModelConfigData {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      }
    } catch (err) {
      console.error("[ModelConfig] Failed to load config:", err);
    }
    return this.getDefaultConfig();
  }

  private saveConfig(): void {
    this.config.lastUpdated = new Date().toISOString();
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  /**
   * Get the model to use for a given agent and complexity
   */
  getModel(agentId: string, complexity: keyof typeof COMPLEXITY_LEVELS): string {
    const agent = this.config.agents.find((a) => a.agentId === agentId);
    
    // Check agent-specific override
    if (agent?.modelOverrides[complexity]) {
      return agent.modelOverrides[complexity];
    }

    // Fall back to global default
    return this.config.globalDefaults[complexity] || "google/gemini-2.5-pro";
  }

  /**
   * Get all agents and their configs
   */
  getAgents(): AgentModelConfig[] {
    return this.config.agents;
  }

  /**
   * Update an agent's model for a complexity level
   */
  setAgentModel(
    agentId: string,
    complexity: string,
    modelId: string
  ): boolean {
    const agent = this.config.agents.find((a) => a.agentId === agentId);
    if (!agent) {
      // Create new agent config
      this.config.agents.push({
        agentId,
        name: agentId,
        defaultComplexity: "moderate",
        modelOverrides: { [complexity]: modelId },
      });
    } else {
      agent.modelOverrides[complexity] = modelId;
    }
    this.saveConfig();
    return true;
  }

  /**
   * Update global default for a complexity level
   */
  setGlobalDefault(complexity: string, modelId: string): void {
    this.config.globalDefaults[complexity] = modelId;
    this.saveConfig();
  }

  /**
   * Get model cost info
   */
  getModelCost(modelId: string): { tier: string; costPer1k: number } | null {
    for (const [tierName, tier] of Object.entries(MODEL_TIERS)) {
      const model = tier.models.find((m) => m.id === modelId);
      if (model) {
        return { tier: tierName, costPer1k: model.costPer1k };
      }
    }
    return null;
  }

  /**
   * Get full config for UI
   */
  getFullConfig() {
    return {
      tiers: MODEL_TIERS,
      complexityLevels: COMPLEXITY_LEVELS,
      agents: this.config.agents,
      globalDefaults: this.config.globalDefaults,
      lastUpdated: this.config.lastUpdated,
    };
  }
}

export const modelConfig = new ModelConfigManager();
