/**
 * Cost Tracking Library
 * Aggregates API usage from Anthropic, Gemini, OpenRouter, Langfuse, and per-request tracking
 */

import fs from 'fs/promises';
import path from 'path';

interface CostBreakdown {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  requests: number;
}

interface UsageSummary {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  breakdown: CostBreakdown[];
  period: string;
  lastUpdated: string;
  anthropicUsage?: any;
  geminiUsage?: any;
  openRouterCredits?: any;
}

// Pricing per 1M tokens (as of Feb 2026)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.0 },
  // OpenRouter format
  'anthropic/claude-opus-4': { input: 15.0, output: 75.0 },
  'anthropic/claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  // Gemini
  'gemini-2.5-pro': { input: 1.25, output: 5.0 },
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'google/gemini-2.5-pro': { input: 1.25, output: 5.0 },
  'google/gemini-2.0-flash': { input: 0.1, output: 0.4 },
  // OpenAI
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  // DeepSeek
  'deepseek/deepseek-chat': { input: 0.14, output: 0.28 },
  // Local
  'ollama/llama3.1:8b': { input: 0, output: 0 },
};

// Usage log file path
const USAGE_LOG_PATH = process.env.HOME + '/.rutroh/usage-log.json';

interface UsageLogEntry {
  timestamp: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  source: string;
}

/**
 * Log a usage entry (called from API wrapper)
 */
export async function logUsage(entry: Omit<UsageLogEntry, 'timestamp'>): Promise<void> {
  try {
    const logDir = path.dirname(USAGE_LOG_PATH);
    await fs.mkdir(logDir, { recursive: true });
    
    let log: UsageLogEntry[] = [];
    try {
      const content = await fs.readFile(USAGE_LOG_PATH, 'utf-8');
      log = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }
    
    log.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
    
    // Keep only last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    log = log.filter(e => new Date(e.timestamp).getTime() > thirtyDaysAgo);
    
    await fs.writeFile(USAGE_LOG_PATH, JSON.stringify(log, null, 2));
  } catch (err) {
    console.error('[CostTracking] Failed to log usage:', err);
  }
}

/**
 * Get usage from local log file
 */
export async function getLocalUsageLog(since: Date): Promise<CostBreakdown[]> {
  try {
    const content = await fs.readFile(USAGE_LOG_PATH, 'utf-8');
    const log: UsageLogEntry[] = JSON.parse(content);
    
    const aggregated: Record<string, CostBreakdown> = {};
    
    for (const entry of log) {
      if (new Date(entry.timestamp) < since) continue;
      
      const key = `${entry.provider}/${entry.model}`;
      if (!aggregated[key]) {
        aggregated[key] = {
          provider: entry.provider,
          model: entry.model,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          requests: 0,
        };
      }
      
      aggregated[key].inputTokens += entry.inputTokens;
      aggregated[key].outputTokens += entry.outputTokens;
      aggregated[key].cost += entry.cost;
      aggregated[key].requests += 1;
    }
    
    return Object.values(aggregated);
  } catch {
    return [];
  }
}

/**
 * Fetch usage from Anthropic Admin API
 * Note: Requires ANTHROPIC_ADMIN_API_KEY with billing:read permission
 * https://docs.anthropic.com/en/api/admin-api-usage
 */
export async function getAnthropicUsage(since: Date): Promise<{
  breakdown: CostBreakdown[];
  rawData: any;
} | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const adminKey = process.env.ANTHROPIC_ADMIN_API_KEY;
  
  // Check for admin key first (preferred for usage data)
  const keyToUse = adminKey || apiKey;
  
  if (!keyToUse) {
    console.warn('[CostTracking] No ANTHROPIC_API_KEY configured');
    return null;
  }

  try {
    // Try the admin usage endpoint first
    const usageResponse = await fetch('https://api.anthropic.com/v1/usage', {
      headers: {
        'x-api-key': keyToUse,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });

    if (usageResponse.ok) {
      const data = await usageResponse.json();
      const breakdown: CostBreakdown[] = [];
      
      // Parse usage data if available
      if (data.daily_usage) {
        const aggregated: Record<string, CostBreakdown> = {};
        
        for (const day of data.daily_usage) {
          const dayDate = new Date(day.date);
          if (dayDate < since) continue;
          
          for (const modelUsage of day.models || []) {
            const model = modelUsage.model || 'claude-unknown';
            if (!aggregated[model]) {
              aggregated[model] = {
                provider: 'anthropic',
                model,
                inputTokens: 0,
                outputTokens: 0,
                cost: 0,
                requests: 0,
              };
            }
            
            const inputTokens = modelUsage.input_tokens || 0;
            const outputTokens = modelUsage.output_tokens || 0;
            const pricing = MODEL_PRICING[model] || { input: 3.0, output: 15.0 };
            const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
            
            aggregated[model].inputTokens += inputTokens;
            aggregated[model].outputTokens += outputTokens;
            aggregated[model].cost += cost;
            aggregated[model].requests += modelUsage.request_count || 1;
          }
        }
        
        return { breakdown: Object.values(aggregated), rawData: data };
      }
      
      return { breakdown, rawData: data };
    }
    
    // Fallback: estimate from recent API calls in log
    console.warn('[CostTracking] Anthropic usage API not available (may need admin key)');
    return null;
  } catch (err) {
    console.error('[CostTracking] Anthropic usage fetch error:', err);
    return null;
  }
}

