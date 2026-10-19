import { ChatTurn, transcribeAudioWithAi } from './webAiClient';

export interface AgentReplyRecord {
  nodeId: string;
  label: string;
  commandType: string;
  teamId?: string;
  text: string;
  timestamp: string;
}

export interface InterAgentMessage {
  id: string;
  teamId: string;
  fromNodeId: string;
  fromLabel: string;
  fromCommandType: string;
  toNodeId: string;
  toLabel: string;
  summaryText: string;
  timestamp: string;
}

const ACTIVE_CONSOLES_STORAGE_KEY = 'agent-canvas:active-consoles:v1';

// Module-level caches so remounting a ConsoleNode (e.g., grouping into a Team) never wipes the terminal
const terminalScrollbackCache = new Map<string, string>();
const webChatHistoryCache = new Map<string, ChatTurn[]>();
const latestReplyByNode = new Map<string, AgentReplyRecord>();
const teamMessagesByTeam = new Map<string, InterAgentMessage[]>();
const activeStartedConsoles = new Set<string>();

// Hydrate activeStartedConsoles from sessionStorage (survives Vite HMR / page refresh in same tab)
try {
  const raw = sessionStorage.getItem(ACTIVE_CONSOLES_STORAGE_KEY);
  if (raw) {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.forEach((id) => {
        if (typeof id === 'string') activeStartedConsoles.add(id);
      });
    }
  }
} catch (_) {}

function persistActiveSet() {
  try {
    sessionStorage.setItem(
      ACTIVE_CONSOLES_STORAGE_KEY,
      JSON.stringify(Array.from(activeStartedConsoles))
    );
  } catch (_) {}
}

export function markConsoleStarted(nodeId: string, started: boolean) {
  if (started) {
    activeStartedConsoles.add(nodeId);
  } else {
    activeStartedConsoles.delete(nodeId);
  }
  persistActiveSet();
}

export function wasConsoleStartedInSession(nodeId: string): boolean {
  return activeStartedConsoles.has(nodeId);
}

export function appendTerminalScrollback(nodeId: string, chunk: string) {
  const prev = terminalScrollbackCache.get(nodeId) || '';
  const next = (prev + chunk).slice(-48000);
  terminalScrollbackCache.set(nodeId, next);
}

export function getTerminalScrollback(nodeId: string): string {
  return terminalScrollbackCache.get(nodeId) || '';
}

export function clearTerminalScrollback(nodeId: string) {
  terminalScrollbackCache.delete(nodeId);
}

export function getCachedWebChatHistory(nodeId: string): ChatTurn[] {
  let hist = webChatHistoryCache.get(nodeId);
  if (!hist) {
    hist = [];
    webChatHistoryCache.set(nodeId, hist);
  }
  return hist;
}

export function clearCachedWebChatHistory(nodeId: string) {
  webChatHistoryCache.set(nodeId, []);
}

