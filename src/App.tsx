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
  Gauge,
  RotateCcw,
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
  FolderGit2,
  Clock,
  FileText,
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
import { SummaryNoteNode, SummaryNoteNodeData } from './components/SummaryNoteNode';
import { WorkspaceNode, WorkspaceNodeData } from './components/WorkspaceNode';
import { TriggerNode, TriggerNodeData } from './components/TriggerNode';
import { AnimatedCableEdge } from './components/AnimatedCableEdge';
import { FloatingDock } from './components/FloatingDock';
import { OnboardingModal, isOnboardingDone } from './components/OnboardingModal';
import type { AppUpdateState } from './types';
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
  AgentReplyRecord,
  TeamPlanningMember,
  buildProjectPlanningPrompt,
  buildSplitTaskAssignments,
  formatTeamSynthesisPrompt,
  formatTeammateRelayPrompt,
  getLatestAgentReply,
  getTerminalScrollback,
  markConsoleStarted,
  parseProjectTaskPlan,
  recordInterAgentMessage,
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
  TeamCollabMode,
  TeamMemberSummary,
  TeamNodeData,
} from './types';

const DEFAULT_WIDTH = 490;
const DEFAULT_HEIGHT = 344;
const TEAM_PADDING_X = 24;
const TEAM_PADDING_TOP = 64;
const TEAM_PADDING_BOTTOM = 24;
const TEAM_GAP_X = 20;
const TEAM_GAP_Y = 20;
const LOCAL_STORAGE_FALLBACK_KEY = 'agent-canvas:state:v3';

function computeTeamGridMetrics(
  memberCount: number,
  cellW = DEFAULT_WIDTH,
  cellH = DEFAULT_HEIGHT
) {
  const cols = memberCount <= 1 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(memberCount / cols));
  const width = TEAM_PADDING_X * 2 + cols * cellW + (cols - 1) * TEAM_GAP_X;
  const height =
    TEAM_PADDING_TOP + TEAM_PADDING_BOTTOM + rows * cellH + (rows - 1) * TEAM_GAP_Y;
  return { cols, rows, width, height };
}

function getNodeDimensions(
  node: Node,
  fallbackW = DEFAULT_WIDTH,
  fallbackH = DEFAULT_HEIGHT
): { width: number; height: number } {
  const w =
    typeof node.width === 'number' && node.width > 0
      ? node.width
      : typeof node.style?.width === 'number' && node.style.width > 0
      ? node.style.width
      : typeof node.measured?.width === 'number' && node.measured.width > 0
      ? node.measured.width
      : fallbackW;

  const h =
    typeof node.height === 'number' && node.height > 0
      ? node.height
      : typeof node.style?.height === 'number' && node.style.height > 0
      ? node.style.height
      : typeof node.measured?.height === 'number' && node.measured.height > 0
      ? node.measured.height
      : fallbackH;

  return { width: Math.round(w), height: Math.round(h) };
}

