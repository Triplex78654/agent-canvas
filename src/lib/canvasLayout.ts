import type { Node } from '@xyflow/react';

/** Canvas geometry: default console size, team frames, free-spot placement. Pure functions (tested). */
export const DEFAULT_WIDTH = 490;
export const DEFAULT_HEIGHT = 344;
export const TEAM_PADDING_X = 24;
export const TEAM_PADDING_TOP = 64;
export const TEAM_PADDING_BOTTOM = 24;
export const TEAM_GAP_X = 20;
export const TEAM_GAP_Y = 20;

export function computeTeamGridMetrics(
  memberCount: number,
  cellW = DEFAULT_WIDTH,
  cellH = DEFAULT_HEIGHT
) {
  const cols = memberCount <= 1 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(memberCount / cols));
  const width = TEAM_PADDING_X * 2 + cols * cellW + (cols - 1) * TEAM_GAP_X;
  const height =
    TEAM_PADDING_TOP + TEAM_PADDING_BOTTOM + rows * cellH + (rows - 1) * TEAM_GAP_Y;
  return { cols, rows, width, height };
}

export function getNodeDimensions(
  node: Node,
  fallbackW = DEFAULT_WIDTH,
  fallbackH = DEFAULT_HEIGHT
): { width: number; height: number } {
  const w =
    typeof node.width === 'number' && node.width > 0
      ? node.width
      : typeof node.style?.width === 'number' && node.style.width > 0
      ? node.style.width
      : typeof node.measured?.width === 'number' && node.measured.width > 0
      ? node.measured.width
      : fallbackW;

  const h =
    typeof node.height === 'number' && node.height > 0
      ? node.height
      : typeof node.style?.height === 'number' && node.style.height > 0
      ? node.style.height
      : typeof node.measured?.height === 'number' && node.measured.height > 0
      ? node.measured.height
      : fallbackH;

  return { width: Math.round(w), height: Math.round(h) };
}

export function getEnclosingTeamDimensions(
  teamId: string,
  nodes: Node[],
  desiredW?: number,
  desiredH?: number
): { width: number; height: number } {
  const teamNode = nodes.find((n) => n.id === teamId);
  const curTeamDims = teamNode
    ? getNodeDimensions(teamNode, 1048, 432)
    : { width: 1048, height: 432 };
  const baseW = desiredW ?? curTeamDims.width;
  const baseH = desiredH ?? curTeamDims.height;

  const children = nodes.filter(
    (n) => n.type === 'consoleNode' && n.parentId === teamId
  );

  if (children.length === 0) {
    return {
      width: Math.max(680, baseW),
      height: Math.max(432, baseH),
    };
  }

  let maxRight = 0;
  let maxBottom = 0;

  for (const ch of children) {
    const { width: chW, height: chH } = getNodeDimensions(
      ch,
      DEFAULT_WIDTH,
      DEFAULT_HEIGHT
    );
    const right = (ch.position?.x ?? 0) + chW;
    const bottom = (ch.position?.y ?? 0) + chH;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  const requiredW = maxRight + TEAM_PADDING_X;
  const requiredH = maxBottom + TEAM_PADDING_BOTTOM;

  return {
    width: Math.round(Math.max(680, baseW, requiredW)),
    height: Math.round(Math.max(432, baseH, requiredH)),
  };
}


/** First free spot to the right of everything already on the canvas (new panels used to cover teams). */
export function findFreeSpot(nds: Node[]): { x: number; y: number } {
  const topLevel = nds.filter((n) => !n.parentId);
  if (topLevel.length === 0) return { x: 120, y: 120 };
  let maxRight = -Infinity;
  let minTop = Infinity;
  for (const n of topLevel) {
    const { width } = getNodeDimensions(n, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    maxRight = Math.max(maxRight, n.position.x + width);
    minTop = Math.min(minTop, n.position.y);
  }
  return { x: Math.round(maxRight + 60), y: Math.round(minTop) };
}
