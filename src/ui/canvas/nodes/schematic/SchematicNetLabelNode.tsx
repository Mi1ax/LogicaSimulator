import React from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getSchematicDimensions, getSchematicAnchor } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';

interface NetLabelProps {
  node: LogicNode;
}

export const SchematicNetLabelNode: React.FC<NetLabelProps> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const multiSelection = useSimulatorStore(state => state.multiSelection);
  const select = useSimulatorStore(state => state.select);
  const canvasTheme = getCanvasTheme(theme === 'dark');
  
  const { width, height } = getSchematicDimensions(node);
  const { x: anchorX, y: anchorY } = getSchematicAnchor(node);
  
  const isSelected = (selection?.type === 'node' && selection.id === node.id) || multiSelection.includes(node.id);
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

  // Use the unique bidir pin which appears in both inputs and outputs
  const pin = node.inputs[0] || node.outputs[0];
  const name = String(node.properties?.label || 'NET');

  // We want to render a tag shape. Flat left, pointed right.
  // The pin will be exactly at (width, height/2) so the point touches the pin.
  // Wait, actually, let's make the tag shape:
  // (0,0) -> (width-10, 0) -> (width, height/2) -> (width-10, height) -> (0, height) -> Z

  return (
    <Group
      x={node.x + anchorX}
      y={node.y + anchorY}
      offsetX={anchorX}
      offsetY={anchorY}
      rotation={node.properties?.rotation || 0}
      opacity={isPlacing ? 0.6 : 1}
      draggable={!isPlacing}
      onClick={(e) => {
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          store.finishPlacingNode();
          return;
        }
        select({ type: 'node', id: node.id }, e.evt.shiftKey);
      }}
      onDragStart={() => useSimulatorStore.getState().saveHistory()}
      onDragMove={(e) => {
        const localX = Math.round((e.target.x() - anchorX) / 20) * 20;
        const localY = Math.round((e.target.y() - anchorY) / 20) * 20;
        e.target.position({ x: localX + anchorX, y: localY + anchorY });
        updateNodePosition(node.id, localX, localY);
      }}
      onDragEnd={(e) => {
        const localX = Math.round((e.target.x() - anchorX) / 20) * 20;
        const localY = Math.round((e.target.y() - anchorY) / 20) * 20;
        e.target.position({ x: localX + anchorX, y: localY + anchorY });
        updateNodePosition(node.id, localX, localY);
      }}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container && !useSimulatorStore.getState().placingNodeId) container.style.cursor = 'grab';
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
      }}
    >
      <Rect x={0} y={0} width={width} height={height} fill="transparent" />
      <Line points={[width - 10, height / 2, width, height / 2]} stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder} strokeWidth={2} />
      <Text 
        x={(width - 12) / 2}
        y={height / 2}
        offsetX={(width - 12) / 2}
        offsetY={height / 2}
        rotation={-(node.properties?.rotation || 0)}
        width={width - 12} 
        height={height}
        text={name} 
        verticalAlign="middle"
        align={(node.properties?.rotation || 0) === 180 ? 'left' : ((node.properties?.rotation || 0) === 90 || (node.properties?.rotation || 0) === 270) ? 'center' : 'right'}
        fontSize={12} 
        fontFamily="monospace"
        fill={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.textColor}
      />
      {isSelected && <Rect x={0} y={0} width={width} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={1} dash={[2,2]} />}
      {pin && (
        <Pin
          id={pin.id}
          nodeId={node.id}
          x={width}
          y={height / 2}
          type={pin.type}
        />
      )}
    </Group>
  );
});
