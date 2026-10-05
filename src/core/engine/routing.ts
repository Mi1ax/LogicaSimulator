import { LogicNode, Wire } from '../models/types';
import { getSchematicPinPosition } from '../utils/schematicLayout';

export interface Point { x: number; y: number; nx?: number; ny?: number }

export const computeAllWirePaths = (wires: Wire[], nodes: LogicNode[], draftWire?: {start: Point, end: Point}) => {
  const wirePaths = new Map<string, string>();

  wires.forEach(wire => {
    const sourceNode = nodes.find(n => n.id === wire.sourceNodeId);
    const targetNode = nodes.find(n => n.id === wire.targetNodeId);
    if (!sourceNode || !targetNode) return;

    const start = getSchematicPinPosition(sourceNode, wire.sourcePinId);
    const end = getSchematicPinPosition(targetNode, wire.targetPinId);

    // Completely straight line
    wirePaths.set(wire.id, `M ${start.x} ${start.y} L ${end.x} ${end.y}`);
  });

  const draftWirePath = draftWire ? `M ${draftWire.start.x} ${draftWire.start.y} L ${draftWire.end.x} ${draftWire.end.y}` : '';
  
  return { wirePaths, draftWirePath };
};