export function sanitizeTerminalOutputForRelay(rawText: string): string {
  return rawText
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)?/g, '')
    .replace(/(^|\s)\]\d;[^\s\x07]*\x07?/g, '$1')
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/>>> Send a message \(.*?\)/gi, '')
    .replace(/>>>\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function recordAgentReply(record: AgentReplyRecord) {
  const cleaned = sanitizeTerminalOutputForRelay(record.text);
  if (cleaned.length < 8) return;

  const entry: AgentReplyRecord = {
    ...record,
    text: cleaned.slice(-8000),
  };
  latestReplyByNode.set(record.nodeId, entry);

  window.dispatchEvent(
    new CustomEvent('agent-canvas-agent-reply-recorded', {
      detail: entry,
    })
  );
}

export function getLatestAgentReply(nodeId: string): AgentReplyRecord | undefined {
  return latestReplyByNode.get(nodeId);
}

export function getTeamSharedContextSummary(
  teamId: string | undefined,
  excludeNodeId?: string
): string {
  if (!teamId) return '';
  const items: string[] = [];
  for (const rec of latestReplyByNode.values()) {
    if (rec.teamId === teamId && rec.nodeId !== excludeNodeId) {
      items.push(
        `- Coéquipier ${rec.label} (${rec.commandType}) à ${rec.timestamp} : "${rec.text.slice(
          0,
          450
        )}"`
      );
    }
  }
  return items.join('\n');
}

export function recordInterAgentMessage(msg: InterAgentMessage) {
  const list = teamMessagesByTeam.get(msg.teamId) || [];
  // Ignore an identical message recorded twice in a row (React StrictMode runs state updaters twice).
  const recent = list.slice(0, 8);
  if (
    recent.some(
      (m) =>
        m.fromNodeId === msg.fromNodeId &&
        m.toNodeId === msg.toNodeId &&
        m.summaryText === msg.summaryText &&
        m.timestamp === msg.timestamp
    )
  ) {
    return;
  }
  const next = [msg, ...list].slice(0, 20);
  teamMessagesByTeam.set(msg.teamId, next);
  window.dispatchEvent(
    new CustomEvent('agent-canvas-team-bus-updated', {
      detail: { teamId: msg.teamId, message: msg },
    })
  );
}

export function getTeamInterAgentMessages(teamId: string): InterAgentMessage[] {
  return teamMessagesByTeam.get(teamId) || [];
}

/**
 * Formats a prompt to be safely injected into both Web terminals and Electron PTY CLIs
 * (collapses newlines so interactive CLIs like Ollama / Claude don't submit 10 partial lines).
 */
export function formatTeammateRelayPrompt(
  fromLabel: string,
  fromCmd: string,
  replyText: string,
  customInstruction?: string
): string {
  const cleanExcerpt = sanitizeTerminalOutputForRelay(replyText).slice(0, 1600);
  const instruction =
    customInstruction ||
    'Analyse la proposition de ton coéquipier, complète-la, corrige les erreurs éventuelles et poursuis le travail.';
  return `[Coéquipier ${fromLabel} (${fromCmd})] m'a transmis : "${cleanExcerpt}" — ${instruction}`;
}

export interface AiEngineProfile {
  id: string;
  label: string;
  specialtyBadge: string;
  shortDomain: string;
  roleTitle: string;
  bestAtSummary: string;
  defaultFocus: string;
  affinity: {
    code: number;
    textReading: number;
    deepReasoning: number;
    terminalCommands: number;
    apiAndDatabase: number;
  };
}

export const AI_ENGINE_PROFILES: Record<string, AiEngineProfile> = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    specialtyBadge: '⚡ Code & Archi',
    shortDomain: 'Code pur, Architecture & Backend',
    roleTitle: 'Spécialiste Code & Backend',
    bestAtSummary: 'Code complexe, refactoring, TypeScript/React, logique métier',
    defaultFocus:
      'Conçois et écris le code source principal, l’architecture logicielle, les types et la logique métier backend. Reste concentré sur un code propre et structuré.',
    affinity: { code: 99, textReading: 65, deepReasoning: 85, terminalCommands: 30, apiAndDatabase: 85 },
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini CLI',
    specialtyBadge: '📖 Lecture & Doc',
    shortDomain: 'Lecture, Analyse & Rédaction',
    roleTitle: 'Spécialiste Lecture, Doc & Explications',
    bestAtSummary: 'Lecture de documents longs, synthèses, documentation technique et vulgarisation',
    defaultFocus:
      'Lis, analyse et résume les textes, spécifications, documentations et exigences. Rédige les explications pédagogiques, synthèses et guides utilisateurs.',
    affinity: { code: 65, textReading: 99, deepReasoning: 80, terminalCommands: 20, apiAndDatabase: 60 },
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek R1',
    specialtyBadge: '🧠 Raisonnement & Sécurité',
    shortDomain: 'Raisonnement logique, Failles & Cas Limites',
    roleTitle: 'Spécialiste Raisonnement, Audit & Sécurité',
    bestAtSummary: 'Audit de sécurité, failles, algorithmique poussée et cas limites',
    defaultFocus:
      'Traite les problèmes logiques complexes, les cas limites, l’audit de sécurité, la détection des failles et les optimisations mathématiques/algorithmiques.',
    affinity: { code: 88, textReading: 60, deepReasoning: 99, terminalCommands: 25, apiAndDatabase: 70 },
  },
  codex: {
    id: 'codex',
    label: 'Codex CLI',
    specialtyBadge: '🌐 APIs & BDD',
    shortDomain: 'APIs, Base de Données & Intégration',
    roleTitle: 'Spécialiste Intégration & APIs',
    bestAtSummary: 'APIs REST/GraphQL, bases de données, requêtes et intégration système',
    defaultFocus:
      'Développe l’intégration des APIs externes, les modèles de données (BDD/SQL), les endpoints et l’interfaçage système.',
    affinity: { code: 92, textReading: 65, deepReasoning: 80, terminalCommands: 35, apiAndDatabase: 98 },
  },
  shell: {
    id: 'shell',
    label: 'System Shell',
    specialtyBadge: '💻 Commandes & Tests',
    shortDomain: 'Commandes Système & Tests CLI',
    roleTitle: 'Spécialiste Commandes, Build & Tests',
    bestAtSummary: 'Commandes shell réelles, exécution de scripts, build et tests système',
    defaultFocus:
      'Prépare et exécute les commandes terminal réelles, scripts de build (npm build, git, docker), installation de packages et tests automatisés.',
    affinity: { code: 20, textReading: 15, deepReasoning: 20, terminalCommands: 100, apiAndDatabase: 30 },
  },
  kimi: {
    id: 'kimi',
    label: 'Kimi K2',
    specialtyBadge: '📄 Grands Documents',
    shortDomain: 'Extraction Grands Documents & Veille',
    roleTitle: 'Spécialiste Documents & Veille',
    bestAtSummary: 'Extraction d’informations dans de volumineux textes et documents',
    defaultFocus:
      'Analyse les documents volumineux, extrait les informations clés et les spécifications techniques complexes.',
    affinity: { code: 60, textReading: 97, deepReasoning: 75, terminalCommands: 20, apiAndDatabase: 55 },
  },
  qwen: {
    id: 'qwen',
    label: 'Qwen Coder',
    specialtyBadge: '⚡ Code Rapide',
    shortDomain: 'Composants & Scripts Rapides',
    roleTitle: 'Spécialiste Composants & Scripts',
    bestAtSummary: 'Développement rapide de fonctions utilitaires et tests modulaires',
    defaultFocus:
      'Produit rapidement les fonctions utilitaires, scripts légers, tests unitaires et composants modulaires.',
    affinity: { code: 88, textReading: 55, deepReasoning: 75, terminalCommands: 30, apiAndDatabase: 75 },
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama Local',
    specialtyBadge: '🔒 Local Offline',
    shortDomain: 'Traitement Local & Privacy',
    roleTitle: 'Spécialiste Code Local Offline',
    bestAtSummary: 'Exécution locale 100% hors-ligne et sans fuite de données',
    defaultFocus:
      'Prend en charge le code local, le traitement sans connexion Internet et les fonctions utilitaires.',
    affinity: { code: 80, textReading: 60, deepReasoning: 70, terminalCommands: 30, apiAndDatabase: 70 },
  },
  agy: {
    id: 'agy',
    label: 'Antigravity (Argon 4)',
    specialtyBadge: '👑 Plan & Archi',
    shortDomain: 'Architecture Globale & Planification',
    roleTitle: 'Spécialiste Architecture Globale & Plan',
    bestAtSummary: 'Vision globale, roadmap d’implémentation et supervision',
    defaultFocus:
      'Définit le plan d’ensemble, la stratégie d’architecture technique, les contrats d’interfaces et supervise la cohérence du projet.',
    affinity: { code: 90, textReading: 80, deepReasoning: 90, terminalCommands: 40, apiAndDatabase: 85 },
  },
  aider: {
    id: 'aider',
    label: 'Aider Pair',
    specialtyBadge: '🔧 Pair-Programming',
    shortDomain: 'Pair-Programming & Diffs',
    roleTitle: 'Spécialiste Pair-Programming & Diffs',
    bestAtSummary: 'Diffs précis, modifications ciblées de fichiers existants',
    defaultFocus:
      'Effectue les modifications chirurgicales, les diffs de code et les ajustements de fichiers existants.',
    affinity: { code: 87, textReading: 55, deepReasoning: 75, terminalCommands: 40, apiAndDatabase: 70 },
  },
  opencode: {
    id: 'opencode',
    label: 'OpenCode',
    specialtyBadge: '🔧 Pair-Programming',
    shortDomain: 'Pair-Programming & Diffs',
    roleTitle: 'Spécialiste Pair-Programming & Diffs',
    bestAtSummary: 'Diffs précis, modifications ciblées de fichiers existants',
    defaultFocus:
      'Effectue les modifications chirurgicales, les diffs de code et les ajustements de fichiers existants.',
    affinity: { code: 87, textReading: 55, deepReasoning: 75, terminalCommands: 40, apiAndDatabase: 70 },
  },
};

