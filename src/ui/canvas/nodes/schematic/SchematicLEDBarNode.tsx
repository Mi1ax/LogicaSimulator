import React from 'react';
import { Group, Rect, Path } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions, getSchematicAnchor, getGridAlignedPinYs } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';

interface Props {
  node: LogicNode;
}

export const SchematicLEDBarNode: React.FC<Props> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const multiSelection = useSimulatorStore(state => state.multiSelection);
  const select = useSimulatorStore(state => state.select);
  const simState = useSimulatorStore(state => state.simState);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  
  const isSelected = (selection?.type === 'node' && selection.id === node.id) || multiSelection.includes(node.id);
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

  const { x: anchorX, y: anchorY } = getSchematicAnchor(node);
  const pinYs = getGridAlignedPinYs(node.inputs.length, height);

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
      
      {node.inputs.map((pin, index) => {
        const y = pinYs[index];
        const state = simState.pinStates[pin.id] || 0;
        const isHigh = state === 1;

        return (
          <Group key={pin.id}>
            <Path
              data={`M 0 ${y} L -20 ${y}`}
              stroke={canvasTheme.nodeBorder}
              strokeWidth={2}
            />
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={-20}
              y={y}
              type={pin.type}
            />
            
            {/* LED Indicator */}
            <Rect
              x={20}
              y={y - 8}
              width={40}
              height={16}
              fill={isHigh ? "#22c55e" : (theme === 'dark' ? "#064e3b" : "#bbf7d0")}
              stroke={isHigh ? "#16a34a" : (theme === 'dark' ? "#022c22" : "#86efac")}
              strokeWidth={1}
              cornerRadius={2}
            />
          </Group>
        );
      })}
    </Group>
  );
});
