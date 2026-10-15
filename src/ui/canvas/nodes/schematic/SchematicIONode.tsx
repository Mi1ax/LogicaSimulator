import React from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface IONodeProps {
  node: LogicNode;
}

export const SchematicIONode: React.FC<IONodeProps> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  const toggleInputNode = useSimulatorStore(state => state.toggleInputNode);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  const isInput = node.type === 'INPUT';
  const isOutput = node.type === 'OUTPUT';
  const isClock = node.type === 'CLOCK';
  const isVcc = node.type === 'VCC';
  const isGnd = node.type === 'GND';

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
  
  const borderStroke = isInputLike ? canvasTheme.inputNodeBorder : canvasTheme.outputNodeBorder;

  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id || Boolean(state.pastingNodeIds && state.pastingNodeIds.includes(node.id)));

  return (
    <SchematicNodeWrapper node={node} cursor={isInput ? 'pointer' : 'grab'}>
      {isVcc ? (
        <>
          <Line points={[width/2, 10, width/2, height]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
          <Line points={[10, 10, width-10, 10]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
          <Group x={width / 2} y={-4} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
            <Text text="VCC" x={-width / 2} y={-6} width={width} align="center" fontSize={12} fontFamily="monospace" fill={canvasTheme.textColor} listening={false} />
          </Group>
          <Rect x={0} y={0} width={width} height={height} fill="transparent" perfectDrawEnabled={false} />
          {isSelected && <Rect x={0} y={0} width={width} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={2} dash={[4,4]} listening={false} perfectDrawEnabled={false} />}
        </>
      ) : isGnd ? (
        <>
          <Line points={[width/2, 0, width/2, height - 10]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
          <Line points={[10, height - 10, width - 10, height - 10]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
          <Line points={[14, height - 5, width - 14, height - 5]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
          <Line points={[18, height, width - 18, height]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
          <Group x={width / 2} y={height + 11} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
            <Text text="GND" x={-width / 2} y={-6} width={width} align="center" fontSize={12} fontFamily="monospace" fill={canvasTheme.textColor} listening={false} />
          </Group>
          <Rect x={0} y={0} width={width} height={height} fill="transparent" perfectDrawEnabled={false} />
          {isSelected && <Rect x={0} y={0} width={width} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={2} dash={[4,4]} listening={false} perfectDrawEnabled={false} />}
        </>
      ) : isOutput ? (
        <>
          {/* Schematic LED Symbol */}
          <Group x={10} y={height/2} listening={false}>
            {/* Input wire */}
            <Line points={[-10, 0, 10, 0]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            
            {/* Diode Triangle (Anode) */}
            <Line points={[10, -10, 10, 10, 25, 0]} closed fill={val === 1 ? indicatorFill : 'transparent'} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            
            {/* Diode Line (Cathode) */}
            <Line points={[25, -10, 25, 10]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            
            {/* Wire to ground symbol */}
            <Line points={[25, 0, 35, 0]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            {/* Ground symbol */}
            <Line points={[35, -8, 35, 8]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            <Line points={[39, -5, 39, 5]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            <Line points={[43, -2, 43, 2]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            
            {/* Light Arrows */}
            <Group opacity={val === 1 ? 1 : 0.3} listening={false}>
              <Line points={[12, -15, 20, -25]} stroke={val === 1 ? indicatorFill : borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
              <Line points={[15, -25, 20, -25, 20, -20]} stroke={val === 1 ? indicatorFill : borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
              
              <Line points={[22, -15, 30, -25]} stroke={val === 1 ? indicatorFill : borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
              <Line points={[25, -25, 30, -25, 30, -20]} stroke={val === 1 ? indicatorFill : borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            </Group>
          </Group>
          <Rect x={0} y={0} width={width} height={height} fill="transparent" perfectDrawEnabled={false} />
          {isSelected && <Rect x={0} y={0} width={width} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={2} dash={[4,4]} listening={false} perfectDrawEnabled={false} />}
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
            cornerRadius={4}
            perfectDrawEnabled={false}
          />
          {isInput && (
            <Group
              x={4}
              y={4}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container && !useSimulatorStore.getState().placingNodeId && !useSimulatorStore.getState().pastingNodeIds) container.style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container && !useSimulatorStore.getState().placingNodeId && !useSimulatorStore.getState().pastingNodeIds) container.style.cursor = 'grab';
              }}
              onClick={(e) => {
                if (!isPlacing) {
                  e.cancelBubble = true;
                  toggleInputNode(node.id);
                }
              }}
            >
              <Rect
                x={0}
                y={0}
                width={width - 8}
                height={height - 8}
                fill={val === 1 ? '#3b82f6' : canvasTheme.nodeBg}
                stroke={canvasTheme.nodeBorder}
                strokeWidth={1}
                cornerRadius={2}
                perfectDrawEnabled={false}
              />
              <Text
                text={val === 1 ? '1' : '0'}
                x={0}
                y={0}
                width={width - 8}
                height={height - 8}
                align="center"
                verticalAlign="middle"
                fontSize={20}
                fontFamily="monospace"
                fontStyle="bold"
                fill={val === 1 ? '#ffffff' : canvasTheme.textColor}
                listening={false}
              />
            </Group>
          )}
          {isClock && (
            <Group x={width / 2} y={height / 2} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
              <Text
                text="CLK"
                x={-width / 2}
                y={-height / 2}
                width={width}
                height={height}
                align="center"
                verticalAlign="middle"
                fontSize={14}
                fontFamily="monospace"
                fontStyle="bold"
                fill={canvasTheme.textColor}
                listening={false}
              />
            </Group>
          )}
        </>
      )}

      {node.properties?.label && !isVcc && !isGnd && (
        <Group x={width / 2} y={-14} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
          <Text
            text={node.properties.label}
            x={-width / 2}
            y={-6}
            width={width}
            align="center"
            fontSize={12}
            fill={canvasTheme.textColor}
            listening={false}
          />
        </Group>
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
      {node.outputs.map((pin) => {
        let px = width;
        let py = height / 2;
        if (isVcc) { px = width / 2; py = height; }
        if (isGnd) { px = width / 2; py = 0; }
        return (
          <Pin
            key={pin.id}
            id={pin.id}
            nodeId={node.id}
            x={px}
            y={py}
            type={pin.type}
          />
        );
      })}
    </SchematicNodeWrapper>
  );
});
