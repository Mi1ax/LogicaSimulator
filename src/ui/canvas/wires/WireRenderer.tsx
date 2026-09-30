import React, { useMemo } from 'react';
import { Path, Rect } from 'react-konva';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { getPinPosition } from '../../../core/utils/nodeLayout';
import { computeAllWirePaths, getWireSegments } from '../../../core/engine/routing';
import { getCanvasTheme } from '../theme';

export const WireRenderer: React.FC = () => {
  const wires = useSimulatorStore(state => state.wires);
  const draftWire = useSimulatorStore(state => state.draftWire);
  const nodes = useSimulatorStore(state => state.nodes);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const simState = useSimulatorStore(state => state.simState);
  
  const select = useSimulatorStore(state => state.select);
  const setWireMidX = useSimulatorStore(state => state.setWireMidX);

  const canvasTheme = getCanvasTheme(theme === 'dark');

  // Compute all paths with U-bridge jumps. Only re-run when wires, nodes, or draft wire change.
  // Note: simState changing (which happens very fast) will NOT trigger this heavy calculation.
  const { wirePaths, wireSegmentsMap, draftWirePath } = useMemo(() => {
    let draftWireSegments = undefined;
    if (draftWire) {
      const sourceNode = nodes.find(n => n.id === draftWire.sourceNodeId);
      if (sourceNode) {
        const start = getPinPosition(sourceNode, draftWire.sourcePinId);
        let outX, outY, inX, inY;
        if (draftWire.sourceType === 'output') {
          outX = start.x; outY = start.y;
          inX = draftWire.endX; inY = draftWire.endY;
        } else {
          outX = draftWire.endX; outY = draftWire.endY;
          inX = start.x; inY = start.y;
        }
        draftWireSegments = getWireSegments({ x: outX, y: outY }, { x: inX, y: inY });
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
        const signal = simState.wireStates[wire.id];
        
        let strokeColor = canvasTheme.wireColor;
        if (isSelected) {
          strokeColor = canvasTheme.selectedWireColor;
        } else if (signal === 1) {
          strokeColor = canvasTheme.signalHigh;
        } else if (signal === 0) {
          strokeColor = canvasTheme.signalLow;
        }

        return (
          <React.Fragment key={wire.id}>
            {/* The visual wire path */}
            <Path
              data={pathData}
              stroke={strokeColor}
              strokeWidth={isSelected ? 4 : 3}
              hitStrokeWidth={15}
              lineCap="round"
              lineJoin="round"
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

            {/* Draggable handle for standard vertical segment (index 1 is the main vertical drop in standard L-R flow) */}
            {segments && segments.length === 3 && (
              <Rect
                x={segments[1].x1 - 10}
                y={Math.min(segments[1].y1, segments[1].y2)}
                width={20}
                height={Math.abs(segments[1].y2 - segments[1].y1)}
                fill="transparent"
                draggable
                dragBoundFunc={function (this: any, pos) {
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
                onDragMove={(e) => {
                  setWireMidX(wire.id, e.target.x() + 10);
                }}
                onDragEnd={(e) => {
                  setWireMidX(wire.id, e.target.x() + 10);
                  // Reset React position logic if needed, but Zustand update covers it
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                  select({ type: 'wire', id: wire.id });
                }}
              />
            )}
          </React.Fragment>
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
};
