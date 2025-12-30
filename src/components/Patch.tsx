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
 * Renders a textile patch with stitch patterns.
 * 
 * COLOR FIX: SVG patterns in <defs> don't inherit CSS color from parent elements.
 * Solution: Render pattern inline within each patch SVG using the color prop directly.
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

  // Generate unique pattern ID for this patch instance
  const patternId = `pattern-${id}-${pattern}`;

  // Render inline pattern definition based on pattern type
  const renderPatternDef = () => {
    switch (pattern) {
      case 'crossstitch':
        return (
          <pattern id={patternId} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="white" />
            <line x1="1" y1="1" x2="7" y2="7" stroke={color} strokeWidth="1" />
            <line x1="7" y1="1" x2="1" y2="7" stroke={color} strokeWidth="1" />
          </pattern>
        );
      case 'horizontal':
        return (
          <pattern id={patternId} x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse">
            <rect width="3" height="3" fill="white" />
            <line x1="0" y1="1.5" x2="3" y2="1.5" stroke={color} strokeWidth="0.8" />
          </pattern>
        );
      case 'diagonal':
        return (
          <pattern id={patternId} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="white" />
            <line x1="0" y1="0" x2="10" y2="10" stroke={color} strokeWidth="1" />
            <line x1="10" y1="0" x2="0" y2="10" stroke={color} strokeWidth="1" />
          </pattern>
        );
      case 'dots':
        return (
          <pattern id={patternId} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="white" />
            <circle cx="4" cy="4" r="1.5" fill={color} />
          </pattern>
        );
      case 'vertical':
        return (
          <pattern id={patternId} x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse">
            <rect width="3" height="3" fill="white" />
            <line x1="1.5" y1="0" x2="1.5" y2="3" stroke={color} strokeWidth="0.8" />
          </pattern>
        );
      case 'chunky':
        return (
          <pattern id={patternId} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="white" />
            <rect x="0" y="0" width="5" height="5" fill={color} opacity="0.3" />
            <rect x="6" y="6" width="5" height="5" fill={color} opacity="0.3" />
            <line x1="0" y1="6" x2="12" y2="6" stroke={color} strokeWidth="1.5" />
            <line x1="6" y1="0" x2="6" y2="12" stroke={color} strokeWidth="1.5" />
          </pattern>
        );
      default:
        return null;
    }
  };

  const renderShape = () => {
    return (
      <svg
        className="patch patch-square"
        width={CELL_SIZE}
        height={CELL_SIZE}
        viewBox={`0 0 ${CELL_SIZE} ${CELL_SIZE}`}
      >
        <defs>
          {renderPatternDef()}
        </defs>
        <rect
          x="0"
          y="0"
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill={`url(#${patternId})`}
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
        zIndex: isPointerDown ? 100 : (isFalling ? 10 : 1),
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
