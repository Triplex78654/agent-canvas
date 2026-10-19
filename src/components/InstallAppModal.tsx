import React, { useEffect, useState } from 'react';
import {
  Download,
  Monitor,
  Sparkles,
  CheckCircle2,
  X,
  Laptop,
  ExternalLink,
  Terminal,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __agentCanvasDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  open,
  onClose,
}) => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(
      () => window.__agentCanvasDeferredPrompt || null
    );
  const [isInstalled, setIsInstalled] = useState(false);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true ||
        Boolean(window.agentCanvasAPI) ||
        localStorage.getItem('agent-canvas-app-installed') === 'true';
      setIsInstalled(standalone);
    };
    checkStandalone();

    const syncDeferred = () => {
      setDeferredPrompt(window.__agentCanvasDeferredPrompt || null);
    };
    const onAppInstalled = () => {
      window.__agentCanvasDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      setInstallFeedback(
        'Application installée avec succès ! Elle est maintenant sur votre Bureau et dans votre menu Démarrer.'
      );
    };

    window.addEventListener('agent-canvas-pwa-ready', syncDeferred);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('agent-canvas-pwa-ready', syncDeferred);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [open]);

  if (!open) return null;

  const handleOneClickPwaInstall = async () => {
    const promptEvent = deferredPrompt || window.__agentCanvasDeferredPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          window.__agentCanvasDeferredPrompt = null;
          setDeferredPrompt(null);
          setIsInstalled(true);
          localStorage.setItem('agent-canvas-app-installed', 'true');
          window.dispatchEvent(new CustomEvent('agent-canvas-app-installed-changed'));
          setInstallFeedback(
            'Super ! Agent Canvas est installé comme une vraie application sur votre PC.'
          );
        }
      } catch (_) {}
    } else {
      setInstallFeedback(
        'Astuce : Cliquez sur le bouton "Télécharger le Lanceur Windows (.bat)" juste en dessous, ou cliquez sur la petite icône d’écran 📲 tout à droite de la barre d’adresse de votre navigateur (Chrome / Edge / Brave).'
      );
    }
  };

  const handleDownloadWindowsLauncher = () => {
    localStorage.setItem('agent-canvas-app-installed', 'true');
    window.dispatchEvent(new CustomEvent('agent-canvas-app-installed-changed'));
    const link = document.createElement('a');
    link.href = '/Agent-Canvas-Desktop.bat';
    link.download = 'Agent-Canvas-Desktop.bat';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setInstallFeedback(
      'Lanceur téléchargé ! Lancez-le une seule fois : il crée automatiquement le vrai raccourci "Agent Canvas" AVEC SON ICÔNE OFFICIELLE sur votre Bureau Windows et dans le menu Démarrer !'
    );
  };

  const handleCopyLocalCmd = () => {
    navigator.clipboard.writeText('npm install && npm run dev');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-text">
      <div className="w-full max-w-2xl rounded-3xl bg-[#181620] border border-[#2d2a37] shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#201d29] border-b border-[#2d2a37]">
          <div className="flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt="Agent Canvas App Icon"
              className="w-11 h-11 rounded-2xl border border-[#ff6a3d]/50 shadow-[0_0_16px_-2px_rgba(255,106,61,0.5)]"
            />
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Installer l’App Agent Canvas sur PC / Mac</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Avec Icône Bureau
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Pour toi et tes potes : installez le raccourci avec la vraie icône Agent Canvas sur le Bureau !
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#14121a] hover:bg-zinc-800 text-zinc-400 hover:text-white border border-[#2d2a37] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {isInstalled && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-semibold">
                  Vous utilisez déjà Agent Canvas en mode Application !
                </div>
                <div className="text-emerald-300/80 text-[11px]">
                  Vous pouvez épingler l’icône dans votre barre des tâches Windows ou sur votre Bureau.
                </div>
              </div>
            </div>
          )}

          {installFeedback && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#ff6a3d]/15 border border-[#ff6a3d]/40 text-zinc-100 text-xs">
              <Sparkles className="w-4 h-4 text-[#ff6a3d] shrink-0 mt-0.5" />
              <span>{installFeedback}</span>
            </div>
          )}

          {/* Option 1: 1-Click Native Web App Install */}
          <div className="p-4 rounded-2xl bg-[#14121a] border-2 border-[#ff6a3d]/60 space-y-3 shadow-[0_0_30px_-8px_rgba(255,106,61,0.3)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#ff6a3d]/20 text-[#ff6a3d]">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      Méthode 1 : Installation Directe en 1 Clic
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ff6a3d] text-white">
                      Le plus simple
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Installe Agent Canvas comme une vraie application Windows / Mac (icône sur le Bureau + Menu Démarrer, fenêtre dédiée sans barre d’adresse, mises à jour automatiques).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleOneClickPwaInstall}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7d55] text-white text-xs font-bold shadow-[0_0_20px_-3px_rgba(255,106,61,0.65)] transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {deferredPrompt
                    ? 'Installer l’App sur mon PC maintenant (1 clic)'
                    : 'Lancer l’installation Bureau'}
                </span>
              </button>

              <span className="text-[11px] text-zinc-400">
                Compatible Chrome, Edge, Brave, Opera (Windows & Mac)
              </span>
            </div>

            <div className="text-[11px] text-zinc-400 bg-[#1c1a22] p-2.5 rounded-xl border border-[#2d2a37] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Alternative dans la barre d’adresse :</strong> Vous pouvez aussi cliquer sur la petite icône d’écran avec une flèche <strong>📲 Installer Agent Canvas</strong> tout à droite de la barre d’URL de votre navigateur.
              </span>
            </div>
          </div>

          {/* Option 2: Downloadable Windows Desktop Launcher (.bat) */}
          <div className="p-4 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    Méthode 2 : Télécharger le Lanceur Bureau Windows (.bat)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                    Spécial Potes Windows
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Télécharge un petit lanceur que tes potes peuvent garder sur leur Bureau : un double-clic ouvre directement Agent Canvas en fenêtre d’application dédiée et crée le raccourci Bureau automatiquement !
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadWindowsLauncher}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/50 text-xs font-semibold transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-sky-300" />
                <span>Télécharger Agent-Canvas-Desktop.bat</span>
              </button>
              <span className="text-[11px] text-zinc-500">
                Poids : 1 Ko · Aucun installateur lourd requis
              </span>
            </div>
          </div>

          {/* Option 3: Local Electron Mode */}
          <div className="p-4 rounded-2xl bg-[#14121a] border border-[#2d2a37] space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-200">
                  Méthode 3 (Avancé) : Application Electron Locale avec vrais terminaux PowerShell & Ollama
                </div>
                <p className="text-[11px] text-zinc-400">
                  Pour piloter vos propres CLI installés sur le PC (Ollama local, Claude Code CLI, System Shell) :
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#1c1a22] border border-[#2d2a37] font-mono text-xs text-zinc-200">
              <span>npm install && npm run dev</span>
              <button
                type="button"
                onClick={handleCopyLocalCmd}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#14121a] hover:bg-zinc-800 text-zinc-300 border border-[#2d2a37] text-[10px] font-sans"
              >
                {copiedCmd ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-[#201d29] border-t border-[#2d2a37]">
          <a
            href="https://agent-canvas.pages.dev"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-400 hover:text-[#ff6a3d] flex items-center gap-1 transition-colors"
          >
            <span>Lien à partager aux potes : https://agent-canvas.pages.dev</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
