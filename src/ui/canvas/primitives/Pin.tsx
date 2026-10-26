import React, { useRef, useLayoutEffect, useMemo } from 'react';
import { Circle, Shape } from 'react-konva';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { getCanvasTheme } from '../theme';
import { LogicNode, Wire } from '../../../core/models/types';
import { getSchematicPinPosition } from '../../../core/utils/schematicLayout';

let cachedWiresRef: Wire[] | null = null;
let cachedNodesRef: LogicNode[] | null = null;
let cachedNcKey = '';
let cachedNcNodeIds = new Set<string>();
let connectedPinsSet = new Set<string>();
let ncConnectedPinsSet = new Set<string>();

export function getPinConnectionSets(wires: Wire[], nodes: LogicNode[]) {
  const wiresChanged = wires !== cachedWiresRef;
  let ncChanged = false;

  if (nodes !== cachedNodesRef) {
    let key = '';
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].type === 'NC') {
        key += nodes[i].id + '|';
      }
    }
    if (key !== cachedNcKey) {
      cachedNcKey = key;
      ncChanged = true;
      cachedNcNodeIds = new Set<string>();
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].type === 'NC') cachedNcNodeIds.add(nodes[i].id);
      }
    }
    cachedNodesRef = nodes;
  }

  if (wiresChanged) {
    connectedPinsSet = new Set<string>();
    for (let i = 0; i < wires.length; i++) {
      const w = wires[i];
      connectedPinsSet.add(w.sourcePinId);
      connectedPinsSet.add(w.targetPinId);
    }
    cachedWiresRef = wires;
  }

  if (wiresChanged || ncChanged) {
    ncConnectedPinsSet = new Set<string>();
    if (cachedNcNodeIds.size > 0) {
      for (let i = 0; i < wires.length; i++) {
        const w = wires[i];
        if (cachedNcNodeIds.has(w.targetNodeId)) ncConnectedPinsSet.add(w.sourcePinId);
        if (cachedNcNodeIds.has(w.sourceNodeId)) ncConnectedPinsSet.add(w.targetPinId);
      }
    }
  }

  return { connectedPinsSet, ncConnectedPinsSet };
}

export const hoveredPinState = {
  id: null as string | null,
};

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

function noopDrawScene(this: any) {
  return this;
}

export const Pin: React.FC<PinProps> = React.memo(({ x, y, type, id, nodeId, opacity }) => {
  const circleRef = useRef<any>(null);

  useLayoutEffect(() => {
    const c = circleRef.current;
    if (c && !c._logicaHitOnly) {
      c._logicaHitOnly = true;
      c.drawScene = noopDrawScene;
    }
  }, []);

  if (opacity === 0) {
    return null;
  }

  return (
    <Circle
      ref={circleRef}
      id={id}
      name={`pin-${type}`}
      x={x}
      y={y}
      radius={5}
      fill="#000000"
      strokeEnabled={false}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
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
        const sets = getPinConnectionSets(store.wires, store.nodes);
        if (sets.ncConnectedPinsSet.has(id)) return;
        const node = store.nodes.find(n => n.id === nodeId);
        if (node?.type === 'NC') return;

        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'crosshair';
        hoveredPinState.id = id;
        e.target.getLayer()?.drawScene();
      }}
      onMouseLeave={(e) => {
        const store = useSimulatorStore.getState();
        if (store.simRunning) return;
        const node = store.nodes.find(n => n.id === nodeId);
        if (node?.type === 'NC') return;

        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
        if (hoveredPinState.id === id) {
          hoveredPinState.id = null;
          e.target.getLayer()?.drawScene();
        }
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

        const sets = getPinConnectionSets(state.wires, state.nodes);
        if (sets.ncConnectedPinsSet.has(id)) return;

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
    />
  );
});

interface PinDrawItem {
  id: string;
  type: 'input' | 'output' | 'bidir';
  x: number;
  y: number;
}

const SKIP_PIN_NODE_TYPES = new Set([
  'JUNCTION',
  'NC',
  'REGION_BOX',
  'TEXT_LABEL',
  'STICKY_NOTE',
  'FSM_DIAGRAM',
]);

