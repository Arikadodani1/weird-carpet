export interface Position {
  x: number;
  y: number;
}

export interface Patch {
  id: string;
  shape: 'square' | 'rectangle' | 'triangle';
  color: string;
  position: Position;
  rotation: number; // 0-360 degrees
  isFalling: boolean;
  isPlaced: boolean;
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