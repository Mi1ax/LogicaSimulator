import React from 'react';
import { Group, Circle, Rect } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getCanvasTheme } from '../../theme';

interface Props {
  node: LogicNode;
}

export const SchematicJunctionNode: React.FC<Props> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const select = useSimulatorStore(state => state.select);
  const startWire = useSimulatorStore(state => state.startWire);
  const completeWire = useSimulatorStore(state => state.completeWire);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const isSelected = selection?.type === 'node' && selection.id === node.id;

  return (
    <Group
      x={node.x}
      y={node.y}
      draggable={true}
      onClick={(e) => {
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          store.finishPlacingNode();
          return;
        }

        if (store.draftWire) {
          // Finish incoming wire
          completeWire(node.id, node.inputs[0].id, 'input');
        } else {
          // Select node so it can be deleted/moved
          select({ type: 'node', id: node.id });
          
          // Start outgoing wire
          const stage = e.target.getStage();
          const pointer = stage?.getPointerPosition();
          if (stage && pointer) {
            const transform = stage.getAbsoluteTransform().copy().invert();
            const pos = transform.point(pointer);
            startWire(node.id, node.outputs[0].id, 'output', pos.x, pos.y);
          }
        }
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        select({ type: 'node', id: node.id });
      }}
      onDragMove={(e) => {
        const localX = Math.round(e.target.x() / 10) * 10;
        const localY = Math.round(e.target.y() / 10) * 10;
        e.target.position({ x: localX, y: localY });
        updateNodePosition(node.id, localX, localY);
      }}
      onDragEnd={(e) => {
        const localX = Math.round(e.target.x() / 10) * 10;
        const localY = Math.round(e.target.y() / 10) * 10;
        e.target.position({ x: localX, y: localY });
        updateNodePosition(node.id, localX, localY);
      }}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'crosshair';
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
      }}
    >
      {/* Invisible hit area for easier selecting/dragging */}
      <Rect
        x={0} y={0}
        width={20} height={20}
        fill="transparent"
      />
      {/* Visible Dot */}
      <Circle
        x={10}
        y={10}
        radius={isSelected ? 6 : 4}
        fill={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.wireColor}
      />
    </Group>
  );
});
