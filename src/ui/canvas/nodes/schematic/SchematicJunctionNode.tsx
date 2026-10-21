import React from 'react';
import { Circle } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getCanvasTheme } from '../../theme';

interface Props {
  node: LogicNode;
}

function junctionHitFunc(ctx: any, shape: any) {
  const sx = Math.abs(shape.scaleX()) || 1;
  ctx.beginPath();
  ctx.arc(0, 0, 10 / sx, 0, Math.PI * 2, false);
  ctx.closePath();
  ctx.fillStrokeShape(shape);
}

export const SchematicJunctionNode: React.FC<Props> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const clickTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const signal = useSimulatorStore(state =>
    state.simState.pinStates[node.inputs[0].id] ?? state.simState.pinStates[node.outputs[0].id]
  );
  let color = canvasTheme.wireColor;
  if (signal === 1) color = canvasTheme.signalHigh;
  else if (signal === 0) color = canvasTheme.signalLow;
  else if (signal === 'X') color = '#ef4444';
  if (isSelected) color = canvasTheme.selectedNodeColor;

  return (
    <Circle
      x={node.x}
      y={node.y}
      radius={isSelected ? 6.5 : 5}
      fill={color}
      hitStrokeWidth={0}
      hitFunc={junctionHitFunc}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
      draggable
      onClick={(e) => {
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.simRunning) return;
        if (store.pastingNodeIds && store.pastingNodeIds.includes(node.id)) {
          store.finishPastingNodes();
          return;
        }
        if (store.placingNodeId === node.id) {
          store.finishPlacingNode();
          return;
        }

        if (store.draftWire) {
          store.completeWire(node.id, node.inputs[0].id, 'input', e.evt.shiftKey);
        } else {
          if (!isSelected) {
            store.select({ type: 'node', id: node.id }, e.evt.shiftKey);
          } else {
            if (clickTimeout.current) clearTimeout(clickTimeout.current);
            const shiftKey = e.evt.shiftKey;
            clickTimeout.current = setTimeout(() => {
              const stage = e.target.getStage();
              const pointer = stage?.getPointerPosition();
              if (stage && pointer) {
                const transform = stage.getAbsoluteTransform().copy().invert();
                const pos = transform.point(pointer);
                useSimulatorStore.getState().startWire(node.id, node.outputs[0].id, 'output', pos.x, pos.y, shiftKey);
              }
            }, 250);
          }
        }
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        if (clickTimeout.current) {
          clearTimeout(clickTimeout.current);
          clickTimeout.current = null;
        }
        const store = useSimulatorStore.getState();
        if (store.simRunning) return;
        store.select({ type: 'node', id: node.id }, e.evt.shiftKey);
        store.deleteSelection();
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
        if (clickTimeout.current) {
          clearTimeout(clickTimeout.current);
          clickTimeout.current = null;
        }
        const store = useSimulatorStore.getState();
        if (store.simRunning) {
          e.target.stopDrag();
          return;
        }
        if (!store.multiSelection.includes(node.id)) {
          store.select({ type: 'node', id: node.id }, e.evt.shiftKey);
        }
        store.saveHistory();
      }}
      onDragMove={(e) => {
        e.cancelBubble = true;
        if (useSimulatorStore.getState().simRunning) return;
        const localX = Math.round(e.target.x() / 20) * 20;
        const localY = Math.round(e.target.y() / 20) * 20;
        e.target.position({ x: localX, y: localY });
        useSimulatorStore.getState().updateNodePosition(node.id, localX, localY);
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        if (useSimulatorStore.getState().simRunning) return;
        const localX = Math.round(e.target.x() / 20) * 20;
        const localY = Math.round(e.target.y() / 20) * 20;
        e.target.position({ x: localX, y: localY });
        useSimulatorStore.getState().updateNodePosition(node.id, localX, localY, true);
      }}
      onMouseEnter={(e) => {
        if (useSimulatorStore.getState().simRunning) return;
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'crosshair';
        e.target.scale({ x: 1.35, y: 1.35 });
      }}
      onMouseLeave={(e) => {
        if (clickTimeout.current) {
          clearTimeout(clickTimeout.current);
          clickTimeout.current = null;
        }
        if (useSimulatorStore.getState().simRunning) return;
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
        e.target.scale({ x: 1, y: 1 });
      }}
    />
  );
});

