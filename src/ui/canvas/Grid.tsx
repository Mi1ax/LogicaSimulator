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

          context.beginPath();
          for (let ix = startX; ix <= endX; ix += step) {
            for (let iy = startY; iy <= endY; iy += step) {
              // Draw a tiny 1x1 rect (faster than drawing a circle/arc)
              context.rect(ix - 0.5, iy - 0.5, 1.5, 1.5);
            }
          }
          context.fillStyle = canvasTheme.gridColor;
          context.fill();

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