export function getAiEngineProfile(commandType: string): AiEngineProfile {
  return (
    AI_ENGINE_PROFILES[commandType] || {
      id: commandType,
      label: commandType.toUpperCase(),
      specialtyBadge: '🤖 IA Polyvalente',
      shortDomain: 'Assistance générale & Code',
      roleTitle: 'Agent Spécialiste',
      bestAtSummary: 'Assistance générale & Exécution de tâches',
      defaultFocus: 'Réalise la tâche demandée avec méthode et précision.',
      affinity: { code: 70, textReading: 70, deepReasoning: 70, terminalCommands: 30, apiAndDatabase: 70 },
    }
  );
}

export function analyzeTaskProfile(taskText: string) {
  const t = taskText.toLowerCase();

  let codeW = 0.5;
  let textW = 0.5;
  let reasonW = 0.5;
  let termW = 0.2;
  let apiW = 0.4;

  // Reading / Text / Documentation / Synthesis detection
  if (
    /(?:lire|lecture|texte|résum|document|cahier\s+des\s+charges|spec|pdf|comprendre|expliqu|synth|tradui|recherche|guide|tuto|article|redaction|rédiger|client|brief)/.test(
      t
    )
  ) {
    textW += 4.5;
  }
  // Code / Implementation / Architecture detection
  if (
    /(?:code|coder|fonction|classe|class|refactor|typescript|javascript|python|react|backend|frontend|composant|component|développ|écrire\s+le\s+code|src\/|bug|fix|hook|vue|html|css)/.test(
      t
    )
  ) {
    codeW += 4.5;
  }
  // Security / Logic / Edge Cases detection
  if (
    /(?:sécurité|securite|faille|audit|raisonn|cas\s+limite|edge\s+case|optimis|math|complexe|logique|valid|véri|algorithme|preuve|challenge|attaque|vulnérabilit)/.test(
      t
    )
  ) {
    reasonW += 4.5;
  }
  // Terminal / Shell / Build / Tests execution detection
  if (
    /(?:terminal|commande|shell|powershell|bash|npm|yarn|pnpm|git|docker|build|test\s+unit|tests|lint|script\s+de\s+build|exécut|lancer|install|setup|cli)/.test(
      t
    )
  ) {
    termW += 5.0;
  }
  // API & Database / Endpoint detection
  if (
    /(?:api|endpoint|rest|graphql|bdd|sql|database|données|postgres|mongo|json|schéma|schema|fetch|axios|serveur|route|crud)/.test(
      t
    )
  ) {
    apiW += 3.5;
  }

  return { code: codeW, textReading: textW, deepReasoning: reasonW, terminalCommands: termW, apiAndDatabase: apiW };
}

