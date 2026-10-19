import React, { useEffect, useState } from 'react';
import {
  HelpCircle,
  X,
  Terminal,
  Sparkles,
  Play,
  Copy,
  Check,
  ExternalLink,
  Key,
  Monitor,
  Globe,
  LifeBuoy,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { AgentCommandType } from '../types';
import { COMMAND_OPTIONS } from './ConsoleNode';
import { AI_HELP_CATALOG, COMMON_WEB_COMMANDS } from '../data/aiHelpCatalog';

interface AiHelpModalProps {
  isOpen: boolean;
  initialAgent?: AgentCommandType;
  targetConsoleId?: string;
  targetConsoleLabel?: string;
  onClose: () => void;
  onRunInConsole?: (consoleId: string, textToRun: string) => void;
  onOpenApiKeys: () => void;
  onOpenSupport: (prefillContext?: string) => void;
  onOpenTutorial: () => void;
}

export const AiHelpModal: React.FC<AiHelpModalProps> = ({
  isOpen,
  initialAgent = 'gemini',
  targetConsoleId,
  targetConsoleLabel,
  onClose,
  onRunInConsole,
  onOpenApiKeys,
  onOpenSupport,
  onOpenTutorial,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentCommandType>(initialAgent);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialAgent) {
      setSelectedAgent(initialAgent);
    }
  }, [isOpen, initialAgent]);

  if (!isOpen) return null;

  const guide = AI_HELP_CATALOG[selectedAgent] || AI_HELP_CATALOG.gemini;
  const optionSpec =
    COMMAND_OPTIONS.find((o) => o.id === selectedAgent) || COMMAND_OPTIONS[0];
  const isDesktopApp = Boolean(window.agentCanvasAPI);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1600);
  };

  const handleInjectCommand = (text: string) => {
    if (targetConsoleId && onRunInConsole) {
      onRunInConsole(targetConsoleId, text);
      setSentNotice(text);
      setTimeout(() => {
        setSentNotice(null);
        onClose();
      }, 550);
    } else {
      handleCopy(text);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="animate-node-appear w-full max-w-4xl rounded-2xl bg-[#1c1a22] border border-[#2d2a37] shadow-card overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#221f29] border-b border-[#2d2a37]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#ff6a3d]/15 text-[#ff6a3d] border border-[#ff6a3d]/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-100">
                  Guide des IA & Commandes Terminal
                </h2>
                {targetConsoleLabel && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#ff6a3d]/20 text-[#ff6a3d] border border-[#ff6a3d]/40">
                    Console ciblée : {targetConsoleLabel}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                Clique sur une IA à gauche pour voir à quoi elle sert, comment la débloquer gratuitement et quelles commandes taper.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTutorial();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[#14121a] hover:bg-zinc-800 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors"
            >
              🎓 Lancer le Tuto Interactif
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content: Left Sidebar (Agent List) + Right Detail View */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Sidebar: All AI Agents */}
          <div className="w-64 bg-[#16141c] border-r border-[#2d2a37] p-2.5 overflow-y-auto space-y-1 shrink-0">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Choisir une IA ({COMMAND_OPTIONS.length})
            </div>
            {COMMAND_OPTIONS.map((item) => {
              const active = item.id === selectedAgent;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedAgent(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-all border ${
                    active
                      ? 'bg-[#ff6a3d]/15 border-[#ff6a3d] text-white'
                      : 'bg-transparent border-transparent hover:bg-[#1c1a22] text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded-lg bg-[#14121a] border border-[#2d2a37] shrink-0">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">
                        {item.label}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 truncate">
                        $ {item.id}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[8px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                      item.tier === 'local-free'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : item.tier === 'freemium'
                        ? 'bg-sky-500/20 text-sky-300'
                        : item.tier === 'sub'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {item.tier === 'local-free'
                      ? '0€ PC'
                      : item.tier === 'freemium'
                      ? 'GRATUIT'
                      : item.tier === 'sub'
                      ? 'ABO'
                      : 'API'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Panel: Detailed Guide & Interactive Commands */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5">
            {/* Top Agent Identity Card */}
            <div className="p-4 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#1c1a22] border border-[#2d2a37]">
                    {optionSpec.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-zinc-100">
                        {guide.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Niveau : {guide.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-[#ff6a3d] font-medium">
                      {guide.tagline}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {guide.freeKeyUrl && (
                    <a
                      href={guide.freeKeyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff6a3d]/15 hover:bg-[#ff6a3d] text-[#ff6a3d] hover:text-white border border-[#ff6a3d]/40 text-xs font-medium transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{guide.freeKeyLabel || 'Obtenir une clé'}</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenApiKeys();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c1a22] hover:bg-zinc-800 text-zinc-200 border border-[#2d2a37] text-xs font-medium transition-colors"
                  >
                    <Key className="w-3.5 h-3.5 text-[#ff6a3d]" />
                    <span>Coller ma clé API</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                {guide.beginnerSummary}
              </p>

              {/* Best for pills */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] font-semibold uppercase text-zinc-400 mr-1">
                  Idéal pour :
                </span>
                {guide.bestFor.map((bf, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-lg bg-[#1c1a22] border border-[#2d2a37] text-[11px] text-zinc-200"
                  >
                    ✓ {bf}
                  </span>
                ))}
              </div>

              <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">
                <strong>💰 Tarif / Accès :</strong> {guide.costSummary}
              </div>
            </div>

            {/* How to Setup (Web vs Desktop) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                className={`p-3.5 rounded-2xl border space-y-2 ${
                  !isDesktopApp
                    ? 'bg-[#14121a] border-[#ff6a3d]/50'
                    : 'bg-[#14121a]/70 border-[#2d2a37]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#ff6a3d]" />
                    <span>Comment l’utiliser sur le Web (Cloudflare)</span>
                  </span>
                  {!isDesktopApp && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#ff6a3d]/20 text-[#ff6a3d] font-semibold">
                      Ton mode actuel
                    </span>
                  )}
                </div>
                <ol className="space-y-1.5 text-[11px] text-zinc-300 list-decimal list-inside">
                  {guide.webSetupSteps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <div
                className={`p-3.5 rounded-2xl border space-y-2 ${
                  isDesktopApp
                    ? 'bg-[#14121a] border-[#ff6a3d]/50'
                    : 'bg-[#14121a]/70 border-[#2d2a37]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-sky-400" />
                    <span>Comment l’utiliser sur l’App PC (Electron)</span>
                  </span>
                  {isDesktopApp && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold">
                      Ton mode actuel
                    </span>
                  )}
                </div>
                <ol className="space-y-1.5 text-[11px] text-zinc-300 list-decimal list-inside">
                  {guide.desktopSetupSteps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Terminal Commands Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-[#ff6a3d]" />
                  <span>Commandes à taper dans cette console ({guide.name})</span>
                </h4>
                {sentNotice && (
                  <span className="text-xs text-emerald-400 font-medium">
                    ✓ Commande envoyée : {sentNotice}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[...guide.commands, ...COMMON_WEB_COMMANDS.filter((c) => !guide.commands.some((g) => g.command === c.command))].map(
                  (cmd, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#14121a] border border-[#2d2a37] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <code className="px-2 py-0.5 rounded bg-[#1c1a22] border border-[#2d2a37] text-xs font-mono text-[#ff6a3d] font-semibold">
                            {cmd.command}
                          </code>
                          {cmd.mode === 'web' && (
                            <span className="text-[9px] px-1 rounded bg-sky-500/15 text-sky-300">
                              Web
                            </span>
                          )}
                          {cmd.mode === 'desktop' && (
                            <span className="text-[9px] px-1 rounded bg-violet-500/15 text-violet-300">
                              PC
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          {cmd.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {targetConsoleId && onRunInConsole && cmd.canRunDirectly && (
                          <button
                            type="button"
                            onClick={() => handleInjectCommand(cmd.command)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#ff6a3d] hover:bg-[#ff7b52] text-white text-[10px] font-medium transition-colors"
                            title="Envoyer directement cette commande dans la console"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>Lancer</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopy(cmd.command)}
                          className="p-1.5 rounded-lg bg-[#1c1a22] hover:bg-zinc-800 text-zinc-300 border border-[#2d2a37]"
                          title="Copier la commande"
                        >
                          {copiedText === cmd.command ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Ready-to-use Starter Prompts for Friends */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Exemples de questions prêtes à tester en 1 clic</span>
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {guide.starterPrompts.map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#14121a] border border-[#2d2a37] hover:border-[#ff6a3d]/50 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-100">
                        {ex.title}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        « {ex.prompt} »
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {targetConsoleId && onRunInConsole ? (
                        <button
                          type="button"
                          onClick={() => handleInjectCommand(ex.prompt)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] text-white text-xs font-medium transition-colors"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Tester dans la console</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCopy(ex.prompt)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1c1a22] hover:bg-zinc-800 text-zinc-200 border border-[#2d2a37] text-xs font-medium"
                        >
                          {copiedText === ex.prompt ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Copié !</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copier la question</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Troubleshooting & Direct Support Link */}
            <div className="p-3.5 rounded-2xl bg-[#14121a] border border-[#2d2a37] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Astuce Dépannage ({guide.name})</span>
                </div>
                {guide.troubleshooting.map((tip, i) => (
                  <p key={i} className="text-[11px] text-zinc-400">
                    • {tip}
                  </p>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSupport(`Problème avec l'IA ${guide.name} (${selectedAgent})`);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-semibold shrink-0 transition-colors"
              >
                <LifeBuoy className="w-4 h-4" />
                <span>Ça bloque ? Signaler le problème</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
