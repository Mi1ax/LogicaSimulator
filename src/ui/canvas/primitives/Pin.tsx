import React from 'react';
import { Circle } from 'react-konva';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { getCanvasTheme } from '../theme';
import { LogicNode, Wire } from '../../../core/models/types';

let cachedWiresRef: Wire[] | null = null;
let cachedNodesRef: LogicNode[] | null = null;
let connectedPinsSet = new Set<string>();
let ncConnectedPinsSet = new Set<string>();

function getPinConnectionSets(wires: Wire[], nodes: LogicNode[]) {
  if (wires !== cachedWiresRef || nodes !== cachedNodesRef) {
    connectedPinsSet = new Set<string>();
    ncConnectedPinsSet = new Set<string>();

    const ncNodeIds = new Set<string>();
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].type === 'NC') ncNodeIds.add(nodes[i].id);
    }

    for (let i = 0; i < wires.length; i++) {
      const w = wires[i];
      connectedPinsSet.add(w.sourcePinId);
      connectedPinsSet.add(w.targetPinId);
      if (ncNodeIds.has(w.targetNodeId)) ncConnectedPinsSet.add(w.sourcePinId);
      if (ncNodeIds.has(w.sourceNodeId)) ncConnectedPinsSet.add(w.targetPinId);
    }

    cachedWiresRef = wires;
    cachedNodesRef = nodes;
  }
  return { connectedPinsSet, ncConnectedPinsSet };
}

interface PinProps {
  x: number;
  y: number;
  type: 'input' | 'output' | 'bidir';
  id: string;
  nodeId: string;
  opacity?: number;
}

export const Pin: React.FC<PinProps> = React.memo(({ x, y, type, id, nodeId, opacity }) => {
  const pinState = useSimulatorStore(state => state.simState.pinStates[id]);
  const theme = useSimulatorStore(state => state.theme);
  const isConnected = useSimulatorStore(state =>
    getPinConnectionSets(state.wires, state.nodes).connectedPinsSet.has(id)
  );
  const isConnectedToNC = useSimulatorStore(state =>
    getPinConnectionSets(state.wires, state.nodes).ncConnectedPinsSet.has(id)
  );

  if (isConnectedToNC || opacity === 0) {
    return null;
  }

  const canvasTheme = getCanvasTheme(theme === 'dark');

  let fill = type === 'input' ? canvasTheme.pinInputFill : canvasTheme.pinOutputFill;
  let stroke = type === 'input' ? canvasTheme.pinInputStroke : canvasTheme.pinOutputStroke;
  const radius = 5;
  const strokeWidth = isConnected ? 1 : 2;

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
      fillEnabled={isConnected}
      stroke={stroke}
      strokeEnabled={!isConnected || pinState === undefined}
      strokeWidth={strokeWidth}
      hitStrokeWidth={12}
      onMouseEnter={(e) => {
        const store = useSimulatorStore.getState();
        const node = store.nodes.find(n => n.id === nodeId);
        if (node?.type === 'NC') return;
        
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'crosshair';
        e.target.scale({ x: 1.5, y: 1.5 });
      }}
      onMouseLeave={(e) => {
        const store = useSimulatorStore.getState();
        const node = store.nodes.find(n => n.id === nodeId);
        if (node?.type === 'NC') return;
        
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
        e.target.scale({ x: 1, y: 1 });
      }}
      onClick={(e) => {
        const state = useSimulatorStore.getState();
        if (state.placingNodeId) return;

        const node = state.nodes.find(n => n.id === nodeId);
        
        if (node?.type === 'NC') {
          if (state.draftWire) {
             state.cancelWire();
             e.cancelBubble = true;
          }
          return;
        }

        e.cancelBubble = true;

        if (!state.draftWire) {
          const stage = e.target.getStage();
          if (!stage) return;
          const pointer = stage.getPointerPosition();
          if (!pointer) return;
          
          const transform = stage.getAbsoluteTransform().copy().invert();
          const pos = transform.point(pointer);
          
          state.startWire(nodeId, id, type, pos.x, pos.y, e.evt.shiftKey);
        } else {
          state.completeWire(nodeId, id, type, e.evt.shiftKey);
        }
      }}
      perfectDrawEnabled={false}
    />
  );
});

