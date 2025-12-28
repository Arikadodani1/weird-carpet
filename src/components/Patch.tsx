import React from 'react';
import { CELL_SIZE, PATCH_BORDER } from '../utils/constants';
import './Patch.css';

export type StitchPattern = 'crossstitch' | 'horizontal' | 'diagonal' | 'dots' | 'vertical' | 'chunky';

export interface PatchProps {
  shape: 'square' | 'rectangle';
  color: string;
  pattern: StitchPattern;
  x: number; // Absolute position in pixels
  y: number; // Absolute position in pixels
  rotation?: number; // Base rotation in degrees (0-360), default 0
  wiggle?: number; // Wiggle offset in degrees (±5°), for fall animation
}

/**
 * Patch Component (Phase 2)
 *
 * Renders a textile patch with one of two shapes:
 * - Square: 50px × 50px
 * - Rectangle: 100px × 50px (2 cells wide)
 *
 * Features:
 * - Stitch pattern textures (6 patterns)
 * - 3px border for definition
 * - Subtle shadow: 0 2px 8px rgba(0,0,0,0.15)
 * - Uses CSS transforms for GPU acceleration
 * - Wiggle animation support for falling patches
 * - Absolute positioning
 */
const Patch: React.FC<PatchProps> = ({ shape, color, pattern, x, y, rotation = 0, wiggle = 0 }) => {
  // Log rendering position for debugging
  if (Math.random() < 0.1) { // Log 10% of renders to avoid spam
    console.log('Patch rendering:', { x, y, shape, transform: `rotate(${rotation + wiggle}deg)` });
  }

  const renderShape = () => {
    // All shapes rendered as SVG for consistent pattern application
    const patternId = `#${pattern}`;

    switch (shape) {
      case 'square':
        return (
          <svg
            className="patch patch-square"
            width={CELL_SIZE}
            height={CELL_SIZE}
            viewBox={`0 0 ${CELL_SIZE} ${CELL_SIZE}`}
            style={{ color }}
          >
            <rect
              x="0"
              y="0"
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill="white"
            />
            <rect
              x="0"
              y="0"
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill={`url(${patternId})`}
              stroke="#333"
              strokeWidth={PATCH_BORDER}
            />
          </svg>
        );

      case 'rectangle':
        return (
          <svg
            className="patch patch-rectangle"
            width={CELL_SIZE * 2}
            height={CELL_SIZE}
            viewBox={`0 0 ${CELL_SIZE * 2} ${CELL_SIZE}`}
            style={{ color }}
          >
            <rect
              x="0"
              y="0"
              width={CELL_SIZE * 2}
              height={CELL_SIZE}
              fill="white"
            />
            <rect
              x="0"
              y="0"
              width={CELL_SIZE * 2}
              height={CELL_SIZE}
              fill={`url(${patternId})`}
              stroke="#333"
              strokeWidth={PATCH_BORDER}
            />
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="patch-container"
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        transform: `rotate(${rotation + wiggle}deg)`,
        willChange: 'transform',
      }}
    >
      {renderShape()}
    </div>
  );
};

export default Patch;
