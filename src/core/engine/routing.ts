import { LogicNode, Wire } from '../models/types';
import { getSchematicPinPosition } from '../utils/schematicLayout';

export interface Point { x: number; y: number; nx?: number; ny?: number }
export interface Segment { x1: number; y1: number; x2: number; y2: number; isHorizontal: boolean }

// Core pure function to get segments for a single wire
export const getWireSegments = (outPos: Point, inPos: Point, midX?: number, waypoints?: Point[]): Segment[] => {
  const MIN_DIST = 20;
  
  const snx = outPos.nx !== undefined ? outPos.nx : 1;
  const enx = inPos.nx !== undefined ? inPos.nx : -1;

  const outStub = { x: outPos.x + snx * MIN_DIST, y: outPos.y };
  const inStub = { x: inPos.x + enx * MIN_DIST, y: inPos.y };

  if (waypoints && waypoints.length > 0) {
    const points = [outPos, outStub, ...waypoints, inStub, inPos];
    const segments: Segment[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i+1];
      if (p1.x !== p2.x && p1.y !== p2.y) {
        // Draw L-shape: horizontal then vertical
        segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p1.y, isHorizontal: true });
        segments.push({ x1: p2.x, y1: p1.y, x2: p2.x, y2: p2.y, isHorizontal: false });
      } else if (p1.x !== p2.x) {
        segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p1.y, isHorizontal: true });
      } else if (p1.y !== p2.y) {
        segments.push({ x1: p1.x, y1: p1.y, x2: p1.x, y2: p2.y, isHorizontal: false });
      }
    }
    return segments;
  }

  const p1 = outStub;
  const p2 = inStub;

  const isSimpleX = ((snx === 1 || snx === 0) && p1.x <= p2.x) ||
                    ((snx === -1 || snx === 0) && p1.x >= p2.x);

  if (isSimpleX) {
    const defaultMidX = (p1.x + p2.x) / 2;
    const mX = midX !== undefined ? midX : defaultMidX;
    const safeMX = (snx === 1 && enx === -1) 
      ? Math.max(p1.x, Math.min(p2.x, mX))
      : mX;
    
    return [
      { x1: outPos.x, y1: outPos.y, x2: safeMX, y2: outPos.y, isHorizontal: true },
      { x1: safeMX, y1: outPos.y, x2: safeMX, y2: inPos.y, isHorizontal: false },
      { x1: safeMX, y1: inPos.y, x2: inPos.x, y2: inPos.y, isHorizontal: true }
    ];
  } else {
    const midY = (p1.y + p2.y) / 2;
    return [
      { x1: outPos.x, y1: outPos.y, x2: p1.x, y2: p1.y, isHorizontal: true },
      { x1: p1.x, y1: p1.y, x2: p1.x, y2: midY, isHorizontal: false },
      { x1: p1.x, y1: midY, x2: p2.x, y2: midY, isHorizontal: true },
      { x1: p2.x, y1: midY, x2: p2.x, y2: p2.y, isHorizontal: false },
      { x1: p2.x, y1: p2.y, x2: inPos.x, y2: inPos.y, isHorizontal: true }
    ];
  }
};

// Generates an SVG path data string, adding U-bridges where horizontal lines cross vertical ones
export const generateWirePath = (segments: Segment[], allVerticals: Segment[]): string => {
  let path = '';
  const BASE_R = 6;

  segments.forEach((seg, i) => {
    if (i === 0) path += `M ${seg.x1} ${seg.y1} `;
    
    if (seg.isHorizontal) {
      const y = seg.y1;
      const minX = Math.min(seg.x1, seg.x2);
      const maxX = Math.max(seg.x1, seg.x2);
      const dir = seg.x2 > seg.x1 ? 1 : -1;
      
      const intersections = allVerticals
        .filter(v => v.x1 > minX && v.x1 < maxX && y >= Math.min(v.y1, v.y2) && y <= Math.max(v.y1, v.y2))
        .map(v => v.x1)
        .sort((a, b) => dir === 1 ? a - b : b - a);

      intersections.forEach(ix => {
        const R = Math.min(BASE_R, Math.abs(ix - minX) - 1, Math.abs(maxX - ix) - 1);
        if (R >= 2) {
          path += `L ${ix - R * dir} ${y} `;
          const sweep = dir === 1 ? 0 : 1; 
          path += `A ${R} ${R} 0 0 ${sweep} ${ix + R * dir} ${y} `;
        }
      });
      path += `L ${seg.x2} ${seg.y2} `;
    } else {
      path += `L ${seg.x2} ${seg.y2} `;
    }
  });
  return path;
};

// Pure function to generate paths for all wires in the circuit
export const computeAllWirePaths = (wires: Wire[], nodes: LogicNode[], draftWireSegments?: Segment[]) => {
  // 1. Gather all segments
  const wireSegmentsMap = new Map<string, Segment[]>();
  const allVerticals: Segment[] = [];

  wires.forEach(wire => {
    const sourceNode = nodes.find(n => n.id === wire.sourceNodeId);
    const targetNode = nodes.find(n => n.id === wire.targetNodeId);
    if (!sourceNode || !targetNode) return;

    const start = getSchematicPinPosition(sourceNode, wire.sourcePinId);
    const end = getSchematicPinPosition(targetNode, wire.targetPinId);

    const segments = getWireSegments(start, end, wire.midX, wire.waypoints);
    if (wire.wireType !== 'jumper') {
      wireSegmentsMap.set(wire.id, segments);
      segments.filter(s => !s.isHorizontal).forEach(s => allVerticals.push(s));
    }
  });

  if (draftWireSegments) {
    draftWireSegments.filter(s => !s.isHorizontal).forEach(s => allVerticals.push(s));
  }

  // 2. Generate SVG paths with jumps
  const wirePaths = new Map<string, string>();
  wires.forEach(wire => {
    if (wire.wireType === 'jumper') {
      const sourceNode = nodes.find(n => n.id === wire.sourceNodeId);
      const targetNode = nodes.find(n => n.id === wire.targetNodeId);
      if (sourceNode && targetNode) {
        const start = getSchematicPinPosition(sourceNode, wire.sourcePinId);
        const end = getSchematicPinPosition(targetNode, wire.targetPinId);
        
        // Jumper is a bezier curve or simple line (over everything)
        if (wire.waypoints && wire.waypoints.length > 0) {
          // If jumpers have waypoints (which they can if the user routed them)
          let path = `M ${start.x} ${start.y}`;
          for (const wp of wire.waypoints) {
            path += ` L ${wp.x} ${wp.y}`;
          }
          path += ` L ${end.x} ${end.y}`;
          wirePaths.set(wire.id, path);
        } else {
          // Simple bezier curve for un-routed jumpers
          const dx = end.x - start.x;
          // Curve bows out based on horizontal distance
          wirePaths.set(wire.id, `M ${start.x} ${start.y} C ${start.x + dx/2} ${start.y - 40}, ${end.x - dx/2} ${end.y - 40}, ${end.x} ${end.y}`);
        }
      }
    } else {
      const segments = wireSegmentsMap.get(wire.id);
      if (segments) {
        wirePaths.set(wire.id, generateWirePath(segments, allVerticals));
      }
    }
  });

  let draftWirePath = '';
  if (draftWireSegments) {
    draftWirePath = generateWirePath(draftWireSegments, allVerticals);
  }

  return { wirePaths, wireSegmentsMap, draftWirePath };
};
