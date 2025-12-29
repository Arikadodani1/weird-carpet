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
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  GRID_OFFSET_X,
} from './utils/constants';
import type { Patch as PatchType, StitchPattern } from './types';

/**
 * Weird Carpet - MVP
 *
 * A meditative patch-arrangement game where users arrange falling textile patches
 * on a 6×8 grid.
 *
 * Layout:
 * - Viewport: 400px × 700px
 * - Falling Zone: 0-200px (patches spawn and descend here)
 * - Carpet Zone: 200-600px (6×8 grid, 300×400px)
 * - Bottom Margin: 600-700px (100px UI space)
 */

// Forgiveness mode threshold - disable adjacency rule when this many cells remain
const FORGIVENESS_THRESHOLD = 5;

// MVP FIX: Snap X position to nearest column (0-5) with grid offset
const snapToGrid = (x: number): number => {
  // Remove offset, snap to column, re-add offset
  const gridX = x - GRID_OFFSET_X;
  const col = Math.max(0, Math.min(5, Math.round(gridX / CELL_SIZE)));
  return GRID_OFFSET_X + col * CELL_SIZE;
};

// Interaction state for tracking drag gestures
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
  const [invalidPatchIds, setInvalidPatchIds] = useState<Set<string>>(new Set());
  const [carpetFeedback, setCarpetFeedback] = useState<string>('');
  const [milestoneMessage, setMilestoneMessage] = useState<string>('');
  const [varietyHint, setVarietyHint] = useState<string>('');

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const spawnTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const interactionStateRef = useRef<Map<string, InteractionState>>(new Map());
  const placingPatchIdsRef = useRef<Set<string>>(new Set());

  // Track which grid cells are occupied: grid[col][row] = { occupied: boolean, pattern: string | null }
  const gridOccupancy = useRef<{ occupied: boolean; pattern: string | null }[][]>(
    Array(GRID_COLS).fill(null).map(() =>
      Array(GRID_ROWS).fill(null).map(() => ({ occupied: false, pattern: null }))
    )
  );

  // Log grid configuration on startup
  useEffect(() => {
    console.log('=== WEIRD CARPET INITIALIZED ===');
    console.log('Grid Configuration:', {
      cols: GRID_COLS,
      rows: GRID_ROWS,
      gridWidth: GRID_WIDTH + 'px',
      gridHeight: GRID_HEIGHT + 'px',
      totalCells: GRID_COLS * GRID_ROWS,
    });
    console.log('===================================');
  }, []);

  // Helper: Convert pixel position to grid cell
  const posToCell = useCallback((x: number, y: number): { col: number; row: number } => {
    const col = Math.round((x - GRID_OFFSET_X) / CELL_SIZE);
    const row = Math.round(y / CELL_SIZE);
    return { col, row };
  }, []);

  // Helper: Check if a cell is within grid bounds
  const isValidCell = useCallback((col: number, row: number): boolean => {
    return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
  }, []);

  // Helper: Mark a cell as occupied with pattern
  const occupyCell = useCallback((col: number, row: number, pattern: StitchPattern) => {
    if (isValidCell(col, row)) {
      gridOccupancy.current[col][row] = { occupied: true, pattern };
      console.log(`Cell occupied: [${col}, ${row}] with pattern: ${pattern}`);
    }
  }, [isValidCell]);

  // Check if grid is actually full (all 48 cells occupied)
  const checkGridFull = useCallback((): boolean => {
    let occupiedCount = 0;
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        if (gridOccupancy.current[col][row].occupied) {
          occupiedCount++;
        }
      }
    }
    console.log(`Grid occupancy check: ${occupiedCount}/${GRID_COLS * GRID_ROWS} cells filled`);
    return occupiedCount >= GRID_COLS * GRID_ROWS;
  }, []);

  // Update grid full state when patches change
  useEffect(() => {
    const gridFull = checkGridFull();
    setIsGridFull(gridFull);

    if (gridFull) {
      console.log('🎉 Carpet Complete! All 48 cells filled.');
    }
  }, [placedPatches, checkGridFull]);

  // Calculate feedback ONCE when grid becomes full
  useEffect(() => {
    if (isGridFull && placedPatches.length === GRID_COLS * GRID_ROWS && !carpetFeedback) {
      const feedback = analyzeCarpet(placedPatches);
      setCarpetFeedback(feedback);
      console.log('🎉 Final Carpet Analysis:', feedback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGridFull, placedPatches.length, carpetFeedback]);

  // Milestone celebrations
  useEffect(() => {
    if (placedPatches.length === 12) { // 25%
      setMilestoneMessage('🌱 Great start!');
      const timer = setTimeout(() => setMilestoneMessage(''), 2000);
      return () => clearTimeout(timer);
    } else if (placedPatches.length === 24) { // 50%
      setMilestoneMessage('🎨 Halfway there!');
      const timer = setTimeout(() => setMilestoneMessage(''), 2000);
      return () => clearTimeout(timer);
    } else if (placedPatches.length === 36) { // 75%
      setMilestoneMessage('✨ Looking beautiful!');
      const timer = setTimeout(() => setMilestoneMessage(''), 2000);
      return () => clearTimeout(timer);
    } else if (placedPatches.length === 43) { // Forgiveness mode starts
      setMilestoneMessage('🏁 Final stretch - place anywhere!');
      const timer = setTimeout(() => setMilestoneMessage(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [placedPatches.length]);

  // Variety encouragement
  useEffect(() => {
    if (placedPatches.length > 0 && placedPatches.length % 8 === 0 && !isGridFull) {
      // Count unique patterns and colors used so far
      const uniquePatterns = new Set(placedPatches.map(p => p.pattern)).size;
      const uniqueColors = new Set(placedPatches.map(p => p.color)).size;

      if (uniquePatterns < 3) {
        setVarietyHint('💡 Try mixing in different patterns!');
      } else if (uniqueColors < 3) {
        setVarietyHint('🌈 Add some color variety!');
      } else if (uniquePatterns >= 5 && uniqueColors >= 5) {
        setVarietyHint('🎨 Beautiful variety!');
      }

      // Clear after 2.5 seconds
      const timer = setTimeout(() => setVarietyHint(''), 2500);
      return () => clearTimeout(timer);
    }
  }, [placedPatches.length, isGridFull, placedPatches]);

  // Clear falling patches when grid is full
  useEffect(() => {
    if (isGridFull) {
      setFallingPatches([]);
    }
  }, [isGridFull]);

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

  // Generate a random square patch
  const generatePatch = useCallback((): PatchType | null => {
    // Find columns with space
    const availableCols: number[] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      // Check if this column has any empty space
      let hasSpace = false;
      for (let row = 0; row < GRID_ROWS; row++) {
        if (!gridOccupancy.current[col][row].occupied) {
          hasSpace = true;
          break;
        }
      }
      if (hasSpace) {
        availableCols.push(col);
      }
    }

    // No space = grid full, don't spawn
    if (availableCols.length === 0) {
      console.log('All columns full - stopping spawn');
      return null;
    }

    const uniqueId = `patch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const shape = 'square';
    const color = COLOR_ARRAY[Math.floor(Math.random() * COLOR_ARRAY.length)];
    const pattern = STITCH_PATTERNS[Math.floor(Math.random() * STITCH_PATTERNS.length)] as StitchPattern;

    // Pick random available column
    const col = availableCols[Math.floor(Math.random() * availableCols.length)];

    // Validate column is within bounds
    if (col < 0 || col >= GRID_COLS) {
      console.error('Invalid column:', col);
      return null;
    }

    const startX = GRID_OFFSET_X + col * CELL_SIZE;
    const startY = -CELL_SIZE - 10;

    // Validate spawn X position
    const minX = GRID_OFFSET_X;
    const maxX = GRID_OFFSET_X + (GRID_COLS - 1) * CELL_SIZE;
    if (startX < minX || startX > maxX) {
      console.error('Invalid spawn X:', { startX, minX, maxX, col });
      return null;
    }

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

    console.log('Square spawned:', { id: uniqueId, col, x: startX, color, pattern });
    return newPatch;
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((patchId: string, clientX: number, clientY: number) => {
    const patch = fallingPatches.find(p => p.id === patchId);
    if (!patch) return;

    const state = getInteractionState(patchId);
    state.pointerStartPos = { x: clientX, y: clientY };
    state.dragStartPos = { x: patch.position.x, y: patch.position.y };
    state.isDragging = false;
  }, [fallingPatches, getInteractionState]);

  // Handle horizontal and vertical drag
  const handleDrag = useCallback((patchId: string, clientX: number, clientY: number) => {
    const state = getInteractionState(patchId);
    const patch = fallingPatches.find(p => p.id === patchId);
    if (!patch) return;

    state.isDragging = true;

    const deltaX = clientX - state.pointerStartPos.x;
    const deltaY = clientY - state.pointerStartPos.y;

    // Horizontal bounds
    let newX = state.dragStartPos.x + deltaX;
    const minX = GRID_OFFSET_X;
    const maxX = GRID_OFFSET_X + GRID_WIDTH - CELL_SIZE;
    newX = Math.max(minX, Math.min(maxX, newX));

    // Vertical bounds - allow dragging up but not below grid
    let newY = state.dragStartPos.y + deltaY;
    const minY = -CELL_SIZE; // Can go slightly above grid
    const maxY = GRID_HEIGHT - CELL_SIZE; // Can't go below grid bottom
    newY = Math.max(minY, Math.min(maxY, newY));

    setFallingPatches(prev =>
      prev.map(p =>
        p.id === patchId
          ? { ...p, position: { x: newX, y: newY } }
          : p
      )
    );
  }, [fallingPatches, getInteractionState]);

  // Handle drag end - snap to grid
  const handleDragEnd = useCallback((patchId: string) => {
    setFallingPatches(prev =>
      prev.map(p =>
        p.id === patchId
          ? { ...p, position: { ...p.position, x: snapToGrid(p.position.x) } }
          : p
      )
    );
    clearInteractionState(patchId);
  }, [clearInteractionState]);

  // Find stop position for a patch in its column
  const findStopY = useCallback((x: number): number => {
    const col = Math.round((x - GRID_OFFSET_X) / CELL_SIZE);

    // Find the lowest empty row in this column
    for (let row = GRID_ROWS - 1; row >= 0; row--) {
      if (!gridOccupancy.current[col][row].occupied) {
        return row * CELL_SIZE;
      }
    }

    // Column is full - return -1 to indicate no valid position
    return -1;
  }, []);

  // Check if adjacent patches have same pattern using grid-based tracking
  const hasAdjacentSamePattern = useCallback((x: number, y: number, pattern: StitchPattern): boolean => {
    const { col, row } = posToCell(x, y);

    // Check all 4 adjacent cells (up, down, left, right)
    const adjacentCells = [
      { col, row: row - 1 },  // above
      { col, row: row + 1 },  // below
      { col: col - 1, row },  // left
      { col: col + 1, row },  // right
    ];

    for (const cell of adjacentCells) {
      if (isValidCell(cell.col, cell.row)) {
        const gridCell = gridOccupancy.current[cell.col][cell.row];
        if (gridCell.occupied && gridCell.pattern === pattern) {
          return true;
        }
      }
    }
    return false;
  }, [posToCell, isValidCell]);

  // Analyze carpet for pattern/color variety
  const analyzeCarpet = useCallback((patches: PatchType[]): string => {
    const centerX = GRID_OFFSET_X + (GRID_WIDTH / 2);
    const centerY = GRID_HEIGHT / 2;

    const quadrants = {
      topLeft: patches.filter(p => p.position.x < centerX && p.position.y < centerY),
      topRight: patches.filter(p => p.position.x >= centerX && p.position.y < centerY),
      bottomLeft: patches.filter(p => p.position.x < centerX && p.position.y >= centerY),
      bottomRight: patches.filter(p => p.position.x >= centerX && p.position.y >= centerY),
    };

    const uniquePatterns = Object.values(quadrants).map(q =>
      new Set(q.map(p => p.pattern)).size
    );
    const uniqueColors = Object.values(quadrants).map(q =>
      new Set(q.map(p => p.color)).size
    );

    const avgPatternVariety = uniquePatterns.reduce((a, b) => a + b, 0) / 4;
    const avgColorVariety = uniqueColors.reduce((a, b) => a + b, 0) / 4;

    console.log('Carpet Analysis:', { avgPatternVariety, avgColorVariety });

    if (avgPatternVariety >= 4 && avgColorVariety >= 4) {
      return "🎨 Beautifully Chaotic!";
    } else if (avgPatternVariety >= 3 || avgColorVariety >= 3) {
      return "✨ Nice Pattern!";
    } else {
      return "🔄 Try Mixing It Up!";
    }
  }, []);

  // Restart game
  const handleRestart = useCallback(() => {
    setFallingPatches([]);
    setPlacedPatches([]);
    setIsGridFull(false);
    setInvalidPatchIds(new Set());
    setCanSpawnNext(true);
    setCarpetFeedback(''); // Reset feedback
    setMilestoneMessage('');
    setVarietyHint('');
    placingPatchIdsRef.current.clear();
    // Reset grid occupancy
    gridOccupancy.current = Array(GRID_COLS).fill(null).map(() =>
      Array(GRID_ROWS).fill(null).map(() => ({ occupied: false, pattern: null }))
    );
    console.log('🔄 Game restarted');
  }, []);

  // Game loop - handles fall animation and collision
  useEffect(() => {
    const animate = (timestamp: number) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }

      const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = timestamp;

      setFallingPatches(prevPatches => {
        const updatedPatches: PatchType[] = [];
        const newlyPlacedPatches: PatchType[] = [];

        prevPatches.forEach(patch => {
          // Skip patches that are already being placed
          if (placingPatchIdsRef.current.has(patch.id)) {
            return;
          }

          // Calculate wiggle
          const wiggleProgress = (timestamp % WIGGLE_CYCLE) / WIGGLE_CYCLE;
          const baseWiggle = Math.sin(wiggleProgress * Math.PI * 2) * 5;

          // Invalid patches wiggle more
          const isInvalid = invalidPatchIds.has(patch.id);
          const wiggle = isInvalid ? baseWiggle * 2 : baseWiggle;

          // Check if patch is being dragged - skip collision detection if so
          const interactionState = interactionStateRef.current.get(patch.id);
          const isBeingDragged = interactionState?.isDragging === true;

          if (isBeingDragged) {
            // Don't apply gravity or check collision while being dragged
            // Just update wiggle and keep at current position
            updatedPatches.push({
              ...patch,
              wiggle,
            });
            return;
          }

          // Calculate fall (only when not being dragged)
          const fallDistance = FALL_SPEED * deltaTime;
          let newY = patch.position.y + fallDistance;

          // Check stop position
          const snappedX = snapToGrid(patch.position.x);
          const stopY = findStopY(snappedX);

          // If column is full (stopY === -1), stop at top and mark invalid
          if (stopY === -1) {
            // Stop at y=0 (top of grid) and mark as invalid
            setInvalidPatchIds(prev => new Set(prev).add(patch.id));
            updatedPatches.push({
              ...patch,
              position: { x: snappedX, y: 0 },
              wiggle: 10, // Intense wiggle to signal user needs to drag elsewhere
            });
            return;
          }

          if (newY >= stopY) {
            // COLLISION - Check validity
            // Calculate empty cells for forgiveness mode
            const emptyCellsRemaining = (GRID_COLS * GRID_ROWS) - placedPatches.length;
            const inForgivenessMode = emptyCellsRemaining <= FORGIVENESS_THRESHOLD;

            // Skip adjacency check if in forgiveness mode
            const hasInvalidPlacement = inForgivenessMode
              ? false
              : hasAdjacentSamePattern(snappedX, stopY, patch.pattern);

            if (hasInvalidPlacement) {
              // Invalid placement - keep falling with feedback
              setInvalidPatchIds(prev => new Set(prev).add(patch.id));
              updatedPatches.push({
                ...patch,
                position: { x: snappedX, y: stopY },
                wiggle: 10,
              });
            } else {
              // Valid placement!
              // Mark as being placed to prevent duplicates
              placingPatchIdsRef.current.add(patch.id);

              const { col, row } = posToCell(snappedX, stopY);
              occupyCell(col, row, patch.pattern);

              const placedPatch: PatchType = {
                ...patch,
                position: { x: snappedX, y: stopY },
                isFalling: false,
                isPlaced: true,
                wiggle: 0,
              };

              console.log('✅ Patch placed:', { id: patch.id, col, row, pattern: patch.pattern, color: patch.color });
              console.log('Adding to newlyPlacedPatches array');

              setInvalidPatchIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(patch.id);
                return newSet;
              });

              newlyPlacedPatches.push(placedPatch);
            }
          } else {
            // Continue falling
            updatedPatches.push({
              ...patch,
              position: { ...patch.position, y: newY },
              wiggle,
            });
          }
        });

        // Move placed patches to state
        if (newlyPlacedPatches.length > 0) {
          setPlacedPatches(prev => {
            // Filter out any patches that already exist in placedPatches
            const existingIds = new Set(prev.map(p => p.id));
            const uniqueNewPatches = newlyPlacedPatches.filter(p => !existingIds.has(p.id));

            console.log('📊 Updating placedPatches:', {
              previousCount: prev.length,
              newPatchesCount: uniqueNewPatches.length,
              newTotal: prev.length + uniqueNewPatches.length
            });

            // Clear from placing set after successful addition
            uniqueNewPatches.forEach(p => placingPatchIdsRef.current.delete(p.id));

            return [...prev, ...uniqueNewPatches];
          });

          if (spawnTimeoutRef.current) {
            clearTimeout(spawnTimeoutRef.current);
          }
          spawnTimeoutRef.current = setTimeout(() => {
            setCanSpawnNext(true);
          }, PATCH_GENERATION_DELAY);
        }

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
  }, [findStopY, hasAdjacentSamePattern, invalidPatchIds, posToCell, occupyCell]);

  // Patch generation
  useEffect(() => {
    if (isGridFull) return;

    // Don't spawn more patches than empty cells
    const emptyCells = (GRID_COLS * GRID_ROWS) - placedPatches.length;
    if (fallingPatches.length >= emptyCells) {
      return;
    }

    if (canSpawnNext && fallingPatches.length < MAX_FALLING_PATCHES) {
      const newPatch = generatePatch();
      if (newPatch) {
        setFallingPatches(prev => [...prev, newPatch]);
      }
      setCanSpawnNext(false);

      if (fallingPatches.length === 0) {
        if (spawnTimeoutRef.current) {
          clearTimeout(spawnTimeoutRef.current);
        }
        spawnTimeoutRef.current = setTimeout(() => {
          setCanSpawnNext(true);
        }, PATCH_GENERATION_DELAY);
      }
    }
  }, [canSpawnNext, fallingPatches.length, generatePatch, isGridFull, placedPatches.length]);

  // Cleanup
  useEffect(() => {
    const interactionStates = interactionStateRef.current;
    return () => {
      if (spawnTimeoutRef.current) {
        clearTimeout(spawnTimeoutRef.current);
      }
      interactionStates.clear();
    };
  }, []);

  return (
    <div className="app">
      <StitchPatterns />

      <div className="viewport">
        <div className="falling-zone" />

        <div className="carpet-zone">
          <Grid />

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

        <div className="bottom-margin">
          {/* Progress indicator and feedback during gameplay */}
          {!isGridFull && (
            <>
              {/* Progress bar */}
              <div style={{
                textAlign: 'center',
                padding: '16px',
                color: '#666',
              }}>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                  {placedPatches.length} / {GRID_COLS * GRID_ROWS} patches
                </div>
                <div style={{
                  width: '200px',
                  height: '8px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  margin: '0 auto',
                }}>
                  <div style={{
                    width: `${(placedPatches.length / (GRID_COLS * GRID_ROWS)) * 100}%`,
                    height: '100%',
                    backgroundColor: '#4ECDC4',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                {/* Variety hint */}
                {varietyHint && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '14px',
                    color: '#888',
                  }}>
                    {varietyHint}
                  </div>
                )}
              </div>

              {/* Invalid placement hint */}
              {invalidPatchIds.size > 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '8px 16px',
                  color: '#FF8C42',
                  fontSize: '14px',
                  fontStyle: 'italic',
                }}>
                  Same pattern nearby - drag to another column!
                </div>
              )}

              {/* Forgiveness mode indicator */}
              {(GRID_COLS * GRID_ROWS - placedPatches.length) <= FORGIVENESS_THRESHOLD && (
                <div style={{
                  textAlign: 'center',
                  padding: '8px',
                  fontSize: '14px',
                  color: '#4ECDC4',
                  fontWeight: 'bold',
                }}>
                  🏁 Final patches - place anywhere!
                </div>
              )}
            </>
          )}

          {/* Completion UI */}
          {isGridFull && (
            <div style={{
              textAlign: 'center',
              padding: '24px 20px',
              width: '100%',
            }}>
              <div style={{
                fontSize: '26px',
                marginBottom: '8px',
                fontWeight: 'bold',
                color: '#333',
              }}>
                🎉 Carpet Complete! 🎉
              </div>
              <div style={{
                fontSize: '20px',
                color: '#555',
                marginBottom: '28px',
              }}>
                {carpetFeedback}
              </div>
              <button
                onClick={handleRestart}
                style={{
                  padding: '16px 40px',
                  fontSize: '18px',
                  backgroundColor: '#4ECDC4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 14px rgba(78, 205, 196, 0.35)',
                  touchAction: 'manipulation',
                }}
              >
                Make Another Carpet
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Milestone message popup */}
      {milestoneMessage && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255,255,255,0.95)',
          padding: '16px 32px',
          borderRadius: '12px',
          fontSize: '20px',
          fontWeight: 'bold',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          animation: 'fadeInOut 2s ease',
        }}>
          {milestoneMessage}
        </div>
      )}
    </div>
  );
}

export default App;
