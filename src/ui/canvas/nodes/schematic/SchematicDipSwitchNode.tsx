import React from 'react';
import { Group, Rect, Text, Path } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { Pin } from '../../primitives/Pin';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface Props {
  node: LogicNode;
}

export const SchematicDipSwitchNode: React.FC<Props> = React.memo(({ node }) => {
  const updateNodeProperties = useSimulatorStore(state => state.updateNodeProperties);
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  
  const canvasTheme = getCanvasTheme(theme === 'dark');
  const { width, height } = getSchematicDimensions(node);

  const numSwitches = node.outputs.length || 4;
  let switches = node.properties?.switches || [];
  if (switches.length < numSwitches) {
    switches = [...switches, ...Array(numSwitches - switches.length).fill(0)];
  }

  return (
    <SchematicNodeWrapper node={node}>
      {/* Switch Body */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#dc2626" // Red DIP switch color
        stroke={isSelected ? canvasTheme.selectedNodeColor : "#b91c1c"}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={4}
        perfectDrawEnabled={false}
      />

      {/* Label */}
      <Group x={width / 2} y={9} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
        <Text
          text="ON"
          x={-width / 2}
          y={-5}
          width={width}
          align="center"
          fontSize={10}
          fontFamily="monospace"
          fontStyle="bold"
          fill="#ffffff"
          listening={false}
        />
      </Group>

      {/* Render Switches */}
      {node.outputs.map((pin, i) => {
        const isOn = switches[i] === 1;
        const yOffset = 20 + i * 20;
        
        return (
          <Group key={pin.id}>
            {/* Switch Slot */}
            <Rect
              x={15}
              y={yOffset - 6}
              width={50}
              height={12}
              fill="#7f1d1d"
              cornerRadius={2}
              perfectDrawEnabled={false}
              listening={false}
            />
            {/* Slider */}
            <Rect
              x={isOn ? 15 : 45}
              y={yOffset - 6}
              width={20}
              height={12}
              fill="#ffffff"
              cornerRadius={2}
              perfectDrawEnabled={false}
              onClick={(e) => {
                e.cancelBubble = true;
                const newSwitches = [...switches];
                newSwitches[i] = isOn ? 0 : 1;
                updateNodeProperties(node.id, { switches: newSwitches });
              }}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'grab';
              }}
            />
            {/* Number Label */}
            <Group x={10} y={yOffset} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
              <Text
                text={String(i + 1)}
                x={-5}
                y={-5}
                fontSize={10}
                fill="#ffffff"
                listening={false}
              />
            </Group>
            
            {/* Pin Extension Leg */}
            <Path
              data={`M ${width} ${yOffset} L ${width + 20} ${yOffset}`}
              stroke={canvasTheme.nodeBorder}
              strokeWidth={2}
              perfectDrawEnabled={false}
              listening={false}
            />
            {/* The actual connection pin */}
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={width + 20}
              y={yOffset}
              type={pin.type}
            />
          </Group>
        );
      })}
    </SchematicNodeWrapper>
  );
});
