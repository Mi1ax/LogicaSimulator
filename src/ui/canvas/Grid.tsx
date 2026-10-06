import React, { useMemo } from 'react';
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

  const patternCanvas = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = GRID_SIZE;
    canvas.height = GRID_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const drawCorners = (drawFn: (cx: number, cy: number) => void) => {
      [[0, 0], [GRID_SIZE, 0], [0, GRID_SIZE], [GRID_SIZE, GRID_SIZE]].forEach(([cx, cy]) => drawFn(cx, cy));
    };

    if (appMode === 'board') {
      ctx.fillStyle = theme === 'dark' ? 'rgba(217, 119, 67, 0.4)' : 'rgba(184, 98, 48, 0.5)';
      drawCorners((cx, cy) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = theme === 'dark' ? '#1e293b' : '#f8fafc';
      drawCorners((cx, cy) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 1, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      ctx.fillStyle = canvasTheme.gridColor;
      drawCorners((cx, cy) => {
        ctx.fillRect(cx - 0.5, cy - 0.5, 1.5, 1.5);
      });
    }
    return canvas;
  }, [appMode, theme, canvasTheme.gridColor]);

  return (
    <Layer>
      <Shape
        sceneFunc={(context) => {
          let step = GRID_SIZE;

          const padXRaw = Math.ceil(width / scale);
          const padYRaw = Math.ceil(height / scale);
          const padX = Math.ceil(padXRaw / step) * step;
          const padY = Math.ceil(padYRaw / step) * step;

          const startX = Math.floor(-x / scale / step) * step - padX;
          const endX = startX + Math.ceil(width / scale / step) * step + step + padX * 2;

          const startY = Math.floor(-y / scale / step) * step - padY;
          const endY = startY + Math.ceil(height / scale / step) * step + step + padY * 2;

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

          if (patternCanvas) {
            // Note: Konva's context wrapper doesn't type createPattern strictly correctly for all canvases
            // but it delegates to the native context.
            const pattern = context.createPattern(patternCanvas, 'repeat');
            if (pattern) {
              context.fillStyle = pattern;
              context.fillRect(startX, startY, endX - startX, endY - startY);
            }
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
        listening={false}
      />
    </Layer>
  );
};
