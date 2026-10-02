import React from 'react';
import { Group, Rect, Text, Circle } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';

interface IONodeProps {
  node: LogicNode;
}

export const SchematicIONode: React.FC<IONodeProps> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const select = useSimulatorStore(state => state.select);
  const simState = useSimulatorStore(state => state.simState);
  const toggleInputNode = useSimulatorStore(state => state.toggleInputNode);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  const isInput = node.type === 'INPUT';
  const isOutput = node.type === 'OUTPUT';
  const isClock = node.type === 'CLOCK';
  const isVcc = node.type === 'VCC';
  const isGnd = node.type === 'GND';
  
  const isSelected = selection?.type === 'node' && selection.id === node.id;

  let val: 0 | 1 | undefined = undefined;
  if (isInput) {
    val = node.properties?.value === 1 ? 1 : 0;
  } else if (isOutput) {
    val = simState.pinStates[node.inputs[0]?.id];
  } else if (isClock) {
    val = simState.pinStates[node.outputs[0]?.id];
  } else if (isVcc) {
    val = 1;
  } else if (isGnd) {
    val = 0;
  }

  const isInputLike = isInput || isClock || isVcc || isGnd;
  const indicatorFill = val === 1 ? canvasTheme.signalHigh : (isInputLike ? canvasTheme.inputIndicator : canvasTheme.outputIndicator);
  const bgFill = isInputLike ? canvasTheme.inputNodeBg : canvasTheme.outputNodeBg;
  const borderStroke = isInputLike ? canvasTheme.inputNodeBorder : canvasTheme.outputNodeBorder;

  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

  return (
    <Group
      x={node.x}
      y={node.y}
      opacity={isPlacing ? 0.6 : 1}
      draggable={isSelected}
      onClick={(e) => {
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          store.finishPlacingNode();
          return;
        }
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
        if (container && !useSimulatorStore.getState().placingNodeId) container.style.cursor = isInput ? 'pointer' : 'grab';
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
        fill={bgFill}
        stroke={isSelected ? canvasTheme.selectedNodeColor : borderStroke}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={30}
      />
      {isInputLike && (
        <Circle
          x={12}
          y={height / 2}
          radius={6}
          fill={indicatorFill}
          stroke={canvasTheme.nodeBorder}
          strokeWidth={1}
        />
      )}
      {!isInputLike && (
        <Circle
          x={width - 12}
          y={height / 2}
          radius={6}
          fill={indicatorFill}
          stroke={canvasTheme.nodeBorder}
          strokeWidth={1}
        />
      )}
      <Text
        text={isClock ? 'CLK' : (isVcc ? 'VCC' : (isGnd ? 'GND' : (val === 1 ? '1' : '0')))}
        x={0}
        y={0}
        width={width}
        height={height}
        align="center"
        verticalAlign="middle"
        fontSize={isClock || isVcc || isGnd ? 14 : 20}
        fontFamily="monospace"
        fontStyle="bold"
        fill={canvasTheme.textColor}
        onClick={(e) => {
          if (isInput && !useSimulatorStore.getState().placingNodeId) {
            e.cancelBubble = true;
            toggleInputNode(node.id);
          }
        }}
      />
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

      {/* Pins */}
      {node.inputs.map((pin) => (
        <Pin
          key={pin.id}
          id={pin.id}
          nodeId={node.id}
          x={0}
          y={height / 2}
          type={pin.type}
        />
      ))}
      {node.outputs.map((pin) => (
        <Pin
          key={pin.id}
          id={pin.id}
          nodeId={node.id}
          x={width}
          y={height / 2}
          type={pin.type}
        />
      ))}
    </Group>
  );
});
