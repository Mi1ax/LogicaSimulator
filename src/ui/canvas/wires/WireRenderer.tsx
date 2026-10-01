import React, { useMemo } from 'react';
import { Path, Rect } from 'react-konva';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { getPinPosition } from '../../../core/utils/nodeLayout';
import { computeAllWirePaths, getWireSegments } from '../../../core/engine/routing';
import { getCanvasTheme } from '../theme';

const SingleWire = React.memo(({ wire, pathData, segments, isSelected, canvasTheme }: any) => {
  const signal = useSimulatorStore(state => state.simState.wireStates[wire.id]);
  const select = useSimulatorStore(state => state.select);
  const setWireMidX = useSimulatorStore(state => state.setWireMidX);

  let strokeColor = canvasTheme.wireColor;
  if (isSelected) {
    strokeColor = canvasTheme.selectedWireColor;
  } else if (signal === 1) {
    strokeColor = canvasTheme.signalHigh;
  } else if (signal === 0) {
    strokeColor = canvasTheme.signalLow;
  }

  return (
    <React.Fragment>
      {/* Invisible thicker path for easier clicking/hovering */}
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
      />
      
      {/* Visible Wire */}
      <Path
        data={pathData}
        stroke={strokeColor}
        strokeWidth={2}
        hitStrokeWidth={0} // Let the invisible path handle hits
        shadowColor={signal === 1 ? canvasTheme.signalHigh : 'transparent'}
        shadowBlur={signal === 1 ? 4 : 0}
        shadowOpacity={0.8}
        listening={false}
      />

      {/* Select hit areas and handles */}
      {isSelected && (
        <>
          {/* Draggable handle for standard vertical segment */}
          {segments && segments.length === 3 && (
            <Rect
              x={segments[1].x1 - 10}
              y={Math.min(segments[1].y1, segments[1].y2)}
              width={20}
              height={Math.abs(segments[1].y2 - segments[1].y1)}
              fill="transparent"
              draggable
              dragBoundFunc={function (this: any, pos: any) {
                return { x: pos.x, y: this.absolutePosition().y };
              }}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'ew-resize';
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'default';
              }}
              onDragStart={() => {
                const store = useSimulatorStore.getState();
                if (store.saveHistory) store.saveHistory();
              }}
              onDragMove={(e) => {
                const transform = e.target.getStage()?.getAbsoluteTransform().copy().invert();
                const pointer = e.target.getStage()?.getPointerPosition();
                if (transform && pointer) {
                  const pos = transform.point(pointer);
                  const nx = Math.round(pos.x / 20) * 20;
                  e.target.x(nx - 10);
                  setWireMidX(wire.id, nx);
                }
              }}
              onDragEnd={(e) => {
                const transform = e.target.getStage()?.getAbsoluteTransform().copy().invert();
                const pointer = e.target.getStage()?.getPointerPosition();
                if (transform && pointer) {
                  const pos = transform.point(pointer);
                  const nx = Math.round(pos.x / 20) * 20;
                  setWireMidX(wire.id, nx);
                }
              }}
              onClick={(e) => {
                e.cancelBubble = true;
                select({ type: 'wire', id: wire.id });
              }}
            />
          )}
          {/* Waypoint Handles */}
          {wire.waypoints && wire.waypoints.length > 0 && wire.waypoints.map((wp: any, idx: number) => (
            <Rect
              key={`wp-${wire.id}-${idx}`}
              x={wp.x - 5}
              y={wp.y - 5}
              width={10}
              height={10}
              fill={canvasTheme.selectedWireColor}
              draggable
              onDragStart={() => {
                const store = useSimulatorStore.getState();
                if (store.saveHistory) store.saveHistory();
              }}
              onDragMove={(e) => {
                const store = useSimulatorStore.getState();
                if (store.updateWireWaypoints) {
                  const transform = e.target.getStage()?.getAbsoluteTransform().copy().invert();
                  const pointer = e.target.getStage()?.getPointerPosition();
                  if (transform && pointer) {
                    const pos = transform.point(pointer);
                    const nx = Math.round(pos.x / 20) * 20;
                    const ny = Math.round(pos.y / 20) * 20;
                    e.target.position({ x: nx - 5, y: ny - 5 });
                    const newWps = [...wire.waypoints!];
                    newWps[idx] = { x: nx, y: ny };
                    store.updateWireWaypoints(wire.id, newWps);
                  }
                }
              }}
              onDblClick={(e) => {
                e.cancelBubble = true;
                const store = useSimulatorStore.getState();
                if (store.saveHistory) store.saveHistory();
                if (store.updateWireWaypoints) {
                  const newWps = [...wire.waypoints!];
                  newWps.splice(idx, 1);
                  store.updateWireWaypoints(wire.id, newWps);
                }
              }}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'move';
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'default';
              }}
            />
          ))}
        </>
      )}
    </React.Fragment>
  );
});

export const WireRenderer: React.FC = React.memo(() => {
  const wires = useSimulatorStore(state => state.wires);
  const draftWire = useSimulatorStore(state => state.draftWire);
  const nodes = useSimulatorStore(state => state.nodes);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');

  // Compute all paths with U-bridge jumps. Only re-run when wires, nodes, or draft wire change.
  // Note: simState changing (which happens very fast) will NOT trigger this heavy calculation.
  const { wirePaths, wireSegmentsMap, draftWirePath } = useMemo(() => {
    let draftWireSegments = undefined;
    if (draftWire) {
      const sourceNode = nodes.find(n => n.id === draftWire.sourceNodeId);
      if (sourceNode) {
        const start = getPinPosition(sourceNode, draftWire.sourcePinId);
        let outX, outY, outNx, inX, inY, inNx;
        if (draftWire.sourceType === 'output') {
          outX = start.x; outY = start.y; outNx = start.nx;
          inX = draftWire.endX; inY = draftWire.endY; inNx = 0; // 0 normal for floating cursor
        } else {
          outX = draftWire.endX; outY = draftWire.endY; outNx = 0; // 0 normal for floating cursor
          inX = start.x; inY = start.y; inNx = start.nx;
        }
        draftWireSegments = getWireSegments({ x: outX, y: outY, nx: outNx }, { x: inX, y: inY, nx: inNx }, undefined, draftWire.waypoints);
      }
    }
    return computeAllWirePaths(wires, nodes, draftWireSegments);
  }, [wires, nodes, draftWire]);

  return (
    <>
      {wires.map(wire => {
        const pathData = wirePaths.get(wire.id);
        if (!pathData) return null;
        
        const isSelected = selection?.type === 'wire' && selection.id === wire.id;
        const segments = wireSegmentsMap.get(wire.id);
        
        return (
          <SingleWire 
            key={wire.id} 
            wire={wire} 
            pathData={pathData} 
            segments={segments} 
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
