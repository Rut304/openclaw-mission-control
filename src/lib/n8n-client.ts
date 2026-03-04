/**
 * N8N Workflow Integration
 * Connects to local N8N instance for workflow management
 */

interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: N8NNode[];
  connections: Record<string, N8NConnection[]>;
  settings?: Record<string, any>;
}

interface N8NNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
}

interface N8NConnection {
  node: string;
  type: string;
  index: number;
}

interface N8NExecution {
  id: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  status: 'success' | 'error' | 'running';
}

const N8N_BASE_URL = process.env.N8N_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

async function n8nFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (N8N_API_KEY) {
    headers['X-N8N-API-KEY'] = N8N_API_KEY;
  }

  const response = await fetch(`${N8N_BASE_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!response.ok) {
    throw new Error(`N8N API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all workflows
 */
export async function getWorkflows(): Promise<N8NWorkflow[]> {
  try {
    const data = await n8nFetch<{ data: N8NWorkflow[] }>('/api/v1/workflows');
    return data.data || [];
  } catch (err) {
    console.error('[N8N] Failed to get workflows:', err);
    return [];
  }
}

/**
 * Get a single workflow by ID
 */
export async function getWorkflow(id: string): Promise<N8NWorkflow | null> {
  try {
    const data = await n8nFetch<{ data: N8NWorkflow }>(`/api/v1/workflows/${id}`);
    return data.data || null;
  } catch (err) {
    console.error('[N8N] Failed to get workflow:', err);
    return null;
  }
}

/**
 * Get workflow executions
 */
export async function getExecutions(workflowId?: string): Promise<N8NExecution[]> {
  try {
    const endpoint = workflowId 
      ? `/api/v1/executions?workflowId=${workflowId}&limit=10`
      : '/api/v1/executions?limit=20';
    const data = await n8nFetch<{ data: N8NExecution[] }>(endpoint);
    return data.data || [];
  } catch (err) {
    console.error('[N8N] Failed to get executions:', err);
    return [];
  }
}

/**
 * Activate/deactivate a workflow
 */
export async function setWorkflowActive(id: string, active: boolean): Promise<boolean> {
  try {
    await n8nFetch(`/api/v1/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
    return true;
  } catch (err) {
    console.error('[N8N] Failed to update workflow:', err);
    return false;
  }
}

/**
 * Execute a workflow manually
 */
export async function executeWorkflow(id: string, data?: Record<string, any>): Promise<{ executionId: string } | null> {
  try {
    const result = await n8nFetch<{ data: { executionId: string } }>(
      `/api/v1/workflows/${id}/execute`,
      {
        method: 'POST',
        body: JSON.stringify({ data }),
      }
    );
    return result.data;
  } catch (err) {
    console.error('[N8N] Failed to execute workflow:', err);
    return null;
  }
}

/**
 * Create a new workflow
 */
export async function createN8NWorkflow(workflow: {
  name: string;
  nodes?: N8NNode[];
  connections?: Record<string, any>;
  active?: boolean;
  settings?: Record<string, any>;
}): Promise<N8NWorkflow | null> {
  try {
    const payload: Record<string, unknown> = {
      name: workflow.name,
      nodes: workflow.nodes || [{
        parameters: {},
        id: 'trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: [0, 0],
      }],
      connections: workflow.connections || {},
      settings: workflow.settings || { executionOrder: 'v1' },
    };
    const created = await n8nFetch<N8NWorkflow>('/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // If activation was requested, do it separately (N8N doesn't accept 'active' on create)
    if (workflow.active && created?.id) {
      await setWorkflowActive(created.id, true);
    }

    return created;
  } catch (err) {
    console.error('[N8N] Failed to create workflow:', err);
    return null;
  }
}

/**
 * Update an existing workflow (full replacement)
 */
export async function updateN8NWorkflow(id: string, patch: {
  name?: string;
  nodes?: N8NNode[];
  connections?: Record<string, any>;
  active?: boolean;
  settings?: Record<string, any>;
}): Promise<N8NWorkflow | null> {
  try {
    // Fetch current workflow first
    const current = await n8nFetch<N8NWorkflow>(`/api/v1/workflows/${id}`);
    if (!current) return null;

    const shouldActivate = patch.active !== undefined ? patch.active : undefined;

    // Only send fields N8N PUT accepts (strict validation)
    const payload = {
      name: patch.name ?? current.name,
      nodes: patch.nodes ?? current.nodes,
      connections: patch.connections ?? current.connections,
      settings: patch.settings ?? current.settings ?? {},
    };

    const result = await n8nFetch<N8NWorkflow>(`/api/v1/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    // Handle activation separately
    if (shouldActivate !== undefined) {
      await setWorkflowActive(id, shouldActivate);
    }

    return result;
  } catch (err) {
    console.error('[N8N] Failed to update workflow:', err);
    return null;
  }
}

/**
 * Delete a workflow
 */
export async function deleteN8NWorkflow(id: string): Promise<boolean> {
  try {
    await n8nFetch(`/api/v1/workflows/${id}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    console.error('[N8N] Failed to delete workflow:', err);
    return false;
  }
}

/**
 * Duplicate a workflow
 */
export async function duplicateN8NWorkflow(id: string, newName?: string): Promise<N8NWorkflow | null> {
  try {
    const current = await n8nFetch<N8NWorkflow>(`/api/v1/workflows/${id}`);
    if (!current) return null;

    return await createN8NWorkflow({
      name: newName || `${current.name} (Copy)`,
      nodes: current.nodes,
      connections: current.connections,
    });
  } catch (err) {
    console.error('[N8N] Failed to duplicate workflow:', err);
    return null;
  }
}

/**
 * Convert N8N workflow to simplified format for display
 */
export function simplifyWorkflow(workflow: N8NWorkflow) {
  const nodes = workflow.nodes.map(node => ({
    id: node.id,
    name: node.name,
    type: getNodeCategory(node.type),
    position: { x: node.position[0], y: node.position[1] },
  }));

  // Build connections list
  const connections: { from: string; to: string }[] = [];
  for (const [sourceNode, outputs] of Object.entries(workflow.connections)) {
    for (const output of outputs) {
      connections.push({
        from: sourceNode,
        to: output.node,
      });
    }
  }

  return {
    id: workflow.id,
    name: workflow.name,
    status: workflow.active ? 'active' : 'inactive',
    nodes,
    connections,
  };
}

function getNodeCategory(type: string): 'trigger' | 'action' | 'logic' | 'data' {
  if (type.includes('Trigger') || type.includes('Webhook')) return 'trigger';
  if (type.includes('If') || type.includes('Switch') || type.includes('Merge')) return 'logic';
  if (type.includes('Function') || type.includes('Code') || type.includes('Set')) return 'data';
  return 'action';
}

/**
 * Create a workflow from cron job definition
 */
export function cronJobToWorkflow(cronJob: {
  id: string;
  name?: string;
  prompt?: string;
  schedule: any;
  agentId?: string;
  enabled?: boolean;
}) {
  return {
    id: cronJob.id,
    name: cronJob.name || cronJob.prompt?.substring(0, 50) || 'Unnamed cron',
    status: cronJob.enabled ? 'active' : 'inactive',
    description: cronJob.prompt,
    nodes: [
      {
        id: 'trigger',
        name: 'Schedule Trigger',
        type: 'trigger',
        position: { x: 0, y: 0 },
      },
      {
        id: 'agent',
        name: `Agent: ${cronJob.agentId || 'rip'}`,
        type: 'action',
        position: { x: 200, y: 0 },
      },
      {
        id: 'output',
        name: 'Output/Notify',
        type: 'action',
        position: { x: 400, y: 0 },
      },
    ],
    connections: [
      { from: 'trigger', to: 'agent' },
      { from: 'agent', to: 'output' },
    ],
  };
}
