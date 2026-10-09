import React from 'react';
import { Group, Rect, Circle, Path } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions, getSchematicAnchor } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';

interface Props {
  node: LogicNode;
}

export const SchematicButtonNode: React.FC<Props> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const updateNodeProperties = useSimulatorStore(state => state.updateNodeProperties);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const multiSelection = useSimulatorStore(state => state.multiSelection);
  const select = useSimulatorStore(state => state.select);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  
  const isSelected = (selection?.type === 'node' && selection.id === node.id) || multiSelection.includes(node.id);
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

  const { x: anchorX, y: anchorY } = getSchematicAnchor(node);
  const isPressed = node.properties?.pressed || false;

  return (
    <Group
      x={node.x + anchorX}
      y={node.y + anchorY}
      offsetX={anchorX}
      offsetY={anchorY}
      rotation={node.properties?.rotation || 0}
      scaleX={node.properties?.flipX ? -1 : 1}
      scaleY={node.properties?.flipY ? -1 : 1}
      opacity={isPlacing ? 0.6 : 1}
      draggable={!isPlacing}
      onClick={(e) => {
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          e.cancelBubble = true;
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
        updateNodePosition(node.id, localX, localY, true);
      }}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container && !useSimulatorStore.getState().placingNodeId) container.style.cursor = 'grab';
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
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
      />
      <Circle
        x={width / 2}
        y={height / 2}
        radius={14}
        fill={isPressed ? "#dc2626" : "#ef4444"}
        stroke="#7f1d1d"
        strokeWidth={2}
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container && !useSimulatorStore.getState().placingNodeId) container.style.cursor = 'pointer';
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container && !useSimulatorStore.getState().placingNodeId) container.style.cursor = 'grab';
          if (isPressed) {
            updateNodeProperties(node.id, { pressed: false });
          }
        }}
        onMouseDown={(e) => {
          e.cancelBubble = true;
          if (!isPlacing) {
            updateNodeProperties(node.id, { pressed: true });
          }
        }}
        onMouseUp={(e) => {
          e.cancelBubble = true;
          if (!isPlacing) {
            updateNodeProperties(node.id, { pressed: false });
          }
        }}
        onClick={(e) => {
          e.cancelBubble = true;
        }}
      />
      
      {node.outputs.map((pin) => (
        <Group key={pin.id}>
          <Path
            data={`M ${width} ${height/2} L ${width + 20} ${height/2}`}
            stroke={canvasTheme.nodeBorder}
            strokeWidth={2}
          />
          <Pin
            id={pin.id}
            nodeId={node.id}
            x={width + 20}
            y={height/2}
            type={pin.type}
          />
        </Group>
      ))}
    </Group>
  );
});