/**
 * Fetch usage from Google Gemini/AI Studio
 * Note: Google AI Studio doesn't have a direct usage API, so we track locally
 * For Vertex AI, use the Cloud Billing API
 */
export async function getGeminiUsage(since: Date): Promise<{
  breakdown: CostBreakdown[];
  rawData: any;
} | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('[CostTracking] No GEMINI_API_KEY configured');
    return null;
  }

  // Google AI Studio doesn't have usage API, check local logs instead
  // Return null to indicate we need to use local tracking
  return null;
}

/**
 * Fetch credits/usage from OpenRouter
 */
export async function getOpenRouterUsage(): Promise<{
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
} | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[CostTracking] No OPENROUTER_API_KEY configured');
    return null;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[CostTracking] OpenRouter credits API error:', response.status);
      return null;
    }

    const data = await response.json();
    return {
      totalCredits: data.data?.total_credits || 0,
      usedCredits: data.data?.total_usage || 0,
      remainingCredits: (data.data?.total_credits || 0) - (data.data?.total_usage || 0),
    };
  } catch (err) {
    console.error('[CostTracking] OpenRouter fetch error:', err);
    return null;
  }
}

/**
 * Fetch usage traces from Langfuse
 */
export async function getLangfuseUsage(options?: {
  since?: Date;
  limit?: number;
}): Promise<CostBreakdown[]> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'http://localhost:3002';

  if (!publicKey || !secretKey) {
    console.warn('[CostTracking] Langfuse credentials not configured');
    return [];
  }

  try {
    const authHeader = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    const since = options?.since || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const limit = options?.limit || 1000;

    // Get traces from Langfuse
    const response = await fetch(
      `${baseUrl}/api/public/traces?limit=${limit}&fromTimestamp=${since.toISOString()}`,
      {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('[CostTracking] Langfuse API error:', response.status);
      return [];
    }

    const data = await response.json();
    const traces = data.data || [];

    // Aggregate by model
    const aggregated: Record<string, CostBreakdown> = {};

    for (const trace of traces) {
      const model = trace.model || 'unknown';
      const inputTokens = trace.usage?.input || trace.promptTokens || 0;
      const outputTokens = trace.usage?.output || trace.completionTokens || 0;
      
      const provider = model.split('/')[0] || 'unknown';
      const pricing = MODEL_PRICING[model] || { input: 1.0, output: 3.0 };
      const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

      if (!aggregated[model]) {
        aggregated[model] = {
          provider,
          model,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          requests: 0,
        };
      }

      aggregated[model].inputTokens += inputTokens;
      aggregated[model].outputTokens += outputTokens;
      aggregated[model].cost += cost;
      aggregated[model].requests += 1;
    }

    return Object.values(aggregated);
  } catch (err) {
    console.error('[CostTracking] Langfuse fetch error:', err);
    return [];
  }
}

/**
 * Get aggregated usage from OpenClaw gateway logs
 */
