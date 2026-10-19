import React, { useEffect, useRef, useState } from 'react';
import { Handle, NodeProps, Position } from '@xyflow/react';
import {
  Radio,
  Send,
  Play,
  Square,
  Sparkles,
  CheckCircle2,
  Share2,
  GitBranch,
  MessageSquare,
  Zap,
  ArrowRight,
  X,
  Layers,
  Combine,
  Mic,
  MicOff,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import {
  AgentStatus,
  OrchestratorNodeData,
  TeamCollabMode,
} from '../types';
import {
  getTeamInterAgentMessages,
  getSpecialistRoleForIndex,
  getAiEngineProfile,
  InterAgentMessage,
  startVoiceDictation,
  VoiceDictationController,
  playCanvasSound,
} from '../services/teamCollabBus';

const STATUS_DOT: Record<AgentStatus, string> = {
  running: 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]',
  waiting: 'bg-[#f97316] shadow-[0_0_8px_#f97316]',
  idle: 'bg-[#71717a]',
  error: 'bg-[#ef4444] shadow-[0_0_8px_#ef4444]',
};

export const OrchestratorNode: React.FC<NodeProps> = ({ data, selected }) => {
  const orchData = data as unknown as OrchestratorNodeData;
  const [prompt, setPrompt] = useState(orchData.suggestedPrompt || '');
  // Starter team: show the example mission as soon as it is attached (only if the box is still empty).
  useEffect(() => {
    if (orchData.suggestedPrompt) setPrompt((current) => current || orchData.suggestedPrompt || '');
  }, [orchData.suggestedPrompt]);
  const [autoStartIdle, setAutoStartIdle] = useState(true);
  const [justSent, setJustSent] = useState(false);
  const [relayNotice, setRelayNotice] = useState<string | null>(null);
  const [synthesisNotice, setSynthesisNotice] = useState<string | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceController, setVoiceController] = useState<VoiceDictationController | null>(null);
  const basePromptRef = useRef('');
  const [teamMessages, setTeamMessages] = useState<InterAgentMessage[]>(() =>
    getTeamInterAgentMessages(orchData.teamId)
  );

  const collabMode: TeamCollabMode = orchData.collabMode || 'split';
  const members = orchData.members || [];
  const runningCount = members.filter((m) => m.status === 'running').length;

  const handleToggleVoice = () => {
    if (isVoiceListening) {
      voiceController?.stop();
      setIsVoiceListening(false);
      setVoiceController(null);
      setVoiceStatus(null);
      setVoiceError(null);
      setAudioLevel(0);
    } else {
      setIsVoiceListening(true);
      setVoiceError(null);
      setAudioLevel(0);
      setVoiceStatus('Initialisation du micro...');
      basePromptRef.current = prompt.trim();

      const ctrl = startVoiceDictation({
        onTranscript: (finalText, interimText) => {
          const parts = [basePromptRef.current, finalText, interimText].filter(Boolean);
          setPrompt(parts.join(' '));
          const preview = interimText || finalText;
          if (preview) {
            setVoiceStatus(`🎙️ "${preview.slice(0, 32)}"`);
          }
        },
        onAudioLevel: (level) => {
          setAudioLevel(level);
        },
        onEnd: () => {
          setIsVoiceListening(false);
          setVoiceController(null);
          setVoiceStatus(null);
          setAudioLevel(0);
        },
        onError: (err) => {
          setVoiceError(err);
          setVoiceStatus(null);
          setIsVoiceListening(false);
          setVoiceController(null);
          setAudioLevel(0);
          playCanvasSound('alert');
          setTimeout(() => setVoiceError(null), 7000);
        },
        onStatusChange: (status) => {
          if (status === 'requesting_permission') {
            setVoiceStatus('Autorisation micro requise...');
          } else if (status === 'listening') {
            setVoiceStatus('Écoute active · Parlez en français');
          } else if (status === 'recording_fallback') {
            setVoiceStatus('🎙️ Dictée IA (Brave/Adblock) · Parlez puis cliquez Terminer');
          } else if (status === 'transcribing') {
            setVoiceStatus('🧠 Transcription IA par Gemini / Whisper...');
          } else if (status === 'idle') {
            setVoiceStatus(null);
          }
        },
      });

      if (ctrl) {
        setVoiceController(ctrl);
        playCanvasSound('relay');
      } else {
        setIsVoiceListening(false);
      }
    }
  };

  useEffect(() => {
    setTeamMessages(getTeamInterAgentMessages(orchData.teamId));
    const handleBusUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ teamId: string }>;
      if (custom.detail?.teamId === orchData.teamId) {
        setTeamMessages([...getTeamInterAgentMessages(orchData.teamId)]);
      }
    };
    window.addEventListener('agent-canvas-team-bus-updated', handleBusUpdate);
    return () => {
      window.removeEventListener('agent-canvas-team-bus-updated', handleBusUpdate);
    };
  }, [orchData.teamId]);

  const handleSelectMode = (mode: TeamCollabMode) => {
    orchData.onChangeCollabMode?.(orchData.teamId, mode);
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (orchData.onBroadcastToTeam) {
      orchData.onBroadcastToTeam(
        orchData.teamId,
        trimmed,
        autoStartIdle,
        collabMode
      );
      setPrompt('');
      setJustSent(true);
      setTimeout(() => setJustSent(false), 2400);
    } else {
      console.warn('[Orchestrator] onBroadcastToTeam not attached to node data');
    }
  };

  const handleManualRelay = (fromNodeId?: string) => {
    orchData.onTriggerTeamRelay?.(orchData.teamId, fromNodeId);
    setRelayNotice('Réponse transmise aux coéquipiers !');
    setTimeout(() => setRelayNotice(null), 2000);
  };

  const handleSynthesize = () => {
    orchData.onSynthesizeTeamWork?.(orchData.teamId);
    setSynthesisNotice('Synthèse demandée à l’IA Lead !');
    setTimeout(() => setSynthesisNotice(null), 2500);
  };

  return (
    <div
      className={`orchestrator-node animate-node-appear w-[340px] rounded-2xl bg-[#1c1a22] flex flex-col overflow-hidden transition-all duration-200 ${
        selected || justSent
          ? 'shadow-accent-glow border border-[#ff6a3d]'
          : 'shadow-card border border-[#2d2a37]'
      }`}
    >
      {/* Header */}
      <div className="orchestrator-drag-handle flex items-center justify-between px-4 py-3 bg-[#221f29] border-b border-[#2d2a37] cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-[#ff6a3d]/15 border border-[#ff6a3d]/40 text-[#ff6a3d] shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
              <span>Orchestrateur</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#14121a] text-[#ff6a3d] border border-[#2d2a37] truncate">
                {orchData.teamLabel}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400">
              {runningCount}/{members.length} agents actifs · Communication IA
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 nodrag shrink-0">
          <button
            onClick={() => orchData.onStartTeam?.(orchData.teamId)}
            className="p-1.5 rounded-lg bg-[#14121a] hover:bg-[#ff6a3d]/20 text-zinc-300 hover:text-[#ff6a3d] border border-[#2d2a37] transition-colors"
            title="Démarrer toute l'équipe (sans réinitialiser les consoles déjà ouvertes)"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>

          {runningCount > 0 && (
            <button
              onClick={() => orchData.onStopTeam?.(orchData.teamId)}
              className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-colors"
              title="Arrêter toutes les IA de l'équipe sans supprimer la Team"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          <button
            onClick={() => orchData.onCloseTeam?.(orchData.teamId)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/40 text-[11px] font-semibold transition-colors"
            title="Fermer complètement la Team (ferme l'Orchestrateur, le cadre et toutes ses consoles IA)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fermer</span>
          </button>
        </div>
      </div>

      {/* Team Collaboration Mode Selector (Split / Relay / Debate / Parallel) */}
      <div className="nodrag px-3 py-2.5 bg-[#191720] border-b border-[#2d2a37] space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-semibold uppercase tracking-wider text-zinc-400">
            Mode de travail Inter-IA :
          </span>
          <span className="text-[9px] font-mono text-amber-400 font-semibold flex items-center gap-1">
            {collabMode === 'split' ? (
              <>
                <span title="Chaque sous-tâche est automatiquement confiée à la meilleure IA selon ses super-pouvoirs (ex: Claude pour le code, Gemini pour la lecture)">
                  🎯 Auto-choix IA
                </span>
                <span className="text-zinc-600">·</span>
                <span>⚡ x{members.length || 2}</span>
              </>
            ) : null}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectMode('split')}
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-semibold border transition-all ${
              collabMode === 'split'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                : 'bg-[#14121a] border-[#2d2a37] text-zinc-400 hover:text-zinc-200'
            }`}
            title="Mode Répartition Rapide & Auto-Choix : Chaque IA prend en charge la sous-partie où elle excelle le plus (Claude pour le code, Gemini pour la doc/lecture, DeepSeek pour la sécurité) !"
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>⚡ Répartir (Vite)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMode('relay')}
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-semibold border transition-all ${
              collabMode === 'relay'
                ? 'bg-[#ff6a3d]/20 border-[#ff6a3d] text-white shadow-sm'
                : 'bg-[#14121a] border-[#2d2a37] text-zinc-400 hover:text-zinc-200'
            }`}
            title="Mode Chaîne/Relais : L'Agent 1 répond, puis sa réponse est envoyée automatiquement à l'Agent 2 pour continuer le travail !"
          >
            <GitBranch className="w-3 h-3 text-[#ff6a3d]" />
            <span>🔗 Relais IA</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMode('debate')}
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-semibold border transition-all ${
              collabMode === 'debate'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-sm'
                : 'bg-[#14121a] border-[#2d2a37] text-zinc-400 hover:text-zinc-200'
            }`}
            title="Mode Débat / Entraide : Les IA s'envoient leurs réponses mutuellement pour améliorer et vérifier le travail !"
          >
            <MessageSquare className="w-3 h-3 text-emerald-400" />
            <span>💬 Débat IA</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMode('parallel')}
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-semibold border transition-all ${
              collabMode === 'parallel'
                ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-sm'
                : 'bg-[#14121a] border-[#2d2a37] text-zinc-400 hover:text-zinc-200'
            }`}
            title="Mode Parallèle : Toutes les IA reçoivent exactement la même consigne en simultané"
          >
            <Zap className="w-3 h-3 text-sky-400" />
            <span>📡 Parallèle</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMode('gate')}
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] font-semibold border transition-all col-span-2 ${
              collabMode === 'gate'
                ? 'bg-rose-500/20 border-rose-400 text-rose-200 shadow-sm'
                : 'bg-[#14121a] border-[#2d2a37] text-zinc-400 hover:text-zinc-200'
            }`}
            title="Mode Gate & Audit de Sécurité : Une IA auditrice analyse et vérifie le code produit par l'équipe avant validation"
          >
            <ShieldCheck className="w-3 h-3 text-rose-400" />
            <span>🛡️ Gate & Audit de Sécurité</span>
          </button>
        </div>

        <p className="text-[10px] text-zinc-400 leading-tight">
          {collabMode === 'split'
            ? `🎯 Auto-choix IA : Tâches réparties selon les super-pouvoirs (Claude = Code, Gemini = Lecture/Doc, DeepSeek = Sécurité, Shell = Tests) en simultané x${members.length || 2}.`
            : collabMode === 'relay'
            ? '🔗 Relais : L’IA 1 commence le travail puis transmet automatiquement sa réponse à l’IA 2.'
            : collabMode === 'debate'
            ? '💬 Débat : Les IA se répondent entre elles et échangent leurs idées automatiquement.'
            : collabMode === 'gate'
            ? '🛡️ Gate : L’IA de sécurité (DeepSeek R1 / Argon 4) inspecte le travail et attribue son verdict (Vert / Orange / Rouge).'
            : '📡 Parallèle : Toutes les IA traitent la même consigne en même temps.'}
        </p>
      </div>

      {/* Connected Agents Status List + Per-Agent Relay Button + Synthesis */}
      <div className="nodrag p-3 space-y-1.5 max-h-[175px] overflow-y-auto bg-[#16141c]/60 border-b border-[#2d2a37]">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Agents reliés ({members.length})
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => orchData.onGenerateSummaryNote?.(orchData.teamId)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#ff6a3d]/15 hover:bg-[#ff6a3d]/25 text-[#ff6a3d] border border-[#ff6a3d]/30 text-[10px] font-semibold transition-colors"
              title="Générer une note de synthèse Markdown directement sur le canvas"
            >
              <FileText className="w-2.5 h-2.5" />
              <span>Note Canvas</span>
            </button>
            {members.length >= 2 && (
              <>
                <button
                  type="button"
                  onClick={handleSynthesize}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-semibold transition-colors"
                  title="Fusionner les travaux de tous les membres en une synthèse finale complète par l'IA Lead"
                >
                  <Combine className="w-2.5 h-2.5" />
                  <span>Assembler</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleManualRelay()}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold transition-colors"
                  title="Envoyer la dernière réponse produite à tous les autres agents de l'équipe"
                >
                  <Share2 className="w-2.5 h-2.5" />
                  <span>Relayer</span>
                </button>
              </>
            )}
          </div>
        </div>

        {members.length === 0 ? (
          <div className="text-xs text-zinc-500 px-1 py-2">
            Aucun agent dans cette équipe.
          </div>
        ) : (
          members.map((member, index) => {
            const engineProf = getAiEngineProfile(member.commandType);
            const role =
              collabMode === 'split'
                ? getSpecialistRoleForIndex(
                    index,
                    members.length,
                    member.commandType
                  )
                : null;
            return (
              <div
                key={member.id}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#1c1a22] border border-[#2d2a37]/80 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    #{index + 1}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      STATUS_DOT[member.status || 'idle']
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-zinc-200 truncate">
                        {member.label}
                      </span>
                      <span
                        className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0 font-medium"
                        title={engineProf.bestAtSummary}
                      >
                        {engineProf.specialtyBadge}
                      </span>
                    </div>
                    <span
                      className="text-[9px] text-zinc-400 truncate block"
                      title={engineProf.bestAtSummary}
                    >
                      {role ? role.roleTitle : engineProf.shortDomain}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#14121a] text-zinc-400 border border-[#2d2a37]">
                    {member.commandType}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleManualRelay(member.id)}
                    className="p-1 rounded bg-[#14121a] hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-300 border border-[#2d2a37]"
                    title={`Envoyer la réponse de ${member.label} aux autres IA de la Team`}
                  >
                    <Share2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Live Inter-AI Communication Feed */}
      {teamMessages.length > 0 && (
        <div className="nodrag px-3 py-2 bg-[#14121a] border-b border-[#2d2a37] max-h-[100px] overflow-y-auto space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
            <span>📡 Échanges entre les IA ({teamMessages.length})</span>
          </div>
          {teamMessages.slice(0, 3).map((m) => (
            <div
              key={m.id}
              className="text-[11px] text-zinc-300 bg-[#1c1a22] px-2 py-1 rounded-lg border border-[#2d2a37]/70 truncate"
              title={m.summaryText}
            >
              <span className="font-semibold text-[#ff6a3d]">{m.fromLabel}</span>{' '}
              <ArrowRight className="w-2.5 h-2.5 inline text-emerald-400 mx-0.5" />{' '}
              <span className="font-semibold text-emerald-300">{m.toLabel}</span> :{' '}
              <span className="text-zinc-400">{m.summaryText}</span>
            </div>
          ))}
        </div>
      )}

      {/* Active / Current Mission Display */}
      {orchData.lastBroadcastPrompt && (
        <div className="nodrag px-3 py-2 bg-[#17141f] border-b border-[#2d2a37]">
          <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
            <span className="font-semibold text-[#ff6a3d] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#ff6a3d]" />
              Mission en cours
            </span>
            {orchData.lastBroadcastAt && (
              <span className="font-mono text-[9px] text-zinc-500">
                {orchData.lastBroadcastAt}
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-200 bg-[#14121a] p-2 rounded-lg border border-[#2d2a37]/80 line-clamp-3 leading-snug select-text">
            {orchData.lastBroadcastPrompt}
          </div>
        </div>
      )}

      {/* Broadcast / Team Mission Form */}
      <form onSubmit={handleSend} className="nodrag p-3 bg-[#1c1a22] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-300 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#ff6a3d]" />
            Mission d’équipe
          </span>
          <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoStartIdle}
              onChange={(e) => setAutoStartIdle(e.target.checked)}
              className="accent-[#ff6a3d] rounded"
            />
            <span>Auto-start idle</span>
          </label>
        </div>

        <div>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              collabMode === 'split'
                ? `Ex: 1. Lire et résumer le doc client ; 2. Coder l'API backend ; 3. Vérifier la sécurité... (L'orchestrateur confie chaque tâche à la meilleure IA !)`
                : collabMode === 'relay'
                ? `Donne un sujet : l'IA #1 commence puis passe le relais à l'IA #2...`
                : collabMode === 'debate'
                ? `Donne un sujet : les IA vont débattre et croiser leurs réponses...`
                : collabMode === 'gate'
                ? `Donne un objectif : l'IA de sécurité effectuera l'audit strict...`
                : `Envoyer une instruction aux ${members.length} agents...`
            }
            className="nodrag nowheel nopan w-full rounded-xl bg-[#14121a] border border-[#2d2a37] focus:border-[#ff6a3d] px-3 py-2 text-[13px] leading-relaxed text-zinc-100 placeholder:text-zinc-400 focus:outline-none resize-none font-sans"
          />
        </div>

        {/* Live Voice Dictation Status or Error */}
        {isVoiceListening && (
          <div className="text-[10px] text-red-300 bg-red-500/15 border border-red-500/40 px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 shadow-[0_0_12px_rgba(239,68,68,0.25)]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
              {/* Dynamic Sound Level Equalizer */}
              <div className="flex items-end gap-0.5 h-3 shrink-0" title={`Volume micro : ${audioLevel}%`}>
                <span
                  className="w-1 bg-red-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(25, audioLevel)}%` }}
                />
                <span
                  className="w-1 bg-amber-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(15, audioLevel * 0.8)}%` }}
                />
                <span
                  className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(30, audioLevel * 1.2)}%` }}
                />
              </div>
              <span className="font-medium truncate">{voiceStatus || 'Microphone actif · Parlez en français...'}</span>
            </div>
            <button
              type="button"
              onClick={handleToggleVoice}
              className="text-[9px] px-2 py-0.5 rounded bg-red-500/30 hover:bg-red-500/60 text-white transition-colors shrink-0 font-medium cursor-pointer"
            >
              Terminer
            </button>
          </div>
        )}

        {voiceError && !isVoiceListening && (
          <div className="text-[10px] text-red-300 bg-red-500/15 border border-red-500/30 px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 animate-fade-in">
            <span className="truncate" title={voiceError}>⚠️ {voiceError}</span>
            <div className="flex items-center gap-1 shrink-0">
              {voiceError.includes('Clés API') && (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('agent-canvas-open-api-keys'))}
                  className="px-1.5 py-0.5 rounded bg-[#ff6a3d] hover:bg-[#ff825c] text-white font-bold text-[9px] transition-colors shadow"
                  title="Ouvrir la configuration des clés API"
                >
                  Clés API
                </button>
              )}
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                className="text-zinc-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {synthesisNotice ? (
            <span className="text-[10px] text-amber-400 font-medium truncate">
              ✓ {synthesisNotice}
            </span>
          ) : relayNotice ? (
            <span className="text-[10px] text-emerald-400 font-medium truncate">
              ✓ {relayNotice}
            </span>
          ) : justSent ? (
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {collabMode === 'split'
                ? 'Tâches réparties & envoyées !'
                : 'Mission lancée à l’équipe !'}
            </span>
          ) : orchData.lastBroadcastAt ? (
            <span className="text-[10px] text-zinc-500 truncate">
              Dernier envoi : {orchData.lastBroadcastAt}
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500">
              Entrée pour lancer
            </span>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`nodrag nopan p-1.5 rounded-lg border transition-colors ${
                isVoiceListening
                  ? 'bg-red-500 text-white border-red-400 shadow-[0_0_10px_#ef4444]'
                  : 'bg-zinc-800 text-zinc-300 hover:text-white border-zinc-700 hover:border-zinc-500'
              }`}
              title={
                isVoiceListening
                  ? 'Arrêter la dictée vocale'
                  : 'Dicter la mission au micro'
              }
              aria-label={isVoiceListening ? 'Arrêter la dictée' : 'Dicter la mission'}
            >
              {isVoiceListening ? (
                <MicOff className="w-3.5 h-3.5" />
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="submit"
              disabled={!prompt.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff6a3d] hover:bg-[#ff7b52] disabled:opacity-40 text-white text-xs font-medium shadow-[0_0_14px_-2px_rgba(255,106,61,0.5)] transition-all cursor-pointer shrink-0"
            >
              <Send className="w-3 h-3" />
              <span>
                {collabMode === 'split'
                  ? '⚡ Répartir & Lancer'
                  : collabMode === 'relay'
                  ? 'Lancer Relais'
                  : collabMode === 'debate'
                  ? 'Lancer Débat'
                  : 'Broadcast'}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Output Source Handle on Right for Animated Cable */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !bg-[#ff6a3d] !border-2 !border-[#14121a] !shadow-[0_0_12px_#ff6a3d]"
      />
    </div>
  );
};
