"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelInfo {
  id: string;
  name: string;
  costPer1k: number;
}

interface TierInfo {
  name: string;
  models: ModelInfo[];
  description: string;
}

interface ComplexityInfo {
  name: string;
  description: string;
  defaultTier: string;
  examples: string[];
}

interface AgentConfig {
  agentId: string;
  name: string;
  defaultComplexity: string;
  modelOverrides: Record<string, string>;
}

interface ModelConfig {
  tiers: Record<string, TierInfo>;
  complexityLevels: Record<string, ComplexityInfo>;
  agents: AgentConfig[];
  globalDefaults: Record<string, string>;
  lastUpdated: string;
}

function formatCost(costPer1k: number): string {
  if (costPer1k === 0) return "FREE";
  if (costPer1k < 0.001) return `$${(costPer1k * 1000).toFixed(4)}/M`;
  return `$${costPer1k.toFixed(4)}/1K`;
}

function getTierBadgeColor(tierName: string): string {
  switch (tierName) {
    case "free": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "cheap": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "standard": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "premium": return "bg-red-500/20 text-red-400 border-red-500/30";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export function ModelManagement() {
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const res = await fetch("/api/models/config");
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function updateModel(agentId: string, complexity: string, modelId: string) {
    setSaving(`${agentId}-${complexity}`);
    try {
      const res = await fetch("/api/models/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, complexity, modelId }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchConfig();
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setSaving(null);
    }
  }

  async function updateGlobalDefault(complexity: string, modelId: string) {
    setSaving(`global-${complexity}`);
    try {
      const res = await fetch("/api/models/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalDefault: true, complexity, modelId }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchConfig();
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="p-4 text-zinc-400">Loading model config...</div>;
  if (error) return <div className="p-4 text-red-400">Error: {error}</div>;
  if (!config) return null;

  // Flatten all models for selection
  const allModels: ModelInfo[] = [];
  for (const tier of Object.values(config.tiers)) {
    allModels.push(...tier.models);
  }

  return (
    <div className="flex-1 overflow-auto min-h-0 p-4 space-y-4">
      {/* Model Tiers Reference */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">Model Tiers & Costs</CardTitle>
          <CardDescription>Reference for model pricing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(config.tiers).map(([tierName, tier]) => (
              <div key={tierName} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                  <Badge className={getTierBadgeColor(tierName)}>{tier.name}</Badge>
                </div>
                <p className="text-xs text-zinc-400 mb-2">{tier.description}</p>
                <div className="space-y-1">
                  {tier.models.map((model) => (
                    <div key={model.id} className="flex justify-between text-sm">
                      <span className="text-zinc-300 truncate max-w-[140px]">{model.name}</span>
                      <span className={model.costPer1k === 0 ? "text-green-400 font-medium" : "text-zinc-400"}>
                        {formatCost(model.costPer1k)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Complexity Levels */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">Complexity Levels</CardTitle>
          <CardDescription>Task complexity determines default model tier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(config.complexityLevels).map(([level, info]) => (
              <div key={level} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                <h4 className="font-medium text-white mb-1">{info.name}</h4>
                <p className="text-xs text-zinc-400 mb-2">{info.description}</p>
                <div className="flex flex-wrap gap-1">
                  {info.examples.map((ex) => (
                    <span key={ex} className="text-xs bg-zinc-700 px-2 py-0.5 rounded text-zinc-300">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Global Defaults */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">Global Defaults</CardTitle>
          <CardDescription>Default model for each complexity when agent has no override</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(config.complexityLevels).map(([level, info]) => (
              <div key={level} className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">{info.name}</label>
                <Select
                  value={config.globalDefaults[level] || ""}
                  onValueChange={(value) => updateGlobalDefault(level, value)}
                  disabled={saving === `global-${level}`}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue placeholder="Select model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name} ({formatCost(model.costPer1k)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-Agent Configuration */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">Agent Model Overrides</CardTitle>
          <CardDescription>Customize which model each agent uses per complexity level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {config.agents.map((agent) => (
              <div key={agent.agentId} className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <h4 className="font-medium text-white mb-4">{agent.name}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.keys(config.complexityLevels).map((level) => {
                    const currentModel = agent.modelOverrides[level] || config.globalDefaults[level] || "";
                    const isOverridden = !!agent.modelOverrides[level];
                    return (
                      <div key={level} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-zinc-300">{level}</label>
                          {isOverridden && (
                            <Badge variant="outline" className="text-xs">custom</Badge>
                          )}
                        </div>
                        <Select
                          value={currentModel}
                          onValueChange={(value) => updateModel(agent.agentId, level, value)}
                          disabled={saving === `${agent.agentId}-${level}`}
                        >
                          <SelectTrigger className="bg-zinc-800 border-zinc-700">
                            <SelectValue placeholder="Use global default" />
                          </SelectTrigger>
                          <SelectContent>
                            {allModels.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name} ({formatCost(model.costPer1k)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-zinc-500 text-center">
        Last updated: {new Date(config.lastUpdated).toLocaleString()}
      </p>
    </div>
  );
}