export function computeAgentTaskAffinity(
  commandType: string,
  taskText: string
): { score: number; reason: string } {
  const prof = getAiEngineProfile(commandType);
  const weights = analyzeTaskProfile(taskText);

  const raw =
    prof.affinity.code * weights.code +
    prof.affinity.textReading * weights.textReading +
    prof.affinity.deepReasoning * weights.deepReasoning +
    prof.affinity.terminalCommands * weights.terminalCommands +
    prof.affinity.apiAndDatabase * weights.apiAndDatabase;

  const maxPossible =
    100 *
    (weights.code +
      weights.textReading +
      weights.deepReasoning +
      weights.terminalCommands +
      weights.apiAndDatabase);

  const normalized = Math.min(
    99,
    Math.max(45, Math.round((raw / (maxPossible || 1)) * 100))
  );

  const contributions = [
    { name: 'Lecture & Documentation', val: prof.affinity.textReading * weights.textReading },
    { name: 'Code & Logique', val: prof.affinity.code * weights.code },
    { name: 'Raisonnement & Sécurité', val: prof.affinity.deepReasoning * weights.deepReasoning },
    { name: 'Commandes Terminal & Tests', val: prof.affinity.terminalCommands * weights.terminalCommands },
    { name: 'APIs & Données', val: prof.affinity.apiAndDatabase * weights.apiAndDatabase },
  ].sort((a, b) => b.val - a.val);

  const bestDomain = contributions[0]?.name || prof.shortDomain;
  const reason = `Spécialiste ${bestDomain} (${prof.bestAtSummary})`;

  return { score: normalized, reason };
}

export interface SplitTaskAssignment {
  nodeId: string;
  label: string;
  commandType: string;
  roleTitle: string;
  specialtyBadge: string;
  matchReason: string;
  affinityScore: number;
  subTaskDescription: string;
  promptToSend: string;
}

export interface TeamPlanningMember {
  id: string;
  label: string;
  commandType: string;
}

export function buildProjectPlanningPrompt(
  rawPrompt: string,
  members: TeamPlanningMember[]
): string {
  const roster = members
    .map(
      (member, index) =>
        `${index + 1}. id=${member.id}; nom=${member.label}; IA=${member.commandType}; spécialité=${getAiEngineProfile(member.commandType).bestAtSummary}`
    )
    .join('\n');

  return `[PLANIFICATION D'ÉQUIPE — TU ES LE CHEF DE PROJET]
Mission utilisateur : "${rawPrompt.trim()}"

Membres disponibles :
${roster}

Découpe la mission en tâches concrètes, complémentaires et aussi indépendantes que possible. Attribue une tâche à chaque membre en tenant compte de sa spécialité. Précise les dépendances et le résultat attendu pour chaque tâche. Ne commence pas à résoudre la mission : les autres agents vont exécuter le plan, puis tu assembleras leurs résultats.

Réponds uniquement avec un objet JSON valide, sans balise Markdown, selon ce format exact :
{"tasks":[{"agentId":"ID exact fourni ci-dessus","task":"Tâche précise avec résultat attendu et dépendances"}]}
Inclue exactement une tâche par membre et conserve leurs identifiants à l'identique.`;
}

