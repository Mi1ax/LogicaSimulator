import { LogicNode, Wire } from '../models/types';
import { getSchematicPinPosition } from '../utils/schematicLayout';

export interface Point { x: number; y: number; nx?: number; ny?: number }
export interface Segment { x1: number; y1: number; x2: number; y2: number; isHorizontal: boolean }

// Dead simple orthogonal router
export const getWireSegments = (outPos: Point, inPos: Point, midX?: number, waypoints?: Point[]): Segment[] => {
  const MIN_DIST = 20;
  
  const snx = outPos.nx ?? 1;
  const sny = outPos.ny ?? 0;
  const enx = inPos.nx ?? -1;
  const eny = inPos.ny ?? 0;

  const outStub = { x: outPos.x + snx * MIN_DIST, y: outPos.y + sny * MIN_DIST };
  const inStub = { x: inPos.x + enx * MIN_DIST, y: inPos.y + eny * MIN_DIST };

  const connectOrthogonal = (p1: Point, p2: Point, prefH: boolean): Segment[] => {
    if (p1.x === p2.x && p1.y === p2.y) return [];
    if (p1.x === p2.x) return [{ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, isHorizontal: false }];
    if (p1.y === p2.y) return [{ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, isHorizontal: true }];
    if (prefH) {
      return [
        { x1: p1.x, y1: p1.y, x2: p2.x, y2: p1.y, isHorizontal: true },
        { x1: p2.x, y1: p1.y, x2: p2.x, y2: p2.y, isHorizontal: false }
      ];
    } else {
      return [
        { x1: p1.x, y1: p1.y, x2: p1.x, y2: p2.y, isHorizontal: false },
        { x1: p1.x, y1: p2.y, x2: p2.x, y2: p2.y, isHorizontal: true }
      ];
    }
  };

  const connectMany = (pts: Point[], prefH: boolean): Segment[] => {
    const segments: Segment[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const l = connectOrthogonal(pts[i], pts[i+1], prefH);
      if (l.length > 0) prefH = !l[l.length - 1].isHorizontal;
      segments.push(...l);
    }
    return segments;
  };

  if (waypoints && waypoints.length > 0) {
    return connectMany([outPos, outStub, ...waypoints, inStub, inPos], snx !== 0);
  }

  let mid1: Point = { ...outStub };
  let mid2: Point = { ...inStub };
  
  if (snx !== 0 && enx !== 0) {
    const mX = midX ?? (outStub.x + inStub.x) / 2;
    if ((snx === 1 && outStub.x <= inStub.x) || (snx === -1 && outStub.x >= inStub.x)) {
      mid1 = { x: mX, y: outStub.y };
      mid2 = { x: mX, y: inStub.y };
    } else {
      const mY = (outStub.y + inStub.y) / 2;
      mid1 = { x: outStub.x, y: mY };
      mid2 = { x: inStub.x, y: mY };
    }
  } else if (sny !== 0 && eny !== 0) {
    const mY = (outStub.y + inStub.y) / 2;
    if ((sny === 1 && outStub.y <= inStub.y) || (sny === -1 && outStub.y >= inStub.y)) {
      mid1 = { x: outStub.x, y: mY };
      mid2 = { x: inStub.x, y: mY };
    } else {
      const mX = midX ?? (outStub.x + inStub.x) / 2;
      mid1 = { x: mX, y: outStub.y };
      mid2 = { x: mX, y: inStub.y };
    }
  } else {
    if (snx !== 0) { mid1 = { x: inStub.x, y: outStub.y }; mid2 = mid1; }
    else if (enx !== 0) { mid1 = { x: outStub.x, y: inStub.y }; mid2 = mid1; }
  }

  return connectMany([outPos, outStub, mid1, mid2, inStub, inPos], snx !== 0);
};

export const generateWirePath = (segments: Segment[]): string => {
  let path = '';
  segments.forEach((seg, i) => {
    if (i === 0) path += `M ${seg.x1} ${seg.y1} `;
    path += `L ${seg.x2} ${seg.y2} `;
  });
  return path;
};

export const computeAllWirePaths = (wires: Wire[], nodes: LogicNode[], draftWireSegments?: Segment[]) => {
  const wireSegmentsMap = new Map<string, Segment[]>();
  const wirePaths = new Map<string, string>();

  wires.forEach(wire => {
    const sourceNode = nodes.find(n => n.id === wire.sourceNodeId);
    const targetNode = nodes.find(n => n.id === wire.targetNodeId);
    if (!sourceNode || !targetNode) return;

    const start = getSchematicPinPosition(sourceNode, wire.sourcePinId);
    const end = getSchematicPinPosition(targetNode, wire.targetPinId);

    if (wire.wireType === 'jumper') {
      if (wire.waypoints && wire.waypoints.length > 0) {
        let path = `M ${start.x} ${start.y}`;
        wire.waypoints.forEach(wp => path += ` L ${wp.x} ${wp.y}`);
        path += ` L ${end.x} ${end.y}`;
        wirePaths.set(wire.id, path);
      } else {
        const dx = end.x - start.x;
        wirePaths.set(wire.id, `M ${start.x} ${start.y} C ${start.x + dx/2} ${start.y - 40}, ${end.x - dx/2} ${end.y - 40}, ${end.x} ${end.y}`);
      }
    } else {
      const segments = getWireSegments(start, end, wire.midX, wire.waypoints);
      wireSegmentsMap.set(wire.id, segments);
      wirePaths.set(wire.id, generateWirePath(segments));
    }
  });

  const draftWirePath = draftWireSegments ? generateWirePath(draftWireSegments) : '';
  
  // We completely disabled mathematical junctions because they cause ghost dots. 
  // Users must explicitly use the JUNCTION node logic.
  const junctions: Point[] = [];

  return { wirePaths, wireSegmentsMap, draftWirePath, junctions };
};
