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
  const multiSelection = useSimulatorStore(state => state.multiSelection);
  const select = useSimulatorStore(state => state.select);
  const startWire = useSimulatorStore(state => state.startWire);
  const completeWire = useSimulatorStore(state => state.completeWire);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const isSelected = (selection?.type === 'node' && selection.id === node.id) || multiSelection.includes(node.id);

  const clickTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
          completeWire(node.id, node.inputs[0].id, 'input');
        } else {
          if (!isSelected) {
            select({ type: 'node', id: node.id }, e.evt.shiftKey);
          } else {
            if (clickTimeout.current) clearTimeout(clickTimeout.current);
            clickTimeout.current = setTimeout(() => {
              const stage = e.target.getStage();
              const pointer = stage?.getPointerPosition();
              if (stage && pointer) {
                const transform = stage.getAbsoluteTransform().copy().invert();
                const pos = transform.point(pointer);
                startWire(node.id, node.outputs[0].id, 'output', pos.x, pos.y);
              }
            }, 250);
          }
        }
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        if (clickTimeout.current) clearTimeout(clickTimeout.current);
        useSimulatorStore.getState().deleteSelection(); // Actually wait, it might not be selected yet, so let's use a specific action or select and delete.
        const store = useSimulatorStore.getState();
        store.select({ type: 'node', id: node.id }, e.evt.shiftKey);
        store.deleteSelection();
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        select({ type: 'node', id: node.id }, e.evt.shiftKey);
        useSimulatorStore.getState().saveHistory();
      }}
      onDragMove={(e) => {
        const localX = Math.round(e.target.x() / 20) * 20;
        const localY = Math.round(e.target.y() / 20) * 20;
        e.target.position({ x: localX, y: localY });
        updateNodePosition(node.id, localX, localY);
      }}
      onDragEnd={(e) => {
        const localX = Math.round(e.target.x() / 20) * 20;
        const localY = Math.round(e.target.y() / 20) * 20;
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
        x={-10} y={-10}
        width={20} height={20}
        fill="transparent"
      />
      {/* Visible Dot */}
      <Circle
        x={0}
        y={0}
        radius={isSelected ? 6 : 4}
        fill={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.wireColor}
      />
    </Group>
  );
});
