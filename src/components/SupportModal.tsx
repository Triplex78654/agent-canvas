import React, { useEffect, useState } from 'react';
import {
  LifeBuoy,
  X,
  Send,
  Copy,
  Check,
  Mail,
  Wrench,
  Sparkles,
  Key,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import {
  countConfiguredKeys,
  loadUserWebApiKeys,
} from '../services/webAiClient';
import { buildIssueUrl } from '../config';

interface SupportModalProps {
  isOpen: boolean;
  prefillSubject?: string;
  activeAgentsSummary: string;
  onClose: () => void;
  onOpenApiKeys: () => void;
  onOpenAiHelp: () => void;
}

const DISCORD_WEBHOOK_STORAGE_KEY = 'agent-canvas:support-webhook:v1';

const ISSUE_CATEGORIES = [
  {
    id: 'api-key',
    label: '🔑 Je n’ai pas de clé API / "Clé API requise"',
    autoAdvice:
      'Pour utiliser les IA gratuitement sur le Web : clique sur "Obtenir une clé Google Gemini Gratuite" ci-dessous (ça prend 20 secondes avec ton compte Google), puis colle-la dans "🔑 Clés API" !',
  },
  {
    id: 'ai-error',
    label: '🤖 Une IA ne répond pas ou affiche une erreur rouge',
    autoAdvice:
      'Si tu as choisi Ollama ou DeepSeek sur le site Web sans avoir installé Ollama sur ton PC, choisis plutôt "Gemini CLI" ou ajoute une clé OpenRouter gratuite dans "🔑 Clés API".',
  },
  {
    id: 'how-to',
    label: '🎓 Je ne comprends pas comment lancer ou utiliser une IA',
    autoAdvice:
      'Clique sur le bouton "?" (Help) en haut à droite de n’importe quelle console : tu verras à quoi sert l’IA et tu pourras lancer des questions toutes prêtes en 1 clic !',
  },
  {
    id: 'display-bug',
    label: '🐞 Bug d’affichage / Fenêtre bloquée ou mal cadrée',
    autoAdvice:
      'Astuce immédiate : clique sur le bouton "Tout cadrer" ou "100%" en haut à droite de l’écran pour recentrer toutes les fenêtres.',
  },
  {
    id: 'other',
    label: '💬 Autre question / Idée d’amélioration',
    autoAdvice:
      'Décris ton problème ou ton idée ci-dessous, le rapport technique sera joint automatiquement pour que je puisse régler ça rapidement !',
  },
];

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  prefillSubject,
  activeAgentsSummary,
  onClose,
  onOpenApiKeys,
  onOpenAiHelp,
}) => {
  const [senderName, setSenderName] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [category, setCategory] = useState(ISSUE_CATEGORIES[0].id);
  const [message, setMessage] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [discordWebhook, setDiscordWebhook] = useState(
    () => localStorage.getItem(DISCORD_WEBHOOK_STORAGE_KEY) || ''
  );
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);

  const [sending, setSending] = useState(false);
  const [sentStatus, setSentStatus] = useState<'idle' | 'sent' | 'copied'>('idle');
  const [statusDetail, setStatusDetail] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSentStatus('idle');
      setStatusDetail(null);
      if (prefillSubject) {
        setMessage((prev) => (prev ? prev : `${prefillSubject} : `));
        setCategory('ai-error');
      }
    }
  }, [isOpen, prefillSubject]);

  if (!isOpen) return null;

  const keys = loadUserWebApiKeys();
  const keysCount = countConfiguredKeys(keys);
  const isDesktop = Boolean(window.agentCanvasAPI);
  const selectedCategoryObj =
    ISSUE_CATEGORIES.find((c) => c.id === category) || ISSUE_CATEGORIES[0];

  const buildDiagnosticReport = () => {
    const configuredProviders: string[] = [];
    if (keys.openrouterKey?.trim()) configuredProviders.push('OpenRouter');
    if (keys.geminiKey?.trim()) configuredProviders.push('Gemini');
    if (keys.anthropicKey?.trim()) configuredProviders.push('Anthropic');
    if (keys.openaiKey?.trim()) configuredProviders.push('OpenAI');
    if (keys.qwenKey?.trim()) configuredProviders.push('Qwen');
    if (keys.kimiKey?.trim()) configuredProviders.push('Kimi');

    return [
      `=== 🛟 TICKET SUPPORT AGENT CANVAS ===`,
      `De : ${senderName.trim() || 'Un pote (Anonyme)'}`,
      `Contact : ${senderContact.trim() || 'Non précisé'}`,
      `Catégorie : ${selectedCategoryObj.label}`,
      `Date : ${new Date().toLocaleString('fr-FR')}`,
      ``,
      `Description du problème :`,
      message.trim() || '(Aucun détail supplémentaire écrit)',
      ...(includeDiagnostics
        ? [
            ``,
            `--- Diagnostic Automatique ---`,
            `Plateforme : ${isDesktop ? 'App PC Electron' : `Web (${window.location.origin})`}`,
            `Clés API configurées (${keysCount}) : ${
              configuredProviders.length > 0
                ? configuredProviders.join(', ')
                : 'Aucune clé configurée'
            }`,
            `Consoles sur le Canvas : ${activeAgentsSummary}`,
            `Navigateur : ${navigator.userAgent.slice(0, 90)}`,
          ]
        : []),
    ].join('\n');
  };

  const handleCopyForDiscord = () => {
    const report = buildDiagnosticReport();
    navigator.clipboard.writeText(report);
    setSentStatus('copied');
    setStatusDetail(
      'Rapport copié ! Tu peux maintenant faire Ctrl+V directement dans ton message Discord / WhatsApp.'
    );
  };

  const handleOpenMailto = () => {
    const report = buildDiagnosticReport();
    const subject = encodeURIComponent(
      `[Agent Canvas Support] ${selectedCategoryObj.label} - ${senderName.trim() || 'Pote'}`
    );
    const body = encodeURIComponent(report);
    window.open(buildIssueUrl(decodeURIComponent(subject), decodeURIComponent(body)), '_blank');
  };

  const handleDirectSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatusDetail(null);

    const report = buildDiagnosticReport();
    // Always copy to clipboard as a backup so the friend never loses their message
    try {
      await navigator.clipboard.writeText(report);
    } catch (_) {}

    let delivered = false;

    // 1. If a Discord Webhook is configured, send directly to Discord channel
    if (discordWebhook.trim().startsWith('https://discord.com/api/webhooks/')) {
      localStorage.setItem(DISCORD_WEBHOOK_STORAGE_KEY, discordWebhook.trim());
      try {
        const res = await fetch(discordWebhook.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Agent Canvas Support 🛟',
            content: `\`\`\`\n${report}\n\`\`\``,
          }),
        });
        if (res.ok) {
          delivered = true;
        }
      } catch (_) {}
    }

    // 2. Open a prefilled GitHub issue (public tracker of the project, no personal e-mail in the app)
    if (!delivered) {
      window.open(
        buildIssueUrl(`[Support] ${selectedCategoryObj.label}`, report),
        '_blank'
      );
    }

    setSending(false);
    setSentStatus('sent');
    if (delivered) {
      setStatusDetail(
        'Ton problème + le diagnostic automatique ont bien été envoyés sur Discord ! (Une copie est aussi dans ton presse-papiers.)'
      );
    } else {
      setStatusDetail(
        'Une page GitHub s’est ouverte avec ton rapport pré-rempli : il ne reste qu’à cliquer sur « Submit new issue ». (Le rapport est aussi copié dans ton presse-papiers.)'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="animate-node-appear w-full max-w-2xl rounded-2xl bg-[#1c1a22] border border-[#2d2a37] shadow-card overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#221f29] border-b border-[#2d2a37]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">
                Support & Aide · Signaler un problème
              </h2>
              <p className="text-[11px] text-zinc-400">
                Un souci avec une IA ou une clé ? Diagnostic instantané + envoi direct avec les infos techniques.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleDirectSend} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Smart Instant Diagnosis Banner */}
          <div className="p-3.5 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-[#ff6a3d]" />
                <span>Diagnostic rapide de ta session</span>
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  keysCount > 0 || isDesktop
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                {keysCount > 0
                  ? `✓ ${keysCount} clé(s) API active(s)`
                  : isDesktop
                  ? 'Mode PC Local'
                  : '⚠ 0 clé API configurée'}
              </span>
            </div>

            {keysCount === 0 && !isDesktop && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2 text-[11px] text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Cause probable n°1 :</strong> Tu n’as encore enregistré aucune clé API dans ton navigateur. Sans clé, les IA en ligne ne peuvent pas répondre.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-[#ff6a3d] hover:bg-[#ff7b52] text-white text-[10px] font-semibold"
                  >
                    1. Clé Gratuite Google
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenApiKeys();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#1c1a22] hover:bg-zinc-800 text-zinc-100 border border-[#2d2a37] text-[10px] font-semibold flex items-center gap-1"
                  >
                    <Key className="w-3 h-3 text-[#ff6a3d]" />
                    <span>2. Coller ma clé</span>
                  </button>
                </div>
              </div>
            )}

            {/* Auto-advice based on selected category */}
            <div className="p-2.5 rounded-xl bg-[#1c1a22] border border-[#2d2a37] flex items-center justify-between gap-3">
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                💡 <strong>Solution express :</strong> {selectedCategoryObj.autoAdvice}
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAiHelp();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#14121a] hover:bg-zinc-800 text-[#ff6a3d] border border-[#ff6a3d]/40 text-[10px] font-semibold shrink-0"
              >
                Voir Commandes IA
              </button>
            </div>
          </div>

          {/* Sender Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-200 mb-1">
                Ton Prénom ou Pseudo *
              </label>
              <input
                type="text"
                required
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Ex: Maxime, Théo..."
                className="w-full px-3 py-2 rounded-xl bg-[#14121a] border border-[#2d2a37] text-xs text-zinc-100 focus:outline-none focus:border-[#ff6a3d]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-200 mb-1">
                Où te répondre ? (Discord, Tel, Mail)
              </label>
              <input
                type="text"
                value={senderContact}
                onChange={(e) => setSenderContact(e.target.value)}
                placeholder="Ex: mon_pseudo_discord ou 06..."
                className="w-full px-3 py-2 rounded-xl bg-[#14121a] border border-[#2d2a37] text-xs text-zinc-100 focus:outline-none focus:border-[#ff6a3d]"
              />
            </div>
          </div>

          {/* Problem Category */}
          <div>
            <label className="block text-xs font-medium text-zinc-200 mb-1.5">
              Quel est le souci ?
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {ISSUE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between ${
                    category === cat.id
                      ? 'bg-[#ff6a3d]/15 border-[#ff6a3d] text-white'
                      : 'bg-[#14121a] border-[#2d2a37] text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <span>{cat.label}</span>
                  {category === cat.id && (
                    <Check className="w-3.5 h-3.5 text-[#ff6a3d]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-200 mb-1">
              Explique-moi rapidement ce qui se passe :
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: J'ai cliqué sur Start avec DeepSeek mais ça me met une erreur..."
              className="w-full px-3 py-2 rounded-xl bg-[#14121a] border border-[#2d2a37] text-xs text-zinc-100 focus:outline-none focus:border-[#ff6a3d] resize-none"
            />
          </div>

          {/* Include Diagnostics Checkbox + Optional Discord Webhook */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-zinc-400">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                className="rounded accent-[#ff6a3d]"
              />
              <span>
                Joindre automatiquement le diagnostic technique (IA utilisées, mode Web/PC — sans tes clés privées)
              </span>
            </label>

            <button
              type="button"
              onClick={() => setShowWebhookConfig((v) => !v)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 underline"
            >
              {showWebhookConfig ? 'Masquer Webhook Discord' : 'Option Webhook Discord'}
            </button>
          </div>

          {showWebhookConfig && (
            <div className="p-3 rounded-xl bg-[#14121a] border border-[#2d2a37] space-y-1">
              <label className="text-[11px] font-medium text-zinc-300">
                URL Webhook Discord (Optionnel — pour recevoir les alertes directement sur un salon Discord)
              </label>
              <input
                type="text"
                value={discordWebhook}
                onChange={(e) => setDiscordWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#1c1a22] border border-[#2d2a37] text-xs font-mono text-zinc-200 focus:outline-none focus:border-[#ff6a3d]"
              />
            </div>
          )}

          {/* Feedback message if sent or copied */}
          {statusDetail && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-start gap-2.5 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{statusDetail}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#2d2a37]">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyForDiscord}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#14121a] hover:bg-zinc-800 text-zinc-200 border border-[#2d2a37] text-xs font-medium transition-colors"
                title="Copie un rapport propre à coller sur Discord, WhatsApp ou SMS"
              >
                {sentStatus === 'copied' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copié pour Discord !</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Copier pour Discord / WhatsApp</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenMailto}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#14121a] hover:bg-zinc-800 text-zinc-300 border border-[#2d2a37] text-xs font-medium transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span>Ouvrir un ticket GitHub</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {sending
                  ? 'Envoi en cours...'
                  : sentStatus === 'sent'
                  ? 'Envoyé ✓'
                  : 'Signaler le problème'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
