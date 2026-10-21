import { LogicNode, Wire } from '../models/types';
import { getSchematicPinPosition } from '../utils/schematicLayout';

export interface Point { x: number; y: number; nx?: number; ny?: number }

export const computeManhattanElbow = (
  start: { x: number; y: number; nx?: number; ny?: number },
  end: { x: number; y: number }
): { x: number; y: number } | null => {
  if (start.x === end.x || start.y === end.y) return null;
  if (start.nx !== undefined && start.nx !== 0 && !start.ny) {
    return { x: end.x, y: start.y };
  }
  if (start.ny !== undefined && start.ny !== 0 && !start.nx) {
    return { x: start.x, y: end.y };
  }
  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    return { x: end.x, y: start.y };
  }
  return { x: start.x, y: end.y };
};

export interface WirePathEntry {
  path: string;
  points: { x: number; y: number }[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  hash: string;
  waypointsRef: { x: number; y: number }[] | undefined;
}

const wireCache = new Map<string, WirePathEntry>();

export const computeDraftWirePath = (draftWire: {
  start: Point;
  end: Point;
  waypoints?: { x: number; y: number }[];
  manhattan?: boolean;
}): string => {
  let draftWirePath = `M ${draftWire.start.x} ${draftWire.start.y}`;
  let lastPt: Point = draftWire.start;
  if (draftWire.waypoints && draftWire.waypoints.length > 0) {
    for (let i = 0; i < draftWire.waypoints.length; i++) {
      const wp = draftWire.waypoints[i];
      draftWirePath += ` L ${wp.x} ${wp.y}`;
      lastPt = wp;
    }
  }
  if (draftWire.manhattan) {
    const elbow = computeManhattanElbow(lastPt, draftWire.end);
    if (elbow) {
      draftWirePath += ` L ${elbow.x} ${elbow.y}`;
    }
  }
  draftWirePath += ` L ${draftWire.end.x} ${draftWire.end.y}`;
  return draftWirePath;
};

let lastCleanedWiresRef: Wire[] | null = null;

export const computeAllWirePaths = (
  wires: Wire[],
  nodes: LogicNode[]
) => {
  const wirePaths = new Map<string, WirePathEntry>();

  if (wires.length > 0) {
    const nodeMap = new Map<string, LogicNode>();
    for (let i = 0; i < nodes.length; i++) {
      nodeMap.set(nodes[i].id, nodes[i]);
    }

    // Clean up cache for deleted wires only when the wires array reference changes
    if (wires !== lastCleanedWiresRef) {
      lastCleanedWiresRef = wires;
      if (wireCache.size > wires.length) {
        const wireIds = new Set<string>();
        for (let i = 0; i < wires.length; i++) {
          wireIds.add(wires[i].id);
        }
        for (const id of wireCache.keys()) {
          if (!wireIds.has(id)) {
            wireCache.delete(id);
          }
        }
      }
    }

    for (let i = 0; i < wires.length; i++) {
      const wire = wires[i];
      const sourceNode = nodeMap.get(wire.sourceNodeId);
      const targetNode = nodeMap.get(wire.targetNodeId);
      if (!sourceNode || !targetNode) continue;

      const sProps = sourceNode.properties;
      const tProps = targetNode.properties;
      const hash = `${sourceNode.x}:${sourceNode.y}:${sProps?.rotation || 0}:${!!sProps?.flipX}:${!!sProps?.flipY}:${targetNode.x}:${targetNode.y}:${tProps?.rotation || 0}:${!!tProps?.flipX}:${!!tProps?.flipY}`;
      const cached = wireCache.get(wire.id);

      if (cached && cached.hash === hash && cached.waypointsRef === wire.waypoints) {
        wirePaths.set(wire.id, cached);
        continue;
      }

      const start = getSchematicPinPosition(sourceNode, wire.sourcePinId);
      const end = getSchematicPinPosition(targetNode, wire.targetPinId);

      const points = [{ x: start.x, y: start.y }];
      let minX = start.x < end.x ? start.x : end.x;
      let maxX = start.x > end.x ? start.x : end.x;
      let minY = start.y < end.y ? start.y : end.y;
      let maxY = start.y > end.y ? start.y : end.y;

      let path = `M ${start.x} ${start.y}`;
      if (wire.waypoints && wire.waypoints.length > 0) {
        for (let w = 0; w < wire.waypoints.length; w++) {
          const wp = wire.waypoints[w];
          path += ` L ${wp.x} ${wp.y}`;
          points.push({ x: wp.x, y: wp.y });
          if (wp.x < minX) minX = wp.x;
          if (wp.x > maxX) maxX = wp.x;
          if (wp.y < minY) minY = wp.y;
          if (wp.y > maxY) maxY = wp.y;
        }
      }
      path += ` L ${end.x} ${end.y}`;
      points.push({ x: end.x, y: end.y });

      const entry: WirePathEntry = {
        path,
        points,
        minX,
        maxX,
        minY,
        maxY,
        hash,
        waypointsRef: wire.waypoints,
      };
      wireCache.set(wire.id, entry);
      wirePaths.set(wire.id, entry);
    }
  }

  return { wirePaths };
};
