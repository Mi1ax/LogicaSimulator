import React from 'react';
import { Group, Rect, Text, Path } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getSafePinNumber } from '../../../../core/utils/layoutUtils';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';
import { getNodeDefinition } from '../../../../core/engine/nodes';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface ICNodeProps {
  node: LogicNode;
}

export const SchematicICNode: React.FC<ICNodeProps> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  const def = getNodeDefinition(node.type);
  
  const visibleInputs = node.inputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
  const visibleOutputs = node.outputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
  const allPins = Array.from(new Map([...node.inputs, ...node.outputs].map(p => [p.id, p])).values());

  return (
    <SchematicNodeWrapper node={node}>
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
        perfectDrawEnabled={false}
      />

      {/* Custom Name Label */}
      {node.properties?.label && (
        <Group x={width / 2} y={-20} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
          <Text
            text={node.properties.label}
            x={-width / 2}
            y={0}
            width={width}
            align="center"
            fontSize={11}
            fontFamily="sans-serif"
            fill={canvasTheme.textColor}
            listening={false}
          />
        </Group>
      )}

      {/* IC Label */}
      <Group x={width / 2} y={height / 2} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
        <Text
          text={def?.type?.startsWith('SUBCIRCUIT:') ? def.label : (def?.type || 'IC')}
          x={0}
          y={0}
          width={height}
          align="center"
          fontSize={14}
          fontFamily="sans-serif"
          fontStyle="normal"
          fill={canvasTheme.nodeBorder}
          opacity={0.4}
          rotation={-90}
          offsetX={height / 2}
          offsetY={8}
          listening={false}
        />
      </Group>

      {/* Render Pins and Labels */}
      {allPins.map((pin) => {
        if (pin.name === 'VCC' || pin.name === 'GND') {
          return null;
        }

        const pinDef = def?.customPins?.find(cp => cp.name === pin.name);
        let side = pinDef?.schematicSide || (pin.type === 'input' ? 'left' : 'right');
        
        let row = pinDef?.schematicRow;
        if (row === undefined) {
           const collection = side === 'left' ? visibleInputs : visibleOutputs;
           row = collection.findIndex(p => p.id === pin.id) + 1;
        }

        const spacing = 20;
        let legX = 0, legY = 0, toX = 0, toY = 0;
        let pinX = 0, pinY = 0;
        let numX = 0, numY = 0;
        let labelX = 0, labelY = 0;
        let labelAlign: 'left' | 'right' | 'center' = 'left';

        if (side === 'left') {
          legX = 0; legY = (row + 1) * spacing;
          toX = -20; toY = legY;
          pinX = -20; pinY = legY;
          numX = -20; numY = legY - 12;
          labelX = 5; labelY = legY - 6;
          labelAlign = 'left';
        } else if (side === 'right') {
          legX = width; legY = (row + 1) * spacing;
          toX = width + 20; toY = legY;
          pinX = width + 20; pinY = legY;
          numX = width; numY = legY - 12;
          labelX = width - 65; labelY = legY - 6;
          labelAlign = 'right';
        } else if (side === 'top') {
          legX = row * spacing; legY = 0;
          toX = legX; toY = -20;
          pinX = legX; pinY = -20;
          numX = legX + 6; numY = -12;
          labelX = legX - 30; labelY = 4;
          labelAlign = 'center';
        } else if (side === 'bottom') {
          legX = row * spacing; legY = height;
          toX = legX; toY = height + 20;
          pinX = legX; pinY = height + 20;
          numX = legX + 6; numY = height + 10;
          labelX = legX - 30; labelY = height - 16;
          labelAlign = 'center';
        }

        return (
          <Group key={pin.id}>
            {/* Pin Extension Leg */}
            <Path
              data={`M ${legX} ${legY} L ${toX} ${toY}`}
              stroke={canvasTheme.nodeBorder}
              strokeWidth={2}
              perfectDrawEnabled={false}
              listening={false}
            />
            {/* The actual connection pin */}
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={pinX}
              y={pinY}
              type={pin.type}
            />
            {/* Physical Pin Number Label */}
            {(() => {
              const safePin = getSafePinNumber(node.type, pin);
              if (safePin === undefined) return null;
              return (
                <Group x={numX + 10} y={numY + 4.5} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
                  <Text
                    text={String(safePin)}
                    x={-10}
                    y={-4.5}
                    width={20}
                    align="center"
                    fontSize={9}
                    fontFamily="sans-serif"
                    fill={canvasTheme.nodeBorder}
                    opacity={1}
                    listening={false}
                  />
                </Group>
              );
            })()}
            {/* Logical Pin Name Label */}
            {pin.name && (
              <Group x={labelX + 30} y={labelY + 5} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
                <Text
                  text={pin.name}
                  x={-30}
                  y={-5}
                  width={60}
                  wrap="none"
                  align={
                    node.properties?.flipX
                      ? (labelAlign === 'left' ? 'right' : labelAlign === 'right' ? 'left' : 'center')
                      : labelAlign
                  }
                  fontSize={10}
                  fontFamily="sans-serif"
                  fontStyle="normal"
                  fill={canvasTheme.textColor}
                  opacity={1}
                  listening={false}
                />
              </Group>
            )}
          </Group>
        );
      })}
    </SchematicNodeWrapper>
  );
});
