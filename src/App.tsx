import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  NodeChange,
  Node,
  Edge,
  Viewport,
  ReactFlowInstance,
  addEdge,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  HardDrive,
  CheckCircle2,
  Play,
  Trash2,
  Key,
  GraduationCap,
  HelpCircle,
  LifeBuoy,
  Download,
  RefreshCw,
  Sparkles,
  Search,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AppVersionInfo,
  checkForAppUpdate,
  forceAppUpdateAndRestart,
  initializeVersionTracker,
} from './services/updateManager';
import { ConsoleNode, COMMAND_OPTIONS } from './components/ConsoleNode';
import { TeamNode } from './components/TeamNode';
import { OrchestratorNode } from './components/OrchestratorNode';
import { SummaryNoteNode } from './components/SummaryNoteNode';
import { WorkspaceNode } from './components/WorkspaceNode';
import { TriggerNode } from './components/TriggerNode';
import { AnimatedCableEdge } from './components/AnimatedCableEdge';
import { FloatingDock } from './components/FloatingDock';
import { OnboardingModal, isOnboardingDone } from './components/OnboardingModal';
import type { AppUpdateState } from './types';
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  TEAM_GAP_X,
  TEAM_GAP_Y,
  TEAM_PADDING_BOTTOM,
  TEAM_PADDING_TOP,
  TEAM_PADDING_X,
  computeTeamGridMetrics,
  findFreeSpot,
  getEnclosingTeamDimensions,
  getNodeDimensions,
} from './lib/canvasLayout';
import { LOCAL_STORAGE_FALLBACK_KEY, serializeGraph } from './lib/serializeGraph';
import { useThrottledAutosave } from './hooks/useThrottledAutosave';
import { useTeamActions } from './hooks/useTeamActions';
import { computeQuotaSummary } from './lib/quota';
import { QuotaWidget } from './components/QuotaWidget';
import { AppUpdateButton } from './components/AppUpdateButton';
import { CanvasZoomControls } from './components/CanvasZoomControls';
import { BUILTIN_PRESETS, DEFAULT_MEMORY_NOTES } from './data/builtinPresets';
import { STARTER_MISSION, pickStarterAgents } from './lib/starterTeam';
import type { DetectedCli } from './types';
import { ApiKeysModal } from './components/ApiKeysModal';
import { AiHelpModal } from './components/AiHelpModal';
import { SupportModal } from './components/SupportModal';
import { InstallAppModal } from './components/InstallAppModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { PromptTemplatesModal } from './components/PromptTemplatesModal';
import {
  InteractiveTutorialModal,
  TUTORIAL_SEEN_KEY,
} from './components/InteractiveTutorialModal';
import {
  countConfiguredKeys,
  loadUserWebApiKeys,
} from './services/webAiClient';
import {
  getLatestAgentReply,
  markConsoleStarted,
  wasConsoleStartedInSession,
  playCanvasSound,
  isAudioEnabled,
  setAudioEnabled,
} from './services/teamCollabBus';
import {
  AgentCommandType,
  AnimatedCableEdgeData,
  CanvasPreset,
  CommandTargetOption,
  ConsoleNodeData,
  OrchestratorNodeData,
  PersistedCanvasState,
  PersistedEdgeRecord,
  PersistedNodeRecord,
  TeamMemberSummary,
  TeamNodeData,
} from './types';

