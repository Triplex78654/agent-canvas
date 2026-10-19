import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { serializeGraph } from '../src/lib/serializeGraph';

describe('serializeGraph', () => {
  it('saves consoles with their team, agent and counters (rounded positions)', () => {
    const nodes = [
      { id: 'team-1', type: 'teamNode', position: { x: 10.4, y: 20.6 }, width: 1048, height: 432, data: { label: 'TEAM 1', teamNumber: 1 } },
      {
        id: 'c1',
        type: 'consoleNode',
        parentId: 'team-1',
        position: { x: 24, y: 64 },
        data: { label: 'Claude', commandType: 'claude', promptsSent: 3, estimatedTokens: 1200, status: 'running' },
      },
    ] as unknown as Node[];
    const edges = [{ id: 'e1', source: 'team-1', target: 'c1', type: 'cable', animated: true }] as Edge[];

    const { serializedNodes, serializedEdges } = serializeGraph(nodes, edges);

    expect(serializedNodes[0]).toMatchObject({ id: 'team-1', type: 'teamNode', position: { x: 10, y: 21 }, teamNumber: 1 });
    expect(serializedNodes[1]).toMatchObject({
      id: 'c1',
      type: 'consoleNode',
      parentId: 'team-1',
      commandType: 'claude',
      promptsSent: 3,
      estimatedTokens: 1200,
      width: 490,
      height: 344,
    });
    // Runtime-only data (status) is never written to disk.
    expect(serializedNodes[1]).not.toHaveProperty('status');
    expect(serializedEdges).toEqual([{ id: 'e1', source: 'team-1', target: 'c1', type: 'cable' }]);
  });

  it('keeps the workspace folder and orchestrator collaboration mode', () => {
    const nodes = [
      { id: 'w', type: 'workspaceNode', position: { x: 0, y: 0 }, data: { projectPath: 'C:\\projet', branchName: 'main' } },
      { id: 'o', type: 'orchestratorNode', position: { x: 0, y: 0 }, data: { label: 'Orchestrateur', teamId: 'team-1', collabMode: 'debate' } },
    ] as unknown as Node[];
    const { serializedNodes } = serializeGraph(nodes, []);
    expect(serializedNodes[0]).toMatchObject({ projectPath: 'C:\\projet', branchName: 'main' });
    expect(serializedNodes[1]).toMatchObject({ teamId: 'team-1', collabMode: 'debate' });
  });
});
