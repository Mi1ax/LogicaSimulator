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

export const IONode: React.FC<IONodeProps> = React.memo(({ node }) => {
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
        const store = useSimulatorStore.getState();
        if (store.saveHistory) store.saveHistory();
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
        cornerRadius={isInput ? 8 : 30}
        shadowColor="#0f172a"
        shadowBlur={4}
        shadowOpacity={0.1}
        shadowOffset={{ x: 0, y: 2 }}
      />

      {/* Custom Name Label */}
      {node.properties?.label && (
        <Text
          text={node.properties.label}
          y={-20}
          width={width}
          align="center"
          fontSize={12}
          fill={canvasTheme.textColor}
        />
      )}
      
      {/* Switch Track (Inputs Only) */}
      {isInput && (
        <Group
          onClick={(e) => {
            e.cancelBubble = true; // prevent selecting the node
            toggleInputNode(node.id);
          }}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'pointer';
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }}
        >
          {/* Invisible larger hit area for easier clicking */}
          <Rect
            x={width / 2 - 20}
            y={height / 2 - 25}
            width={40}
            height={50}
            fill="transparent"
          />
          <Rect
            x={width / 2 - 8}
            y={height / 2 - 12 - 5}
            width={16}
            height={24}
            fill={canvasTheme.gridColor}
            cornerRadius={2}
            stroke={borderStroke}
            strokeWidth={1}
          />
          {/* Knob */}
          <Rect
            x={width / 2 - 12}
            y={val === 1 ? (height / 2 - 14 - 5) : (height / 2 + 2 - 5)}
            width={24}
            height={12}
            fill={indicatorFill}
            stroke={borderStroke}
            strokeWidth={1}
            cornerRadius={2}
            shadowColor="#000"
            shadowBlur={2}
            shadowOpacity={0.3}
            shadowOffset={{ x: 0, y: 1 }}
          />
        </Group>
      )}

      {/* Visual indicator (LED for Output/Clock) */}
      {!isInput && (
        <Circle
          x={width / 2}
          y={height / 2 - 5}
          radius={12}
          fill={indicatorFill}
          stroke={borderStroke}
          strokeWidth={1}
        />
      )}
      
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
});
