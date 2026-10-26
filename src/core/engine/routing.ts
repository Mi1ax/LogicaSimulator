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
  sourceNodeRef: LogicNode;
  targetNodeRef: LogicNode;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePinId: string;
  targetPinId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sRot: number;
  sFlipX: boolean;
  sFlipY: boolean;
  sInLen: number;
  sOutLen: number;
  sBits: number;
  tRot: number;
  tFlipX: boolean;
  tFlipY: boolean;
  tInLen: number;
  tOutLen: number;
  tBits: number;
  startOffsetX: number;
  startOffsetY: number;
  endOffsetX: number;
  endOffsetY: number;
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
let lastNodesRefForMap: LogicNode[] | null = null;
let cachedNodeMap = new Map<string, LogicNode>();

export const computeAllWirePaths = (
  wires: Wire[],
  nodes: LogicNode[]
) => {
  const wirePaths = new Map<string, WirePathEntry>();

  if (wires.length > 0) {
    if (nodes !== lastNodesRefForMap) {
      lastNodesRefForMap = nodes;
      cachedNodeMap.clear();
      for (let i = 0; i < nodes.length; i++) {
        cachedNodeMap.set(nodes[i].id, nodes[i]);
      }
    }
    const nodeMap = cachedNodeMap;

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

      const cached = wireCache.get(wire.id);

      // Fast Path 1: Stationary nodes and unchanged waypoints (0 string allocations)
      if (
        cached &&
        cached.sourceNodeRef === sourceNode &&
        cached.targetNodeRef === targetNode &&
        cached.waypointsRef === wire.waypoints &&
        cached.sourcePinId === wire.sourcePinId &&
        cached.targetPinId === wire.targetPinId
      ) {
        wirePaths.set(wire.id, cached);
        continue;
      }

      const sProps = sourceNode.properties;
      const tProps = targetNode.properties;
      const sRot = sProps?.rotation || 0;
      const sFlipX = !!sProps?.flipX;
      const sFlipY = !!sProps?.flipY;
      const sInLen = sourceNode.inputs.length;
      const sOutLen = sourceNode.outputs.length;
      const sBits = typeof sProps?.bits === 'number' ? sProps.bits : 0;

      const tRot = tProps?.rotation || 0;
      const tFlipX = !!tProps?.flipX;
      const tFlipY = !!tProps?.flipY;
      const tInLen = targetNode.inputs.length;
      const tOutLen = targetNode.outputs.length;
      const tBits = typeof tProps?.bits === 'number' ? tProps.bits : 0;

      const sameGeom =
        cached !== undefined &&
        cached.sourceNodeId === sourceNode.id &&
        cached.targetNodeId === targetNode.id &&
        cached.sourcePinId === wire.sourcePinId &&
        cached.targetPinId === wire.targetPinId &&
        cached.sRot === sRot &&
        cached.sFlipX === sFlipX &&
        cached.sFlipY === sFlipY &&
        cached.sInLen === sInLen &&
        cached.sOutLen === sOutLen &&
        cached.sBits === sBits &&
        cached.tRot === tRot &&
        cached.tFlipX === tFlipX &&
        cached.tFlipY === tFlipY &&
        cached.tInLen === tInLen &&
        cached.tOutLen === tOutLen &&
        cached.tBits === tBits;

      // Fast Path 2: Node object cloned (e.g. input toggled), but position & pin geometry are identical
      if (
        sameGeom &&
        cached &&
        cached.sourceX === sourceNode.x &&
        cached.sourceY === sourceNode.y &&
        cached.targetX === targetNode.x &&
        cached.targetY === targetNode.y &&
        cached.waypointsRef === wire.waypoints
      ) {
        cached.sourceNodeRef = sourceNode;
        cached.targetNodeRef = targetNode;
        wirePaths.set(wire.id, cached);
        continue;
      }

      let startX = 0;
      let startY = 0;
      let endX = 0;
      let endY = 0;
      let startOffsetX = 0;
      let startOffsetY = 0;
      let endOffsetX = 0;
      let endOffsetY = 0;

      if (sameGeom && cached) {
        startOffsetX = cached.startOffsetX;
        startOffsetY = cached.startOffsetY;
        endOffsetX = cached.endOffsetX;
        endOffsetY = cached.endOffsetY;
        startX = sourceNode.x + startOffsetX;
        startY = sourceNode.y + startOffsetY;
        endX = targetNode.x + endOffsetX;
        endY = targetNode.y + endOffsetY;
      } else {
        const start = getSchematicPinPosition(sourceNode, wire.sourcePinId);
        const end = getSchematicPinPosition(targetNode, wire.targetPinId);
        startX = start.x;
        startY = start.y;
        endX = end.x;
        endY = end.y;
        startOffsetX = startX - sourceNode.x;
        startOffsetY = startY - sourceNode.y;
        endOffsetX = endX - targetNode.x;
        endOffsetY = endY - targetNode.y;
      }

      const points = [{ x: startX, y: startY }];
      let minX = startX < endX ? startX : endX;
      let maxX = startX > endX ? startX : endX;
      let minY = startY < endY ? startY : endY;
      let maxY = startY > endY ? startY : endY;

      let path = `M ${startX} ${startY}`;
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
      path += ` L ${endX} ${endY}`;
      points.push({ x: endX, y: endY });

      const entry: WirePathEntry = {
        path,
        points,
        minX,
        maxX,
        minY,
        maxY,
        sourceNodeRef: sourceNode,
        targetNodeRef: targetNode,
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        sourcePinId: wire.sourcePinId,
        targetPinId: wire.targetPinId,
        sourceX: sourceNode.x,
        sourceY: sourceNode.y,
        targetX: targetNode.x,
        targetY: targetNode.y,
        sRot,
        sFlipX,
        sFlipY,
        sInLen,
        sOutLen,
        sBits,
        tRot,
        tFlipX,
        tFlipY,
        tInLen,
        tOutLen,
        tBits,
        startOffsetX,
        startOffsetY,
        endOffsetX,
        endOffsetY,
        waypointsRef: wire.waypoints,
      };
      wireCache.set(wire.id, entry);
      wirePaths.set(wire.id, entry);
    }
  }

  return { wirePaths };
};
