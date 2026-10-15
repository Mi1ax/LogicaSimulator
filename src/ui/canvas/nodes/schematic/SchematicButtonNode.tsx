import React from 'react';
import { Group, Rect, Circle, Line } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface Props {
  node: LogicNode;
}

export const SchematicButtonNode: React.FC<Props> = React.memo(({ node }) => {
  const updateNodeProperties = useSimulatorStore(state => state.updateNodeProperties);
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id || Boolean(state.pastingNodeIds && state.pastingNodeIds.includes(node.id)));
  const isPressed = node.properties?.pressed || false;

  return (
    <SchematicNodeWrapper
      node={node}
      onMouseLeaveExtra={() => {
        if (isPressed) {
          updateNodeProperties(node.id, { pressed: false });
        }
      }}
    >
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
      <Circle
        x={width / 2}
        y={height / 2}
        radius={14}
        fill={isPressed ? "#dc2626" : "#ef4444"}
        stroke="#7f1d1d"
        strokeWidth={2}
        perfectDrawEnabled={false}
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container && !useSimulatorStore.getState().placingNodeId && !useSimulatorStore.getState().pastingNodeIds) container.style.cursor = 'pointer';
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container && !useSimulatorStore.getState().placingNodeId && !useSimulatorStore.getState().pastingNodeIds) container.style.cursor = 'grab';
          if (isPressed) {
            updateNodeProperties(node.id, { pressed: false });
          }
        }}
        onMouseDown={(e) => {
          if (!isPlacing) {
            e.cancelBubble = true;
            updateNodeProperties(node.id, { pressed: true });
          }
        }}
        onMouseUp={(e) => {
          if (!isPlacing) {
            e.cancelBubble = true;
            updateNodeProperties(node.id, { pressed: false });
          }
        }}
        onClick={(e) => {
          if (!isPlacing) {
            e.cancelBubble = true;
          }
        }}
      />
      
      {node.outputs.map((pin) => (
        <Group key={pin.id}>
          <Line
            points={[width, height / 2, width + 20, height / 2]}
            stroke={canvasTheme.nodeBorder}
            strokeWidth={2}
            listening={false}
            perfectDrawEnabled={false}
          />
          {node.properties?.activeLow && (
            <Circle
              x={width + 5}
              y={height / 2}
              radius={4}
              fill={canvasTheme.nodeBg}
              stroke={canvasTheme.nodeBorder}
              strokeWidth={2}
              listening={false}
              perfectDrawEnabled={false}
            />
          )}
          <Pin
            id={pin.id}
            nodeId={node.id}
            x={width + 20}
            y={height/2}
            type={pin.type}
          />
        </Group>
      ))}
    </SchematicNodeWrapper>
  );
});
