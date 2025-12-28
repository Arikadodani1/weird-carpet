import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Grid from './components/Grid';
import Patch from './components/Patch';
import StitchPatterns from './components/StitchPatterns';
import {
  COLOR_ARRAY,
  STITCH_PATTERNS,
  FALL_SPEED,
  WIGGLE_CYCLE,
  PATCH_GENERATION_DELAY,
  MAX_FALLING_PATCHES,
  GRID_HEIGHT,
  GRID_WIDTH,
  CARPET_ZONE_BOTTOM,
  CELL_SIZE,
  GRID_OFFSET_X,
} from './utils/constants';
import type { Patch as PatchType, StitchPattern } from './types';

/**
 * Weird Carpet - Phase 3: User Interaction
 *
 * A meditative patch-arrangement game where users arrange falling textile patches
 * on a 6×8 grid. This phase adds tap-to-rotate, drag positioning, and long-press feedback.
 *
 * Layout:
 * - Viewport: 400px × 700px
 * - Falling Zone: 0-200px (patches spawn and descend here)
 * - Carpet Zone: 200-600px (6×8 grid, 300×400px)
 * - Bottom Margin: 600-700px (100px UI space)
 *
 * Phase 3 Features:
 * - Tap to rotate (45° increments, 8 orientations)
 * - Drag to position (horizontal + vertical, gravity applies)
 * - Long-press wobble feedback (±10° after 500ms)
 * - Grid snapping (patches align to 50px cells)
 * - Proper collision detection (no overlapping)
 */

// MVP FIX: Snap X position to nearest column (0-5) with grid offset
const snapToGrid = (x: number): number => {
  // Remove offset, snap to column, re-add offset
  const gridX = x - GRID_OFFSET_X;
  const col = Math.max(0, Math.min(5, Math.round(gridX / CELL_SIZE)));
  return GRID_OFFSET_X + col * CELL_SIZE;
};

// Interaction state for tracking drag gestures (MVP: Simple drag only)
interface InteractionState {
  isDragging: boolean;
  dragStartPos: { x: number; y: number };
  pointerStartPos: { x: number; y: number };
}

