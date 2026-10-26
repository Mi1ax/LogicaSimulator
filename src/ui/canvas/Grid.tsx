import React from 'react';
import { Shape } from 'react-konva';
import { GRID_SIZE, useSimulatorStore } from '../../store/useSimulatorStore';
import { getCanvasTheme } from './theme';

interface GridProps {
  width: number;
  height: number;
}

export function updateGridDomBackground(
  container: HTMLElement | null,
  x: number,
  y: number,
  scale: number,
  isDark: boolean
) {
  if (!container) return;
  const step = scale < 0.25 ? GRID_SIZE * 4 : scale < 0.5 ? GRID_SIZE * 2 : GRID_SIZE;
  const scaledStep = step * scale;
  const gridColor = getCanvasTheme(isDark).gridColor;
  const dotRadius = Math.max(0.75, Math.min(1.5, scale));
  const bgImage = `radial-gradient(circle, ${gridColor} ${dotRadius}px, transparent ${dotRadius + 0.25}px)`;
  if (container.dataset.gridBg !== bgImage) {
    container.dataset.gridBg = bgImage;
    container.style.backgroundImage = bgImage;
  }
  const halfStep = scaledStep / 2;
  container.style.backgroundSize = `${scaledStep}px ${scaledStep}px`;
  container.style.backgroundPosition = `${x - halfStep}px ${y - halfStep}px`;
}

export const Grid: React.FC<GridProps> = React.memo(({ width, height }) => {
  const theme = useSimulatorStore((state) => state.theme);

  return (
    <Shape
      sceneFunc={(context, shape) => {
        const stage = shape.getStage();
        const pad = (stage as any)?._overscanPad || 0;
        const viewW = width + pad * 2;
        const viewH = height + pad * 2;
        const scale = stage ? stage.scaleX() : 1;
        const x = stage ? stage.x() : 0;
        const y = stage ? stage.y() : 0;

        const startX = -x / scale;
        const endX = (viewW - x) / scale;
        const startY = -y / scale;
        const endY = (viewH - y) / scale;

        // Draw logical center axes (origin) only when visible in viewport
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

        // Distinct dot at (0, 0)
        if (startX <= 0 && endX >= 0 && startY <= 0 && endY >= 0) {
          context.beginPath();
          context.arc(0, 0, 4 / scale, 0, Math.PI * 2);
          context.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
          context.fill();
        }
      }}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
      listening={false}
    />
  );
});