export function parseProjectTaskPlan(
  replyText: string,
  members: TeamPlanningMember[]
): Map<string, string> | null {
  const text = sanitizeTerminalOutputForRelay(replyText);
  const validIds = new Set(members.map((member) => member.id));

  // Parse balanced JSON objects one by one so echoed prompts or fenced examples
  // cannot invalidate the actual plan that follows them.
  for (let start = text.indexOf('{'); start >= 0; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let end = start; end < text.length; end++) {
      const char = text[end];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth !== 0) continue;

        try {
          const parsed = JSON.parse(text.slice(start, end + 1));
          if (!Array.isArray(parsed?.tasks)) break;

          const plan = new Map<string, string>();
          for (const task of parsed.tasks) {
            if (
              task &&
              typeof task.agentId === 'string' &&
              validIds.has(task.agentId) &&
              typeof task.task === 'string' &&
              task.task.trim().length >= 8 &&
              !plan.has(task.agentId)
            ) {
              plan.set(task.agentId, task.task.trim().slice(0, 1600));
            }
          }
          if (plan.size > 0) return plan;
        } catch (_) {}
        break;
      }
    }
  }

  return null;
}

export function getSpecialistRoleForIndex(
  index: number,
  total: number,
  commandType: string
): { roleTitle: string; defaultFocus: string; specialtyBadge: string } {
  const prof = getAiEngineProfile(commandType);
  return {
    roleTitle: `Partie ${index + 1} · ${prof.shortDomain}`,
    defaultFocus: prof.defaultFocus,
    specialtyBadge: prof.specialtyBadge,
  };
}

/**
 * Automatically splits a user mission across all teammates so they work in parallel 2x-4x faster,
 * with AUTO-SELECTION of the BEST AI for each task based on its strengths (e.g. Claude for code, Gemini for text/reading, DeepSeek for security/reasoning, Shell for commands).
 */
export function buildSplitTaskAssignments(
  rawPrompt: string,
  members: { id: string; label: string; commandType: string }[]
): SplitTaskAssignment[] {
  const cleanedPrompt = rawPrompt.trim();
  const count = members.length;
  if (count === 0) return [];

  // Check if the user wrote explicit sub-parts separated by ";" or "|" or multiple numbered lines
  const explicitParts = cleanedPrompt
    .split(/(?:\r?\n)+|(?:\s*;\s*)|(?:\s*\|\s*)/)
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((s) => s.length > 3);

  const hasExplicitParts = explicitParts.length >= 2;

  // Case 1: Explicit sub-tasks provided -> Match each task to the AI with the highest affinity!
  if (hasExplicitParts) {
    const taskPool: string[] = [...explicitParts];
    while (taskPool.length < count) {
      taskPool.push(
        `Support & vérification croisée de : "${explicitParts[taskPool.length % explicitParts.length]}"`
      );
    }

    // Maximum weight matching: sort all member-task pairs by affinity score descending
    const allPairs: {
      memberIdx: number;
      taskIdx: number;
      score: number;
      reason: string;
    }[] = [];

    for (let mIdx = 0; mIdx < count; mIdx++) {
      const m = members[mIdx];
      for (let tIdx = 0; tIdx < taskPool.length; tIdx++) {
        const { score, reason } = computeAgentTaskAffinity(
          m.commandType,
          taskPool[tIdx]
        );
        allPairs.push({ memberIdx: mIdx, taskIdx: tIdx, score, reason });
      }
    }
    allPairs.sort((a, b) => b.score - a.score);

    const assignedMembers = new Set<number>();
    const assignedTasks = new Set<number>();
    const assignmentsByMemberId = new Map<
      string,
      { taskText: string; score: number; reason: string }
    >();

    for (const pair of allPairs) {
      if (
        !assignedMembers.has(pair.memberIdx) &&
        !assignedTasks.has(pair.taskIdx)
      ) {
        assignedMembers.add(pair.memberIdx);
        assignedTasks.add(pair.taskIdx);
        const m = members[pair.memberIdx];
        assignmentsByMemberId.set(m.id, {
          taskText: taskPool[pair.taskIdx],
          score: pair.score,
          reason: pair.reason,
        });
      }
      if (assignedMembers.size === count) break;
    }

    // Fallback if any member was unmatched
    for (let mIdx = 0; mIdx < count; mIdx++) {
      const m = members[mIdx];
      if (!assignmentsByMemberId.has(m.id)) {
        const fallbackTask = taskPool[mIdx % taskPool.length];
        const { score, reason } = computeAgentTaskAffinity(
          m.commandType,
          fallbackTask
        );
        assignmentsByMemberId.set(m.id, {
          taskText: fallbackTask,
          score,
          reason,
        });
      }
    }

    return members.map((member, idx) => {
      const prof = getAiEngineProfile(member.commandType);
      const match = assignmentsByMemberId.get(member.id)!;
      const otherNames = members
        .filter((m) => m.id !== member.id)
        .map((m) => m.label)
        .join(', ');

      const roleTitle = `Spécialiste ${prof.shortDomain}`;
      const subTaskDescription = `Traite exclusivement cette tâche qui correspond à ton super-pouvoir d'IA : "${match.taskText}"`;

      const promptToSend = `[RÉPARTITION INTELLIGENTE PAR SPÉCIALITÉ (${idx + 1}/${count}) · ${prof.specialtyBadge}] Tu as été sélectionné automatiquement comme la meilleure IA de l'équipe pour cette tâche (${match.reason} · Affinité : ${match.score}%). Mission globale : "${cleanedPrompt}". Pour aller ${count}x plus vite, tes coéquipiers (${otherNames}) réalisent les autres parties en simultané. TON RÔLE EXCLUSIF : ${subTaskDescription}. Va droit au but et produis uniquement ta partie.`;

      return {
        nodeId: member.id,
        label: member.label,
        commandType: member.commandType,
        roleTitle,
        specialtyBadge: prof.specialtyBadge,
        matchReason: match.reason,
        affinityScore: match.score,
        subTaskDescription,
        promptToSend,
      };
    });
  }

  // Case 2: Unified broad mission -> Generate complementary roles tailored to the actual AI engines in the team
  return members.map((member, idx) => {
    const prof = getAiEngineProfile(member.commandType);
    const otherNames = members
      .filter((m) => m.id !== member.id)
      .map((m) => m.label)
      .join(', ');

    const subTaskDescription = `${prof.defaultFocus} (en cohérence avec la mission : "${cleanedPrompt}").`;
    const roleTitle = `Partie ${idx + 1} · ${prof.roleTitle}`;

    const promptToSend = `[RÉPARTITION INTELLIGENTE PAR SPÉCIALITÉ (${idx + 1}/${count}) · ${prof.specialtyBadge}] Tu as été sélectionné automatiquement comme la meilleure IA de l'équipe pour cette partie (${prof.bestAtSummary}). Mission globale : "${cleanedPrompt}". Pour aller ${count}x plus vite, tes coéquipiers (${otherNames}) réalisent les autres parties en simultané. TON RÔLE EXCLUSIF : ${subTaskDescription} Va droit au but et produis uniquement ta partie.`;

    return {
      nodeId: member.id,
      label: member.label,
      commandType: member.commandType,
      roleTitle,
      specialtyBadge: prof.specialtyBadge,
      matchReason: `Super-pouvoir : ${prof.bestAtSummary}`,
      affinityScore: 98,
      subTaskDescription,
      promptToSend,
    };
  });
}

