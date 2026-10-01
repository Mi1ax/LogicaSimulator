import React from 'react';
import { Circle } from 'react-konva';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { getCanvasTheme } from '../theme';

interface PinProps {
  x: number;
  y: number;
  type: 'input' | 'output';
  id: string;
  nodeId: string;
}

export const Pin: React.FC<PinProps> = ({ x, y, type, id, nodeId }) => {
  const startWire = useSimulatorStore(state => state.startWire);
  const completeWire = useSimulatorStore(state => state.completeWire);
  const theme = useSimulatorStore(state => state.theme);
  const appMode = useSimulatorStore(state => state.appMode);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');

  return (
    <Circle
      id={id}
      name={`pin-${type}`}
      x={x}
      y={y}
      radius={appMode === 'board' ? 4 : 5}
      fill={appMode === 'board' ? (theme === 'dark' ? '#94a3b8' : '#cbd5e1') : (type === 'input' ? canvasTheme.pinInputFill : canvasTheme.pinOutputFill)}
      stroke={appMode === 'board' ? '#334155' : (type === 'input' ? canvasTheme.pinInputStroke : canvasTheme.pinOutputStroke)}
      strokeWidth={1}
      hitStrokeWidth={15}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'crosshair';
        e.target.scale({ x: 1.5, y: 1.5 });
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
        e.target.scale({ x: 1, y: 1 });
      }}
      onClick={(e) => {
        if (appMode === 'board') {
          e.cancelBubble = true;
          const store = useSimulatorStore.getState();
          const node = store.nodes.find(n => n.id === nodeId);
          if (node) {
            // Calculate absolute grid coordinates of this pin
            const nodeX = node.boardX ?? node.x;
            const nodeY = node.boardY ?? node.y;
            const absX = nodeX + x;
            const absY = nodeY + y;
            
            if (store.draftBoardTrace) {
              if (store.draftBoardTrace.type === 'jumper') {
                store.completeBoardTrace();
              } else {
                // For solder, if clicking a pin, we complete the trace
                store.updateDraftBoardTrace(absX, absY);
                store.completeBoardTrace();
              }
            } else {
              // Ensure we are in wire mode when starting a new trace from a pin
              if (store.interactionMode !== 'wire') {
                store.setInteractionMode('wire');
              }
              store.startBoardTrace(absX, absY);
            }
          }
          return;
        }

        e.cancelBubble = true;
        const state = useSimulatorStore.getState();
        if (!state.draftWire) {
          const stage = e.target.getStage();
          if (!stage) return;
          const pointer = stage.getPointerPosition();
          if (!pointer) return;
          
          const transform = stage.getAbsoluteTransform().copy().invert();
          const pos = transform.point(pointer);
          
          startWire(nodeId, id, type, pos.x, pos.y);
        } else {
          completeWire(nodeId, id, type);
        }
      }}
      listening={true}
    />
  );
};