function App() {
  const [fallingPatches, setFallingPatches] = useState<PatchType[]>([]);
  const [placedPatches, setPlacedPatches] = useState<PatchType[]>([]);
  const [canSpawnNext, setCanSpawnNext] = useState(true);
  const [isGridFull, setIsGridFull] = useState(false);
  const [invalidPatchIds, setInvalidPatchIds] = useState<Set<string>>(new Set()); // Patches with invalid placement

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const spawnTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const interactionStateRef = useRef<Map<string, InteractionState>>(new Map());

  // Log grid configuration on startup
  useEffect(() => {
    console.log('=== WEIRD CARPET INITIALIZED ===');
    console.log('Grid Configuration:', {
      cols: 6,
      rows: 8,
      gridWidth: '300px',
      gridHeight: '400px',
      carpetZoneBottom: CARPET_ZONE_BOTTOM + 'px',
    });
    console.log('===================================');
  }, []);

  // MVP: Stop at exactly 48 squares (6 cols × 8 rows = 48 cells)
  useEffect(() => {
    console.log('Placed patches count:', placedPatches.length, 'Grid full?', placedPatches.length >= 48);

    const gridFull = placedPatches.length >= 48;
    setIsGridFull(gridFull);

    if (placedPatches.length === 48) {
      console.log('🎉 Carpet Complete! Exactly 48 squares placed.');
    }
  }, [placedPatches]);

  // Interaction state helpers
  const getInteractionState = useCallback((patchId: string): InteractionState => {
    if (!interactionStateRef.current.has(patchId)) {
      interactionStateRef.current.set(patchId, {
        isDragging: false,
        dragStartPos: { x: 0, y: 0 },
        pointerStartPos: { x: 0, y: 0 },
      });
    }
    return interactionStateRef.current.get(patchId)!;
  }, []);

  const clearInteractionState = useCallback((patchId: string) => {
    interactionStateRef.current.delete(patchId);
  }, []);

  // MVP: Generate a random square patch
  const generatePatch = useCallback((): PatchType => {
    // Generate unique ID
    const uniqueId = `patch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // MVP: Only squares
    const shape = 'square';
    const color = COLOR_ARRAY[Math.floor(Math.random() * COLOR_ARRAY.length)];
    const pattern = STITCH_PATTERNS[Math.floor(Math.random() * STITCH_PATTERNS.length)] as StitchPattern;

    // MVP FIX: Spawn in one of 6 columns with grid offset
    // Columns 0-5: x = 50, 100, 150, 200, 250, 300 (with offset)
    const col = Math.floor(Math.random() * 6); // 0-5
    const startX = GRID_OFFSET_X + col * CELL_SIZE;
    const startY = -CELL_SIZE - 10; // Just above falling zone

    const newPatch: PatchType = {
      id: uniqueId,
      shape,
      color,
      pattern,
      position: { x: startX, y: startY },
      rotation: 0,
      isFalling: true,
      isPlaced: false,
      wiggle: 0,
    };

    console.log('Square spawned:', { id: uniqueId, col, x: startX, y: startY });
    return newPatch;
  }, []);

  // Interaction Handlers (MVP: Drag only, no rotation)

  // Handle drag start (pointer down) - MVP: Simple drag, no long-press
  const handleDragStart = useCallback((patchId: string, clientX: number, clientY: number) => {
    const patch = fallingPatches.find(p => p.id === patchId);
    if (!patch) return;

    const state = getInteractionState(patchId);
    state.pointerStartPos = { x: clientX, y: clientY };
    state.dragStartPos = { x: patch.position.x, y: patch.position.y };
    state.isDragging = false; // Will be set to true on first move
  }, [fallingPatches, getInteractionState]);

  // MVP: Handle horizontal drag (squares only)
  const handleDrag = useCallback((patchId: string, clientX: number, clientY: number) => {
    const state = getInteractionState(patchId);
    const patch = fallingPatches.find(p => p.id === patchId);
    if (!patch) return;

    state.isDragging = true;

    const deltaX = clientX - state.pointerStartPos.x;
    let newX = state.dragStartPos.x + deltaX;

    // MVP FIX: Constrain to grid bounds with offset
    // Squares: x = 50 to 300 (columns 0-5)
    const minX = GRID_OFFSET_X;
    const maxX = GRID_OFFSET_X + GRID_WIDTH - CELL_SIZE; // 50 + 300 - 50 = 300
    newX = Math.max(minX, Math.min(maxX, newX));

    // Update patch position (only horizontal drag)
    setFallingPatches(prev =>
      prev.map(p =>
        p.id === patchId
          ? { ...p, position: { x: newX, y: p.position.y } }
          : p
      )
    );
  }, [fallingPatches, getInteractionState]);

  // Handle drag end (pointer up) - MVP FIX: Snap to grid on release
  const handleDragEnd = useCallback((patchId: string) => {
    // Snap patch to grid when user releases drag
    setFallingPatches(prev =>
      prev.map(p =>
        p.id === patchId
          ? { ...p, position: { ...p.position, x: snapToGrid(p.position.x) } }
          : p
      )
    );

    clearInteractionState(patchId);
  }, [clearInteractionState]);

  // MVP: Find stop position for square in its column (simplified)
  const findStopY = useCallback((x: number): number => {
    // Default: grid bottom (row 7, y = 350)
    let stopY = GRID_HEIGHT - CELL_SIZE;

    // Check each placed patch in same column
    for (const placed of placedPatches) {
      if (placed.position.x === x) {
        // Same column - stop above this patch
        stopY = Math.min(stopY, placed.position.y - CELL_SIZE);
      }
    }

    return stopY;
  }, [placedPatches]);

  // Feature 1: Check if adjacent patches have same pattern
  const hasAdjacentSamePattern = useCallback((x: number, y: number, pattern: StitchPattern): boolean => {
    const neighbors = [
      { x: x, y: y - CELL_SIZE },      // above
      { x: x, y: y + CELL_SIZE },      // below
      { x: x - CELL_SIZE, y: y },      // left
      { x: x + CELL_SIZE, y: y },      // right
    ];

    for (const neighbor of neighbors) {
      const adjacentPatch = placedPatches.find(
        p => p.position.x === neighbor.x && p.position.y === neighbor.y
      );
      if (adjacentPatch && adjacentPatch.pattern === pattern) {
        return true; // Same pattern found in adjacent cell!
      }
    }
    return false;
  }, [placedPatches]);

  // Feature 2: Analyze carpet for pattern/color variety
  const analyzeCarpet = useCallback((patches: PatchType[]): string => {
    // Divide grid into 4 quadrants (accounting for grid offset)
    const centerX = GRID_OFFSET_X + (GRID_WIDTH / 2);  // 50 + 150 = 200
    const centerY = GRID_HEIGHT / 2;  // 200

    const quadrants = {
      topLeft: patches.filter(p => p.position.x < centerX && p.position.y < centerY),
      topRight: patches.filter(p => p.position.x >= centerX && p.position.y < centerY),
      bottomLeft: patches.filter(p => p.position.x < centerX && p.position.y >= centerY),
      bottomRight: patches.filter(p => p.position.x >= centerX && p.position.y >= centerY),
    };

    // Count unique patterns per quadrant
    const uniquePatterns = Object.values(quadrants).map(q =>
      new Set(q.map(p => p.pattern)).size
    );

    // Count unique colors per quadrant
    const uniqueColors = Object.values(quadrants).map(q =>
      new Set(q.map(p => p.color)).size
    );

    const avgPatternVariety = uniquePatterns.reduce((a, b) => a + b, 0) / 4;
    const avgColorVariety = uniqueColors.reduce((a, b) => a + b, 0) / 4;

    console.log('Carpet Analysis:', {
      avgPatternVariety,
      avgColorVariety,
      quadrants: {
        topLeft: { patterns: uniquePatterns[0], colors: uniqueColors[0] },
        topRight: { patterns: uniquePatterns[1], colors: uniqueColors[1] },
        bottomLeft: { patterns: uniquePatterns[2], colors: uniqueColors[2] },
        bottomRight: { patterns: uniquePatterns[3], colors: uniqueColors[3] },
      }
    });

    if (avgPatternVariety >= 4 && avgColorVariety >= 4) {
      return "🎨 Beautifully Chaotic!";
    } else if (avgPatternVariety >= 3 || avgColorVariety >= 3) {
      return "✨ Nice Pattern!";
    } else {
      return "🔄 Try Mixing It Up!";
    }
  }, []);

  // Game loop - handles fall animation and wiggle
  useEffect(() => {
    const animate = (timestamp: number) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }

      const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000; // Convert to seconds
      lastFrameTimeRef.current = timestamp;

      setFallingPatches(prevPatches => {
        const updatedPatches: PatchType[] = []; // Patches still falling
        const newlyPlacedPatches: PatchType[] = []; // Patches that just collided

        prevPatches.forEach(patch => {
          // Calculate wiggle (sine wave oscillation - decorative only)
          const wiggleProgress = (timestamp % WIGGLE_CYCLE) / WIGGLE_CYCLE;
          const wiggle = Math.sin(wiggleProgress * Math.PI * 2) * 5; // ±5° decorative wiggle

          // Calculate new position (fall speed: 30px/s)
          // Gravity applies even while dragging
          const fallDistance = FALL_SPEED * deltaTime;
          const state = interactionStateRef.current.get(patch.id);
          let newY = patch.position.y + fallDistance;

          // If dragging, patch continues to fall but at current drag position
          // (handleDrag already updated position, we just add gravity)
          if (state?.isDragging) {
            newY = patch.position.y + fallDistance;
          }

          // MVP: Check if square reached stop position in its column
          const snappedX = snapToGrid(patch.position.x);
          const stopY = findStopY(snappedX);

          if (newY >= stopY) {
            // COLLISION - Check if placement is valid (no adjacent same patterns)
            const hasInvalidPlacement = hasAdjacentSamePattern(snappedX, stopY, patch.pattern);

            if (hasInvalidPlacement) {
              // INVALID PLACEMENT - Same pattern adjacent!
              console.log('❌ Invalid placement:', { id: patch.id, pattern: patch.pattern, x: snappedX, y: stopY });

              // Mark patch as invalid for visual feedback
              setInvalidPatchIds(prev => new Set(prev).add(patch.id));

              // Keep patch falling with increased wiggle (±10°)
              updatedPatches.push({
                ...patch,
                position: { ...patch.position, y: stopY }, // Set to stop position but keep falling
                wiggle: 10, // Increased wiggle for visual feedback
              });
            } else {
              // VALID PLACEMENT - Place square at stop position
              const placedPatch: PatchType = {
                ...patch,
                position: { x: snappedX, y: stopY },
                isFalling: false,
                isPlaced: true,
                wiggle: 0,
              };

              const col = (snappedX - GRID_OFFSET_X) / CELL_SIZE;
              const row = stopY / CELL_SIZE;
              console.log('✅ Square placed:', { id: patch.id, col, row, x: snappedX, y: stopY, pattern: patch.pattern });

              // Remove from invalid list if it was there
              setInvalidPatchIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(patch.id);
                return newSet;
              });

              newlyPlacedPatches.push(placedPatch);
              // CRITICAL: Do NOT add to updatedPatches - remove from fallingPatches!
            }
          } else {
            // No collision - continue falling with wiggle
            // Log falling position occasionally for debugging
            if (Math.random() < 0.05) { // Log 5% of frames
              console.log('Patch falling:', { id: patch.id, y: newY, bottom: newY + CELL_SIZE });
            }
            updatedPatches.push({
              ...patch,
              position: { ...patch.position, y: newY },
              wiggle,
            });
          }
        });

        // Move newly placed patches to placedPatches state
        if (newlyPlacedPatches.length > 0) {
          newlyPlacedPatches.forEach(p => {
            console.log('Patch placed:', {
              id: p.id,
              finalY: p.position.y,
              finalBottom: p.position.y + CELL_SIZE,
              fallingLength: updatedPatches.length
            });
          });

          setPlacedPatches(prev => [...prev, ...newlyPlacedPatches]);

          // Allow new patch to spawn after delay (0.5s)
          if (spawnTimeoutRef.current) {
            clearTimeout(spawnTimeoutRef.current);
          }
          spawnTimeoutRef.current = setTimeout(() => {
            setCanSpawnNext(true);
          }, PATCH_GENERATION_DELAY);
        }

        // Return only patches that are still falling (removes placed patches from array)
        return updatedPatches;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [findStopY, hasAdjacentSamePattern]);

  // Patch generation system
  useEffect(() => {
    // Stop spawning if grid is full
    if (isGridFull) {
      return;
    }

    if (canSpawnNext && fallingPatches.length < MAX_FALLING_PATCHES) {
      const newPatch = generatePatch();
      setFallingPatches(prev => [...prev, newPatch]);
      setCanSpawnNext(false);

      // Allow next spawn after initial delay (for the very first patch)
      if (fallingPatches.length === 0) {
        if (spawnTimeoutRef.current) {
          clearTimeout(spawnTimeoutRef.current);
        }
        spawnTimeoutRef.current = setTimeout(() => {
          setCanSpawnNext(true);
        }, PATCH_GENERATION_DELAY);
      }
    }
  }, [canSpawnNext, fallingPatches.length, generatePatch, isGridFull]);

  // Cleanup timeout and interaction state on unmount
  useEffect(() => {
    const interactionStates = interactionStateRef.current;
    return () => {
      if (spawnTimeoutRef.current) {
        clearTimeout(spawnTimeoutRef.current);
      }
      // Clear all interaction states
      interactionStates.clear();
    };
  }, []);

  return (
    <div className="app">
      {/* SVG Pattern Definitions */}
      <StitchPatterns />

      <div className="viewport">
        {/* Falling Zone - Patches descend here */}
        <div className="falling-zone">
          {/* Falling patches rendered here (absolute positioning) */}
        </div>

        {/* Carpet Zone - 6×8 Grid where patches accumulate */}
        <div className="carpet-zone">
          <Grid />

          {/* Render all patches (falling and placed) */}
          {[...fallingPatches, ...placedPatches].map(patch => (
            <Patch
              key={patch.id}
              id={patch.id}
              shape={patch.shape}
              color={patch.color}
              pattern={patch.pattern}
              x={patch.position.x}
              y={patch.position.y}
              rotation={0}
              wiggle={patch.wiggle || 0}
              isFalling={patch.isFalling}
              isInvalid={invalidPatchIds.has(patch.id)}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>

        {/* Bottom Margin - Completion message */}
        <div className="bottom-margin">
          {isGridFull && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>
                🎉 Carpet Complete! 🎉
              </div>
              <div style={{ fontSize: '18px', color: '#666' }}>
                {analyzeCarpet(placedPatches)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
