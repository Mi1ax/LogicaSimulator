import React from 'react';
import { Group, Rect, Text, Circle } from 'react-konva';
import { LogicNode } from '../../../core/models/types';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { Pin } from '../primitives/Pin';
import { getGateDimensions } from '../../../core/utils/nodeLayout';
import { getCanvasTheme } from '../theme';

interface IONodeProps {
  node: LogicNode;
}

export const IONode: React.FC<IONodeProps> = ({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const select = useSimulatorStore(state => state.select);
  const simState = useSimulatorStore(state => state.simState);
  const toggleInputNode = useSimulatorStore(state => state.toggleInputNode);

  const canvasTheme = getCanvasTheme(theme === 'dark');
  
  const { width, height } = getGateDimensions(node);
  const isInput = node.type === 'INPUT';
  const isOutput = node.type === 'OUTPUT';
  const isClock = node.type === 'CLOCK';
  
  const isSelected = selection?.type === 'node' && selection.id === node.id;

  // Resolve current visual state
  let val: 0 | 1 | undefined = undefined;
  if (isInput) {
    val = node.properties?.value === 1 ? 1 : 0;
  } else if (isOutput) {
    val = simState.pinStates[node.inputs[0]?.id];
  } else if (isClock) {
    val = simState.pinStates[node.outputs[0]?.id];
  }

  const indicatorFill = val === 1 ? canvasTheme.signalHigh : (isInput || isClock ? canvasTheme.inputIndicator : canvasTheme.outputIndicator);
  const bgFill = isInput || isClock ? canvasTheme.inputNodeBg : canvasTheme.outputNodeBg;
  const borderStroke = isInput || isClock ? canvasTheme.inputNodeBorder : canvasTheme.outputNodeBorder;

  return (
    <Group
      x={node.x}
      y={node.y}
      draggable
      onClick={(e) => {
        e.cancelBubble = true;
        if (isInput) {
          toggleInputNode(node.id);
        }
        select({ type: 'node', id: node.id });
      }}
      dragBoundFunc={(pos) => {
        const GRID_SIZE = 20;
        return {
          x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
          y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE,
        };
      }}
      onDragMove={(e) => {
        updateNodePosition(node.id, e.target.x(), e.target.y());
      }}
      onDragEnd={(e) => {
        updateNodePosition(node.id, e.target.x(), e.target.y());
      }}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = isInput ? 'pointer' : 'grab';
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
      <Rect
        width={width}
        height={height}
        fill={bgFill}
        stroke={isSelected ? canvasTheme.selectedNodeColor : borderStroke}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={30}
        shadowColor="#0f172a"
        shadowBlur={4}
        shadowOpacity={0.1}
        shadowOffset={{ x: 0, y: 2 }}
      />
      
      {/* Visual indicator */}
      <Circle
        x={width / 2}
        y={height / 2 - 5}
        radius={12}
        fill={indicatorFill}
        stroke={borderStroke}
        strokeWidth={1}
      />
      
      <Text
        text={isInput ? "IN" : isOutput ? "OUT" : "CLK"}
        y={height - 20}
        width={width}
        align="center"
        fontSize={10}
        fontFamily="sans-serif"
        fontStyle="bold"
        fill={borderStroke}
      />

      {(isInput || isClock) && node.outputs.map((pin) => (
        <Pin key={pin.id} id={pin.id} nodeId={node.id} x={width} y={height / 2} type="output" />
      ))}
      
      {isOutput && node.inputs.map((pin) => (
        <Pin key={pin.id} id={pin.id} nodeId={node.id} x={0} y={height / 2} type="input" />
      ))}
    </Group>
  );
};
