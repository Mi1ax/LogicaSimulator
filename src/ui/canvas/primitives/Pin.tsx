import React from 'react';
import { Circle } from 'react-konva';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { getCanvasTheme } from '../theme';

interface PinProps {
  x: number;
  y: number;
  type: 'input' | 'output' | 'bidir';
  id: string;
  nodeId: string;
  opacity?: number;
}

export const Pin: React.FC<PinProps> = ({ x, y, type, id, nodeId, opacity }) => {
  const startWire = useSimulatorStore(state => state.startWire);
  const completeWire = useSimulatorStore(state => state.completeWire);
  const theme = useSimulatorStore(state => state.theme);
  const appMode = useSimulatorStore(state => state.appMode);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const pinState = useSimulatorStore(state => state.simState.pinStates[id]);

  let fill = appMode === 'board' ? (theme === 'dark' ? '#94a3b8' : '#cbd5e1') : (type === 'input' ? canvasTheme.pinInputFill : canvasTheme.pinOutputFill);
  let stroke = appMode === 'board' ? '#334155' : (type === 'input' ? canvasTheme.pinInputStroke : canvasTheme.pinOutputStroke);
  let radius = appMode === 'board' ? 4 : 5;

  if (pinState === 1) {
    fill = canvasTheme.signalHigh;
    stroke = canvasTheme.signalHigh;
  } else if (pinState === 0) {
    fill = canvasTheme.signalLow;
    stroke = canvasTheme.signalLow;
  } else if (pinState === 'X') {
    fill = '#ef4444'; // Red for collision
    stroke = '#ef4444';
  }

  return (
    <Circle
      id={id}
      name={`pin-${type}`}
      x={x}
      y={y}
      opacity={opacity ?? 1}
      radius={radius}
      fill={fill}
      stroke={stroke}
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
        const store = useSimulatorStore.getState();
        if (store.placingNodeId) return;

        if (appMode === 'board') {
          e.cancelBubble = true;
          const node = store.nodes.find(n => n.id === nodeId);
          if (node) {
            const stage = e.target.getStage();
            if (!stage) return;
            const absolutePos = e.target.getAbsolutePosition();
            const transform = stage.getAbsoluteTransform().copy().invert();
            const boardPos = transform.point(absolutePos);
            const absX = Math.round(boardPos.x / 20) * 20;
            const absY = Math.round(boardPos.y / 20) * 20;
            
            if (store.draftBoardTrace) {
              if (store.draftBoardTrace.type === 'jumper') {
                store.completeBoardTrace();
              } else {
                // For solder, if clicking a pin, we complete the trace
                store.updateDraftBoardTrace(absX, absY);
                store.completeBoardTrace();
              }
            } else {
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
