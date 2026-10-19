import React from 'react';
import type { ReactFlowInstance } from '@xyflow/react';

interface CanvasZoomControlsProps {
  rfInstanceRef: React.MutableRefObject<ReactFlowInstance | null>;
  autoScale: boolean;
  onAutoScaleChange: (next: boolean) => void;
}

/** Top-bar zoom pill: −, 100 %, +, fit everything, auto-scale on window resize. */
export const CanvasZoomControls: React.FC<CanvasZoomControlsProps> = ({
  rfInstanceRef,
  autoScale,
  onAutoScaleChange,
}) => (
  <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl bg-[#1c1a22]/90 backdrop-blur-xl border border-[#2d2a37] shadow-card text-xs text-zinc-300">
    <button
      type="button"
      onClick={() => rfInstanceRef.current?.zoomOut({ duration: 180 })}
      className="px-2 py-0.5 rounded-lg bg-[#14121a] hover:bg-zinc-800 text-zinc-200 font-mono text-xs border border-[#2d2a37]"
      title="Dézoomer le canvas (-)"
    >
      −
    </button>
    <button
      type="button"
      onClick={() => rfInstanceRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 })}
      className="px-2 py-0.5 rounded-lg hover:bg-zinc-800 text-zinc-200 font-mono text-[11px]"
      title="Réinitialiser le zoom à 100%"
    >
      100%
    </button>
    <button
      type="button"
      onClick={() => rfInstanceRef.current?.zoomIn({ duration: 180 })}
      className="px-2 py-0.5 rounded-lg bg-[#14121a] hover:bg-zinc-800 text-zinc-200 font-mono text-xs border border-[#2d2a37]"
      title="Zoomer le canvas (+)"
    >
      +
    </button>
    <button
      type="button"
      onClick={() => rfInstanceRef.current?.fitView({ padding: 0.12, duration: 240 })}
      className="ml-0.5 px-2 py-0.5 rounded-lg bg-[#ff6a3d]/15 hover:bg-[#ff6a3d] text-[#ff6a3d] hover:text-white border border-[#ff6a3d]/40 text-[11px] font-medium transition-colors"
      title="Ajuster la vue pour voir toutes les pages"
    >
      Tout cadrer
    </button>
    <button
      type="button"
      onClick={() => {
        const next = !autoScale;
        onAutoScaleChange(next);
        if (next) rfInstanceRef.current?.fitView({ padding: 0.1, duration: 200 });
      }}
      className={`ml-0.5 px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors ${
        autoScale
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
          : 'bg-[#14121a] text-zinc-400 border-[#2d2a37] hover:text-zinc-200'
      }`}
      title="Mise à l'échelle automatique des cadres quand on agrandit ou réduit la fenêtre principale"
    >
      Auto-Échelle {autoScale ? 'ON' : 'OFF'}
    </button>
  </div>
);
