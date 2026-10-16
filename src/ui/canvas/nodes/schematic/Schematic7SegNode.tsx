import React from 'react';
import { Group, Rect, Path, Text, Circle } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface Props {
  node: LogicNode;
}

export const Schematic7SegNode: React.FC<Props> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isLowDetail = useSimulatorStore(state => state.schematicScale < 0.55);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  
  const segMask = useSimulatorStore(state => {
    const activeLevel = node.properties?.commonAnode ? 0 : 1;
    const pinStates = state.simState.pinStates;
    let mask = 0;
    for (let i = 0; i < node.inputs.length; i++) {
      if (pinStates[node.inputs[i].id] === activeLevel) {
        mask |= 1 << i;
      }
    }
    return mask;
  });
  const a = (segMask & 1) !== 0 ? 1 : 0;
  const b = (segMask & 2) !== 0 ? 1 : 0;
  const c = (segMask & 4) !== 0 ? 1 : 0;
  const d = (segMask & 8) !== 0 ? 1 : 0;
  const e = (segMask & 16) !== 0 ? 1 : 0;
  const f = (segMask & 32) !== 0 ? 1 : 0;
  const g = (segMask & 64) !== 0 ? 1 : 0;
  const dp = (segMask & 128) !== 0 ? 1 : 0;

  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  
  const pins = node.inputs;

  const activeColor = '#ef4444'; // Red
  const inactiveColor = theme === 'dark' ? '#451a1a' : '#fecaca';

  // Apply a slant (skew) to the segment rendering
  const slant = 10;
  
  const renderSeg = (points: number[], active: boolean) => (
    <Path
      data={`M ${points[0] + (100 - points[1]) / 100 * slant} ${points[1]} L ${points[2] + (100 - points[3]) / 100 * slant} ${points[3]} L ${points[4] + (100 - points[5]) / 100 * slant} ${points[5]} L ${points[6] + (100 - points[7]) / 100 * slant} ${points[7]} L ${points[8] + (100 - points[9]) / 100 * slant} ${points[9]} L ${points[10] + (100 - points[11]) / 100 * slant} ${points[11]} Z`}
      fill={active ? activeColor : inactiveColor}
      perfectDrawEnabled={false}
      listening={false}
      shadowForStrokeEnabled={false}
    />
  );

  const dx = 28;
  const dy = 25;

  return (
    <SchematicNodeWrapper node={node}>
      {/* Body */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={theme === 'dark' ? '#0f172a' : '#f1f5f9'}
        stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={4}
        perfectDrawEnabled={false}
      />

      <Rect
        x={10}
        y={15}
        width={width - 20}
        height={height - 30}
        fill={theme === 'dark' ? '#000000' : '#ffffff'}
        cornerRadius={2}
        perfectDrawEnabled={false}
        listening={false}
      />

      {/* Segments Display Area */}
      <Group x={dx} y={dy} listening={false}>
        {/* A */}
        {renderSeg([8,0, 24,0, 28,4, 24,8, 8,8, 4,4], a === 1)}
        {/* B */}
        {renderSeg([28,6, 32,10, 32,28, 28,32, 24,28, 24,10], b === 1)}
        {/* C */}
        {renderSeg([28,36, 32,40, 32,58, 28,62, 24,58, 24,40], c === 1)}
        {/* D */}
        {renderSeg([8,60, 24,60, 28,64, 24,68, 8,68, 4,64], d === 1)}
        {/* E */}
        {renderSeg([4,36, 8,40, 8,58, 4,62, 0,58, 0,40], e === 1)}
        {/* F */}
        {renderSeg([4,6, 8,10, 8,28, 4,32, 0,28, 0,10], f === 1)}
        {/* G */}
        {renderSeg([8,30, 24,30, 28,34, 24,38, 8,38, 4,34], g === 1)}
        
        {/* DP */}
        <Circle
          x={38}
          y={64}
          radius={4}
          fill={dp === 1 ? activeColor : inactiveColor}
          perfectDrawEnabled={false}
          listening={false}
        />
      </Group>

      {/* Render Pins */}
      {pins.map((pin, i) => {
        const isTop = i < 4;
        const col = isTop ? i : i - 4;
        const xOffset = 20 + col * 20;
        const yOffset = isTop ? 0 : height;
        return (
          <Group key={pin.id}>
            <Path
              data={`M ${xOffset} ${isTop ? 0 : height} L ${xOffset} ${isTop ? 10 : height - 10}`}
              stroke={canvasTheme.nodeBorder}
              strokeWidth={2}
              perfectDrawEnabled={false}
              listening={false}
            />
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={xOffset}
              y={yOffset}
              type={pin.type}
            />
            {!isLowDetail && (
              <Group x={xOffset} y={isTop ? 16 : height - 16} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
                <Text
                  text={pin.name}
                  x={-10}
                  y={-4}
                  width={20}
                  align="center"
                  fontSize={8}
                  fill={canvasTheme.textColor}
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
