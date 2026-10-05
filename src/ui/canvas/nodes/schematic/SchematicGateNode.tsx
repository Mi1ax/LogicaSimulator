import React from 'react';
import { Group, Rect, Text } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { getNodeDefinition } from '../../../../core/engine/nodes';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getSchematicDimensions, getSchematicPinPosition } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';

interface GateNodeProps {
  node: LogicNode;
}

export const SchematicGateNode: React.FC<GateNodeProps> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const select = useSimulatorStore(state => state.select);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  const def = getNodeDefinition(node.type);
  const isDIP = node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP';
  const anchorX = isDIP ? width / 2 : 20;
  const anchorY = isDIP ? height / 2 : 20;

  const isSelected = selection?.type === 'node' && selection.id === node.id;
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

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
        select({ type: 'node', id: node.id });
      }}
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
      <Text
        text={node.type}
        x={0}
        y={0}
        width={width}
        height={height}
        align="center"
        verticalAlign="middle"
        fontSize={20}
        fontFamily="monospace"
        fontStyle="bold"
        fill={canvasTheme.textColor}
      />
      {node.inputs.map((pin) => {
        const pos = getSchematicPinPosition(node, pin.id);
        return (
          <Pin
            key={pin.id}
            id={pin.id}
            nodeId={node.id}
            x={pos.x - node.x}
            y={pos.y - node.y}
            type={pin.type}
          />
        );
      })}
      {node.outputs.map((pin) => {
        const pos = getSchematicPinPosition(node, pin.id);
        return (
          <Pin
            key={pin.id}
            id={pin.id}
            nodeId={node.id}
            x={pos.x - node.x}
            y={pos.y - node.y}
            type={pin.type}
          />
        );
      })}
    </Group>
  );
});
