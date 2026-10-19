import React, { useState } from 'react';
import { Handle, NodeProps, NodeResizer, Position } from '@xyflow/react';
import {
  Users,
  Play,
  Square,
  LayoutGrid,
  Ungroup,
  Pencil,
  Check,
  Maximize2,
  X,
} from 'lucide-react';
import { TeamNodeData } from '../types';

export const TeamNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const teamData = data as unknown as TeamNodeData;
  const [isRenaming, setIsRenaming] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [draftName, setDraftName] = useState(teamData.label || `TEAM ${teamData.teamNumber || 1}`);

  const isActive = (teamData.runningCount || 0) > 0;
  const isPulsing = Boolean(teamData.pulsing);

  const commitRename = () => {
    const trimmed = draftName.trim() || `TEAM ${teamData.teamNumber || 1}`;
    setDraftName(trimmed);
    setIsRenaming(false);
    teamData.onRenameTeam?.(id, trimmed);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full h-full rounded-3xl transition-colors duration-200 relative flex flex-col ${
        isPulsing
          ? 'bg-[#ff6a3d]/[0.07] border-2 border-[#ff6a3d] shadow-[0_0_48px_-4px_rgba(255,106,61,0.55)]'
          : isActive || selected
          ? 'bg-[#1c1a22]/45 border border-[#ff6a3d]/70 shadow-[0_0_32px_-6px_rgba(255,106,61,0.32)]'
          : 'bg-[#1c1a22]/30 border border-[#2d2a37]/90 shadow-card'
      }`}
    >
      <NodeResizer
        minWidth={680}
        minHeight={432}
        autoScale={false}
        isVisible={selected || isHovered}
        lineClassName="!border-[#ff6a3d]/70"
        handleClassName="!w-3.5 !h-3.5 !bg-[#ff6a3d] !border-2 !border-[#14121a] !rounded-full"
        onResize={(_evt, params) => {
          teamData.onScaleTeam?.(id, {
            width: Math.round(params.width),
            height: Math.round(params.height),
            x: Math.round(params.x),
            y: Math.round(params.y),
          });
        }}
        onResizeEnd={(_evt, params) => {
          teamData.onScaleTeam?.(id, {
            width: Math.round(params.width),
            height: Math.round(params.height),
            x: Math.round(params.x),
            y: Math.round(params.y),
          });
        }}
      />

      {/* Target Handle on Left for Orchestrator Cable */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !bg-[#ff6a3d] !border-2 !border-[#14121a] !shadow-[0_0_12px_#ff6a3d]"
      />

      {/* Team Frame Header Bar (Drag Handle for moving the whole team in block) */}
      <div className="team-drag-handle flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 rounded-t-3xl bg-[#1c1a22] border-b border-[#2d2a37]/80 cursor-grab active:cursor-grabbing select-none">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-xl border ${
              isActive
                ? 'bg-[#ff6a3d]/20 border-[#ff6a3d]/60 text-[#ff6a3d]'
                : 'bg-[#14121a] border-[#2d2a37] text-zinc-400'
            }`}
          >
            <Users className="w-4 h-4" />
          </div>

          {isRenaming ? (
            <div className="flex items-center gap-1.5 nodrag">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') {
                    setDraftName(teamData.label);
                    setIsRenaming(false);
                  }
                }}
                autoFocus
                className="bg-[#14121a] text-zinc-100 text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-lg border border-[#ff6a3d] focus:outline-none"
              />
              <button
                onClick={commitRename}
                className="p-1 text-emerald-400 hover:bg-zinc-800 rounded"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              onDoubleClick={() => setIsRenaming(true)}
              className="flex min-w-0 items-center gap-2.5"
            >
              <span className="truncate font-bold text-xs tracking-wider uppercase text-zinc-100">
                {teamData.label}
              </span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#14121a] border border-[#2d2a37] text-zinc-300 flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isActive
                      ? 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]'
                      : 'bg-zinc-500'
                  }`}
                />
                <span>
                  {teamData.runningCount} / {teamData.memberCount} running
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Team Frame Actions */}
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 nodrag">
          <button
            onClick={() => teamData.onStartTeam?.(id)}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-lg bg-[#ff6a3d]/15 hover:bg-[#ff6a3d]/25 text-[#ff6a3d] border border-[#ff6a3d]/40 text-xs font-medium transition-colors"
            title="Démarrer toutes les consoles de l'équipe"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Start team</span>
          </button>

          {isActive && (
            <button
              onClick={() => teamData.onStopTeam?.(id)}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-medium transition-colors"
              title="Arrêter toutes les IA de l'équipe sans supprimer la Team"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop IA</span>
            </button>
          )}

          {/* Scale whole team + inner consoles proportionally */}
          <div className="flex items-center bg-[#14121a]/90 border border-[#2d2a37] rounded-lg px-0.5">
            <button
              type="button"
              onClick={() => teamData.onScaleTeam?.(id, 'shrink')}
              className="px-2 py-0.5 text-xs font-mono text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors"
              title="Rétrécir le cadre d'équipe et toutes ses consoles (-)"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => teamData.onScaleTeam?.(id, 'toggle-max')}
              className="p-1 text-zinc-300 hover:text-[#ff6a3d] hover:bg-zinc-800 rounded transition-colors"
              title="Agrandir / Adapter toute l'équipe et ses consoles"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => teamData.onScaleTeam?.(id, 'expand')}
              className="px-2 py-0.5 text-xs font-mono text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors"
              title="Agrandir le cadre d'équipe et toutes ses consoles (+)"
            >
              +
            </button>
          </div>

          <button
            onClick={() => teamData.onAutoGridTeam?.(id)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 transition-colors"
            title="Réinitialiser la grille"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsRenaming(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 transition-colors"
            title="Renommer l'équipe"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => teamData.onUngroupTeam?.(id)}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-1 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-amber-500/10 text-xs transition-colors"
            title="Dissoudre le cadre d'équipe (conserve les consoles sur le canvas)"
          >
            <Ungroup className="w-3.5 h-3.5" />
            <span>Dégrouper</span>
          </button>

          <button
            onClick={() => teamData.onCloseTeam?.(id)}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/40 text-xs font-semibold transition-colors"
            title="Fermer complètement la Team (ferme l'Orchestrateur, le cadre et toutes ses consoles IA)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fermer Team</span>
          </button>
        </div>
      </div>

      {/* Subtle corner decoration */}
      <div className="flex-1 pointer-events-none" />
    </div>
  );
};
