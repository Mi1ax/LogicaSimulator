import React from 'react';
import { Rect, Text, Line } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface NetLabelProps {
  node: LogicNode;
}

export const SchematicNetLabelNode: React.FC<NetLabelProps> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  const canvasTheme = getCanvasTheme(theme === 'dark');
  
  const { width, height } = getSchematicDimensions(node);
  const pin = node.inputs[0] || node.outputs[0];

  const isInputSide = node.type === 'SUB_OUT' || (node.type === 'SUB_IO' && node.properties?.flipX);
  const name = String(node.properties?.label || (node.type === 'SUB_IN' ? 'IN' : node.type === 'SUB_OUT' ? 'OUT' : node.type === 'SUB_IO' ? 'I/O' : 'NET'));
  const textWidth = Math.max(width - 10, name.length * 7 + 8);
  const boxX = isInputSide ? 10 : (width - 10) - textWidth;
  const boxCenterX = boxX + textWidth / 2;

  return (
    <SchematicNodeWrapper
      node={node}
      cursor={(node.type === 'SUB_IN' || node.type === 'SUB_IO') ? 'pointer' : 'grab'}
      onClickExtra={() => {
        const store = useSimulatorStore.getState();
        if (node.type === 'SUB_IN') {
          const currentValue = node.properties?.value === 1 ? 1 : 0;
          store.updateNodeProperties(node.id, { value: currentValue === 1 ? 0 : 1 });
        } else if (node.type === 'SUB_IO') {
          let nextValue: any = undefined;
          if (node.properties?.value === undefined) nextValue = 0;
          else if (node.properties?.value === 0) nextValue = 1;
          else if (node.properties?.value === 1) nextValue = undefined;
          store.updateNodeProperties(node.id, { value: nextValue });
        }
      }}
    >
      <Line
        points={isInputSide ? [0, height / 2, 10, height / 2] : [width - 10, height / 2, width, height / 2]}
        stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
        strokeWidth={2}
        listening={false}
        perfectDrawEnabled={false}
      />
      
      <Text 
        x={boxCenterX}
        y={height / 2}
        offsetX={textWidth / 2}
        offsetY={10}
        scaleX={node.properties?.flipX ? -1 : 1}
        scaleY={node.properties?.flipY ? -1 : 1}
        width={textWidth} 
        height={20}
        text={name}
        wrap="none"
        align={node.properties?.flipX ? (isInputSide ? 'right' : 'left') : (isInputSide ? 'left' : 'right')}
        verticalAlign="middle"
        fontSize={10}
        fontFamily="sans-serif"
        fontStyle={node.type.startsWith('SUB_') ? 'bold' : 'normal'}
        fill={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.textColor}
        perfectDrawEnabled={false}
      />
      
      {isSelected && (
        <Rect
          x={boxX}
          y={12}
          width={textWidth}
          height={16}
          stroke={canvasTheme.selectedNodeColor}
          strokeWidth={1}
          dash={[2, 2]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      
      {pin && (
        <Pin
          id={pin.id}
          nodeId={node.id}
          x={isInputSide ? 0 : width}
          y={height / 2}
          type={pin.type}
        />
      )}
    </SchematicNodeWrapper>
  );
});

