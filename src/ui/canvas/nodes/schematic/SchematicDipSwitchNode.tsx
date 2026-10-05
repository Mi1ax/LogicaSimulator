import React from 'react';
import { Group, Rect, Text, Path } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';

interface Props {
  node: LogicNode;
}

export const SchematicDipSwitchNode: React.FC<Props> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const updateNodeProperties = useSimulatorStore(state => state.updateNodeProperties);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const select = useSimulatorStore(state => state.select);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  
  const isSelected = selection?.type === 'node' && selection.id === node.id;
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

  const anchorX = Math.round(width / 40) * 20;
  const anchorY = Math.round(height / 40) * 20;

  const numSwitches = node.outputs.length || 4;
  let switches = node.properties?.switches || [];
  if (switches.length < numSwitches) {
    switches = [...switches, ...Array(numSwitches - switches.length).fill(0)];
  }

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
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          e.cancelBubble = true;
          store.finishPlacingNode();
          return;
        }
        e.cancelBubble = true;
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
      {/* Switch Body */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#dc2626" // Red DIP switch color
        stroke={isSelected ? canvasTheme.selectedNodeColor : "#b91c1c"}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={4}
      />

      {/* Label */}
      <Text
        text="ON"
        x={0}
        y={4}
        width={width}
        align="center"
        fontSize={10}
        fontFamily="monospace"
        fontStyle="bold"
        fill="#ffffff"
      />

      {/* Render Switches */}
      {node.outputs.map((pin, i) => {
        const isOn = switches[i] === 1;
        const yOffset = 20 + i * 20;
        
        return (
          <Group key={pin.id}>
            {/* Switch Slot */}
            <Rect
              x={15}
              y={yOffset - 6}
              width={50}
              height={12}
              fill="#7f1d1d"
              cornerRadius={2}
            />
            {/* Slider */}
            <Rect
              x={isOn ? 15 : 45}
              y={yOffset - 6}
              width={20}
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
            {/* Number Label */}
            <Text
              text={String(i + 1)}
              x={5}
              y={yOffset - 5}
              fontSize={10}
              fill="#ffffff"
            />
            
            {/* Pin Extension Leg */}
            <Path
              data={`M ${width} ${yOffset} L ${width + 20} ${yOffset}`}
              stroke={canvasTheme.nodeBorder}
              strokeWidth={2}
            />
            {/* The actual connection pin */}
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={width + 20}
              y={yOffset}
              type={pin.type}
            />
          </Group>
        );
      })}
    </Group>
  );
});
