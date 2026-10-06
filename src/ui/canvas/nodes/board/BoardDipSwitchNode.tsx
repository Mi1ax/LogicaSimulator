import React from 'react';
import { Group, Rect, Text } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getBoardDimensions } from '../../../../core/utils/boardLayout';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';

interface Props {
  node: LogicNode;
}

export const BoardDipSwitchNode: React.FC<Props> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const updateNodeProperties = useSimulatorStore(state => state.updateNodeProperties);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const select = useSimulatorStore(state => state.select);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getBoardDimensions(node);
  
  const x = node.boardX ?? node.x;
  const y = node.boardY ?? node.y;
  
  const isSelected = selection?.type === 'node' && selection.id === node.id;
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

  const numSwitches = node.outputs.length || 4;
  let switches = node.properties?.switches || [];
  if (switches.length < numSwitches) {
    switches = [...switches, ...Array(numSwitches - switches.length).fill(0)];
  }

  return (
    <Group
      x={x}
      y={y}
      opacity={isPlacing ? 0.6 : 1}
      draggable={!isPlacing}
      onClick={(e) => {
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          e.cancelBubble = true;
          store.finishPlacingNode();
          return;
        }
        e.cancelBubble = true;
        select({ type: 'node', id: node.id });
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
      {/* Socket Base */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={canvasTheme.boardSocketBg}
        stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.boardSocketBorder}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={4}
      />

      {/* Switch Body */}
      <Rect
        x={10}
        y={10}
        width={width - 20}
        height={height - 20}
        fill="#dc2626"
        stroke="#b91c1c"
        strokeWidth={1}
        cornerRadius={2}
      />

      {/* DIP Label (Rotated for Board Mode) */}
      <Group x={width / 2} y={height / 2} rotation={90}>
        <Text
          text="ON"
          x={-height / 2 + 15}
          y={-18}
          width={height}
          align="left"
          fontSize={10}
          fontFamily="monospace"
          fill="#ffffff"
          opacity={0.9}
        />
      </Group>

      {/* Render Pins and Switches */}
      {node.outputs.map((pin, i) => {
        const row = i + 1;
        const yOffset = row * 20;
        const isOn = switches[i] === 1;
        
        return (
          <Group key={pin.id}>
            {/* The actual connection pin (Output on right side) */}
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={width}
              y={yOffset}
              type={pin.type}
            />

            {/* Render a dummy pin on the left side to look like a DIP IC */}
            <Pin
              id={`dummy-left-${pin.id}`}
              nodeId={node.id}
              x={0}
              y={yOffset}
              type="input"
              opacity={0.3} // Visually less prominent or maybe fully disabled visually? 
            />

            {/* Switch Slot */}
            <Rect
              x={20}
              y={yOffset - 6}
              width={20}
              height={12}
              fill="#7f1d1d"
              cornerRadius={2}
            />
            {/* Slider */}
            <Rect
              x={isOn ? 20 : 30}
              y={yOffset - 6}
              width={10}
              height={12}
              fill="#ffffff"
              cornerRadius={2}
              onClick={(e) => {
                e.cancelBubble = true;
                const newSwitches = [...switches];
                newSwitches[i] = isOn ? 0 : 1;
                updateNodeProperties(node.id, { switches: newSwitches });
              }}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'grab';
              }}
            />
          </Group>
        );
      })}
    </Group>
  );
});
