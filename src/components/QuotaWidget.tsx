import React, { useState } from 'react';
import { Gauge, RotateCcw } from 'lucide-react';
import { QuotaSummary, quotaLevel } from '../lib/quota';

const BAR_CLASS = {
  ok: 'bg-[#22c55e]',
  warn: 'bg-[#f97316] shadow-[0_0_8px_#f97316]',
  danger: 'bg-[#ef4444] shadow-[0_0_8px_#ef4444]',
} as const;
const TEXT_CLASS = { ok: 'text-emerald-400', warn: 'text-amber-400', danger: 'text-red-400' } as const;
const ITEM_BAR_CLASS = { ok: 'bg-emerald-500', warn: 'bg-amber-500', danger: 'bg-red-500' } as const;

interface QuotaWidgetProps {
  summary: QuotaSummary;
  onResetAll: () => void;
}

/** Top-bar gauge of estimated token usage, with a per-agent detail popover. */
export const QuotaWidget: React.FC<QuotaWidgetProps> = ({ summary, onResetAll }) => {
  const [open, setOpen] = useState(false);
  const level = quotaLevel(summary.effectivePct);

  return (
    <div className="relative pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#1c1a22]/90 hover:bg-[#24212c] backdrop-blur-xl border border-[#2d2a37] shadow-card transition-all cursor-pointer"
        title="Cliquer pour voir le détail des limites et quotas par agent"
      >
        <Gauge className="w-4 h-4 text-[#ff6a3d]" />
        <div className="flex flex-col gap-1 min-w-[180px]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-zinc-200">Limite & Quotas</span>
            <span className="font-mono text-zinc-300">
              {(summary.totalTokens / 1000).toFixed(1)}k tok ·{' '}
              <strong className={TEXT_CLASS[level]}>{summary.effectivePct}%</strong>
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#121017] overflow-hidden border border-[#2d2a37]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${BAR_CLASS[level]}`}
              style={{ width: `${Math.max(5, summary.effectivePct)}%` }}
            />
          </div>
        </div>
      </button>

      {open && (
        <div className="animate-node-appear absolute right-0 mt-2 w-[360px] rounded-2xl bg-[#1c1a22]/95 backdrop-blur-xl border border-[#2d2a37] shadow-card p-4 z-40">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#2d2a37]">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
              Suivi des Limites par Agent
            </span>
            <button
              onClick={onResetAll}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#14121a] hover:bg-zinc-800 text-zinc-300 text-[11px] border border-[#2d2a37]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset tout</span>
            </button>
          </div>

          <div className="mt-3 space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
            {summary.items.map((item) => (
              <div key={item.id} className="p-2.5 rounded-xl bg-[#14121a] border border-[#2d2a37] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-200 truncate">
                    {item.label} <span className="text-[10px] font-mono text-zinc-400">({item.cmd})</span>
                  </span>
                  <span className="font-mono text-[11px] text-zinc-300">
                    {item.isUnlimited
                      ? `${(item.tokens / 1000).toFixed(1)}k · ∞ Local`
                      : `${(item.tokens / 1000).toFixed(1)}k / ${Math.round(item.limit / 1000)}k (${item.pct}%)`}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#1c1a22] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.isUnlimited ? 'bg-emerald-500' : ITEM_BAR_CLASS[quotaLevel(item.pct)]}`}
                    style={{ width: item.isUnlimited ? '25%' : `${Math.max(4, item.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
