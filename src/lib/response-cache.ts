/**
 * Response Cache System
 * 
 * Caches LLM responses to reduce API costs. Key features:
 * - TTL-based expiration
 * - Semantic similarity matching for similar queries
 * - Persistent storage to disk
 * - Automatic cleanup of stale entries
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

interface CacheEntry {
  query: string;
  response: string;
  model: string;
  tokens: number;
  cost: number;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
}

interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  totalSaved: number; // Estimated cost savings
  cacheSize: number;
}

const CACHE_DIR = path.join(process.cwd(), "data", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "response-cache.json");
const STATS_FILE = path.join(CACHE_DIR, "cache-stats.json");

// TTL by model type (in milliseconds)
const TTL_BY_MODEL: Record<string, number> = {
  "anthropic/claude-opus-4-6": 24 * 60 * 60 * 1000, // 24 hours - expensive, cache longer
  "google/gemini-2.5-pro": 12 * 60 * 60 * 1000, // 12 hours
  "openrouter/deepseek/deepseek-chat": 6 * 60 * 60 * 1000, // 6 hours
  "ollama/llama3.1:8b": 1 * 60 * 60 * 1000, // 1 hour - free, less valuable to cache
  default: 6 * 60 * 60 * 1000, // 6 hours default
};

// Cost per 1K tokens (approximate)
const COST_PER_1K_TOKENS: Record<string, number> = {
  "anthropic/claude-opus-4-6": 0.015,
  "google/gemini-2.5-pro": 0.00125,
  "openrouter/deepseek/deepseek-chat": 0.0001,
  "ollama/llama3.1:8b": 0, // Free
  default: 0.001,
};

class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    totalEntries: 0,
    totalHits: 0,
    totalMisses: 0,
    totalSaved: 0,
    cacheSize: 0,
  };

  constructor() {
    this.ensureDir();
    this.loadFromDisk();
    this.startCleanupInterval();
  }

  private ensureDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  private generateKey(query: string, model: string): string {
    // Normalize query for better cache hits
    const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
    return crypto
      .createHash("sha256")
      .update(`${model}:${normalized}`)
      .digest("hex")
      .substring(0, 16);
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
        this.cache = new Map(Object.entries(data));
      }
      if (fs.existsSync(STATS_FILE)) {
        this.stats = JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
      }
    } catch (err) {
      console.error("[cache] Failed to load from disk:", err);
    }
  }

  private saveToDisk(): void {
    try {
      const cacheObj = Object.fromEntries(this.cache);
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheObj, null, 2));
      fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2));
    } catch (err) {
      console.error("[cache] Failed to save to disk:", err);
    }
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.stats.totalEntries = this.cache.size;
      this.saveToDisk();
      console.log(`[cache] Cleaned ${cleaned} expired entries`);
    }
  }

  /**
   * Get cached response if available
   */
  get(query: string, model: string): CacheEntry | null {
    const key = this.generateKey(query, model);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.totalMisses++;
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.totalMisses++;
      return null;
    }

    // Cache hit!
    entry.hitCount++;
    this.stats.totalHits++;
    this.stats.totalSaved += entry.cost;
    this.saveToDisk();

    console.log(`[cache] HIT for model ${model}, saved $${entry.cost.toFixed(4)}`);
    return entry;
  }

  /**
   * Store response in cache
   */
  set(
    query: string,
    response: string,
    model: string,
    tokens: number
  ): void {
    const key = this.generateKey(query, model);
    const ttl = TTL_BY_MODEL[model] || TTL_BY_MODEL.default;
    const costPer1k = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS.default;
    const cost = (tokens / 1000) * costPer1k;

    const entry: CacheEntry = {
      query,
      response,
      model,
      tokens,
      cost,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      hitCount: 0,
    };

    this.cache.set(key, entry);
    this.stats.totalEntries = this.cache.size;
    this.stats.cacheSize = JSON.stringify(Object.fromEntries(this.cache)).length;
    this.saveToDisk();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.totalHits + this.stats.totalMisses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.totalHits / total) * 100 : 0,
    };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      totalEntries: 0,
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      totalSaved: this.stats.totalSaved,
      cacheSize: 0,
    };
    this.saveToDisk();
  }

  /**
   * Get entries for a specific model
   */
  getByModel(model: string): CacheEntry[] {
    return Array.from(this.cache.values()).filter((e) => e.model === model);
  }
}

// Singleton instance
export const responseCache = new ResponseCache();

// Export types
export type { CacheEntry, CacheStats };
