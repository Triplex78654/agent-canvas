import React, { useState, useEffect } from 'react';
import {
  Key,
  X,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  Trash2,
} from 'lucide-react';
import {
  UserWebApiKeys,
  loadUserWebApiKeys,
  saveUserWebApiKeys,
  shouldRememberUserWebApiKeys,
} from '../services/webAiClient';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [keys, setKeys] = useState<UserWebApiKeys>(() => loadUserWebApiKeys());
  const [rememberKeys, setRememberKeys] = useState(() => shouldRememberUserWebApiKeys());
  const [showSecrets, setShowSecrets] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeys(loadUserWebApiKeys());
      setRememberKeys(shouldRememberUserWebApiKeys());
      setSavedNotice(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveUserWebApiKeys(keys, rememberKeys);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 650);
  };

  const handleClearAll = () => {
    const empty: UserWebApiKeys = {
      openrouterKey: '',
      geminiKey: '',
      anthropicKey: '',
      openaiKey: '',
      qwenKey: '',
      kimiKey: '',
      ollamaUrl: 'http://localhost:11434',
    };
    setKeys(empty);
    setRememberKeys(false);
    saveUserWebApiKeys(empty, false);
  };

  const inputType = showSecrets ? 'text' : 'password';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="animate-node-appear w-full max-w-xl rounded-2xl bg-[#1c1a22] border border-[#2d2a37] shadow-card overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#221f29] border-b border-[#2d2a37]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#ff6a3d]/15 text-[#ff6a3d] border border-[#ff6a3d]/30">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Mes Clés API Personnelles (Mode Web & Cloud)
              </h2>
              <p className="text-[11px] text-zinc-400">
                Utilisez vos propres clés API ou votre Ollama local directement dans le navigateur
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

        {/* Security Banner */}
        <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2.5 text-[11px] text-amber-200">
          <ShieldCheck className="w-4 h-4 shrink-0 text-amber-300" />
          <span>
            <strong>Stockage local :</strong> vos clés restent dans le navigateur et ne sont pas envoyées aux serveurs Agent Canvas. Elles sont toutefois accessibles aux scripts exécutés sur ce site. Ne les ajoutez jamais à un lien et effacez-les si vous utilisez un appareil partagé.
          </span>
        </div>

        <label className="flex items-start gap-2.5 px-5 py-2.5 bg-[#14121a] border-b border-[#2d2a37] text-[11px] text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberKeys}
            onChange={(e) => setRememberKeys(e.target.checked)}
            className="mt-0.5 accent-[#ff6a3d]"
          />
          <span>
            <strong>Mémoriser les clés sur cet appareil</strong>
            <span className="block text-zinc-500">Désactivé par défaut : les clés sont oubliées à la fermeture du navigateur.</span>
          </span>
        </label>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Universal OpenRouter Key */}
          <div className="p-3 rounded-xl bg-[#14121a] border border-[#ff6a3d]/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#ff6a3d]" />
                <span>Clé Universelle OpenRouter (Recommandé · Débloque tous les modèles)</span>
              </label>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ff6a3d]/20 text-[#ff6a3d] font-medium">
                Claude · GPT · Gemini · Qwen · DeepSeek · Kimi
              </span>
            </div>
            <div className="relative">
              <input
                type={inputType}
                value={keys.openrouterKey}
                onChange={(e) => setKeys({ ...keys, openrouterKey: e.target.value })}
                placeholder="sk-or-v1-..."
                className="w-full pl-3 pr-8 py-1.5 rounded-lg bg-[#1c1a22] border border-[#2d2a37] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#ff6a3d]"
              />
              {keys.openrouterKey && (
                <button
                  type="button"
                  onClick={() => setKeys({ ...keys, openrouterKey: '' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-400 transition-colors"
                  title="Effacer la clé OpenRouter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-zinc-400">
              Une seule clé OpenRouter suffit pour faire tourner toutes les consoles du Canvas (y compris avec les modèles gratuits d'OpenRouter).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Google Gemini API Key */}
            <div className="p-2.5 rounded-xl bg-[#14121a] border border-[#2d2a37] space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-200">
                  Google Gemini / AI Studio
                </label>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                  Offre Gratuite dispo
                </span>
              </div>
              <div className="relative">
                <input
                  type={inputType}
                  value={keys.geminiKey}
                  onChange={(e) => setKeys({ ...keys, geminiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full pl-2.5 pr-8 py-1.5 rounded-lg bg-[#1c1a22] border border-[#2d2a37] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#ff6a3d]"
                />
                {keys.geminiKey && (
                  <button
                    type="button"
                    onClick={() => setKeys({ ...keys, geminiKey: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Effacer la clé Gemini"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-400">
                Pour <strong>Gemini CLI</strong> et <strong>Antigravity (Gemini)</strong>.
              </p>
            </div>

            {/* Anthropic Claude Key */}
            <div className="p-2.5 rounded-xl bg-[#14121a] border border-[#2d2a37] space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-200">
                  Anthropic (Claude)
                </label>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  Claude Code
                </span>
              </div>
              <div className="relative">
                <input
                  type={inputType}
                  value={keys.anthropicKey}
                  onChange={(e) => setKeys({ ...keys, anthropicKey: e.target.value })}
                  placeholder="sk-ant-api03-..."
                  className="w-full pl-2.5 pr-8 py-1.5 rounded-lg bg-[#1c1a22] border border-[#2d2a37] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#ff6a3d]"
                />
                {keys.anthropicKey && (
                  <button
                    type="button"
                    onClick={() => setKeys({ ...keys, anthropicKey: '', anthropicWorkspaceId: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Effacer la clé Anthropic"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {keys.anthropicKey && (
                <div className="pt-1">
                  <input
                    type="text"
                    value={keys.anthropicWorkspaceId || ''}
                    onChange={(e) => setKeys({ ...keys, anthropicWorkspaceId: e.target.value })}
                    placeholder="Workspace ID optionnel (ex: wrkspc_...)"
                    className="w-full px-2 py-1 rounded bg-[#1c1a22] border border-[#2d2a37] text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-[#ff6a3d]"
                  />
                </div>
              )}
              <p className="text-[10px] text-zinc-400">
                Pour <strong>Claude Code</strong>. Si votre clé demande un workspace, créez-la dans l'onglet Workspace sur Anthropic ou renseignez son ID ici.
              </p>
            </div>

            {/* OpenAI Codex Key */}
            <div className="p-2.5 rounded-xl bg-[#14121a] border border-[#2d2a37] space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-200">
                  OpenAI (Codex / GPT)
                </label>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  OpenAI Codex
                </span>
              </div>
              <div className="relative">
                <input
                  type={inputType}
                  value={keys.openaiKey}
                  onChange={(e) => setKeys({ ...keys, openaiKey: e.target.value })}
                  placeholder="sk-proj-..."
                  className="w-full pl-2.5 pr-8 py-1.5 rounded-lg bg-[#1c1a22] border border-[#2d2a37] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#ff6a3d]"
                />
                {keys.openaiKey && (
                  <button
                    type="button"
                    onClick={() => setKeys({ ...keys, openaiKey: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Effacer la clé OpenAI"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-400">
                Pour les consoles <strong>OpenAI Codex</strong>.
              </p>
            </div>

            {/* Qwen / DashScope Key */}
            <div className="p-2.5 rounded-xl bg-[#14121a] border border-[#2d2a37] space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-200">
                  Qwen (Alibaba DashScope)
                </label>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                  Qwen Code
                </span>
              </div>
              <div className="relative">
                <input
                  type={inputType}
                  value={keys.qwenKey}
                  onChange={(e) => setKeys({ ...keys, qwenKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full pl-2.5 pr-8 py-1.5 rounded-lg bg-[#1c1a22] border border-[#2d2a37] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#ff6a3d]"
                />
                {keys.qwenKey && (
                  <button
                    type="button"
                    onClick={() => setKeys({ ...keys, qwenKey: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Effacer la clé Qwen"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-400">
                Pour les consoles <strong>Qwen Code</strong>.
              </p>
            </div>

            {/* Moonshot Kimi Key */}
            <div className="p-2.5 rounded-xl bg-[#14121a] border border-[#2d2a37] space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-200">
                  Moonshot AI (Kimi K2)
                </label>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  Kimi K2
                </span>
              </div>
              <div className="relative">
                <input
                  type={inputType}
                  value={keys.kimiKey}
                  onChange={(e) => setKeys({ ...keys, kimiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full pl-2.5 pr-8 py-1.5 rounded-lg bg-[#1c1a22] border border-[#2d2a37] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#ff6a3d]"
                />
                {keys.kimiKey && (
                  <button
                    type="button"
                    onClick={() => setKeys({ ...keys, kimiKey: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Effacer la clé Kimi"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-400">
                Pour les consoles <strong>Kimi K2 CLI</strong>.
              </p>
            </div>

            {/* Ollama Local URL */}
            <div className="p-2.5 rounded-xl bg-[#14121a] border border-[#2d2a37] space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-200 flex items-center gap-1">
                  <Server className="w-3 h-3 text-emerald-400" />
                  <span>Ollama Local (100% Gratuit)</span>
                </label>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  0 € Sans clé
                </span>
              </div>
              <input
                type="text"
                value={keys.ollamaUrl}
                onChange={(e) => setKeys({ ...keys, ollamaUrl: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#1c1a22] border border-[#2d2a37] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#ff6a3d]"
              />
              <p className="text-[10px] text-zinc-400">
                Pour <strong>Ollama</strong> et <strong>DeepSeek R1 Local</strong>.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[#2d2a37]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSecrets((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#14121a] hover:bg-zinc-800 text-zinc-300 text-xs border border-[#2d2a37]"
              >
                {showSecrets ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Masquer</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Afficher les clés</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#14121a] hover:bg-red-500/15 text-zinc-400 hover:text-red-300 text-xs border border-[#2d2a37]"
                title="Effacer toutes les clés de ce navigateur"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Tout effacer</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-[#14121a] hover:bg-zinc-800 text-zinc-300 text-xs border border-[#2d2a37]"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#ff6a3d] hover:bg-[#ff7b52] text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savedNotice ? 'Enregistré !' : 'Enregistrer mes clés'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
