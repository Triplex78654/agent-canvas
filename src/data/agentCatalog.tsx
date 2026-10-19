import React from 'react';
import {
  Terminal as TerminalIcon,
  Sparkles,
  Code2,
  Cpu,
  Bot,
  HardDrive,
  Flame,
  Brain,
  Wrench,
  Globe,
} from 'lucide-react';
import type { AgentCommandType } from '../types';

/** Every AI the canvas can launch: label, pricing tier, default token budget, icon. */
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
    badge: 'Clé API Google',
    tier: 'byok',
    tierLabel: 'CLÉ API',
    costNotice:
      'Depuis juin 2026, la connexion gratuite « Sign in with Google » de Gemini CLI est fermée : il faut une clé API (AI Studio ou Vertex, selon ton forfait). Pour utiliser Gemini avec ton compte Google, prends plutôt Antigravity (agy).',
    defaultTokenLimit: 150000,
    quotaLabel: 'Clé API Google · selon ton forfait',
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
