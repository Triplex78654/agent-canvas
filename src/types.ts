export type AgentCommandType =
  | 'agy'
  | 'claude'
  | 'codex'
  | 'gemini'
  | 'qwen'
  | 'ollama'
  | 'kimi'
  | 'deepseek'
  | 'aider'
  | 'opencode'
  | 'shell';

export type AgentStatus = 'idle' | 'running' | 'waiting' | 'error';

export interface ConsoleNodeData extends Record<string, unknown> {
  label: string;
  commandType: AgentCommandType;
  customCommand?: string;
  status: AgentStatus;
  started: boolean;
  paused: boolean;
  teamId?: string;
  restoredFromDisk?: boolean;
  pendingPrompt?: string;
  promptsSent?: number;
  estimatedTokens?: number;
  tokenLimit?: number;
  rateLimitWarning?: string;
  /** Dossier de travail (projet) dans lequel la console est lancée. */
  projectCwd?: string;
  onUpdateNode?: (id: string, patch: Partial<ConsoleNodeData>) => void;
  onResizeNode?: (
    id: string,
    action: 'shrink' | 'expand' | 'toggle-max' | { width: number; height: number; x?: number; y?: number }
  ) => void;
  onCloseNode?: (id: string) => void;
}

export interface TeamMemberSummary {
  id: string;
  label: string;
  commandType: AgentCommandType;
  status: AgentStatus;
  started: boolean;
  paused: boolean;
}

export interface TeamNodeData extends Record<string, unknown> {
  label: string;
  teamNumber: number;
  memberCount: number;
  runningCount: number;
  pulsing?: boolean;
  onRenameTeam?: (teamId: string, newLabel: string) => void;
  onUngroupTeam?: (teamId: string) => void;
  onStartTeam?: (teamId: string) => void;
  onStopTeam?: (teamId: string) => void;
  onCloseTeam?: (teamId: string) => void;
  onAutoGridTeam?: (teamId: string) => void;
  onScaleTeam?: (
    teamId: string,
    mode:
      | 'shrink'
      | 'expand'
      | 'toggle-max'
      | { width: number; height: number; x?: number; y?: number }
  ) => void;
}

export type TeamCollabMode = 'split' | 'relay' | 'debate' | 'parallel' | 'gate';

export interface OrchestratorNodeData extends Record<string, unknown> {
  label: string;
  teamId: string;
  teamLabel: string;
  members: TeamMemberSummary[];
  collabMode?: TeamCollabMode;
  lastBroadcastPrompt?: string;
  lastBroadcastAt?: string;
  onBroadcastToTeam?: (
    teamId: string,
    prompt: string,
    autoStartIdle: boolean,
    mode?: TeamCollabMode
  ) => void;
  onChangeCollabMode?: (teamId: string, mode: TeamCollabMode) => void;
  onTriggerTeamRelay?: (teamId: string, fromNodeId?: string) => void;
  onSynthesizeTeamWork?: (teamId: string) => void;
  onGenerateSummaryNote?: (teamId: string) => void;
  onStartTeam?: (teamId: string) => void;
  onStopTeam?: (teamId: string) => void;
  onCloseTeam?: (teamId: string) => void;
}

export interface AnimatedCableEdgeData extends Record<string, unknown> {
  active?: boolean;
  pulsing?: boolean;
  runningCount?: number;
}

export interface PersistedNodeRecord {
  id: string;
  type:
    | 'consoleNode'
    | 'teamNode'
    | 'orchestratorNode'
    | 'summaryNoteNode'
    | 'workspaceNode'
    | 'triggerNode';
  position: { x: number; y: number };
  width?: number;
  height?: number;
  parentId?: string;
  label: string;
  commandType?: AgentCommandType;
  customCommand?: string;
  teamNumber?: number;
  teamId?: string;
  promptsSent?: number;
  estimatedTokens?: number;
  tokenLimit?: number;
  // Specific data fields
  summaryContent?: string;
  projectPath?: string;
  branchName?: string;
  intervalMinutes?: number;
  triggerActive?: boolean;
}

export interface PersistedEdgeRecord {
  id: string;
  source: string;
  target: string;
  type?: string;
}

export interface CanvasPreset {
  id: string;
  name: string;
  description: string;
  builtIn?: boolean;
  createdAt: string;
  nodes: PersistedNodeRecord[];
  edges: PersistedEdgeRecord[];
}

export interface SharedMemoryItem {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface PersistedCanvasState {
  version: number;
  updatedAt: string;
  viewport?: { x: number; y: number; zoom: number };
  nodes: PersistedNodeRecord[];
  edges?: PersistedEdgeRecord[];
  presets?: CanvasPreset[];
  memoryNotes?: string;
}

export interface CommandTargetOption {
  id: string;
  kind: 'all' | 'team' | 'console';
  handle: string;
  label: string;
  subtitle: string;
  status?: AgentStatus;
}

export interface StorageLoadResult {
  exists: boolean;
  filePath: string;
  state: PersistedCanvasState | null;
  error?: string;
}

export interface StorageSaveResult {
  ok: boolean;
  filePath: string;
  error?: string;
}

export interface GitStatusResult {
  ok: boolean;
  error?: string;
  branchName?: string;
  lastCommitMessage?: string;
  modifiedFiles?: Array<{ name: string; status: 'modified' | 'added' | 'deleted' }>;
  totalModified?: number;
}

export interface AgentCanvasBridge {
  platform: string;
  spawnPty: (
    id: string,
    options: {
      commandType: AgentCommandType;
      customCommand?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      replayHistory?: boolean;
    }
  ) => Promise<{ ok: boolean; mode?: string; shell?: string; reused?: boolean }>;
  writePty: (id: string, data: string) => void;
  resizePty: (id: string, cols: number, rows: number) => void;
  pausePty: (id: string, paused: boolean) => Promise<boolean>;
  killPty: (id: string) => Promise<{ ok: boolean }>;

  loadCanvasState: () => Promise<StorageLoadResult>;
  saveCanvasState: (state: PersistedCanvasState) => Promise<StorageSaveResult>;
  getStoragePath: () => Promise<string>;
  getGitStatus?: (projectPath: string) => Promise<GitStatusResult>;
  pickFolder?: () => Promise<string | null>;

  onPtyData: (cb: (payload: { id: string; data: string; replay?: boolean }) => void) => () => void;
  onPtyStatus: (cb: (payload: { id: string; status: AgentStatus }) => void) => () => void;
  onPtyPrompt: (cb: (payload: { id: string }) => void) => () => void;
  onPtyExit: (cb: (payload: { id: string; exitCode?: number; signal?: number }) => void) => () => void;
}

declare global {
  interface Window {
    agentCanvasAPI?: AgentCanvasBridge;
  }
}
