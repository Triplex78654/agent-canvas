import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { computeQuotaSummary, quotaLevel } from '../src/lib/quota';
import { updateButtonLabel } from '../src/lib/appUpdate';

const consoleNode = (id: string, commandType: string, estimatedTokens: number, tokenLimit?: number) =>
  ({ id, type: 'consoleNode', position: { x: 0, y: 0 }, data: { label: id, commandType, estimatedTokens, tokenLimit } }) as unknown as Node;

describe('computeQuotaSummary', () => {
  it('reports the most-used agent when it is worse than the global average', () => {
    const s = computeQuotaSummary([consoleNode('a', 'claude', 900, 1000), consoleNode('b', 'claude', 0, 1000)]);
    expect(s.totalTokens).toBe(900);
    expect(s.effectivePct).toBe(90);
    expect(s.items.map((i) => i.pct)).toEqual([90, 0]);
  });
  it('ignores non-console panels', () => {
    expect(computeQuotaSummary([{ id: 't', type: 'teamNode', position: { x: 0, y: 0 }, data: {} } as Node]).items).toEqual([]);
  });
  it('maps percentages to colour levels', () => {
    expect([quotaLevel(10), quotaLevel(60), quotaLevel(85)]).toEqual(['ok', 'warn', 'danger']);
  });
});

describe('updateButtonLabel', () => {
  it('describes every auto-update state', () => {
    expect(updateButtonLabel(null, '1.4.1')).toBe('Mises à jour');
    expect(updateButtonLabel({ state: 'up-to-date' }, '1.4.1')).toBe('À jour ✓ (v1.4.1)');
    expect(updateButtonLabel({ state: 'downloading', percent: 42 }, '1.4.0')).toBe('Téléchargement 42 %');
    expect(updateButtonLabel({ state: 'ready', version: '1.4.1' }, '1.4.0')).toBe('v1.4.1 prête · Redémarrer');
    expect(updateButtonLabel({ state: 'error', message: 'x' }, '1.4.0')).toBe('Erreur de mise à jour');
  });
});
