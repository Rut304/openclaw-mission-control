"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Workflow,
  Play,
  Pause,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Settings,
  Zap,
  Database,
  GitBranch,
  Code,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Types
interface WorkflowNode {
  id: string;
  name: string;
  type: "trigger" | "action" | "logic" | "data";
  position: { x: number; y: number };
  config?: Record<string, unknown>;
}

interface WorkflowConnection {
  from: string;
  to: string;
}

interface WorkflowData {
  id: string;
  name: string;
  description?: string;
  status: "active" | "inactive" | "error";
  lastRun?: string;
  nextRun?: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

interface WorkflowExecution {
  id: string;
  status: "success" | "error" | "running";
  startedAt: string;
  stoppedAt?: string;
  duration?: number;
}

// Node icons
const NODE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  trigger: Zap,
  action: Play,
  logic: GitBranch,
  data: Database,
};

// Node colors
const NODE_COLORS: Record<string, string> = {
  trigger: "bg-green-500/20 border-green-500/40 text-green-400",
  action: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  logic: "bg-yellow-500/20 border-yellow-500/40 text-yellow-400",
  data: "bg-purple-500/20 border-purple-500/40 text-purple-400",
};

// Simple workflow diagram (horizontal flow)
export function WorkflowDiagram({
  workflow,
  compact = false,
  onClick,
}: {
  workflow: WorkflowData;
  compact?: boolean;
  onClick?: () => void;
}) {
  if (!workflow.nodes?.length) {
    return (
      <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
        <Workflow className="w-4 h-4 mr-2" />
        No workflow diagram
      </div>
    );
  }

  // Sort nodes by x position for left-to-right flow
  const sortedNodes = [...workflow.nodes].sort((a, b) => a.position.x - b.position.x);

  return (
    <div
      className={`p-4 bg-muted/20 rounded-lg overflow-x-auto ${
        onClick ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 min-w-max">
        {sortedNodes.map((node, index) => {
          const Icon = NODE_ICONS[node.type] || Play;
          const colorClass = NODE_COLORS[node.type] || NODE_COLORS.action;

          return (
            <div key={node.id} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colorClass}`}
              >
                <Icon className="w-4 h-4" />
                {!compact && <span className="text-sm font-medium">{node.name}</span>}
                {compact && (
                  <span className="text-xs font-medium">{node.name.substring(0, 12)}</span>
                )}
              </div>
              {index < sortedNodes.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Workflow card with details
export function WorkflowCard({
  workflow,
  onEdit,
  onToggle,
  onRun,
  showDetails = false,
}: {
  workflow: WorkflowData;
  onEdit?: () => void;
  onToggle?: () => void;
  onRun?: () => void;
  showDetails?: boolean;
}) {
  const [expanded, setExpanded] = useState(showDetails);
  const [loading, setLoading] = useState(false);

  const statusColors = {
    active: "bg-green-500/20 text-green-400",
    inactive: "bg-muted text-muted-foreground",
    error: "bg-red-500/20 text-red-400",
  };

  const handleToggle = async () => {
    if (!onToggle) return;
    setLoading(true);
    await onToggle();
    setLoading(false);
  };

  const handleRun = async () => {
    if (!onRun) return;
    setLoading(true);
    await onRun();
    setLoading(false);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Workflow className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-medium">{workflow.name}</h3>
            {workflow.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {workflow.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[workflow.status]}>{workflow.status}</Badge>
          {onRun && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRun}
              disabled={loading}
              className="gap-1"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Run
            </Button>
          )}
          {onToggle && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggle}
              disabled={loading}
            >
              {workflow.status === "active" ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Workflow diagram */}
          <WorkflowDiagram workflow={workflow} />

          {/* Metadata */}
          <div className="p-4 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last run: {workflow.lastRun || "Never"}
              </span>
              {workflow.nextRun && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Next: {workflow.nextRun}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onEdit && (
                <Button size="sm" variant="ghost" onClick={onEdit} className="gap-1 h-7">
                  <Settings className="w-3 h-3" />
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 h-7"
                onClick={() => window.open(`http://localhost:5678/workflow/${workflow.id}`, "_blank")}
              >
                <ExternalLink className="w-3 h-3" />
                Open in N8N
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Workflow detail modal
export function WorkflowDetailModal({
  workflow,
  open,
  onClose,
  onUpdate,
}: {
  workflow: WorkflowData | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: (workflow: WorkflowData) => void;
}) {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchExecutions = useCallback(async () => {
    if (!workflow) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/n8n?action=executions&id=${workflow.id}`);
      const data = await res.json();
      setExecutions(data.executions || []);
    } catch (err) {
      console.error("Failed to fetch executions:", err);
    } finally {
      setLoading(false);
    }
  }, [workflow]);

  useEffect(() => {
    if (open && workflow) {
      fetchExecutions();
    }
  }, [open, workflow, fetchExecutions]);

  if (!workflow) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-primary" />
            {workflow.name}
          </DialogTitle>
          <DialogDescription>
            {workflow.description || "No description"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6 py-4">
          {/* Workflow diagram */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Workflow</h3>
            <WorkflowDiagram workflow={workflow} />
          </div>

          {/* Node details */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Nodes</h3>
            <div className="grid grid-cols-3 gap-3">
              {workflow.nodes.map((node) => {
                const Icon = NODE_ICONS[node.type] || Play;
                const colorClass = NODE_COLORS[node.type] || NODE_COLORS.action;
                return (
                  <div
                    key={node.id}
                    className={`p-3 rounded-lg border ${colorClass}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{node.name}</span>
                    </div>
                    <div className="text-xs opacity-70">Type: {node.type}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Execution history */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Recent Executions</h3>
              <Button size="sm" variant="ghost" onClick={fetchExecutions}>
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <ScrollArea className="h-40">
              {executions.length > 0 ? (
                <div className="space-y-2">
                  {executions.map((exec) => (
                    <div
                      key={exec.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        {exec.status === "success" && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        {exec.status === "error" && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        {exec.status === "running" && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        )}
                        <span className="text-sm">{exec.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(exec.startedAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No execution history
                </p>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              window.open(`http://localhost:5678/workflow/${workflow.id}`, "_blank")
            }
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in N8N
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Workflows list view
export function WorkflowsView() {
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/n8n?action=list");
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error("Failed to fetch workflows:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const toggleWorkflow = async (workflow: WorkflowData) => {
    const action = workflow.status === "active" ? "deactivate" : "activate";
    try {
      await fetch("/api/n8n", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: workflow.id }),
      });
      await fetchWorkflows();
    } catch (err) {
      console.error("Failed to toggle workflow:", err);
    }
  };

  const runWorkflow = async (workflow: WorkflowData) => {
    try {
      await fetch("/api/n8n", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute", id: workflow.id }),
      });
      // Refresh to show new execution
      await fetchWorkflows();
    } catch (err) {
      console.error("Failed to run workflow:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto min-h-0 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Workflows</h2>
          <p className="text-sm text-muted-foreground">
            N8N automation workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchWorkflows}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => window.open("http://localhost:5678", "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open N8N
          </Button>
        </div>
      </div>

      {workflows.length > 0 ? (
        <div className="space-y-3">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onToggle={() => toggleWorkflow(workflow)}
              onRun={() => runWorkflow(workflow)}
              onEdit={() => setSelectedWorkflow(workflow)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Workflow className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No Workflows</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create workflows in N8N to automate your processes
          </p>
          <Button onClick={() => window.open("http://localhost:5678", "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open N8N
          </Button>
        </div>
      )}

      <WorkflowDetailModal
        workflow={selectedWorkflow}
        open={!!selectedWorkflow}
        onClose={() => setSelectedWorkflow(null)}
      />
    </div>
  );
}