export async function getOpenClawUsage(): Promise<CostBreakdown[]> {
  const { execSync } = require('child_process');
  
  try {
    // Parse OpenClaw session logs for usage data
    const logPath = process.env.HOME + '/.openclaw/logs';
    const result = execSync(
      `find ${logPath} -name "*.log" -mtime -1 -exec grep -h "usage" {} \\; 2>/dev/null | tail -100`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 }
    );

    const aggregated: Record<string, CostBreakdown> = {};
    const lines = result.split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        // Try to parse JSON log entries
        const match = line.match(/\{.*"usage".*\}/);
        if (match) {
          const data = JSON.parse(match[0]);
          const model = data.model || 'unknown';
          const inputTokens = data.usage?.input_tokens || data.usage?.prompt_tokens || 0;
          const outputTokens = data.usage?.output_tokens || data.usage?.completion_tokens || 0;
          
          const provider = model.split('/')[0] || 'unknown';
          const pricing = MODEL_PRICING[model] || { input: 1.0, output: 3.0 };
          const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

          if (!aggregated[model]) {
            aggregated[model] = {
              provider,
              model,
              inputTokens: 0,
              outputTokens: 0,
              cost: 0,
              requests: 0,
            };
          }

          aggregated[model].inputTokens += inputTokens;
          aggregated[model].outputTokens += outputTokens;
          aggregated[model].cost += cost;
          aggregated[model].requests += 1;
        }
      } catch {
        // Skip unparseable lines
      }
    }

    return Object.values(aggregated);
  } catch (err) {
    console.error('[CostTracking] OpenClaw log parse error:', err);
    return [];
  }
}

/**
 * Get subscription costs (fixed monthly)
 */
export function getSubscriptionCosts(): CostBreakdown[] {
  // These should be configured in a database or config file
  // For now, returning known subscriptions
  return [
    {
      provider: 'vercel',
      model: 'hosting',
      inputTokens: 0,
      outputTokens: 0,
      cost: 0, // Free tier
      requests: 0,
    },
    {
      provider: 'supabase',
      model: 'database',
      inputTokens: 0,
      outputTokens: 0,
      cost: 0, // Free tier
      requests: 0,
    },
  ];
}

/**
 * Get comprehensive usage summary
 */
export async function getUsageSummary(period: 'today' | 'week' | 'month' = 'today'): Promise<UsageSummary> {
  const periodDays = period === 'today' ? 1 : period === 'week' ? 7 : 30;
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // Gather from all sources in parallel
  const [
    openRouterUsage,
    langfuseBreakdown,
    openClawBreakdown,
    anthropicUsage,
    localLogBreakdown,
  ] = await Promise.all([
    getOpenRouterUsage(),
    getLangfuseUsage({ since }),
    getOpenClawUsage(),
    getAnthropicUsage(since),
    getLocalUsageLog(since),
  ]);

  // Merge breakdowns - priority: Anthropic API > Langfuse > Local Log > OpenClaw
  const modelMap: Record<string, CostBreakdown> = {};
  
  // Helper to merge breakdown into map
  const mergeBreakdown = (breakdown: CostBreakdown[], source: string) => {
    for (const b of breakdown) {
      const key = `${b.provider}/${b.model}`;
      if (!modelMap[key]) {
        modelMap[key] = { ...b };
      } else {
        // Skip if already have data from higher priority source
        // Could also merge by adding, but that risks double-counting
      }
    }
  };

  // Add Anthropic data first (highest priority)
  if (anthropicUsage?.breakdown) {
    mergeBreakdown(anthropicUsage.breakdown, 'anthropic-api');
  }
  
  // Then Langfuse
  mergeBreakdown(langfuseBreakdown, 'langfuse');
  
  // Then local log
  mergeBreakdown(localLogBreakdown, 'local-log');
  
  // Finally OpenClaw logs
  mergeBreakdown(openClawBreakdown, 'openclaw');

  const allBreakdowns = Object.values(modelMap);

  // Calculate totals
  const totalCost = allBreakdowns.reduce((sum, b) => sum + b.cost, 0);
  const totalTokens = allBreakdowns.reduce((sum, b) => sum + b.inputTokens + b.outputTokens, 0);
  const totalRequests = allBreakdowns.reduce((sum, b) => sum + b.requests, 0);

  return {
    totalCost,
    totalTokens,
    totalRequests,
    breakdown: allBreakdowns.sort((a, b) => b.cost - a.cost),
    period,
    lastUpdated: new Date().toISOString(),
    // Include raw provider data
    ...(openRouterUsage && { openRouterCredits: openRouterUsage }),
    ...(anthropicUsage?.rawData && { anthropicUsage: anthropicUsage.rawData }),
  };
}
