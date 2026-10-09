import React from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getSchematicDimensions, getSchematicAnchor } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { getNodeDefinition } from '../../../../core/engine/nodes';

interface BusProps {
  node: LogicNode;
}

export const SchematicBusNode: React.FC<BusProps> = React.memo(({ node }) => {
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

  const def = getNodeDefinition(node.type);
  const generatedPins = def?.generatePins ? def.generatePins(node.properties || {}) : [];
  
  // Use unique bidir pins
  const pins = Array.from(new Map([...node.inputs, ...node.outputs].map(p => [p.id, p])).values());

  const label = node.properties?.label || 'DB[7..0]';

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
        updateNodePosition(node.id, localX, localY, true);
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
      <Rect x={0} y={0} width={width} height={height} fill="transparent" />
      
      {/* Bus backbone line */}
      <Line points={[width, 20, width, height - 20]} stroke={canvasTheme.nodeBorder} strokeWidth={4} />
      
      {/* Label for the bus */}
      <Group x={width / 2} y={-10} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1}>
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
        />
      </Group>

      {isSelected && <Rect x={-5} y={0} width={width + 10} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={1} dash={[2,2]} />}
      
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
            />
            {side === 'left' && (
              <Group x={pinX + 10} y={pinY - 9} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1}>
                <Text 
                  x={-6}
                  y={-5}
                  text={pin.name} 
                  fontSize={10} 
                  fontFamily="sans-serif"
                  fill={canvasTheme.textColor}
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
    </Group>
  );
});
