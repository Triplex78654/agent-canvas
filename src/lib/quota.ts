import type { Node } from '@xyflow/react';
import type { AgentCommandType, ConsoleNodeData } from '../types';
import { COMMAND_OPTIONS } from '../data/agentCatalog';

export interface QuotaItem {
  id: string;
  label: string;
  cmd: AgentCommandType;
  tokens: number;
  limit: number;
  pct: number;
  isUnlimited: boolean;
}

export interface QuotaSummary {
  totalTokens: number;
  totalLimit: number;
  totalPrompts: number;
  /** Worst of the global % and the most-used single agent %. */
  effectivePct: number;
  items: QuotaItem[];
}

/** Estimated token usage per console and overall (local CLIs such as Ollama count as unlimited). Pure (tested). */
export function computeQuotaSummary(nodes: Node[]): QuotaSummary {
  let totalTokens = 0;
  let totalLimit = 0;
  let totalPrompts = 0;
  let maxPct = 0;
  const items: QuotaItem[] = [];

  for (const n of nodes) {
    if (n.type === 'consoleNode') {
      const d = n.data as unknown as ConsoleNodeData;
      const spec = COMMAND_OPTIONS.find((o) => o.id === d.commandType);
      const isUnlimited = Boolean(spec?.isUnlimitedLocal);
      const tokens = d.estimatedTokens || 0;
      const limit = d.tokenLimit || spec?.defaultTokenLimit || 50000;
      const pct = isUnlimited ? 0 : Math.min(100, Math.round((tokens / limit) * 100));

      totalTokens += tokens;
      totalPrompts += d.promptsSent || 0;
      if (!isUnlimited) {
        totalLimit += limit;
        if (pct > maxPct) maxPct = pct;
      }

      items.push({
        id: n.id,
        label: d.label || 'Console',
        cmd: d.commandType || 'claude',
        tokens,
        limit,
        pct,
        isUnlimited,
      });
    }
  }

  const globalPct =
    totalLimit > 0 ? Math.min(100, Math.round((totalTokens / totalLimit) * 100)) : 0;
  const effectivePct = Math.max(globalPct, maxPct);

  return {
    totalTokens,
    totalLimit: totalLimit || 100000,
    totalPrompts,
    effectivePct,
    items,
  };
}

/** Bar colour: green below 60 %, orange from 60 %, red from 85 %. */
export function quotaLevel(pct: number): 'ok' | 'warn' | 'danger' {
  return pct >= 85 ? 'danger' : pct >= 60 ? 'warn' : 'ok';
}