function getEnclosingTeamDimensions(
  teamId: string,
  nodes: Node[],
  desiredW?: number,
  desiredH?: number
): { width: number; height: number } {
  const teamNode = nodes.find((n) => n.id === teamId);
  const curTeamDims = teamNode
    ? getNodeDimensions(teamNode, 1048, 432)
    : { width: 1048, height: 432 };
  const baseW = desiredW ?? curTeamDims.width;
  const baseH = desiredH ?? curTeamDims.height;

  const children = nodes.filter(
    (n) => n.type === 'consoleNode' && n.parentId === teamId
  );

  if (children.length === 0) {
    return {
      width: Math.max(680, baseW),
      height: Math.max(432, baseH),
    };
  }

  let maxRight = 0;
  let maxBottom = 0;

  for (const ch of children) {
    const { width: chW, height: chH } = getNodeDimensions(
      ch,
      DEFAULT_WIDTH,
      DEFAULT_HEIGHT
    );
    const right = (ch.position?.x ?? 0) + chW;
    const bottom = (ch.position?.y ?? 0) + chH;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  const requiredW = maxRight + TEAM_PADDING_X;
  const requiredH = maxBottom + TEAM_PADDING_BOTTOM;

  return {
    width: Math.round(Math.max(680, baseW, requiredW)),
    height: Math.round(Math.max(432, baseH, requiredH)),
  };
}

const BUILTIN_PRESETS: CanvasPreset[] = [
  {
    id: 'preset-team-duo',
    name: 'Squad Duo + Orchestrateur',
    description: '1 équipe active (Claude Architect + Qwen3 Coder) pilotée par un Orchestrateur.',
    builtIn: true,
    createdAt: '2026-10-17T12:00:00Z',
    nodes: [
      {
        id: 'team-1',
        type: 'teamNode',
        position: { x: 375, y: 70 },
        width: 1048,
        height: 432,
        label: 'TEAM 1',
        teamNumber: 1,
      },
      {
        id: 'orch-team-1',
        type: 'orchestratorNode',
        position: { x: 24, y: 95 },
        label: 'Orchestrateur 1',
        teamId: 'team-1',
      },
      {
        id: 'console-1',
        type: 'consoleNode',
        parentId: 'team-1',
        position: { x: TEAM_PADDING_X, y: TEAM_PADDING_TOP },
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        label: 'Claude Architect',
        commandType: 'claude',
      },
      {
        id: 'console-2',
        type: 'consoleNode',
        parentId: 'team-1',
        position: {
          x: TEAM_PADDING_X + DEFAULT_WIDTH + TEAM_GAP_X,
          y: TEAM_PADDING_TOP,
        },
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        label: 'Qwen3 Coder',
        commandType: 'qwen',
      },
    ],
    edges: [
      {
        id: 'cable-orch-team-1-team-1',
        source: 'orch-team-1',
        target: 'team-1',
        type: 'animatedCable',
      },
    ],
  },
  {
    id: 'preset-quad-grid',
    name: 'Quad Multi-Agent Team (4x)',
    description: 'Équipe complète 2×2 : Claude, Codex, Gemini et System Shell reliés à un Orchestrateur.',
    builtIn: true,
    createdAt: '2026-10-17T12:00:00Z',
    nodes: [
      {
        id: 'team-quad',
        type: 'teamNode',
        position: { x: 375, y: 50 },
        width: 1048,
        height: 796,
        label: 'TEAM FULLSTACK',
        teamNumber: 1,
      },
      {
        id: 'orch-team-quad',
        type: 'orchestratorNode',
        position: { x: 24, y: 120 },
        label: 'Orchestrateur Fullstack',
        teamId: 'team-quad',
      },
      {
        id: 'c-quad-1',
        type: 'consoleNode',
        parentId: 'team-quad',
        position: { x: TEAM_PADDING_X, y: TEAM_PADDING_TOP },
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        label: 'Claude Lead',
        commandType: 'claude',
      },
      {
        id: 'c-quad-2',
        type: 'consoleNode',
        parentId: 'team-quad',
        position: {
          x: TEAM_PADDING_X + DEFAULT_WIDTH + TEAM_GAP_X,
          y: TEAM_PADDING_TOP,
        },
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        label: 'Codex Engine',
        commandType: 'codex',
      },
      {
        id: 'c-quad-3',
        type: 'consoleNode',
        parentId: 'team-quad',
        position: {
          x: TEAM_PADDING_X,
          y: TEAM_PADDING_TOP + DEFAULT_HEIGHT + TEAM_GAP_Y,
        },
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        label: 'Gemini Reviewer',
        commandType: 'gemini',
      },
      {
        id: 'c-quad-4',
        type: 'consoleNode',
        parentId: 'team-quad',
        position: {
          x: TEAM_PADDING_X + DEFAULT_WIDTH + TEAM_GAP_X,
          y: TEAM_PADDING_TOP + DEFAULT_HEIGHT + TEAM_GAP_Y,
        },
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        label: 'Test Runner Shell',
        commandType: 'shell',
      },
    ],
    edges: [
      {
        id: 'cable-orch-quad',
        source: 'orch-team-quad',
        target: 'team-quad',
        type: 'animatedCable',
      },
    ],
  },
  {
    id: 'preset-free-squad',
    name: 'Free AI Squad (Qwen · Ollama · Kimi · DeepSeek)',
    description: 'Équipe 100% Modèles Gratuits & Locaux : Qwen3 Coder, Ollama Local, Kimi K2 et DeepSeek R1.',
    builtIn: true,
    createdAt: '2026-10-17T12:00:00Z',
    nodes: [
      {
        id: 'team-free',
        type: 'teamNode',
        position: { x: 375, y: 50 },
        width: 1048,
        height: 796,
        label: 'FREE AI SQUAD',
        teamNumber: 1,
      },
      {
        id: 'orch-team-free',
        type: 'orchestratorNode',
        position: { x: 24, y: 120 },
        label: 'Orchestrateur Free AI',
        teamId: 'team-free',
      },
      {
        id: 'c-free-1',
        type: 'consoleNode',
        parentId: 'team-free',
        position: { x: TEAM_PADDING_X, y: TEAM_PADDING_TOP },
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        label: 'Qwen3 Coder',
        commandType: 'qwen',
      },
      {
        id: 'c-free-2',
        type: 'consoleNode',
        parentId: 'team-free',
        position: {
          x: TEAM_PADDING_X + DEFAULT_WIDTH + TEAM_GAP_X,
          y: TEAM_PADDING_TOP,
        },
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        label: 'Ollama Qwen2.5',
        commandType: 'ollama',
      },
      {
        id: 'c-free-3',
        type: 'consoleNode',
        parentId: 'team-free',
        position: {
          x: TEAM_PADDING_X,
          y: TEAM_PADDING_TOP + DEFAULT_HEIGHT + TEAM_GAP_Y,
        },
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        label: 'Kimi K2 Agent',
        commandType: 'kimi',
      },
      {
        id: 'c-free-4',
        type: 'consoleNode',
        parentId: 'team-free',
        position: {
          x: TEAM_PADDING_X + DEFAULT_WIDTH + TEAM_GAP_X,
          y: TEAM_PADDING_TOP + DEFAULT_HEIGHT + TEAM_GAP_Y,
        },
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        label: 'DeepSeek R1 Local',
        commandType: 'deepseek',
      },
    ],
    edges: [
      {
        id: 'cable-orch-free',
        source: 'orch-team-free',
        target: 'team-free',
        type: 'animatedCable',
      },
    ],
  },
];

const DEFAULT_MEMORY_NOTES = `# Contexte Partagé · Agent Canvas
- Stack : Electron + React + TypeScript + Tailwind + @xyflow/react + xterm.js
- Conventions : Code modulaire, typage strict, pas d'effets de bord non contrôlés.
- Astuce : Utilisez le bouton "Injecter dans le prompt" pour transférer ces notes dans la barre @.`;

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

  const activeWorkflowsRef = useRef<
    Record<
      string,
      {
        teamId: string;
        mode: TeamCollabMode;
        originalBrief: string;
        orderedMemberIds: string[];
        currentStepIndex: number;
        maxSteps: number;
        completedMemberIds?: Set<string>;
        repliesByMemberId?: Map<string, AgentReplyRecord>;
        phase?: 'planning' | 'work';
        members?: TeamPlanningMember[];
        plannedTasks?: Map<string, string>;
        fallbackAssignments?: ReturnType<typeof buildSplitTaskAssignments>;
      }
    >
  >({});

  const handleCloseNode = useCallback(
    async (id: string) => {
      markConsoleStarted(id, false);
      if (window.agentCanvasAPI) {
        await window.agentCanvasAPI.killPty(id);
      }
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges]
  );

  // Team callbacks
  const handleRenameTeam = useCallback(
    (teamId: string, newLabel: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === teamId) {
            return { ...n, data: { ...n.data, label: newLabel } };
          }
          if (
            n.type === 'orchestratorNode' &&
            (n.data as unknown as OrchestratorNodeData).teamId === teamId
          ) {
            return { ...n, data: { ...n.data, teamLabel: newLabel } };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  const handleStartTeam = useCallback(
    (teamId: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'consoleNode' && n.parentId === teamId) {
            markConsoleStarted(n.id, true);
            return {
              ...n,
              data: {
                ...n.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  const handleStopTeam = useCallback(
    (teamId: string) => {
      delete activeWorkflowsRef.current[teamId];
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'consoleNode' && n.parentId === teamId) {
            markConsoleStarted(n.id, false);
            if (window.agentCanvasAPI) {
              window.agentCanvasAPI.killPty(n.id);
            }
            return {
              ...n,
              data: {
                ...n.data,
                started: false,
                paused: false,
                status: 'idle',
                pendingPrompt: undefined,
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  const handleCloseTeam = useCallback(
    (teamId: string) => {
      delete activeWorkflowsRef.current[teamId];
      const removedIds = new Set<string>([teamId]);
      setNodes((nds) => {
        for (const n of nds) {
          if (n.type === 'consoleNode' && n.parentId === teamId) {
            removedIds.add(n.id);
            markConsoleStarted(n.id, false);
            if (window.agentCanvasAPI) {
              window.agentCanvasAPI.killPty(n.id);
            }
          } else if (
            n.type === 'orchestratorNode' &&
            (n.data as unknown as OrchestratorNodeData).teamId === teamId
          ) {
            removedIds.add(n.id);
          }
        }
        return nds.filter((n) => !removedIds.has(n.id));
      });
      setEdges((eds) =>
        eds.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target))
      );
    },
    [setNodes, setEdges]
  );

  const handleAutoGridTeam = useCallback(
    (teamId: string) => {
      setNodes((nds) => {
        const members = nds.filter(
          (n) => n.type === 'consoleNode' && n.parentId === teamId
        );
        if (members.length === 0) return nds;

        const { cols, width, height } = computeTeamGridMetrics(members.length);
        let memberIdx = 0;

        return nds.map((n) => {
          if (n.id === teamId) {
            return {
              ...n,
              width,
              height,
              style: { ...n.style, width, height },
            };
          }
          if (n.type === 'consoleNode' && n.parentId === teamId) {
            const col = memberIdx % cols;
            const row = Math.floor(memberIdx / cols);
            memberIdx++;
            return {
              ...n,
              position: {
                x: TEAM_PADDING_X + col * (DEFAULT_WIDTH + TEAM_GAP_X),
                y: TEAM_PADDING_TOP + row * (DEFAULT_HEIGHT + TEAM_GAP_Y),
              },
              width: DEFAULT_WIDTH,
              height: DEFAULT_HEIGHT,
              style: { ...n.style, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
            };
          }
          return n;
        });
      });
    },
    [setNodes]
  );

  const handleUngroupTeam = useCallback(
    (teamId: string) => {
      delete activeWorkflowsRef.current[teamId];
      const removedIds = new Set<string>([teamId]);
      setNodes((nds) => {
        const teamNode = nds.find((n) => n.id === teamId);
        const teamPos = teamNode?.position || { x: 100, y: 100 };

        return nds
          .filter((n) => {
            if (n.id === teamId) return false;
            if (
              n.type === 'orchestratorNode' &&
              (n.data as unknown as OrchestratorNodeData).teamId === teamId
            ) {
              removedIds.add(n.id);
              return false;
            }
            return true;
          })
          .map((n) => {
            if (n.type === 'consoleNode' && n.parentId === teamId) {
              return {
                ...n,
                parentId: undefined,
                extent: undefined,
                position: {
                  x: teamPos.x + n.position.x,
                  y: teamPos.y + n.position.y,
                },
                data: {
                  ...n.data,
                  teamId: undefined,
                },
              };
            }
            return n;
          });
      });

      setEdges((eds) =>
        eds.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target))
      );
    },
    [setNodes, setEdges]
  );

  // Trigger cable & team frame pulse animation
  const triggerTeamPulse = useCallback((teamId: string) => {
    setPulsingTeamIds((prev) => ({ ...prev, [teamId]: true }));
    setTimeout(() => {
      setPulsingTeamIds((prev) => ({ ...prev, [teamId]: false }));
    }, 1500);
  }, []);

  // Change collaboration mode on an Orchestrator
  const handleChangeCollabMode = useCallback(
    (teamId: string, mode: TeamCollabMode) => {
      delete activeWorkflowsRef.current[teamId];
      setNodes((nds) =>
        nds.map((node) => {
          if (
            node.type === 'orchestratorNode' &&
            (node.data as unknown as OrchestratorNodeData).teamId === teamId
          ) {
            return {
              ...node,
              data: {
                ...node.data,
                collabMode: mode,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  // Manual 1-click Relay: pass the latest response of `fromNodeId` (or the most recent active teammate) to the other teammates in `teamId`
  const handleTriggerTeamRelay = useCallback(
    (teamId: string, fromNodeId?: string, customInstruction?: string) => {
      triggerTeamPulse(teamId);
      delete activeWorkflowsRef.current[teamId];

      setNodes((nds) => {
        const teamMembers = nds.filter(
          (n) => n.type === 'consoleNode' && n.parentId === teamId
        );
        if (teamMembers.length < 2) return nds;

        // Pick source member
        let sourceNode = fromNodeId
          ? teamMembers.find((m) => m.id === fromNodeId)
          : undefined;

        if (!sourceNode) {
          // Find member with the most recent recorded reply
          let bestTime = '';
          for (const m of teamMembers) {
            const reply = getLatestAgentReply(m.id);
            if (reply && reply.timestamp >= bestTime) {
              bestTime = reply.timestamp;
              sourceNode = m;
            }
          }
          if (!sourceNode) {
            sourceNode = teamMembers[0];
          }
        }

        const sourceData = sourceNode.data as unknown as ConsoleNodeData;
        const latestReply = getLatestAgentReply(sourceNode.id);
        const scrollbackFallback = getTerminalScrollback(sourceNode.id)
          .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
          .trim()
          .slice(-1600);

        const replyContent =
          latestReply?.text ||
          scrollbackFallback ||
          customInstruction ||
          `Analyse et poursuis le travail initié par ${sourceData.label}.`;

        const orchNode = nds.find(
          (n) =>
            n.type === 'orchestratorNode' &&
            (n.data as unknown as OrchestratorNodeData).teamId === teamId
        );
        const orchData = orchNode?.data as unknown as
          | OrchestratorNodeData
          | undefined;
        const mode: TeamCollabMode = orchData?.collabMode || 'relay';

        const recipients = teamMembers.filter((m) => m.id !== sourceNode!.id);
        for (const target of recipients) {
          const targetData = target.data as unknown as ConsoleNodeData;
          recordInterAgentMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            teamId,
            fromNodeId: sourceNode.id,
            fromLabel: sourceData.label || 'Agent',
            fromCommandType: sourceData.commandType || 'claude',
            toNodeId: target.id,
            toLabel: targetData.label || 'Coéquipier',
            summaryText: replyContent.slice(0, 260),
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        const instructionText =
          customInstruction ||
          (mode === 'debate'
            ? `Challenge la proposition de ${sourceData.label}, identifie les points faibles et propose une version améliorée.`
            : `Analyse la proposition de ton coéquipier ${sourceData.label}, complète-la et poursuis le travail.${
                orchData?.lastBroadcastPrompt
                  ? ` (Mission initiale : ${orchData.lastBroadcastPrompt})`
                  : ''
              }`);

        return nds.map((node) => {
          if (
            node.type === 'consoleNode' &&
            node.parentId === teamId &&
            node.id !== sourceNode!.id
          ) {
            markConsoleStarted(node.id, true);
            const relayPrompt = formatTeammateRelayPrompt(
              sourceData.label || 'Agent 1',
              sourceData.commandType || 'claude',
              replyContent,
              instructionText
            );
            return {
              ...node,
              data: {
                ...node.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
                pendingPrompt: relayPrompt,
              },
            };
          }
          return node;
        });
      });
    },
    [setNodes, triggerTeamPulse]
  );

  // Assemble / Synthesize Team Work: collects replies/scrollback from all team members and prompts Agent #1 (Lead) to synthesize everything into the final cohesive solution
  const handleSynthesizeTeamWork = useCallback(
    (teamId: string) => {
      triggerTeamPulse(teamId);
      delete activeWorkflowsRef.current[teamId];

      setNodes((nds) => {
        const teamMembers = nds.filter(
          (n) => n.type === 'consoleNode' && n.parentId === teamId
        );
        if (teamMembers.length < 2) return nds;

        const orchNode = nds.find(
          (n) =>
            n.type === 'orchestratorNode' &&
            (n.data as unknown as OrchestratorNodeData).teamId === teamId
        );
        const orchData = orchNode?.data as unknown as
          | OrchestratorNodeData
          | undefined;
        const originalBrief =
          orchData?.lastBroadcastPrompt || 'Mission d’équipe';

        const parts: { label: string; commandType: string; text: string }[] =
          [];
        for (const m of teamMembers) {
          const mData = m.data as unknown as ConsoleNodeData;
          const latest = getLatestAgentReply(m.id);
          const scrollback = getTerminalScrollback(m.id)
            .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
            .trim()
            .slice(-1600);
          const text =
            latest?.text || scrollback || 'Travail en cours...';
          parts.push({
            label: mData.label || 'Agent',
            commandType: mData.commandType || 'claude',
            text,
          });
        }

        const synthesisPrompt = formatTeamSynthesisPrompt(
          originalBrief,
          parts
        );

        // Send synthesis to the lead agent (first member)
        const leadMember = teamMembers[0];
        const leadData = leadMember.data as unknown as ConsoleNodeData;

        recordInterAgentMessage({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          teamId,
          fromNodeId: orchNode?.id || 'orchestrator',
          fromLabel: orchData?.label || 'Orchestrateur',
          fromCommandType: 'orchestrator',
          toNodeId: leadMember.id,
          toLabel: leadData.label || 'Agent 1 (Lead)',
          summaryText: `🧩 Synthèse & assemblage de toutes les parties pour : "${originalBrief.slice(
            0,
            120
          )}"`,
          timestamp: new Date().toLocaleTimeString(),
        });

        return nds.map((n) => {
          if (n.id === leadMember.id) {
            markConsoleStarted(n.id, true);
            return {
              ...n,
              data: {
                ...n.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
                pendingPrompt: synthesisPrompt,
              },
            };
          }
          return n;
        });
      });
    },
    [setNodes, triggerTeamPulse]
  );

  // Listen for automatic inter-AI relay/debate steps AND manual "Relayer" button clicks from ConsoleNode headers
  useEffect(() => {
    const onReplyRecorded = (event: Event) => {
      const custom = event as CustomEvent<AgentReplyRecord>;
      const record = custom.detail;
      if (!record || !record.teamId) return;

      const workflow = activeWorkflowsRef.current[record.teamId];
      if (!workflow) return;

      if (workflow.mode === 'split' && workflow.phase === 'planning') {
        const leadId = workflow.orderedMemberIds[0];
        if (record.nodeId !== leadId || !workflow.members?.length) return;

        const heuristicAssignments =
          workflow.fallbackAssignments ||
          buildSplitTaskAssignments(workflow.originalBrief, workflow.members);
        const fallbackTaskById = new Map(
          heuristicAssignments.map((assignment) => [
            assignment.nodeId,
            assignment.subTaskDescription,
          ])
        );
        const plannedTasks =
          parseProjectTaskPlan(record.text, workflow.members) || new Map<string, string>();
        for (const member of workflow.members) {
          if (!plannedTasks.has(member.id)) {
            plannedTasks.set(
              member.id,
              fallbackTaskById.get(member.id) ||
                `Contribue à la mission et vérifie le résultat de l'équipe : ${workflow.originalBrief}`
            );
          }
        }

        workflow.phase = 'work';
        workflow.plannedTasks = plannedTasks;
        workflow.completedMemberIds = new Set<string>();
        workflow.repliesByMemberId = new Map<string, AgentReplyRecord>();

        const sharedPlan = workflow.members
          .map(
            (member, index) =>
              `${index + 1}. ${member.label} (${member.commandType}) : ${plannedTasks.get(member.id)}`
          )
          .join('\n');
        const timestamp = new Date().toLocaleTimeString();
        const promptByMemberId = new Map(
          workflow.members.map((member) => [
            member.id,
            `[MISSION D'ÉQUIPE · TÂCHE VALIDÉE PAR LE CHEF DE PROJET]\nMission initiale : "${workflow.originalBrief}"\n\nPlan partagé :\n${sharedPlan}\n\nTa tâche précise : ${plannedTasks.get(member.id)}\n\nLivre un résultat concret, indique les décisions prises, les dépendances utilisées et tout blocage. Ne rédige pas la réponse finale à l'utilisateur : le chef de projet assemblera les contributions de toute l'équipe.`,
          ])
        );

        for (const member of workflow.members) {
          recordInterAgentMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            teamId: record.teamId,
            fromNodeId: leadId,
            fromLabel: record.label,
            fromCommandType: record.commandType,
            toNodeId: member.id,
            toLabel: member.label,
            summaryText: `📋 Tâche attribuée par le chef de projet : ${plannedTasks.get(member.id)?.slice(0, 200)}`,
            timestamp,
          });
        }

        setNodes((nds) =>
          nds.map((node) => {
            const taskPrompt = promptByMemberId.get(node.id);
            if (node.type !== 'consoleNode' || !taskPrompt) return node;
            markConsoleStarted(node.id, true);
            return {
              ...node,
              data: {
                ...node.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
                pendingPrompt: taskPrompt,
              },
            };
          })
        );
        return;
      }

      if (workflow.mode === 'split') {
        if (!workflow.orderedMemberIds.includes(record.nodeId)) return;
        workflow.completedMemberIds ||= new Set<string>();
        workflow.repliesByMemberId ||= new Map<string, AgentReplyRecord>();
        if (workflow.completedMemberIds.has(record.nodeId)) return;

        workflow.completedMemberIds.add(record.nodeId);
        workflow.repliesByMemberId.set(record.nodeId, record);
        if (
          workflow.completedMemberIds.size < workflow.orderedMemberIds.length
        ) {
          return;
        }

        delete activeWorkflowsRef.current[record.teamId];
        const parts = workflow.orderedMemberIds
          .map((memberId) => workflow.repliesByMemberId?.get(memberId))
          .filter((reply): reply is AgentReplyRecord => Boolean(reply))
          .map((reply) => ({
            label: reply.label,
            commandType: reply.commandType,
            text: reply.text,
          }));
        if (parts.length === 0) return;

        const synthesisPrompt = formatTeamSynthesisPrompt(
          workflow.originalBrief,
          parts
        );
        const leadId = workflow.orderedMemberIds[0];
        recordInterAgentMessage({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          teamId: record.teamId,
          fromNodeId: 'orchestrator',
          fromLabel: 'Orchestrateur',
          fromCommandType: 'orchestrator',
          toNodeId: leadId,
          toLabel: parts[0].label,
          summaryText: `🧩 Toutes les parties sont terminées. Assemblage final de : "${workflow.originalBrief.slice(0, 120)}"`,
          timestamp: new Date().toLocaleTimeString(),
        });
        playCanvasSound('complete');
        triggerTeamPulse(record.teamId);
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id !== leadId) return node;
            markConsoleStarted(node.id, true);
            return {
              ...node,
              data: {
                ...node.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
                pendingPrompt: synthesisPrompt,
              },
            };
          })
        );
        return;
      }

      const expectedSenderId =
        workflow.orderedMemberIds[
          workflow.currentStepIndex % workflow.orderedMemberIds.length
        ];
      if (record.nodeId !== expectedSenderId) return;

      if (workflow.currentStepIndex >= workflow.maxSteps) {
        delete activeWorkflowsRef.current[record.teamId];
        return;
      }

      workflow.currentStepIndex += 1;
      const nextNodeId =
        workflow.orderedMemberIds[
          workflow.currentStepIndex % workflow.orderedMemberIds.length
        ];
      const isFinalStep = workflow.currentStepIndex >= workflow.maxSteps;
      if (isFinalStep) {
        delete activeWorkflowsRef.current[record.teamId];
        playCanvasSound('complete');
      } else {
        playCanvasSound('relay');
      }

      triggerTeamPulse(record.teamId);

      setNodes((nds) => {
        const nextNode = nds.find((n) => n.id === nextNodeId);
        if (!nextNode) return nds;
        const nextData = nextNode.data as unknown as ConsoleNodeData;

        recordInterAgentMessage({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          teamId: record.teamId!,
          fromNodeId: record.nodeId,
          fromLabel: record.label,
          fromCommandType: record.commandType,
          toNodeId: nextNodeId,
          toLabel: nextData.label || 'Coéquipier',
          summaryText: record.text.slice(0, 260),
          timestamp: new Date().toLocaleTimeString(),
        });

        const stepInstruction =
          workflow.mode === 'debate'
            ? `Débat IA : examine la réponse de ${record.label}, challenge ou enrichis sa proposition pour la mission "${workflow.originalBrief}".`
            : workflow.mode === 'gate'
            ? `🛡️ Revue de Sécurité & Validation de Code : analyse critique, vérifie les failles, régressions et autorise/rejette la mise en prod pour la mission "${workflow.originalBrief}".`
            : `Relais IA : prends le relais de ${record.label} et réalise ta partie pour la mission "${workflow.originalBrief}".`;

        const relayPrompt = formatTeammateRelayPrompt(
          record.label,
          record.commandType,
          record.text,
          stepInstruction
        );

        return nds.map((n) => {
          if (n.id === nextNodeId) {
            markConsoleStarted(n.id, true);
            return {
              ...n,
              data: {
                ...n.data,
                started: true,
                paused: false,
                restoredFromDisk: false,
                status: 'running',
                pendingPrompt: relayPrompt,
              },
            };
          }
          return n;
        });
      });
    };

    const onManualRelayFromNode = (event: Event) => {
      const custom = event as CustomEvent<{ teamId: string; fromNodeId: string }>;
      if (!custom.detail?.teamId) return;
      handleTriggerTeamRelay(custom.detail.teamId, custom.detail.fromNodeId);
    };

    window.addEventListener(
      'agent-canvas-agent-reply-recorded',
      onReplyRecorded as EventListener
    );
    window.addEventListener(
      'agent-canvas-relay-from-node',
      onManualRelayFromNode as EventListener
    );
    return () => {
      window.removeEventListener(
        'agent-canvas-agent-reply-recorded',
        onReplyRecorded as EventListener
      );
      window.removeEventListener(
        'agent-canvas-relay-from-node',
        onManualRelayFromNode as EventListener
      );
    };
  }, [handleTriggerTeamRelay, setNodes, triggerTeamPulse]);

  // Broadcast prompt from Orchestrator to consoles in the linked Team (supports 'relay', 'debate', and 'parallel' modes)
  const handleBroadcastToTeam = useCallback(
    (
      teamId: string,
      prompt: string,
      autoStartIdle: boolean,
      explicitMode?: TeamCollabMode
    ) => {
      const timestamp = new Date().toLocaleTimeString();
      triggerTeamPulse(teamId);
      playCanvasSound('success');

      setNodes((nds) => {
        const orchNode = nds.find(
          (n) =>
            n.type === 'orchestratorNode' &&
            (n.data as unknown as OrchestratorNodeData).teamId === teamId
        );
        const orchData = orchNode?.data as unknown as
          | OrchestratorNodeData
          | undefined;
        const mode: TeamCollabMode =
          explicitMode || orchData?.collabMode || 'split';

        const teamConsoles = nds.filter(
          (n) => n.type === 'consoleNode' && n.parentId === teamId
        );
        const targetMembers = autoStartIdle
          ? teamConsoles
          : teamConsoles.filter(
              (n) => Boolean((n.data as unknown as ConsoleNodeData).started)
            );

        // Split mode: the first agent plans as project lead, then the team works in parallel.
        if (mode === 'split' && targetMembers.length >= 2) {
          delete activeWorkflowsRef.current[teamId];
          const planningMembers: TeamPlanningMember[] = targetMembers.map((member) => {
            const data = member.data as unknown as ConsoleNodeData;
            return {
              id: member.id,
              label: data.label || 'Agent',
              commandType: data.commandType || 'claude',
            };
          });
          const fallbackAssignments = buildSplitTaskAssignments(prompt, planningMembers);
          const leadId = planningMembers[0].id;
          activeWorkflowsRef.current[teamId] = {
            teamId,
            mode: 'split',
            originalBrief: prompt,
            orderedMemberIds: planningMembers.map((member) => member.id),
            currentStepIndex: 0,
            maxSteps: 0,
            phase: 'planning',
            members: planningMembers,
            fallbackAssignments,
          };

          recordInterAgentMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            teamId,
            fromNodeId: orchNode?.id || 'orchestrator',
            fromLabel: orchData?.label || 'Orchestrateur',
            fromCommandType: 'orchestrator',
            toNodeId: leadId,
            toLabel: planningMembers[0].label,
            summaryText: `🧭 Le chef de projet analyse la mission et prépare les tâches pour ${planningMembers.length} agents.`,
            timestamp,
          });
          const planningPrompt = buildProjectPlanningPrompt(prompt, planningMembers);

          return nds.map((node) => {
            if (
              node.type === 'orchestratorNode' &&
              (node.data as unknown as OrchestratorNodeData).teamId === teamId
            ) {
              return {
                ...node,
                data: {
                  ...node.data,
                  collabMode: mode,
                  lastBroadcastPrompt: prompt,
                  lastBroadcastAt: timestamp,
                },
              };
            }

            if (node.type === 'consoleNode' && node.id === leadId) {
              markConsoleStarted(node.id, true);
              return {
                ...node,
                data: {
                  ...node.data,
                  started: true,
                  paused: false,
                  restoredFromDisk: false,
                  status: 'running',
                  pendingPrompt: planningPrompt,
                },
              };
            }

            return node;
          });
        }

        // Configure automatic inter-AI workflow for 'relay', 'debate', or 'gate' when 2+ members are in the team
        if (
          (mode === 'relay' || mode === 'debate' || mode === 'gate') &&
          targetMembers.length >= 2
        ) {
          let orderedIds = targetMembers.map((m) => m.id);
          if (mode === 'gate') {
            // Ensure security/audit specialist is the final gatekeeper
            const isAuditor = (m: Node) => {
              const cd = m.data as unknown as ConsoleNodeData;
              const cmd = (cd.commandType || '').toLowerCase();
              const label = (cd.label || '').toLowerCase();
              return (
                cmd === 'deepseek' ||
                cmd === 'gemini' ||
                label.includes('audit') ||
                label.includes('sécurité') ||
                label.includes('security') ||
                label.includes('review') ||
                label.includes('validateur')
              );
            };
            const auditors = targetMembers.filter(isAuditor);
            const workers = targetMembers.filter((m) => !isAuditor(m));
            if (auditors.length > 0 && workers.length > 0) {
              orderedIds = [...workers.map((m) => m.id), ...auditors.map((m) => m.id)];
            }
          }

          const maxSteps =
            mode === 'relay' || mode === 'gate'
              ? orderedIds.length - 1
              : Math.max(2, orderedIds.length);

          activeWorkflowsRef.current[teamId] = {
            teamId,
            mode,
            originalBrief: prompt,
            orderedMemberIds: orderedIds,
            currentStepIndex: 0,
            maxSteps,
          };

          const firstMemberId = orderedIds[0];
          const firstNode = targetMembers.find((m) => m.id === firstMemberId);
          const firstData = (firstNode?.data || targetMembers[0].data) as unknown as ConsoleNodeData;
          const secondMemberId = orderedIds[1];
          const secondNode = targetMembers.find((m) => m.id === secondMemberId);
          const secondData = (secondNode?.data || targetMembers[1].data) as unknown as ConsoleNodeData;

          const modeBadge =
            mode === 'relay'
              ? 'Relais IA'
              : mode === 'gate'
              ? 'Gate & Revue Sécurité'
              : 'Débat IA';

          recordInterAgentMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            teamId,
            fromNodeId: orchNode?.id || 'orchestrator',
            fromLabel: orchData?.label || 'Orchestrateur',
            fromCommandType: 'orchestrator',
            toNodeId: firstMemberId,
            toLabel: firstData.label || 'Agent 1',
            summaryText: `Mission (${modeBadge}) : ${prompt.slice(0, 180)}`,
            timestamp,
          });

          const firstAgentPrompt =
            mode === 'relay'
              ? `[MISSION D'ÉQUIPE · RELAIS IA (Étape 1/${orderedIds.length}, ta réponse sera transmise automatiquement à ${secondData.label})] ${prompt}`
              : mode === 'gate'
              ? `[MISSION D'ÉQUIPE · CODE & GATE DE SÉCURITÉ (Étape 1/${orderedIds.length}, ta proposition sera auditée et validée par ${secondData.label})] ${prompt}`
              : `[MISSION D'ÉQUIPE · DÉBAT IA (Tour 1, propose ton approche à ${secondData.label} pour qu'il la challenge)] ${prompt}`;

          return nds.map((node) => {
            if (
              node.type === 'orchestratorNode' &&
              (node.data as unknown as OrchestratorNodeData).teamId === teamId
            ) {
              return {
                ...node,
                data: {
                  ...node.data,
                  collabMode: mode,
                  lastBroadcastPrompt: prompt,
                  lastBroadcastAt: timestamp,
                },
              };
            }

            if (node.type === 'consoleNode' && node.parentId === teamId) {
              const cData = node.data as unknown as ConsoleNodeData;
              const isFirst = node.id === firstMemberId;
              if (cData.started || autoStartIdle) {
                markConsoleStarted(node.id, true);
                return {
                  ...node,
                  data: {
                    ...node.data,
                    started: true,
                    paused: false,
                    restoredFromDisk: false,
                    status: 'running',
                    // Only the first AI receives the initial prompt; teammates stay open and ready to receive the automatic relay!
                    pendingPrompt: isFirst ? firstAgentPrompt : cData.pendingPrompt,
                  },
                };
              }
            }

            return node;
          });
        }

        // Parallel mode (or single-agent team): send prompt simultaneously to all members
        delete activeWorkflowsRef.current[teamId];

        return nds.map((node) => {
          if (
            node.type === 'orchestratorNode' &&
            (node.data as unknown as OrchestratorNodeData).teamId === teamId
          ) {
            return {
              ...node,
              data: {
                ...node.data,
                collabMode: mode,
                lastBroadcastPrompt: prompt,
                lastBroadcastAt: timestamp,
              },
            };
          }

          if (node.type === 'consoleNode' && node.parentId === teamId) {
            const cData = node.data as unknown as ConsoleNodeData;
            if (cData.started) {
              markConsoleStarted(node.id, true);
              return {
                ...node,
                data: {
                  ...node.data,
                  pendingPrompt: prompt,
                },
              };
            } else if (autoStartIdle) {
              markConsoleStarted(node.id, true);
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
          }

          return node;
        });
      });
    },
    [setNodes, triggerTeamPulse]
  );

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
  /** First free spot to the right of everything already on the canvas (new panels used to cover teams). */
  const findFreeSpot = useCallback((nds: Node[]) => {
    const topLevel = nds.filter((n) => !n.parentId);
    if (topLevel.length === 0) return { x: 120, y: 120 };
    let maxRight = -Infinity;
    let minTop = Infinity;
    for (const n of topLevel) {
      const { width } = getNodeDimensions(n, DEFAULT_WIDTH, DEFAULT_HEIGHT);
      maxRight = Math.max(maxRight, n.position.x + width);
      minTop = Math.min(minTop, n.position.y);
    }
    return { x: Math.round(maxRight + 60), y: Math.round(minTop) };
  }, []);

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
  const serializeCurrentGraph = useCallback(
    (currentNodes: Node[], currentEdges: Edge[]) => {
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
    },
    []
  );

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
  const latestSaveArgsRef = useRef<[Node[], Edge[], CanvasPreset[], string] | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveScheduledAtRef = useRef(0);
  const lastSaveAtRef = useRef(0);
  const lastSavedSnapshotRef = useRef('');
  const persistStateNowRef = useRef(persistStateNow);
  persistStateNowRef.current = persistStateNow;
  useEffect(() => {
    if (!isLoaded) return;
    latestSaveArgsRef.current = [nodes, edges, customPresets, memoryNotes];
    if (saveTimerRef.current && Date.now() - saveScheduledAtRef.current < 10_000) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveScheduledAtRef.current = Date.now();
    const wait = Math.max(350, 2000 - (Date.now() - lastSaveAtRef.current));
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const args = latestSaveArgsRef.current;
      if (!args) return;
      const { serializedNodes, serializedEdges } = serializeCurrentGraph(args[0], args[1]);
      const snapshot = JSON.stringify([serializedNodes, serializedEdges, args[2], args[3]]);
      if (snapshot === lastSavedSnapshotRef.current) return;
      lastSavedSnapshotRef.current = snapshot;
      lastSaveAtRef.current = Date.now();
      persistStateNowRef.current(args[0], args[1], args[2], args[3]);
    }, wait);
  }, [nodes, edges, customPresets, memoryNotes, isLoaded, serializeCurrentGraph]);
  useEffect(() => {
    // Flush a pending save when the window closes so the last changes are not lost.
    const flush = () => {
      if (!saveTimerRef.current || !latestSaveArgsRef.current) return;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      const args = latestSaveArgsRef.current;
      persistStateNowRef.current(args[0], args[1], args[2], args[3]);
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      // Save what is pending AND release the slot: leaving a cancelled timer id here blocked every
      // later save after a hot reload (the Workspace panel was then lost on the next restart).
      flush();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, []);

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

  const quotaSummary = useMemo(() => {
    let totalTokens = 0;
    let totalLimit = 0;
    let totalPrompts = 0;
    let maxPct = 0;
    const items: {
      id: string;
      label: string;
      cmd: AgentCommandType;
      tokens: number;
      limit: number;
      pct: number;
      isUnlimited: boolean;
    }[] = [];

    for (const n of nodes) {
      if (n.type === 'consoleNode') {
        const d = n.data as unknown as ConsoleNodeData;
        const spec = COMMAND_OPTIONS.find((o) => o.id === d.commandType);
        const isUnlimited = Boolean(spec?.isUnlimitedLocal);
        const tokens = d.estimatedTokens || 0;
        const limit = d.tokenLimit || spec?.defaultTokenLimit || 50000;
        const pct = isUnlimited ? 0 : Math.min(100, Math.round((tokens / limit) * 100));

        totalTokens += tokens;
        totalPrompts += d.promptsSent || 0;
        if (!isUnlimited) {
          totalLimit += limit;
          if (pct > maxPct) maxPct = pct;
        }

        items.push({
          id: n.id,
          label: d.label || 'Console',
          cmd: d.commandType || 'claude',
          tokens,
          limit,
          pct,
          isUnlimited,
        });
      }
    }

    const globalPct =
      totalLimit > 0 ? Math.min(100, Math.round((totalTokens / totalLimit) * 100)) : 0;
    const effectivePct = Math.max(globalPct, maxPct);

    return {
      totalTokens,
      totalLimit: totalLimit || 100000,
      totalPrompts,
      effectivePct,
      items,
    };
  }, [nodes]);

  const [showQuotaModal, setShowQuotaModal] = useState(false);
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

  const globalBarColor =
    quotaSummary.effectivePct >= 85
      ? 'bg-[#ef4444] shadow-[0_0_8px_#ef4444]'
      : quotaSummary.effectivePct >= 60
      ? 'bg-[#f97316] shadow-[0_0_8px_#f97316]'
      : 'bg-[#22c55e]';

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
        <div className="relative pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowQuotaModal((v) => !v)}
            className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#1c1a22]/90 hover:bg-[#24212c] backdrop-blur-xl border border-[#2d2a37] shadow-card transition-all cursor-pointer"
            title="Cliquer pour voir le détail des limites et quotas par agent"
          >
            <Gauge className="w-4 h-4 text-[#ff6a3d]" />
            <div className="flex flex-col gap-1 min-w-[180px]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-zinc-200">
                  Limite & Quotas
                </span>
                <span className="font-mono text-zinc-300">
                  {(quotaSummary.totalTokens / 1000).toFixed(1)}k tok ·{' '}
                  <strong
                    className={
                      quotaSummary.effectivePct >= 85
                        ? 'text-red-400'
                        : quotaSummary.effectivePct >= 60
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }
                  >
                    {quotaSummary.effectivePct}%
                  </strong>
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#121017] overflow-hidden border border-[#2d2a37]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${globalBarColor}`}
                  style={{ width: `${Math.max(5, quotaSummary.effectivePct)}%` }}
                />
              </div>
            </div>
          </button>

          {showQuotaModal && (
            <div className="animate-node-appear absolute right-0 mt-2 w-[360px] rounded-2xl bg-[#1c1a22]/95 backdrop-blur-xl border border-[#2d2a37] shadow-card p-4 z-40">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#2d2a37]">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
                  Suivi des Limites par Agent
                </span>
                <button
                  onClick={handleResetAllQuotas}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#14121a] hover:bg-zinc-800 text-zinc-300 text-[11px] border border-[#2d2a37]"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset tout</span>
                </button>
              </div>

              <div className="mt-3 space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                {quotaSummary.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-[#14121a] border border-[#2d2a37] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-200 truncate">
                        {item.label}{' '}
                        <span className="text-[10px] font-mono text-zinc-400">
                          ({item.cmd})
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-zinc-300">
                        {item.isUnlimited
                          ? `${(item.tokens / 1000).toFixed(1)}k · ∞ Local`
                          : `${(item.tokens / 1000).toFixed(1)}k / ${Math.round(
                              item.limit / 1000
                            )}k (${item.pct}%)`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#1c1a22] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.isUnlimited
                            ? 'bg-emerald-500'
                            : item.pct >= 85
                            ? 'bg-red-500'
                            : item.pct >= 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: item.isUnlimited
                            ? '25%'
                            : `${Math.max(4, item.pct)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
            <button
              type="button"
              onClick={handleUpdateClick}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur-xl shadow-card text-xs transition-colors cursor-pointer border ${
                appUpdate?.state === 'ready'
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50 text-emerald-200 animate-pulse'
                  : appUpdate?.state === 'error'
                  ? 'bg-red-500/10 border-red-500/40 text-red-300'
                  : 'bg-[#1c1a22]/90 hover:bg-[#24212c] border-[#2d2a37] text-zinc-200'
              }`}
              title={
                appUpdate?.message ||
                (appUpdate?.state === 'ready'
                  ? 'Redémarrer Agent Canvas pour installer la nouvelle version'
                  : `Version installée : ${appVersion || '?'} · cliquer pour rechercher une mise à jour`)
              }
            >
              <span className="font-semibold">
                {!appUpdate
                  ? 'Mises à jour'
                  : appUpdate.state === 'checking'
                  ? 'Recherche…'
                  : appUpdate.state === 'up-to-date'
                  ? `À jour ✓${appVersion ? ` (v${appVersion})` : ''}`
                  : appUpdate.state === 'downloading'
                  ? `Téléchargement ${appUpdate.percent ?? 0} %`
                  : appUpdate.state === 'ready'
                  ? `v${appUpdate.version || ''} prête · Redémarrer`
                  : appUpdate.state === 'unavailable'
                  ? 'Mode développement'
                  : 'Erreur de mise à jour'}
              </span>
            </button>
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
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl bg-[#1c1a22]/90 backdrop-blur-xl border border-[#2d2a37] shadow-card text-xs text-zinc-300">
            <button
              type="button"
              onClick={() => rfInstanceRef.current?.zoomOut({ duration: 180 })}
              className="px-2 py-0.5 rounded-lg bg-[#14121a] hover:bg-zinc-800 text-zinc-200 font-mono text-xs border border-[#2d2a37]"
              title="Dézoomer le canvas (-)"
            >
              −
            </button>
            <button
              type="button"
              onClick={() =>
                rfInstanceRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 })
              }
              className="px-2 py-0.5 rounded-lg hover:bg-zinc-800 text-zinc-200 font-mono text-[11px]"
              title="Réinitialiser le zoom à 100%"
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => rfInstanceRef.current?.zoomIn({ duration: 180 })}
              className="px-2 py-0.5 rounded-lg bg-[#14121a] hover:bg-zinc-800 text-zinc-200 font-mono text-xs border border-[#2d2a37]"
              title="Zoomer le canvas (+)"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => rfInstanceRef.current?.fitView({ padding: 0.12, duration: 240 })}
              className="ml-0.5 px-2 py-0.5 rounded-lg bg-[#ff6a3d]/15 hover:bg-[#ff6a3d] text-[#ff6a3d] hover:text-white border border-[#ff6a3d]/40 text-[11px] font-medium transition-colors"
              title="Ajuster la vue pour voir toutes les pages"
            >
              Tout cadrer
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !autoScaleWindow;
                setAutoScaleWindow(next);
                if (next) {
                  rfInstanceRef.current?.fitView({ padding: 0.1, duration: 200 });
                }
              }}
              className={`ml-0.5 px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors ${
                autoScaleWindow
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#14121a] text-zinc-400 border-[#2d2a37] hover:text-zinc-200'
              }`}
              title="Mise à l'échelle automatique des cadres quand on agrandit ou réduit la fenêtre principale"
            >
              Auto-Échelle {autoScaleWindow ? 'ON' : 'OFF'}
            </button>
          </div>

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
        onClose={() => {
          setShowOnboarding(false);
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
