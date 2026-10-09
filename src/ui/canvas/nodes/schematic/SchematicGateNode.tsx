import React from 'react';
import { Group, Rect, Text, Path, Circle } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getSchematicDimensions, getGridAlignedPinYs, getSchematicAnchor } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';

interface GateNodeProps {
  node: LogicNode;
}

export const SchematicGateNode: React.FC<GateNodeProps> = React.memo(({ node }) => {
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const theme = useSimulatorStore(state => state.theme);
  const selection = useSimulatorStore(state => state.selection);
  const multiSelection = useSimulatorStore(state => state.multiSelection);
  const select = useSimulatorStore(state => state.select);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  
  const { x: anchorX, y: anchorY } = getSchematicAnchor(node);

  const isSelected = (selection?.type === 'node' && selection.id === node.id) || multiSelection.includes(node.id);
  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);

  const type = node.type;
  const isStandardGate = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUFFER'].includes(type);

  const padY = 10;
  const startX = 20;
  const endX = width - 20; // 60
  const bubbleRadius = 4;
  
  const hasBubble = ['NOT', 'NAND', 'NOR', 'XNOR'].includes(type);
  const isOR = ['OR', 'NOR', 'XOR', 'XNOR'].includes(type);
  const isXOR = ['XOR', 'XNOR'].includes(type);
  const isTri = ['NOT', 'BUFFER'].includes(type);
  
  const topY = padY;
  const botY = height - padY;
  const midY = height / 2;
  const backCurveX = isOR ? startX + 15 : startX;
  
  const gateEndX = hasBubble ? endX - bubbleRadius * 2 : endX;
  
  let gatePath = '';
  if (isTri) {
    gatePath = `M ${startX} ${topY} L ${gateEndX} ${midY} L ${startX} ${botY} Z`;
  } else if (isOR) {
    gatePath = `M ${startX} ${topY} Q ${startX + 30} ${topY}, ${gateEndX} ${midY} Q ${startX + 30} ${botY}, ${startX} ${botY} Q ${backCurveX} ${midY}, ${startX} ${topY} Z`;
  } else {
    gatePath = `M ${startX} ${topY} L ${startX + 15} ${topY} A ${gateEndX - startX - 15} ${midY - topY} 0 0 1 ${startX + 15} ${botY} L ${startX} ${botY} Z`;
  }
  
  let extraPath = '';
  if (isXOR) {
    extraPath = `M ${startX - 6} ${topY} Q ${backCurveX - 6} ${midY}, ${startX - 6} ${botY}`;
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

  const inputYs = getGridAlignedPinYs(node.inputs.length, height);
  const outputYs = getGridAlignedPinYs(node.outputs.length, height);

  return (
    <Group
      x={node.x + anchorX}
      y={node.y + anchorY}
      offsetX={anchorX}
      offsetY={anchorY}
      rotation={node.properties?.rotation || 0}
      scaleX={node.properties?.flipX ? -1 : 1}
      scaleY={node.properties?.flipY ? -1 : 1}
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
      {isStandardGate ? (
        <>
          <Rect x={0} y={0} width={width} height={height} fill="transparent" />
          
          {node.inputs.map((pin, index) => {
            const py = inputYs[index];
            return (
              <Path
                key={`line-in-${pin.id}`}
                data={`M 0 ${py} L ${getLineEndX(py)} ${py}`}
                stroke={canvasTheme.nodeBorder}
                strokeWidth={2}
              />
            );
          })}
          
          {node.outputs.map((pin, index) => {
            const py = outputYs[index];
            return (
              <Path
                key={`line-out-${pin.id}`}
                data={`M ${endX} ${py} L ${width} ${py}`}
                stroke={canvasTheme.nodeBorder}
                strokeWidth={2}
              />
            );
          })}

          <Path
            data={gatePath}
            fill={canvasTheme.nodeBg}
            stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
            strokeWidth={isSelected ? 3 : 2}
            lineJoin="round"
          />
          
          {isXOR && (
            <Path
              data={extraPath}
              stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
              strokeWidth={isSelected ? 3 : 2}
              fill="transparent"
              lineCap="round"
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
          />
          <Group x={width / 2} y={height / 2} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1}>
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
    </Group>
  );
});
