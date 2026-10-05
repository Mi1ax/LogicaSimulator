import React from 'react';
import { Group, Rect, Path, Text, Circle } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';

interface Props {
  node: LogicNode;
}

export const Schematic7SegNode: React.FC<Props> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const select = useSimulatorStore(state => state.select);
  const simState = useSimulatorStore(state => state.simState);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  
  const isSelected = selection?.type === 'node' && selection.id === node.id;
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

  const anchorX = 40;
  const anchorY = 100;

  const pins = node.inputs;
  const getPinState = (index: number) => {
    if (!pins[index]) return 0;
    return simState.pinStates[pins[index].id] === 1 ? 1 : 0;
  };
  const a = getPinState(0);
  const b = getPinState(1);
  const c = getPinState(2);
  const d = getPinState(3);
  const e = getPinState(4);
  const f = getPinState(5);
  const g = getPinState(6);
  const dp = getPinState(7);

  const activeColor = '#ef4444'; // Red
  const inactiveColor = theme === 'dark' ? '#451a1a' : '#fecaca';

  // Apply a slant (skew) to the segment rendering
  const slant = 10;
  
  const renderSeg = (points: number[], active: boolean) => (
    <Path
      data={`M ${points[0] + (100 - points[1]) / 100 * slant} ${points[1]} L ${points[2] + (100 - points[3]) / 100 * slant} ${points[3]} L ${points[4] + (100 - points[5]) / 100 * slant} ${points[5]} L ${points[6] + (100 - points[7]) / 100 * slant} ${points[7]} L ${points[8] + (100 - points[9]) / 100 * slant} ${points[9]} L ${points[10] + (100 - points[11]) / 100 * slant} ${points[11]} Z`}
      fill={active ? activeColor : inactiveColor}
      shadowColor={active ? activeColor : 'transparent'}
      shadowBlur={active ? 8 : 0}
      shadowOpacity={0.8}
    />
  );

  const dx = 28;
  const dy = 25;

  return (
    <Group
      x={node.x + anchorX}
      y={node.y + anchorY}
      offsetX={anchorX}
      offsetY={anchorY}
      rotation={node.properties?.rotation || 0}
      opacity={isPlacing ? 0.6 : 1}
      draggable={!isPlacing}
      onClick={(evt) => {
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          evt.cancelBubble = true;
          store.finishPlacingNode();
          return;
        }
        evt.cancelBubble = true;
        select({ type: 'node', id: node.id });
      }}
      onDragMove={(evt) => {
        const localX = Math.round((evt.target.x() - anchorX) / 20) * 20;
        const localY = Math.round((evt.target.y() - anchorY) / 20) * 20;
        evt.target.position({ x: localX + anchorX, y: localY + anchorY });
        updateNodePosition(node.id, localX, localY);
      }}
      onDragEnd={(evt) => {
        const localX = Math.round((evt.target.x() - anchorX) / 20) * 20;
        const localY = Math.round((evt.target.y() - anchorY) / 20) * 20;
        evt.target.position({ x: localX + anchorX, y: localY + anchorY });
        updateNodePosition(node.id, localX, localY);
      }}
      onMouseEnter={(evt) => {
        const container = evt.target.getStage()?.container();
        if (container && !useSimulatorStore.getState().placingNodeId) container.style.cursor = 'grab';
      }}
      onMouseLeave={(evt) => {
        const container = evt.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
      }}
    >
      {/* Body */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={theme === 'dark' ? '#0f172a' : '#f1f5f9'}
        stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={4}
      />

      <Rect
        x={10}
        y={15}
        width={width - 20}
        height={height - 30}
        fill={theme === 'dark' ? '#000000' : '#ffffff'}
        cornerRadius={2}
      />

      {/* Segments Display Area */}
      <Group x={dx} y={dy}>
        {/* A */}
        {renderSeg([8,0, 24,0, 28,4, 24,8, 8,8, 4,4], a === 1)}
        {/* B */}
        {renderSeg([28,6, 32,10, 32,28, 28,32, 24,28, 24,10], b === 1)}
        {/* C */}
        {renderSeg([28,36, 32,40, 32,58, 28,62, 24,58, 24,40], c === 1)}
        {/* D */}
        {renderSeg([8,60, 24,60, 28,64, 24,68, 8,68, 4,64], d === 1)}
        {/* E */}
        {renderSeg([4,36, 8,40, 8,58, 4,62, 0,58, 0,40], e === 1)}
        {/* F */}
        {renderSeg([4,6, 8,10, 8,28, 4,32, 0,28, 0,10], f === 1)}
        {/* G */}
        {renderSeg([8,30, 24,30, 28,34, 24,38, 8,38, 4,34], g === 1)}
        
        {/* DP */}
        <Circle
          x={38}
          y={64}
          radius={4}
          fill={dp === 1 ? activeColor : inactiveColor}
          shadowColor={dp === 1 ? activeColor : 'transparent'}
          shadowBlur={dp === 1 ? 8 : 0}
          shadowOpacity={0.8}
        />
      </Group>

      {/* Render Pins */}
      {pins.map((pin, i) => {
        const isTop = i < 4;
        const col = isTop ? i : i - 4;
        const xOffset = 20 + col * 20;
        const yOffset = isTop ? 0 : height;
        return (
          <Group key={pin.id}>
            <Path
              data={`M ${xOffset} ${isTop ? 0 : height} L ${xOffset} ${isTop ? 10 : height - 10}`}
              stroke={canvasTheme.nodeBorder}
              strokeWidth={2}
            />
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={xOffset}
              y={yOffset}
              type={pin.type}
            />
            <Text
              text={pin.name}
              x={xOffset - 10}
              y={isTop ? 12 : height - 20}
              width={20}
              align="center"
              fontSize={8}
              fill={canvasTheme.textColor}
            />
          </Group>
        );
      })}
    </Group>
  );
});
