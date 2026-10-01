import React from 'react';
import { Group, Rect, Text } from 'react-konva';
import { LogicNode } from '../../../core/models/types';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { Pin } from '../primitives/Pin';
import { getGateDimensions } from '../../../core/utils/nodeLayout';
import { getCanvasTheme } from '../theme';

interface GateNodeProps {
  node: LogicNode;
}

export const GateNode: React.FC<GateNodeProps> = ({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const select = useSimulatorStore(state => state.select);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  
  const { width, height } = getGateDimensions(node);
  const isSelected = selection?.type === 'node' && selection.id === node.id;

  return (
    <Group
      x={node.x}
      y={node.y}
      draggable
      onClick={(e) => {
        e.cancelBubble = true;
        select({ type: 'node', id: node.id });
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
        if (container) container.style.cursor = 'grab';
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
      }}
      onDragStart={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'grabbing';
      }}
    >
      {/* Main Body */}
      <Rect
        width={width}
        height={height}
        fill={canvasTheme.nodeBg}
        stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={8}
        shadowColor="#0f172a"
        shadowBlur={4}
        shadowOpacity={0.1}
        shadowOffset={{ x: 0, y: 2 }}
      />
      
      {/* Label */}
      <Text
        text={node.type}
        width={width}
        height={height}
        align="center"
        verticalAlign="middle"
        fontSize={16}
        fontFamily="sans-serif"
        fontStyle="bold"
        fill={canvasTheme.textColor}
      />

      {/* Input Pins */}
      {node.inputs.map((pin, i) => {
        const pinY = (height / (node.inputs.length + 1)) * (i + 1);
        return <Pin key={pin.id} id={pin.id} nodeId={node.id} x={0} y={pinY} type="input" />;
      })}

      {/* Output Pins */}
      {node.outputs.map((pin, i) => {
        const pinY = (height / (node.outputs.length + 1)) * (i + 1);
        return <Pin key={pin.id} id={pin.id} nodeId={node.id} x={width} y={pinY} type="output" />;
      })}
    </Group>
  );
};
