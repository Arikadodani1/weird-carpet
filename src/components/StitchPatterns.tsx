import React from 'react';

/**
 * StitchPatterns Component
 *
 * Defines 6 different stitch patterns as SVG patterns:
 * 1. Cross-stitch - Small X pattern (4px spacing)
 * 2. Horizontal lines - Thin parallel lines (3px apart)
 * 3. Diagonal weave - 45° crossing lines (5px spacing)
 * 4. Dots - Circular dots grid (6px spacing)
 * 5. Vertical lines - Thin parallel lines (3px apart)
 * 6. Chunky knit - Thicker texture with spacing
 *
 * These patterns are referenced by Patch components via fill="url(#pattern-name-color)"
 */
const StitchPatterns: React.FC = () => {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        {/* Cross-stitch pattern - Small X's repeating */}
        <pattern id="crossstitch" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <line x1="1" y1="1" x2="7" y2="7" stroke="currentColor" strokeWidth="1" />
          <line x1="7" y1="1" x2="1" y2="7" stroke="currentColor" strokeWidth="1" />
        </pattern>

        {/* Horizontal lines - Thin parallel lines */}
        <pattern id="horizontal" x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse">
          <line x1="0" y1="1.5" x2="3" y2="1.5" stroke="currentColor" strokeWidth="0.8" />
        </pattern>

        {/* Diagonal weave - 45° crossing lines */}
        <pattern id="diagonal" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1" />
        </pattern>

        {/* Dots - Circular dots grid */}
        <pattern id="dots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.5" fill="currentColor" />
        </pattern>

        {/* Vertical lines - Thin parallel lines */}
        <pattern id="vertical" x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse">
          <line x1="1.5" y1="0" x2="1.5" y2="3" stroke="currentColor" strokeWidth="0.8" />
        </pattern>

        {/* Chunky knit - Thicker texture */}
        <pattern id="chunky" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="5" height="5" fill="currentColor" opacity="0.3" />
          <rect x="6" y="6" width="5" height="5" fill="currentColor" opacity="0.3" />
          <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" />
          <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5" />
        </pattern>
      </defs>
    </svg>
  );
};

export default StitchPatterns;
