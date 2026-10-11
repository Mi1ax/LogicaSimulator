import { LogicNode, Wire } from '../models/types';
import { getSchematicPinPosition } from '../utils/schematicLayout';

export interface Point { x: number; y: number; nx?: number; ny?: number }


const wireCache = new Map<string, { path: string; points: { x: number; y: number }[]; hash: string }>();

export const computeAllWirePaths = (
  wires: Wire[],
  nodes: LogicNode[],
  draftWire?: { start: Point; end: Point; waypoints?: { x: number; y: number }[] }
) => {
  const wirePaths = new Map<string, { path: string; points: { x: number; y: number }[] }>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Clean up cache for deleted wires
  const wireIds = new Set(wires.map(w => w.id));
  for (const id of wireCache.keys()) {
    if (!wireIds.has(id)) {
      wireCache.delete(id);
    }
  }

  wires.forEach(wire => {
    const sourceNode = nodeMap.get(wire.sourceNodeId);
    const targetNode = nodeMap.get(wire.targetNodeId);
    if (!sourceNode || !targetNode) return;

    const hash = `${sourceNode.x}:${sourceNode.y}:${targetNode.x}:${targetNode.y}:${JSON.stringify(wire.waypoints || [])}`;
    const cached = wireCache.get(wire.id);
    
    if (cached && cached.hash === hash) {
      wirePaths.set(wire.id, { path: cached.path, points: cached.points });
      return;
    }


    const start = getSchematicPinPosition(sourceNode, wire.sourcePinId);
    const end = getSchematicPinPosition(targetNode, wire.targetPinId);

    const points = [{ x: start.x, y: start.y }];
    
    let path = `M ${start.x} ${start.y}`;
    if (wire.waypoints && wire.waypoints.length > 0) {
      wire.waypoints.forEach(wp => {
        path += ` L ${wp.x} ${wp.y}`;
        points.push({ x: wp.x, y: wp.y });
      });
    }
    path += ` L ${end.x} ${end.y}`;
    points.push({ x: end.x, y: end.y });

    wireCache.set(wire.id, { path, points, hash });
    wirePaths.set(wire.id, { path, points });
  });

  let draftWirePath = '';
  if (draftWire) {
    draftWirePath = `M ${draftWire.start.x} ${draftWire.start.y}`;
    if (draftWire.waypoints && draftWire.waypoints.length > 0) {
      draftWire.waypoints.forEach(wp => {
        draftWirePath += ` L ${wp.x} ${wp.y}`;
      });
    }
    draftWirePath += ` L ${draftWire.end.x} ${draftWire.end.y}`;
  }

  return { wirePaths, draftWirePath };
};
