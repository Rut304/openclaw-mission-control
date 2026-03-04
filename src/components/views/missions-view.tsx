"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Rocket,
  Target,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  ArrowRight,
  Plus,
  Calendar,
  Users,
  GitBranch,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  Edit,
  Trash2,
  BarChart3,
  Workflow,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// Types
interface Mission {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "completed" | "archived";
  created_at: string;
  updated_at: string;
  // Extended fields
  goals?: string[];
  timeline?: {
    start: string;
    end?: string;
    milestones?: { date: string; title: string; completed: boolean }[];
  };
  costs?: {
    estimated: number;
    actual: number;
    breakdown?: { category: string; amount: number }[];
  };
  team?: string[];
  workflows?: Workflow[];
  tasks?: Task[];
  nextSteps?: string[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  mission_id: string | null;
  assigned_agent_id: string | null;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: "active" | "inactive" | "error";
  lastRun?: string;
  last_run?: string;
  nextRun?: string;
  next_run?: string;
  nodes?: WorkflowNode[];
  connections?: WorkflowConnection[];
  mission_id?: string;
  cron_expression?: string;
  n8n_workflow_id?: string;
}

interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "logic" | "data";
  name: string;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
}

interface WorkflowConnection {
  from: string;
  to: string;
}

// Status colors
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  archived: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

// Node type colors matching workflows-view.tsx
const NODE_COLORS: Record<string, string> = {
  trigger: "bg-green-500/20 border-green-500/40 text-green-400",
  action: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  logic: "bg-yellow-500/20 border-yellow-500/40 text-yellow-400",
  data: "bg-purple-500/20 border-purple-500/40 text-purple-400",
};

const NODE_ICONS_MAP: Record<string, string> = {
  trigger: "⚡",
  action: "▶",
  logic: "◆",
  data: "◉",
};

