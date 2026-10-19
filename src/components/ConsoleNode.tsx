import React, { useEffect, useRef, useState } from 'react';
import { NodeProps, NodeResizer } from '@xyflow/react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  Play,
  Pause,
  Pencil,
  X,
  Terminal as TerminalIcon,
  Sparkles,
  Code2,
  Cpu,
  RotateCcw,
  Check,
  ShieldCheck,
  Bot,
  HardDrive,
  Flame,
  Brain,
  Wrench,
  Globe,
  Gauge,
  AlertTriangle,
  Infinity as InfinityIcon,
  Minimize2,
  Maximize2,
  HelpCircle,
  Share2,
} from 'lucide-react';
import { AgentCommandType, AgentStatus, ConsoleNodeData } from '../types';
import {
  ChatTurn,
  getWebAgentReadiness,
  loadUserWebApiKeys,
  saveUserWebApiKeys,
  clearAllUserWebApiKeys,
  streamWebAgentResponse,
} from '../services/webAiClient';
import {
  appendTerminalScrollback,
  clearCachedWebChatHistory,
  clearTerminalScrollback,
  getCachedWebChatHistory,
  getTeamSharedContextSummary,
  getTerminalScrollback,
  markConsoleStarted,
  recordAgentReply,
} from '../services/teamCollabBus';

export type PricingTier = 'sub' | 'local-free' | 'freemium' | 'byok' | 'system';

export interface AgentOptionSpec {
  id: AgentCommandType;
  label: string;
  subtitle: string;
  badge: string;
  tier: PricingTier;
  tierLabel: string;
  costNotice: string;
  isFree?: boolean;
  isUnlimitedLocal?: boolean;
  defaultTokenLimit: number;
  quotaLabel: string;
  icon: React.ReactNode;
}

export const AGY_MODELS = [
  { id: 'gemini-4-argon-medium', label: 'Argon 4 (Medium)', tag: 'Recommandé' },
  { id: 'gemini-4-argon-high', label: 'Argon 4 (High)', tag: 'Max Raisonnement' },
  { id: 'gemini-4-argon-low', label: 'Argon 4 (Low)', tag: 'Rapide' },
  { id: 'claude-opus-5-5-medium', label: 'Claude Opus 5.5', tag: 'Via Abo Agy' },
  { id: 'claude-sonnet-5-5-medium', label: 'Claude Sonnet 5.5', tag: 'Via Abo Agy' },
  { id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash', tag: 'Économique' },
];

export const COMMAND_OPTIONS: AgentOptionSpec[] = [
  {
    id: 'agy',
    label: 'Antigravity (Argon 4)',
    subtitle: 'agy --model gemini-4-argon-medium',
    badge: 'Ton abonnement Antigravity · Argon 4',
    tier: 'sub',
    tierLabel: 'ABO PAYANT',
    costNotice:
      'Inclus dans ton abonnement Antigravity : consomme ton quota de session (aucune facturation hors-forfait).',
    isFree: false,
    defaultTokenLimit: 200000,
    quotaLabel: 'Abonnement Antigravity · Argon 4 (~200k tok)',
    icon: <Sparkles className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'claude',
    label: 'Claude Code',
    subtitle: 'claude',
    badge: 'Abo Claude Pro/Max ou Clé API',
    tier: 'sub',
    tierLabel: 'ABO PAYANT',
    costNotice:
      'Payant : nécessite un abonnement Claude Pro/Max (quota 5h) ou des crédits API Anthropic.',
    isFree: false,
    defaultTokenLimit: 45000,
    quotaLabel: 'Quota fenêtre 5h (~45k tok)',
    icon: <Sparkles className="w-4 h-4 text-[#ff6a3d]" />,
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    subtitle: 'codex',
    badge: 'Abo ChatGPT Plus/Pro ou Clé API',
    tier: 'sub',
    tierLabel: 'ABO PAYANT',
    costNotice:
      'Payant : nécessite un abonnement ChatGPT Plus/Pro ou une clé API OpenAI facturée à l’usage.',
    isFree: false,
    defaultTokenLimit: 60000,
    quotaLabel: 'Quota API / Plus (~60k tok)',
    icon: <Code2 className="w-4 h-4 text-teal-400" />,
  },
  {
    id: 'ollama',
    label: 'Ollama (Qwen2.5)',
    subtitle: 'ollama run qwen2.5-coder',
    badge: '100% Gratuit · Tourne sur ton PC',
    tier: 'local-free',
    tierLabel: '100% GRATUIT (PC)',
    costNotice:
      '100 % Gratuit (0 €) : tourne localement sur ton PC hors-ligne. Ne consomme aucun abonnement ni quota.',
    isFree: true,
    isUnlimitedLocal: true,
    defaultTokenLimit: 128000,
    quotaLabel: 'Local Hors-ligne · Illimité (0€)',
    icon: <HardDrive className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek R1 Local',
    subtitle: 'ollama run deepseek-r1',
    badge: '100% Gratuit · Tourne sur ton PC',
    tier: 'local-free',
    tierLabel: '100% GRATUIT (PC)',
    costNotice:
      '100 % Gratuit (0 €) : tourne localement sur ton PC via Ollama. Aucun compte ni carte bancaire requis.',
    isFree: true,
    isUnlimitedLocal: true,
    defaultTokenLimit: 128000,
    quotaLabel: 'Local Hors-ligne · Illimité (0€)',
    icon: <Brain className="w-4 h-4 text-cyan-400" />,
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    subtitle: 'gemini',
    badge: 'Quota Google Gratuit (1000 req/j)',
    tier: 'freemium',
    tierLabel: 'QUOTA GRATUIT',
    costNotice:
      'Gratuit (0 €) si tu choisis "Login with Google" (1 000 req/jour offertes sur Gemini standard, sans Argon 4).',
    isFree: true,
    defaultTokenLimit: 150000,
    quotaLabel: 'Quota Gratuit Google (1000 req/j)',
    icon: <Cpu className="w-4 h-4 text-sky-400" />,
  },
  {
    id: 'qwen',
    label: 'Qwen Code CLI',
    subtitle: 'qwen',
    badge: 'Outil gratuit · API ou Ollama (OAuth arrêté)',
    tier: 'byok',
    tierLabel: 'LOCAL / API',
    costNotice:
      'Attention : le tier gratuit "Qwen OAuth" a été arrêté en avril 2026. Nécessite une clé API (DashScope/OpenRouter) ou Ollama local.',
    isFree: false,
    defaultTokenLimit: 100000,
    quotaLabel: 'Quota Qwen Code (API ou Local)',
    icon: <Bot className="w-4 h-4 text-violet-400" />,
  },
  {
    id: 'kimi',
    label: 'Kimi K2 CLI',
    subtitle: 'kimi',
    badge: 'Crédits d’essai Moonshot ou Clé API',
    tier: 'byok',
    tierLabel: 'CLÉ API REQUISE',
    costNotice:
      'Attention : demande une clé API Moonshot AI (crédits d’essai à l’inscription, puis payant).',
    isFree: false,
    defaultTokenLimit: 120000,
    quotaLabel: 'Quota API Moonshot (~120k tok)',
    icon: <Flame className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'aider',
    label: 'Aider Pair AI',
    subtitle: 'aider',
    badge: 'Outil gratuit · Modèle Local ou API',
    tier: 'byok',
    tierLabel: 'SELON MODÈLE',
    costNotice:
      'L’outil est gratuit, mais le coût dépend du modèle : 0 € si branché sur Ollama, payant si branché sur une clé API.',
    isFree: false,
    defaultTokenLimit: 80000,
    quotaLabel: 'Fenêtre de contexte Aider (~80k tok)',
    icon: <Wrench className="w-4 h-4 text-lime-400" />,
  },
  {
    id: 'opencode',
    label: 'OpenCode CLI',
    subtitle: 'opencode',
    badge: 'Outil gratuit · Modèle Local ou API',
    tier: 'byok',
    tierLabel: 'SELON MODÈLE',
    costNotice:
      'L’outil est gratuit : 0 € avec les modèles gratuits/Ollama, payant si tu ajoutes une clé API payante.',
    isFree: false,
    defaultTokenLimit: 100000,
    quotaLabel: 'Quota OpenCode (~100k tok)',
    icon: <Globe className="w-4 h-4 text-pink-400" />,
  },
  {
    id: 'shell',
    label: 'System Shell',
    subtitle: 'shell',
    badge: 'PowerShell / Terminal Système',
    tier: 'system',
    tierLabel: 'SYSTÈME',
    costNotice: 'Terminal Windows PowerShell classique de ton PC (0 €).',
    isFree: true,
    isUnlimitedLocal: true,
    defaultTokenLimit: 100000,
    quotaLabel: 'Shell Système · Sans limite',
    icon: <TerminalIcon className="w-4 h-4 text-zinc-300" />,
  },
];

const STATUS_META: Record<
  AgentStatus,
  { label: string; dotClass: string; badgeBg: string; textClass: string }
> = {
  running: {
    label: 'running',
    dotClass: 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]',
    badgeBg: 'bg-[#22c55e]/10 border-[#22c55e]/30',
    textClass: 'text-[#22c55e]',
  },
  waiting: {
    label: 'waiting',
    dotClass: 'bg-[#f97316] shadow-[0_0_8px_#f97316]',
    badgeBg: 'bg-[#f97316]/10 border-[#f97316]/30',
    textClass: 'text-[#f97316]',
  },
  idle: {
    label: 'idle',
    dotClass: 'bg-[#71717a]',
    badgeBg: 'bg-zinc-800/70 border-zinc-700/60',
    textClass: 'text-zinc-400',
  },
  error: {
    label: 'error',
    dotClass: 'bg-[#ef4444] shadow-[0_0_8px_#ef4444]',
    badgeBg: 'bg-[#ef4444]/10 border-[#ef4444]/30',
    textClass: 'text-[#ef4444]',
  },
};

