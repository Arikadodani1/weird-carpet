export interface Position {
  x: number;
  y: number;
}

export type StitchPattern = 'crossstitch' | 'horizontal' | 'diagonal' | 'dots' | 'vertical' | 'chunky';

export interface Patch {
  id: string;
  shape: 'square'; // MVP: Only squares (50x50px)
  color: string;
  pattern: StitchPattern;
  position: Position;
  rotation: number; // Always 0 in MVP
  isFalling: boolean;
  isPlaced: boolean;
  wiggle?: number; // Wiggle offset for falling animation (±5°)
}

export interface GridCell {
  row: number;
  col: number;
  occupied: boolean;
}

export interface GameState {
  patches: Patch[];
  placedPatches: Patch[];
  fallingPatches: Patch[];
  gridCells: GridCell[][];
  completionPercentage: number;
  isGameComplete: boolean;
}