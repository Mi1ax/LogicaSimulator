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
  const cancelWire = useSimulatorStore(state => state.cancelWire);
  const pinState = useSimulatorStore(state => state.simState.pinStates[id]);
  const theme = useSimulatorStore(state => state.theme);
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const isConnected = useSimulatorStore(state => 
    state.wires.some(w => w.sourcePinId === id || w.targetPinId === id)
  );
  
  const isConnectedToNC = useSimulatorStore(state => 
    state.wires.some(w => {
      if (w.sourcePinId === id) return state.nodes.find(n => n.id === w.targetNodeId)?.type === 'NC';
      if (w.targetPinId === id) return state.nodes.find(n => n.id === w.sourceNodeId)?.type === 'NC';
      return false;
    })
  );

  let fill = type === 'input' ? canvasTheme.pinInputFill : canvasTheme.pinOutputFill;
  let stroke = type === 'input' ? canvasTheme.pinInputStroke : canvasTheme.pinOutputStroke;
  let radius = 5;
  let strokeWidth = 1;

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

  // If not connected, make it hollow (transparent) so it's obvious!
  if (!isConnected) {
    fill = 'transparent';
    strokeWidth = 2; // Make border a bit thicker so it's still easy to see and click
  }

  const isVisible = !isConnectedToNC && opacity !== 0;

  return (
    <Circle
      id={id}
      name={`pin-${type}`}
      x={x}
      y={y}
      opacity={isVisible ? (opacity ?? 1) : 0}
      radius={radius}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      hitStrokeWidth={15}
      onMouseEnter={(e) => {
        const store = useSimulatorStore.getState();
        const node = store.nodes.find(n => n.id === nodeId);
        if (node?.type === 'NC' || isConnectedToNC) return; // Don't show crosshair for NC or NC-connected pins
        
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'crosshair';
        e.target.scale({ x: 1.5, y: 1.5 });
      }}
      onMouseLeave={(e) => {
        const store = useSimulatorStore.getState();
        const node = store.nodes.find(n => n.id === nodeId);
        if (node?.type === 'NC' || isConnectedToNC) return;
        
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
        e.target.scale({ x: 1, y: 1 });
      }}
      onClick={(e) => {
        const store = useSimulatorStore.getState();
        if (store.placingNodeId) return;

        const state = useSimulatorStore.getState();
        const node = store.nodes.find(n => n.id === nodeId);
        
        // Prevent both starting AND completing a wire on NC or NC-connected pins
        if (node?.type === 'NC' || isConnectedToNC) {
          if (state.draftWire) {
             cancelWire();
             e.cancelBubble = true;
          }
          return; // Allow bubble up so the NC node or parent Node can be selected!
        }

        e.cancelBubble = true;

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