function stripAnsi(str: string): string {
  return str
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)?/g, '') // OSC (window title…) — was leaking "]0;C:\WINDOWS…"
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '') // CSI (colors, cursor moves)
    .replace(/\x1B[@-Z\\-_]/g, '') // other 2-char escapes
    .replace(/(^|\s)\]\d;[^\s\x07]*\x07?/g, '$1'); // OSC split across chunks (ESC in previous chunk)
}

/** A question on screen the CLI is waiting for (folder trust, login…): never type a mission into it. */
const BLOCKING_DIALOG_RE =
  /do you trust|trust (this|the) (folder|files|project|workspace|directory)|yes, i trust|enter to confirm|press enter to continue|select (a )?login method|sign in with|log ?in to (continue|your)|login required|choose (the|a) (text )?(style|theme)/i;
/** The CLI is still producing its answer. */
const WORKING_RE = /esc to (interrupt|cancel)|thinking\.\.\.|thinking…|working\.\.\.|working…/i;
/** Interface chrome that is not part of an answer (input box, hints, footers). */
const CHROME_LINE_RE =
  /\? for shortcuts|esc to (interrupt|cancel|dismiss)|ctrl\+|shift\+tab|auto-accept|auto mode|bypass permissions|context left|tokens? (used|left)|for (help|commands)|type your message|^\s*[✻✳✢✶✽]\s|\b\w+(ed|t) for \d+(\.\d+)?\s*(s|m|ms)\b|\bdone \d{1,2}:\d{2}|\d+ tokens\b|update installed|restart to update|\/effort\b|\/model\b/i;

function countLetters(text: string): number {
  return (text.match(/[A-Za-zÀ-ÿ]/g) || []).length;
}

/** Turn raw terminal text into a clean answer: drop box borders, empty prompt lines and UI hints. */
function cleanReplyText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[│┃╭╮╰╯─━┏┓┗┛▐▌▛▜▝▘]/g, ' ').trim())
    .filter((line) => countLetters(line) >= 2 && !CHROME_LINE_RE.test(line) && !/^[>❯›]\s*$/.test(line))
    .join('\n')
    .trim();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Keep only what the agent printed AFTER the echo of the prompt we sent.
 * Windows ConPTY sometimes repaints the whole visible screen (old output included) when text scrolls;
 * without this, that old text was relayed to teammates as if it were the agent's answer.
 */
function stripEchoedPrompt(buffer: string, sentPrompt: string): string {
  if (!sentPrompt) return buffer;
  // Compare only plain ASCII letters/digits: terminals may alter accents, "·", commas or wrap lines.
  const plain = (text: string) => text.normalize('NFD').replace(/[^A-Za-z0-9]/g, '');
  const marker = plain(sentPrompt).slice(-40); // long enough that an answer quoting the question can't match
  if (marker.length < 4) return buffer;
  let compact = '';
  const indexMap: number[] = [];
  for (let i = 0; i < buffer.length; i++) {
    for (const ch of plain(buffer[i])) {
      compact += ch;
      indexMap.push(i);
    }
  }
  const pos = compact.lastIndexOf(marker);
  if (pos < 0) return buffer;
  return buffer.slice(indexMap[pos + marker.length - 1] + 1);
}

