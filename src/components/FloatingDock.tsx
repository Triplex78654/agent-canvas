import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  LayoutGrid,
  Users,
  Bookmark,
  PauseCircle,
  PlayCircle,
  TextCursorInput,
  BrainCircuit,
  Send,
  Mic,
  MicOff,
  AtSign,
  Sparkles,
  Check,
  X,
  Trash2,
  FolderDown,
  Save,
  Copy,
  FolderGit2,
  Clock,
} from 'lucide-react';
import {
  AgentStatus,
  CanvasPreset,
  CommandTargetOption,
} from '../types';
import {
  startVoiceDictation,
  VoiceDictationController,
  playCanvasSound,
} from '../services/teamCollabBus';

interface FloatingDockProps {
  targets: CommandTargetOption[];
  selectedConsolesCount: number;
  allPaused: boolean;
  presets: CanvasPreset[];
  memoryNotes: string;
  onChangeMemoryNotes: (notes: string) => void;
  onNewConsole: () => void;
  onSpawnFour: () => void;
  onSpawnFreeSquad: () => void;
  onGroup: () => void;
  onTogglePauseAll: () => void;
  onRenameAll: (prefix: string) => void;
  onSavePreset: (name: string, description: string) => void;
  onLoadPreset: (preset: CanvasPreset) => void;
  onDeletePreset: (id: string) => void;
  onSendCommand: (target: CommandTargetOption, prompt: string) => void;
  onOpenTemplates?: () => void;
  onSpawnWorkspace?: () => void;
  onSpawnTrigger?: () => void;
}

const STATUS_DOT: Record<AgentStatus, string> = {
  running: 'bg-[#22c55e] shadow-[0_0_6px_#22c55e]',
  waiting: 'bg-[#f97316] shadow-[0_0_6px_#f97316]',
  idle: 'bg-[#71717a]',
  error: 'bg-[#ef4444] shadow-[0_0_6px_#ef4444]',
};