export function formatTeamSynthesisPrompt(
  originalBrief: string,
  parts: { label: string; commandType: string; text: string }[]
): string {
  const joined = parts
    .map(
      (p, i) =>
        `[Partie ${i + 1} par ${p.label} (${p.commandType})] : "${sanitizeTerminalOutputForRelay(
          p.text
        ).slice(0, 5000)}"`
    )
    .join(' | ');
  return `[SYNTHÈSE FINALE D'ÉQUIPE — TU ES LE CHEF DE PROJET ET TU RÉPONDS SEUL À L'UTILISATEUR]
Mission initiale : "${originalBrief}"

Travaux transmis par les agents de l'équipe : ${joined}

Ta mission : vérifie la cohérence des contributions, résous les contradictions, combine les résultats utiles et réponds directement à la demande initiale avec un résultat complet et exploitable. Ne renvoie pas une simple liste de réponses d'agents. Si une partie manque ou est incertaine, indique-le clairement sans inventer. Ta réponse est le livrable final destiné à l'utilisateur.`;
}

// -------------------------------------------------------------
// 1. KNOWLEDGE MEMORY STORE (Facts & Insights discovered by Agents)
// -------------------------------------------------------------
export interface LearnedFact {
  id: string;
  teamId?: string;
  authorLabel: string;
  authorCommand: string;
  category: 'file' | 'decision' | 'bug' | 'api' | 'note';
  title: string;
  content: string;
  timestamp: string;
}

const LEARNED_FACTS_STORAGE_KEY = 'agent-canvas:learned-facts:v1';
const learnedFactsList: LearnedFact[] = [];

// Hydrate from localStorage
try {
  const raw = localStorage.getItem(LEARNED_FACTS_STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      learnedFactsList.push(...parsed);
    }
  }
} catch (_) {}

function persistFacts() {
  try {
    localStorage.setItem(LEARNED_FACTS_STORAGE_KEY, JSON.stringify(learnedFactsList));
  } catch (_) {}
}

export function recordLearnedFact(fact: Omit<LearnedFact, 'id' | 'timestamp'>): LearnedFact {
  const newFact: LearnedFact = {
    ...fact,
    id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };
  learnedFactsList.unshift(newFact);
  if (learnedFactsList.length > 50) learnedFactsList.pop();
  persistFacts();
  window.dispatchEvent(new CustomEvent('agent-canvas-facts-updated', { detail: newFact }));
  return newFact;
}

export function getLearnedFacts(teamId?: string): LearnedFact[] {
  if (!teamId) return [...learnedFactsList];
  return learnedFactsList.filter((f) => !f.teamId || f.teamId === teamId);
}

