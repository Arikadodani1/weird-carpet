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
const FORGIVENESS_THRESHOLD = 10;
const MAX_INVALID_PATCHES = 6; // Stop spawning when this many invalid patches exist

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
  const [isPaused, setIsPaused] = useState(false);
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

    // Clamp to valid grid bounds
    return {
      col: Math.max(0, Math.min(GRID_COLS - 1, col)),
      row: Math.max(0, Math.min(GRID_ROWS - 1, row))
    };
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
    } else if (placedPatches.length === 38) { // Forgiveness mode starts (48 - 10)
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

    // Safety: if patch disappeared, clear interaction state
    if (!patch) {
      clearInteractionState(patchId);
      return;
    }

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
  }, [fallingPatches, getInteractionState, clearInteractionState]);

  // Handle drag end - snap to grid and re-evaluate validity
  const handleDragEnd = useCallback((patchId: string) => {
    setFallingPatches(prev =>
      prev.map(p =>
        p.id === patchId
          ? { ...p, position: { ...p.position, x: snapToGrid(p.position.x) } }
          : p
      )
    );

    // Clear invalid status - animation loop will re-evaluate on next frame
    setInvalidPatchIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(patchId);
      return newSet;
    });

    clearInteractionState(patchId);
  }, [clearInteractionState]);

  // Find stop position for a patch in its column (based on placed patches only)
  const findStopY = useCallback((x: number): number => {
    const col = Math.round((x - GRID_OFFSET_X) / CELL_SIZE);

    // Find the lowest empty row in this column from placed patches
    let stopRow = -1;
    for (let row = GRID_ROWS - 1; row >= 0; row--) {
      if (!gridOccupancy.current[col][row].occupied) {
        stopRow = row;
        break;
      }
    }

    // Column is full
    if (stopRow === -1) return -1;

    // IMPORTANT: Ensure stopY is never negative
    const stopY = stopRow * CELL_SIZE;
    return Math.max(0, stopY);
  }, []);

  // Find effective stop position accounting for other falling patches
  const findEffectiveStopY = useCallback((patch: PatchType, allFallingPatches: PatchType[]): number => {
    const snappedX = snapToGrid(patch.position.x);
    const col = Math.round((snappedX - GRID_OFFSET_X) / CELL_SIZE);

    // Base stop from placed patches (grid floor for this column)
    const baseStopY = findStopY(snappedX);

    // If column is full from placed patches, return -1
    if (baseStopY === -1) return -1;

    let stopY = baseStopY;

    // Check other falling patches in same column
    for (const other of allFallingPatches) {
      if (other.id === patch.id) continue;

      // Skip patches being dragged
      const otherInteractionState = interactionStateRef.current.get(other.id);
      if (otherInteractionState?.isDragging) continue;

      const otherX = snapToGrid(other.position.x);
      const otherCol = Math.round((otherX - GRID_OFFSET_X) / CELL_SIZE);

      if (otherCol !== col) continue;

      // Calculate where this other patch WILL settle (its own stop position)
      // We need to find the base stop for this other patch too
      let otherBaseStopY = baseStopY;

      // Check patches below the other patch to find its true stop
      for (const below of allFallingPatches) {
        if (below.id === other.id || below.id === patch.id) continue;

        const belowX = snapToGrid(below.position.x);
        const belowCol = Math.round((belowX - GRID_OFFSET_X) / CELL_SIZE);

        if (belowCol === col && below.position.y > other.position.y) {
          // There's another patch below - check if IT is settled
          const belowGridY = Math.round(below.position.y / CELL_SIZE) * CELL_SIZE;
          const belowIsSettled = Math.abs(below.position.y - belowGridY) < 5;

          if (belowIsSettled) {
            otherBaseStopY = Math.min(otherBaseStopY, belowGridY - CELL_SIZE);
          }
        }
      }

      // Now check if the OTHER patch has reached ITS stop position
      const otherGridY = Math.round(other.position.y / CELL_SIZE) * CELL_SIZE;
      const otherIsSettled = other.position.y >= otherBaseStopY - 5 && Math.abs(other.position.y - otherGridY) < 10;

      // ONLY treat as obstacle if:
      // 1. Other patch is SETTLED (at its stop position)
      // 2. Other patch is BELOW our current patch
      if (otherIsSettled && other.position.y > patch.position.y) {
        const blockingY = otherGridY - CELL_SIZE;
        if (blockingY >= 0) {
          stopY = Math.min(stopY, blockingY);
        }
      }
    }

    return Math.max(0, stopY);
  }, [findStopY]);

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
    setIsPaused(false);
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

  // Check if a patch's foundation (patch below it) is invalid (cascading invalidity)
  const isFoundationInvalid = useCallback((col: number, row: number, currentFallingPatches: PatchType[]): boolean => {
    // Check the row below this position
    const rowBelow = row + 1;

    // If at bottom of grid, foundation is solid (grid floor)
    if (rowBelow >= GRID_ROWS) {
      return false;
    }

    // Check if there's a falling patch directly below that is invalid
    for (const patch of currentFallingPatches) {
      const patchX = snapToGrid(patch.position.x);
      const patchCol = Math.round((patchX - GRID_OFFSET_X) / CELL_SIZE);

      // Snap Y to grid for comparison
      const patchGridY = Math.round(patch.position.y / CELL_SIZE) * CELL_SIZE;
      const patchRow = patchGridY / CELL_SIZE;

      if (patchCol === col && patchRow === rowBelow) {
        // There's a patch below - check if it's invalid
        if (invalidPatchIds.has(patch.id)) {
          return true;
        }
        // Also check if THAT patch's foundation is invalid (recursive cascade)
        if (isFoundationInvalid(col, rowBelow, currentFallingPatches)) {
          return true;
        }
      }
    }

    return false;
  }, [invalidPatchIds]);

  // Game loop - handles fall animation and collision
  useEffect(() => {
    // Don't animate when paused or grid is full
    if (isPaused || isGridFull) return;

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
          const snappedX = snapToGrid(patch.position.x);
          const stopY = findEffectiveStopY(patch, prevPatches);
          const interactionState = interactionStateRef.current.get(patch.id);
          const isBeingDragged = interactionState?.isDragging === true;

          // Log patch state every few seconds (not every frame)
          if (Math.random() < 0.01) { // ~1% of frames
            console.log('Patch state:', {
              id: patch.id.slice(-6),
              y: Math.round(patch.position.y),
              stopY,
              isBeingDragged,
              isInvalid: invalidPatchIds.has(patch.id),
              inPlacingSet: placingPatchIdsRef.current.has(patch.id),
            });
          }

          // DETECT STUCK: If patch is not at stopY, not being dragged, and in placing set
          // This means it got stuck - remove from placing set so it can continue falling
          if (!isBeingDragged &&
              patch.position.y < stopY &&
              placingPatchIdsRef.current.has(patch.id)) {
            console.error('UNSTICKING PATCH:', {
              id: patch.id.slice(-6),
              y: patch.position.y,
              stopY,
              reason: 'Removing from placingPatchIds - will resume falling'
            });
            placingPatchIdsRef.current.delete(patch.id);
          }

          // Skip patches that are already being placed (and not stuck)
          if (placingPatchIdsRef.current.has(patch.id)) {
            return;
          }

          // Calculate wiggle
          const wiggleProgress = (timestamp % WIGGLE_CYCLE) / WIGGLE_CYCLE;
          const baseWiggle = Math.sin(wiggleProgress * Math.PI * 2) * 5;

          // SAFETY: If patch is above grid and not being dragged, force it to fall
          if (patch.position.y < 0) {
            if (!isBeingDragged) {
              // Patch is above grid - let it fall
              const fallDistance = FALL_SPEED * deltaTime;
              const newY = patch.position.y + fallDistance;

              updatedPatches.push({
                ...patch,
                position: { x: snappedX, y: newY },
                wiggle: baseWiggle,
              });
              return; // Skip normal processing for this patch
            }
          }

          // Invalid patches wiggle more
          const isInvalid = invalidPatchIds.has(patch.id);
          const wiggle = isInvalid ? baseWiggle * 2 : baseWiggle;

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

            // Check for invalid placement
            let hasInvalidPlacement = false;

            if (!inForgivenessMode) {
              // Check 1: Same pattern adjacent (original rule)
              const hasSamePatternAdjacent = hasAdjacentSamePattern(snappedX, stopY, patch.pattern);

              // Check 2: Is this patch sitting on an invalid foundation? (cascading invalidity)
              const { col: targetCol, row: targetRow } = posToCell(snappedX, stopY);
              const hasInvalidFoundation = isFoundationInvalid(targetCol, targetRow, prevPatches);

              hasInvalidPlacement = hasSamePatternAdjacent || hasInvalidFoundation;

              if (hasInvalidFoundation && !hasSamePatternAdjacent) {
                console.log(`Patch ${patch.id} invalid due to foundation (cascading)`);
              }
            }

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

              // Validate position before placing
              if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) {
                console.error('Invalid placement position:', { col, row, stopY });
                // Keep patch falling - don't place at invalid position
                placingPatchIdsRef.current.delete(patch.id);
                updatedPatches.push({
                  ...patch,
                  position: { x: snappedX, y: patch.position.y },
                  wiggle: baseWiggle,
                });
                return;
              }

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

        // Re-evaluate cascading invalidity for all patches
        // When one patch's validity changes, patches above it may need to update
        for (const patch of updatedPatches) {
          const patchX = snapToGrid(patch.position.x);
          const patchGridY = Math.round(patch.position.y / CELL_SIZE) * CELL_SIZE;
          const { col, row } = posToCell(patchX, patchGridY);

          // Check if this patch should be invalid due to foundation
          const hasInvalidFoundation = isFoundationInvalid(col, row, updatedPatches);
          const hasSamePatternAdjacent = hasAdjacentSamePattern(patchX, patchGridY, patch.pattern);
          const shouldBeInvalid = hasInvalidFoundation || hasSamePatternAdjacent;
          const isCurrentlyInvalid = invalidPatchIds.has(patch.id);

          if (shouldBeInvalid && !isCurrentlyInvalid) {
            setInvalidPatchIds(prev => new Set(prev).add(patch.id));
          } else if (!shouldBeInvalid && isCurrentlyInvalid) {
            setInvalidPatchIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(patch.id);
              return newSet;
            });
          }
        }

        // SAFETY NET: Log if any patches were lost
        const processedIds = new Set([
          ...updatedPatches.map(p => p.id),
          ...newlyPlacedPatches.map(p => p.id),
          ...Array.from(placingPatchIdsRef.current)
        ]);

        const lostPatches = prevPatches.filter(p => !processedIds.has(p.id));
        if (lostPatches.length > 0) {
          console.error('LOST PATCHES:', lostPatches.map(p => ({
            id: p.id.slice(-8),
            y: p.position.y,
          })));
          // Add them back to prevent disappearing
          updatedPatches.push(...lostPatches);
        }

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
  }, [isPaused, isGridFull, findEffectiveStopY, hasAdjacentSamePattern, isFoundationInvalid, invalidPatchIds, posToCell, occupyCell, placedPatches.length]);

  // Patch generation
  useEffect(() => {
    if (isGridFull || isPaused) return;

    // Count invalid vs valid falling patches separately
    const invalidFallingCount = fallingPatches.filter(p => invalidPatchIds.has(p.id)).length;
    const validFallingCount = fallingPatches.length - invalidFallingCount;

    // Don't spawn if too many invalid patches (max 6)
    if (invalidFallingCount >= MAX_INVALID_PATCHES) {
      return;
    }

    // Don't spawn if already have max valid falling patches (max 3)
    if (validFallingCount >= MAX_FALLING_PATCHES) {
      return;
    }

    // Don't spawn more patches than remaining empty cells
    const emptyCells = (GRID_COLS * GRID_ROWS) - placedPatches.length;
    if (emptyCells <= 0 || fallingPatches.length >= emptyCells) {
      return;
    }

    // If we CAN spawn (passed all checks above) but canSpawnNext is false,
    // set a timer to enable spawning
    if (!canSpawnNext) {
      if (!spawnTimeoutRef.current) {
        spawnTimeoutRef.current = setTimeout(() => {
          setCanSpawnNext(true);
          spawnTimeoutRef.current = null;
        }, PATCH_GENERATION_DELAY);
      }
      return;
    }

    // Spawn a new patch
    const newPatch = generatePatch();
    if (newPatch) {
      setFallingPatches(prev => [...prev, newPatch]);
    }
    setCanSpawnNext(false);

    // Clear any existing timeout
    if (spawnTimeoutRef.current) {
      clearTimeout(spawnTimeoutRef.current);
      spawnTimeoutRef.current = null;
    }

  }, [canSpawnNext, fallingPatches, generatePatch, isGridFull, isPaused, placedPatches.length, invalidPatchIds]);

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

      {/* Control buttons */}
      {!isGridFull && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          display: 'flex',
          gap: '8px',
          zIndex: 100,
        }}>
          <button
            onClick={() => setIsPaused(!isPaused)}
            style={{
              padding: '8px 16px',
              fontSize: '16px',
              backgroundColor: isPaused ? '#4ECDC4' : '#f0f0f0',
              color: isPaused ? 'white' : '#333',
              border: '2px solid #333',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              touchAction: 'manipulation',
            }}
          >
            {isPaused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
          <button
            onClick={handleRestart}
            style={{
              padding: '8px 12px',
              fontSize: '18px',
              backgroundColor: '#f0f0f0',
              border: '2px solid #333',
              borderRadius: '8px',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
            title="Restart Game"
          >
            🔄
          </button>
        </div>
      )}

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
          {/* Milestone message - shown prominently when active */}
          {milestoneMessage && (
            <div style={{
              textAlign: 'center',
              padding: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#4ECDC4',
              marginBottom: '8px',
            }}>
              {milestoneMessage}
            </div>
          )}

          {/* Invalid placement hint */}
          {invalidPatchIds.size > 0 && !isGridFull && (
            <div style={{
              textAlign: 'center',
              fontSize: '14px',
              color: '#FF8C42',
              padding: '4px',
              fontStyle: 'italic',
            }}>
              Same pattern nearby - drag to another spot!
            </div>
          )}

          {/* Progress bar - only when not complete */}
          {!isGridFull && (
            <div style={{ textAlign: 'center', padding: '12px' }}>
              <div style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
                {placedPatches.length} / {GRID_COLS * GRID_ROWS} patches
              </div>
              <div style={{
                width: '200px',
                height: '8px',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                margin: '0 auto',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(placedPatches.length / (GRID_COLS * GRID_ROWS)) * 100}%`,
                  height: '100%',
                  backgroundColor: '#4ECDC4',
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
    </div>
  );
}

export default App;
