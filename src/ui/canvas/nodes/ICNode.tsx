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
  const appMode = useSimulatorStore(state => state.appMode);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const isSchematic = appMode === 'schematic';
  const { width, height } = getGateDimensions(node, isSchematic);
  
  const isSelected = selection?.type === 'node' && selection.id === node.id;
  const def = getNodeDefinition(node.type);
  
  const visibleInputs = isSchematic ? node.inputs.filter(p => p.name !== 'VCC' && p.name !== 'GND') : node.inputs;
  const visibleOutputs = isSchematic ? node.outputs.filter(p => p.name !== 'VCC' && p.name !== 'GND') : node.outputs;
  const allPins = isSchematic ? [...visibleInputs, ...visibleOutputs] : [...node.inputs, ...node.outputs];

  let pinsPerSide = 4;
  if (isSchematic) {
    pinsPerSide = Math.max(visibleInputs.length, visibleOutputs.length);
  } else {
    const maxPinNumber = allPins.reduce((max, p) => Math.max(max, getSafePinNumber(node.type, p) ?? 0), 0);
    pinsPerSide = Math.max(Math.ceil(allPins.length / 2), Math.ceil(maxPinNumber / 2));
  }


  return (
    <Group
      x={node.x}
      y={node.y}
      draggable={isSelected}
      onClick={(e) => {
        const store = useSimulatorStore.getState();
        if (store.appMode === 'board' && store.interactionMode === 'wire') {
          // In board mode, if we are in wire mode, let clicks on pins fall through to start a trace!
          const pos = e.target.getStage()?.getPointerPosition();
          if (pos) {
            const transform = e.target.getStage()?.getAbsoluteTransform().copy().invert();
            const localPos = transform?.point(pos);
            if (localPos) {
              const dx = localPos.x % 20;
              const dy = localPos.y % 20;
              // If they clicked very close to a hole (within 5px)
              if ((dx < 5 || dx > 15) && (dy < 5 || dy > 15)) {
                return; // Fall through to canvas to start/end trace!
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
        fill={isSchematic ? canvasTheme.nodeBg : '#171717'}
        stroke={isSelected ? canvasTheme.selectedNodeColor : (isSchematic ? canvasTheme.nodeBorder : '#0a0a0a')}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={isSchematic ? 4 : 2}
        shadowColor={isSchematic ? "#0f172a" : "#000000"}
        shadowBlur={isSchematic ? 4 : 8}
        shadowOpacity={isSchematic ? 0.15 : 0.5}
        shadowOffset={{ x: 0, y: isSchematic ? 2 : 4 }}
      />

      {/* DIP Socket Inner Tray */}
      {!isSchematic && (
        <Rect
          x={12}
          y={10}
          width={width - 24}
          height={height - 20}
          fill="#111111"
          stroke="#0a0a0a"
          strokeWidth={1}
          cornerRadius={1}
        />
      )}

      {/* IC Notch */}
      {!isSchematic && (
        <Path
          data={`M ${width / 2 - 8} 0 a 8 8 0 0 0 16 0`}
          fill="#111111"
          stroke="#0a0a0a"
          strokeWidth={1}
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

      {/* IC Label */}
      <Text
        text={def?.type || 'IC'}
        x={0}
        y={isSchematic ? 10 : height / 2}
        offsetX={0}
        offsetY={isSchematic ? 0 : 7}
        width={width}
        align="center"
        verticalAlign={isSchematic ? "top" : "middle"}
        rotation={isSchematic ? 0 : 90}
        fontSize={14}
        fontFamily="monospace"
        fontStyle="bold"
        fill={isSchematic ? canvasTheme.textColor : canvasTheme.nodeBorder}
        opacity={isSchematic ? 1 : 0.7}
      />

      {/* Render Pins and Labels */}
      {allPins.map((pin) => {
        let isLeft = true;
        let row = 1;

        if (isSchematic) {
          isLeft = pin.type === 'input';
          const index = isLeft ? visibleInputs.findIndex(p => p.id === pin.id) : visibleOutputs.findIndex(p => p.id === pin.id);
          row = index + 1;
        } else {
          const safePinNum = getSafePinNumber(node.type, pin) ?? 1;
          isLeft = safePinNum <= pinsPerSide;
          const totalPins = pinsPerSide * 2;
          row = isLeft ? safePinNum : (totalPins - safePinNum + 1);
        }

        const yOffset = 20 + ((row - 1) * 20);
        
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
            {isSchematic && pin.name && (
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
