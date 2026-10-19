import React, { useState } from 'react';
import {
  GraduationCap,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Key,
  Terminal,
  Users,
  AtSign,
  HelpCircle,
  LifeBuoy,
  CheckCircle2,
  Play,
  ExternalLink,
  HardDrive,
  Globe,
  Mic,
  Maximize2,
  Zap,
} from 'lucide-react';

interface InteractiveTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenApiKeys: () => void;
  onOpenAiHelp: () => void;
  onOpenSupport: () => void;
  onSpawnFreeSquad: () => void;
  onStartAllConsoles: () => void;
  onFitCanvas: () => void;
}

export const TUTORIAL_SEEN_KEY = 'agent-canvas:tutorial-seen:v1';

export const InteractiveTutorialModal: React.FC<InteractiveTutorialModalProps> = ({
  isOpen,
  onClose,
  onOpenApiKeys,
  onOpenAiHelp,
  onOpenSupport,
  onSpawnFreeSquad,
  onStartAllConsoles,
  onFitCanvas,
}) => {
  const [step, setStep] = useState(0);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const triggerFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 2600);
  };

  const handleFinish = () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    onClose();
  };

  const STEPS = [
    {
      id: 'welcome',
      badge: 'Étape 1 / 7',
      title: 'Bienvenue sur Agent Canvas 👋',
      subtitle: 'Même si tu n’y connais rien en IA, tu vas tout comprendre en 2 minutes !',
      icon: <Sparkles className="w-5 h-5 text-[#ff6a3d]" />,
    },
    {
      id: 'choose-ai',
      badge: 'Étape 2 / 7',
      title: 'Quelle IA choisir ? (Gratuit vs Payant)',
      subtitle: 'Tu n’as PAS besoin de payer pour utiliser Agent Canvas !',
      icon: <Globe className="w-5 h-5 text-emerald-400" />,
    },
    {
      id: 'api-key',
      badge: 'Étape 3 / 7',
      title: 'C’est quoi une "Clé API" ? (Débloquer en 20 sec) 🔑',
      subtitle: 'Comment connecter ton propre compte Google ou OpenRouter gratuitement.',
      icon: <Key className="w-5 h-5 text-amber-400" />,
    },
    {
      id: 'console',
      badge: 'Étape 4 / 7',
      title: 'Utiliser une Console IA & le bouton "?" 🖥️',
      subtitle: 'Démarrer une IA, lui parler, agrandir la fenêtre et voir ses commandes.',
      icon: <Terminal className="w-5 h-5 text-sky-400" />,
    },
    {
      id: 'teams',
      badge: 'Étape 5 / 7',
      title: 'Les Équipes (Teams) & l’Orchestrateur 🚀',
      subtitle: 'Faire travailler 2 ou 4 IA en même temps avec une seule question !',
      icon: <Users className="w-5 h-5 text-violet-400" />,
    },
    {
      id: 'dock',
      badge: 'Étape 6 / 7',
      title: 'Barre @ en bas, Micro Vocal 🎤 & Mémoire 🧠',
      subtitle: 'Les outils rapides en bas de l’écran pour aller 10x plus vite.',
      icon: <AtSign className="w-5 h-5 text-pink-400" />,
    },
    {
      id: 'support',
      badge: 'Étape 7 / 7',
      title: 'Tu es prêt ! (Et le bouton Support si ça bloque) 🛟',
      subtitle: 'Un problème ? Signale-le en 1 clic depuis l’app.',
      icon: <LifeBuoy className="w-5 h-5 text-emerald-400" />,
    },
  ];

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="animate-node-appear w-full max-w-4xl rounded-2xl bg-[#1c1a22] border border-[#2d2a37] shadow-card overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#221f29] border-b border-[#2d2a37]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#ff6a3d]/15 text-[#ff6a3d] border border-[#ff6a3d]/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-100">
                  Tutoriel Interactif · Guide Débutant & Potes
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ff6a3d]/20 text-[#ff6a3d] border border-[#ff6a3d]/40">
                  {current.badge}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Apprends à utiliser toutes les IA pas-à-pas avec des boutons pour tester en direct
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title="Fermer le tutoriel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Navigation Pills */}
        <div className="px-5 py-2.5 bg-[#16141c] border-b border-[#2d2a37] flex items-center gap-1.5 overflow-x-auto">
          {STEPS.map((s, idx) => {
            const active = idx === step;
            const done = idx < step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(idx)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium shrink-0 transition-all border ${
                  active
                    ? 'bg-[#ff6a3d]/20 border-[#ff6a3d] text-white'
                    : done
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-[#1c1a22] border-[#2d2a37] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="font-mono text-[10px]">{idx + 1}.</span>
                <span>
                  {idx === 0
                    ? 'Concept'
                    : idx === 1
                    ? 'Choisir IA'
                    : idx === 2
                    ? 'Clé Gratuite'
                    : idx === 3
                    ? 'Console & ?'
                    : idx === 4
                    ? 'Équipes'
                    : idx === 5
                    ? 'Barre @ & Voix'
                    : 'Support'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body Content for Current Step */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-[#14121a] border border-[#2d2a37] shrink-0">
              {current.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">{current.title}</h3>
              <p className="text-xs text-zinc-400">{current.subtitle}</p>
            </div>
          </div>

          {actionFeedback && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
          )}

          {/* STEP 0: WELCOME */}
          {step === 0 && (
            <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-2">
                <p className="text-sm font-semibold text-zinc-100">
                  🤔 C’est quoi Agent Canvas concrètement ?
                </p>
                <p>
                  Normalement, quand tu utilises ChatGPT ou une autre IA, tu as une seule fenêtre de discussion.
                  <strong> Agent Canvas</strong> remplace ça par un <strong>grand tableau de bord infini</strong> (comme un bureau géant) sur lequel tu peux poser <strong>plusieurs IA côte à côte</strong> !
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-1.5">
                  <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                    <span className="text-[#ff6a3d]">1.</span> Plusieurs Cerveaux IA
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Tu peux ouvrir Gemini, Claude, ChatGPT (Codex), DeepSeek ou Qwen en même temps, chacun dans sa propre fenêtre ("Console").
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-1.5">
                  <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                    <span className="text-[#ff6a3d]">2.</span> Comparer en 1 clic
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Tu poses <strong>une seule question</strong> dans l’Orchestrateur à gauche, et toutes les IA de ton équipe te répondent en parallèle !
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-1.5">
                  <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                    <span className="text-[#ff6a3d]">3.</span> 100 % Personnalisable
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Tu peux déplacer les fenêtres, les agrandir avec <code>+</code> / <code>-</code>, dézoomer la page, tout est sauvegardé automatiquement.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: CHOOSE AI (FREE VS PAID) */}
          {step === 1 && (
            <div className="space-y-3.5 text-xs text-zinc-300">
              <p>
                Dans chaque console, tu as <strong>3 grandes familles d’IA</strong> repérables par des badges de couleur :
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-300 text-sm">
                      🔵 Quota Cloud Gratuit
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 text-[10px] font-bold">
                      RECOMMANDÉ WEB
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-200">
                    <strong>Ex : Gemini CLI / Antigravity / OpenRouter Free</strong>
                  </p>
                  <p className="text-[11px] text-zinc-300">
                    Idéal sur ce site Web ! Avec un simple compte Google, tu obtiens une clé gratuite qui fonctionne immédiatement sans carte bancaire.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 text-sm">
                      🟢 100 % Gratuit (PC)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-bold">
                      0 € ILLIMITÉ
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-200">
                    <strong>Ex : Ollama (Qwen2.5) & DeepSeek R1</strong>
                  </p>
                  <p className="text-[11px] text-zinc-300">
                    Tourne directement sur ton PC (si tu as installé le logiciel gratuit Ollama) OU sur le Web via une clé OpenRouter gratuite !
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 text-sm">
                      🟠 Mes Abos (Payants)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 text-[10px] font-bold">
                      PRO / API
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-200">
                    <strong>Ex : Claude Code, Codex (ChatGPT)</strong>
                  </p>
                  <p className="text-[11px] text-zinc-300">
                    Pour ceux qui ont déjà un abonnement payant ou une clé API Anthropic / OpenAI avec des crédits.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: API KEYS IN 20 SECONDS */}
          {step === 2 && (
            <div className="space-y-4 text-xs text-zinc-300">
              <div className="p-4 rounded-2xl bg-[#14121a] border border-[#ff6a3d]/40 space-y-2.5">
                <div className="font-bold text-sm text-zinc-100">
                  🔑 Pourquoi le site me demande une "Clé API" ?
                </div>
                <p className="leading-relaxed">
                  Comme Agent Canvas est hébergé sur Internet, chacun utilise son propre accès IA (tes clés restent <strong>100 % privées dans ton navigateur</strong>, personne d’autre n’y a accès).
                </p>
                <p className="text-emerald-300 font-medium">
                  Voici comment obtenir une clé 100 % GRATUITE en 20 secondes chrono :
                </p>

                <ol className="space-y-2 list-decimal list-inside text-zinc-200 bg-[#1c1a22] p-3.5 rounded-xl border border-[#2d2a37]">
                  <li>
                    Clique sur le bouton orange ci-dessous pour ouvrir <strong>Google AI Studio</strong> (ou <strong>OpenRouter</strong>).
                  </li>
                  <li>
                    Connecte-toi avec ton compte Google habituel et clique sur <strong>"Create API Key"</strong>.
                  </li>
                  <li>
                    Copie le code qui commence par <code>AIzaSy...</code> (ou <code>sk-or-...</code>).
                  </li>
                  <li>
                    Reviens ici, clique sur <strong>"🔑 Clés API"</strong> en haut à droite, colle ta clé et clique sur <strong>Enregistrer</strong> !
                  </li>
                </ol>

                <div className="flex items-center gap-2.5 flex-wrap pt-1">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] text-white font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>1. Créer une clé Google Gemini Gratuite</span>
                  </a>

                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1a22] hover:bg-zinc-800 text-zinc-200 border border-[#2d2a37] font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#ff6a3d]" />
                    <span>Alternative : Clé OpenRouter (Tous modèles)</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenApiKeys();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold transition-colors"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>2. Ouvrir la fenêtre "Clés API" maintenant</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CONSOLE & ? HELP BUTTON */}
          {step === 3 && (
            <div className="space-y-4 text-xs text-zinc-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-2">
                  <div className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                    <Play className="w-4 h-4 text-[#ff6a3d]" />
                    <span>1. Choisir et Démarrer une IA</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Sur une fenêtre ("Console"), clique sur l’IA de ton choix (ex: <strong>Gemini CLI</strong> ou <strong>Antigravity</strong>), puis clique sur le bouton orange <strong>"Start"</strong>.
                  </p>
                  <p className="text-zinc-400 leading-relaxed">
                    Un terminal noir s’ouvre : clique dedans, écris ta question en français et appuie sur <strong>Entrée</strong> !
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#14121a] border border-[#ff6a3d]/40 space-y-2">
                  <div className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#ff6a3d]" />
                    <span>2. Le bouton "?" sur chaque IA</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Tu ne sais pas quelle commande taper sur une IA ? Clique sur le bouton <strong>"?" (Aide IA)</strong> en haut à droite de n’importe quelle console !
                  </p>
                  <p className="text-zinc-300">
                    Il te donne la fiche de l’IA, ses commandes (<code>/help</code>, <code>/clear</code>, <code>/keys</code>) et des <strong>questions prêtes à lancer en 1 clic</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#14121a] border border-[#2d2a37] flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-[#ff6a3d]" />
                  <span>
                    <strong>Astuce taille :</strong> Utilise les boutons <code>−</code>, <code>[ ]</code> et <code>+</code> en haut de chaque fenêtre pour l’agrandir sans jamais chevaucher les autres !
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAiHelp();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#ff6a3d]/20 hover:bg-[#ff6a3d] text-[#ff6a3d] hover:text-white border border-[#ff6a3d]/40 font-semibold transition-colors"
                >
                  Ouvrir le Guide des IA & Commandes
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: TEAMS & ORCHESTRATOR */}
          {step === 4 && (
            <div className="space-y-4 text-xs text-zinc-300">
              <div className="p-4 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-2.5">
                <div className="font-bold text-sm text-zinc-100">
                  🚀 Le super-pouvoir d’Agent Canvas : L’Orchestrateur d’Équipe
                </div>
                <p className="leading-relaxed">
                  Regarde à gauche d’un grand cadre <strong>TEAM</strong> : il y a un boîtier appelé <strong>Orchestrateur</strong> relié par un câble orange animé.
                </p>
                <ul className="space-y-1.5 list-disc list-inside text-zinc-300">
                  <li>
                    Écris une question ou une mission dans la case <strong>"Diffuser à toute l’équipe"</strong> de l’Orchestrateur.
                  </li>
                  <li>
                    Clique sur <strong>Broadcast</strong> (ou appuie sur Entrée) : l’Orchestrateur démarre automatiquement toutes les IA de l’équipe et leur envoie la mission en même temps !
                  </li>
                  <li>
                    Tu peux ainsi comparer qui de Gemini, Claude, Qwen ou DeepSeek donne la meilleure réponse !
                  </li>
                </ul>

                <div className="pt-2 flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      onSpawnFreeSquad();
                      triggerFeedback(
                        '4 consoles IA gratuites ont été ajoutées sur ton Canvas !'
                      );
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Tester : Ajouter 4 IA Gratuites sur le Canvas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onStartAllConsoles();
                      triggerFeedback('Toutes les consoles du Canvas ont été démarrées !');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ff6a3d]/20 hover:bg-[#ff6a3d] text-[#ff6a3d] hover:text-white border border-[#ff6a3d]/40 font-semibold transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Tester : Démarrer toutes les consoles</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: BOTTOM DOCK, @ COMMAND BAR & VOICE */}
          {step === 5 && (
            <div className="space-y-3.5 text-xs text-zinc-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-1.5">
                  <div className="font-bold text-zinc-100 flex items-center gap-2">
                    <AtSign className="w-4 h-4 text-[#ff6a3d]" />
                    <span>La barre de commande `@` tout en bas</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Tape <code>@</code> dans la grande barre en bas de l’écran pour choisir à qui parler : <code>@all</code> (toutes les IA d’un coup), <code>@team-1</code> (une équipe), ou une seule IA précise !
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-1.5">
                  <div className="font-bold text-zinc-100 flex items-center gap-2">
                    <Mic className="w-4 h-4 text-emerald-400" />
                    <span>Dictée Vocale (Bouton Espace)</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    La flemme d’écrire ? Maintiens le bouton <strong>"🎤 Espace"</strong> dans la barre du bas et parle à voix haute : ta voix est transcrite directement en texte !
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-1.5">
                <div className="font-bold text-zinc-100">
                  📌 Et les boutons de la barre d’outils en bas :
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-400 pt-1">
                  <div>• <strong className="text-zinc-200">+ New console :</strong> Ajoute une nouvelle fenêtre IA.</div>
                  <div>• <strong className="text-emerald-300">Spawn 4 Free :</strong> Crée 4 IA gratuites d’un coup.</div>
                  <div>• <strong className="text-zinc-200">Group :</strong> Regroupe tes consoles dans une Équipe avec un Orchestrateur.</div>
                  <div>• <strong className="text-zinc-200">Presets :</strong> Charge des configurations d’équipes prêtes à l’emploi.</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: SUPPORT & READY */}
          {step === 6 && (
            <div className="space-y-4 text-xs text-zinc-300">
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2.5">
                  <LifeBuoy className="w-6 h-6 text-emerald-400" />
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100">
                      Un bug, une erreur ou une question ? Le bouton "🛟 Support" est là !
                    </h4>
                    <p className="text-[11px] text-emerald-200">
                      Tu peux signaler ton problème en 1 clic.
                    </p>
                  </div>
                </div>

                <p className="text-zinc-200 leading-relaxed">
                  En haut à droite de l’écran, tu trouveras toujours :
                </p>
                <ul className="space-y-1.5 text-zinc-200">
                  <li>
                    🎓 <strong>Tuto :</strong> Pour rouvrir ce guide interactif quand tu veux.
                  </li>
                  <li>
                    ❓ <strong>Aide IA :</strong> Pour voir les commandes et explications de chaque IA (aussi disponible via le bouton <code>?</code> sur chaque console).
                  </li>
                  <li>
                    🛟 <strong>Support :</strong> Joint automatiquement le diagnostic de ton problème (ou copie le rapport pour lui coller sur Discord/WhatsApp) pour qu’il te le règle tout de suite !
                  </li>
                </ul>

                <div className="flex items-center gap-2.5 flex-wrap pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleFinish();
                      onOpenSupport();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 font-semibold transition-colors"
                  >
                    <LifeBuoy className="w-4 h-4" />
                    <span>Voir le bouton Support maintenant</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onFitCanvas();
                      handleFinish();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] text-white font-semibold shadow-sm transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Terminer le tuto et utiliser Agent Canvas !</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation (Previous / Next) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#221f29] border-t border-[#2d2a37]">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#14121a] hover:bg-zinc-800 disabled:opacity-40 text-zinc-200 border border-[#2d2a37] text-xs font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Précédent</span>
          </button>

          <div className="text-[11px] text-zinc-400">
            Étape <strong>{step + 1}</strong> sur <strong>{STEPS.length}</strong>
          </div>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <span>Étape suivante</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>C’est parti !</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
