import React from 'react';
import { Layer, Shape } from 'react-konva';
import { GRID_SIZE, useSimulatorStore } from '../../store/useSimulatorStore';
import { getCanvasTheme } from './theme';

interface GridProps {
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
}

export const Grid: React.FC<GridProps> = ({ width, height, scale, x, y }) => {
  const theme = useSimulatorStore((state) => state.theme);
  const appMode = useSimulatorStore((state) => state.appMode);
  const boardWidthMm = useSimulatorStore((state) => state.settings.boardWidthMm);
  const boardHeightMm = useSimulatorStore((state) => state.settings.boardHeightMm);
  const canvasTheme = getCanvasTheme(theme === 'dark');

  return (
    <Layer>
      <Shape
        sceneFunc={(context) => {
          // Adaptive step size based on zoom scale to maintain performance
          let step = GRID_SIZE;
          if (scale < 0.25) {
            step = GRID_SIZE * 4;
          } else if (scale < 0.5) {
            step = GRID_SIZE * 2;
          }

          const startX = Math.floor(-x / scale / step) * step;
          const endX = startX + Math.ceil(width / scale / step) * step + step;

          const startY = Math.floor(-y / scale / step) * step;
          const endY = startY + Math.ceil(height / scale / step) * step + step;

          // Draw board boundary in Board Mode
          if (appMode === 'board') {
            const bw = (boardWidthMm / 2.54) * 20;
            const bh = (boardHeightMm / 2.54) * 20;
            
            context.beginPath();
            context.rect(-10, -10, bw + 20, bh + 20); // 10px padding around holes
            context.fillStyle = theme === 'dark' ? 'rgba(30, 41, 59, 0.8)' : 'rgba(230, 235, 240, 0.8)';
            context.fill();
            context.lineWidth = 2;
            context.strokeStyle = theme === 'dark' ? 'rgba(217, 119, 67, 0.8)' : 'rgba(184, 98, 48, 0.8)';
            context.stroke();
          }

          context.beginPath();
          for (let ix = startX; ix <= endX; ix += step) {
            for (let iy = startY; iy <= endY; iy += step) {
              if (appMode === 'board') {
                // Perfboard holes: small circle with empty center, or copper-colored dot
                context.moveTo(ix + 2.5, iy);
                context.arc(ix, iy, 2.5, 0, Math.PI * 2);
              } else {
                // Normal schematic dots
                context.rect(ix - 0.5, iy - 0.5, 1.5, 1.5);
              }
            }
          }
          if (appMode === 'board') {
            context.fillStyle = theme === 'dark' ? 'rgba(217, 119, 67, 0.4)' : 'rgba(184, 98, 48, 0.5)'; // Copper look
          } else {
            context.fillStyle = canvasTheme.gridColor;
          }
          context.fill();

          if (appMode === 'board') {
            // Draw inner hole for perfboard
            context.beginPath();
            for (let ix = startX; ix <= endX; ix += step) {
              for (let iy = startY; iy <= endY; iy += step) {
                context.moveTo(ix + 1, iy);
                context.arc(ix, iy, 1, 0, Math.PI * 2);
              }
            }
            context.fillStyle = theme === 'dark' ? '#1e293b' : '#f8fafc'; // Match background
            context.fill();
          }

          // Draw logical center axes (origin)
          context.beginPath();
          if (startX <= 0 && endX >= 0) {
            context.moveTo(0, startY);
            context.lineTo(0, endY);
          }
          if (startY <= 0 && endY >= 0) {
            context.moveTo(startX, 0);
            context.lineTo(endX, 0);
          }
          context.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
          context.lineWidth = 2 / scale;
          context.stroke();

          // Add a distinct dot at exactly (0, 0)
          if (startX <= 0 && endX >= 0 && startY <= 0 && endY >= 0) {
            context.beginPath();
            context.arc(0, 0, 4 / scale, 0, Math.PI * 2);
            context.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
            context.fill();
          }
        }}
        // We do not need hit detection on the grid dots
        listening={false}
      />
    </Layer>
  );
};