export const BatchedPinsScene: React.FC = React.memo(() => {
  const nodes = useSimulatorStore(state => state.nodes);
  const wires = useSimulatorStore(state => state.wires);
  const theme = useSimulatorStore(state => state.theme);
  const pinStates = useSimulatorStore(state => state.simState.pinStates);

  const pinItems = useMemo<PinDrawItem[]>(() => {
    const items: PinDrawItem[] = [];
    const seenPins = new Set<string>();

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (SKIP_PIN_NODE_TYPES.has(node.type)) continue;

      if (node.type === 'NET_LABEL' || node.type.startsWith('SUB_')) {
        const pin = node.inputs[0] || node.outputs[0];
        if (pin && !seenPins.has(pin.id)) {
          seenPins.add(pin.id);
          const pos = getSchematicPinPosition(node, pin.id);
          items.push({ id: pin.id, type: pin.type, x: pos.x, y: pos.y });
        }
        continue;
      }

      const isClock = node.type === 'CLOCK';

      if (!isClock) {
        for (let j = 0; j < node.inputs.length; j++) {
          const pin = node.inputs[j];
          if (pin.name === 'VCC' || pin.name === 'GND') continue;
          if (seenPins.has(pin.id)) continue;
          seenPins.add(pin.id);
          const pos = getSchematicPinPosition(node, pin.id);
          items.push({ id: pin.id, type: pin.type, x: pos.x, y: pos.y });
        }
      }

      for (let j = 0; j < node.outputs.length; j++) {
        const pin = node.outputs[j];
        if (pin.name === 'VCC' || pin.name === 'GND') continue;
        if (seenPins.has(pin.id)) continue;
        seenPins.add(pin.id);
        const pos = getSchematicPinPosition(node, pin.id);
        items.push({ id: pin.id, type: pin.type, x: pos.x, y: pos.y });
      }
    }

    return items;
  }, [nodes]);

  const stateRef = useRef({ pinItems, wires, nodes, theme, pinStates });
  stateRef.current = { pinItems, wires, nodes, theme, pinStates };

  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
      sceneFunc={(ctx, shape) => {
        const {
          pinItems: curPins,
          wires: curWires,
          nodes: curNodes,
          theme: curTheme,
          pinStates: curPinStates,
        } = stateRef.current;

        if (curPins.length === 0) return;

        const { connectedPinsSet: connSet, ncConnectedPinsSet: ncSet } = getPinConnectionSets(
          curWires,
          curNodes
        );
        const canvasTheme = getCanvasTheme(curTheme === 'dark');
        const stage = shape.getStage();

        let minX = -Infinity;
        let maxX = Infinity;
        let minY = -Infinity;
        let maxY = Infinity;
        if (stage) {
          const sx = stage.x();
          const sy = stage.y();
          const scale = stage.scaleX() || 1;
          const pad = (stage as any)._overscanPad || 0;
          const sw = stage.width() + pad * 2;
          const sh = stage.height() + pad * 2;
          minX = (-sx - 20) / scale;
          maxX = (sw - sx + 20) / scale;
          minY = (-sy - 20) / scale;
          maxY = (sh - sy + 20) / scale;
        }

        const unconnIn: PinDrawItem[] = [];
        const unconnOut: PinDrawItem[] = [];
        const connUnpowIn: PinDrawItem[] = [];
        const connUnpowOut: PinDrawItem[] = [];
        const lowConn: PinDrawItem[] = [];
        const lowUnconn: PinDrawItem[] = [];
        const highConn: PinDrawItem[] = [];
        const highUnconn: PinDrawItem[] = [];
        const conflictPins: PinDrawItem[] = [];
        let hoveredPin: PinDrawItem | null = null;
        const hovId = hoveredPinState.id;

        for (let i = 0; i < curPins.length; i++) {
          const p = curPins[i];
          if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
          if (ncSet.has(p.id)) continue;
          if (p.id === hovId) {
            hoveredPin = p;
          }

          const isConn = connSet.has(p.id);
          const sig = curPinStates[p.id];

          if (sig === 1) {
            if (isConn) highConn.push(p);
            else highUnconn.push(p);
          } else if (sig === 0) {
            if (isConn) lowConn.push(p);
            else lowUnconn.push(p);
          } else if (sig === 'X') {
            conflictPins.push(p);
          } else if (isConn) {
            if (p.type === 'input') connUnpowIn.push(p);
            else connUnpowOut.push(p);
          } else {
            if (p.type === 'input') unconnIn.push(p);
            else unconnOut.push(p);
          }
        }

        const rawCtx = (ctx as any)._context as CanvasRenderingContext2D;
        rawCtx.save();

        const drawBucket = (
          bucket: PinDrawItem[],
          radius: number,
          fillStyle: string,
          strokeStyle?: string,
          lineWidth?: number
        ) => {
          if (bucket.length === 0) return;
          rawCtx.beginPath();
          for (let i = 0; i < bucket.length; i++) {
            const p = bucket[i];
            rawCtx.moveTo(p.x + radius, p.y);
            rawCtx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          }
          rawCtx.fillStyle = fillStyle;
          rawCtx.fill();
          if (strokeStyle && lineWidth) {
            rawCtx.strokeStyle = strokeStyle;
            rawCtx.lineWidth = lineWidth;
            rawCtx.stroke();
          }
        };

        drawBucket(unconnIn, 5, canvasTheme.nodeBg, canvasTheme.pinInputStroke, 2);
        drawBucket(unconnOut, 5, canvasTheme.nodeBg, canvasTheme.pinOutputStroke, 2);
        drawBucket(connUnpowIn, 5, canvasTheme.pinInputFill, canvasTheme.pinInputStroke, 1);
        drawBucket(connUnpowOut, 5, canvasTheme.pinOutputFill, canvasTheme.pinOutputStroke, 1);
        drawBucket(lowConn, 5, canvasTheme.signalLow);
        drawBucket(lowUnconn, 5, canvasTheme.nodeBg, canvasTheme.signalLow, 2);
        drawBucket(highConn, 5, canvasTheme.signalHigh);
        drawBucket(highUnconn, 5, canvasTheme.nodeBg, canvasTheme.signalHigh, 2);
        drawBucket(conflictPins, 5, '#ef4444');

        if (hoveredPin) {
          const isConn = connSet.has(hoveredPin.id);
          const sig = curPinStates[hoveredPin.id];
          let fill =
            hoveredPin.type === 'input' ? canvasTheme.pinInputFill : canvasTheme.pinOutputFill;
          let stroke =
            hoveredPin.type === 'input' ? canvasTheme.pinInputStroke : canvasTheme.pinOutputStroke;
          if (sig === 1) {
            fill = canvasTheme.signalHigh;
            stroke = canvasTheme.signalHigh;
          } else if (sig === 0) {
            fill = canvasTheme.signalLow;
            stroke = canvasTheme.signalLow;
          } else if (sig === 'X') {
            fill = '#ef4444';
            stroke = '#ef4444';
          }
          drawBucket(
            [hoveredPin],
            7.5,
            isConn ? fill : canvasTheme.nodeBg,
            isConn && sig !== undefined ? fill : stroke,
            isConn ? 1.5 : 2.5
          );
        }

        rawCtx.restore();
      }}
    />
  );
});

