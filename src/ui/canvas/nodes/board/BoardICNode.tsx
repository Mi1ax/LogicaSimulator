import React from 'react';
import { Group, Rect, Text, Path } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getBoardDimensions } from '../../../../core/utils/boardLayout';
import { getSafePinNumber } from '../../../../core/utils/layoutUtils';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';
import { getNodeDefinition } from '../../../../core/engine/nodes';

interface ICNodeProps {
  node: LogicNode;
}

export const BoardICNode: React.FC<ICNodeProps> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const select = useSimulatorStore(state => state.select);
  const boardScale = useSimulatorStore(state => state.boardScale);

  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getBoardDimensions(node);
  const showBoardPins = boardScale >= 1.5;

  const isSelected = selection?.type === 'node' && selection.id === node.id;
  const def = getNodeDefinition(node.type);

  const allPins = [...node.inputs, ...node.outputs];

  const maxPinNumber = allPins.reduce((max, p) => Math.max(max, getSafePinNumber(node.type, p) ?? 0), 0);
  const pinsPerSide = Math.max(Math.ceil(allPins.length / 2), Math.ceil(maxPinNumber / 2));
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

  // In board mode, physical coords are in boardX/boardY
  const x = node.boardX ?? 0;
  const y = node.boardY ?? 0;

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

        if (store.interactionMode === 'wire') {
          const pos = e.target.getStage()?.getPointerPosition();
          if (pos) {
            const transform = e.target.getStage()?.getAbsoluteTransform().copy().invert();
            const localPos = transform?.point(pos);
            if (localPos) {
              const dx = localPos.x % 20;
              const dy = localPos.y % 20;
              if ((dx < 5 || dx > 15) && (dy < 5 || dy > 15)) {
                return;
              }
            }
          }
        }
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

      {/* Inner Physical Chip with Notch */}
      <Path
        data={`M 13 10
               L ${width / 2 - 6} 10
               A 6 6 0 0 1 ${width / 2 + 6} 10
               L ${width - 13} 10
               A 1 1 0 0 1 ${width - 12} 11
               L ${width - 12} ${height - 11}
               A 1 1 0 0 1 ${width - 13} ${height - 10}
               L 13 ${height - 10}
               A 1 1 0 0 1 12 ${height - 11}
               L 12 11
               A 1 1 0 0 1 13 10 Z`}
        fill={canvasTheme.boardIcBg}
        stroke={canvasTheme.boardIcBorder}
        strokeWidth={1}
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

      {/* IC Label (Rotated for Board Mode) */}
      <Group x={width / 2} y={height / 2} rotation={90}>
        <Text
          text={def?.type || 'IC'}
          x={-height / 2}
          y={-7}
          width={height}
          align="center"
          verticalAlign="middle"
          fontSize={14}
          fontFamily="monospace"
          fontStyle="bold"
          fill="#e5e5e5"
          opacity={0.8}
        />
      </Group>

      {/* Render Pins and Labels */}
      {allPins.map((pin) => {
        const safePinNum = getSafePinNumber(node.type, pin) ?? 1;
        const totalPins = pinsPerSide * 2;
        const isLeft = safePinNum <= pinsPerSide;
        const row = isLeft ? safePinNum : (totalPins - safePinNum + 1);

        const spacing = 20;
        const yOffset = spacing + ((row - 1) * spacing);

        return (
          <Group key={pin.id}>
            {/* The actual connection pin */}
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={isLeft ? 0 : width}
              y={yOffset}
              type={pin.type}
            />
            {/* Physical Pin Number Label */}
            {showBoardPins && (() => {
              const safePin = getSafePinNumber(node.type, pin);
              if (safePin === undefined) return null;
              return (
                <Text
                  text={String(safePin)}
                  x={isLeft ? 8 : width - 24}
                  y={yOffset - 5}
                  width={16}
                  align={isLeft ? 'left' : 'right'}
                  fontSize={10}
                  fill="#a3a3a3"
                  opacity={0.9}
                />
              );
            })()}
          </Group>
        );
      })}
    </Group>
  );
});
