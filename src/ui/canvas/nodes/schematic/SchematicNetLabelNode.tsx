import React from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getSchematicDimensions, getSchematicAnchor } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';

interface NetLabelProps {
  node: LogicNode;
}

export const SchematicNetLabelNode: React.FC<NetLabelProps> = React.memo(({ node }) => {
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

  
  const pin = node.inputs[0] || node.outputs[0];

  
  const isInputSide = node.type === 'SUB_OUT' || (node.type === 'SUB_IO' && node.properties?.flipX);
  const name = String(node.properties?.label || (node.type === 'SUB_IN' ? 'IN' : node.type === 'SUB_OUT' ? 'OUT' : node.type === 'SUB_IO' ? 'I/O' : 'NET'));

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
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          e.cancelBubble = true;
          store.finishPlacingNode();
          return;
        }
        select({ type: 'node', id: node.id }, e.evt.shiftKey);
        
        if (node.type === 'SUB_IN') {
          e.cancelBubble = true;
          const currentValue = node.properties?.value === 1 ? 1 : 0;
          store.updateNodeProperties(node.id, { value: currentValue === 1 ? 0 : 1 });
        } else if (node.type === 'SUB_IO') {
          e.cancelBubble = true;
          let nextValue: any = undefined;
          if (node.properties?.value === undefined) nextValue = 0;
          else if (node.properties?.value === 0) nextValue = 1;
          else if (node.properties?.value === 1) nextValue = undefined;
          store.updateNodeProperties(node.id, { value: nextValue });
        }
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
        if (container && !useSimulatorStore.getState().placingNodeId) {
          container.style.cursor = (node.type === 'SUB_IN' || node.type === 'SUB_IO') ? 'pointer' : 'grab';
        }
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
      }}
    >
      <Rect x={0} y={15} width={width} height={10} fill="transparent" />
      <Line points={isInputSide ? [0, height / 2, 10, height / 2] : [width - 10, height / 2, width, height / 2]} stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder} strokeWidth={2} />
      
      {/* Remove scaleX flipping on the text group to prevent weird offsets. We'll just manage alignment and position manually. */}
      {/* Wait, the main Group already flips. If we don't reverse it, the text will be mirrored! */}
      {/* To reverse it without offset issues, we pivot around the center of the text area. */}
      <Group 
        x={isInputSide ? (width + 10) / 2 : (width - 10) / 2} 
        y={height / 2} 
        scaleX={node.properties?.flipX ? -1 : 1} 
        scaleY={node.properties?.flipY ? -1 : 1}
      >
        <Text 
          x={-(width - 10) / 2}
          y={-10}
          width={width - 10} 
          height={20}
          text={name} 
          align={node.properties?.flipX ? (isInputSide ? 'right' : 'left') : (isInputSide ? 'left' : 'right')}
          verticalAlign="middle"
          fontSize={10}
          fontFamily="sans-serif"
          fontStyle={node.type.startsWith('SUB_') ? 'bold' : 'normal'}
          fill={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.textColor}
        />
      </Group>
      
      {isSelected && <Rect x={isInputSide ? 10 : 0} y={12} width={width - 10} height={16} stroke={canvasTheme.selectedNodeColor} strokeWidth={1} dash={[2,2]} />}
      
      {pin && (
        <Pin
          id={pin.id}
          nodeId={node.id}
          x={isInputSide ? 0 : width}
          y={height / 2}
          type={pin.type}
        />
      )}
    </Group>
  );
});
