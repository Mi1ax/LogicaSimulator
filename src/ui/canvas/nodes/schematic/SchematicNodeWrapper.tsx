import React, { useRef } from 'react';
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
  onDragStartExtra?: (e: KonvaEventObject<DragEvent>) => void;
  getExtraDragIds?: (e: KonvaEventObject<DragEvent>) => string[] | undefined;
  children: React.ReactNode;
}

export const SchematicNodeWrapper: React.FC<SchematicNodeWrapperProps> = ({
  node,
  cursor = 'grab',
  onClickExtra,
  onMouseLeaveExtra,
  onDragStartExtra,
  getExtraDragIds,
  children,
}) => {
  // Pack isPlacing (bit 0) and isLabelToolActive (bit 1) into a single primitive selector
  const wrapperMask = useSimulatorStore(state =>
    (state.placingNodeId === node.id || Boolean(state.pastingNodeIds && state.pastingNodeIds.includes(node.id)) ? 1 : 0) |
    (state.labelTool.active ? 2 : 0)
  );
  const isPlacing = (wrapperMask & 1) !== 0;
  const isLabelToolActive = (wrapperMask & 2) !== 0;
  const extraDragIdsRef = useRef<string[] | undefined>(undefined);

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
      draggable={!isPlacing && !isLabelToolActive}
      onMouseDown={(e) => {
        if (e.evt.button === 0) {
          const store = useSimulatorStore.getState();
          if (store.pastingNodeIds && store.pastingNodeIds.includes(node.id)) {
            e.cancelBubble = true;
            store.finishPastingNodes();
            return;
          }
          if (store.placingNodeId === node.id) {
            e.cancelBubble = true;
            store.finishPlacingNode();
            return;
          }
          if (store.labelTool.active) {
            e.cancelBubble = true;
            store.applyLabelToolToNode(node.id);
            return;
          }
        }
      }}
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
        if (store.labelTool.active) {
          return;
        }
        if (!store.simRunning) {
          store.select({ type: 'node', id: node.id }, e.evt.shiftKey);
        }
        onClickExtra?.(e);
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        onDragStartExtra?.(e);
        const store = useSimulatorStore.getState();
        if (store.simRunning) {
          e.target.stopDrag();
          return;
        }
        extraDragIdsRef.current = getExtraDragIds?.(e);
        if (!store.multiSelection.includes(node.id) && (!extraDragIdsRef.current || extraDragIdsRef.current.length === 0)) {
          store.select({ type: 'node', id: node.id }, e.evt.shiftKey);
        }
        store.saveHistory();
      }}
      onDragMove={(e) => {
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.simRunning) return;
        const localX = Math.round((e.target.x() - anchorX) / 20) * 20;
        const localY = Math.round((e.target.y() - anchorY) / 20) * 20;
        e.target.position({ x: localX + anchorX, y: localY + anchorY });
        store.updateNodePosition(node.id, localX, localY, false, extraDragIdsRef.current);
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.simRunning) return;
        const localX = Math.round((e.target.x() - anchorX) / 20) * 20;
        const localY = Math.round((e.target.y() - anchorY) / 20) * 20;
        e.target.position({ x: localX + anchorX, y: localY + anchorY });
        store.updateNodePosition(node.id, localX, localY, true, extraDragIdsRef.current);
        extraDragIdsRef.current = undefined;
      }}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        const store = useSimulatorStore.getState();
        if (container && !store.placingNodeId && !store.pastingNodeIds) {
          if (store.simRunning) {
            container.style.cursor = cursor === 'pointer' ? 'pointer' : 'default';
          } else {
            container.style.cursor = store.labelTool.active ? 'copy' : cursor;
          }
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
