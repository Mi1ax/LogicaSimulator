import React, { useMemo } from 'react';
import { Group, Rect, Text, Path, Circle } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore, isIdSelected } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getSchematicDimensions, getGridAlignedPinYs } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface GateNodeProps {
  node: LogicNode;
}

const STANDARD_GATES = new Set(['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUFFER', '74LS30']);
const BUBBLE_GATES = new Set(['NOT', 'NAND', 'NOR', 'XNOR', '74LS30']);
const OR_GATES = new Set(['OR', 'NOR', 'XOR', 'XNOR']);
const XOR_GATES = new Set(['XOR', 'XNOR']);
const TRI_GATES = new Set(['NOT', 'BUFFER']);

export const SchematicGateNode: React.FC<GateNodeProps> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state => isIdSelected(state, node.id));
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);

  const type = node.type;
  const isStandardGate = STANDARD_GATES.has(type);
  const hasBubble = BUBBLE_GATES.has(type);
  const isXOR = XOR_GATES.has(type);
  const endX = width - 20;
  const bubbleRadius = 4;
  const midY = height / 2;

  const { gatePath, extraPath, inputYs, outputYs, legsPath } = useMemo(() => {
    const padY = 10;
    const startX = 20;
    const isOR = OR_GATES.has(type);
    const isTri = TRI_GATES.has(type);
    const topY = padY;
    const botY = height - padY;
    const backCurveX = isOR ? startX + 15 : startX;
    const gateEndX = hasBubble ? endX - bubbleRadius * 2 : endX;

    let gPath = '';
    if (isTri) {
      gPath = `M ${startX} ${topY} L ${gateEndX} ${midY} L ${startX} ${botY} Z`;
    } else if (isOR) {
      gPath = `M ${startX} ${topY} Q ${startX + 30} ${topY}, ${gateEndX} ${midY} Q ${startX + 30} ${botY}, ${startX} ${botY} Q ${backCurveX} ${midY}, ${startX} ${topY} Z`;
    } else {
      gPath = `M ${startX} ${topY} L ${startX + 15} ${topY} A ${gateEndX - startX - 15} ${midY - topY} 0 0 1 ${startX + 15} ${botY} L ${startX} ${botY} Z`;
    }

    let xPath = '';
    if (isXOR) {
      xPath = `M ${startX - 6} ${topY} Q ${backCurveX - 6} ${midY}, ${startX - 6} ${botY}`;
    }

    const getLineEndX = (py: number) => {
      if (isXOR) {
        const t = (py - topY) / (botY - topY);
        const x0 = startX - 6;
        const x1 = backCurveX - 6;
        const x2 = startX - 6;
        return (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2;
      }
      if (isOR) {
        return startX + 15;
      }
      return startX;
    };

    const inYs = getGridAlignedPinYs(node.inputs.length, height);
    const outYs = getGridAlignedPinYs(node.outputs.length, height);

    let lPath = '';
    if (isStandardGate) {
      for (let i = 0; i < node.inputs.length; i++) {
        const py = inYs[i];
        lPath += `M 0 ${py} L ${getLineEndX(py)} ${py} `;
      }
      for (let i = 0; i < node.outputs.length; i++) {
        const py = outYs[i];
        lPath += `M ${endX} ${py} L ${width} ${py} `;
      }
    }

    return {
      gatePath: gPath,
      extraPath: xPath,
      inputYs: inYs,
      outputYs: outYs,
      legsPath: lPath,
    };
  }, [type, width, height, node.inputs.length, node.outputs.length, isStandardGate, hasBubble, isXOR, endX, midY]);

  return (
    <SchematicNodeWrapper node={node}>
      {isStandardGate ? (
        <>
          <Rect x={0} y={0} width={width} height={height} fill="transparent" perfectDrawEnabled={false} />
          
          {legsPath && (
            <Path
              data={legsPath}
              stroke={canvasTheme.nodeBorder}
              strokeWidth={2}
              perfectDrawEnabled={false}
              listening={false}
            />
          )}

          <Path
            data={gatePath}
            fill={canvasTheme.nodeBg}
            stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
            strokeWidth={isSelected ? 3 : 2}
            lineJoin="round"
            perfectDrawEnabled={false}
            listening={false}
          />
          
          {isXOR && (
            <Path
              data={extraPath}
              stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
              strokeWidth={isSelected ? 3 : 2}
              fill="transparent"
              lineCap="round"
              perfectDrawEnabled={false}
              listening={false}
            />
          )}

          {hasBubble && (
            <Circle
              x={endX - bubbleRadius}
              y={midY}
              radius={bubbleRadius}
              fill={canvasTheme.nodeBg}
              stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
              strokeWidth={isSelected ? 3 : 2}
              perfectDrawEnabled={false}
              listening={false}
            />
          )}
        </>
      ) : (
        <>
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
          <Group x={width / 2} y={height / 2} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
            <Text
              text={node.type}
              x={-width / 2}
              y={-height / 2}
              width={width}
              height={height}
              align="center"
              verticalAlign="middle"
              fontSize={20}
              fontFamily="monospace"
              fontStyle="bold"
              fill={canvasTheme.textColor}
              listening={false}
            />
          </Group>
        </>
      )}

      {node.inputs.map((pin, index) => (
        <Pin
          key={pin.id}
          id={pin.id}
          nodeId={node.id}
          x={0}
          y={inputYs[index]}
          type={pin.type}
        />
      ))}
      {node.outputs.map((pin, index) => (
        <Pin
          key={pin.id}
          id={pin.id}
          nodeId={node.id}
          x={width}
          y={outputYs[index]}
          type={pin.type}
        />
      ))}
    </SchematicNodeWrapper>
  );
});
