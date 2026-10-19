import React, { useState } from 'react';
import { Handle, NodeProps, NodeResizer, Position } from '@xyflow/react';
import {
  FileText,
  Copy,
  Check,
  Download,
  Trash2,
  Sparkles,
  Layers,
  Calendar,
} from 'lucide-react';

export interface SummaryNoteNodeData extends Record<string, unknown> {
  title: string;
  brief: string;
  teamLabel?: string;
  createdAt: string;
  content: string;
  onDeleteNote?: (id: string) => void;
}

export const SummaryNoteNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const note = data as unknown as SummaryNoteNodeData;
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = () => {
    const fullText = `# ${note.title || 'Synthèse de Mission'}\n\n**Mission :** ${note.brief}\n**Équipe :** ${
      note.teamLabel || 'Team'
    }\n**Date :** ${note.createdAt}\n\n---\n\n${note.content}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const fullText = `# ${note.title || 'Synthèse de Mission'}\n\n**Mission :** ${note.brief}\n**Équipe :** ${
      note.teamLabel || 'Team'
    }\n**Date :** ${note.createdAt}\n\n---\n\n${note.content}`;
    const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeLabel = (note.teamLabel || 'team')
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '_');
    link.download = `synthese-${safeLabel}-${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full h-full rounded-3xl transition-colors duration-200 relative flex flex-col bg-[#1c1a22]/95 border ${
        selected
          ? 'border-[#ff6a3d] shadow-[0_0_24px_-4px_rgba(255,106,61,0.45)]'
          : 'border-[#2d2a37] shadow-card'
      }`}
    >
      <NodeResizer
        minWidth={360}
        minHeight={260}
        autoScale={false}
        isVisible={selected || isHovered}
        lineClassName="!border-[#ff6a3d]/60"
        handleClassName="!w-3 !h-3 !bg-[#ff6a3d] !border-2 !border-[#14121a] !rounded-full"
      />

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-[#ff6a3d] !border-2 !border-[#14121a]"
      />

      {/* Header Bar */}
      <div className="summary-drag-handle flex items-center justify-between px-4 py-2.5 rounded-t-3xl bg-[#14121a] border-b border-[#2d2a37] cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#ff6a3d]/20 text-[#ff6a3d]">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-zinc-100 flex items-center gap-1.5">
              <span>{note.title || 'Synthèse de Mission'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                MD
              </span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1 nodrag">
          <button
            onClick={handleCopy}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Copier le Markdown"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Télécharger en .md"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => note.onDeleteNote?.(id)}
            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Supprimer la note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub-header Context Pill */}
      <div className="px-4 py-2 bg-[#17151f] border-b border-[#24212d] flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <span className="flex items-center gap-1 text-zinc-300 truncate max-w-[200px]">
          <Layers className="w-3 h-3 text-[#ff6a3d]" />
          <span>{note.teamLabel || 'Team 1'}</span>
        </span>
        <span className="flex items-center gap-1 text-zinc-500">
          <Calendar className="w-3 h-3" />
          <span>{note.createdAt || 'Récemment'}</span>
        </span>
      </div>

      {/* Note Content Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs leading-relaxed text-zinc-200">
        {note.brief && (
          <div className="p-2.5 rounded-xl bg-[#14121a] border border-[#2d2a37] text-zinc-300">
            <span className="font-semibold text-zinc-400 block text-[10px] uppercase tracking-wider mb-0.5">
              Mission initiale :
            </span>
            "{note.brief}"
          </div>
        )}

        <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-300 select-text">
          {note.content || 'Aucune synthèse disponible.'}
        </div>
      </div>
    </div>
  );
};