export const ConsoleNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as ConsoleNodeData;
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(nodeData.label || 'Console');
  const [selectedCmd, setSelectedCmd] = useState<AgentCommandType>(
    nodeData.commandType || 'claude'
  );
  const [customCmd, setCustomCmd] = useState<string>(
    nodeData.customCommand || ''
  );
  const [filterMode, setFilterMode] = useState<'all' | 'sub' | 'local' | 'freemium'>('all');
  const [editingLimit, setEditingLimit] = useState(false);

  const activeOptionMeta =
    COMMAND_OPTIONS.find((o) => o.id === selectedCmd) || COMMAND_OPTIONS[0];

  const tokenLimit =
    nodeData.tokenLimit || activeOptionMeta.defaultTokenLimit || 50000;
  const estimatedTokens = nodeData.estimatedTokens || 0;
  const promptsSent = nodeData.promptsSent || 0;

  // Always-fresh copies of props/state for long-lived terminal listeners.
  // Without these, a console started before being grouped/renamed kept its old team & name forever.
  const nodeDataRef = useRef(nodeData);
  nodeDataRef.current = nodeData;
  const selectedCmdRef = useRef(selectedCmd);
  selectedCmdRef.current = selectedCmd;
  const customCmdRef = useRef(customCmd);
  customCmdRef.current = customCmd;
  const tokenLimitRef = useRef(tokenLimit);
  tokenLimitRef.current = tokenLimit;

  // Refs for smooth accumulation inside PTY listeners without re-binding xterm
  const tokensRef = useRef<number>(estimatedTokens);
  const promptsRef = useRef<number>(promptsSent);
  useEffect(() => {
    tokensRef.current = nodeData.estimatedTokens || 0;
  }, [nodeData.estimatedTokens]);
  useEffect(() => {
    promptsRef.current = nodeData.promptsSent || 0;
  }, [nodeData.promptsSent]);

  useEffect(() => {
    setDraftName(nodeData.label);
  }, [nodeData.label]);

  useEffect(() => {
    if (nodeData.commandType) {
      setSelectedCmd(nodeData.commandType);
    }
  }, [nodeData.commandType]);

  useEffect(() => {
    if (typeof nodeData.customCommand === 'string') {
      setCustomCmd(nodeData.customCommand);
    }
  }, [nodeData.customCommand]);

  // Execute pending prompt injected via Orchestrator, Team Relay, or Command Bar once started
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webPromptRunnerRef = useRef<((promptText: string) => void) | null>(null);
  const queuedPromptRef = useRef<string | null>(null);
  const lastDispatchedPromptRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const ptyTurnBufferRef = useRef<string>('');
  const ptyTurnActiveRef = useRef(false);
  const lastSentPromptRef = useRef('');
  const lastOutputAtRef = useRef(0);
  const sentAtRef = useRef(0);
  const waitingForReadyRef = useRef(false);

  /** Text currently displayed by the terminal (what a human would see), or the last `maxLines` lines. */
  const readTerminalText = (mode: 'screen' | 'tail', maxLines = 400): string => {
    const term = xtermRef.current;
    if (!term) return '';
    const buf = term.buffer.active;
    const start = mode === 'screen' ? buf.baseY : Math.max(0, buf.length - maxLines);
    const end = mode === 'screen' ? buf.baseY + term.rows : buf.length;
    const lines: string[] = [];
    for (let i = start; i < end; i++) {
      lines.push(buf.getLine(i)?.translateToString(true) ?? '');
    }
    return lines.join('\n');
  };

  const setAttention = (message: string | undefined) => {
    if ((nodeDataRef.current.attentionRequired || undefined) === message) return;
    nodeDataRef.current.onUpdateNode?.(id, {
      attentionRequired: message,
      ...(message ? { status: 'waiting' as const } : {}),
    });
  };

  /**
   * Wait until the CLI can receive a prompt: its screen is quiet, it is not busy,
   * and no question (folder trust, login…) is waiting for the user.
   */
  const waitForCliReady = async (): Promise<'ready' | 'blocked' | 'stopped'> => {
    const startedAt = Date.now();
    waitingForReadyRef.current = true;
    try {
      while (true) {
        if (!nodeDataRef.current.started) return 'stopped';
        const screen = readTerminalText('screen');
        if (BLOCKING_DIALOG_RE.test(screen)) {
          setAttention('Action requise dans la console (question de la CLI) — réponds-y pour que la mission parte.');
          if (Date.now() - startedAt > 15 * 60_000) return 'blocked';
        } else {
          setAttention(undefined);
          const quietFor = Date.now() - lastOutputAtRef.current;
          if (lastOutputAtRef.current > 0 && quietFor >= 1500 && !WORKING_RE.test(screen)) return 'ready';
          // Busy for too long: send anyway, CLIs queue messages typed while they work.
          if (Date.now() - startedAt > 3 * 60_000) return 'ready';
        }
        await sleep(250);
      }
    } finally {
      waitingForReadyRef.current = false;
    }
  };

  /** End of an agent turn: capture its answer and publish it (to the team relay) only if it is a real answer. */
  const finishPtyTurn = (reason: 'prompt' | 'quiet' | 'exit', exitCode?: number) => {
    if (!ptyTurnActiveRef.current) return;
    ptyTurnActiveRef.current = false;
    const sentPrompt = lastSentPromptRef.current;
    // Prefer what the terminal actually displays (TUIs redraw a lot; the raw stream is messy).
    let raw = '';
    if (sentPrompt) {
      const tail = readTerminalText('tail');
      const afterEcho = stripEchoedPrompt(tail, sentPrompt);
      if (afterEcho !== tail) raw = afterEcho;
    }
    if (!raw) raw = stripEchoedPrompt(ptyTurnBufferRef.current, sentPrompt);
    ptyTurnBufferRef.current = '';
    const reply = cleanReplyText(raw);
    const isRealAnswer = countLetters(reply) >= 12;
    if (!isRealAnswer && reason !== 'exit') return;
    recordAgentReply({
      nodeId: id,
      label: nodeDataRef.current.label || 'Console',
      commandType: selectedCmdRef.current,
      teamId: nodeDataRef.current.teamId,
      text: isRealAnswer
        ? reply
        : `La session IA s'est arrêtée avant de fournir une réponse (code ${exitCode ?? 'inconnu'}).`,
      timestamp: new Date().toLocaleTimeString(),
    });
  };

  // Once a prompt has been consumed (cleared), the same text may legitimately be sent again.
  useEffect(() => {
    if (!nodeData.pendingPrompt) lastDispatchedPromptRef.current = null;
  }, [nodeData.pendingPrompt]);

  useEffect(() => {
    if (!nodeData.started || !nodeData.pendingPrompt) return;
    const promptToRun = nodeData.pendingPrompt;

    // Deduplicate: ignore if this exact prompt was already received and dispatched
    if (lastDispatchedPromptRef.current === promptToRun) return;
    lastDispatchedPromptRef.current = promptToRun;

    const addedTokens = Math.max(4, Math.ceil(promptToRun.length / 3.8));
    tokensRef.current += addedTokens;
    promptsRef.current += 1;

    const executePrompt = async (text: string) => {
      if (window.agentCanvasAPI) {
        const singleLinePrompt = text.replace(/\r?\n+/g, ' ').trim();
        ptyTurnActiveRef.current = false;
        try {
          // Reuse a live CLI session, or recreate it if a one-shot CLI exited after its previous reply.
          const session = await window.agentCanvasAPI.spawnPty(id, {
            commandType: selectedCmdRef.current,
            customCommand: customCmdRef.current.trim() || undefined,
            cwd: nodeDataRef.current.projectCwd || undefined,
            cols: xtermRef.current?.cols || 80,
            rows: xtermRef.current?.rows || 24,
          });
          if (!session.ok) throw new Error('Impossible de démarrer la console.');
          if (!session.reused) {
            // Give the shell a moment to launch the CLI before checking whether it is ready.
            await sleep(1200);
          }
          // Wait for the CLI to be really ready (no fixed delay: Claude/Gemini can take several seconds,
          // and may first ask a question such as "Do you trust this folder?").
          const readiness = await waitForCliReady();
          if (readiness === 'stopped') return;
          if (readiness === 'blocked') {
            throw new Error("la CLI attend toujours une réponse dans la console (question de confiance / connexion).");
          }
          // Start capturing the reply only now, so nothing printed before this prompt leaks into it.
          ptyTurnBufferRef.current = '';
          lastSentPromptRef.current = singleLinePrompt;
          sentAtRef.current = Date.now();
          ptyTurnActiveRef.current = true;
          // Type the text, then press Enter separately: full-screen CLIs (Claude Code, Gemini…) treat a long
          // burst of input as a paste, and an Enter inside that burst becomes a newline instead of "send".
          window.agentCanvasAPI.writePty(id, singleLinePrompt);
          await sleep(Math.min(1500, 250 + Math.ceil(singleLinePrompt.length / 4)));
          window.agentCanvasAPI.writePty(id, '\r');
          sentAtRef.current = Date.now();
        } catch (err) {
          ptyTurnActiveRef.current = false;
          const message = err instanceof Error ? err.message : String(err);
          nodeDataRef.current.onUpdateNode?.(id, { status: 'error' });
          // Shown in the console only: a launch failure must never be relayed to teammates as an "answer".
          xtermRef.current?.writeln(`\r\n\x1b[31m[Mission non envoyée] ${message}\x1b[0m`);
        }
      } else if (webPromptRunnerRef.current) {
        webPromptRunnerRef.current(text);
      } else {
        queuedPromptRef.current = text;
      }

      // Clear pendingPrompt only after dispatching/queuing
      nodeDataRef.current.onUpdateNode?.(id, {
        pendingPrompt: undefined,
        estimatedTokens: tokensRef.current,
        promptsSent: promptsRef.current,
      });
    };

    // If web runner is already mounted and ready, execute immediately (zero race condition / zero timer cancellation)
    if (!window.agentCanvasAPI && webPromptRunnerRef.current) {
      executePrompt(promptToRun);
      return;
    }

    // If starting up or in Electron desktop mode, wait for CLI/terminal readiness
    const elapsedSinceStart = Date.now() - startedAtRef.current;
    const delayMs = window.agentCanvasAPI
      ? elapsedSinceStart < 2200
        ? Math.max(650, 2300 - elapsedSinceStart)
        : 150
      : 150;

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
    }

    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      executePrompt(promptToRun);
    }, delayMs);

    return () => {
      // NOTE: Do NOT cancel pendingTimerRef.current on every prop re-render!
      // Cancelling here would abort prompt dispatch whenever onUpdateNode updates state before delayMs expires!
    };
  }, [nodeData.started, nodeData.pendingPrompt, id]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  // Initialize xterm instance ONLY when console is explicitly started
  useEffect(() => {
    if (!nodeData.started || !terminalContainerRef.current) return;

    markConsoleStarted(id, true);
    if (!startedAtRef.current) {
      startedAtRef.current = Date.now();
    }

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.35,
      allowProposedApi: true,
      theme: {
        background: '#16141c',
        foreground: '#e4e4e7',
        cursor: '#ff6a3d',
        cursorAccent: '#16141c',
        selectionBackground: 'rgba(255, 106, 61, 0.28)',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#52525b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainerRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (_) {}
    }, 50);

    const api = window.agentCanvasAPI;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleUsageFlush = (warningText?: string) => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        nodeDataRef.current.onUpdateNode?.(id, {
          estimatedTokens: tokensRef.current,
          promptsSent: promptsRef.current,
          ...(warningText ? { rateLimitWarning: warningText } : {}),
        });
      }, 300);
    };

    if (api) {
      api
        .spawnPty(id, {
          commandType: selectedCmdRef.current,
          customCommand: customCmdRef.current.trim() || undefined,
          cwd: nodeDataRef.current.projectCwd || undefined,
          cols: term.cols || 80,
          rows: term.rows || 24,
          // Re-attach after a remount: show what the agent printed meanwhile.
          replayHistory: true,
        })
        .catch((err) => {
          term.writeln(`\x1b[31m[Erreur lancement PTY]: ${String(err)}\x1b[0m`);
        });

      const inputDisposable = term.onData((input) => {
        api.writePty(id, input);
        if (input.includes('\u0003')) {
          ptyTurnActiveRef.current = false;
          ptyTurnBufferRef.current = '';
        }
        if (
          (input.includes('\r') || input.includes('\n')) &&
          !waitingForReadyRef.current &&
          !BLOCKING_DIALOG_RE.test(readTerminalText('screen'))
        ) {
          ptyTurnActiveRef.current = true;
          promptsRef.current += 1;
          tokensRef.current += 6;
          ptyTurnBufferRef.current = '';
          lastSentPromptRef.current = '';
          scheduleUsageFlush();
        } else {
          tokensRef.current += Math.max(1, Math.ceil(input.length / 4));
        }
      });

      const unsubData = api.onPtyData((payload) => {
        if (payload.id === id && payload.replay) {
          // History re-sent to redraw a remounted terminal: display only, never count it as a new reply.
          term.write(payload.data);
          return;
        }
        if (payload.id === id) {
          term.write(payload.data);
          appendTerminalScrollback(id, payload.data);
          lastOutputAtRef.current = Date.now();

          const clean = stripAnsi(payload.data);
          const charCount = clean.replace(/\s+/g, ' ').trim().length;
          if (charCount > 0) {
            tokensRef.current += Math.max(1, Math.ceil(charCount / 4));
            ptyTurnBufferRef.current = (ptyTurnBufferRef.current + ' ' + clean).slice(
              -3000
            );
          }

          // Detect explicit token count or rate-limit messages from CLI tools
          const lower = clean.toLowerCase();
          let detectedWarning: string | undefined;
          if (
            /rate[ _-]?limit(ed)?\b|quota exceeded|usage limit|too many requests|\b(?:http|status|error|code)\W{0,3}429\b|\b429\W{0,3}too many/i.test(
              lower
            )
          ) {
            detectedWarning = 'Limite de requêtes / Quota détecté par le CLI';
            tokensRef.current = Math.max(tokensRef.current, tokenLimitRef.current);
          }

          scheduleUsageFlush(detectedWarning);
        }
      });

      const unsubStatus = api.onPtyStatus((payload) => {
        if (payload.id === id) {
          nodeDataRef.current.onUpdateNode?.(id, { status: payload.status });
        }
      });

      const unsubPrompt = api.onPtyPrompt((payload) => {
        if (payload.id !== id || !ptyTurnActiveRef.current) return;
        // A dialog line (e.g. "❯ Yes, I trust this folder") looks like a prompt: it is not the end of an answer.
        if (BLOCKING_DIALOG_RE.test(readTerminalText('screen'))) return;
        finishPtyTurn('prompt');
      });

      // Full-screen AI CLIs (Claude Code, Gemini, Agy…) never print a shell prompt:
      // their answer is over when the screen has been quiet for a while and they no longer show "esc to interrupt".
      const turnWatcher = setInterval(() => {
        if (!ptyTurnActiveRef.current || !lastSentPromptRef.current) return;
        if (selectedCmdRef.current === 'shell') return;
        const now = Date.now();
        if (now - sentAtRef.current < 3000) return;
        if (lastOutputAtRef.current <= sentAtRef.current) return;
        if (now - lastOutputAtRef.current < 4000) return;
        const screen = readTerminalText('screen');
        if (WORKING_RE.test(screen)) return;
        if (BLOCKING_DIALOG_RE.test(screen)) {
          setAttention("Action requise dans la console — l'IA attend ta réponse.");
          return;
        }
        finishPtyTurn('quiet');
      }, 500);

      const unsubExit = api.onPtyExit((payload) => {
        if (payload.id === id) {
          term.writeln(
            `\r\n\x1b[90m[Processus terminé avec le code ${payload.exitCode ?? 0}]\x1b[0m`
          );
          finishPtyTurn('exit', payload.exitCode);
        }
      });

      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          api.resizePty(id, term.cols, term.rows);
        } catch (_) {}
      });
      resizeObserver.observe(terminalContainerRef.current);

      return () => {
        if (flushTimer) clearTimeout(flushTimer);
        clearInterval(turnWatcher);
        resizeObserver.disconnect();
        inputDisposable.dispose();
        unsubData();
        unsubStatus();
        unsubPrompt();
        unsubExit();
        term.dispose();
        xtermRef.current = null;
      };
    } else {
      // ====================================================================
      // INTERACTIVE WEB / CLOUDFLARE TERMINAL MODE (BYOK + Local Ollama)
      // ====================================================================
      const chatHistory: ChatTurn[] = getCachedWebChatHistory(id);
      let inputBuffer = '';
      let isStreaming = false;
      let activeAbort: AbortController | null = null;

      const writeAndCache = (str: string) => {
        term.write(str);
        appendTerminalScrollback(id, str);
      };

      const writelnAndCache = (str: string) => {
        term.writeln(str);
        appendTerminalScrollback(id, str + '\r\n');
      };

      const writePrompt = () => {
        writeAndCache(`\r\n\x1b[38;2;255;106;61m${selectedCmdRef.current}\x1b[0m \x1b[32m❯\x1b[0m `);
      };

      const existingScrollback = getTerminalScrollback(id);
      if (existingScrollback) {
        // Restore existing conversation screen without resetting!
        term.write(existingScrollback);
      } else {
        const readiness = getWebAgentReadiness(selectedCmdRef.current, loadUserWebApiKeys());
        writelnAndCache(
          `\x1b[38;2;255;106;61m● Agent Canvas Web · Console ${selectedCmdRef.current.toUpperCase()}\x1b[0m`
        );
        if (readiness.ready) {
          writelnAndCache(
            `\x1b[32m✓ Connecté :\x1b[0m \x1b[90m${readiness.providerLabel} (Tapez votre question ou /help)\x1b[0m`
          );
        } else {
          writelnAndCache(
            `\x1b[33m⚠ Clé API requise :\x1b[0m \x1b[90m${readiness.missingKeyHint}\x1b[0m`
          );
          writelnAndCache(
            `\x1b[90m  👉 Cliquez sur \x1b[38;2;255;106;61m"🔑 Clés API"\x1b[90m en haut ou tapez \x1b[36m/key VOTRE_CLE\x1b[0m`
          );
        }
        writePrompt();
      }

      const executeWebPrompt = async (rawLine: string) => {
        const trimmed = rawLine.trim();
        if (!trimmed) {
          writePrompt();
          return;
        }

        if (trimmed === '/clear' || trimmed === 'clear') {
          term.clear();
          clearTerminalScrollback(id);
          writePrompt();
          return;
        }

        if (trimmed === '/help' || trimmed === 'help') {
          writelnAndCache('\x1b[36mCommandes disponibles (Mode Web) :\x1b[0m');
          writelnAndCache('  \x1b[33m/guide\x1b[0m          Ouvrir la fiche d’aide & commandes de cette IA (' + selectedCmdRef.current + ')');
          writelnAndCache('  \x1b[33m/tuto\x1b[0m           Ouvrir le tutoriel interactif complet pour débutants');
          writelnAndCache('  \x1b[33m/support\x1b[0m        Signaler un problème (ticket GitHub pré-rempli)');
          writelnAndCache('  \x1b[33m/key <CLE_API>\x1b[0m  Enregistrer votre clé API pour cet agent (ex: /key AIza... ou /key sk-or-...)');
          writelnAndCache('  \x1b[33m/keys\x1b[0m           Ouvrir la fenêtre de gestion de toutes vos clés API');
          writelnAndCache('  \x1b[33m/clear\x1b[0m          Effacer l’écran du terminal');
          writePrompt();
          return;
        }

        if (trimmed === '/guide') {
          window.dispatchEvent(
            new CustomEvent('agent-canvas-open-ai-help', {
              detail: {
                agent: selectedCmdRef.current,
                consoleId: id,
                consoleLabel: nodeDataRef.current.label,
              },
            })
          );
          writePrompt();
          return;
        }

        if (trimmed === '/tuto') {
          window.dispatchEvent(new CustomEvent('agent-canvas-open-tutorial'));
          writePrompt();
          return;
        }

        if (trimmed === '/support') {
          window.dispatchEvent(
            new CustomEvent('agent-canvas-open-support', {
              detail: {
                subject: `Problème depuis la console ${nodeDataRef.current.label} (${selectedCmdRef.current})`,
              },
            })
          );
          writePrompt();
          return;
        }

        if (
          trimmed === '/clearkeys' ||
          trimmed === '/resetkeys' ||
          trimmed === '/clear-keys' ||
          trimmed === '/delkeys'
        ) {
          clearAllUserWebApiKeys();
          writelnAndCache('\x1b[32m✓ Toutes les clés API ont été supprimées de votre navigateur !\x1b[0m');
          writePrompt();
          return;
        }

        if (trimmed === '/keys') {
          window.dispatchEvent(new CustomEvent('agent-canvas-open-keys-modal'));
          writePrompt();
          return;
        }

        if (trimmed.startsWith('/key ')) {
          const newKey = trimmed.slice(5).trim();
          if (!newKey) {
            writelnAndCache('\x1b[31mUsage : /key VOTRE_CLE_API  (ou /key clear pour tout effacer)\x1b[0m');
            writePrompt();
            return;
          }

          if (
            newKey === 'clear' ||
            newKey === 'delete' ||
            newKey === 'remove' ||
            newKey === 'reset'
          ) {
            clearAllUserWebApiKeys();
            writelnAndCache('\x1b[32m✓ Toutes les clés API ont été supprimées de votre navigateur !\x1b[0m');
            writePrompt();
            return;
          }

          const current = loadUserWebApiKeys();

          if (newKey === 'off' || newKey === 'del' || newKey === 'none') {
            if (selectedCmdRef.current === 'claude') current.anthropicKey = '';
            else if (selectedCmdRef.current === 'gemini' || selectedCmdRef.current === 'agy') current.geminiKey = '';
            else if (selectedCmdRef.current === 'codex') current.openaiKey = '';
            else if (selectedCmdRef.current === 'qwen') current.qwenKey = '';
            else if (selectedCmdRef.current === 'kimi') current.kimiKey = '';
            saveUserWebApiKeys(current);
            writelnAndCache(`\x1b[32m✓ Clé spécifique désactivée pour ${selectedCmdRef.current} !\x1b[0m`);
            writePrompt();
            return;
          }

          if (newKey.startsWith('sk-or-')) {
            current.openrouterKey = newKey;
            writelnAndCache('\x1b[32m✓ Clé universelle OpenRouter enregistrée dans votre navigateur !\x1b[0m');
          } else if (newKey.startsWith('AIza') || selectedCmdRef.current === 'gemini' || selectedCmdRef.current === 'agy') {
            current.geminiKey = newKey;
            writelnAndCache('\x1b[32m✓ Clé Google Gemini enregistrée dans votre navigateur !\x1b[0m');
          } else if (newKey.startsWith('sk-ant-') || selectedCmdRef.current === 'claude') {
            current.anthropicKey = newKey;
            writelnAndCache('\x1b[32m✓ Clé Anthropic Claude enregistrée dans votre navigateur !\x1b[0m');
          } else if (selectedCmdRef.current === 'qwen') {
            current.qwenKey = newKey;
            writelnAndCache('\x1b[32m✓ Clé Qwen DashScope enregistrée dans votre navigateur !\x1b[0m');
          } else if (selectedCmdRef.current === 'kimi') {
            current.kimiKey = newKey;
            writelnAndCache('\x1b[32m✓ Clé Moonshot Kimi enregistrée dans votre navigateur !\x1b[0m');
          } else {
            current.openaiKey = newKey;
            writelnAndCache('\x1b[32m✓ Clé OpenAI enregistrée dans votre navigateur !\x1b[0m');
          }
          saveUserWebApiKeys(current);
          writePrompt();
          return;
        }

        isStreaming = true;
        activeAbort = new AbortController();
        nodeDataRef.current.onUpdateNode?.(id, { status: 'running' });

        // Inject shared context from teammates in the same Team so AIs collaborate seamlessly
        const teamContext = getTeamSharedContextSummary(nodeDataRef.current.teamId, id);
        const enrichedContent = teamContext
          ? `[Contexte d'équipe - dernières réponses de tes coéquipiers IA :\n${teamContext}\n]\n\nInstruction / Message : ${trimmed}`
          : trimmed;

        chatHistory.push({ role: 'user', content: enrichedContent });
        promptsRef.current += 1;
        tokensRef.current += Math.max(4, Math.ceil(trimmed.length / 4));
        scheduleUsageFlush();

        let fullReply = '';
        writeAndCache('\r\n\x1b[36m◆\x1b[0m ');

        try {
          await streamWebAgentResponse({
            commandType: selectedCmdRef.current,
            customCommand: customCmdRef.current,
            history: chatHistory,
            signal: activeAbort.signal,
            onChunk: (chunk) => {
              fullReply += chunk;
              const formatted = chunk.replace(/\r?\n/g, '\r\n');
              writeAndCache(formatted);
              tokensRef.current += Math.max(1, Math.ceil(chunk.length / 4));
              scheduleUsageFlush();
            },
          });
          chatHistory.push({ role: 'assistant', content: fullReply });
          writeAndCache('\r\n');
          nodeDataRef.current.onUpdateNode?.(id, { status: 'idle' });

          // Publish reply to Team Bus so teammates can react / continue the work
          recordAgentReply({
            nodeId: id,
            label: nodeDataRef.current.label || 'Console',
            commandType: selectedCmdRef.current,
            teamId: nodeDataRef.current.teamId,
            text: fullReply,
            timestamp: new Date().toLocaleTimeString(),
          });
        } catch (err: unknown) {
          const isAbort =
            (err instanceof DOMException && err.name === 'AbortError') ||
            (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'))) ||
            Boolean(activeAbort?.signal?.aborted);

          if (!isAbort) {
            const msg = err instanceof Error ? err.message : String(err);
            writelnAndCache(`\r\n\x1b[31m✖ ${msg}\x1b[0m`);
            nodeDataRef.current.onUpdateNode?.(id, { status: 'waiting' });
            recordAgentReply({
              nodeId: id,
              label: nodeDataRef.current.label || 'Console',
              commandType: selectedCmdRef.current,
              teamId: nodeDataRef.current.teamId,
              text: `Échec de l'agent : ${msg}`,
              timestamp: new Date().toLocaleTimeString(),
            });
          } else {
            nodeDataRef.current.onUpdateNode?.(id, { status: 'idle' });
          }
        } finally {
          isStreaming = false;
          activeAbort = null;
          writePrompt();
        }
      };

      webPromptRunnerRef.current = (broadcastText: string) => {
        writelnAndCache(`\r\n\x1b[38;2;255;106;61m[📨 Équipe]\x1b[0m ${broadcastText}`);
        void executeWebPrompt(broadcastText);
      };

      if (queuedPromptRef.current) {
        const promptFromQueue = queuedPromptRef.current;
        queuedPromptRef.current = null;
        setTimeout(() => {
          if (webPromptRunnerRef.current) {
            webPromptRunnerRef.current(promptFromQueue);
          }
        }, 120);
      }

      const inputDisposable = term.onData((data) => {
        if (data === '\x03') {
          // Ctrl+C
          if (isStreaming && activeAbort) {
            activeAbort.abort();
            isStreaming = false;
            writelnAndCache('^C\r\n\x1b[90m[Génération interrompue]\x1b[0m');
            nodeDataRef.current.onUpdateNode?.(id, { status: 'idle' });
          } else {
            inputBuffer = '';
            writeAndCache('^C');
            writePrompt();
          }
          return;
        }

        if (isStreaming) return;

        if (data === '\r' || data === '\n') {
          const lineToRun = inputBuffer;
          inputBuffer = '';
          writeAndCache('\r\n');
          void executeWebPrompt(lineToRun);
        } else if (data === '\x7f' || data === '\b') {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            term.write('\b \b');
          }
        } else if (data >= ' ' && !data.startsWith('\x1b')) {
          inputBuffer += data;
          writeAndCache(data);
        }
      });

      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
        } catch (_) {}
      });
      resizeObserver.observe(terminalContainerRef.current);

      return () => {
        webPromptRunnerRef.current = null;
        if (activeAbort) activeAbort.abort();
        if (flushTimer) clearTimeout(flushTimer);
        resizeObserver.disconnect();
        inputDisposable.dispose();
        term.dispose();
        xtermRef.current = null;
      };
    }
  }, [nodeData.started, id]);

  const handleSelectCommand = (cmd: AgentCommandType) => {
    setSelectedCmd(cmd);
    const spec = COMMAND_OPTIONS.find((o) => o.id === cmd);
    nodeData.onUpdateNode?.(id, {
      commandType: cmd,
      tokenLimit: spec?.defaultTokenLimit || 50000,
    });
  };

  const handleStart = (cmd: AgentCommandType) => {
    setSelectedCmd(cmd);
    startedAtRef.current = Date.now();
    markConsoleStarted(id, true);
    const spec = COMMAND_OPTIONS.find((o) => o.id === cmd);
    nodeData.onUpdateNode?.(id, {
      commandType: cmd,
      customCommand: customCmd.trim() || undefined,
      tokenLimit: nodeData.tokenLimit || spec?.defaultTokenLimit || 50000,
      started: true,
      paused: false,
      restoredFromDisk: false,
      status: 'running',
    });
  };

  const handleTogglePause = async () => {
    const nextPaused = !nodeData.paused;
    if (window.agentCanvasAPI) {
      await window.agentCanvasAPI.pausePty(id, nextPaused);
    }
    nodeData.onUpdateNode?.(id, {
      paused: nextPaused,
      status: nextPaused ? 'waiting' : 'running',
    });
  };

  const handleRestart = async () => {
    startedAtRef.current = 0;
    markConsoleStarted(id, false);
    clearTerminalScrollback(id);
    clearCachedWebChatHistory(id);
    if (window.agentCanvasAPI) {
      await window.agentCanvasAPI.killPty(id);
    }
    nodeData.onUpdateNode?.(id, {
      started: false,
      paused: false,
      status: 'idle',
    });
  };

  const handleResetQuota = () => {
    tokensRef.current = 0;
    promptsRef.current = 0;
    nodeData.onUpdateNode?.(id, {
      estimatedTokens: 0,
      promptsSent: 0,
      rateLimitWarning: undefined,
    });
  };

  const handleCommitRename = () => {
    const trimmed = draftName.trim() || 'Console';
    setDraftName(trimmed);
    setIsRenaming(false);
    nodeData.onUpdateNode?.(id, { label: trimmed });
  };

  const statusInfo = STATUS_META[nodeData.status || 'idle'];
  const visibleOptions =
    filterMode === 'sub'
      ? COMMAND_OPTIONS.filter((o) => o.tier === 'sub')
      : filterMode === 'local'
      ? COMMAND_OPTIONS.filter((o) => o.tier === 'local-free')
      : filterMode === 'freemium'
      ? COMMAND_OPTIONS.filter((o) => o.tier === 'freemium')
      : COMMAND_OPTIONS;

  // Compute progress percentage & color
  const isUnlimited = Boolean(activeOptionMeta.isUnlimitedLocal);
  const rawPct = tokenLimit > 0 ? (estimatedTokens / tokenLimit) * 100 : 0;
  const usagePct = Math.min(100, Math.round(rawPct));

  const barColorClass = isUnlimited
    ? 'bg-emerald-500'
    : usagePct >= 85 || nodeData.rateLimitWarning
    ? 'bg-[#ef4444] shadow-[0_0_10px_#ef4444]'
    : usagePct >= 60
    ? 'bg-[#f97316] shadow-[0_0_8px_#f97316]'
    : 'bg-[#22c55e]';

  const textColorClass = isUnlimited
    ? 'text-emerald-400'
    : usagePct >= 85 || nodeData.rateLimitWarning
    ? 'text-[#ef4444]'
    : usagePct >= 60
    ? 'text-[#f97316]'
    : 'text-zinc-300';

  const costBannerStyle =
    activeOptionMeta.tier === 'local-free'
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      : activeOptionMeta.tier === 'freemium'
      ? 'bg-sky-500/10 border-sky-500/30 text-sky-200'
      : activeOptionMeta.tier === 'sub'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
      : 'bg-zinc-800/70 border-zinc-700 text-zinc-300';

  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`animate-node-appear w-full h-full min-w-[300px] min-h-[220px] rounded-2xl bg-[#1c1a22] flex flex-col min-h-0 overflow-hidden transition-shadow duration-200 relative ${
        selected
          ? 'shadow-accent-glow border border-[#ff6a3d]/70'
          : 'shadow-card border border-[#2d2a37]'
      }`}
    >
      <NodeResizer
        minWidth={300}
        minHeight={220}
        autoScale={false}
        isVisible={selected || isHovered}
        lineClassName="!border-[#ff6a3d]/60"
        handleClassName="!w-3 !h-3 !bg-[#ff6a3d] !border-2 !border-[#14121a] !rounded-full"
        onResize={(_evt, params) => {
          nodeData.onResizeNode?.(id, {
            width: Math.round(params.width),
            height: Math.round(params.height),
            x: Math.round(params.x),
            y: Math.round(params.y),
          });
        }}
        onResizeEnd={(_evt, params) => {
          nodeData.onResizeNode?.(id, {
            width: Math.round(params.width),
            height: Math.round(params.height),
            x: Math.round(params.x),
            y: Math.round(params.y),
          });
        }}
      />

      {/* Console Header (Drag Handle) */}
      <div className="console-drag-handle flex items-center justify-between px-3.5 py-2 bg-[#221f29] border-b border-[#2d2a37] cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status Indicator Dot */}
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300 ${statusInfo.dotClass}`}
            title={`Statut : ${statusInfo.label}`}
          />

          {/* Console Name or Inline Rename Input */}
          {isRenaming ? (
            <div className="flex items-center gap-1.5 nodrag">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitRename();
                  if (e.key === 'Escape') {
                    setDraftName(nodeData.label);
                    setIsRenaming(false);
                  }
                }}
                autoFocus
                className="bg-[#14121a] text-zinc-100 text-xs font-medium px-2 py-1 rounded border border-[#ff6a3d]/60 focus:outline-none"
              />
              <button
                onClick={handleCommitRename}
                className="p-1 text-emerald-400 hover:bg-zinc-800 rounded"
                title="Valider"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              onDoubleClick={() => setIsRenaming(true)}
              className="font-medium text-sm text-zinc-100 truncate"
              title="Double-cliquer pour renommer"
            >
              {nodeData.label}
            </div>
          )}

          {/* Command Pill */}
          <span className="px-2 py-0.5 text-[11px] font-mono rounded-md bg-[#14121a]/80 text-zinc-300 border border-[#2d2a37] flex items-center gap-1 shrink-0">
            <span>{selectedCmd}</span>
            {activeOptionMeta?.tier === 'local-free' && (
              <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-400 font-sans font-semibold">
                0€ PC
              </span>
            )}
            {activeOptionMeta?.tier === 'freemium' && (
              <span className="text-[9px] px-1 rounded bg-sky-500/20 text-sky-300 font-sans font-semibold">
                QUOTA 0€
              </span>
            )}
            {activeOptionMeta?.tier === 'sub' && (
              <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-sans font-semibold">
                ABO
              </span>
            )}
          </span>

          {/* Status Pill */}
          <span
            className={`px-2 py-0.5 text-[11px] font-medium rounded-full border shrink-0 ${statusInfo.badgeBg} ${statusInfo.textClass}`}
          >
            {nodeData.paused ? 'paused' : statusInfo.label}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 nodrag shrink-0">
          {!nodeData.started ? (
            <button
              onClick={() => handleStart(selectedCmd)}
              className="flex items-center gap-1.5 px-2.5 py-1 mr-0.5 rounded-lg bg-[#ff6a3d] hover:bg-[#ff7b52] text-white text-xs font-medium transition-colors"
              title={`Démarrer ${selectedCmd}`}
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Start</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleTogglePause}
                className={`p-1.5 rounded-lg transition-colors ${
                  nodeData.paused
                    ? 'bg-[#ff6a3d]/20 text-[#ff6a3d]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                }`}
                title={nodeData.paused ? 'Reprendre le flux' : 'Mettre en pause'}
              >
                {nodeData.paused ? (
                  <Play className="w-3.5 h-3.5" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                onClick={handleRestart}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 transition-colors"
                title="Arrêter / Changer de modèle IA"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              {nodeData.teamId && (
                <button
                  type="button"
                  onClick={() => {
                    // Ensure current buffer is recorded before triggering relay
                    if (ptyTurnBufferRef.current.trim().length > 5) {
                      recordAgentReply({
                        nodeId: id,
                        label: nodeData.label || 'Console',
                        commandType: selectedCmd,
                        teamId: nodeData.teamId,
                        text: ptyTurnBufferRef.current,
                        timestamp: new Date().toLocaleTimeString(),
                      });
                    }
                    window.dispatchEvent(
                      new CustomEvent('agent-canvas-relay-from-node', {
                        detail: {
                          teamId: nodeData.teamId,
                          fromNodeId: id,
                        },
                      })
                    );
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold transition-colors"
                  title="Transmettre la dernière réponse de cette IA à ses coéquipiers dans la Team"
                >
                  <Share2 className="w-3 h-3" />
                  <span>Relayer</span>
                </button>
              )}
            </>
          )}

          {/* Contextual AI Help & Commands Button (?) */}
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('agent-canvas-open-ai-help', {
                  detail: {
                    agent: selectedCmd,
                    consoleId: id,
                    consoleLabel: nodeData.label,
                  },
                })
              )
            }
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#ff6a3d]/15 hover:bg-[#ff6a3d]/30 text-[#ff6a3d] border border-[#ff6a3d]/40 text-[11px] font-semibold transition-colors"
            title={`Aide, commandes et exemples pour ${activeOptionMeta.label}`}
          >
            <HelpCircle className="w-3 h-3" />
            <span>Help</span>
          </button>

          {/* Quick Resize Buttons: Rétrécir (-) / Agrandir (+) / Grand format */}
          <div className="flex items-center bg-[#14121a]/80 border border-[#2d2a37] rounded-lg px-0.5">
            <button
              type="button"
              onClick={() => nodeData.onResizeNode?.(id, 'shrink')}
              className="px-1.5 py-0.5 text-xs font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
              title="Rétrécir la fenêtre (-)"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => nodeData.onResizeNode?.(id, 'toggle-max')}
              className="p-1 text-zinc-400 hover:text-[#ff6a3d] hover:bg-zinc-800 rounded transition-colors"
              title="Basculer Grand format / Taille standard"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => nodeData.onResizeNode?.(id, 'expand')}
              className="px-1.5 py-0.5 text-xs font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
              title="Agrandir la fenêtre (+)"
            >
              +
            </button>
          </div>

          <button
            onClick={() => setIsRenaming(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 transition-colors"
            title="Renommer la console"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => nodeData.onCloseNode?.(id)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Fermer la console"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quota & Limit Progress Bar Strip */}
      <div className="nodrag px-4 py-1.5 bg-[#191720] border-b border-[#2d2a37]/80 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <Gauge className="w-3 h-3 text-[#ff6a3d] shrink-0" />
            <span className="text-zinc-400 truncate">
              {activeOptionMeta.quotaLabel}
            </span>
            {nodeData.attentionRequired && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium animate-pulse"
                title={nodeData.attentionRequired}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                Action requise
              </span>
            )}
            {nodeData.rateLimitWarning && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 font-medium">
                <AlertTriangle className="w-2.5 h-2.5" />
                Limite atteinte
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono shrink-0">
            <span className="text-zinc-400">{promptsSent} msg</span>
            <span className="text-zinc-600">·</span>
            {isUnlimited ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <InfinityIcon className="w-3 h-3" />
                <span>
                  {(estimatedTokens / 1000).toFixed(1)}k tok (Illimité)
                </span>
              </span>
            ) : editingLimit ? (
              <input
                type="number"
                defaultValue={Math.round(tokenLimit / 1000)}
                onBlur={(e) => {
                  const val = Math.max(1, Number(e.target.value) || 45);
                  nodeData.onUpdateNode?.(id, { tokenLimit: val * 1000 });
                  setEditingLimit(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = Math.max(
                      1,
                      Number((e.target as HTMLInputElement).value) || 45
                    );
                    nodeData.onUpdateNode?.(id, { tokenLimit: val * 1000 });
                    setEditingLimit(false);
                  }
                }}
                autoFocus
                className="w-14 bg-[#14121a] border border-[#ff6a3d] rounded px-1 text-[10px] text-zinc-100"
                title="Limite en milliers de tokens (k)"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingLimit(true)}
                className={`hover:underline ${textColorClass}`}
                title="Cliquer pour ajuster le plafond d'alerte (en k tokens)"
              >
                {(estimatedTokens / 1000).toFixed(1)}k /{' '}
                {Math.round(tokenLimit / 1000)}k tok ({usagePct}%)
              </button>
            )}

            {estimatedTokens > 0 && (
              <button
                type="button"
                onClick={handleResetQuota}
                className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Remettre le compteur de session à zéro"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Visual Progress Bar Track */}
        <div className="w-full h-1.5 rounded-full bg-[#121017] overflow-hidden border border-[#2d2a37]/50">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
            style={{
              width: isUnlimited
                ? `${Math.min(100, Math.max(6, (estimatedTokens / 50000) * 100))}%`
                : `${Math.max(3, usagePct)}%`,
            }}
          />
        </div>
      </div>

      {/* Console Body: Launcher Selector OR Active xterm.js Terminal */}
      {!nodeData.started ? (
        <div className="nodrag nowheel flex-1 flex flex-col justify-between p-3 bg-[#16141c] overflow-hidden">
          {/* Category Filter Tabs */}
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                  filterMode === 'all'
                    ? 'bg-[#ff6a3d]/20 text-[#ff6a3d] border border-[#ff6a3d]/50'
                    : 'bg-[#1c1a22] text-zinc-400 hover:text-zinc-200 border border-[#2d2a37]'
                }`}
              >
                Tous ({COMMAND_OPTIONS.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('sub')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                  filterMode === 'sub'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : 'bg-[#1c1a22] text-amber-300/80 hover:text-amber-200 border border-[#2d2a37]'
                }`}
              >
                🟠 Mes Abos (Payants)
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('local')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                  filterMode === 'local'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : 'bg-[#1c1a22] text-emerald-400/80 hover:text-emerald-300 border border-[#2d2a37]'
                }`}
              >
                🟢 100% Gratuit (PC)
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('freemium')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                  filterMode === 'freemium'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50'
                    : 'bg-[#1c1a22] text-sky-300/80 hover:text-sky-200 border border-[#2d2a37]'
                }`}
              >
                🔵 Quota Cloud Gratuit
              </button>
            </div>

            {nodeData.restoredFromDisk && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/70 text-[10px] text-zinc-300 shrink-0">
                <ShieldCheck className="w-3 h-3 text-[#ff6a3d]" />
                Prêt
              </span>
            )}
          </div>

          {/* Scrollable Grid of AI Agents that expands with the card */}
          <div className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-1 flex-1 min-h-0 content-start">
            {visibleOptions.map((option) => {
              const isSelected = selectedCmd === option.id;
              const pillStyle =
                option.tier === 'local-free'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : option.tier === 'freemium'
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                  : option.tier === 'sub'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-zinc-700/30 text-zinc-300 border-zinc-600/40';
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectCommand(option.id)}
                  onDoubleClick={() => handleStart(option.id)}
                  className={`flex items-start gap-2 p-2 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-[#ff6a3d]/12 border-[#ff6a3d] shadow-[0_0_16px_-4px_rgba(255,106,61,0.35)]'
                      : 'bg-[#1c1a22] border-[#2d2a37] hover:border-zinc-600'
                  }`}
                >
                  <div className="mt-0.5 p-1 rounded-lg bg-[#14121a] border border-[#2d2a37] shrink-0">
                    {option.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-zinc-100 truncate">
                        {option.label}
                      </span>
                      <span
                        className={`text-[8px] font-semibold px-1 py-0.2 rounded border shrink-0 ${pillStyle}`}
                      >
                        {option.tierLabel}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-[#ff6a3d] truncate">
                      $ {option.subtitle}
                    </div>
                    <div className="text-[9px] text-zinc-400 truncate">
                      {option.badge}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* If Antigravity ('agy') is selected: quick 1-click sub-model picker */}
          {selectedCmd === 'agy' && (
            <div className="flex items-center gap-1 flex-wrap py-1 mt-1">
              <span className="text-[9px] font-semibold uppercase text-amber-300 shrink-0 mr-0.5">
                Modèle Agy :
              </span>
              {AGY_MODELS.map((m) => {
                const cmdStr = `agy --model ${m.id}`;
                const active =
                  customCmd.trim() === cmdStr ||
                  (!customCmd.trim() && m.id === 'gemini-4-argon-medium');
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setCustomCmd(cmdStr);
                      nodeData.onUpdateNode?.(id, { customCommand: cmdStr });
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 border transition-colors ${
                      active
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-semibold'
                        : 'bg-[#14121a] border-[#2d2a37] text-zinc-400 hover:text-zinc-200'
                    }`}
                    title={`${cmdStr} (${m.tag})`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Explicit Cost / Billing Notice Banner + Direct AI Help Button */}
          <div
            className={`mt-1.5 px-2.5 py-1 rounded-lg border text-[10px] flex items-center justify-between gap-2 ${costBannerStyle}`}
          >
            <span className="truncate font-medium">
              {activeOptionMeta.costNotice}
            </span>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('agent-canvas-open-ai-help', {
                    detail: {
                      agent: selectedCmd,
                      consoleId: id,
                      consoleLabel: nodeData.label,
                    },
                  })
                )
              }
              className="px-2 py-0.5 rounded bg-[#14121a]/80 hover:bg-[#14121a] text-zinc-100 border border-white/15 text-[9px] font-semibold shrink-0 flex items-center gap-1"
            >
              <HelpCircle className="w-2.5 h-2.5 text-[#ff6a3d]" />
              <span>Commandes & Aide</span>
            </button>
          </div>

          {/* Optional custom command override + Start button */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#2d2a37]/60 mt-1.5">
            <input
              type="text"
              value={customCmd}
              onChange={(e) => {
                setCustomCmd(e.target.value);
                nodeData.onUpdateNode?.(id, { customCommand: e.target.value });
              }}
              placeholder={`Commande libre (défaut: ${activeOptionMeta.subtitle})`}
              className="flex-1 bg-[#14121a] border border-[#2d2a37] focus:border-[#ff6a3d] rounded-lg px-2.5 py-1 text-[11px] font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleStart(selectedCmd)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] text-white font-medium text-xs shadow-[0_0_20px_-3px_rgba(255,106,61,0.55)] transition-all cursor-pointer shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start {selectedCmd}</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className="nodrag nowheel flex-1 min-h-0 w-full bg-[#16141c] p-2.5 overflow-hidden relative"
          onClick={() => xtermRef.current?.focus()}
        >
          <div ref={terminalContainerRef} className="w-full h-full min-h-0 overflow-hidden" />
          {nodeData.paused && (
            <div className="absolute inset-0 bg-[#14121a]/70 backdrop-blur-[2px] flex items-center justify-center z-10">
              <div className="px-4 py-2 rounded-xl bg-[#1c1a22] border border-[#ff6a3d]/50 flex items-center gap-2.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-[#f97316] animate-pulse" />
                <span className="text-xs font-medium text-zinc-200">
                  Terminal en pause
                </span>
                <button
                  onClick={handleTogglePause}
                  className="ml-2 px-2.5 py-1 rounded-lg bg-[#ff6a3d] text-white text-xs font-medium hover:bg-[#ff7b52]"
                >
                  Reprendre
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
