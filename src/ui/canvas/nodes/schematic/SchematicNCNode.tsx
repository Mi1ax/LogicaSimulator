import React from 'react';
import { Group, Line } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { Pin } from '../../primitives/Pin';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getCanvasTheme } from '../../theme';

interface NCNodeProps {
  node: LogicNode;
}

export const SchematicNCNode: React.FC<NCNodeProps> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const multiSelection = useSimulatorStore(state => state.multiSelection);
  const select = useSimulatorStore(state => state.select);
  const inPin = node.inputs[0];
  const pinState = useSimulatorStore(state => inPin ? state.simState.pinStates[inPin.id] : undefined);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const isSelected = (selection?.type === 'node' && selection.id === node.id) || multiSelection.includes(node.id);
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id || (state.pastingNodeIds && state.pastingNodeIds.includes(node.id)));

  const size = 12; // Smaller size
  const half = size / 2;
  
  let strokeColor = isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder;
  if (!isSelected) {
    if (pinState === 1) strokeColor = canvasTheme.signalHigh;
    else if (pinState === 0) strokeColor = canvasTheme.signalLow;
    else if (pinState === 'X') strokeColor = '#ef4444';
  }

  return (
    <Group
      x={node.x}
      y={node.y}
      opacity={isPlacing ? 0.6 : 1}
      draggable={!isPlacing}
      onClick={(e) => {
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.pastingNodeIds && store.pastingNodeIds.includes(node.id)) { store.finishPastingNodes(); return; }
        if (store.placingNodeId === node.id) { store.finishPlacingNode(); return; }
        select({ type: 'node', id: node.id }, e.evt.shiftKey);
      }}
      onDragStart={() => useSimulatorStore.getState().saveHistory()}
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
        updateNodePosition(node.id, localX, localY, true);
      }}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container && !useSimulatorStore.getState().placingNodeId && !useSimulatorStore.getState().pastingNodeIds) container.style.cursor = 'grab';
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
      }}
    >
      {/* Invisible hit area for dragging */}
      <Line points={[-10, -10, 10, -10, 10, 10, -10, 10]} fill="transparent" closed />
      
      {/* The X symbol centered exactly on the pin (0, 0) */}
      <Line points={[-half, -half, half, half]} stroke={strokeColor} strokeWidth={2} />
      <Line points={[-half, half, half, -half]} stroke={strokeColor} strokeWidth={2} />
      
      {node.inputs.map((pin) => (
        <Pin key={pin.id} id={pin.id} nodeId={node.id} x={0} y={0} type={pin.type} opacity={0} />
      ))}
    </Group>
  );
});