export const FloatingDock: React.FC<FloatingDockProps> = ({
  targets,
  selectedConsolesCount,
  allPaused,
  presets,
  memoryNotes,
  onChangeMemoryNotes,
  onNewConsole,
  onSpawnFour,
  onSpawnFreeSquad,
  onGroup,
  onTogglePauseAll,
  onRenameAll,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onSendCommand,
  onOpenTemplates,
  onSpawnWorkspace,
  onSpawnTrigger,
}) => {
  // Active popover panel: 'presets' | 'rename' | 'memory' | null
  const [activePopover, setActivePopover] = useState<'presets' | 'rename' | 'memory' | null>(null);

  // Command bar states
  const [commandInput, setCommandInput] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<CommandTargetOption>(
    targets[0] || {
      id: 'all',
      kind: 'all',
      handle: '@all',
      label: 'Tous les agents',
      subtitle: 'Broadcast global',
    }
  );
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [sentFeedback, setSentFeedback] = useState<string | null>(null);

  // Rename all states
  const [renamePrefix, setRenamePrefix] = useState('Agent');

  // New preset form states
  const [presetName, setPresetName] = useState('');
  const [presetDesc, setPresetDesc] = useState('');

  // Shared memory copy feedback
  const [copiedMemory, setCopiedMemory] = useState(false);

  // Speech recognition (Click button or hold Space) - Universal support with browser Speech API + MediaRecorder AI fallback
  const [speechSupported] = useState(() => {
    return Boolean(
      typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition ||
          window.navigator?.mediaDevices?.getUserMedia)
    );
  });
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const voiceCtrlRef = useRef<VoiceDictationController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep selectedTarget valid when targets list updates
  useEffect(() => {
    if (!targets.length) return;
    const stillExists = targets.find((t) => t.id === selectedTarget.id);
    if (stillExists) {
      setSelectedTarget(stillExists);
    } else {
      setSelectedTarget(targets[0]);
    }
  }, [targets]);

  const [audioLevel, setAudioLevel] = useState(0);
  const baseInputRef = useRef('');

  const toggleVoice = () => {
    if (isListening) {
      voiceCtrlRef.current?.stop();
      voiceCtrlRef.current = null;
      setIsListening(false);
      setVoiceNotice(null);
      setAudioLevel(0);
    } else {
      setIsListening(true);
      setVoiceNotice('Microphone actif...');
      setAudioLevel(0);
      baseInputRef.current = commandInput.trim();

      const ctrl = startVoiceDictation({
        onTranscript: (finalText, interimText) => {
          const parts = [baseInputRef.current, finalText, interimText].filter(Boolean);
          setCommandInput(parts.join(' '));
          const preview = interimText || finalText;
          if (preview) {
            setVoiceNotice(`🎙️ "${preview.slice(0, 30)}"`);
          }
        },
        onAudioLevel: (level) => {
          setAudioLevel(level);
        },
        onEnd: () => {
          setIsListening(false);
          voiceCtrlRef.current = null;
          setVoiceNotice(null);
          setAudioLevel(0);
        },
        onError: (err) => {
          setVoiceNotice(`⚠️ ${err}`);
          setIsListening(false);
          voiceCtrlRef.current = null;
          setAudioLevel(0);
          playCanvasSound('alert');
          setTimeout(() => setVoiceNotice(null), 8000);
        },
        onStatusChange: (status) => {
          if (status === 'requesting_permission') {
            setVoiceNotice('Autorisation micro requise...');
          } else if (status === 'listening') {
            setVoiceNotice('Écoute active · Parlez en français');
          } else if (status === 'recording_fallback') {
            setVoiceNotice('🎙️ Dictée IA active (Brave/Adblock) · Parlez puis recliquez');
          } else if (status === 'transcribing') {
            setVoiceNotice('🧠 Transcription IA par Gemini / Whisper...');
          } else if (status === 'idle') {
            setVoiceNotice(null);
          }
        },
      });

      if (ctrl) {
        voiceCtrlRef.current = ctrl;
        playCanvasSound('relay');
      } else {
        setIsListening(false);
      }
    }
  };

  // Hold Spacebar when no input/textarea is focused to dictate
  useEffect(() => {
    if (!speechSupported) return;

    const isTypingInElement = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        (el as HTMLElement).isContentEditable ||
        el.closest('.xterm') !== null
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isTypingInElement() && !isListening) {
        e.preventDefault();
        toggleVoice();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isListening && !isTypingInElement()) {
        toggleVoice();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [speechSupported, isListening]);

  // Filtered @ mention targets
  const filteredTargets = useMemo(() => {
    const q = mentionQuery.toLowerCase().trim();
    if (!q) return targets;
    return targets.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.handle.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q)
    );
  }, [targets, mentionQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCommandInput(val);

    // Detect @mention trigger
    const atMatch = val.match(/(?:^|\s)@([^\s]*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1] || '');
      setShowMentionMenu(true);
      setMentionIndex(0);
    } else {
      setShowMentionMenu(false);
    }
  };

  const applyTargetSelection = (target: CommandTargetOption) => {
    setSelectedTarget(target);
    // Remove trailing @query from input if present
    setCommandInput((prev) => prev.replace(/(?:^|\s)@([^\s]*)$/, '').trimStart());
    setShowMentionMenu(false);
    inputRef.current?.focus();
  };

  const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionMenu && filteredTargets.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredTargets.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredTargets.length) % filteredTargets.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyTargetSelection(filteredTargets[mentionIndex] || filteredTargets[0]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !showMentionMenu) {
      e.preventDefault();
      handleSubmitCommand();
    }
  };

  const handleSubmitCommand = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = commandInput.trim();
    if (!cleaned) return;
    onSendCommand(selectedTarget, cleaned);
    setCommandInput('');
    setShowMentionMenu(false);
    setSentFeedback(`Envoyé à ${selectedTarget.label}`);
    setTimeout(() => setSentFeedback(null), 1800);
  };

  const togglePopover = (panel: 'presets' | 'rename' | 'memory') => {
    setActivePopover((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="app-floating-dock absolute bottom-5 left-1/2 z-30 flex w-full max-w-[980px] -translate-x-1/2 flex-col items-center gap-2.5 px-4 pointer-events-none">
      {/* Contextual Popovers Above Toolbar */}
      {activePopover === 'presets' && (
        <div className="pointer-events-auto animate-node-appear w-full max-w-[620px] rounded-2xl bg-[#1c1a22]/95 backdrop-blur-xl border border-[#2d2a37] shadow-card p-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#2d2a37]">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#ff6a3d]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
                Presets de disposition Canvas
              </span>
            </div>
            <button
              onClick={() => setActivePopover(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3 max-h-[210px] overflow-y-auto pr-1">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex flex-col justify-between p-3 rounded-xl bg-[#14121a] border border-[#2d2a37] hover:border-[#ff6a3d]/50 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-100 truncate">
                      {preset.name}
                    </span>
                    {preset.builtIn ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1a22] text-[#ff6a3d] border border-[#2d2a37]">
                        Built-in
                      </span>
                    ) : (
                      <button
                        onClick={() => onDeletePreset(preset.id)}
                        className="text-zinc-500 hover:text-red-400 p-0.5"
                        title="Supprimer ce preset"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                    {preset.description}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#2d2a37]/60">
                  <span className="text-[10px] font-mono text-zinc-500">
                    {preset.nodes.filter((n) => n.type === 'consoleNode').length} consoles
                  </span>
                  <button
                    onClick={() => {
                      onLoadPreset(preset);
                      setActivePopover(null);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ff6a3d]/15 hover:bg-[#ff6a3d] text-[#ff6a3d] hover:text-white text-[11px] font-medium transition-colors"
                  >
                    <FolderDown className="w-3 h-3" />
                    <span>Charger</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Save current canvas as preset */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!presetName.trim()) return;
              onSavePreset(
                presetName.trim(),
                presetDesc.trim() || 'Disposition personnalisée sauvegardée'
              );
              setPresetName('');
              setPresetDesc('');
            }}
            className="flex items-center gap-2 pt-3 border-t border-[#2d2a37]"
          >
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nom du nouveau preset..."
              className="flex-1 bg-[#14121a] border border-[#2d2a37] focus:border-[#ff6a3d] rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
            />
            <input
              type="text"
              value={presetDesc}
              onChange={(e) => setPresetDesc(e.target.value)}
              placeholder="Description courte (optionnel)"
              className="flex-1 bg-[#14121a] border border-[#2d2a37] focus:border-[#ff6a3d] rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!presetName.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] disabled:opacity-40 text-white text-xs font-medium transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Sauvegarder</span>
            </button>
          </form>
        </div>
      )}

      {activePopover === 'rename' && (
        <div className="pointer-events-auto animate-node-appear w-full max-w-[440px] rounded-2xl bg-[#1c1a22]/95 backdrop-blur-xl border border-[#2d2a37] shadow-card p-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#2d2a37]">
            <div className="flex items-center gap-2">
              <TextCursorInput className="w-4 h-4 text-[#ff6a3d]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
                Renommer toutes les consoles en série
              </span>
            </div>
            <button
              onClick={() => setActivePopover(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRenameAll(renamePrefix.trim() || 'Agent');
              setActivePopover(null);
            }}
            className="mt-3 flex items-center gap-2"
          >
            <input
              type="text"
              value={renamePrefix}
              onChange={(e) => setRenamePrefix(e.target.value)}
              placeholder="Préfixe (ex: Worker, Agent, Node)..."
              autoFocus
              className="flex-1 bg-[#14121a] border border-[#2d2a37] focus:border-[#ff6a3d] rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] text-white text-xs font-medium transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Appliquer ({renamePrefix || 'Agent'} #1, #2...)</span>
            </button>
          </form>
        </div>
      )}

      {activePopover === 'memory' && (
        <div className="pointer-events-auto animate-node-appear w-full max-w-[580px] rounded-2xl bg-[#1c1a22]/95 backdrop-blur-xl border border-[#2d2a37] shadow-card p-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#2d2a37]">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-[#ff6a3d]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
                Memory · Notes & Contexte partagés
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (!memoryNotes.trim()) return;
                  setCommandInput(memoryNotes.trim().replace(/\r?\n/g, ' '));
                  setActivePopover(null);
                  inputRef.current?.focus();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ff6a3d]/15 hover:bg-[#ff6a3d]/25 text-[#ff6a3d] text-[11px] font-medium transition-colors"
                title="Copier dans la barre de commande pour l'envoyer à un agent ou une équipe"
              >
                <Sparkles className="w-3 h-3" />
                <span>Injecter dans le prompt</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(memoryNotes);
                  setCopiedMemory(true);
                  setTimeout(() => setCopiedMemory(false), 1400);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#14121a] hover:bg-zinc-800 text-zinc-300 text-[11px] border border-[#2d2a37]"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedMemory ? 'Copié !' : 'Copier'}</span>
              </button>
              <button
                onClick={() => setActivePopover(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <textarea
            rows={5}
            value={memoryNotes}
            onChange={(e) => onChangeMemoryNotes(e.target.value)}
            placeholder="Consignes globales du projet, conventions d'architecture, objectifs d'équipe ou prompts récurrents (sauvegardé automatiquement)..."
            className="mt-3 w-full rounded-xl bg-[#14121a] border border-[#2d2a37] focus:border-[#ff6a3d] p-3 text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none resize-none"
          />
        </div>
      )}

      {/* @Mention Autocomplete Dropdown */}
      {showMentionMenu && filteredTargets.length > 0 && (
        <div className="pointer-events-auto animate-node-appear w-full max-w-[520px] rounded-2xl bg-[#1c1a22]/95 backdrop-blur-xl border border-[#ff6a3d]/50 shadow-accent-glow overflow-hidden">
          <div className="px-3 py-1.5 bg-[#221f29] border-b border-[#2d2a37] flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            <span>Cibler un agent ou une équipe (@)</span>
            <span>↑↓ Naviguer · Entrée Valider</span>
          </div>
          <div className="max-h-[190px] overflow-y-auto p-1.5 space-y-1">
            {filteredTargets.map((t, idx) => {
              const active = idx === mentionIndex;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTargetSelection(t)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                    active
                      ? 'bg-[#ff6a3d]/20 text-white border border-[#ff6a3d]/50'
                      : 'text-zinc-300 hover:bg-[#24212c] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {t.status ? (
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[t.status]}`} />
                    ) : (
                      <AtSign className="w-3.5 h-3.5 text-[#ff6a3d]" />
                    )}
                    <span className="font-mono text-[#ff6a3d] font-medium">
                      {t.handle}
                    </span>
                    <span className="font-medium text-zinc-100 truncate">
                      {t.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {t.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 1. Floating Toolbar */}
      <div className="app-dock-toolbar pointer-events-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1c1a22]/95 backdrop-blur-xl border border-[#2d2a37] shadow-card whitespace-nowrap">
        <button
          onClick={onNewConsole}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] text-white text-xs font-medium shadow-[0_0_16px_-3px_rgba(255,106,61,0.55)] transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New console</span>
        </button>

        <button
          onClick={onSpawnFour}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#24212c] hover:bg-[#2d2a37] text-zinc-100 border border-[#2d2a37] text-xs font-medium transition-all cursor-pointer"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-[#ff6a3d]" />
          <span>Spawn 4</span>
        </button>

        <button
          onClick={onSpawnFreeSquad}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-medium transition-all cursor-pointer"
          title="Créer 4 agents IA 100% Gratuits en grille : Qwen Code, Ollama Local, Kimi K2 et DeepSeek R1"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Spawn 4 Free</span>
        </button>

        <button
          onClick={onGroup}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#24212c] hover:bg-[#ff6a3d]/20 text-zinc-100 hover:text-[#ff6a3d] border border-[#2d2a37] hover:border-[#ff6a3d]/40 text-xs font-medium transition-all cursor-pointer"
          title="Regrouper les consoles sélectionnées (ou libres) en équipe avec Orchestrateur"
        >
          <Users className="w-3.5 h-3.5 text-[#ff6a3d]" />
          <span>
            Group{selectedConsolesCount > 0 ? ` (${selectedConsolesCount})` : ''}
          </span>
        </button>

        <div className="h-4 w-[1px] bg-[#2d2a37] mx-0.5" />

        <button
          onClick={() => togglePopover('presets')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
            activePopover === 'presets'
              ? 'bg-[#ff6a3d]/20 border-[#ff6a3d] text-[#ff6a3d]'
              : 'bg-[#24212c] hover:bg-[#2d2a37] border-[#2d2a37] text-zinc-200'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5 text-[#ff6a3d]" />
          <span>Presets</span>
        </button>

        <button
          onClick={onTogglePauseAll}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
            allPaused
              ? 'bg-[#f97316]/20 border-[#f97316]/60 text-[#f97316]'
              : 'bg-[#24212c] hover:bg-[#2d2a37] border-[#2d2a37] text-zinc-200'
          }`}
        >
          {allPaused ? (
            <>
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Resume all</span>
            </>
          ) : (
            <>
              <PauseCircle className="w-3.5 h-3.5 text-zinc-400" />
              <span>Pause all</span>
            </>
          )}
        </button>

        <button
          onClick={() => togglePopover('rename')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
            activePopover === 'rename'
              ? 'bg-[#ff6a3d]/20 border-[#ff6a3d] text-[#ff6a3d]'
              : 'bg-[#24212c] hover:bg-[#2d2a37] border-[#2d2a37] text-zinc-200'
          }`}
        >
          <TextCursorInput className="w-3.5 h-3.5 text-zinc-400" />
          <span>Rename all</span>
        </button>

        <button
          onClick={() => togglePopover('memory')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
            activePopover === 'memory'
              ? 'bg-[#ff6a3d]/20 border-[#ff6a3d] text-[#ff6a3d]'
              : 'bg-[#24212c] hover:bg-[#2d2a37] border-[#2d2a37] text-zinc-200'
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5 text-[#ff6a3d]" />
          <span>Memory</span>
        </button>

        <div className="h-4 w-[1px] bg-[#2d2a37] mx-0.5" />

        <button
          onClick={onOpenTemplates}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-medium transition-all cursor-pointer"
          title="Ouvrir la bibliothèque de missions & prompts prédéfinis"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Missions</span>
        </button>

        <button
          onClick={onSpawnWorkspace}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-all cursor-pointer"
          title="Ajouter un panneau Workspace & Git Status sur le canvas"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Workspace</span>
        </button>

        <button
          onClick={onSpawnTrigger}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all cursor-pointer"
          title="Ajouter un Trigger automatisé (Timer / Cron / Boost) sur le canvas"
        >
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Trigger</span>
        </button>
      </div>

      {/* 2. Command Bar Beneath Toolbar */}
      <form
        onSubmit={handleSubmitCommand}
        className="pointer-events-auto w-full flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#1c1a22]/95 backdrop-blur-xl border border-[#2d2a37] focus-within:border-[#ff6a3d]/80 focus-within:shadow-accent-glow shadow-card transition-all"
      >
        {/* Target Pill Selector (Click to open @ menu) */}
        <button
          type="button"
          onClick={() => setShowMentionMenu((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#14121a] hover:bg-[#24212c] border border-[#ff6a3d]/40 text-xs font-mono text-[#ff6a3d] shrink-0 transition-colors"
          title="Cliquer ou taper @ pour changer la cible"
        >
          <AtSign className="w-3 h-3" />
          <span className="font-semibold">{selectedTarget.label}</span>
        </button>

        {/* Prompt Input */}
        <input
          ref={inputRef}
          type="text"
          value={commandInput}
          onChange={handleInputChange}
          onKeyDown={handleCommandKeyDown}
          placeholder="Tape @ pour cibler un agent ou une équipe, puis écris ton prompt..."
          className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none font-sans"
        />

        {sentFeedback && (
          <span className="text-[11px] text-emerald-400 font-medium shrink-0 animate-pulse">
            {sentFeedback}
          </span>
        )}

        {voiceNotice && (
          <div className="flex items-center gap-1 shrink-0 max-w-[280px] sm:max-w-[380px] text-[11px] text-amber-300 font-medium">
            <span className="truncate" title={voiceNotice}>
              {voiceNotice}
            </span>
            {voiceNotice.includes('Clés API') && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('agent-canvas-open-api-keys'))}
                className="px-1.5 py-0.5 rounded bg-[#ff6a3d] hover:bg-[#ff825c] text-white font-bold text-[9px] shrink-0 transition-colors shadow"
                title="Ouvrir la configuration des clés API"
              >
                Clés API
              </button>
            )}
          </div>
        )}

        {/* Voice Dictation Button (Click to toggle or hold Space) */}
        {speechSupported ? (
          <button
            type="button"
            onClick={toggleVoice}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
              isListening
                ? 'bg-red-500 text-white border-red-400 shadow-[0_0_16px_#ef4444] animate-pulse'
                : 'bg-[#14121a] text-zinc-400 hover:text-zinc-200 border-[#2d2a37]'
            }`}
            title={
              isListening
                ? 'Microphone actif (cliquer pour arrêter)'
                : 'Dicter vocalement (cliquer pour activer, ou maintenir Espace)'
            }
          >
            {isListening ? (
              <>
                <div className="flex items-end gap-0.5 h-3 shrink-0" title={`Volume: ${audioLevel}%`}>
                  <span
                    className="w-0.5 bg-white rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(25, audioLevel)}%` }}
                  />
                  <span
                    className="w-0.5 bg-amber-200 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(15, audioLevel * 0.8)}%` }}
                  />
                  <span
                    className="w-0.5 bg-white rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(30, audioLevel * 1.2)}%` }}
                  />
                </div>
                <MicOff className="w-3.5 h-3.5" />
              </>
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isListening ? 'Écoute...' : 'Micro'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#14121a]/60 text-zinc-600 border border-[#2d2a37]/50 text-[11px] cursor-not-allowed shrink-0"
            title="Reconnaissance vocale non supportée sur ce navigateur (utilisez Chrome/Edge)"
          >
            <MicOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vocal off</span>
          </button>
        )}

        {/* Send Prompt Button */}
        <button
          type="submit"
          disabled={!commandInput.trim()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] disabled:opacity-40 text-white text-xs font-medium shadow-[0_0_14px_-2px_rgba(255,106,61,0.5)] transition-all shrink-0 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Envoyer</span>
        </button>
      </form>
    </div>
  );
};
