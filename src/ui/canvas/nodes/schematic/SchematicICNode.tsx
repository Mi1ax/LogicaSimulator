import React from 'react';
import { Group, Rect, Text, Path } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions, getSchematicAnchor } from '../../../../core/utils/schematicLayout';
import { getSafePinNumber } from '../../../../core/utils/layoutUtils';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';
import { getNodeDefinition } from '../../../../core/engine/nodes';

interface ICNodeProps {
  node: LogicNode;
}

export const SchematicICNode: React.FC<ICNodeProps> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const multiSelection = useSimulatorStore(state => state.multiSelection);
  const select = useSimulatorStore(state => state.select);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  
  const isSelected = (selection?.type === 'node' && selection.id === node.id) || multiSelection.includes(node.id);
  const def = getNodeDefinition(node.type);
  
  const visibleInputs = node.inputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
  const visibleOutputs = node.outputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
  const allPins = Array.from(new Map([...node.inputs, ...node.outputs].map(p => [p.id, p])).values());

  
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

  const { x: anchorX, y: anchorY } = getSchematicAnchor(node);

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
        select({ type: 'node', id: node.id }, e.evt.shiftKey);
      }}
      onDragStart={() => useSimulatorStore.getState().saveHistory()}
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
      {/* IC Body */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={canvasTheme.nodeBg}
        stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={0}
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

      {/* IC Label */}
      <Text
        text={def?.type || 'IC'}
        x={0}
        y={0}
        width={width}
        height={height}
        align="center"
        verticalAlign="middle"
        fontSize={16}
        fontFamily="monospace"
        fontStyle="bold"
        fill={canvasTheme.textColor}
      />

      {/* Render Pins and Labels */}
      {allPins.map((pin) => {
        if (pin.name === 'VCC' || pin.name === 'GND') {
          const isVcc = pin.name === 'VCC';
          const pinY = isVcc ? -20 : height + 20;
          return (
            <Group key={pin.id}>
              {/* Pin Extension Leg */}
              <Path
                data={`M ${width / 2} ${isVcc ? 0 : height} L ${width / 2} ${pinY}`}
                stroke={canvasTheme.nodeBorder}
                strokeWidth={2}
              />
              {/* The actual connection pin */}
              <Pin
                id={pin.id}
                nodeId={node.id}
                x={width / 2}
                y={pinY}
                type={pin.type}
              />
              {/* Physical Pin Number Label */}
              {(() => {
                const safePin = getSafePinNumber(node.type, pin);
                if (safePin === undefined) return null;
                return (
                  <Text
                    text={String(safePin)}
                    x={width / 2 + 6}
                    y={isVcc ? pinY + 6 : height + 6}
                    width={20}
                    align="left"
                    fontSize={10}
                    fill={canvasTheme.nodeBorder}
                    opacity={1}
                  />
                );
              })()}
              {/* Logical Pin Name Label (e.g. VCC, GND) */}
              <Text
                text={pin.name}
                x={width / 2 - 30}
                y={isVcc ? 4 : height - 16}
                width={60}
                align="center"
                fontSize={11}
                fontStyle="bold"
                fill={canvasTheme.textColor}
                opacity={1}
              />
            </Group>
          );
        }

        const pinDef = def?.customPins?.find(cp => cp.name === pin.name);
        let side = pinDef?.schematicSide || (pin.type === 'input' ? 'left' : 'right');
        
        let row = pinDef?.schematicRow;
        if (row === undefined) {
           const collection = side === 'left' ? visibleInputs : visibleOutputs;
           row = collection.findIndex(p => p.id === pin.id) + 1;
        }

        const spacing = 40;
        const yOffset = row * spacing;
        const isLeft = side === 'left';
        
        return (
          <Group key={pin.id}>
            {/* Pin Extension Leg */}
            <Path
              data={`M ${isLeft ? 0 : width} ${yOffset} L ${isLeft ? -20 : width + 20} ${yOffset}`}
              stroke={canvasTheme.nodeBorder}
              strokeWidth={2}
            />
            {/* The actual connection pin */}
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={isLeft ? -20 : width + 20}
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
                  x={isLeft ? -20 : width}
                  y={yOffset - 14}
                  width={20}
                  align="center"
                  fontSize={10}
                  fill={canvasTheme.nodeBorder}
                  opacity={1}
                />
              );
            })()}
            {/* Logical Pin Name Label */}
            {pin.name && (
              <Text
                text={pin.name}
                x={isLeft ? 8 : width - 68}
                y={yOffset - 5}
                width={60}
                wrap="none"
                align={isLeft ? 'left' : 'right'}
                fontSize={11}
                fontStyle="bold"
                fill={canvasTheme.textColor}
                opacity={1}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
});
