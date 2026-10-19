import React, { useState, useEffect } from 'react';
import { Handle, NodeProps, NodeResizer, Position } from '@xyflow/react';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Activity,
  X,
  Check,
  Flame,
  Radio,
} from 'lucide-react';
import { playCanvasSound } from '../services/teamCollabBus';

export type TriggerMode = 'interval' | 'manual' | 'file-watch';

export interface TriggerNodeData extends Record<string, unknown> {
  label: string;
  mode: TriggerMode;
  intervalMinutes: number;
  active: boolean;
  targetTeamId?: string;
  triggerPrompt?: string;
  onFireTrigger?: (triggerId: string, prompt: string) => void;
  onToggleActive?: (triggerId: string, active: boolean) => void;
  onClose?: (triggerId: string) => void;
}

export const TriggerNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const trigger = data as unknown as TriggerNodeData;
  const [isHovered, setIsHovered] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(
    (trigger.intervalMinutes || 5) * 60
  );
  const [fireCount, setFireCount] = useState(0);
  const [customInterval, setCustomInterval] = useState(trigger.intervalMinutes || 5);
  const [justFired, setJustFired] = useState(false);

  // Interval countdown when active
  useEffect(() => {
    if (!trigger.active || trigger.mode !== 'interval') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [trigger.active, trigger.mode]);

  // Reset countdown when trigger is paused
  useEffect(() => {
    if (!trigger.active) {
      setSecondsRemaining(customInterval * 60);
    }
  }, [trigger.active, customInterval]);

  // Clean trigger firing effect
  useEffect(() => {
    if (secondsRemaining === 0 && trigger.active) {
      setFireCount((c) => c + 1);
      setJustFired(true);
      playCanvasSound('relay');
      trigger.onFireTrigger?.(
        id,
        trigger.triggerPrompt || 'Exécute la vérification programmée'
      );
      setTimeout(() => setJustFired(false), 2500);
      setSecondsRemaining(customInterval * 60);
    }
  }, [secondsRemaining, trigger.active, customInterval, trigger.triggerPrompt, id]);

  const handleManualFire = () => {
    setFireCount((c) => c + 1);
    setJustFired(true);
    playCanvasSound('relay');
    trigger.onFireTrigger?.(
      id,
      trigger.triggerPrompt || 'Vérification manuelle déclenchée'
    );
    setTimeout(() => setJustFired(false), 2500);
  };

  const handleSelectInterval = (mins: number) => {
    setCustomInterval(mins);
    setSecondsRemaining(mins * 60);
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full h-full rounded-3xl transition-all duration-300 relative flex flex-col bg-[#1c1a22]/95 border ${
        justFired
          ? 'border-emerald-400 shadow-[0_0_32px_rgba(34,197,94,0.6)] scale-[1.02]'
          : selected || trigger.active
          ? 'border-amber-500/80 shadow-[0_0_24px_-4px_rgba(245,158,11,0.45)]'
          : 'border-[#2d2a37] shadow-card'
      }`}
    >
      <NodeResizer
        minWidth={280}
        minHeight={220}
        autoScale={false}
        isVisible={selected || isHovered}
        lineClassName="!border-amber-500/60"
        handleClassName="!w-3 !h-3 !bg-amber-500 !border-2 !border-[#14121a] !rounded-full"
      />

      {/* Source Handle connected to Orchestrator target */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !bg-amber-400 !border-2 !border-[#14121a] !shadow-[0_0_10px_#f59e0b]"
      />

      {/* Header */}
      <div className="trigger-drag-handle flex items-center justify-between px-4 py-2.5 rounded-t-3xl bg-[#14121a] border-b border-[#2d2a37] cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-lg border ${
              trigger.active
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 animate-pulse'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-zinc-100 flex items-center gap-1.5">
              <span>{trigger.label || 'Trigger / Planificateur'}</span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1 nodrag">
          <button
            onClick={() => trigger.onClose?.(id)}
            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Supprimer ce trigger"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div className="px-4 py-2 bg-[#171520] border-b border-[#24212e] flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-zinc-300">
          <span
            className={`w-2 h-2 rounded-full ${
              trigger.active ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-zinc-600'
            }`}
          />
          <span className="font-mono text-[11px]">
            {trigger.active ? 'Actif' : 'En pause'}
          </span>
        </span>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#121017] border border-[#2d2a37] text-zinc-400">
          {fireCount} exécution{fireCount > 1 ? 's' : ''}
        </span>
      </div>

      {/* Countdown Display & Controls */}
      <div className="flex-1 p-4 flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#14121a] border border-[#24212e]">
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
              Prochain cycle dans
            </span>
            <span className="text-xl font-mono font-bold text-amber-300">
              {timeFormatted}
            </span>
          </div>

          <button
            onClick={() => trigger.onToggleActive?.(id, !trigger.active)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              trigger.active
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
            }`}
          >
            {trigger.active ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Activer</span>
              </>
            )}
          </button>
        </div>

        {/* Interval Selection Chips */}
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
          <span className="text-zinc-500 text-[9px] uppercase tracking-wider">Intervalle:</span>
          {[1, 5, 15, 30].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => handleSelectInterval(mins)}
              className={`px-2 py-0.5 rounded-lg border transition-all ${
                customInterval === mins
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                  : 'bg-[#14121a] text-zinc-400 border-[#2d2a37] hover:text-zinc-200'
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>

        {/* Action Button: Boost immédiat */}
        <button
          onClick={handleManualFire}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold transition-all cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>Déclencher immédiatement</span>
        </button>
      </div>
    </div>
  );
};
