/**
 * N8N Workflow API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getWorkflows,
  getWorkflow,
  getExecutions,
  setWorkflowActive,
  executeWorkflow,
  createN8NWorkflow,
  updateN8NWorkflow,
  deleteN8NWorkflow,
  duplicateN8NWorkflow,
  simplifyWorkflow,
} from '@/lib/n8n-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  const id = searchParams.get('id');

  try {
    switch (action) {
      case 'list': {
        const workflows = await getWorkflows();
        return NextResponse.json({
          workflows: workflows.map(simplifyWorkflow),
          count: workflows.length,
        });
      }

      case 'get': {
        if (!id) {
          return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
        }
        const workflow = await getWorkflow(id);
        if (!workflow) {
          return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }
        return NextResponse.json({ workflow: simplifyWorkflow(workflow) });
      }

      case 'executions': {
        const executions = await getExecutions(id || undefined);
        return NextResponse.json({ executions });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[N8N API] Error:', err);
    return NextResponse.json(
      { error: 'N8N API error', detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, ...params } = body;

    switch (action) {
      case 'activate': {
        if (!id) {
          return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
        }
        const success = await setWorkflowActive(id, true);
        return NextResponse.json({ success });
      }

      case 'deactivate': {
        if (!id) {
          return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
        }
        const success = await setWorkflowActive(id, false);
        return NextResponse.json({ success });
      }

      case 'execute': {
        if (!id) {
          return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
        }
        const result = await executeWorkflow(id, params.data);
        if (!result) {
          return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
        }
        return NextResponse.json({ success: true, executionId: result.executionId });
      }

      case 'create': {
        if (!params.name) {
          return NextResponse.json({ error: 'Workflow name required' }, { status: 400 });
        }
        const created = await createN8NWorkflow({
          name: params.name,
          nodes: params.nodes,
          connections: params.connections,
          active: params.active,
          settings: params.settings,
        });
        if (!created) {
          return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
        }
        return NextResponse.json({ success: true, workflow: simplifyWorkflow(created) }, { status: 201 });
      }

      case 'update': {
        if (!id) {
          return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
        }
        const updated = await updateN8NWorkflow(id, {
          name: params.name,
          nodes: params.nodes,
          connections: params.connections,
          active: params.active,
          settings: params.settings,
        });
        if (!updated) {
          return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 });
        }
        return NextResponse.json({ success: true, workflow: simplifyWorkflow(updated) });
      }

      case 'delete': {
        if (!id) {
          return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
        }
        const deleted = await deleteN8NWorkflow(id);
        return NextResponse.json({ success: deleted });
      }

      case 'duplicate': {
        if (!id) {
          return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
        }
        const dup = await duplicateN8NWorkflow(id, params.name);
        if (!dup) {
          return NextResponse.json({ error: 'Failed to duplicate workflow' }, { status: 500 });
        }
        return NextResponse.json({ success: true, workflow: simplifyWorkflow(dup) }, { status: 201 });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[N8N API] Error:', err);
    return NextResponse.json(
      { error: 'N8N API error', detail: String(err) },
      { status: 500 }
    );
  }
}
