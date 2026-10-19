import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  computeTeamGridMetrics,
  findFreeSpot,
  getEnclosingTeamDimensions,
  getNodeDimensions,
} from '../src/lib/canvasLayout';

const node = (over: Partial<Node>): Node => ({ id: 'n', position: { x: 0, y: 0 }, data: {}, ...over }) as Node;

describe('computeTeamGridMetrics', () => {
  it('uses one column for a single agent and two columns otherwise', () => {
    expect(computeTeamGridMetrics(1)).toMatchObject({ cols: 1, rows: 1 });
    expect(computeTeamGridMetrics(3)).toMatchObject({ cols: 2, rows: 2 });
    expect(computeTeamGridMetrics(4).width).toBeGreaterThan(2 * DEFAULT_WIDTH);
  });
});

describe('getNodeDimensions', () => {
  it('prefers explicit width, then style, then measured, then fallback', () => {
    expect(getNodeDimensions(node({ width: 300, height: 200 }))).toEqual({ width: 300, height: 200 });
    expect(getNodeDimensions(node({ style: { width: 410, height: 210 } }))).toEqual({ width: 410, height: 210 });
    expect(getNodeDimensions(node({ measured: { width: 123.6, height: 99.2 } }))).toEqual({ width: 124, height: 99 });
    expect(getNodeDimensions(node({}))).toEqual({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  });
});

describe('getEnclosingTeamDimensions', () => {
  it('grows the team frame so every member console fits', () => {
    const nodes = [
      node({ id: 'team', type: 'teamNode', width: 700, height: 450 }),
      node({ id: 'c1', type: 'consoleNode', parentId: 'team', position: { x: 600, y: 400 }, width: 490, height: 344 }),
    ];
    const dims = getEnclosingTeamDimensions('team', nodes);
    expect(dims.width).toBeGreaterThanOrEqual(600 + 490);
    expect(dims.height).toBeGreaterThanOrEqual(400 + 344);
  });
  it('keeps a minimum size for an empty team', () => {
    expect(getEnclosingTeamDimensions('team', [node({ id: 'team', type: 'teamNode', width: 10, height: 10 })])).toEqual({
      width: 680,
      height: 432,
    });
  });
});

describe('findFreeSpot', () => {
  it('starts at 120,120 on an empty canvas', () => {
    expect(findFreeSpot([])).toEqual({ x: 120, y: 120 });
  });
  it('places new panels to the right of everything, ignoring team members', () => {
    const nodes = [
      node({ id: 'team', position: { x: 100, y: 50 }, width: 1000, height: 400 }),
      node({ id: 'c', parentId: 'team', position: { x: 5000, y: 0 }, width: 490 }),
    ];
    expect(findFreeSpot(nodes)).toEqual({ x: 1160, y: 50 });
  });
});
