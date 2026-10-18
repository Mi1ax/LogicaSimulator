import React, { useMemo } from 'react';
import { Group, Rect, Text, Path } from 'react-konva';
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

const SELECTION_DASH = [2, 2];

export const SchematicBusNode: React.FC<BusProps> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isLowDetail = useSimulatorStore(state => state.schematicScale < 0.55);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  const canvasTheme = getCanvasTheme(theme === 'dark');
  
  const { width, height } = getSchematicDimensions(node);

  const { pinLayouts, leftLegsPath, rightAndBackbonePath } = useMemo(() => {
    const def = getNodeDefinition(node.type);
    const generatedPins = def?.generatePins ? def.generatePins(node.properties || {}) : [];
    const pinDefMap = new Map(generatedPins.map(cp => [cp.name, cp]));
    const uniquePins = Array.from(new Map([...node.inputs, ...node.outputs].map(p => [p.id, p])).values());

    let leftPath = '';
    let thickPath = `M ${width} 20 L ${width} ${height - 20} `;

    const layouts = uniquePins.map(pin => {
      const pinDef = pinDefMap.get(pin.name || '');
      const row = pinDef?.schematicRow || 1;
      const side = pinDef?.schematicSide || 'left';
      const pinY = row * 20;
      const pinX = side === 'left' ? -20 : side === 'right' ? width + 20 : 0;

      if (side === 'left') {
        leftPath += `M ${pinX} ${pinY} L ${width} ${pinY} `;
      } else {
        thickPath += `M ${width} ${pinY} L ${pinX} ${pinY} `;
      }

      return { pin, side, pinX, pinY };
    });

    return { pinLayouts: layouts, leftLegsPath: leftPath, rightAndBackbonePath: thickPath };
  }, [node.type, node.properties, node.inputs, node.outputs, width, height]);

  const label = node.properties?.label || 'DB[7..0]';

  return (
    <SchematicNodeWrapper node={node}>
      <Rect x={0} y={0} width={width} height={height} fill="transparent" perfectDrawEnabled={false} />
      
      {/* Bus backbone + thick right leg */}
      <Path data={rightAndBackbonePath} stroke={canvasTheme.nodeBorder} strokeWidth={4} listening={false} perfectDrawEnabled={false} />
      {/* Thin left bit legs */}
      {leftLegsPath && (
        <Path data={leftLegsPath} stroke={canvasTheme.nodeBorder} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
      )}
      
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

      {isSelected && <Rect x={-5} y={0} width={width + 10} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={1} dash={SELECTION_DASH} listening={false} perfectDrawEnabled={false} />}
      
      {pinLayouts.map(({ pin, side, pinX, pinY }) => (
        <React.Fragment key={pin.id}>
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
      ))}
    </SchematicNodeWrapper>
  );
});
