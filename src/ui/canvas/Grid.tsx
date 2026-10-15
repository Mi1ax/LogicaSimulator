import React, { useMemo } from 'react';
import { Layer, Shape } from 'react-konva';
import { GRID_SIZE, useSimulatorStore } from '../../store/useSimulatorStore';
import { getCanvasTheme } from './theme';

interface GridProps {
  width: number;
  height: number;
}

function createGridPatternCanvas(step: number, color: string): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = step;
  canvas.height = step;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = color;
  const corners = [
    [0, 0],
    [step, 0],
    [0, step],
    [step, step],
  ];
  for (let i = 0; i < corners.length; i++) {
    const [cx, cy] = corners[i];
    ctx.fillRect(cx - 0.5, cy - 0.5, 1.5, 1.5);
  }
  return canvas;
}

export const Grid: React.FC<GridProps> = React.memo(({ width, height }) => {
  const theme = useSimulatorStore((state) => state.theme);
  const canvasTheme = getCanvasTheme(theme === 'dark');

  const patterns = useMemo(() => {
    return {
      fine: createGridPatternCanvas(GRID_SIZE, canvasTheme.gridColor),
      coarse: createGridPatternCanvas(GRID_SIZE * 2, canvasTheme.gridColor),
    };
  }, [canvasTheme.gridColor]);

  return (
    <Layer listening={false}>
      <Shape
        sceneFunc={(context, shape) => {
          const stage = shape.getStage();
          const scale = stage ? stage.scaleX() : 1;
          const x = stage ? stage.x() : 0;
          const y = stage ? stage.y() : 0;

          const useCoarse = scale < 0.45;
          const step = useCoarse ? GRID_SIZE * 2 : GRID_SIZE;
          const patternCanvas = useCoarse ? patterns.coarse : patterns.fine;

          const startX = Math.floor(-x / scale / step) * step - step;
          const endX = startX + Math.ceil(width / scale / step) * step + step * 2;

          const startY = Math.floor(-y / scale / step) * step - step;
          const endY = startY + Math.ceil(height / scale / step) * step + step * 2;

          if (patternCanvas) {
            const pattern = context.createPattern(patternCanvas, 'repeat');
            if (pattern) {
              context.fillStyle = pattern;
              context.fillRect(startX, startY, endX - startX, endY - startY);
            }
          }

          // Draw logical center axes (origin)
          if ((startX <= 0 && endX >= 0) || (startY <= 0 && endY >= 0)) {
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
          }

          // Add a distinct dot at exactly (0, 0)
          if (startX <= 0 && endX >= 0 && startY <= 0 && endY >= 0) {
            context.beginPath();
            context.arc(0, 0, 4 / scale, 0, Math.PI * 2);
            context.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
            context.fill();
          }
        }}
        perfectDrawEnabled={false}
        listening={false}
      />
    </Layer>
  );
});

