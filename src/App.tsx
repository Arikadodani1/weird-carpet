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
  CARPET_ZONE_BOTTOM,
  CELL_SIZE,
} from './utils/constants';
import type { Patch as PatchType, StitchPattern } from './types';

/**
 * Weird Carpet - Phase 2: Fall Mechanics & Animations
 *
 * A meditative patch-arrangement game where users arrange falling textile patches
 * on a 6×8 grid. This phase adds falling patches with stitch patterns and wiggle animations.
 *
 * Layout:
 * - Viewport: 400px × 700px
 * - Falling Zone: 0-200px (patches spawn and descend here)
 * - Carpet Zone: 200-600px (6×8 grid, 300×400px)
 * - Bottom Margin: 600-700px (100px UI space)
 *
 * Phase 2 Features:
 * - Patches spawn and fall at 30px/s
 * - Wiggle animation (±5° rotation, 1.5s cycle)
 * - Stitch pattern textures (6 patterns)
 * - Basic collision detection (bottom at y=600px)
 * - Queue system (max 3 falling, 0.5s spawn delay)
 * - 2 shapes: square (50×50px), rectangle (100×50px)
 */
function App() {
  const [fallingPatches, setFallingPatches] = useState<PatchType[]>([]);
  const [placedPatches, setPlacedPatches] = useState<PatchType[]>([]);
  const [canSpawnNext, setCanSpawnNext] = useState(true);
  const [isGridFull, setIsGridFull] = useState(false);

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const spawnTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Check if grid is full (48+ cells occupied)
  useEffect(() => {
    const totalCells = placedPatches.reduce((sum, patch) => {
      return sum + (patch.shape === 'rectangle' ? 2 : 1);
    }, 0);
    const gridFull = totalCells >= 48;
    setIsGridFull(gridFull);
    if (gridFull) {
      console.log('Grid is full! Stopping patch generation.');
    }
  }, [placedPatches]);

  // Helper function to generate a random patch
  const generatePatch = useCallback((offsetIndex: number): PatchType => {
    // Generate unique ID
    const uniqueId = `patch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Only 2 shapes: Square and Rectangle (no triangles)
    const shapes: Array<'square' | 'rectangle'> = ['square', 'rectangle'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const color = COLOR_ARRAY[Math.floor(Math.random() * COLOR_ARRAY.length)];
    const pattern = STITCH_PATTERNS[Math.floor(Math.random() * STITCH_PATTERNS.length)] as StitchPattern;

    // Calculate horizontal offset for queuing (staggered: center, left, right)
    const offsets = [0, -60, 60]; // Center, left, right
    const xOffset = offsets[offsetIndex % offsets.length];

    // Start position: top-center with horizontal offset
    const startX = 200 + xOffset - (shape === 'rectangle' ? CELL_SIZE : CELL_SIZE / 2);
    const startY = -CELL_SIZE - 10; // Just above falling zone

    const newPatch = {
      id: uniqueId,
      shape,
      color,
      pattern,
      position: { x: startX, y: startY },
      rotation: 0, // Start at 0° for all shapes
      isFalling: true,
      isPlaced: false,
      wiggle: 0,
    };

    console.log('Patch spawned:', { id: uniqueId, x: startX, y: startY, shape });
    return newPatch;
  }, []);

  // Check collision with placed patches and grid bottom
  const checkCollision = useCallback((patch: PatchType, newY: number): boolean => {
    const patchWidth = patch.shape === 'rectangle' ? CELL_SIZE * 2 : CELL_SIZE;
    const patchHeight = CELL_SIZE;
    const patchBottom = newY + patchHeight; // CRITICAL: Use bottom edge, not just y position

    // Check bottom boundary - patches stop when bottom edge hits grid bottom
    // Patches are positioned relative to carpet-zone, so check against GRID_HEIGHT (400px)
    // NOT CARPET_ZONE_BOTTOM (600px which is viewport-relative)
    if (patchBottom >= GRID_HEIGHT) {
      console.log('Patch visual y:', newY);
      console.log('Patch visual bottom:', patchBottom);
      console.log('Grid visual bottom:', GRID_HEIGHT);
      console.log('Collision:', {
        patchY: newY,
        patchHeight: patchHeight,
        patchBottom: patchBottom,
        gridBottom: GRID_HEIGHT,
        stopped: true
      });
      return true;
    }

    // Check collision with ALL placed patches (not just one)
    for (const placedPatch of placedPatches) {
      const placedWidth = placedPatch.shape === 'rectangle' ? CELL_SIZE * 2 : CELL_SIZE;
      const placedHeight = CELL_SIZE;

      // Calculate bounding boxes
      const placedLeft = placedPatch.position.x;
      const placedRight = placedLeft + placedWidth;
      const placedTop = placedPatch.position.y;
      const placedBottom = placedTop + placedHeight;

      const patchLeft = patch.position.x;
      const patchRight = patchLeft + patchWidth;
      const patchTop = newY;
      const patchBottomEdge = newY + patchHeight;

      // Bounding box collision detection
      const horizontalOverlap = patchLeft < placedRight && patchRight > placedLeft;
      const verticalOverlap = patchBottomEdge > placedTop && patchTop < placedBottom;

      if (horizontalOverlap && verticalOverlap) {
        console.log('Collision:', {
          patchY: newY,
          patchHeight: patchHeight,
          patchBottom: patchBottomEdge,
          gridBottom: `hit ${placedPatch.id} at y=${placedPatch.position.y}`,
          stopped: true
        });
        return true; // Stop immediately on ANY collision
      }
    }

    return false;
  }, [placedPatches]);

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
          // Calculate wiggle (sine wave oscillation)
          const wiggleProgress = (timestamp % WIGGLE_CYCLE) / WIGGLE_CYCLE;
          const wiggle = Math.sin(wiggleProgress * Math.PI * 2) * 5; // ±5°

          // Calculate new position (fall speed: 30px/s)
          const fallDistance = FALL_SPEED * deltaTime;
          const newY = patch.position.y + fallDistance;

          // Check for collision with grid bottom or other patches
          if (checkCollision(patch, newY)) {
            // COLLISION DETECTED - Stop the patch at current position
            // Don't move to newY (that would be inside the collision)
            const placedPatch = {
              ...patch,
              position: { ...patch.position }, // Keep current position (before collision)
              isFalling: false,
              isPlaced: true,
              wiggle: 0, // Stop wiggling
            };
            console.log('Patch stopped at visual y:', patch.position.y);
            console.log('Patch stopped bottom:', patch.position.y + CELL_SIZE);
            newlyPlacedPatches.push(placedPatch);
            // CRITICAL: Do NOT add to updatedPatches - remove from fallingPatches!
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
  }, [checkCollision]);

  // Patch generation system
  useEffect(() => {
    // Stop spawning if grid is full
    if (isGridFull) {
      return;
    }

    if (canSpawnNext && fallingPatches.length < MAX_FALLING_PATCHES) {
      const newPatch = generatePatch(fallingPatches.length);
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (spawnTimeoutRef.current) {
        clearTimeout(spawnTimeoutRef.current);
      }
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
              shape={patch.shape}
              color={patch.color}
              pattern={patch.pattern}
              x={patch.position.x}
              y={patch.position.y}
              rotation={patch.rotation}
              wiggle={patch.wiggle || 0}
            />
          ))}
        </div>

        {/* Bottom Margin - Space for future UI elements */}
        <div className="bottom-margin">
          {/* Reserved for Phase 5+ UI elements */}
        </div>
      </div>
    </div>
  );
}

export default App;
