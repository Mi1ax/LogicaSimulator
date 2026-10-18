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

const SELECTION_DASH = [4, 4];
const LED_INPUT_PTS = [-10, 0, 10, 0];
const LED_ANODE_PTS = [10, -10, 10, 10, 25, 0];
const LED_CATHODE_PTS = [25, -10, 25, 10];
const LED_GND_WIRE_PTS = [25, 0, 35, 0];
const LED_GND1_PTS = [35, -8, 35, 8];
const LED_GND2_PTS = [39, -5, 39, 5];
const LED_GND3_PTS = [43, -2, 43, 2];
const LED_RAY1_PTS = [12, -15, 20, -25];
const LED_RAY1_TIP_PTS = [15, -25, 20, -25, 20, -20];
const LED_RAY2_PTS = [22, -15, 30, -25];
const LED_RAY2_TIP_PTS = [25, -25, 30, -25, 30, -20];
const CLOCK_WAVE_PTS = [-16, 6, -10, 6, -10, -6, 0, -6, 0, 6, 10, 6, 10, -6, 16, -6];

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
  const isPullUp = node.type === 'PULL_UP';
  const isPullDown = node.type === 'PULL_DOWN';

  const val = useSimulatorStore(state => {
    if (isInput) return node.properties?.value === 1 ? 1 : 0;
    if (isOutput) return state.simState.pinStates[node.inputs[0]?.id];
    if (isClock || isPullUp || isPullDown) return state.simState.pinStates[node.outputs[0]?.id];
    if (isVcc) return 1;
    if (isGnd) return 0;
    return undefined;
  });

  const isInputLike = isInput || isClock || isVcc || isGnd || isPullUp || isPullDown;
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
          {isSelected && <Rect x={0} y={0} width={width} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={2} dash={SELECTION_DASH} listening={false} perfectDrawEnabled={false} />}
        </>
      ) : isPullUp ? (
        <>
          {/* T-bar at top + zig-zag resistor down to pin at (width/2, height) */}
          <Line points={[10, 6, width - 10, 6]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
          <Line
            points={[
              width / 2, 6,
              width / 2, 11,
              width / 2 + 5, 13.5,
              width / 2 - 5, 18.5,
              width / 2 + 5, 23.5,
              width / 2 - 5, 28.5,
              width / 2, 31,
              width / 2, height,
            ]}
            stroke={borderStroke}
            strokeWidth={2}
            lineJoin="round"
            listening={false}
            perfectDrawEnabled={false}
          />
          <Group x={width / 2} y={-6} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
            <Text text="VCC" x={-width / 2} y={-6} width={width} align="center" fontSize={11} fontFamily="monospace" fill={canvasTheme.textColor} listening={false} />
          </Group>
          <Rect x={0} y={0} width={width} height={height} fill="transparent" perfectDrawEnabled={false} />
          {isSelected && <Rect x={0} y={0} width={width} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={2} dash={SELECTION_DASH} listening={false} perfectDrawEnabled={false} />}
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
          {isSelected && <Rect x={0} y={0} width={width} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={2} dash={SELECTION_DASH} listening={false} perfectDrawEnabled={false} />}
        </>
      ) : isPullDown ? (
        <>
          {/* Pin at (width/2, 0), zig-zag resistor down to GND bars */}
          <Line
            points={[
              width / 2, 0,
              width / 2, 7,
              width / 2 + 5, 9.5,
              width / 2 - 5, 14.5,
              width / 2 + 5, 19.5,
              width / 2 - 5, 24.5,
              width / 2, 27,
              width / 2, height - 8,
            ]}
            stroke={borderStroke}
            strokeWidth={2}
            lineJoin="round"
            listening={false}
            perfectDrawEnabled={false}
          />
          <Line points={[10, height - 8, width - 10, height - 8]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
          <Line points={[14, height - 4, width - 14, height - 4]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
          <Line points={[18, height, width - 18, height]} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
          <Group x={width / 2} y={height + 11} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
            <Text text="GND" x={-width / 2} y={-6} width={width} align="center" fontSize={11} fontFamily="monospace" fill={canvasTheme.textColor} listening={false} />
          </Group>
          <Rect x={0} y={0} width={width} height={height} fill="transparent" perfectDrawEnabled={false} />
          {isSelected && <Rect x={0} y={0} width={width} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={2} dash={SELECTION_DASH} listening={false} perfectDrawEnabled={false} />}
        </>
      ) : isOutput ? (
        <>
          {/* Schematic LED Symbol */}
          <Group x={10} y={height/2} listening={false}>
            {/* Input wire */}
            <Line points={LED_INPUT_PTS} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            
            {/* Diode Triangle (Anode) */}
            <Line points={LED_ANODE_PTS} closed fill={val === 1 ? indicatorFill : 'transparent'} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            
            {/* Diode Line (Cathode) */}
            <Line points={LED_CATHODE_PTS} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            
            {/* Wire to ground symbol */}
            <Line points={LED_GND_WIRE_PTS} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            {/* Ground symbol */}
            <Line points={LED_GND1_PTS} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            <Line points={LED_GND2_PTS} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            <Line points={LED_GND3_PTS} stroke={borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            
            {/* Light Arrows */}
            <Group opacity={val === 1 ? 1 : 0.3} listening={false}>
              <Line points={LED_RAY1_PTS} stroke={val === 1 ? indicatorFill : borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
              <Line points={LED_RAY1_TIP_PTS} stroke={val === 1 ? indicatorFill : borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
              
              <Line points={LED_RAY2_PTS} stroke={val === 1 ? indicatorFill : borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
              <Line points={LED_RAY2_TIP_PTS} stroke={val === 1 ? indicatorFill : borderStroke} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
            </Group>
          </Group>
          <Rect x={0} y={0} width={width} height={height} fill="transparent" perfectDrawEnabled={false} />
          {isSelected && <Rect x={0} y={0} width={width} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={2} dash={SELECTION_DASH} listening={false} perfectDrawEnabled={false} />}
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
            <Group
              x={4}
              y={4}
              onMouseEnter={(e) => {
                const st = useSimulatorStore.getState();
                if (!st.simRunning || node.properties?.mode !== 'manual') return;
                const container = e.target.getStage()?.container();
                if (container && !st.placingNodeId && !st.pastingNodeIds) container.style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const st = useSimulatorStore.getState();
                if (!st.simRunning || node.properties?.mode !== 'manual') return;
                const container = e.target.getStage()?.container();
                if (container && !st.placingNodeId && !st.pastingNodeIds) container.style.cursor = 'grab';
              }}
              onClick={(e) => {
                const st = useSimulatorStore.getState();
                if (!isPlacing && st.simRunning && node.properties?.mode === 'manual') {
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
              {/* Square-wave (meander) symbol, kept upright under rotation/flip */}
              <Group
                x={(width - 8) / 2}
                y={(height - 8) / 2}
                rotation={-(node.properties?.rotation || 0)}
                scaleX={node.properties?.flipX ? -1 : 1}
                scaleY={node.properties?.flipY ? -1 : 1}
                listening={false}
              >
                <Line
                  points={CLOCK_WAVE_PTS}
                  stroke={val === 1 ? '#ffffff' : canvasTheme.textColor}
                  strokeWidth={2}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                  perfectDrawEnabled={false}
                />
                {node.properties?.mode === 'manual' && (
                  <Text
                    text="M"
                    x={12}
                    y={2}
                    fontSize={8}
                    fontFamily="monospace"
                    fontStyle="bold"
                    fill={val === 1 ? '#ffffff' : canvasTheme.textColor}
                    listening={false}
                  />
                )}
              </Group>
            </Group>
          )}
        </>
      )}

      {node.properties?.label && !isVcc && !isGnd && !isPullUp && !isPullDown && (
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
      {!isClock && node.inputs.map((pin) => (
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
        if (isVcc || isPullUp) { px = width / 2; py = height; }
        if (isGnd || isPullDown) { px = width / 2; py = 0; }
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
