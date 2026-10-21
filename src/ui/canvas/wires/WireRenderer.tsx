import React, { useMemo } from 'react';
import { Path, Group, Circle } from 'react-konva';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { computeAllWirePaths, computeDraftWirePath } from '../../../core/engine/routing';
import { getCanvasTheme } from '../theme';
import { getSchematicPinPosition } from '../../../core/utils/schematicLayout';
import { Wire } from '../../../core/models/types';

function distToSegmentSquared(p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
}

function pointHitFunc(ctx: any, shape: any) {
  const sx = Math.abs(shape.scaleX()) || 1;
  ctx.beginPath();
  ctx.arc(0, 0, 10 / sx, 0, Math.PI * 2, false);
  ctx.closePath();
  ctx.fillStrokeShape(shape);
}

const SingleWire = React.memo(({
  wire,
  pathData,
  points,
  isBusWire,
  canvasTheme,
}: {
  wire: Wire;
  pathData: string;
  points: { x: number; y: number }[];
  isBusWire: boolean;
  canvasTheme: any;
}) => {
  const signal = useSimulatorStore(state => state.simState.wireStates[wire.id]);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'wire' && state.selection.id === wire.id) ||
    state.multiSelection.includes(wire.id)
  );

  let strokeColor = canvasTheme.wireColor;
  if (signal === 1) strokeColor = canvasTheme.signalHigh;
  else if (signal === 0) strokeColor = canvasTheme.signalLow;
  else if (signal === 'X') strokeColor = '#ef4444';

  if (isSelected) strokeColor = canvasTheme.selectedWireColor;
  else if (isBusWire) strokeColor = '#3b82f6';

  return (
    <Path
      data={pathData}
      stroke={strokeColor}
      strokeWidth={isBusWire ? 4 : 2}
      hitStrokeWidth={isBusWire ? 16 : 10}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
      onMouseEnter={(e) => {
        const store = useSimulatorStore.getState();
        if (store.simRunning) return;
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = store.draftWire ? 'crosshair' : 'pointer';
        }
      }}
      onMouseLeave={(e) => {
        const store = useSimulatorStore.getState();
        if (store.simRunning) return;
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = store.draftWire ? 'crosshair' : 'default';
        }
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.simRunning) return;
        if (store.draftWire) {
          const stage = e.target.getStage();
          const pointer = stage?.getPointerPosition();
          if (!stage || !pointer || points.length < 2) return;

          const transform = stage.getAbsoluteTransform().copy().invert();
          const pos = transform.point(pointer);

          let minIdx = 0;
          let minDist = Infinity;
          for (let i = 0; i < points.length - 1; i++) {
            const d = distToSegmentSquared(pos, points[i], points[i + 1]);
            if (d < minDist) {
              minDist = d;
              minIdx = i;
            }
          }

          const nx = Math.round(pos.x / 20) * 20;
          const ny = Math.round(pos.y / 20) * 20;
          const splitWp1 = wire.waypoints?.slice(0, minIdx);
          const splitWp2 = wire.waypoints?.slice(minIdx);
          store.completeWireOnWire(wire.id, nx, ny, splitWp1, splitWp2, e.evt.shiftKey);
          return;
        }
        store.select({ type: 'wire', id: wire.id }, e.evt.shiftKey);
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        if (useSimulatorStore.getState().simRunning) return;
        const stage = e.target.getStage();
        const pointer = stage?.getPointerPosition();
        if (!stage || !pointer || points.length < 2) return;
        
        const transform = stage.getAbsoluteTransform().copy().invert();
        const pos = transform.point(pointer);
        
        let minIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < points.length - 1; i++) {
          const d = distToSegmentSquared(pos, points[i], points[i+1]);
          if (d < minDist) {
            minDist = d;
            minIdx = i;
          }
        }
        
        const nx = Math.round(pos.x / 20) * 20;
        const ny = Math.round(pos.y / 20) * 20;
        if (points.some(p => Math.round(p.x / 20) * 20 === nx && Math.round(p.y / 20) * 20 === ny)) {
          return;
        }
        
        const newWaypoints = [...(wire.waypoints || [])];
        newWaypoints.splice(minIdx, 0, { x: nx, y: ny });
        const store = useSimulatorStore.getState();
        store.saveHistory();
        store.updateWireWaypoints(wire.id, newWaypoints);
      }}
    />
  );
});

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
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'wire' && state.selection.id === wire.id) ||
    state.multiSelection.includes(wire.id)
  );
  const selectedWpMask = useSimulatorStore(state => {
    if (!wire.waypoints || wire.waypoints.length === 0) return '';
    if (state.selection?.type !== 'waypoint' && state.multiSelection.length === 0) return '';
    let mask = ',';
    for (let i = 0; i < wire.waypoints.length; i++) {
      const wpId = `wp:${wire.id}:${i}`;
      if ((state.selection?.type === 'waypoint' && state.selection.id === wpId) || state.multiSelection.includes(wpId)) {
        mask += `${i},`;
      }
    }
    return mask;
  });

  const clickTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
              if (!store.multiSelection.includes(wpId)) {
                store.select({ type: 'waypoint', id: wpId }, e.evt.shiftKey);
              }
              store.saveHistory();
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              if (useSimulatorStore.getState().simRunning) return;
              const snappedX = Math.round(e.target.x() / 20) * 20;
              const snappedY = Math.round(e.target.y() / 20) * 20;
              
              e.target.position({ x: snappedX, y: snappedY });
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
    state.draftWire ? state.nodes.find(n => n.id === state.draftWire!.sourceNodeId) : undefined
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

  const busPinIds = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      for (let j = 0; j < n.outputs.length; j++) {
        if (n.outputs[j].name === 'BUS') set.add(n.outputs[j].id);
      }
      for (let j = 0; j < n.inputs.length; j++) {
        if (n.inputs[j].name === 'BUS') set.add(n.inputs[j].id);
      }
    }
    return set;
  }, [nodes]);

  const cullWires = Boolean(viewportBounds && wires.length > 100);

  return (
    <>
      {wires.map(wire => {
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
          <SingleWire 
            key={wire.id} 
            wire={wire} 
            pathData={wireInfo.path} 
            points={wireInfo.points}
            isBusWire={busPinIds.has(wire.sourcePinId)}
            canvasTheme={canvasTheme}
          />
        );
      })}

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


