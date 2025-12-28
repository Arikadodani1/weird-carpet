import React, { useState } from 'react';
import { CELL_SIZE, PATCH_BORDER } from '../utils/constants';
import './Patch.css';

export type StitchPattern = 'crossstitch' | 'horizontal' | 'diagonal' | 'dots' | 'vertical' | 'chunky';

export interface PatchProps {
  shape: 'square'; // MVP: Only squares
  color: string;
  pattern: StitchPattern;
  x: number; // Absolute position in pixels
  y: number; // Absolute position in pixels
  rotation?: number; // Base rotation in degrees (always 0 in MVP)
  wiggle?: number; // Wiggle offset in degrees (±5° or ±10° for invalid), decorative only
  isFalling?: boolean; // Only attach event handlers to falling patches
  isInvalid?: boolean; // Invalid placement (same pattern adjacent)
  id?: string; // Patch ID for event handler callbacks
  onDragStart?: (id: string, clientX: number, clientY: number) => void;
  onDrag?: (id: string, clientX: number, clientY: number) => void;
  onDragEnd?: (id: string) => void;
}

/**
 * Patch Component (MVP)
 *
 * Renders a textile patch with one of two shapes:
 * - Square: 50px × 50px
 * - Rectangle: 100px × 50px (2 cells wide)
 *
 * MVP Features:
 * - Stitch pattern textures (6 patterns)
 * - 3px border for definition
 * - Uses CSS transforms for GPU acceleration
 * - Decorative wiggle animation (±5°)
 * - Horizontal drag to position
 * - Absolute positioning
 */
const Patch: React.FC<PatchProps> = ({
  shape, color, pattern, x, y, rotation = 0, wiggle = 0,
  isFalling = false, isInvalid = false, id, onDragStart, onDrag, onDragEnd
}) => {
  const [isPointerDown, setIsPointerDown] = useState(false);

  // MVP: Simple drag event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isFalling || !id) return;

    e.preventDefault();
    e.stopPropagation();
    setIsPointerDown(true);

    // Capture pointer for drag
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    onDragStart?.(id, e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown || !id) return;

    e.preventDefault();
    onDrag?.(id, e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isPointerDown || !id) return;

    e.preventDefault();
    setIsPointerDown(false);

    // Release pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    onDragEnd?.(id);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    handlePointerUp(e);
  };

  // MVP: Only squares - simplified rendering
  const patternId = `#${pattern}`;

  const renderShape = () => {
    return (
      <svg
        className="patch patch-square"
        width={CELL_SIZE}
        height={CELL_SIZE}
        viewBox={`0 0 ${CELL_SIZE} ${CELL_SIZE}`}
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
          stroke={isInvalid ? "#FF8C42" : "#333"}
          strokeWidth={PATCH_BORDER}
          strokeDasharray={isInvalid ? "4 2" : undefined}
        />
      </svg>
    );
  };

  return (
    <div
      className={`patch-container ${isFalling ? 'is-falling' : ''} ${isPointerDown ? 'is-dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        transform: `rotate(${rotation + wiggle}deg)`,
        willChange: 'transform',
        color: color, // Apply color to container so currentColor in patterns works
      }}
      onPointerDown={isFalling ? handlePointerDown : undefined}
      onPointerMove={isFalling ? handlePointerMove : undefined}
      onPointerUp={isFalling ? handlePointerUp : undefined}
      onPointerCancel={isFalling ? handlePointerCancel : undefined}
    >
      {renderShape()}
    </div>
  );
};

export default Patch;
