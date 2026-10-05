import React, { useMemo } from 'react';
import { Path, Group } from 'react-konva';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { computeAllWirePaths } from '../../../core/engine/routing';
import { getCanvasTheme } from '../theme';
import { getSchematicPinPosition } from '../../../core/utils/schematicLayout';
import { Wire } from '../../../core/models/types';

const SingleWire = React.memo(({ wire, pathData, isSelected, canvasTheme }: { wire: Wire, pathData: string, isSelected: boolean, canvasTheme: any }) => {
  const simState = useSimulatorStore(state => state.simState);
  const select = useSimulatorStore(state => state.select);
  const signal = simState.wireStates[wire.id];

  let strokeColor = canvasTheme.wireColor;
  if (signal === 1) strokeColor = canvasTheme.signalHigh;
  else if (signal === 0) strokeColor = canvasTheme.signalLow;
  else if (signal === 'X') strokeColor = '#ef4444';

  if (isSelected) strokeColor = canvasTheme.selectedWireColor;

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
          end: { x: draftWire.endX, y: draftWire.endY }
        };
      }
    }
    return computeAllWirePaths(wires, nodes, draftWireInfo);
  }, [wires, nodes, draftWire]);

  return (
    <>
      {wires.map(wire => {
        const pathData = wirePaths.get(wire.id);
        if (!pathData) return null;
        
        const isSelected = selection?.type === 'wire' && selection.id === wire.id;
        
        return (
          <SingleWire 
            key={wire.id} 
            wire={wire} 
            pathData={pathData} 
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
