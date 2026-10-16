import React from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { getNodeDefinition } from '../../../../core/engine/nodes';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface BusProps {
  node: LogicNode;
}

export const SchematicBusNode: React.FC<BusProps> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isLowDetail = useSimulatorStore(state => state.schematicScale < 0.55);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  const canvasTheme = getCanvasTheme(theme === 'dark');
  
  const { width, height } = getSchematicDimensions(node);

  const def = getNodeDefinition(node.type);
  const generatedPins = def?.generatePins ? def.generatePins(node.properties || {}) : [];
  
  // Use unique bidir pins
  const pins = Array.from(new Map([...node.inputs, ...node.outputs].map(p => [p.id, p])).values());

  const label = node.properties?.label || 'DB[7..0]';

  return (
    <SchematicNodeWrapper node={node}>
      <Rect x={0} y={0} width={width} height={height} fill="transparent" perfectDrawEnabled={false} />
      
      {/* Bus backbone line */}
      <Line points={[width, 20, width, height - 20]} stroke={canvasTheme.nodeBorder} strokeWidth={4} listening={false} perfectDrawEnabled={false} />
      
      {/* Label for the bus */}
      <Group x={width / 2} y={-10} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
        <Text 
          x={-100}
          y={-14}
          width={200}
          text={label} 
          align="center"
          verticalAlign="bottom"
          fontSize={14} 
          fontFamily="sans-serif"
          fontStyle="bold"
          fill={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.textColor}
          listening={false}
        />
      </Group>

      {isSelected && <Rect x={-5} y={0} width={width + 10} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={1} dash={[2,2]} listening={false} perfectDrawEnabled={false} />}
      
      {pins.map(pin => {
        const pinDef = generatedPins.find(cp => cp.name === pin.name);
        const row = pinDef?.schematicRow || 1;
        const side = pinDef?.schematicSide || 'left';
        
        let pinX = 0;
        let pinY = row * 20;
        
        if (side === 'left') {
          pinX = -20;
        } else if (side === 'right') {
          pinX = width + 20;
        }

        return (
          <React.Fragment key={pin.id}>
            <Line 
              points={[side === 'left' ? pinX : width, pinY, side === 'left' ? width : pinX, pinY]} 
              stroke={canvasTheme.nodeBorder} 
              strokeWidth={side === 'right' ? 4 : 2} 
              listening={false}
              perfectDrawEnabled={false}
            />
            {!isLowDetail && side === 'left' && (
              <Group x={pinX + 10} y={pinY - 9} rotation={-(node.properties?.rotation || 0)} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1} listening={false}>
                <Text 
                  x={-6}
                  y={-5}
                  text={pin.name} 
                  fontSize={10} 
                  fontFamily="sans-serif"
                  fill={canvasTheme.textColor}
                  listening={false}
                />
              </Group>
            )}
            <Pin
              id={pin.id}
              nodeId={node.id}
              x={pinX}
              y={pinY}
              type={pin.type}
            />
          </React.Fragment>
        );
      })}
    </SchematicNodeWrapper>
  );
});
