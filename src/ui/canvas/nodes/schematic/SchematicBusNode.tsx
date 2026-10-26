import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { Group, Rect, Text, Path } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore, isIdSelected } from '../../../../store/useSimulatorStore';
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
  const isSelected = useSimulatorStore(state => isIdSelected(state, node.id));
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
  const staticGroupRef = useRef<any>(null);
  const hitRectRef = useRef<any>(null);
  const invRot = -(node.properties?.rotation || 0);
  const flipScaleX = node.properties?.flipX ? -1 : 1;
  const flipScaleY = node.properties?.flipY ? -1 : 1;

  useLayoutEffect(() => {
    const r = hitRectRef.current;
    if (r && !r._logicaHitOnly) {
      r._logicaHitOnly = true;
      r.drawScene = function () {
        return this;
      };
    }
  }, []);

  useLayoutEffect(() => {
    const grp = staticGroupRef.current;
    if (!grp || width <= 0 || height <= 0) return;
    try {
      grp.cache({
        x: -30,
        y: -36,
        width: width + 60,
        height: height + 48,
        pixelRatio: 2,
      });
    } catch {
      // Fallback to uncached rendering
    }
  }, [width, height, theme, invRot, flipScaleX, flipScaleY, label, pinLayouts.length]);

  return (
    <SchematicNodeWrapper node={node}>
      <Rect ref={hitRectRef} x={0} y={0} width={width} height={height} fill="#000000" strokeEnabled={false} perfectDrawEnabled={false} />

      <Group ref={staticGroupRef} listening={false}>
        {/* Bus backbone + thick right leg */}
        <Path data={rightAndBackbonePath} stroke={canvasTheme.nodeBorder} strokeWidth={4} listening={false} perfectDrawEnabled={false} />
        {/* Thin left bit legs */}
        {leftLegsPath && (
          <Path data={leftLegsPath} stroke={canvasTheme.nodeBorder} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
        )}
        
        {/* Label for the bus */}
        <Group x={width / 2} y={-10} rotation={invRot} scaleX={flipScaleX} scaleY={flipScaleY} listening={false}>
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
            fill={canvasTheme.textColor}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>

        {pinLayouts.map(({ pin, side, pinX, pinY }) =>
          side === 'left' ? (
            <Group key={`lbl-${pin.id}`} x={pinX + 10} y={pinY - 9} rotation={invRot} scaleX={flipScaleX} scaleY={flipScaleY} listening={false}>
              <Text 
                x={-6}
                y={-5}
                text={pin.name} 
                fontSize={10} 
                fontFamily="sans-serif"
                fill={canvasTheme.textColor}
                listening={false}
                perfectDrawEnabled={false}
              />
            </Group>
          ) : null
        )}
      </Group>

      {isSelected && <Rect x={-5} y={0} width={width + 10} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={1} dash={SELECTION_DASH} listening={false} perfectDrawEnabled={false} />}
      
      {pinLayouts.map(({ pin, pinX, pinY }) => (
        <Pin
          key={pin.id}
          id={pin.id}
          nodeId={node.id}
          x={pinX}
          y={pinY}
          type={pin.type}
        />
      ))}
    </SchematicNodeWrapper>
  );
});
