import React, { useState } from 'react';
import {
  Sparkles,
  ShieldAlert,
  Code2,
  CheckCircle2,
  FileText,
  Zap,
  Layers,
  ArrowRight,
  X,
  Copy,
  Check,
} from 'lucide-react';

export interface PromptTemplate {
  id: string;
  title: string;
  category: 'audit' | 'code' | 'tests' | 'architecture' | 'doc' | 'perf';
  badge: string;
  badgeColor: string;
  description: string;
  prompt: string;
  suggestedSquad: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'security-audit',
    title: 'Audit de Sécurité & Failles Zéro-Day',
    category: 'audit',
    badge: 'Sécurité & Robustesse',
    badgeColor: 'border-red-500/40 text-red-400 bg-red-500/10',
    description:
      'Analyse complète des failles potentielles : fuites de clés API, injections, sanitisation des entrées et conformité OWASP.',
    prompt:
      'Réalise un audit de sécurité approfondi sur notre codebase. Identifie les risques de failles, les injections potentielles, les fuites de secrets ou tokens, et propose un plan de remédiation priorisé avec code de correction.',
    suggestedSquad: 'DeepSeek R1 + Claude Code',
  },
  {
    id: 'clean-refactor',
    title: 'Refactoring Clean Code & Typage Strict',
    category: 'code',
    badge: 'Qualité de Code',
    badgeColor: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
    description:
      'Élimination du code dupliqué (DRY), simplification des fonctions complexes, découpage modulaire et typage TypeScript strict.',
    prompt:
      'Passe en revue le code du projet pour appliquer les meilleures pratiques Clean Code (SOLID, DRY). Réduis la complexité cyclomatique, renforce le typage TypeScript (zéro `any`), isole les responsabilités et améliore la lisibilité globale.',
    suggestedSquad: 'Claude Architect + Gemini CLI',
  },
  {
    id: 'unit-and-e2e-tests',
    title: 'Batterie de Tests Unitaires & Couverture',
    category: 'tests',
    badge: 'Tests & QA',
    badgeColor: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
    description:
      'Écriture de tests unitaires et d’intégration avec cas limites (edge cases) et mocking des dépendances réseau/système.',
    prompt:
      'Rédige une suite complète de tests unitaires et d’intégration pour notre logique métier. Couvre les cas nominaux, les cas limites et les scénarios d’erreurs. Fournis le code des tests avec mocks prêts à exécuter.',
    suggestedSquad: 'System Shell + Qwen3 Coder',
  },
  {
    id: 'api-architecture',
    title: 'Conception d’APIs & Schémas de Données',
    category: 'architecture',
    badge: 'Architecture & APIs',
    badgeColor: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
    description:
      'Définition des contrats d’API REST/GraphQL, schémas de base de données relationnels ou NoSQL et DTOs typés.',
    prompt:
      'Conçois l’architecture complète de notre nouvelle API : endpoints RESTful, codes statut HTTP, interfaces TypeScript pour les payloads de requêtes/réponses, validation des schémas et modèle de données BDD optimisé.',
    suggestedSquad: 'Codex CLI + Claude Architect',
  },
  {
    id: 'developer-docs',
    title: 'Documentation Technique & Guide Développeur',
    category: 'doc',
    badge: 'Documentation',
    badgeColor: 'border-purple-500/40 text-purple-300 bg-purple-500/10',
    description:
      'Rédaction d’un guide d’architecture clair, instructions de démarrage, schéma des composants et guide de contribution.',
    prompt:
      'Génère une documentation technique complète et pédagogique en Markdown pour ce projet : vue d’ensemble de l’architecture, guide pas-à-pas de configuration locale, explications des modules clés et astuces de débogage.',
    suggestedSquad: 'Gemini CLI + Claude Architect',
  },
  {
    id: 'perf-optimization',
    title: 'Optimisation des Performances & Mémoire',
    category: 'perf',
    badge: 'Haute Performance',
    badgeColor: 'border-orange-500/40 text-orange-400 bg-orange-500/10',
    description:
      'Détection des goulots d’étranglement (bottlenecks), mémoïsation React, optimisation des bundles et requêtes réseau.',
    prompt:
      'Analyse les performances de l’application. Identifie les calculs redondants, les re-renders inutiles, les fuites de mémoire ou les requêtes lourdes. Propose des solutions concrètes avec gains mesurables.',
    suggestedSquad: 'Argon 4 + Claude Code',
  },
];

interface PromptTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (promptText: string) => void;
}

export const PromptTemplatesModal: React.FC<PromptTemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const filtered =
    filterCategory === 'all'
      ? PROMPT_TEMPLATES
      : PROMPT_TEMPLATES.filter((t) => t.category === filterCategory);

  const handleCopy = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl bg-[#1c1a22] border border-[#2d2a37] shadow-[0_24px_64px_rgba(0,0,0,0.65)] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#2d2a37] flex items-center justify-between bg-[#14121a]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#ff6a3d]/20 text-[#ff6a3d] border border-[#ff6a3d]/40">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                Bibliothèque de Missions & Prompts Pro
              </h2>
              <p className="text-xs text-zinc-400">
                Templates de missions expertes conçus pour tirer parti des spécialités multi-IA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 border-b border-[#2d2a37]/80 bg-[#17151e] flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'Tous les templates' },
            { id: 'audit', label: 'Sécurité & Audit' },
            { id: 'code', label: 'Clean Code' },
            { id: 'tests', label: 'Tests Unitaires' },
            { id: 'architecture', label: 'Architecture & APIs' },
            { id: 'doc', label: 'Documentation' },
            { id: 'perf', label: 'Performance' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1 rounded-full font-medium transition-colors whitespace-nowrap ${
                filterCategory === cat.id
                  ? 'bg-[#ff6a3d] text-white shadow-[0_0_12px_rgba(255,106,61,0.45)]'
                  : 'bg-[#14121a] text-zinc-400 border border-[#2d2a37] hover:text-zinc-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="p-4 rounded-2xl bg-[#14121a]/90 hover:bg-[#1f1b26] border border-[#2d2a37] hover:border-[#ff6a3d]/50 transition-all flex flex-col gap-2.5 group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm text-zinc-100">{t.title}</h3>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${t.badgeColor}`}
                  >
                    {t.badge}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleCopy(t.id, t.prompt, e)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs border border-zinc-700 transition-colors"
                    title="Copier le prompt dans le presse-papiers"
                  >
                    {copiedId === t.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      onSelectPrompt(t.prompt);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#ff6a3d] hover:bg-[#ff7d55] text-white text-xs font-semibold shadow-[0_0_12px_rgba(255,106,61,0.4)] transition-all cursor-pointer"
                  >
                    <span>Lancer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-zinc-400">{t.description}</p>

              <div className="p-2.5 rounded-xl bg-[#100e14] border border-[#24212d] font-mono text-[11px] text-zinc-300 line-clamp-2">
                "{t.prompt}"
              </div>

              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                <Layers className="w-3 h-3 text-[#ff6a3d]" />
                <span>Squad suggérée : {t.suggestedSquad}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
