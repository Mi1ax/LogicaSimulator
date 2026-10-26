import React, { useMemo, useRef } from 'react';
import { Path, Group, Circle, Shape } from 'react-konva';
import { useSimulatorStore, isIdSelected, getMultiSelectionSet, getNodeByIdFast } from '../../../store/useSimulatorStore';
import { computeAllWirePaths, computeDraftWirePath } from '../../../core/engine/routing';
import { getCanvasTheme } from '../theme';
import { getSchematicPinPosition } from '../../../core/utils/schematicLayout';
import { Wire } from '../../../core/models/types';

export type WirePathInfo = {
  path: string;
  points: { x: number; y: number }[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function distToSegmentSquared(p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
}

const latestWireHitData: {
  wires: Wire[];
  wirePaths: Map<string, WirePathInfo>;
  busPinIds: Set<string>;
} = {
  wires: [],
  wirePaths: new Map(),
  busPinIds: new Set(),
};

export interface WireHitResult {
  wire: Wire;
  points: { x: number; y: number }[];
  segmentIndex: number;
}

export function findWireAtWorldPos(
  worldX: number,
  worldY: number,
  scale: number
): WireHitResult | null {
  const { wires, wirePaths, busPinIds } = latestWireHitData;
  if (wires.length === 0) return null;

  const invScale = 1 / Math.max(0.2, scale || 1);
  const pt = { x: worldX, y: worldY };

  let bestWire: Wire | null = null;
  let bestPoints: { x: number; y: number }[] | null = null;
  let bestSegIdx = 0;
  let bestDistSq = Infinity;

  for (let i = wires.length - 1; i >= 0; i--) {
    const w = wires[i];
    const info = wirePaths.get(w.id);
    if (!info || info.points.length < 2) continue;

    const isBus = busPinIds.has(w.sourcePinId);
    const tol = (isBus ? 8 : 6) * invScale;
    if (
      worldX < info.minX - tol ||
      worldX > info.maxX + tol ||
      worldY < info.minY - tol ||
      worldY > info.maxY + tol
    ) {
      continue;
    }

    const tolSq = tol * tol;
    const pts = info.points;
    for (let j = 0; j < pts.length - 1; j++) {
      const dSq = distToSegmentSquared(pt, pts[j], pts[j + 1]);
      if (dSq <= tolSq && dSq < bestDistSq) {
        bestDistSq = dSq;
        bestWire = w;
        bestPoints = pts;
        bestSegIdx = j;
      }
    }
  }

  if (!bestWire || !bestPoints) return null;
  return { wire: bestWire, points: bestPoints, segmentIndex: bestSegIdx };
}

function pointHitFunc(ctx: any, shape: any) {
  const sx = Math.abs(shape.scaleX()) || 1;
  ctx.beginPath();
  ctx.arc(0, 0, 10 / sx, 0, Math.PI * 2, false);
  ctx.closePath();
  ctx.fillStrokeShape(shape);
}

const SingleWireWaypoints = React.memo(({
  wire,
  isBusWire,
  canvasTheme,
}: {
  wire: Wire;
  isBusWire: boolean;
  canvasTheme: any;
}) => {
  const signal = useSimulatorStore(state => state.simState.wireStates[wire.id]);
  const isSelected = useSimulatorStore(state => isIdSelected(state, wire.id));
  const selectedWpMask = useSimulatorStore(state => {
    if (!wire.waypoints || wire.waypoints.length === 0) return '';
    if (state.selection?.type !== 'waypoint' && state.multiSelection.length === 0) return '';
    const multiSet = getMultiSelectionSet(state);
    let mask = ',';
    for (let i = 0; i < wire.waypoints.length; i++) {
      const wpId = `wp:${wire.id}:${i}`;
      if ((state.selection?.type === 'waypoint' && state.selection.id === wpId) || multiSet.has(wpId)) {
        mask += `${i},`;
      }
    }
    return mask;
  });

  const clickTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWpPosRef = React.useRef<{ id: string; x: number; y: number }>({ id: '', x: 0, y: 0 });

  if (!wire.waypoints || wire.waypoints.length === 0) {
    return null;
  }

  let strokeColor = canvasTheme.wireColor;
  if (signal === 1) strokeColor = canvasTheme.signalHigh;
  else if (signal === 0) strokeColor = canvasTheme.signalLow;
  else if (signal === 'X') strokeColor = '#ef4444';

  if (isSelected) strokeColor = canvasTheme.selectedWireColor;
  else if (isBusWire) strokeColor = '#3b82f6';

  return (
    <Group>
      {wire.waypoints.map((wp, index) => {
        const wpId = `wp:${wire.id}:${index}`;
        const isThisWpSelected = selectedWpMask.includes(`,${index},`);
        const isWpSelected = isSelected || isThisWpSelected;
        
        return (
          <Circle
            key={index}
            x={wp.x}
            y={wp.y}
            radius={isWpSelected ? 6.5 : 5}
            fill={isWpSelected ? canvasTheme.selectedWireColor : strokeColor}
            hitStrokeWidth={0}
            hitFunc={pointHitFunc}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
            draggable
            onDragStart={(e) => {
              e.cancelBubble = true;
              if (clickTimeout.current) {
                clearTimeout(clickTimeout.current);
                clickTimeout.current = null;
              }
              const store = useSimulatorStore.getState();
              if (store.simRunning) {
                e.target.stopDrag();
                return;
              }
              if (!getMultiSelectionSet(store).has(wpId)) {
                store.select({ type: 'waypoint', id: wpId }, e.evt.shiftKey);
              }
              lastWpPosRef.current = {
                id: wpId,
                x: Math.round(e.target.x() / 20) * 20,
                y: Math.round(e.target.y() / 20) * 20,
              };
              store.saveHistory();
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              if (useSimulatorStore.getState().simRunning) return;
              const snappedX = Math.round(e.target.x() / 20) * 20;
              const snappedY = Math.round(e.target.y() / 20) * 20;
              
              e.target.position({ x: snappedX, y: snappedY });
              if (
                lastWpPosRef.current.id === wpId &&
                lastWpPosRef.current.x === snappedX &&
                lastWpPosRef.current.y === snappedY
              ) {
                return;
              }
              lastWpPosRef.current = { id: wpId, x: snappedX, y: snappedY };
              useSimulatorStore.getState().updateNodePosition(wpId, snappedX, snappedY);
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              if (useSimulatorStore.getState().simRunning) return;
              const snappedX = Math.round(e.target.x() / 20) * 20;
              const snappedY = Math.round(e.target.y() / 20) * 20;
              e.target.position({ x: snappedX, y: snappedY });
              useSimulatorStore.getState().updateNodePosition(wpId, snappedX, snappedY, true);
            }}
            onClick={(e) => {
              e.cancelBubble = true;
              const store = useSimulatorStore.getState();
              if (store.simRunning) return;
              if (store.draftWire) {
                const splitWp1 = wire.waypoints?.slice(0, index);
                const splitWp2 = wire.waypoints?.slice(index + 1);
                store.completeWireOnWire(wire.id, wp.x, wp.y, splitWp1, splitWp2, e.evt.shiftKey);
              } else {
                if (!isThisWpSelected && !e.evt.shiftKey) {
                  store.select({ type: 'waypoint', id: wpId }, false);
                } else if (e.evt.shiftKey) {
                  store.select({ type: 'waypoint', id: wpId }, true);
                } else {
                  if (clickTimeout.current) clearTimeout(clickTimeout.current);
                  clickTimeout.current = setTimeout(() => {
                    useSimulatorStore.getState().startWireFromWaypoint(wire.id, index);
                  }, 250);
                }
              }
            }}
            onDblClick={(e) => {
              e.cancelBubble = true;
              if (clickTimeout.current) {
                clearTimeout(clickTimeout.current);
                clickTimeout.current = null;
              }
              const store = useSimulatorStore.getState();
              if (store.simRunning) return;
              const newWaypoints = [...(wire.waypoints || [])];
              newWaypoints.splice(index, 1);
              store.saveHistory();
              store.updateWireWaypoints(wire.id, newWaypoints);
            }}
            onMouseEnter={(e) => {
              if (useSimulatorStore.getState().simRunning) return;
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'crosshair';
              e.target.scale({ x: 1.35, y: 1.35 });
            }}
            onMouseLeave={(e) => {
              if (clickTimeout.current) {
                clearTimeout(clickTimeout.current);
                clickTimeout.current = null;
              }
              if (useSimulatorStore.getState().simRunning) return;
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'default';
              e.target.scale({ x: 1, y: 1 });
            }}
          />
        );
      })}
    </Group>
  );
});

const DraftWirePreview: React.FC<{ draftWireColor: string }> = React.memo(({ draftWireColor }) => {
  const draftWire = useSimulatorStore(state => state.draftWire);
  const sourceNode = useSimulatorStore(state =>
    state.draftWire ? getNodeByIdFast(state, state.draftWire.sourceNodeId) : undefined
  );

  const draftWirePath = useMemo(() => {
    if (!draftWire || !sourceNode) return null;
    const start = getSchematicPinPosition(sourceNode, draftWire.sourcePinId);
    return computeDraftWirePath({
      start,
      end: { x: draftWire.endX, y: draftWire.endY },
      waypoints: draftWire.waypoints,
      manhattan: draftWire.manhattan,
    });
  }, [draftWire, sourceNode]);

  if (!draftWirePath) return null;

  return (
    <Path
      data={draftWirePath}
      stroke={draftWireColor}
      strokeWidth={3}
      dash={[10, 5]}
      lineCap="round"
      perfectDrawEnabled={false}
      listening={false}
    />
  );
});

const BatchedWiresScene: React.FC<{
  wires: Wire[];
  wirePaths: Map<string, WirePathInfo>;
  busPinIds: Set<string>;
  canvasTheme: any;
}> = React.memo(({ wires, wirePaths, busPinIds, canvasTheme }) => {
  // Subscribe to wireStates and selection so this single Shape triggers a Konva redraw when they change
  const wireStates = useSimulatorStore(state => state.simState.wireStates);
  const selection = useSimulatorStore(state => state.selection);
  const multiSelection = useSimulatorStore(state => state.multiSelection);

  const stateRef = useRef({ wires, wirePaths, busPinIds, canvasTheme, wireStates, selection, multiSelection });
  stateRef.current = { wires, wirePaths, busPinIds, canvasTheme, wireStates, selection, multiSelection };

  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
      sceneFunc={(ctx, shape) => {
        const {
          wires: curWires,
          wirePaths: curPaths,
          busPinIds: curBusPins,
          canvasTheme: curTheme,
          wireStates: curWireStates,
        } = stateRef.current;

        if (curWires.length === 0) return;

        const store = useSimulatorStore.getState();
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
          minX = (-sx - 40) / scale;
          maxX = (sw - sx + 40) / scale;
          minY = (-sy - 40) / scale;
          maxY = (sh - sy + 40) / scale;
        }

        const unpowered: { x: number; y: number }[][] = [];
        const low: { x: number; y: number }[][] = [];
        const high: { x: number; y: number }[][] = [];
        const conflict: { x: number; y: number }[][] = [];
        const bus: { x: number; y: number }[][] = [];
        const selected1Bit: { x: number; y: number }[][] = [];
        const selectedBus: { x: number; y: number }[][] = [];

        for (let i = 0; i < curWires.length; i++) {
          const w = curWires[i];
          const info = curPaths.get(w.id);
          if (!info || info.points.length < 2) continue;
          if (info.maxX < minX || info.minX > maxX || info.maxY < minY || info.minY > maxY) {
            continue;
          }

          const isBus = curBusPins.has(w.sourcePinId);
          const isSel = isIdSelected(store, w.id);

          if (isSel) {
            if (isBus) selectedBus.push(info.points);
            else selected1Bit.push(info.points);
          } else if (isBus) {
            bus.push(info.points);
          } else {
            const sig = curWireStates[w.id];
            if (sig === 1) high.push(info.points);
            else if (sig === 0) low.push(info.points);
            else if (sig === 'X') conflict.push(info.points);
            else unpowered.push(info.points);
          }
        }

        const rawCtx = (ctx as any)._context as CanvasRenderingContext2D;
        rawCtx.save();
        rawCtx.lineCap = 'butt';
        rawCtx.lineJoin = 'miter';

        const strokeBucket = (bucket: { x: number; y: number }[][], color: string, width: number) => {
          if (bucket.length === 0) return;
          rawCtx.beginPath();
          for (let i = 0; i < bucket.length; i++) {
            const pts = bucket[i];
            rawCtx.moveTo(pts[0].x, pts[0].y);
            for (let j = 1; j < pts.length; j++) {
              rawCtx.lineTo(pts[j].x, pts[j].y);
            }
          }
          rawCtx.strokeStyle = color;
          rawCtx.lineWidth = width;
          rawCtx.stroke();
        };

        strokeBucket(unpowered, curTheme.wireColor, 2);
        strokeBucket(low, curTheme.signalLow, 2);
        strokeBucket(high, curTheme.signalHigh, 2);
        strokeBucket(conflict, '#ef4444', 2);
        strokeBucket(bus, '#3b82f6', 4);
        strokeBucket(selected1Bit, curTheme.selectedWireColor, 2);
        strokeBucket(selectedBus, curTheme.selectedWireColor, 4);

        rawCtx.restore();
      }}
    />
  );
});

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const WireRenderer: React.FC<{ viewportBounds?: ViewportBounds | null }> = React.memo(({ viewportBounds }) => {
  const wires = useSimulatorStore(state => state.wires);
  const nodes = useSimulatorStore(state => state.nodes);
  const theme = useSimulatorStore(state => state.theme);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');

  const wirePaths = useMemo(() => {
    return computeAllWirePaths(wires, nodes).wirePaths;
  }, [wires, nodes]);

  const cachedBusPinsRef = useRef<{ count: number; firstId: string; lastId: string; set: Set<string> }>({
    count: -1,
    firstId: '',
    lastId: '',
    set: new Set(),
  });

  const busPinIds = useMemo(() => {
    const count = nodes.length;
    const firstId = count > 0 ? nodes[0].id : '';
    const lastId = count > 0 ? nodes[count - 1].id : '';
    if (
      cachedBusPinsRef.current.count === count &&
      cachedBusPinsRef.current.firstId === firstId &&
      cachedBusPinsRef.current.lastId === lastId
    ) {
      return cachedBusPinsRef.current.set;
    }
    const set = new Set<string>();
    for (let i = 0; i < count; i++) {
      const n = nodes[i];
      if (n.type !== 'BUS_SPLIT' && n.type !== 'BUS_JOIN') continue;
      for (let j = 0; j < n.outputs.length; j++) {
        if (n.outputs[j].name === 'BUS') set.add(n.outputs[j].id);
      }
      for (let j = 0; j < n.inputs.length; j++) {
        if (n.inputs[j].name === 'BUS') set.add(n.inputs[j].id);
      }
    }
    cachedBusPinsRef.current = { count, firstId, lastId, set };
    return set;
  }, [nodes]);

  latestWireHitData.wires = wires;
  latestWireHitData.wirePaths = wirePaths;
  latestWireHitData.busPinIds = busPinIds;

  const cullWires = Boolean(viewportBounds && wires.length > 100);

  return (
    <>
      <BatchedWiresScene
        wires={wires}
        wirePaths={wirePaths}
        busPinIds={busPinIds}
        canvasTheme={canvasTheme}
      />

      {wires.map(wire => {
        if (!wire.waypoints || wire.waypoints.length === 0) return null;
        const wireInfo = wirePaths.get(wire.id);
        if (!wireInfo) return null;
        if (
          cullWires &&
          viewportBounds &&
          (wireInfo.maxX < viewportBounds.minX ||
            wireInfo.minX > viewportBounds.maxX ||
            wireInfo.maxY < viewportBounds.minY ||
            wireInfo.minY > viewportBounds.maxY)
        ) {
          return null;
        }

        return (
          <SingleWireWaypoints
            key={`wp-${wire.id}`}
            wire={wire}
            isBusWire={busPinIds.has(wire.sourcePinId)}
            canvasTheme={canvasTheme}
          />
        );
      })}

      <DraftWirePreview draftWireColor={canvasTheme.draftWireColor} />
    </>
  );
});