export function deleteLearnedFact(factId: string) {
  const idx = learnedFactsList.findIndex((f) => f.id === factId);
  if (idx !== -1) {
    learnedFactsList.splice(idx, 1);
    persistFacts();
    window.dispatchEvent(new CustomEvent('agent-canvas-facts-updated'));
  }
}

export function clearAllLearnedFacts() {
  learnedFactsList.length = 0;
  persistFacts();
  window.dispatchEvent(new CustomEvent('agent-canvas-facts-updated'));
}

// -------------------------------------------------------------
// 2. GLOBAL TERMINAL SCROLLBACK SEARCH (Cross-Agent Ctrl+F)
// -------------------------------------------------------------
export interface TerminalSearchMatch {
  nodeId: string;
  label: string;
  commandType: string;
  line: string;
  lineNumber: number;
  preview: string;
}

export function searchAllTerminalScrollbacks(
  query: string,
  metaByNodeId: Map<string, { label: string; commandType: string }>
): TerminalSearchMatch[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) return [];

  const results: TerminalSearchMatch[] = [];

  for (const [nodeId, rawScrollback] of terminalScrollbackCache.entries()) {
    const meta = metaByNodeId.get(nodeId) || { label: 'Console', commandType: 'agent' };
    const cleanText = sanitizeTerminalOutputForRelay(rawScrollback);
    const lines = cleanText.split('\n');

    lines.forEach((lineText, idx) => {
      const lower = lineText.toLowerCase();
      if (lower.includes(trimmed)) {
        results.push({
          nodeId,
          label: meta.label,
          commandType: meta.commandType,
          line: lineText.trim(),
          lineNumber: idx + 1,
          preview: lineText.trim().slice(0, 180),
        });
      }
    });
  }

  return results.slice(0, 40);
}

// -------------------------------------------------------------
// 3. WEB AUDIO SOUND EFFECTS (Subtle Chimes & Audio Feedback)
// -------------------------------------------------------------
let audioCtx: AudioContext | null = null;
const AUDIO_ENABLED_STORAGE_KEY = 'agent-canvas:audio-enabled:v1';
let audioEnabled = (() => {
  try {
    return localStorage.getItem(AUDIO_ENABLED_STORAGE_KEY) !== 'false';
  } catch (_) {
    return true;
  }
})();

export function isAudioEnabled(): boolean {
  return audioEnabled;
}

export function setAudioEnabled(enabled: boolean) {
  audioEnabled = enabled;
  try {
    localStorage.setItem(AUDIO_ENABLED_STORAGE_KEY, String(enabled));
  } catch (_) {}
}

export function playCanvasSound(type: 'success' | 'alert' | 'relay' | 'complete') {
  if (!audioEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContextClass();

    const schedule = () => {
      if (!audioCtx || audioCtx.state !== 'running') return;
      const now = audioCtx.currentTime;

      if (type === 'success') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.14); // A5
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'relay') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'complete') {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc1.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc2.frequency.setValueAtTime(1046.5, now + 0.2); // C6
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        osc1.start(now);
        osc2.start(now + 0.2);
        osc1.stop(now + 0.45);
        osc2.stop(now + 0.45);
      } else if (type === 'alert') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.setValueAtTime(240, now + 0.12);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      }
    };

    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().then(schedule).catch(() => {});
    } else {
      schedule();
    }
  } catch (_) {}
}

// -------------------------------------------------------------
// 4. SPEECH-TO-TEXT VOICE DICTATION HELPER (French / Multi)
// -------------------------------------------------------------
export interface VoiceDictationController {
  stop: () => void;
  isListening: boolean;
}

export interface VoiceDictationCallbacks {
  onTranscript: (finalText: string, interimText: string) => void;
  onAudioLevel?: (level: number) => void; // 0 to 100% volume
  onEnd: () => void;
  onError: (err: string) => void;
  onStatusChange?: (
    status:
      | 'requesting_permission'
      | 'listening'
      | 'recording_fallback'
      | 'transcribing'
      | 'idle'
  ) => void;
}

