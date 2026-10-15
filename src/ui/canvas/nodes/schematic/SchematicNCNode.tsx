import React from 'react';
import { Line } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { Pin } from '../../primitives/Pin';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getCanvasTheme } from '../../theme';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface NCNodeProps {
  node: LogicNode;
}

export const SchematicNCNode: React.FC<NCNodeProps> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  const inPin = node.inputs[0];
  const pinState = useSimulatorStore(state => inPin ? state.simState.pinStates[inPin.id] : undefined);
  
  const canvasTheme = getCanvasTheme(theme === 'dark');

  const size = 12; // Smaller size
  const half = size / 2;
  
  let strokeColor = isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder;
  if (!isSelected) {
    if (pinState === 1) strokeColor = canvasTheme.signalHigh;
    else if (pinState === 0) strokeColor = canvasTheme.signalLow;
    else if (pinState === 'X') strokeColor = '#ef4444';
  }

  return (
    <SchematicNodeWrapper node={node}>
      {/* Invisible hit area for dragging */}
      <Line points={[-10, -10, 10, -10, 10, 10, -10, 10]} fill="transparent" closed perfectDrawEnabled={false} />
      
      {/* The X symbol centered exactly on the pin (0, 0) */}
      <Line points={[-half, -half, half, half]} stroke={strokeColor} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
      <Line points={[-half, half, half, -half]} stroke={strokeColor} strokeWidth={2} listening={false} perfectDrawEnabled={false} />
      
      {node.inputs.map((pin) => (
        <Pin key={pin.id} id={pin.id} nodeId={node.id} x={0} y={0} type={pin.type} opacity={0} />
      ))}
    </SchematicNodeWrapper>
  );
});
