/**
 * Anthropic API Usage Client
 * Fetches real-time rate limit / usage info from Anthropic API headers
 */

interface AnthropicRateLimits {
  inputTokensLimit: number;
  inputTokensRemaining: number;
  inputTokensReset: string;
  outputTokensLimit: number;
  outputTokensRemaining: number;
  outputTokensReset: string;
  requestsLimit: number;
  requestsRemaining: number;
  requestsReset: string;
}

interface AnthropicUsageSnapshot {
  rateLimits: AnthropicRateLimits;
  modelId: string;
  // Calculated fields
  inputTokensUsed: number;
  outputTokensUsed: number;
  inputUtilizationPct: number;
  outputUtilizationPct: number;
  requestsUsed: number;
  requestsUtilizationPct: number;
  // Cost estimate based on tokens used this window
  estimatedCostUsd: number;
  fetchedAt: string;
}

// Anthropic pricing per 1M tokens
const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
};

/**
 * Ping Anthropic API with minimal tokens to get rate limit headers
 */
export async function getAnthropicUsage(
  model: string = 'claude-haiku-4-5-20251001'
): Promise<AnthropicUsageSnapshot | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[Anthropic] No ANTHROPIC_API_KEY configured');
    return null;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Anthropic] API error:', response.status, errorText);
      return null;
    }

    // Parse rate limit headers
    const headers = response.headers;
    const rateLimits: AnthropicRateLimits = {
      inputTokensLimit: parseInt(headers.get('anthropic-ratelimit-input-tokens-limit') || '0'),
      inputTokensRemaining: parseInt(headers.get('anthropic-ratelimit-input-tokens-remaining') || '0'),
      inputTokensReset: headers.get('anthropic-ratelimit-input-tokens-reset') || '',
      outputTokensLimit: parseInt(headers.get('anthropic-ratelimit-output-tokens-limit') || '0'),
      outputTokensRemaining: parseInt(headers.get('anthropic-ratelimit-output-tokens-remaining') || '0'),
      outputTokensReset: headers.get('anthropic-ratelimit-output-tokens-reset') || '',
      requestsLimit: parseInt(headers.get('anthropic-ratelimit-requests-limit') || '0'),
      requestsRemaining: parseInt(headers.get('anthropic-ratelimit-requests-remaining') || '0'),
      requestsReset: headers.get('anthropic-ratelimit-requests-reset') || '',
    };

    const body = await response.json();
    const usage = body.usage || {};

    const inputTokensUsed = rateLimits.inputTokensLimit - rateLimits.inputTokensRemaining;
    const outputTokensUsed = rateLimits.outputTokensLimit - rateLimits.outputTokensRemaining;
    const requestsUsed = rateLimits.requestsLimit - rateLimits.requestsRemaining;

    // Get pricing for model
    const pricing = ANTHROPIC_PRICING[model] || ANTHROPIC_PRICING['claude-sonnet-4-20250514'];
    const estimatedCostUsd = (inputTokensUsed * pricing.input + outputTokensUsed * pricing.output) / 1_000_000;

    return {
      rateLimits,
      modelId: model,
      inputTokensUsed,
      outputTokensUsed,
      inputUtilizationPct: rateLimits.inputTokensLimit > 0
        ? (inputTokensUsed / rateLimits.inputTokensLimit) * 100
        : 0,
      outputUtilizationPct: rateLimits.outputTokensLimit > 0
        ? (outputTokensUsed / rateLimits.outputTokensLimit) * 100
        : 0,
      requestsUsed,
      requestsUtilizationPct: rateLimits.requestsLimit > 0
        ? (requestsUsed / rateLimits.requestsLimit) * 100
        : 0,
      estimatedCostUsd,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[Anthropic] Usage fetch error:', err);
    return null;
  }
}

/**
 * Get Anthropic usage WITHOUT making an API call (cached/static info)
 * Use this when you just want to display plan info without spending tokens
 */
export function getAnthropicPlanInfo(): {
  plan: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  requestsPerMinute: number;
  models: string[];
  monthlyBudget: number;
  currentSpend: number;
} {
  return {
    plan: 'Claude Max',
    inputTokenLimit: 2_000_000,
    outputTokenLimit: 400_000,
    requestsPerMinute: 4_000,
    models: Object.keys(ANTHROPIC_PRICING),
    monthlyBudget: parseFloat(process.env.MONTHLY_API_BUDGET_USD || '500'),
    currentSpend: parseFloat(process.env.CURRENT_SPEND || '19'),
  };
}

export { ANTHROPIC_PRICING };
export type { AnthropicRateLimits, AnthropicUsageSnapshot };