export function startVoiceDictation(
  callbacks: VoiceDictationCallbacks
): VoiceDictationController | null {
  const SpeechRec =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  let isIntentionallyStopped = false;
  let isFallbackRecording = false;
  let recognition: any = null;
  let restartTimeout: any = null;
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let recorderMime = 'audio/webm';
  let analyserInterval: any = null;
  let finalAccumulated = '';

  const cleanupAudioMeter = () => {
    if (analyserInterval) {
      clearInterval(analyserInterval);
      analyserInterval = null;
    }
    if (audioContext) {
      try {
        audioContext.close();
      } catch (_) {}
      audioContext = null;
    }
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      mediaStream = null;
    }
    callbacks.onAudioLevel?.(0);
  };

  const startAudioMeter = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      callbacks.onStatusChange?.('requesting_permission');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (isIntentionallyStopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaStream = stream;

      // Universal MediaRecorder backup for Brave / adblockers / offline fallback
      if (typeof MediaRecorder !== 'undefined') {
        try {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            recorderMime = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            recorderMime = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            recorderMime = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            recorderMime = 'audio/ogg';
          }

          const recorder = new MediaRecorder(stream, { mimeType: recorderMime });
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              audioChunks.push(e.data);
            }
          };
          recorder.start(200);
          mediaRecorder = recorder;
        } catch (_) {}
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyserInterval = setInterval(() => {
          if (isIntentionallyStopped) return;
          try {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const level = Math.min(100, Math.round((avg / 128) * 100));
            callbacks.onAudioLevel?.(level);
          } catch (_) {}
        }, 80);
      }
    } catch (mediaErr: any) {
      if (mediaErr?.name === 'NotAllowedError' || mediaErr?.name === 'PermissionDeniedError') {
        callbacks.onError('Microphone bloqué dans le navigateur. Cliquez sur l’icône cadenas à gauche de l’adresse URL pour l’autoriser.');
        isIntentionallyStopped = true;
        callbacks.onEnd();
        return;
      }
    }
  };

  // Start the live audio level meter and recorder
  startAudioMeter();

  if (!SpeechRec) {
    isFallbackRecording = true;
    callbacks.onStatusChange?.('recording_fallback');
  } else {
    try {
      recognition = new SpeechRec();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (!isFallbackRecording) {
          callbacks.onStatusChange?.('listening');
        }
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            finalAccumulated = finalAccumulated
              ? `${finalAccumulated} ${text.trim()}`
              : text.trim();
          } else {
            interim += text;
          }
        }
        callbacks.onTranscript(finalAccumulated, interim.trim());
      };

      recognition.onerror = (evt: any) => {
        const error = evt?.error;

        // Normal silence event in Chromium, ignore
        if (error === 'no-speech') {
          return;
        }

        if (error === 'not-allowed') {
          isIntentionallyStopped = true;
          callbacks.onError('Accès microphone refusé. Autorisez le micro via l’icône cadenas dans la barre d’adresse.');
          cleanupAudioMeter();
          callbacks.onEnd();
          return;
        }

        // Brave Browser / Adblockers block Google Speech API websocket endpoints by default:
        // Do NOT shut off the microphone! Switch seamlessly to MediaRecorder + AI dictation
        if (error === 'network' || error === 'service-not-allowed') {
          isFallbackRecording = true;
          callbacks.onStatusChange?.('recording_fallback');
          return;
        }
      };

      recognition.onend = () => {
        if (isIntentionallyStopped || isFallbackRecording) {
          return;
        }

        // Auto-restart loop to keep microphone alive over pauses in standard Chrome
        clearTimeout(restartTimeout);
        restartTimeout = setTimeout(() => {
          if (!isIntentionallyStopped && !isFallbackRecording) {
            try {
              recognition.start();
            } catch (_) {}
          }
        }, 150);
      };

      recognition.start();
    } catch (_) {
      isFallbackRecording = true;
      callbacks.onStatusChange?.('recording_fallback');
    }
  }

  const handleStopAndTranscribe = async () => {
    isIntentionallyStopped = true;
    clearTimeout(restartTimeout);

    try {
      recognition?.stop();
    } catch (_) {}
    try {
      recognition?.abort();
    } catch (_) {}

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch (_) {}
    }

    cleanupAudioMeter();

    // If native speech recognition provided text, we are already done!
    if (finalAccumulated.trim()) {
      callbacks.onStatusChange?.('idle');
      callbacks.onEnd();
      return;
    }

    // Otherwise, check if we recorded audio chunks for AI transcription fallback
    // Wait brief moment for the recorder's final data chunk
    await new Promise((r) => setTimeout(r, 150));

    const totalBytes = audioChunks.reduce((acc, c) => acc + c.size, 0);
    if (totalBytes < 1200) {
      // Too short / empty click
      callbacks.onStatusChange?.('idle');
      callbacks.onEnd();
      return;
    }

    const audioBlob = new Blob(audioChunks, { type: recorderMime });
    callbacks.onStatusChange?.('transcribing');

    try {
      const text = await transcribeAudioWithAi(audioBlob);
      if (text) {
        callbacks.onTranscript(text, '');
        playCanvasSound('relay');
      }
    } catch (err: any) {
      if (err?.message === 'NO_AI_KEY_FOR_AUDIO') {
        callbacks.onError(
          'Brave bloque la reconnaissance vocale Google. Activez "Services Google" dans brave://settings/privacy OU ajoutez une clé Gemini gratuite dans Clés API.'
        );
      } else {
        callbacks.onError(err?.message || 'Erreur lors de la transcription IA.');
      }
    } finally {
      callbacks.onStatusChange?.('idle');
      callbacks.onEnd();
    }
  };

  return {
    stop: () => {
      void handleStopAndTranscribe();
    },
    isListening: true,
  };
}

