import React from 'react';
import { Rect, Text, Path } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface Props {
  node: LogicNode;
}

const KEY_LABELS = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '*', '0', '#',
];

export const SchematicKeypadNode: React.FC<Props> = React.memo(({ node }) => {
  const updateNodeProperties = useSimulatorStore(state => state.updateNodeProperties);
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  const isPlacing = useSimulatorStore(
    state => state.placingNodeId === node.id || Boolean(state.pastingNodeIds && state.pastingNodeIds.includes(node.id))
  );

  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);
  const pressedKey = typeof node.properties?.pressedKey === 'number' ? node.properties.pressedKey : null;

  const invRot = -(node.properties?.rotation || 0);
  const flipScaleX = node.properties?.flipX ? -1 : 1;
  const flipScaleY = node.properties?.flipY ? -1 : 1;

  // Build combined path for the 4 left row legs + 3 top column legs
  let legsPath = '';
  let matrixGridPath = '';

  for (let r = 0; r < 4; r++) {
    const y = 20 + r * 40;
    legsPath += `M 0 ${y} L -20 ${y} `;
    matrixGridPath += `M 0 ${y} L 100 ${y} `;
  }
  for (let c = 0; c < 3; c++) {
    const x = 20 + c * 40;
    legsPath += `M ${x} 0 L ${x} -20 `;
    matrixGridPath += `M ${x} 0 L ${x} 140 `;
  }

  return (
    <SchematicNodeWrapper
      node={node}
      onMouseLeaveExtra={() => {
        if (pressedKey !== null && !node.properties?.latched) {
          updateNodeProperties(node.id, { pressedKey: null });
        }
      }}
    >
      {/* Keypad Body */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={theme === 'dark' ? '#1e293b' : '#f8fafc'}
        stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={6}
        perfectDrawEnabled={false}
      />

      {/* Pin Extension Legs */}
      <Path
        data={legsPath}
        stroke={canvasTheme.nodeBorder}
        strokeWidth={2}
        perfectDrawEnabled={false}
        listening={false}
      />

      {/* Internal Matrix Row/Col Lines */}
      <Path
        data={matrixGridPath}
        stroke={canvasTheme.nodeBorder}
        strokeWidth={1}
        opacity={0.25}
        perfectDrawEnabled={false}
        listening={false}
      />

      {/* Custom Label */}
      {node.properties?.label && (
        <Text
          text={node.properties.label}
          x={width / 2}
          y={height + 10}
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

      {/* 12 Matrix Keys (4 rows x 3 cols) */}
      {KEY_LABELS.map((label, idx) => {
        const r = Math.floor(idx / 3);
        const c = idx % 3;
        const cx = 20 + c * 40;
        const cy = 20 + r * 40;
        const isActive = pressedKey === idx;

        return (
          <React.Fragment key={label}>
            <Rect
              x={cx - 13}
              y={cy - 13}
              width={26}
              height={26}
              fill={
                isActive
                  ? '#3b82f6'
                  : theme === 'dark'
                  ? '#334155'
                  : '#e2e8f0'
              }
              stroke={isActive ? '#2563eb' : canvasTheme.nodeBorder}
              strokeWidth={isActive ? 2 : 1}
              cornerRadius={4}
              perfectDrawEnabled={false}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container && !isPlacing) container.style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container && !isPlacing) container.style.cursor = 'grab';
                if (isActive && !node.properties?.latched) {
                  updateNodeProperties(node.id, { pressedKey: null });
                }
              }}
              onMouseDown={(e) => {
                if (isPlacing) return;
                e.cancelBubble = true;
                if (e.evt.shiftKey) {
                  // Shift+Click latches/unlatches key so you can step clock while key stays held
                  if (isActive && node.properties?.latched) {
                    updateNodeProperties(node.id, { pressedKey: null, latched: false });
                  } else {
                    updateNodeProperties(node.id, { pressedKey: idx, latched: true });
                  }
                } else {
                  updateNodeProperties(node.id, { pressedKey: idx, latched: false });
                }
              }}
              onMouseUp={(e) => {
                if (isPlacing) return;
                e.cancelBubble = true;
                if (!e.evt.shiftKey && !node.properties?.latched) {
                  updateNodeProperties(node.id, { pressedKey: null });
                }
              }}
              onClick={(e) => {
                if (!isPlacing) {
                  e.cancelBubble = true;
                }
              }}
            />
            <Text
              text={label}
              x={cx}
              y={cy}
              offsetX={13}
              offsetY={6}
              rotation={invRot}
              scaleX={flipScaleX}
              scaleY={flipScaleY}
              width={26}
              align="center"
              fontSize={12}
              fontFamily="monospace"
              fontStyle="bold"
              fill={isActive ? '#ffffff' : canvasTheme.textColor}
              perfectDrawEnabled={false}
              listening={false}
            />
          </React.Fragment>
        );
      })}

      {/* Row Pins (Left: R1..R4) */}
      {node.inputs.slice(0, 4).map((pin, r) => {
        const y = 20 + r * 40;
        return (
          <React.Fragment key={pin.id}>
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={-20}
              y={y}
              type={pin.type}
            />
            <Text
              text={`R${r + 1}`}
              x={-11}
              y={y - 10}
              offsetX={10}
              offsetY={4}
              rotation={invRot}
              scaleX={flipScaleX}
              scaleY={flipScaleY}
              width={20}
              align="center"
              fontSize={8}
              fontFamily="monospace"
              fill={canvasTheme.nodeBorder}
              perfectDrawEnabled={false}
              listening={false}
            />
          </React.Fragment>
        );
      })}

      {/* Column Pins (Top: C1..C3) */}
      {node.inputs.slice(4, 7).map((pin, c) => {
        const x = 20 + c * 40;
        return (
          <React.Fragment key={pin.id}>
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={x}
              y={-20}
              type={pin.type}
            />
            <Text
              text={`C${c + 1}`}
              x={x + 12}
              y={-10}
              offsetX={10}
              offsetY={4}
              rotation={invRot}
              scaleX={flipScaleX}
              scaleY={flipScaleY}
              width={20}
              align="center"
              fontSize={8}
              fontFamily="monospace"
              fill={canvasTheme.nodeBorder}
              perfectDrawEnabled={false}
              listening={false}
            />
          </React.Fragment>
        );
      })}
    </SchematicNodeWrapper>
  );
});
