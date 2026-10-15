import React from 'react';
import { Group } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicAnchor } from '../../../../core/utils/schematicLayout';

interface SchematicNodeWrapperProps {
  node: LogicNode;
  cursor?: string;
  onClickExtra?: (e: KonvaEventObject<MouseEvent>) => void;
  onMouseLeaveExtra?: (e: KonvaEventObject<MouseEvent>) => void;
  children: React.ReactNode;
}

export const SchematicNodeWrapper: React.FC<SchematicNodeWrapperProps> = ({
  node,
  cursor = 'grab',
  onClickExtra,
  onMouseLeaveExtra,
  children,
}) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const select = useSimulatorStore(state => state.select);
  const isPlacing = useSimulatorStore(
    state => state.placingNodeId === node.id || Boolean(state.pastingNodeIds && state.pastingNodeIds.includes(node.id))
  );

  const { x: anchorX, y: anchorY } = getSchematicAnchor(node);

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
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.pastingNodeIds && store.pastingNodeIds.includes(node.id)) {
          store.finishPastingNodes();
          return;
        }
        if (store.placingNodeId === node.id) {
          store.finishPlacingNode();
          return;
        }
        select({ type: 'node', id: node.id }, e.evt.shiftKey);
        onClickExtra?.(e);
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
        const store = useSimulatorStore.getState();
        if (container && !store.placingNodeId && !store.pastingNodeIds) {
          container.style.cursor = cursor;
        }
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
        onMouseLeaveExtra?.(e);
      }}
    >
      {children}
    </Group>
  );
};
