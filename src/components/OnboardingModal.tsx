import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  Wallet,
  Cpu,
  FolderGit2,
  Rocket,
} from 'lucide-react';
import type { DetectedCli } from '../types';

export const ONBOARDING_DONE_KEY = 'agent-canvas:onboarding-done:v1';

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** CLIs worth highlighting first: the ones most people will actually use. */
const MAIN_CLIS = new Set(['claude', 'gemini', 'codex', 'agy', 'ollama']);

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [clis, setClis] = useState<DetectedCli[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const isDesktop = Boolean(window.agentCanvasAPI?.detectClis);

  const detect = useCallback(async () => {
    if (!window.agentCanvasAPI?.detectClis) return;
    setLoading(true);
    try {
      const result = await window.agentCanvasAPI.detectClis();
      // One line per binary (DeepSeek runs through Ollama: don't list Ollama twice).
      const seen = new Set<string>();
      setClis(
        result.filter((c) => {
          if (seen.has(c.binary)) return false;
          seen.add(c.binary);
          return true;
        })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) detect();
  }, [isOpen, detect]);

  if (!isOpen) return null;

  const installedCount = clis?.filter((c) => c.installed).length ?? 0;
  const sorted = (clis || []).slice().sort((a, b) => {
    if (a.installed !== b.installed) return a.installed ? -1 : 1;
    return Number(MAIN_CLIS.has(b.id)) - Number(MAIN_CLIS.has(a.id));
  });

  const copyHint = async (id: string, hint: string) => {
    try {
      await navigator.clipboard.writeText(hint.split('  (')[0]);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const finish = () => {
    try {
      localStorage.setItem(ONBOARDING_DONE_KEY, '1');
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="animate-node-appear w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col rounded-2xl bg-[#1c1a22] border border-[#2d2a37] shadow-card">
        <div className="px-6 pt-5 pb-4 border-b border-[#2d2a37] bg-[#221f29]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#ff6a3d]/15 text-[#ff6a3d] border border-[#ff6a3d]/30">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Bienvenue dans Agent Canvas</h2>
              <p className="text-xs text-zinc-400">
                Trois choses à savoir avant de lancer tes premières IA.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* 1. Installed CLIs */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#ff6a3d]" />
                1. Tes IA installées
              </h3>
              {isDesktop && (
                <button
                  type="button"
                  onClick={detect}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border border-[#2d2a37] text-zinc-300 hover:text-white hover:border-zinc-500"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  Re-vérifier
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Agent Canvas ne contient aucune IA : il pilote les outils en ligne de commande déjà installés sur ton PC.
              Installe au moins une IA, connecte-toi une fois dans son terminal, puis clique sur « Re-vérifier ».
            </p>
            {!isDesktop ? (
              <p className="text-xs text-amber-300">La détection n'est disponible que dans l'app de bureau.</p>
            ) : clis === null ? (
              <p className="text-xs text-zinc-500">Recherche des IA installées…</p>
            ) : (
              <>
                <p className={`text-xs font-medium ${installedCount > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {installedCount > 0
                    ? `${installedCount} IA détectée(s) sur ce PC.`
                    : 'Aucune IA détectée pour l’instant : installe-en une ci-dessous.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {sorted.map((cli) => (
                    <div
                      key={cli.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#14121a] border border-[#24212e]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {cli.installed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-zinc-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-200 truncate">{cli.title}</div>
                          {!cli.installed && cli.installHint && (
                            <div className="text-[10px] font-mono text-zinc-500 truncate" title={cli.installHint}>
                              {cli.installHint}
                            </div>
                          )}
                        </div>
                      </div>
                      {!cli.installed && cli.installHint && (
                        <button
                          type="button"
                          onClick={() => copyHint(cli.id, cli.installHint!)}
                          className="shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                          title="Copier la commande d'installation"
                        >
                          {copied === cli.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* 2. Costs */}
          <section className="space-y-1.5 p-4 rounded-2xl bg-[#14121a] border border-[#2d2a37]">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-300" />
              2. Ce que ça coûte
            </h3>
            <ul className="text-xs text-zinc-400 space-y-1 list-disc pl-5 leading-relaxed">
              <li>
                Chaque IA utilise <strong className="text-zinc-200">ton propre compte</strong> (abonnement Claude, ChatGPT,
                Google…) et consomme ses quotas. Agent Canvas ne fournit aucun accès gratuit.
              </li>
              <li>
                Plusieurs IA en équipe consomment plusieurs fois plus vite. Commence avec 2 agents.
              </li>
              <li>
                Les jauges de tokens affichées sont une <strong className="text-zinc-200">estimation</strong>, pas ta
                consommation réelle : vérifie tes limites sur le site de chaque fournisseur.
              </li>
            </ul>
          </section>

          {/* 3. Safety */}
          <section className="space-y-1.5 p-4 rounded-2xl bg-red-500/5 border border-red-500/25">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              3. Sécurité
            </h3>
            <ul className="text-xs text-zinc-400 space-y-1 list-disc pl-5 leading-relaxed">
              <li>
                Les IA peuvent <strong className="text-zinc-200">lire, modifier et supprimer des fichiers</strong> et lancer des
                commandes dans le dossier où elles tournent. Certaines (mode « auto ») le font sans demander.
              </li>
              <li className="flex-wrap">
                <FolderGit2 className="inline w-3.5 h-3.5 text-emerald-400 mr-1 -mt-0.5" />
                Ajoute un panneau <strong className="text-zinc-200">Workspace</strong> pour choisir le dossier de ton projet :
                les consoles s'y lancent. Sinon, elles démarrent dans ton dossier utilisateur.
              </li>
              <li>
                Utilise <strong className="text-zinc-200">git</strong> sur ton projet pour pouvoir annuler ce qu'une IA a cassé, et
                ne lance jamais d'IA dans un dossier contenant des mots de passe ou des clés.
              </li>
              <li>
                En mode équipe, une IA transmet sa réponse à la suivante : une erreur ou une mauvaise consigne peut se propager.
                Relis avant de valider.
              </li>
            </ul>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-[#2d2a37] bg-[#14121a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="accent-[#ff6a3d] w-4 h-4"
            />
            J'ai compris les coûts et les risques.
          </label>
          <button
            type="button"
            onClick={finish}
            disabled={!accepted}
            className="px-5 py-2 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            Commencer
          </button>
        </div>
      </div>
    </div>
  );
};
