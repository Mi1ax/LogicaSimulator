import React, { useMemo } from 'react';
import { Path, Group, Circle } from 'react-konva';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { computeAllWirePaths } from '../../../core/engine/routing';
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

const SingleWire = React.memo(({ wire, pathData, points, isSelected, canvasTheme }: { wire: Wire, pathData: string, points: {x:number, y:number}[], isSelected: boolean, canvasTheme: any }) => {
  const simState = useSimulatorStore(state => state.simState);
  const select = useSimulatorStore(state => state.select);
  const updateWireWaypoints = useSimulatorStore(state => state.updateWireWaypoints);
  const signal = simState.wireStates[wire.id];

  let strokeColor = canvasTheme.wireColor;
  if (signal === 1) strokeColor = canvasTheme.signalHigh;
  else if (signal === 0) strokeColor = canvasTheme.signalLow;
  else if (signal === 'X') strokeColor = '#ef4444';

  if (isSelected) strokeColor = canvasTheme.selectedWireColor;

  const clickTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <Group>
      <Path
        data={pathData}
        stroke="transparent"
        strokeWidth={15}
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'pointer';
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
        }}
        onClick={(e) => {
          e.cancelBubble = true;
          select({ type: 'wire', id: wire.id });
        }}
        onDblClick={(e) => {
          e.cancelBubble = true;
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
          
          const newWaypoints = [...(wire.waypoints || [])];
          newWaypoints.splice(minIdx, 0, { x: nx, y: ny });
          updateWireWaypoints(wire.id, newWaypoints);
        }}
      />
      
      <Path
        data={pathData}
        stroke={strokeColor}
        strokeWidth={2}
        hitStrokeWidth={0}
        shadowColor={signal === 1 ? canvasTheme.signalHigh : 'transparent'}
        shadowBlur={signal === 1 ? 4 : 0}
        shadowOpacity={0.8}
        listening={false}
      />

      {wire.waypoints?.map((wp, index) => (
        <Circle
          key={index}
          x={wp.x}
          y={wp.y}
          radius={5}
          fill={isSelected ? canvasTheme.selectedWireColor : canvasTheme.wireColor}
          draggable
          onDragMove={(e) => {
            const snappedX = Math.round(e.target.x() / 20) * 20;
            const snappedY = Math.round(e.target.y() / 20) * 20;
            
            e.target.x(snappedX);
            e.target.y(snappedY);

            const newWaypoints = [...(wire.waypoints || [])];
            newWaypoints[index] = {
              x: snappedX,
              y: snappedY
            };
            updateWireWaypoints(wire.id, newWaypoints);
          }}
          onClick={(e) => {
            e.cancelBubble = true;
            const store = useSimulatorStore.getState();
            if (store.draftWire) {
              const splitWp1 = wire.waypoints?.slice(0, index);
              const splitWp2 = wire.waypoints?.slice(index + 1);
              store.completeWireOnWire(wire.id, wp.x, wp.y, splitWp1, splitWp2);
            } else {
              if (!isSelected) {
                select({ type: 'wire', id: wire.id });
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
            if (clickTimeout.current) clearTimeout(clickTimeout.current);
            const newWaypoints = [...(wire.waypoints || [])];
            newWaypoints.splice(index, 1);
            updateWireWaypoints(wire.id, newWaypoints);
          }}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'crosshair';
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }}
        />
      ))}
    </Group>
  );
});

export const WireRenderer: React.FC = React.memo(() => {
  const wires = useSimulatorStore(state => state.wires);
  const draftWire = useSimulatorStore(state => state.draftWire);
  const nodes = useSimulatorStore(state => state.nodes);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');

  const { wirePaths, draftWirePath } = useMemo(() => {
    let draftWireInfo = undefined;
    if (draftWire) {
      const sourceNode = nodes.find(n => n.id === draftWire.sourceNodeId);
      if (sourceNode) {
        const start = getSchematicPinPosition(sourceNode, draftWire.sourcePinId);
        draftWireInfo = {
          start,
          end: { x: draftWire.endX, y: draftWire.endY },
          waypoints: draftWire.waypoints
        };
      }
    }
    return computeAllWirePaths(wires, nodes, draftWireInfo);
  }, [wires, nodes, draftWire]);

  return (
    <>
      {wires.map(wire => {
        const wireInfo = wirePaths.get(wire.id);
        if (!wireInfo) return null;
        
        const isSelected = selection?.type === 'wire' && selection.id === wire.id;
        
        return (
          <SingleWire 
            key={wire.id} 
            wire={wire} 
            pathData={wireInfo.path} 
            points={wireInfo.points}
            isSelected={isSelected} 
            canvasTheme={canvasTheme} 
          />
        );
      })}

      {draftWirePath && (
        <Path
          data={draftWirePath}
          stroke={canvasTheme.draftWireColor}
          strokeWidth={3}
          dash={[10, 5]}
          lineCap="round"
          listening={false}
        />
      )}
    </>
  );
});