// Workflow visualization component
function WorkflowDiagram({ workflow }: { workflow: Workflow }) {
  if (!workflow.nodes?.length) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No workflow diagram available
      </div>
    );
  }

  // Sort nodes by x position for left-to-right flow
  const sortedNodes = [...workflow.nodes].sort((a, b) => a.position.x - b.position.x);

  return (
    <div className="p-4 bg-muted/20 rounded-lg overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max">
        {sortedNodes.map((node, index) => {
          const colorClass = NODE_COLORS[node.type] || NODE_COLORS.action;
          const icon = NODE_ICONS_MAP[node.type] || "▶";

          return (
            <div key={node.id} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colorClass}`}
                  title={node.config ? JSON.stringify(node.config, null, 2) : undefined}
                >
                  <span className="text-sm">{icon}</span>
                  <span className="text-sm font-medium">{node.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{node.type}</span>
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

// Mission card component
function MissionCard({
  mission,
  onSelect,
  isSelected,
}: {
  mission: Mission;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const taskCount = mission.tasks?.length || 0;
  const completedTasks = mission.tasks?.filter((t) => t.status === "done").length || 0;
  const progress = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0;

  return (
    <div
      onClick={onSelect}
      className={`px-2.5 py-2 rounded-md border cursor-pointer transition-all hover:border-primary/50 ${
        isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <h3 className="text-xs font-semibold truncate mr-2">{mission.name}</h3>
        <Badge className={`${STATUS_COLORS[mission.status]} text-[10px] px-1.5 py-0`}>{mission.status}</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1.5">
        {mission.description || "No description"}
      </p>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" />
            {completedTasks}/{taskCount}
          </span>
          {(mission.workflows?.length || 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <Workflow className="w-2.5 h-2.5" />
              {mission.workflows?.length}
            </span>
          )}
          {mission.costs && (
            <span className="flex items-center gap-0.5">
              <DollarSign className="w-2.5 h-2.5" />
              ${mission.costs.actual.toFixed(0)}
            </span>
          )}
        </div>
        <span>{progress}%</span>
      </div>
      {/* Progress bar */}
      <div className="mt-1 h-0.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// Mission detail view
function MissionDetail({
  mission,
  onClose,
  onUpdate,
}: {
  mission: Mission;
  onClose: () => void;
  onUpdate: (mission: Mission) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "workflows" | "costs">(
    "overview"
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Rocket className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">{mission.name}</h2>
            <Badge className={STATUS_COLORS[mission.status]}>{mission.status}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline">
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
            {mission.status === "active" ? (
              <Button size="sm" variant="outline">
                <PauseCircle className="w-3 h-3 mr-1" />
                Pause
              </Button>
            ) : (
              <Button size="sm" variant="outline">
                <PlayCircle className="w-3 h-3 mr-1" />
                Resume
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{mission.description}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["overview", "tasks", "workflows", "costs"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ScrollArea className="flex-1 h-0 min-h-0">
        <div className="p-4">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Goals */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Goals
                </h3>
                <ul className="space-y-2">
                  {(mission.goals || ["No goals defined"]).map((goal, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                      {goal}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Timeline
                </h3>
                {mission.timeline ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Started:</span>
                      <span>{new Date(mission.timeline.start).toLocaleDateString()}</span>
                    </div>
                    {mission.timeline.end && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Target:</span>
                        <span>{new Date(mission.timeline.end).toLocaleDateString()}</span>
                      </div>
                    )}
                    {mission.timeline.milestones?.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 pl-4 border-l border-border">
                        {m.completed ? (
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-yellow-500" />
                        )}
                        <span className={m.completed ? "line-through text-muted-foreground" : ""}>
                          {m.title}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No timeline set</p>
                )}
              </div>

              {/* Team */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Team
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(mission.team || ["rip"]).map((member) => (
                    <Badge key={member} variant="outline">
                      {member}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Next Steps */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  Next Steps
                </h3>
                <ul className="space-y-2">
                  {(mission.nextSteps || ["No next steps defined"]).map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "tasks" && (
            <div className="space-y-3">
              {(mission.tasks || []).map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 ${
                          task.status === "done" ? "text-green-500" : "text-muted-foreground"
                        }`}
                      />
                      <div>
                        <h4 className="font-medium">{task.title}</h4>
                        <p className="text-xs text-muted-foreground">{task.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}>
                        {task.priority}
                      </Badge>
                      <Badge variant="outline">{task.status}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {(!mission.tasks || mission.tasks.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No tasks assigned to this mission
                </p>
              )}
            </div>
          )}

          {activeTab === "workflows" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">
                  {(mission.workflows || []).length} workflow{(mission.workflows || []).length !== 1 ? "s" : ""} configured
                </p>
              </div>
              {(mission.workflows || []).map((workflow) => (
                <div key={workflow.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="p-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Workflow className="w-4 h-4 text-primary" />
                        <span className="font-medium">{workflow.name}</span>
                        <Badge
                          className={
                            workflow.status === "active"
                              ? STATUS_COLORS.active
                              : workflow.status === "error"
                              ? "bg-red-500/20 text-red-400"
                              : STATUS_COLORS.paused
                          }
                        >
                          {workflow.status}
                        </Badge>
                      </div>
                      {workflow.n8n_workflow_id && (
                        <a href={`http://localhost:5678/workflow/${workflow.n8n_workflow_id}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open in N8N
                        </Button>
                        </a>
                      )}
                    </div>
                    {workflow.description && (
                      <p className="text-xs text-muted-foreground mt-1 ml-6">{workflow.description}</p>
                    )}
                  </div>
                  <WorkflowDiagram workflow={workflow} />
                  <div className="p-3 bg-muted/50 text-xs text-muted-foreground flex justify-between">
                    <span>Last run: {workflow.lastRun || workflow.last_run || "Never"}</span>
                    <span>{workflow.cron_expression ? `Cron: ${workflow.cron_expression}` : `Next run: ${workflow.nextRun || workflow.next_run || "Not scheduled"}`}</span>
                  </div>
                </div>
              ))}
              {(!mission.workflows || mission.workflows.length === 0) && (
                <div className="text-center py-8">
                  <Workflow className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-4">No workflows configured</p>
                  <Button size="sm">
                    <Plus className="w-3 h-3 mr-1" />
                    Create Workflow
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === "costs" && (
            <div className="space-y-6">
              {/* Cost summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Estimated</div>
                  <div className="text-2xl font-bold">
                    ${(mission.costs?.estimated || 0).toFixed(2)}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Actual</div>
                  <div className="text-2xl font-bold">
                    ${(mission.costs?.actual || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Cost breakdown */}
              {mission.costs?.breakdown && mission.costs.breakdown.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Breakdown</h3>
                  <div className="space-y-2">
                    {mission.costs.breakdown.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.category}</span>
                        <span className="font-mono">${item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Main MissionsView component
export function MissionsView() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newMissionName, setNewMissionName] = useState("");
  const [newMissionDesc, setNewMissionDesc] = useState("");

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch missions with tasks and workflows
      const [missionsRes, tasksRes, workflowsRes] = await Promise.all([
        fetch("/api/missions"),
        fetch("/api/tasks"),
        fetch("/api/workflows"),
      ]);
      const missionsData = await missionsRes.json();
      const tasksData = await tasksRes.json();
      const workflowsData = await workflowsRes.json();

      // Map tasks and workflows to missions
      const missionsWithData = (missionsData.missions || []).map((m: Mission) => ({
        ...m,
        tasks: (tasksData.tasks || []).filter((t: Task) => t.mission_id === m.id),
        workflows: (workflowsData.workflows || []).filter((w: Workflow) => (w as Workflow & { mission_id?: string }).mission_id === m.id),
        // Add mock data for demo (goals, timeline, costs, team)
        goals: m.goals || ["Launch MVP", "Acquire first users", "Generate revenue"],
        timeline: m.timeline || {
          start: m.created_at,
          milestones: [
            { date: m.created_at, title: "Project started", completed: true },
            { date: new Date().toISOString(), title: "MVP complete", completed: false },
          ],
        },
        costs: m.costs || { estimated: 100, actual: 45.32 },
        team: m.team || ["rip", "rex"],
        nextSteps: m.nextSteps || ["Complete testing", "Deploy to production", "Launch marketing"],
      }));

      setMissions(missionsWithData);
    } catch (err) {
      console.error("Failed to fetch missions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  const handleCreateMission = async () => {
    if (!newMissionName.trim()) return;

    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMissionName,
          description: newMissionDesc,
        }),
      });

      if (res.ok) {
        await fetchMissions();
        setShowCreateDialog(false);
        setNewMissionName("");
        setNewMissionDesc("");
      }
    } catch (err) {
      console.error("Failed to create mission:", err);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Mission list */}
      <div className="w-56 border-r border-border flex flex-col h-full overflow-hidden shrink-0">
        <div className="px-3 py-2.5 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold">Missions</h2>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={fetchMissions}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {missions.length} mission{missions.length !== 1 ? "s" : ""}
          </p>
        </div>

        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="px-2 py-2 space-y-1.5">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : missions.length > 0 ? (
              missions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onSelect={() => setSelectedMission(mission)}
                  isSelected={selectedMission?.id === mission.id}
                />
              ))
            ) : (
              <div className="text-center py-8">
                <Rocket className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-4">No missions yet</p>
                <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-3 h-3 mr-1" />
                  Create Mission
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Mission detail */}
      <div className="flex-1 bg-background min-w-0 overflow-hidden">
        {selectedMission ? (
          <MissionDetail
            mission={selectedMission}
            onClose={() => setSelectedMission(null)}
            onUpdate={(updated) => {
              setMissions((prev) =>
                prev.map((m) => (m.id === updated.id ? updated : m))
              );
              setSelectedMission(updated);
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a mission to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Create mission dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Mission</DialogTitle>
            <DialogDescription>
              Define a new mission with goals and objectives.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                type="text"
                value={newMissionName}
                onChange={(e) => setNewMissionName(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background"
                placeholder="Mission name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={newMissionDesc}
                onChange={(e) => setNewMissionDesc(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background resize-none"
                rows={3}
                placeholder="Mission description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateMission}>Create Mission</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
