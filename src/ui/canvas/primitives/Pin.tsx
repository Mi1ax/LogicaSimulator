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

function pinHitFunc(ctx: any, shape: any) {
  const sx = Math.abs(shape.scaleX()) || 1;
  ctx.beginPath();
  ctx.arc(0, 0, 10 / sx, 0, Math.PI * 2, false);
  ctx.closePath();
  ctx.fillStrokeShape(shape);
}

export const Pin: React.FC<PinProps> = React.memo(({ x, y, type, id, nodeId, opacity }) => {
  const pinState = useSimulatorStore(state => state.simState.pinStates[id]);
  // Pack theme (bit 0), isConnected (bit 1), isConnectedToNC (bit 2) into a single primitive integer selector
  const metaMask = useSimulatorStore(state => {
    const sets = getPinConnectionSets(state.wires, state.nodes);
    return (
      (state.theme === 'dark' ? 1 : 0) |
      (sets.connectedPinsSet.has(id) ? 2 : 0) |
      (sets.ncConnectedPinsSet.has(id) ? 4 : 0)
    );
  });

  const isDark = (metaMask & 1) !== 0;
  const isConnected = (metaMask & 2) !== 0;
  const isConnectedToNC = (metaMask & 4) !== 0;

  if (isConnectedToNC || opacity === 0) {
    return null;
  }

  const canvasTheme = getCanvasTheme(isDark);

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
      fill={isConnected ? fill : canvasTheme.nodeBg}
      stroke={isConnected && pinState !== undefined ? fill : stroke}
      strokeWidth={strokeWidth}
      hitStrokeWidth={0}
      hitFunc={pinHitFunc}
      onMouseEnter={(e) => {
        const store = useSimulatorStore.getState();
        if (store.simRunning) return;
        if (store.labelTool.active) {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'copy';
          return;
        }
        const node = store.nodes.find(n => n.id === nodeId);
        if (node?.type === 'NC') return;
        
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'crosshair';
        e.target.scale({ x: 1.5, y: 1.5 });
      }}
      onMouseLeave={(e) => {
        const store = useSimulatorStore.getState();
        if (store.simRunning) return;
        const node = store.nodes.find(n => n.id === nodeId);
        if (node?.type === 'NC') return;
        
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
        e.target.scale({ x: 1, y: 1 });
      }}
      onMouseDown={(e) => {
        const state = useSimulatorStore.getState();
        if (state.simRunning) return;
        if (e.evt.button === 0 && state.labelTool.active) {
          e.cancelBubble = true;
          state.applyLabelToolToNode(nodeId);
        }
      }}
      onClick={(e) => {
        const state = useSimulatorStore.getState();
        if (state.simRunning || state.placingNodeId) return;
        if (state.labelTool.active) {
          e.cancelBubble = true;
          return;
        }

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