export default function App() {
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [customPresets, setCustomPresets] = useState<CanvasPreset[]>([]);
  const [memoryNotes, setMemoryNotes] = useState<string>(DEFAULT_MEMORY_NOTES);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storagePath, setStoragePath] = useState<string>('userData/canvas-state.json');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [pulsingTeamIds, setPulsingTeamIds] = useState<Record<string, boolean>>({});

  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const consoleCounterRef = useRef<number>(1);
  const teamCounterRef = useRef<number>(1);

  // Custom onNodesChange handler that protects team child consoles from being displaced
  // by xyflow's NodeResizer when resizing the parent team frame from top/left corners
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removedChanges = changes.filter((c) => c.type === 'remove');
      if (removedChanges.length > 0) {
        const removedIds = new Set(removedChanges.map((c: any) => c.id));
        setEdges((eds) =>
          eds.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target))
        );
      }

      setNodes((currentNodes) => {
        const teamIds = new Set(
          currentNodes.filter((n) => n.type === 'teamNode').map((n) => n.id)
        );
        const childConsoleMap = new Map<string, Node>();
        for (const n of currentNodes) {
          if (n.type === 'consoleNode' && n.parentId && teamIds.has(n.parentId)) {
            childConsoleMap.set(n.id, n);
          }
        }

        const sanitizedChanges = changes.map((c) => {
          // If xyflow emits a synthetic relative position change for a child console during parent resize
          // (c.dragging is false/undefined), preserve the child's established grid position
          if (c.type === 'position' && childConsoleMap.has(c.id)) {
            const childNode = childConsoleMap.get(c.id);
            if (!c.dragging && childNode && c.position) {
              return {
                ...c,
                position: childNode.position,
              };
            }
          }
          return c;
        });

        return applyNodeChanges(sanitizedChanges, currentNodes);
      });
    },
    [setNodes, setEdges]
  );

  const handleConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'animatedCable',
          },
          eds
        )
      );
      playCanvasSound('relay');
    },
    [setEdges]
  );

  const handleUpdateNode = useCallback(
    (id: string, patch: Partial<ConsoleNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...patch,
                },
              }
            : node
        )
      );
    },
    [setNodes]
  );

  // Scale a Team frame AND automatically scale all inner consoles proportionally
  const handleScaleTeam = useCallback(
    (
      teamId: string,
      action:
        | 'shrink'
        | 'expand'
        | 'toggle-max'
        | { width: number; height: number; x?: number; y?: number }
    ) => {
      setNodes((nds) => {
        const teamNode = nds.find((n) => n.id === teamId);
        if (!teamNode) return nds;
        const members = nds.filter(
          (n) => n.type === 'consoleNode' && n.parentId === teamId
        );
        const count = Math.max(1, members.length);
        const cols = count <= 1 ? 1 : 2;
        const rows = Math.max(1, Math.ceil(count / cols));

        const curTeamDims = getNodeDimensions(teamNode, 1048, 432);
        let nextTeamW = curTeamDims.width;
        let nextTeamH = curTeamDims.height;
        let nextTeamX = teamNode.position.x;
        let nextTeamY = teamNode.position.y;

        if (typeof action === 'object') {
          nextTeamW = Math.max(680, action.width);
          nextTeamH = Math.max(432, action.height);
          if (typeof action.x === 'number') nextTeamX = action.x;
          if (typeof action.y === 'number') nextTeamY = action.y;
        } else if (action === 'shrink') {
          nextTeamW = Math.max(680, Math.round(curTeamDims.width * 0.85));
          nextTeamH = Math.max(432, Math.round(curTeamDims.height * 0.85));
        } else if (action === 'expand') {
          nextTeamW = Math.min(2200, Math.round(curTeamDims.width * 1.18));
          nextTeamH = Math.min(1500, Math.round(curTeamDims.height * 1.18));
        } else if (action === 'toggle-max') {
          const isLarge = curTeamDims.width >= 1320;
          const std = computeTeamGridMetrics(count, DEFAULT_WIDTH, DEFAULT_HEIGHT);
          const lg = computeTeamGridMetrics(count, 660, 480);
          nextTeamW = isLarge ? std.width : lg.width;
          nextTeamH = isLarge ? std.height : lg.height;
        }

        const isManualDrag = typeof action === 'object';

        const cellW = Math.max(
          300,
          Math.floor(
            (nextTeamW - TEAM_PADDING_X * 2 - (cols - 1) * TEAM_GAP_X) / cols
          )
        );
        const cellH = Math.max(
          220,
          Math.floor(
            (nextTeamH - TEAM_PADDING_TOP - TEAM_PADDING_BOTTOM - (rows - 1) * TEAM_GAP_Y) /
              rows
          )
        );

        const exactTeamW = Math.max(
          680,
          TEAM_PADDING_X * 2 + cols * cellW + (cols - 1) * TEAM_GAP_X
        );
        const exactTeamH = Math.max(
          432,
          TEAM_PADDING_TOP +
            TEAM_PADDING_BOTTOM +
            rows * cellH +
            (rows - 1) * TEAM_GAP_Y
        );

        const finalTeamW = isManualDrag ? nextTeamW : exactTeamW;
        const finalTeamH = isManualDrag ? nextTeamH : exactTeamH;

        let memberIdx = 0;
        return nds.map((n) => {
          if (n.id === teamId) {
            return {
              ...n,
              position: {
                x: Math.round(nextTeamX),
                y: Math.round(nextTeamY),
              },
              width: finalTeamW,
              height: finalTeamH,
              style: { ...n.style, width: finalTeamW, height: finalTeamH },
            };
          }
          if (n.type === 'consoleNode' && n.parentId === teamId) {
            const col = memberIdx % cols;
            const row = Math.floor(memberIdx / cols);
            memberIdx++;
            return {
              ...n,
              position: {
                x: TEAM_PADDING_X + col * (cellW + TEAM_GAP_X),
                y: TEAM_PADDING_TOP + row * (cellH + TEAM_GAP_Y),
              },
              width: cellW,
              height: cellH,
              style: { ...n.style, width: cellW, height: cellH },
            };
          }
          return n;
        });
      });
    },
    [setNodes]
  );

  // Resize a console card (via buttons -, +, Maximize, or mouse drag) and reflow sibling consoles + parent team frame so nothing ever overlaps
  const handleResizeNode = useCallback(
    (
      id: string,
      action: 'shrink' | 'expand' | 'toggle-max' | { width: number; height: number; x?: number; y?: number }
    ) => {
      setNodes((nds) => {
        const target = nds.find((n) => n.id === id);
        if (!target) return nds;

        const { width: curW, height: curH } = getNodeDimensions(
          target,
          DEFAULT_WIDTH,
          DEFAULT_HEIGHT
        );

        let nextW = curW;
        let nextH = curH;
        let nextX = target.position.x;
        let nextY = target.position.y;

        if (typeof action === 'object') {
          nextW = Math.max(300, action.width);
          nextH = Math.max(220, action.height);
          if (typeof action.x === 'number') nextX = action.x;
          if (typeof action.y === 'number') nextY = action.y;
        } else if (action === 'shrink') {
          nextW = Math.max(300, Math.round(curW * 0.85));
          nextH = Math.max(220, Math.round(curH * 0.85));
        } else if (action === 'expand') {
          nextW = Math.min(1200, Math.round(curW * 1.18));
          nextH = Math.min(860, Math.round(curH * 1.18));
        } else if (action === 'toggle-max') {
          const isLarge = curW >= 640 || curH >= 440;
          nextW = isLarge ? DEFAULT_WIDTH : 680;
          nextH = isLarge ? DEFAULT_HEIGHT : 480;
        }

        const parentId = target.parentId;
        const updated = nds.map((n) =>
          n.id === id
            ? {
                ...n,
                position: parentId ? n.position : { x: Math.round(nextX), y: Math.round(nextY) },
                width: nextW,
                height: nextH,
                style: { ...n.style, width: nextW, height: nextH },
              }
            : n
        );

        if (!parentId) return updated;

        // Reflow all sibling consoles in the team grid so they never overlap, and resize the parent Team frame to wrap them cleanly
        const children = updated.filter(
          (n) => n.type === 'consoleNode' && n.parentId === parentId
        );
        const count = children.length;
        const cols = count <= 1 ? 1 : 2;
        const rows = Math.max(1, Math.ceil(count / cols));

        const colWidths = new Array(cols).fill(300);
        const rowHeights = new Array(rows).fill(220);

        children.forEach((ch, idx) => {
          const c = idx % cols;
          const r = Math.floor(idx / cols);
          const { width: w, height: h } = getNodeDimensions(
            ch,
            DEFAULT_WIDTH,
            DEFAULT_HEIGHT
          );
          if (w > colWidths[c]) colWidths[c] = w;
          if (h > rowHeights[r]) rowHeights[r] = h;
        });

        const colOffsets: number[] = [];
        let accX = TEAM_PADDING_X;
        for (let c = 0; c < cols; c++) {
          colOffsets.push(accX);
          accX += colWidths[c] + TEAM_GAP_X;
        }

        const rowOffsets: number[] = [];
        let accY = TEAM_PADDING_TOP;
        for (let r = 0; r < rows; r++) {
          rowOffsets.push(accY);
          accY += rowHeights[r] + TEAM_GAP_Y;
        }

        const totalTeamW = accX - TEAM_GAP_X + TEAM_PADDING_X;
        const totalTeamH = accY - TEAM_GAP_Y + TEAM_PADDING_BOTTOM;

        let memberIdx = 0;
        const reflowed = updated.map((n) => {
          if (n.type === 'consoleNode' && n.parentId === parentId) {
            const c = memberIdx % cols;
            const r = Math.floor(memberIdx / cols);
            memberIdx++;
            const w = colWidths[c];
            const h = rowHeights[r];
            return {
              ...n,
              position: {
                x: Math.round(colOffsets[c]),
                y: Math.round(rowOffsets[r]),
              },
              width: w,
              height: h,
              style: {
                ...n.style,
                width: w,
                height: h,
              },
            };
          }
          return n;
        });

        const enclosing = getEnclosingTeamDimensions(
          parentId,
          reflowed,
          Math.round(totalTeamW),
          Math.round(totalTeamH)
        );

        return reflowed.map((n) => {
          if (n.id === parentId) {
            return {
              ...n,
              width: enclosing.width,
              height: enclosing.height,
              style: {
                ...n.style,
                width: enclosing.width,
                height: enclosing.height,
              },
            };
          }
          return n;
        });
      });
    },
    [setNodes]
  );

  const {
    activeWorkflowsRef,
    handleCloseNode,
    handleRenameTeam,
    handleStartTeam,
    handleStopTeam,
    handleCloseTeam,
    handleAutoGridTeam,
    handleUngroupTeam,
    triggerTeamPulse,
    handleChangeCollabMode,
    handleTriggerTeamRelay,
    handleSynthesizeTeamWork,
    handleBroadcastToTeam,
  } = useTeamActions({ setNodes, setEdges, setPulsingTeamIds });
  const buildConsoleNode = useCallback(
    (params: {
      id?: string;
      label: string;
      commandType?: AgentCommandType;
      customCommand?: string;
      position: { x: number; y: number };
      width?: number;
      height?: number;
      parentId?: string;
      restoredFromDisk?: boolean;
      promptsSent?: number;
      estimatedTokens?: number;
      tokenLimit?: number;
    }): Node => {
      const id =
        params.id ||
        `console-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const cmd = params.commandType || 'claude';
      const defaultLimit =
        COMMAND_OPTIONS.find((o) => o.id === cmd)?.defaultTokenLimit || 50000;
      const keepActiveFromSession = wasConsoleStartedInSession(id);
      const cWidth = params.width || DEFAULT_WIDTH;
      const cHeight = params.height || DEFAULT_HEIGHT;
      return {
        id,
        type: 'consoleNode',
        position: params.position,
        parentId: params.parentId,
        width: cWidth,
        height: cHeight,
        style: {
          width: cWidth,
          height: cHeight,
        },
        dragHandle: '.console-drag-handle',
        data: {
          label: params.label,
          commandType: cmd,
          customCommand: params.customCommand,
          status: keepActiveFromSession ? 'running' : 'idle',
          started: keepActiveFromSession,
          paused: false,
          teamId: params.parentId,
          restoredFromDisk: keepActiveFromSession
            ? false
            : Boolean(params.restoredFromDisk),
          promptsSent: params.promptsSent || 0,
          estimatedTokens: params.estimatedTokens || 0,
          tokenLimit: params.tokenLimit || defaultLimit,
          onUpdateNode: handleUpdateNode,
          onResizeNode: handleResizeNode,
          onCloseNode: handleCloseNode,
        } satisfies ConsoleNodeData,
      };
    },
    [handleUpdateNode, handleResizeNode, handleCloseNode]
  );

  // Hydrate nodes & edges from serialized records (always safe idle state unless active in current session)
  const applySerializedRecords = useCallback(
    (
      nodeRecords: PersistedNodeRecord[],
      edgeRecords: PersistedEdgeRecord[] | undefined,
      markRestored: boolean
    ) => {
      const restoredNodes: Node[] = [];
      let maxTeamNum = 1;
      let consoleCount = 1;

      // Parents first
      for (const item of nodeRecords) {
        if (item.type === 'teamNode') {
          const tNum = item.teamNumber || maxTeamNum++;
          if (tNum >= teamCounterRef.current) teamCounterRef.current = tNum + 1;
          const initialW = item.width || 1048;
          const initialH = item.height || 432;
          restoredNodes.push({
            id: item.id,
            type: 'teamNode',
            position: item.position,
            width: initialW,
            height: initialH,
            style: {
              width: initialW,
              height: initialH,
            },
            dragHandle: '.team-drag-handle',
            zIndex: -1,
            data: {
              label: item.label || `TEAM ${tNum}`,
              teamNumber: tNum,
              memberCount: 0,
              runningCount: 0,
              pulsing: false,
              onRenameTeam: handleRenameTeam,
              onUngroupTeam: handleUngroupTeam,
              onStartTeam: handleStartTeam,
              onStopTeam: handleStopTeam,
              onCloseTeam: handleCloseTeam,
              onAutoGridTeam: handleAutoGridTeam,
              onScaleTeam: handleScaleTeam,
            } satisfies TeamNodeData,
          });
        } else if (item.type === 'orchestratorNode' && item.teamId) {
          restoredNodes.push({
            id: item.id,
            type: 'orchestratorNode',
            position: item.position,
            dragHandle: '.orchestrator-drag-handle',
            data: {
              label: item.label || 'Orchestrateur',
              teamId: item.teamId,
              teamLabel: 'TEAM',
              members: [],
              collabMode: item.collabMode || 'split',
              onChangeCollabMode: handleChangeCollabMode,
              onTriggerTeamRelay: handleTriggerTeamRelay,
              onSynthesizeTeamWork: handleSynthesizeTeamWork,
              onBroadcastToTeam: handleBroadcastToTeam,
              onStartTeam: handleStartTeam,
              onStopTeam: handleStopTeam,
              onCloseTeam: handleCloseTeam,
            } satisfies OrchestratorNodeData,
          });
        }
      }

      // Consoles next
      for (const item of nodeRecords) {
        if (item.type === 'consoleNode' || !item.type) {
          consoleCount++;
          const cW = item.width || DEFAULT_WIDTH;
          const cH = item.height || DEFAULT_HEIGHT;
          restoredNodes.push(
            buildConsoleNode({
              id: item.id,
              label: item.label,
              commandType: item.commandType || 'claude',
              customCommand: item.customCommand,
              position: item.position,
              width: cW,
              height: cH,
              parentId: item.parentId,
              restoredFromDisk: markRestored,
              promptsSent: item.promptsSent,
              estimatedTokens: item.estimatedTokens,
              tokenLimit: item.tokenLimit,
            })
          );
        } else if (item.type === 'summaryNoteNode') {
          restoredNodes.push({
            id: item.id,
            type: 'summaryNoteNode',
            position: item.position,
            width: item.width || 460,
            height: item.height || 480,
            data: {
              title: item.label || 'Synthèse de Mission',
              brief: 'Mission archivée',
              teamLabel: 'TEAM',
              createdAt: new Date().toLocaleString(),
              content: item.summaryContent || '# Synthèse de Mission\n\nTravaux enregistrés.',
            },
          });
        } else if (item.type === 'workspaceNode') {
          restoredNodes.push({
            id: item.id,
            type: 'workspaceNode',
            position: item.position,
            width: item.width || 440,
            height: item.height || 480,
            data: {
              projectPath: item.projectPath || '',
              branchName: item.branchName || '',
              lastCommitMessage: '',
              modifiedFiles: [],
            },
          });
        } else if (item.type === 'triggerNode') {
          restoredNodes.push({
            id: item.id,
            type: 'triggerNode',
            position: item.position,
            width: item.width || 380,
            height: item.height || 380,
            data: {
              label: item.label || 'Pipeline Automatique',
              mode: 'interval',
              intervalMinutes: item.intervalMinutes || 5,
              // Safety: a scheduled pipeline never resumes on its own after a restart.
              active: false,
              triggerPrompt: 'Vérifie les tests et le statut git.',
            },
          });
        }
      }

      // Reconcile enclosing dimensions for all team nodes to ensure they wrap their children properly
      const reconciledNodes = restoredNodes.map((n) => {
        if (n.type === 'teamNode') {
          const dims = getEnclosingTeamDimensions(
            n.id,
            restoredNodes,
            typeof n.width === 'number' ? n.width : undefined,
            typeof n.height === 'number' ? n.height : undefined
          );
          return {
            ...n,
            width: dims.width,
            height: dims.height,
            style: {
              ...n.style,
              width: dims.width,
              height: dims.height,
            },
          };
        }
        return n;
      });

      consoleCounterRef.current = consoleCount;
      setNodes(reconciledNodes);

      if (Array.isArray(edgeRecords) && edgeRecords.length > 0) {
        setEdges(
          edgeRecords.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'animatedCable',
            data: { active: true, pulsing: false, runningCount: 0 },
          }))
        );
      } else {
        const autoEdges: Edge[] = [];
        for (const n of restoredNodes) {
          if (n.type === 'orchestratorNode') {
            const tId = (n.data as unknown as OrchestratorNodeData).teamId;
            if (tId) {
              autoEdges.push({
                id: `cable-${n.id}-${tId}`,
                source: n.id,
                target: tId,
                type: 'animatedCable',
                data: { active: true, pulsing: false, runningCount: 0 },
              });
            }
          }
        }
        setEdges(autoEdges);
      }
    },
    [
      buildConsoleNode,
      handleRenameTeam,
      handleUngroupTeam,
      handleStartTeam,
      handleStopTeam,
      handleCloseTeam,
      handleAutoGridTeam,
      handleScaleTeam,
      handleChangeCollabMode,
      handleTriggerTeamRelay,
      handleSynthesizeTeamWork,
      handleBroadcastToTeam,
      setNodes,
      setEdges,
    ]
  );

  // Create a Team + Orchestrator + Animated Cable from a list of console IDs
  const createTeamFromConsoleIds = useCallback(
    (targetConsoleIds: string[]) => {
      if (targetConsoleIds.length === 0) return;
      // Ids are computed once, outside the state updater (React StrictMode calls updaters twice).
      const teamNum = teamCounterRef.current++;
      const teamId = `team-${Date.now()}-${teamNum}`;
      const orchId = `orch-${teamId}`;
      const teamLabel = `TEAM ${teamNum}`;
      const cableId = `cable-${orchId}-${teamId}`;

      setNodes((nds) => {
        const targetConsoles = nds.filter(
          (n) => n.type === 'consoleNode' && targetConsoleIds.includes(n.id)
        );
        if (targetConsoles.length === 0) return nds;

        const minX = Math.min(...targetConsoles.map((c) => c.position.x));
        const minY = Math.min(...targetConsoles.map((c) => c.position.y));
        const teamX = Math.max(420, minX);
        const teamY = Math.max(60, minY);

        const { cols, width, height } = computeTeamGridMetrics(
          targetConsoles.length
        );

        const teamNode: Node = {
          id: teamId,
          type: 'teamNode',
          position: { x: teamX, y: teamY },
          width,
          height,
          style: { width, height },
          dragHandle: '.team-drag-handle',
          zIndex: -1,
          data: {
            label: teamLabel,
            teamNumber: teamNum,
            memberCount: targetConsoles.length,
            runningCount: 0,
            pulsing: false,
            onRenameTeam: handleRenameTeam,
            onUngroupTeam: handleUngroupTeam,
            onStartTeam: handleStartTeam,
            onStopTeam: handleStopTeam,
            onCloseTeam: handleCloseTeam,
            onAutoGridTeam: handleAutoGridTeam,
            onScaleTeam: handleScaleTeam,
          } satisfies TeamNodeData,
        };

        const orchNode: Node = {
          id: orchId,
          type: 'orchestratorNode',
          position: { x: Math.max(40, teamX - 380), y: teamY + 24 },
          dragHandle: '.orchestrator-drag-handle',
          data: {
            label: `Orchestrateur ${teamNum}`,
            teamId,
            teamLabel,
            members: [],
            collabMode: 'split',
            onChangeCollabMode: handleChangeCollabMode,
            onTriggerTeamRelay: handleTriggerTeamRelay,
            onSynthesizeTeamWork: handleSynthesizeTeamWork,
            onBroadcastToTeam: handleBroadcastToTeam,
            onStartTeam: handleStartTeam,
            onStopTeam: handleStopTeam,
            onCloseTeam: handleCloseTeam,
          } satisfies OrchestratorNodeData,
        };

        let memberIndex = 0;
        const updatedConsoles = nds.map((n) => {
          if (n.type === 'consoleNode' && targetConsoleIds.includes(n.id)) {
            const col = memberIndex % cols;
            const row = Math.floor(memberIndex / cols);
            memberIndex++;
            return {
              ...n,
              parentId: teamId,
              selected: false,
              position: {
                x: TEAM_PADDING_X + col * (DEFAULT_WIDTH + TEAM_GAP_X),
                y: TEAM_PADDING_TOP + row * (DEFAULT_HEIGHT + TEAM_GAP_Y),
              },
              width: DEFAULT_WIDTH,
              height: DEFAULT_HEIGHT,
              style: { ...n.style, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
              data: {
                ...n.data,
                teamId,
              },
            };
          }
          return n;
        });

        const nonTargetNodes = updatedConsoles.filter((n) => n.parentId !== teamId);
        const childNodes = updatedConsoles.filter((n) => n.parentId === teamId);
        return [...nonTargetNodes, teamNode, orchNode, ...childNodes];
      });

      setEdges((eds) =>
        eds.some((e) => e.id === cableId)
          ? eds
          : [
              ...eds,
              {
                id: cableId,
                source: orchId,
                target: teamId,
                type: 'animatedCable',
                data: {
                  active: true,
                  pulsing: false,
                  runningCount: 0,
                } satisfies AnimatedCableEdgeData,
              },
            ]
      );
    },
    [
      handleRenameTeam,
      handleUngroupTeam,
      handleStartTeam,
      handleStopTeam,
      handleCloseTeam,
      handleAutoGridTeam,
      handleScaleTeam,
      handleChangeCollabMode,
      handleTriggerTeamRelay,
      handleSynthesizeTeamWork,
      handleBroadcastToTeam,
      setNodes,
      setEdges,
    ]
  );

  // Group button handler
  const handleGroupAction = useCallback(() => {
    const selectedConsoles = nodes.filter(
      (n) => n.type === 'consoleNode' && n.selected
    );
    if (selectedConsoles.length >= 1) {
      createTeamFromConsoleIds(selectedConsoles.map((n) => n.id));
      return;
    }

    const ungroupedConsoles = nodes.filter(
      (n) => n.type === 'consoleNode' && !n.parentId
    );
    if (ungroupedConsoles.length >= 1) {
      createTeamFromConsoleIds(ungroupedConsoles.map((n) => n.id));
    }
  }, [nodes, createTeamFromConsoleIds]);

  // Load persisted state from app userData directory on mount
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      let loadedState: PersistedCanvasState | null = null;

      if (window.agentCanvasAPI) {
        const res = await window.agentCanvasAPI.loadCanvasState();
        if (res.filePath) setStoragePath(res.filePath);
        if (res.exists && res.state && Array.isArray(res.state.nodes)) {
          loadedState = res.state;
        }
      } else {
        const raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
        if (raw) {
          try {
            loadedState = JSON.parse(raw);
          } catch (_) {}
        }
      }

      if (cancelled) return;

      if (loadedState?.presets) {
        setCustomPresets(loadedState.presets);
      }
      if (typeof loadedState?.memoryNotes === 'string') {
        setMemoryNotes(loadedState.memoryNotes);
      }

      if (
        loadedState &&
        loadedState.version >= 3 &&
        Array.isArray(loadedState.nodes)
      ) {
        applySerializedRecords(
          loadedState.nodes,
          Array.isArray(loadedState.edges) ? loadedState.edges : [],
          true
        );
        if (loadedState.viewport && rfInstanceRef.current) {
          rfInstanceRef.current.setViewport(loadedState.viewport, { duration: 0 });
        }
      } else {
        // Initialize from first built-in preset (Squad Duo + Orchestrateur)
        const starter = BUILTIN_PRESETS[0];
        applySerializedRecords(starter.nodes, starter.edges, false);
      }

      setIsLoaded(true);
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [applySerializedRecords]);

  // Automated Markdown Summary Note generator (Pillar 1)
  const handleGenerateSummaryNote = useCallback(
    (teamId: string) => {
      const teamNode = nodes.find((n) => n.id === teamId);
      const teamConsoles = nodes.filter(
        (n) => n.type === 'consoleNode' && n.parentId === teamId
      );
      const teamLabel =
        (teamNode?.data as unknown as TeamNodeData)?.label || 'Team';

      const memberSummaries: string[] = [];
      for (const c of teamConsoles) {
        const cd = c.data as unknown as ConsoleNodeData;
        const reply = getLatestAgentReply(c.id);
        const replySnippet = reply?.text
          ? reply.text.slice(0, 320)
          : 'Console initialisée et prête.';
        memberSummaries.push(
          `### 🤖 ${cd.label || 'Agent'} (${cd.commandType || 'claude'})\n${replySnippet}`
        );
      }

      const orchNode = nodes.find(
        (n) =>
          n.type === 'orchestratorNode' &&
          (n.data as unknown as OrchestratorNodeData).teamId === teamId
      );
      const brief =
        (orchNode?.data as unknown as OrchestratorNodeData)
          ?.lastBroadcastPrompt || 'Mission d’équipe multi-agents';

      const noteContent = `## Synthèse des Travaux de l'Équipe\n\n**Mission :** ${brief}\n\n${
        memberSummaries.length > 0
          ? memberSummaries.join('\n\n')
          : 'Aucun log disponible pour le moment.'
      }\n\n---\n*Note générée automatiquement par Agent Canvas Orchestrator.*`;

      const id = `note-${Date.now()}`;
      const posX = teamNode
        ? teamNode.position.x + ((teamNode.width as number) || 1048) + 30
        : 400;
      const posY = teamNode ? teamNode.position.y : 100;

      const newNote: Node = {
        id,
        type: 'summaryNoteNode',
        position: { x: posX, y: posY },
        width: 460,
        height: 480,
        data: {
          title: `Synthèse · ${teamLabel}`,
          brief,
          teamLabel,
          createdAt: new Date().toLocaleTimeString(),
          content: noteContent,
        },
      };

      setNodes((nds) => [...nds, newNote]);
      playCanvasSound('complete');
    },
    [nodes, setNodes]
  );

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== noteId));
      setEdges((eds) => eds.filter((e) => e.source !== noteId && e.target !== noteId));
    },
    [setNodes, setEdges]
  );

  // Spawn Git Workspace Node (Pillar 2)
  /**
   * After the welcome screen: give a first team made of the AIs really installed on this PC
   * (instead of an empty canvas, or the example "Claude + Qwen" team that may not be installed).
   * Never touches a canvas the user already worked on.
   */
  const handleOnboardingDone = useCallback(
    (detected: DetectedCli[]) => {
      const cmds = pickStarterAgents(detected);
      if (cmds.length === 0) return;
      const consoles = nodes.filter((n) => n.type === 'consoleNode');
      const used = consoles.some((n) => {
        const d = n.data as unknown as ConsoleNodeData;
        return d.started || (d.promptsSent || 0) > 0;
      });
      if (used) return;
      const labelOf = (cmd: AgentCommandType) => COMMAND_OPTIONS.find((o) => o.id === cmd)?.label || cmd;
      const limitOf = (cmd: AgentCommandType) => COMMAND_OPTIONS.find((o) => o.id === cmd)?.defaultTokenLimit || 50000;
      const markOrchestrator = (teamId: string | undefined) =>
        setNodes((nds) =>
          nds.map((n) =>
            n.type === 'orchestratorNode' && teamId && (n.data as unknown as OrchestratorNodeData).teamId === teamId
              ? { ...n, data: { ...n.data, collabMode: cmds.length > 1 ? 'relay' : 'split', suggestedPrompt: STARTER_MISSION } }
              : n
          )
        );

      const untouchedStarter =
        consoles.length === 2 && consoles.every((n) => n.id === 'console-1' || n.id === 'console-2');
      if (untouchedStarter) {
        // Fresh install: swap the example agents for the installed ones.
        setNodes((nds) =>
          nds
            .filter((n) => !(n.id === 'console-2' && cmds.length < 2))
            .map((n) => {
              const index = n.id === 'console-1' ? 0 : n.id === 'console-2' ? 1 : -1;
              if (index < 0 || !cmds[index]) return n;
              return {
                ...n,
                data: { ...n.data, commandType: cmds[index], label: labelOf(cmds[index]), tokenLimit: limitOf(cmds[index]) },
              };
            })
        );
        markOrchestrator((consoles[0].data as unknown as ConsoleNodeData).teamId || consoles[0].parentId);
        return;
      }
      if (consoles.length > 0) return;

      // Empty canvas: create the consoles, group them, then preset the relay mission.
      const origin = findFreeSpot(nodes);
      const newNodes = cmds.map((cmd, i) =>
        buildConsoleNode({
          label: labelOf(cmd),
          commandType: cmd,
          position: { x: origin.x + i * (DEFAULT_WIDTH + 40), y: origin.y },
          tokenLimit: limitOf(cmd),
        })
      );
      setNodes((nds) => [...nds, ...newNodes]);
      createTeamFromConsoleIds(newNodes.map((n) => n.id));
      setNodes((nds) => {
        const teamId = nds.find((n) => n.id === newNodes[0].id)?.parentId;
        return nds.map((n) =>
          n.type === 'orchestratorNode' && teamId && (n.data as unknown as OrchestratorNodeData).teamId === teamId
            ? { ...n, data: { ...n.data, collabMode: cmds.length > 1 ? 'relay' : 'split', suggestedPrompt: STARTER_MISSION } }
            : n
        );
      });
      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.12, duration: 300 }), 150);
    },
    [nodes, setNodes, buildConsoleNode, createTeamFromConsoleIds]
  );

  const handleSpawnWorkspace = useCallback(() => {
    const id = `workspace-${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'workspaceNode',
      position: { x: 0, y: 0 },
      width: 440,
      height: 480,
      data: {
        projectPath: '',
        branchName: '',
        lastCommitMessage: '',
        modifiedFiles: [],
      },
    };
    setNodes((nds) => [...nds, { ...newNode, position: findFreeSpot(nds) }]);
    playCanvasSound('success');
  }, [setNodes, findFreeSpot]);

  // Spawn Pipeline Trigger Node (Pillar 3)
  const handleSpawnTrigger = useCallback(() => {
    const id = `trigger-${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'triggerNode',
      position: { x: 0, y: 0 },
      width: 380,
      height: 380,
      data: {
        label: 'Pipeline Automatique',
        mode: 'interval',
        intervalMinutes: 5,
        active: false,
        triggerPrompt: 'Vérifie les tests, le typage TypeScript et le statut git.',
      },
    };
    setNodes((nds) => [...nds, { ...newNode, position: findFreeSpot(nds) }]);
    playCanvasSound('success');
  }, [setNodes, findFreeSpot]);

  // Global Cross-Terminal Search Jump to Node (Pillar 4)
  const handleFocusNode = useCallback(
    (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (target && rfInstanceRef.current) {
        let x = target.position.x;
        let y = target.position.y;
        if (target.parentId) {
          const parent = nodes.find((n) => n.id === target.parentId);
          if (parent) {
            x += parent.position.x;
            y += parent.position.y;
          }
        }
        rfInstanceRef.current.setCenter(x + 240, y + 170, { zoom: 1.1, duration: 400 });
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            selected: n.id === nodeId,
          }))
        );
      }
    },
    [nodes, setNodes]
  );

  // Compute derived nodes & edges so Team headers and Orchestrator panels always reflect live member status
  const displayNodes = useMemo(() => {
    const membersByTeam = new Map<string, TeamMemberSummary[]>();
    const teamLabelById = new Map<string, string>();
    // Consoles run inside the project folder chosen in the (first) Workspace panel.
    const workspaceNode = nodes.find(
      (n) => n.type === 'workspaceNode' && (n.data as { projectPath?: string }).projectPath
    );
    const projectCwd = (workspaceNode?.data as { projectPath?: string } | undefined)?.projectPath || undefined;

    for (const n of nodes) {
      if (n.type === 'teamNode') {
        const td = n.data as unknown as TeamNodeData;
        teamLabelById.set(n.id, td.label || 'TEAM');
      }
    }

    for (const n of nodes) {
      if (n.type === 'consoleNode' && n.parentId) {
        const cd = n.data as unknown as ConsoleNodeData;
        const list = membersByTeam.get(n.parentId) || [];
        list.push({
          id: n.id,
          label: cd.label || 'Console',
          commandType: cd.commandType || 'claude',
          status: cd.status || 'idle',
          started: Boolean(cd.started),
          paused: Boolean(cd.paused),
        });
        membersByTeam.set(n.parentId, list);
      }
    }

    return nodes.map((n) => {
      if (n.type === 'teamNode') {
        const members = membersByTeam.get(n.id) || [];
        const runningCount = members.filter((m) => m.status === 'running').length;
        return {
          ...n,
          data: {
            ...n.data,
            memberCount: members.length,
            runningCount,
            pulsing: Boolean(pulsingTeamIds[n.id]),
            onRenameTeam: handleRenameTeam,
            onUngroupTeam: handleUngroupTeam,
            onStartTeam: handleStartTeam,
            onStopTeam: handleStopTeam,
            onCloseTeam: handleCloseTeam,
            onAutoGridTeam: handleAutoGridTeam,
            onScaleTeam: handleScaleTeam,
          },
        };
      }
      if (n.type === 'orchestratorNode') {
        const od = n.data as unknown as OrchestratorNodeData;
        const members = membersByTeam.get(od.teamId) || [];
        const teamLabel = teamLabelById.get(od.teamId) || od.teamLabel || 'TEAM';
        return {
          ...n,
          data: {
            ...n.data,
            teamLabel,
            members,
            collabMode: od.collabMode || 'split',
            onChangeCollabMode: handleChangeCollabMode,
            onTriggerTeamRelay: handleTriggerTeamRelay,
            onSynthesizeTeamWork: handleSynthesizeTeamWork,
            onBroadcastToTeam: handleBroadcastToTeam,
            onStartTeam: handleStartTeam,
            onStopTeam: handleStopTeam,
            onCloseTeam: handleCloseTeam,
            onGenerateSummaryNote: handleGenerateSummaryNote,
          },
        };
      }
      if (n.type === 'consoleNode') {
        return {
          ...n,
          data: {
            ...n.data,
            projectCwd,
            onUpdateNode: handleUpdateNode,
            onResizeNode: handleResizeNode,
            onCloseNode: handleCloseNode,
          },
        };
      }
      if (n.type === 'summaryNoteNode') {
        return {
          ...n,
          data: {
            ...n.data,
            onDeleteNote: handleDeleteNote,
          },
        };
      }
      if (n.type === 'workspaceNode') {
        return {
          ...n,
          data: {
            ...n.data,
            onInjectContextToTeam: (contextSummary: string) => {
              setMemoryNotes((prev) => `${prev}\n\n${contextSummary}`);
              const firstTeam = nodes.find((node) => node.type === 'teamNode');
              if (firstTeam) {
                // Context is information, not a mission: send it as-is to running consoles only.
                handleBroadcastToTeam(firstTeam.id, contextSummary, false, 'parallel');
              }
              playCanvasSound('success');
            },
            onClose: (wsId: string) => {
              setNodes((nds) => nds.filter((node) => node.id !== wsId));
              setEdges((eds) => eds.filter((e) => e.source !== wsId && e.target !== wsId));
            },
            onChangePath: (newPath: string) => {
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === n.id
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          projectPath: newPath,
                        },
                      }
                    : node
                )
              );
            },
            onGitInfo: (info: { branchName: string }) => {
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === n.id && (node.data as { branchName?: string }).branchName !== info.branchName
                    ? { ...node, data: { ...node.data, branchName: info.branchName } }
                    : node
                )
              );
            },
          },
        };
      }
      if (n.type === 'triggerNode') {
        return {
          ...n,
          data: {
            ...n.data,
            onFireTrigger: (_triggerId: string, prompt: string) => {
              const firstTeam = nodes.find((node) => node.type === 'teamNode');
              if (firstTeam) {
                // Only consoles already running receive it: a timer must never launch agents by itself.
                handleBroadcastToTeam(firstTeam.id, prompt, false, 'parallel');
              }
              playCanvasSound('relay');
            },
            onToggleActive: (triggerId: string, active: boolean) => {
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === triggerId
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          active,
                        },
                      }
                    : node
                )
              );
            },
            onClose: (triggerId: string) => {
              setNodes((nds) => nds.filter((node) => node.id !== triggerId));
              setEdges((eds) => eds.filter((e) => e.source !== triggerId && e.target !== triggerId));
            },
          },
        };
      }
      return n;
    });
  }, [
    nodes,
    pulsingTeamIds,
    handleGenerateSummaryNote,
    handleDeleteNote,
    handleBroadcastToTeam,
    handleRenameTeam,
    handleUngroupTeam,
    handleStartTeam,
    handleStopTeam,
    handleCloseTeam,
    handleAutoGridTeam,
    handleScaleTeam,
    handleChangeCollabMode,
    handleTriggerTeamRelay,
    handleSynthesizeTeamWork,
    handleUpdateNode,
    handleResizeNode,
    handleCloseNode,
    setEdges,
  ]);

  const displayEdges = useMemo<Edge[]>(() => {
    return edges.map((e) => {
      const teamNode = displayNodes.find((n) => n.id === e.target);
      const td = teamNode?.data as unknown as TeamNodeData | undefined;
      const runningCount = td?.runningCount ?? 0;
      const isPulsing = Boolean(pulsingTeamIds[e.target]);
      return {
        ...e,
        data: {
          ...e.data,
          active: runningCount > 0,
          runningCount,
          pulsing: isPulsing,
        } satisfies AnimatedCableEdgeData,
      };
    });
  }, [edges, displayNodes, pulsingTeamIds]);

  // Serialize current nodes & edges helper
  const serializeCurrentGraph = serializeGraph;

  // Save state helper
  const persistStateNow = useCallback(
    async (
      currentNodes: Node[],
      currentEdges: Edge[],
      currentPresets: CanvasPreset[],
      currentMemory: string,
      viewportOverride?: Viewport
    ) => {
      if (!isLoaded) return;

      const viewport =
        viewportOverride ||
        rfInstanceRef.current?.getViewport() || { x: 0, y: 0, zoom: 1 };

      const { serializedNodes, serializedEdges } = serializeCurrentGraph(
        currentNodes,
        currentEdges
      );

      const payload: PersistedCanvasState = {
        version: 3,
        updatedAt: new Date().toISOString(),
        viewport,
        nodes: serializedNodes,
        edges: serializedEdges,
        presets: currentPresets,
        memoryNotes: currentMemory,
      };

      if (window.agentCanvasAPI) {
        const res = await window.agentCanvasAPI.saveCanvasState(payload);
        if (res.ok) {
          setLastSavedAt(new Date().toLocaleTimeString());
        }
      } else {
        try {
          localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(payload));
          setLastSavedAt(new Date().toLocaleTimeString());
        } catch (err) {
          console.warn('[Storage] Sauvegarde navigateur impossible :', err);
        }
      }
    },
    [isLoaded, serializeCurrentGraph]
  );

  // Auto-save whenever state changes (throttled: at most one disk write every 2s, always ending with the latest state)
  useThrottledAutosave({
    enabled: isLoaded,
    args: [nodes, edges, customPresets, memoryNotes] as const,
    snapshot: (n, e, p, m) => {
      const { serializedNodes, serializedEdges } = serializeGraph(n, e);
      return JSON.stringify([serializedNodes, serializedEdges, p, m]);
    },
    save: (n, e, p, m) => persistStateNow(n, e, p, m),
  });

  // Toolbar action: New console (placed in non-overlapping space)
  const handleAddConsole = useCallback(() => {
    const idx = consoleCounterRef.current++;
    setNodes((nds) => {
      const topLevel = nds.filter((n) => !n.parentId);
      let maxBottom = 70;
      for (const n of topLevel) {
        const h =
          typeof n.style?.height === 'number'
            ? n.style.height
            : n.type === 'teamNode'
            ? 430
            : DEFAULT_HEIGHT;
        maxBottom = Math.max(maxBottom, n.position.y + h);
      }
      const newY = topLevel.length === 0 ? 90 : maxBottom + 44;
      const newNode = buildConsoleNode({
        label: `Agent ${idx}`,
        commandType: 'claude',
        position: { x: 420, y: newY },
      });
      return [...nds, newNode];
    });
  }, [buildConsoleNode, setNodes]);

  // Toolbar action: Spawn 4 in a 2x2 grid placed cleanly below existing teams/nodes
  const handleSpawnFour = useCallback(() => {
    const commands: AgentCommandType[] = ['claude', 'codex', 'gemini', 'shell'];
    const labels = [
      'Claude Lead',
      'Codex Builder',
      'Gemini Researcher',
      'System Shell',
    ];
    const gapX = DEFAULT_WIDTH + 32;
    const gapY = DEFAULT_HEIGHT + 32;

    setNodes((nds) => {
      const topLevel = nds.filter((n) => !n.parentId);
      let maxBottom = 50;
      for (const n of topLevel) {
        const h =
          typeof n.style?.height === 'number'
            ? n.style.height
            : n.type === 'teamNode'
            ? 430
            : DEFAULT_HEIGHT;
        maxBottom = Math.max(maxBottom, n.position.y + h);
      }
      const baseX = 420;
      const baseY = topLevel.length === 0 ? 80 : maxBottom + 48;

      const created = commands.map((cmd, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const idx = consoleCounterRef.current++;
        return buildConsoleNode({
          label: `${labels[i]} #${idx}`,
          commandType: cmd,
          position: {
            x: baseX + col * gapX,
            y: baseY + row * gapY,
          },
        });
      });

      return [...nds, ...created];
    });
  }, [buildConsoleNode, setNodes]);

  // Toolbar action: Spawn 4 Free AI agents (Qwen, Ollama, Kimi, DeepSeek) in a 2x2 grid
  const handleSpawnFreeSquad = useCallback(() => {
    const commands: AgentCommandType[] = ['qwen', 'ollama', 'kimi', 'deepseek'];
    const labels = [
      'Qwen3 Coder',
      'Ollama Local',
      'Kimi K2 CLI',
      'DeepSeek R1',
    ];
    const gapX = DEFAULT_WIDTH + 32;
    const gapY = DEFAULT_HEIGHT + 32;

    setNodes((nds) => {
      const topLevel = nds.filter((n) => !n.parentId);
      let maxBottom = 50;
      for (const n of topLevel) {
        const h =
          typeof n.style?.height === 'number'
            ? n.style.height
            : n.type === 'teamNode'
            ? 430
            : DEFAULT_HEIGHT;
        maxBottom = Math.max(maxBottom, n.position.y + h);
      }
      const baseX = 420;
      const baseY = topLevel.length === 0 ? 80 : maxBottom + 48;

      const created = commands.map((cmd, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const idx = consoleCounterRef.current++;
        return buildConsoleNode({
          label: `${labels[i]} #${idx}`,
          commandType: cmd,
          position: {
            x: baseX + col * gapX,
            y: baseY + row * gapY,
          },
        });
      });

      return [...nds, ...created];
    });
  }, [buildConsoleNode, setNodes]);

  // Toolbar action: Pause all / Resume all
  const allPaused = useMemo(() => {
    const startedConsoles = nodes.filter(
      (n) =>
        n.type === 'consoleNode' &&
        Boolean((n.data as unknown as ConsoleNodeData).started)
    );
    return (
      startedConsoles.length > 0 &&
      startedConsoles.every((n) => Boolean((n.data as unknown as ConsoleNodeData).paused))
    );
  }, [nodes]);

  const handleTogglePauseAll = useCallback(async () => {
    const nextPaused = !allPaused;
    for (const n of nodes) {
      if (n.type === 'consoleNode') {
        const cd = n.data as unknown as ConsoleNodeData;
        if (cd.started && window.agentCanvasAPI) {
          await window.agentCanvasAPI.pausePty(n.id, nextPaused);
        }
      }
    }
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type === 'consoleNode') {
          const cd = n.data as unknown as ConsoleNodeData;
          if (!cd.started) return n;
          return {
            ...n,
            data: {
              ...n.data,
              paused: nextPaused,
              status: nextPaused ? 'waiting' : 'running',
            },
          };
        }
        return n;
      })
    );
  }, [allPaused, nodes, setNodes]);

  // Toolbar action: Rename all consoles with prefix
  const handleRenameAll = useCallback(
    (prefix: string) => {
      let idx = 1;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'consoleNode') {
            const label = `${prefix} ${idx++}`;
            return {
              ...n,
              data: {
                ...n.data,
                label,
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  // Toolbar action: Save / Load / Delete Preset
  const handleSavePreset = useCallback(
    (name: string, description: string) => {
      const { serializedNodes, serializedEdges } = serializeCurrentGraph(
        nodes,
        edges
      );
      const newPreset: CanvasPreset = {
        id: `preset-${Date.now()}`,
        name,
        description,
        createdAt: new Date().toISOString(),
        nodes: serializedNodes,
        edges: serializedEdges,
      };
      setCustomPresets((prev) => [newPreset, ...prev]);
    },
    [nodes, edges, serializeCurrentGraph]
  );

  const handleLoadPreset = useCallback(
    async (preset: CanvasPreset) => {
      activeWorkflowsRef.current = {};
      for (const n of nodes) {
        if (n.type === 'consoleNode') {
          markConsoleStarted(n.id, false);
          if (window.agentCanvasAPI) {
            await window.agentCanvasAPI.killPty(n.id);
          }
        }
      }
      applySerializedRecords(preset.nodes, preset.edges, true);
    },
    [nodes, applySerializedRecords]
  );

  const handleDeletePreset = useCallback((id: string) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Build available @ targets for the bottom Command Bar
  const commandTargets = useMemo<CommandTargetOption[]>(() => {
    const list: CommandTargetOption[] = [
      {
        id: 'all',
        kind: 'all',
        handle: '@all',
        label: 'Tous les agents',
        subtitle: 'Diffuser à toutes les consoles',
      },
    ];

    for (const n of displayNodes) {
      if (n.type === 'teamNode') {
        const td = n.data as unknown as TeamNodeData;
        const slug = (td.label || 'team').toLowerCase().replace(/\s+/g, '-');
        list.push({
          id: n.id,
          kind: 'team',
          handle: `@${slug}`,
          label: td.label,
          subtitle: `Équipe · ${td.runningCount}/${td.memberCount} running`,
          status: td.runningCount > 0 ? 'running' : 'idle',
        });
      }
    }

    for (const n of displayNodes) {
      if (n.type === 'consoleNode') {
        const cd = n.data as unknown as ConsoleNodeData;
        const slug = (cd.label || 'agent').toLowerCase().replace(/\s+/g, '-');
        list.push({
          id: n.id,
          kind: 'console',
          handle: `@${slug}`,
          label: cd.label,
          subtitle: `Agent · ${cd.commandType}`,
          status: cd.status || 'idle',
        });
      }
    }

    return list;
  }, [displayNodes]);

  // Send prompt from the bottom Command Bar to target ('all' | 'team' | 'console')
  const handleSendCommandFromBar = useCallback(
    (target: CommandTargetOption, prompt: string) => {
      if (target.kind === 'team') {
        handleBroadcastToTeam(target.id, prompt, true);
        return;
      }

      if (target.kind === 'all') {
        // Pulse all teams
        for (const n of nodes) {
          if (n.type === 'teamNode') {
            triggerTeamPulse(n.id);
          }
        }
      }

      setNodes((nds) =>
        nds.map((node) => {
          if (node.type !== 'consoleNode') return node;
          const isMatch =
            target.kind === 'all' ||
            (target.kind === 'console' && node.id === target.id);
          if (!isMatch) return node;

          if (node.parentId) {
            triggerTeamPulse(node.parentId);
          }

          markConsoleStarted(node.id, true);
          const cData = node.data as unknown as ConsoleNodeData;
          if (cData.started) {
            return {
              ...node,
              data: {
                ...node.data,
                pendingPrompt: prompt,
              },
            };
          } else {
            return {
              ...node,
              data: {
                ...node.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
                pendingPrompt: prompt,
              },
            };
          }
        })
      );
    },
    [handleBroadcastToTeam, nodes, setNodes, triggerTeamPulse]
  );

  // Start all idle consoles at once
  const handleStartAll = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === 'consoleNode') {
          markConsoleStarted(node.id, true);
          return {
            ...node,
            data: {
              ...node.data,
              started: true,
              paused: false,
              restoredFromDisk: false,
              status: 'running',
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Clear all consoles & teams
  const handleClearAll = useCallback(async () => {
    // One click used to wipe the whole canvas irreversibly: always ask first.
    const consoleCount = nodes.filter((n) => n.type === 'consoleNode').length;
    if (
      nodes.length > 0 &&
      !window.confirm(
        `Tout effacer ? ${consoleCount} console(s), les équipes et les panneaux seront supprimés et les IA arrêtées.\n\n(Une copie de secours du canvas précédent est gardée.)`
      )
    ) {
      return;
    }
    activeWorkflowsRef.current = {};
    for (const n of nodes) {
      if (n.type === 'consoleNode') {
        markConsoleStarted(n.id, false);
        if (window.agentCanvasAPI) {
          await window.agentCanvasAPI.killPty(n.id);
        }
      }
    }
    setNodes([]);
    setEdges([]);
  }, [nodes, setNodes, setEdges]);

  const nodeTypes = useMemo(
    () => ({
      consoleNode: ConsoleNode,
      teamNode: TeamNode,
      orchestratorNode: OrchestratorNode,
      summaryNoteNode: SummaryNoteNode,
      workspaceNode: WorkspaceNode,
      triggerNode: TriggerNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      animatedCable: AnimatedCableEdge,
    }),
    []
  );

  const stats = useMemo(() => {
    let consoles = 0;
    let teams = 0;
    let running = 0;
    let waiting = 0;
    let idle = 0;
    let selectedConsoles = 0;

    for (const n of nodes) {
      if (n.type === 'teamNode') {
        teams++;
      } else if (n.type === 'consoleNode') {
        consoles++;
        if (n.selected) selectedConsoles++;
        const d = n.data as unknown as ConsoleNodeData;
        if (d.status === 'running') running++;
        else if (d.status === 'waiting') waiting++;
        else idle++;
      }
    }
    return { consoles, teams, running, waiting, idle, selectedConsoles };
  }, [nodes]);

  const quotaSummary = useMemo(() => computeQuotaSummary(nodes), [nodes]);

  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  // Desktop first launch: the onboarding (installed AIs, costs, safety) comes before the tutorial.
  const [showOnboarding, setShowOnboarding] = useState(
    () => Boolean(window.agentCanvasAPI) && !isOnboardingDone()
  );
  const [showTutorialModal, setShowTutorialModal] = useState(
    () => !localStorage.getItem(TUTORIAL_SEEN_KEY) && !(Boolean(window.agentCanvasAPI) && !isOnboardingDone())
  );
  const [appUpdate, setAppUpdate] = useState<AppUpdateState | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');
  useEffect(() => {
    window.agentCanvasAPI?.getAppInfo?.().then((info) => info && setAppVersion(info.version));
    return window.agentCanvasAPI?.onAppUpdate?.((payload) => setAppUpdate(payload));
  }, []);
  // "À jour" / errors fade out after a few seconds; downloading and ready stay visible.
  useEffect(() => {
    if (!appUpdate || !['up-to-date', 'error', 'unavailable'].includes(appUpdate.state)) return;
    const timer = setTimeout(() => setAppUpdate(null), 6000);
    return () => clearTimeout(timer);
  }, [appUpdate]);
  const handleUpdateClick = useCallback(async () => {
    const api = window.agentCanvasAPI;
    if (!api) return;
    if (appUpdate?.state === 'ready') {
      api.installUpdate?.();
      return;
    }
    if (appUpdate?.state === 'downloading' || appUpdate?.state === 'checking') return;
    setAppUpdate({ state: 'checking' });
    const res = await api.checkUpdate?.();
    if (res && res.state !== 'checking') setAppUpdate(res);
  }, [appUpdate]);
  const [showAiHelpModal, setShowAiHelpModal] = useState(false);
  const [aiHelpTarget, setAiHelpTarget] = useState<{
    agent: AgentCommandType;
    consoleId?: string;
    consoleLabel?: string;
  }>({ agent: 'gemini' });
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportPrefillSubject, setSupportPrefillSubject] = useState<string | undefined>(
    undefined
  );
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showGlobalSearchModal, setShowGlobalSearchModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [audioMuted, setAudioMuted] = useState(!isAudioEnabled());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setShowGlobalSearchModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const nodeMetaMap = useMemo(() => {
    const map = new Map<string, { label: string; commandType: string }>();
    for (const n of nodes) {
      if (n.type === 'consoleNode') {
        const cd = n.data as unknown as ConsoleNodeData;
        map.set(n.id, {
          label: cd.label || 'Console',
          commandType: cd.commandType || 'claude',
        });
      }
    }
    return map;
  }, [nodes]);

  const handleSelectTemplate = useCallback(
    (promptText: string) => {
      const firstTeam = nodes.find((n) => n.type === 'teamNode');
      if (firstTeam) {
        handleBroadcastToTeam(firstTeam.id, promptText, true);
      } else {
        handleSendCommandFromBar(
          {
            kind: 'all',
            id: 'all',
            handle: '@all',
            label: 'Toutes les consoles',
            subtitle: 'Diffusion globale',
          },
          promptText
        );
      }
      setShowTemplatesModal(false);
      playCanvasSound('success');
    },
    [nodes, handleBroadcastToTeam, handleSendCommandFromBar]
  );

  const [configuredKeysCount, setConfiguredKeysCount] = useState(() =>
    countConfiguredKeys(loadUserWebApiKeys())
  );
  const [autoScaleWindow, setAutoScaleWindow] = useState(true);

  // Automatic app update tracker
  const [hasUpdate, setHasUpdate] = useState(false);
  const [remoteUpdateInfo, setRemoteUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [dismissUpdateBanner, setDismissUpdateBanner] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    initializeVersionTracker();

    const check = async () => {
      const res = await checkForAppUpdate();
      if (!isCancelled && res.hasUpdate && res.remoteInfo) {
        setHasUpdate(true);
        setRemoteUpdateInfo(res.remoteInfo);
      }
    };

    const initialTimeout = setTimeout(check, 3500);
    const interval = setInterval(check, 25000);
    const onFocus = () => {
      check();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      isCancelled = true;
      clearTimeout(initialTimeout);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  const handleRestartAndUpdate = useCallback(async () => {
    setUpdateNotice('Mise à jour...');
    await forceAppUpdateAndRestart();
  }, []);

  const handleManualCheckAndUpdate = useCallback(async () => {
    setIsCheckingUpdate(true);
    setUpdateNotice('Vérification...');
    const res = await checkForAppUpdate();
    setIsCheckingUpdate(false);
    if (res.hasUpdate) {
      setHasUpdate(true);
      setRemoteUpdateInfo(res.remoteInfo || null);
      setUpdateNotice('MàJ trouvée !');
      setTimeout(async () => {
        await forceAppUpdateAndRestart();
      }, 500);
    } else {
      setUpdateNotice('Redémarrage...');
      setTimeout(async () => {
        await forceAppUpdateAndRestart();
      }, 600);
    }
  }, []);

  const checkIsDesktopAppInstalled = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return (
      Boolean(window.agentCanvasAPI) ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      localStorage.getItem('agent-canvas-app-installed') === 'true'
    );
  }, []);

  const [isDesktopAppInstalled, setIsDesktopAppInstalled] = useState(
    checkIsDesktopAppInstalled
  );

  useEffect(() => {
    const updateInstallStatus = () => {
      setIsDesktopAppInstalled(checkIsDesktopAppInstalled());
    };

    window.addEventListener('appinstalled', () => {
      localStorage.setItem('agent-canvas-app-installed', 'true');
      setIsDesktopAppInstalled(true);
    });
    window.addEventListener(
      'agent-canvas-app-installed-changed',
      updateInstallStatus
    );

    const mql = window.matchMedia('(display-mode: standalone)');
    if (mql?.addEventListener) {
      mql.addEventListener('change', updateInstallStatus);
    }

    return () => {
      window.removeEventListener(
        'agent-canvas-app-installed-changed',
        updateInstallStatus
      );
      if (mql?.removeEventListener) {
        mql.removeEventListener('change', updateInstallStatus);
      }
    };
  }, [checkIsDesktopAppInstalled]);

  useEffect(() => {
    const handleOpenModal = () => setShowApiKeysModal(true);
    const handleKeysUpdated = () =>
      setConfiguredKeysCount(countConfiguredKeys(loadUserWebApiKeys()));
    const handleOpenAiHelp = (e: Event) => {
      const custom = e as CustomEvent<{
        agent?: AgentCommandType;
        consoleId?: string;
        consoleLabel?: string;
      }>;
      setAiHelpTarget({
        agent: custom.detail?.agent || 'gemini',
        consoleId: custom.detail?.consoleId,
        consoleLabel: custom.detail?.consoleLabel,
      });
      setShowAiHelpModal(true);
    };
    const handleOpenTutorial = () => setShowTutorialModal(true);
    const handleOpenSupport = (e: Event) => {
      const custom = e as CustomEvent<{ subject?: string }>;
      setSupportPrefillSubject(custom.detail?.subject);
      setShowSupportModal(true);
    };

    window.addEventListener('agent-canvas-open-keys-modal', handleOpenModal);
    window.addEventListener('agent-canvas-open-api-keys', handleOpenModal);
    window.addEventListener('agent-canvas-keys-updated', handleKeysUpdated);
    window.addEventListener('agent-canvas-open-ai-help', handleOpenAiHelp);
    window.addEventListener('agent-canvas-open-tutorial', handleOpenTutorial);
    window.addEventListener('agent-canvas-open-support', handleOpenSupport);
    return () => {
      window.removeEventListener('agent-canvas-open-keys-modal', handleOpenModal);
      window.removeEventListener('agent-canvas-open-api-keys', handleOpenModal);
      window.removeEventListener('agent-canvas-keys-updated', handleKeysUpdated);
      window.removeEventListener('agent-canvas-open-ai-help', handleOpenAiHelp);
      window.removeEventListener('agent-canvas-open-tutorial', handleOpenTutorial);
      window.removeEventListener('agent-canvas-open-support', handleOpenSupport);
    };
  }, []);

  const handleRunInConsole = useCallback(
    (consoleId: string, textToRun: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== consoleId || node.type !== 'consoleNode') return node;
          return {
            ...node,
            data: {
              ...node.data,
              started: true,
              paused: false,
              restoredFromDisk: false,
              status: 'running',
              pendingPrompt: textToRun,
            },
          };
        })
      );
    },
    [setNodes]
  );

  const activeAgentsSummary = useMemo(() => {
    const consoles = nodes.filter((n) => n.type === 'consoleNode');
    if (consoles.length === 0) return 'Aucune console sur le canvas';
    return consoles
      .map((n) => {
        const d = n.data as unknown as ConsoleNodeData;
        return `${d.label} (${d.commandType}, ${d.started ? d.status : 'non démarré'})`;
      })
      .join(' | ');
  }, [nodes]);

  // Automatically scale/fit inner frames when the main application window ("la grande page") is resized
  useEffect(() => {
    if (!autoScaleWindow) return;
    let settleTimer: number | null = null;

    const handleWindowResize = () => {
      if (settleTimer !== null) clearTimeout(settleTimer);

      // Debounce fitView while dragging window corners so it never oscillates or fights the user
      settleTimer = window.setTimeout(() => {
        rfInstanceRef.current?.fitView({ padding: 0.1, duration: 250 });
      }, 120);
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (settleTimer !== null) clearTimeout(settleTimer);
    };
  }, [autoScaleWindow]);

  const handleResetAllQuotas = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.type === 'consoleNode'
          ? {
              ...n,
              data: {
                ...n.data,
                estimatedTokens: 0,
                promptsSent: 0,
                rateLimitWarning: undefined,
              },
            }
          : n
      )
    );
  }, [setNodes]);

  const allPresets = useMemo(
    () => [...BUILTIN_PRESETS, ...customPresets],
    [customPresets]
  );


  return (
    <div className="fixed inset-0 w-full h-full min-w-0 min-h-0 bg-[#14121a] relative overflow-hidden select-none">
      {/* Top Bar: Brand + Live Stats + Global Quota Progress Bar + Persistence Status */}
      <div className="app-top-bar absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#1c1a22]/90 backdrop-blur-xl border border-[#2d2a37] shadow-card">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff6a3d] shadow-[0_0_12px_#ff6a3d]" />
          <span className="font-semibold text-sm tracking-tight text-zinc-100">
            Agent Canvas
          </span>

          <div className="h-4 w-[1px] bg-[#2d2a37] mx-0.5" />

          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span>
              <strong className="text-zinc-100">{stats.consoles}</strong> agents
            </span>
            <span>
              <strong className="text-[#ff6a3d]">{stats.teams}</strong> équipes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e]" />
              {stats.running} running
            </span>
          </div>

          {stats.idle > 0 && (
            <button
              onClick={handleStartAll}
              className="ml-1 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ff6a3d]/15 hover:bg-[#ff6a3d] text-[#ff6a3d] hover:text-white border border-[#ff6a3d]/40 text-[11px] font-medium transition-all"
              title="Démarrer toutes les consoles au repos"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Start all ({stats.idle})</span>
            </button>
          )}

          {nodes.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Vider le canvas"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Center-Right: Global Limits & Quota Progress Bar Widget */}
        <QuotaWidget summary={quotaSummary} onResetAll={handleResetAllQuotas} />

        {/* Help, Tutorial, Support, Install App, API Keys + Zoom Controls Pill */}
        <div className="pointer-events-none flex items-center gap-2 flex-wrap justify-end *:pointer-events-auto">
          {/* Restart & Update Button: visible ONLY when an update is available */}
          {hasUpdate && (
            <button
              type="button"
              onClick={handleRestartAndUpdate}
              className="animate-pulse flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-[#ff6a3d] text-white shadow-[0_0_20px_rgba(255,106,61,0.85)] text-xs font-bold transition-all cursor-pointer border border-amber-300"
              title="Une nouvelle mise à jour est prête ! Cliquez pour redémarrer immédiatement avec la dernière version"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⚡ MàJ dispo ! Redémarrer</span>
            </button>
          )}

          {/* Install Desktop App Button (hidden if the user already has the desktop app or is in standalone mode) */}
          {!isDesktopAppInstalled && (
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#ff6a3d] hover:bg-[#ff7d55] text-white shadow-[0_0_18px_-3px_rgba(255,106,61,0.65)] text-xs font-bold transition-all cursor-pointer"
              title="Installer Agent Canvas comme une vraie Application sur votre PC / Mac (sans navigateur)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Installer l’App</span>
            </button>
          )}

          {/* Desktop app: check / download / install updates without leaving the app */}
          {Boolean(window.agentCanvasAPI) && (
            <AppUpdateButton update={appUpdate} version={appVersion} onClick={handleUpdateClick} />
          )}

          {/* First-launch checklist (installed AIs, costs, safety) */}
          {Boolean(window.agentCanvasAPI) && (
            <button
              type="button"
              onClick={() => setShowOnboarding(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1c1a22]/90 hover:bg-[#24212c] backdrop-blur-xl border border-[#2d2a37] shadow-card text-xs text-zinc-200 transition-colors cursor-pointer"
              title="Voir quelles IA sont installées sur ce PC, les coûts et les règles de sécurité"
            >
              <span className="font-semibold">Mes IA</span>
            </button>
          )}

          {/* Interactive Tutorial Button */}
          <button
            type="button"
            onClick={() => setShowTutorialModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1c1a22]/90 hover:bg-[#24212c] backdrop-blur-xl border border-amber-500/40 shadow-card text-xs text-amber-200 transition-colors cursor-pointer"
            title="Ouvrir le Tutoriel Interactif pour débutants"
          >
            <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">Tuto</span>
          </button>

          {/* AI Guide & Commands Button */}
          <button
            type="button"
            onClick={() => {
              setAiHelpTarget({ agent: 'gemini' });
              setShowAiHelpModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1c1a22]/90 hover:bg-[#24212c] backdrop-blur-xl border border-[#2d2a37] shadow-card text-xs text-zinc-200 transition-colors cursor-pointer"
            title="Voir les explications et commandes de chaque IA"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#ff6a3d]" />
            <span className="font-medium">Aide IA</span>
          </button>

          {/* Global Cross-Terminal Search (Ctrl+Shift+F) */}
          <button
            type="button"
            onClick={() => setShowGlobalSearchModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1c1a22]/90 hover:bg-[#24212c] backdrop-blur-xl border border-[#2d2a37] hover:border-[#ff6a3d]/50 shadow-card text-xs text-zinc-200 transition-colors cursor-pointer group"
            title="Rechercher dans tous les terminaux & logs (Ctrl+Shift+F)"
          >
            <Search className="w-3.5 h-3.5 text-[#ff6a3d]" />
            <span className="font-medium">Recherche</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-800/80 rounded border border-zinc-700">
              Ctrl+Shift+F
            </kbd>
          </button>

          {/* Audio Chimes Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !audioMuted;
              setAudioMuted(next);
              setAudioEnabled(!next);
              if (!next) {
                playCanvasSound('success');
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-2xl bg-[#1c1a22]/90 hover:bg-[#24212c] backdrop-blur-xl border shadow-card text-xs transition-colors cursor-pointer ${
              audioMuted
                ? 'border-zinc-700 text-zinc-500'
                : 'border-emerald-500/40 text-emerald-300'
            }`}
            title={audioMuted ? 'Activer les sons sonores Web Audio' : 'Couper les sons sonores'}
          >
            {audioMuted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden sm:inline font-medium">
              {audioMuted ? 'Sons OFF' : 'Sons ON'}
            </span>
          </button>

          {/* Direct Support Button (report a problem) */}
          <button
            type="button"
            onClick={() => {
              setSupportPrefillSubject(undefined);
              setShowSupportModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1c1a22]/90 hover:bg-[#24212c] backdrop-blur-xl border border-emerald-500/40 shadow-card text-xs text-emerald-300 transition-colors cursor-pointer"
            title="Un problème ? Signaler-le (ticket GitHub pré-rempli)"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">Support</span>
          </button>

          {/* Personal API Keys Button (Web Mode only - hidden in Electron Desktop where CLI is native) */}
          {!Boolean((window as any).agentCanvasAPI) && (
            <button
              type="button"
              onClick={() => setShowApiKeysModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1c1a22]/90 hover:bg-[#24212c] backdrop-blur-xl border border-[#2d2a37] shadow-card text-xs text-zinc-200 transition-colors cursor-pointer"
              title="Configurer vos propres clés API (stockées localement dans votre navigateur)"
            >
              <Key className="w-3.5 h-3.5 text-[#ff6a3d]" />
              <span className="font-medium">Clés API</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  configuredKeysCount > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {configuredKeysCount}
              </span>
            </button>
          )}

          {/* Quick Canvas Zoom & Fit Controls */}
          <CanvasZoomControls
            rfInstanceRef={rfInstanceRef}
            autoScale={autoScaleWindow}
            onAutoScaleChange={setAutoScaleWindow}
          />

          <div
            className="hidden 2xl:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#1c1a22]/90 backdrop-blur-xl border border-[#2d2a37] shadow-card text-xs text-zinc-400"
            title={`Fichier de persistance : ${storagePath}`}
          >
            <HardDrive className="w-3.5 h-3.5 text-[#ff6a3d]" />
            <span className="font-mono text-[11px] text-zinc-300 truncate max-w-[180px]">
              {storagePath}
            </span>
            {lastSavedAt && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 pl-1.5 border-l border-[#2d2a37]">
                <CheckCircle2 className="w-3 h-3" />
                Saved ({lastSavedAt})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Floating App Update Banner when new version is detected */}
      {hasUpdate && !dismissUpdateBanner && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#1c1a22]/95 backdrop-blur-xl border-2 border-[#ff6a3d] shadow-[0_0_30px_rgba(255,106,61,0.6)] text-xs animate-node-appear">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="font-semibold text-zinc-100 truncate">
              🚀 Nouvelle mise à jour déployée :{' '}
              <span className="text-amber-300 font-normal">
                {remoteUpdateInfo?.description || 'Derniers correctifs disponibles'}
              </span>
            </span>
          </div>
          <button
            onClick={handleRestartAndUpdate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] text-white text-xs font-bold shadow-md transition-all cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Redémarrer & Mettre à jour</span>
          </button>
          <button
            onClick={() => setDismissUpdateBanner(true)}
            className="text-zinc-400 hover:text-zinc-200 p-1 text-sm shrink-0"
            title="Masquer l'alerte"
          >
            ✕
          </button>
        </div>
      )}

      {/* Install Desktop App Modal (1-Click PWA + Windows Launcher) */}
      <InstallAppModal
        open={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* Personal API Keys Modal for Web / Cloudflare Mode */}
      <ApiKeysModal
        isOpen={showApiKeysModal}
        onClose={() => setShowApiKeysModal(false)}
      />

      {/* Interactive Beginner Tutorial Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={(detected) => {
          setShowOnboarding(false);
          handleOnboardingDone(detected);
          if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) setShowTutorialModal(true);
        }}
      />

      <InteractiveTutorialModal
        isOpen={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
        onOpenApiKeys={() => setShowApiKeysModal(true)}
        onOpenAiHelp={() => {
          setAiHelpTarget({ agent: 'gemini' });
          setShowAiHelpModal(true);
        }}
        onOpenSupport={() => {
          setSupportPrefillSubject(undefined);
          setShowSupportModal(true);
        }}
        onSpawnFreeSquad={handleSpawnFreeSquad}
        onStartAllConsoles={handleStartAll}
        onFitCanvas={() => rfInstanceRef.current?.fitView({ padding: 0.12, duration: 240 })}
      />

      {/* Per-AI Help & Terminal Commands Modal */}
      <AiHelpModal
        isOpen={showAiHelpModal}
        initialAgent={aiHelpTarget.agent}
        targetConsoleId={aiHelpTarget.consoleId}
        targetConsoleLabel={aiHelpTarget.consoleLabel}
        onClose={() => setShowAiHelpModal(false)}
        onRunInConsole={handleRunInConsole}
        onOpenApiKeys={() => setShowApiKeysModal(true)}
        onOpenSupport={(ctx) => {
          setSupportPrefillSubject(ctx);
          setShowSupportModal(true);
        }}
        onOpenTutorial={() => setShowTutorialModal(true)}
      />

      {/* Support Modal to Report a problem */}
      <SupportModal
        isOpen={showSupportModal}
        prefillSubject={supportPrefillSubject}
        activeAgentsSummary={activeAgentsSummary}
        onClose={() => setShowSupportModal(false)}
        onOpenApiKeys={() => setShowApiKeysModal(true)}
        onOpenAiHelp={() => {
          setAiHelpTarget({ agent: 'gemini' });
          setShowAiHelpModal(true);
        }}
      />

      {/* Global Multi-Agent Cross-Terminal Search Modal (Ctrl+Shift+F) */}
      <GlobalSearchModal
        isOpen={showGlobalSearchModal}
        onClose={() => setShowGlobalSearchModal(false)}
        nodeMetaMap={nodeMetaMap}
        onFocusNode={handleFocusNode}
      />

      {/* Pro Prompt & Mission Templates Modal */}
      <PromptTemplatesModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onSelectPrompt={handleSelectTemplate}
      />

      {/* Bottom Floating Toolbar + @ Command Bar */}
      <FloatingDock
        targets={commandTargets}
        selectedConsolesCount={stats.selectedConsoles}
        allPaused={allPaused}
        presets={allPresets}
        memoryNotes={memoryNotes}
        onChangeMemoryNotes={setMemoryNotes}
        onNewConsole={handleAddConsole}
        onSpawnFour={handleSpawnFour}
        onSpawnFreeSquad={handleSpawnFreeSquad}
        onGroup={handleGroupAction}
        onTogglePauseAll={handleTogglePauseAll}
        onRenameAll={handleRenameAll}
        onSavePreset={handleSavePreset}
        onLoadPreset={handleLoadPreset}
        onDeletePreset={handleDeletePreset}
        onSendCommand={handleSendCommandFromBar}
        onOpenTemplates={() => setShowTemplatesModal(true)}
        onSpawnWorkspace={handleSpawnWorkspace}
        onSpawnTrigger={handleSpawnTrigger}
      />

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          rfInstanceRef.current = instance;
        }}
        onMoveEnd={(_event, viewport) => {
          persistStateNow(nodes, edges, customPresets, memoryNotes, viewport);
        }}
        minZoom={0.2}
        maxZoom={2}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.4}
          color="#2d2a37"
        />
        <MiniMap
          position="bottom-left"
          ariaLabel="Mini-carte du canvas"
          pannable
          zoomable
          style={{
            backgroundColor: '#1c1a22',
            border: '1px solid #2d2a37',
            borderRadius: '12px',
          }}
          maskColor="rgba(20, 18, 26, 0.75)"
          nodeColor={(n) => {
            if (n.type === 'teamNode') return 'rgba(255, 106, 61, 0.22)';
            if (n.type === 'orchestratorNode') return '#ff6a3d';
            const d = n.data as unknown as ConsoleNodeData;
            if (d?.status === 'running') return '#22c55e';
            if (d?.status === 'waiting') return '#f97316';
            if (d?.status === 'error') return '#ef4444';
            return '#71717a';
          }}
        />
        {displayNodes.length === 0 && (
          <div className="empty-minimap-hint pointer-events-none absolute bottom-[5px] left-[5px] z-10 flex h-[150px] w-[200px] items-center justify-center px-4 text-center text-[11px] text-zinc-500">
            Ajoute un agent pour afficher la mini-carte
          </div>
        )}
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
