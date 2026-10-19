import type { Edge, Node } from '@xyflow/react';
import type {
  ConsoleNodeData,
  OrchestratorNodeData,
  PersistedEdgeRecord,
  PersistedNodeRecord,
  TeamNodeData,
} from '../types';
import type { SummaryNoteNodeData } from '../components/SummaryNoteNode';
import type { WorkspaceNodeData } from '../components/WorkspaceNode';
import type { TriggerNodeData } from '../components/TriggerNode';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, getNodeDimensions } from './canvasLayout';

export const LOCAL_STORAGE_FALLBACK_KEY = 'agent-canvas:state:v3';

/** Convert the live React Flow graph into the plain records written to canvas-state.json. Pure (tested). */
export function serializeGraph(
  currentNodes: Node[],
  currentEdges: Edge[]
): { serializedNodes: PersistedNodeRecord[]; serializedEdges: PersistedEdgeRecord[] } {
  const serializedNodes: PersistedNodeRecord[] = currentNodes.map((n) => {
    const { width, height } = getNodeDimensions(
      n,
      n.type === 'teamNode' ? 1048 : DEFAULT_WIDTH,
      n.type === 'teamNode' ? 432 : DEFAULT_HEIGHT
    );

    if (n.type === 'teamNode') {
      const td = n.data as unknown as TeamNodeData;
      return {
        id: n.id,
        type: 'teamNode',
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        width: Math.round(width),
        height: Math.round(height),
        label: td.label,
        teamNumber: td.teamNumber,
      };
    }

    if (n.type === 'orchestratorNode') {
      const od = n.data as unknown as OrchestratorNodeData;
      return {
        id: n.id,
        type: 'orchestratorNode',
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        label: od.label,
        teamId: od.teamId,
        collabMode: od.collabMode,
      };
    }

    if (n.type === 'summaryNoteNode') {
      const sd = n.data as unknown as SummaryNoteNodeData;
      return {
        id: n.id,
        type: 'summaryNoteNode',
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        width: Math.round(width),
        height: Math.round(height),
        label: sd.title || 'Synthèse de Mission',
        summaryContent: sd.content,
      };
    }

    if (n.type === 'workspaceNode') {
      const wd = n.data as unknown as WorkspaceNodeData;
      return {
        id: n.id,
        type: 'workspaceNode',
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        width: Math.round(width),
        height: Math.round(height),
        label: 'Workspace Git',
        projectPath: wd.projectPath,
        branchName: wd.branchName,
      };
    }

    if (n.type === 'triggerNode') {
      const td = n.data as unknown as TriggerNodeData;
      return {
        id: n.id,
        type: 'triggerNode',
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        width: Math.round(width),
        height: Math.round(height),
        label: td.label || 'Pipeline Automatique',
        intervalMinutes: td.intervalMinutes,
        triggerActive: td.active,
      };
    }

    const cd = n.data as unknown as ConsoleNodeData;
    return {
      id: n.id,
      type: 'consoleNode',
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      width: Math.round(width),
      height: Math.round(height),
      parentId: n.parentId,
      label: cd.label || 'Console',
      commandType: cd.commandType || 'claude',
      customCommand: cd.customCommand,
      promptsSent: cd.promptsSent || 0,
      estimatedTokens: cd.estimatedTokens || 0,
      tokenLimit: cd.tokenLimit,
    };
  });

  const serializedEdges: PersistedEdgeRecord[] = currentEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type,
  }));

  return { serializedNodes, serializedEdges };
}
