import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import { AnimatedCableEdgeData } from '../types';

export const AnimatedCableEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) => {
  const edgeData = (data || {}) as unknown as AnimatedCableEdgeData;
  const isPulsing = Boolean(edgeData.pulsing);
  const isActive = Boolean(edgeData.active) || (edgeData.runningCount ?? 0) > 0;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  return (
    <g className="react-flow__edge-cable">
      {/* Outer Glow Path */}
      <path
        d={edgePath}
        fill="none"
        stroke="#ff6a3d"
        strokeWidth={isPulsing ? 12 : isActive ? 7 : 4}
        strokeOpacity={isPulsing ? 0.38 : isActive ? 0.18 : 0.08}
        style={{
          filter: 'blur(5px)',
          transition: 'all 0.3s ease',
        }}
      />

      {/* Base Dark Cable Track */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: isActive || isPulsing ? '#ff6a3d' : '#3f3a4d',
          strokeWidth: isPulsing ? 3 : 2,
          strokeOpacity: isActive || isPulsing ? 0.65 : 0.45,
        }}
      />

      {/* Animated Flowing Data Dashes */}
      <path
        d={edgePath}
        fill="none"
        stroke={isPulsing ? '#ffffff' : '#ff6a3d'}
        strokeWidth={isPulsing ? 3 : 2}
        strokeDasharray={isPulsing ? '10 8' : '6 10'}
        className={
          isPulsing
            ? 'animate-cable-pulse'
            : isActive
            ? 'animate-cable-flow'
            : 'animate-cable-slow'
        }
      />
    </g>
  );
};
