import React, { useMemo } from 'react';
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

const SLANT = 10;
const buildSegPath = (points: number[]) =>
  `M ${points[0] + ((100 - points[1]) / 100) * SLANT} ${points[1]} L ${points[2] + ((100 - points[3]) / 100) * SLANT} ${points[3]} L ${points[4] + ((100 - points[5]) / 100) * SLANT} ${points[5]} L ${points[6] + ((100 - points[7]) / 100) * SLANT} ${points[7]} L ${points[8] + ((100 - points[9]) / 100) * SLANT} ${points[9]} L ${points[10] + ((100 - points[11]) / 100) * SLANT} ${points[11]} Z`;

const SEG_PATHS = {
  a: buildSegPath([8, 0, 24, 0, 28, 4, 24, 8, 8, 8, 4, 4]),
  b: buildSegPath([28, 6, 32, 10, 32, 28, 28, 32, 24, 28, 24, 10]),
  c: buildSegPath([28, 36, 32, 40, 32, 58, 28, 62, 24, 58, 24, 40]),
  d: buildSegPath([8, 60, 24, 60, 28, 64, 24, 68, 8, 68, 4, 64]),
  e: buildSegPath([4, 36, 8, 40, 8, 58, 4, 62, 0, 58, 0, 40]),
  f: buildSegPath([4, 6, 8, 10, 8, 28, 4, 32, 0, 28, 0, 10]),
  g: buildSegPath([8, 30, 24, 30, 28, 34, 24, 38, 8, 38, 4, 34]),
};

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
  const a = (segMask & 1) !== 0;
  const b = (segMask & 2) !== 0;
  const c = (segMask & 4) !== 0;
  const d = (segMask & 8) !== 0;
  const e = (segMask & 16) !== 0;
  const f = (segMask & 32) !== 0;
  const g = (segMask & 64) !== 0;
  const dp = (segMask & 128) !== 0;

  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  
  const pins = node.inputs;

  const activeColor = '#ef4444'; // Red
  const inactiveColor = theme === 'dark' ? '#451a1a' : '#fecaca';

  const legsPath = useMemo(() => {
    let dStr = '';
    for (let i = 0; i < pins.length; i++) {
      const isTop = i < 4;
      const col = isTop ? i : i - 4;
      const xOffset = 20 + col * 20;
      dStr += `M ${xOffset} ${isTop ? 0 : height} L ${xOffset} ${isTop ? 10 : height - 10} `;
    }
    return dStr;
  }, [pins.length, height]);

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
        <Path data={SEG_PATHS.a} fill={a ? activeColor : inactiveColor} perfectDrawEnabled={false} listening={false} shadowForStrokeEnabled={false} />
        <Path data={SEG_PATHS.b} fill={b ? activeColor : inactiveColor} perfectDrawEnabled={false} listening={false} shadowForStrokeEnabled={false} />
        <Path data={SEG_PATHS.c} fill={c ? activeColor : inactiveColor} perfectDrawEnabled={false} listening={false} shadowForStrokeEnabled={false} />
        <Path data={SEG_PATHS.d} fill={d ? activeColor : inactiveColor} perfectDrawEnabled={false} listening={false} shadowForStrokeEnabled={false} />
        <Path data={SEG_PATHS.e} fill={e ? activeColor : inactiveColor} perfectDrawEnabled={false} listening={false} shadowForStrokeEnabled={false} />
        <Path data={SEG_PATHS.f} fill={f ? activeColor : inactiveColor} perfectDrawEnabled={false} listening={false} shadowForStrokeEnabled={false} />
        <Path data={SEG_PATHS.g} fill={g ? activeColor : inactiveColor} perfectDrawEnabled={false} listening={false} shadowForStrokeEnabled={false} />
        
        {/* DP */}
        <Circle
          x={38}
          y={64}
          radius={4}
          fill={dp ? activeColor : inactiveColor}
          perfectDrawEnabled={false}
          listening={false}
        />
      </Group>

      {/* Combined Pin Legs */}
      <Path
        data={legsPath}
        stroke={canvasTheme.nodeBorder}
        strokeWidth={2}
        perfectDrawEnabled={false}
        listening={false}
      />

      {/* Render Pins */}
      {pins.map((pin, i) => {
        const isTop = i < 4;
        const col = isTop ? i : i - 4;
        const xOffset = 20 + col * 20;
        const yOffset = isTop ? 0 : height;
        return (
          <Group key={pin.id}>
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
