import React from 'react';
import { Group, Rect, Text, Path, Circle, Line } from 'react-konva';
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

interface ParsedPinLabel {
  cleanName: string;
  isInverted: boolean;
  overbar: 'none' | 'full' | 'last-char';
  isClock: boolean;
}

function parsePinLabel(rawName?: string): ParsedPinLabel {
  if (!rawName) {
    return { cleanName: '', isInverted: false, overbar: 'none', isClock: false };
  }
  if (rawName === 'D/~U') {
    return { cleanName: 'D/U', isInverted: false, overbar: 'last-char', isClock: false };
  }
  let cleanName = rawName;
  let isInverted = false;
  let overbar: 'none' | 'full' | 'last-char' = 'none';

  if (rawName.startsWith('~') || rawName.startsWith('!') || rawName.startsWith('/')) {
    cleanName = rawName.slice(1);
    isInverted = true;
    overbar = 'full';
  } else if (rawName.endsWith("'")) {
    cleanName = rawName.slice(0, -1);
    isInverted = true;
    overbar = 'full';
  }

  const isClock = cleanName === 'CLK' || cleanName === 'CP' || cleanName === 'I/CLK';
  return { cleanName, isInverted, overbar, isClock };
}

export const SchematicICNode: React.FC<ICNodeProps> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isLowDetail = useSimulatorStore(state => state.schematicScale < 0.55);
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

  const invRot = -(node.properties?.rotation || 0);
  const flipScaleX = node.properties?.flipX ? -1 : 1;
  const flipScaleY = node.properties?.flipY ? -1 : 1;

  let combinedLegsPath = '';
  let combinedWedgesPath = '';
  const bubbles: { id: string; x: number; y: number }[] = [];
  const pinConfigs: {
    id: string;
    type: 'input' | 'output' | 'bidir';
    pinX: number;
    pinY: number;
    safePin: string | number | undefined;
    numX: number;
    numY: number;
    cleanName: string;
    labelX: number;
    labelY: number;
    effectiveAlign: 'left' | 'right' | 'center';
    overbar: 'none' | 'full' | 'last-char';
    barX1: number;
    barX2: number;
  }[] = [];

  const bubbleRadius = 3.5;
  const spacing = 20;

  for (let i = 0; i < allPins.length; i++) {
    const pin = allPins[i];
    if (pin.name === 'VCC' || pin.name === 'GND') {
      continue;
    }

    const pinDef = def?.customPins?.find(cp => cp.name === pin.name);
    const side = pinDef?.schematicSide || (pin.type === 'input' ? 'left' : 'right');
    
    let row = pinDef?.schematicRow;
    if (row === undefined) {
      const collection = side === 'left' ? visibleInputs : visibleOutputs;
      row = collection.findIndex(p => p.id === pin.id) + 1;
    }

    const { cleanName, isInverted, overbar, isClock } = parsePinLabel(pin.name);
    const bubbleOffset = !isLowDetail && isInverted ? bubbleRadius * 2 : 0;

    let legX = 0, legY = 0, toX = 0, toY = 0;
    let bubbleX = 0, bubbleY = 0;
    let pinX = 0, pinY = 0;
    let numX = 0, numY = 0;
    let labelX = 0, labelY = 0;
    let labelAlign: 'left' | 'right' | 'center' = 'left';

    if (side === 'left') {
      legY = (row + 1) * spacing;
      legX = -bubbleOffset;
      toX = -20; toY = legY;
      bubbleX = -bubbleRadius; bubbleY = legY;
      pinX = -20; pinY = legY;
      numX = isInverted ? -23 : -20; numY = legY - 12;
      labelX = isClock ? 10 : 6; labelY = legY - 5;
      labelAlign = 'left';
    } else if (side === 'right') {
      legY = (row + 1) * spacing;
      legX = width + bubbleOffset;
      toX = width + 20; toY = legY;
      bubbleX = width + bubbleRadius; bubbleY = legY;
      pinX = width + 20; pinY = legY;
      numX = isInverted ? width + 3 : width; numY = legY - 12;
      labelX = width - 66; labelY = legY - 5;
      labelAlign = 'right';
    } else if (side === 'top') {
      legX = row * spacing;
      legY = -bubbleOffset;
      toX = legX; toY = -20;
      bubbleX = legX; bubbleY = -bubbleRadius;
      pinX = legX; pinY = -20;
      numX = legX + 6; numY = -12;
      labelX = legX - 30; labelY = 4;
      labelAlign = 'center';
    } else if (side === 'bottom') {
      legX = row * spacing;
      legY = height + bubbleOffset;
      toX = legX; toY = height + 20;
      bubbleX = legX; bubbleY = height + bubbleRadius;
      pinX = legX; pinY = height + 20;
      numX = legX + 6; numY = height + 10;
      labelX = legX - 30; labelY = height - 16;
      labelAlign = 'center';
    }

    combinedLegsPath += `M ${legX} ${legY} L ${toX} ${toY} `;

    if (!isLowDetail) {
      if (isInverted) {
        bubbles.push({ id: pin.id, x: bubbleX, y: bubbleY });
      }
      if (isClock && side === 'left') {
        combinedWedgesPath += `M 0 ${legY - 4.5} L 6.5 ${legY} L 0 ${legY + 4.5} `;
      }
    }

    const effectiveAlign = node.properties?.flipX
      ? (labelAlign === 'left' ? 'right' : labelAlign === 'right' ? 'left' : 'center')
      : labelAlign;

    const charWidth = 6;
    const totalTextWidth = cleanName.length * charWidth;
    const textStartX =
      effectiveAlign === 'left'
        ? -30
        : effectiveAlign === 'right'
        ? 30 - totalTextWidth
        : -totalTextWidth / 2;

    const barX1 =
      overbar === 'last-char'
        ? textStartX + Math.max(0, cleanName.length - 1) * charWidth
        : textStartX;
    const barX2 = textStartX + totalTextWidth;

    pinConfigs.push({
      id: pin.id,
      type: pin.type,
      pinX,
      pinY,
      safePin: isLowDetail ? undefined : getSafePinNumber(node.type, pin),
      numX,
      numY,
      cleanName: isLowDetail ? '' : cleanName,
      labelX,
      labelY,
      effectiveAlign,
      overbar,
      barX1,
      barX2,
    });
  }

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

      {/* Combined Pin Extension Legs */}
      {combinedLegsPath && (
        <Path
          data={combinedLegsPath}
          stroke={canvasTheme.nodeBorder}
          strokeWidth={2}
          perfectDrawEnabled={false}
          listening={false}
        />
      )}

      {/* Combined IEEE Clock Input Wedges */}
      {!isLowDetail && combinedWedgesPath && (
        <Path
          data={combinedWedgesPath}
          stroke={canvasTheme.nodeBorder}
          strokeWidth={1.5}
          lineJoin="round"
          perfectDrawEnabled={false}
          listening={false}
        />
      )}

      {/* Active-Low Inversion Bubbles */}
      {!isLowDetail && bubbles.map(b => (
        <Circle
          key={`b-${b.id}`}
          x={b.x}
          y={b.y}
          radius={bubbleRadius}
          fill={canvasTheme.nodeBg}
          stroke={canvasTheme.nodeBorder}
          strokeWidth={2}
          perfectDrawEnabled={false}
          listening={false}
        />
      ))}

      {/* Custom Name Label */}
      {node.properties?.label && (
        <Text
          text={node.properties.label}
          x={width / 2}
          y={-20}
          offsetX={width / 2}
          rotation={invRot}
          scaleX={flipScaleX}
          scaleY={flipScaleY}
          width={width}
          align="center"
          fontSize={11}
          fontFamily="sans-serif"
          fill={canvasTheme.textColor}
          perfectDrawEnabled={false}
          listening={false}
        />
      )}

      {/* IC Label */}
      <Group x={width / 2} y={height / 2} rotation={invRot} scaleX={flipScaleX} scaleY={flipScaleY} listening={false}>
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
          perfectDrawEnabled={false}
          listening={false}
        />
      </Group>

      {/* Render Pins, Numbers, Labels, and Overbars */}
      {pinConfigs.map(cfg => (
        <React.Fragment key={cfg.id}>
          <Pin
            id={cfg.id}
            nodeId={node.id}
            x={cfg.pinX}
            y={cfg.pinY}
            type={cfg.type}
          />
          {cfg.safePin !== undefined && (
            <Text
              text={String(cfg.safePin)}
              x={cfg.numX + 10}
              y={cfg.numY + 4.5}
              offsetX={10}
              offsetY={4.5}
              rotation={invRot}
              scaleX={flipScaleX}
              scaleY={flipScaleY}
              width={20}
              align="center"
              fontSize={9}
              fontFamily="sans-serif"
              fill={canvasTheme.nodeBorder}
              perfectDrawEnabled={false}
              listening={false}
            />
          )}
          {cfg.cleanName && (
            <>
              {cfg.overbar !== 'none' && (
                <Line
                  x={cfg.labelX + 30}
                  y={cfg.labelY + 5}
                  rotation={invRot}
                  scaleX={flipScaleX}
                  scaleY={flipScaleY}
                  points={[cfg.barX1, -7, cfg.barX2, -7]}
                  stroke={canvasTheme.textColor}
                  strokeWidth={1.2}
                  perfectDrawEnabled={false}
                  listening={false}
                />
              )}
              <Text
                text={cfg.cleanName}
                x={cfg.labelX + 30}
                y={cfg.labelY + 5}
                offsetX={30}
                offsetY={5}
                rotation={invRot}
                scaleX={flipScaleX}
                scaleY={flipScaleY}
                width={60}
                wrap="none"
                align={cfg.effectiveAlign}
                fontSize={10}
                fontFamily="monospace"
                fontStyle="normal"
                fill={canvasTheme.textColor}
                perfectDrawEnabled={false}
                listening={false}
              />
            </>
          )}
        </React.Fragment>
      ))}
    </SchematicNodeWrapper>
  );
});

