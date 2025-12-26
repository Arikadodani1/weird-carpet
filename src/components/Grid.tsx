import React from 'react';
import { GRID_ROWS, GRID_COLS, CELL_SIZE } from '../utils/constants';
import './Grid.css';

/**
 * Grid Component
 *
 * Renders a 6×8 grid (6 columns × 8 rows = 48 cells) with:
 * - Dimensions: 300px wide × 400px tall
 * - Subtle cell borders (1px, rgba(0,0,0,0.1))
 * - Clean, simple grid cells (no affordance lines)
 */
const Grid: React.FC = () => {
  // Generate grid cells
  const cells = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      cells.push(
        <div
          key={`cell-${row}-${col}`}
          className="grid-cell"
          style={{
            width: `${CELL_SIZE}px`,
            height: `${CELL_SIZE}px`,
          }}
        />
      );
    }
  }

  return (
    <div className="grid-container">
      <div className="grid">
        {cells}
      </div>
    </div>
  );
};

export default Grid;
