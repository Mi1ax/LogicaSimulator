import React from 'react';
import { Group, Rect, Text, Path } from 'react-konva';
import { LogicNode } from '../../../core/models/types';
import { useSimulatorStore } from '../../../store/useSimulatorStore';
import { getGateDimensions, getSafePinNumber } from '../../../core/utils/nodeLayout';
import { getCanvasTheme } from '../theme';
import { Pin } from '../primitives/Pin';
import { getNodeDefinition } from '../../../core/engine/nodes';

interface ICNodeProps {
  node: LogicNode;
}

export const ICNode: React.FC<ICNodeProps> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const select = useSimulatorStore(state => state.select);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getGateDimensions(node);
  
  const isSelected = selection?.type === 'node' && selection.id === node.id;
  const def = getNodeDefinition(node.type);

  const allPins = [...node.inputs, ...node.outputs];
  const isSchematic = node.properties?.schematicView !== false;
  let pinsPerSide = 4;
  if (isSchematic) {
    pinsPerSide = Math.max(node.inputs.length, node.outputs.length);
  } else {
    const maxPinNumber = allPins.reduce((max, p) => Math.max(max, getSafePinNumber(node.type, p) ?? 0), 0);
    pinsPerSide = Math.max(Math.ceil(allPins.length / 2), Math.ceil(maxPinNumber / 2));
  }

  // Draw the semi-circle notch at the top
  const notchPath = `M ${width / 2 - 10} 0 a 10 10 0 0 0 20 0`;

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
      {/* IC Body */}
      <Rect
        width={width}
        height={height}
        fill={canvasTheme.nodeBg}
        stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={4}
        shadowColor="#0f172a"
        shadowBlur={4}
        shadowOpacity={0.15}
        shadowOffset={{ x: 0, y: 2 }}
      />

      {/* IC Notch */}
      {!isSchematic && (
        <Path
          data={notchPath}
          fill={canvasTheme.nodeBg}
          stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
          strokeWidth={isSelected ? 3 : 2}
        />
      )}

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

      {/* IC Label (Rotated vertically to fit perfectly) */}
      <Text
        text={def?.type || 'IC'}
        x={width / 2}
        y={height / 2}
        offsetX={50} // half of max text width to center it
        offsetY={7} // half of text height
        width={100}
        align="center"
        verticalAlign="middle"
        rotation={90}
        fontSize={14}
        fontFamily="monospace"
        fontStyle="bold"
        fill={canvasTheme.nodeBorder}
        opacity={0.7}
      />

      {/* Render Pins and Labels */}
      {allPins.map((pin) => {
        let isLeft = true;
        let row = 1;

        if (isSchematic) {
          isLeft = pin.type === 'input';
          const index = isLeft ? node.inputs.findIndex(p => p.id === pin.id) : node.outputs.findIndex(p => p.id === pin.id);
          row = index + 1;
        } else {
          const safePinNum = getSafePinNumber(node.type, pin) ?? 1;
          isLeft = safePinNum <= pinsPerSide;
          const totalPins = pinsPerSide * 2;
          row = isLeft ? safePinNum : (totalPins - safePinNum + 1);
        }

        const yOffset = 20 + ((row - 1) * 20) + 10;
        
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
            {(() => {
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
                  fill={canvasTheme.nodeBorder}
                  opacity={isSchematic ? 0.4 : 1}
                />
              );
            })()}
            {/* Logical Pin Name Label (e.g. 1A, VCC) */}
            {pin.name && (
              <Text
                text={pin.name}
                x={isLeft ? 26 : width - 56}
                y={yOffset - 4}
                width={30}
                align={isLeft ? 'left' : 'right'}
                fontSize={9}
                fill={canvasTheme.nodeBorder}
                opacity={0.6}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
});
