import React from 'react';
import { Group, Rect, Text, Circle, Line } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getBoardDimensions } from '../../../../core/utils/boardLayout';
import { getCanvasTheme } from '../../theme';

interface IONodeProps {
  node: LogicNode;
}

export const BoardIONode: React.FC<IONodeProps> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const multiSelection = useSimulatorStore(state => state.multiSelection);
  const select = useSimulatorStore(state => state.select);
  const toggleInputNode = useSimulatorStore(state => state.toggleInputNode);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getBoardDimensions(node);
  const isInput = node.type === 'INPUT';
  const isOutput = node.type === 'OUTPUT';
  const isClock = node.type === 'CLOCK';
  const isVcc = node.type === 'VCC';
  const isGnd = node.type === 'GND';
  
  const isSelected = (selection?.type === 'node' && selection.id === node.id) || multiSelection.includes(node.id);

  const val = useSimulatorStore(state => {
    if (isInput) return node.properties?.value === 1 ? 1 : 0;
    if (isOutput) return state.simState.pinStates[node.inputs[0]?.id];
    if (isClock) return state.simState.pinStates[node.outputs[0]?.id];
    if (isVcc) return 1;
    if (isGnd) return 0;
    return undefined;
  });

  const isInputLike = isInput || isClock || isVcc || isGnd;
  let indicatorFill = canvasTheme.outputIndicator;
  if (isInputLike) indicatorFill = canvasTheme.inputIndicator;
  if (val === 1) indicatorFill = canvasTheme.signalHigh;
  if (val === 'X') indicatorFill = '#ef4444';
  const bgFill = isInputLike ? canvasTheme.inputNodeBg : canvasTheme.outputNodeBg;
  const borderStroke = isInputLike ? canvasTheme.inputNodeBorder : canvasTheme.outputNodeBorder;

  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

  const x = node.boardX ?? 0;
  const y = node.boardY ?? 0;

  return (
    <Group
      x={x + width / 2}
      y={y + height / 2}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={node.properties?.boardRotation || 0}
      opacity={isPlacing ? 0.6 : 1}
      draggable={!isPlacing}
      onClick={(e) => {
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          store.finishPlacingNode();
          return;
        }
        select({ type: 'node', id: node.id }, e.evt.shiftKey);
        
        if (isInput) {
          toggleInputNode(node.id);
        }
      }}
      onDragStart={() => useSimulatorStore.getState().saveHistory()}
      onDragMove={(e) => {
        const localX = Math.round((e.target.x() - width / 2) / 20) * 20;
        const localY = Math.round((e.target.y() - height / 2) / 20) * 20;
        e.target.position({ x: localX + width / 2, y: localY + height / 2 });
        updateNodePosition(node.id, localX, localY);
      }}
      onDragEnd={(e) => {
        const localX = Math.round((e.target.x() - width / 2) / 20) * 20;
        const localY = Math.round((e.target.y() - height / 2) / 20) * 20;
        e.target.position({ x: localX + width / 2, y: localY + height / 2 });
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
      {isVcc || isGnd ? (
        <>
          <Circle
            x={width/2}
            y={height/2}
            radius={18}
            fill={isVcc ? '#ef4444' : '#1f2937'}
            stroke={isSelected ? canvasTheme.selectedNodeColor : '#9ca3af'}
            strokeWidth={isSelected ? 3 : 1}
            shadowColor="#000"
            shadowBlur={4}
            shadowOffset={{ x: 0, y: 2 }}
            shadowOpacity={0.3}
          />
          <Circle
            x={width/2}
            y={height/2}
            radius={10}
            fill="#d1d5db"
            stroke="#9ca3af"
            strokeWidth={1}
          />
          <Circle
            x={width/2}
            y={height/2}
            radius={6}
            fill="#374151"
            stroke="#111827"
            strokeWidth={1}
          />
          <Text text={isVcc ? 'VCC' : 'GND'} x={0} y={-20} width={width} align="center" fontSize={12} fontFamily="monospace" fill={canvasTheme.textColor} />
          {/* Invisible hit area to make dragging easier over the center holes */}
          <Rect x={0} y={0} width={width} height={height} fill="transparent" />
        </>
      ) : isOutput ? (
        <>
          {/* Board LED component */}
          <Group x={width/2} y={height/2}>
            {/* LED Body */}
            <Circle
              x={0}
              y={0}
              radius={24}
              fill={val === 1 ? indicatorFill : '#4b5563'}
              stroke={isSelected ? canvasTheme.selectedNodeColor : '#374151'}
              strokeWidth={isSelected ? 3 : 2}
              shadowColor={val === 1 ? indicatorFill : '#000'}
              shadowBlur={val === 1 ? 15 : 4}
              shadowOffset={val === 1 ? {x: 0, y: 0} : { x: 0, y: 4 }}
              shadowOpacity={val === 1 ? 0.8 : 0.4}
            />
            {/* Glossy highlight for 3D effect */}
            <Circle
              x={-6}
              y={-8}
              radius={8}
              fill="rgba(255, 255, 255, 0.4)"
            />
            {/* Inner Ring */}
            <Circle
              x={0}
              y={0}
              radius={18}
              stroke="rgba(0, 0, 0, 0.1)"
              strokeWidth={2}
            />
          </Group>
          {/* Leg going to the pin */}
          <Line points={[0, height/2, width/2 - 24, height/2]} stroke="#9ca3af" strokeWidth={4} />
          
          <Rect x={0} y={0} width={width} height={height} fill="transparent" />
        </>
      ) : (
        <>
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
            text={isClock ? 'CLK' : (val === 1 ? '1' : '0')}
            x={0}
            y={0}
            width={width}
            height={height}
            align="center"
            verticalAlign="middle"
            fontSize={isClock ? 14 : 20}
            fontFamily="monospace"
            fontStyle="bold"
            fill={canvasTheme.textColor}
          />
        </>
      )}

      {node.properties?.label && !isVcc && !isGnd && (
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
          x={isVcc || isGnd ? width / 2 : width}
          y={height / 2}
          type={pin.type}
        />
      ))}
    </Group>
  );
});
