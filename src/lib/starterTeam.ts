import type { AgentCommandType, DetectedCli } from '../types';

/**
 * Order in which installed AIs are picked for the first team: the ones that work out of the box with a
 * personal account first, local/free ones next, and Gemini CLI last (it needs a paid API key since 06/2026).
 */
export const STARTER_PRIORITY: AgentCommandType[] = [
  'claude',
  'codex',
  'agy',
  'qwen',
  'opencode',
  'kimi',
  'aider',
  'ollama',
  'deepseek',
  'gemini',
];

/** The example mission prefilled in the first team's orchestrator (relay mode). */
export const STARTER_MISSION =
  "Propose un plan en 5 étapes maximum pour une petite appli de liste de courses. L'IA suivante relit le plan et l'améliore.";

/** Up to `max` installed AIs for the starter team, best first. Pure (tested). */
export function pickStarterAgents(detected: DetectedCli[], max = 2): AgentCommandType[] {
  const installed = new Set(detected.filter((c) => c.installed).map((c) => c.id));
  const picked: AgentCommandType[] = [];
  for (const id of STARTER_PRIORITY) {
    if (picked.length >= max) break;
    // DeepSeek runs through Ollama: never put both in a two-agent starter team.
    if (id === 'deepseek' && picked.includes('ollama')) continue;
    if (installed.has(id)) picked.push(id);
  }
  return picked;
}
