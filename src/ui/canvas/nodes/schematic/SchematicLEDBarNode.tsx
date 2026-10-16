import React from 'react';
import { Group, Rect, Path } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions, getGridAlignedPinYs } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface Props {
  node: LogicNode;
}

export const SchematicLEDBarNode: React.FC<Props> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  const ledMask = useSimulatorStore(state => {
    const pinStates = state.simState.pinStates;
    let mask = 0;
    for (let i = 0; i < node.inputs.length; i++) {
      if (pinStates[node.inputs[i].id] === 1) {
        mask |= 1 << i;
      }
    }
    return mask;
  });
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  
  const pinYs = getGridAlignedPinYs(node.inputs.length, height);

  return (
    <SchematicNodeWrapper node={node}>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={canvasTheme.nodeBg}
        stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={4}
        perfectDrawEnabled={false}
      />
      
      {node.inputs.map((pin, index) => {
        const y = pinYs[index];
        const isHigh = (ledMask & (1 << index)) !== 0;

        return (
          <Group key={pin.id}>
            <Path
              data={`M 0 ${y} L -20 ${y}`}
              stroke={canvasTheme.nodeBorder}
              strokeWidth={2}
              perfectDrawEnabled={false}
              listening={false}
            />
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={-20}
              y={y}
              type={pin.type}
            />
            
            {/* LED Indicator */}
            <Rect
              x={20}
              y={y - 8}
              width={40}
              height={16}
              fill={isHigh ? "#22c55e" : (theme === 'dark' ? "#064e3b" : "#bbf7d0")}
              stroke={isHigh ? "#16a34a" : (theme === 'dark' ? "#022c22" : "#86efac")}
              strokeWidth={1}
              cornerRadius={2}
              perfectDrawEnabled={false}
              listening={false}
            />
          </Group>
        );
      })}
    </SchematicNodeWrapper>
  );
});
