import { LogicNode, Wire } from '../models/types';
import { getPinPosition } from '../utils/nodeLayout';

export interface Point { x: number; y: number }
export interface Segment { x1: number; y1: number; x2: number; y2: number; isHorizontal: boolean }

// Core pure function to get segments for a single wire
export const getWireSegments = (outPos: Point, inPos: Point, midX?: number): Segment[] => {
  const MIN_DIST = 20;
  
  if (outPos.x + MIN_DIST * 2 > inPos.x) {
    // Backwards routing
    const midY = (outPos.y + inPos.y) / 2;
    return [
      { x1: outPos.x, y1: outPos.y, x2: outPos.x + MIN_DIST, y2: outPos.y, isHorizontal: true },
      { x1: outPos.x + MIN_DIST, y1: outPos.y, x2: outPos.x + MIN_DIST, y2: midY, isHorizontal: false },
      { x1: outPos.x + MIN_DIST, y1: midY, x2: inPos.x - MIN_DIST, y2: midY, isHorizontal: true },
      { x1: inPos.x - MIN_DIST, y1: midY, x2: inPos.x - MIN_DIST, y2: inPos.y, isHorizontal: false },
      { x1: inPos.x - MIN_DIST, y1: inPos.y, x2: inPos.x, y2: inPos.y, isHorizontal: true }
    ];
  } else {
    // Standard left-to-right flow
    const defaultMidX = (outPos.x + inPos.x) / 2;
    const mX = midX !== undefined ? midX : defaultMidX;
    
    // Clamp to avoid crossing through the nodes themselves
    const safeMX = Math.max(outPos.x + 10, Math.min(inPos.x - 10, mX));
    
    return [
      { x1: outPos.x, y1: outPos.y, x2: safeMX, y2: outPos.y, isHorizontal: true },
      { x1: safeMX, y1: outPos.y, x2: safeMX, y2: inPos.y, isHorizontal: false },
      { x1: safeMX, y1: inPos.y, x2: inPos.x, y2: inPos.y, isHorizontal: true }
    ];
  }
};

// Generates an SVG path data string, adding U-bridges where horizontal lines cross vertical ones
export const generateWirePath = (segments: Segment[], allVerticals: Segment[]): string => {
  let path = '';
  const R = 6; // Radius of the jump

  segments.forEach((seg, i) => {
    if (i === 0) path += `M ${seg.x1} ${seg.y1} `;
    
    if (seg.isHorizontal) {
      const y = seg.y1;
      const minX = Math.min(seg.x1, seg.x2);
      const maxX = Math.max(seg.x1, seg.x2);
      const dir = seg.x2 > seg.x1 ? 1 : -1;
      
      // Find intersections with any vertical segment
      const intersections = allVerticals
        .filter(v => v.x1 > minX + R && v.x1 < maxX - R && y > Math.min(v.y1, v.y2) && y < Math.max(v.y1, v.y2))
        .map(v => v.x1)
        .sort((a, b) => dir === 1 ? a - b : b - a);

      intersections.forEach(ix => {
        // Line to jump start
        path += `L ${ix - R * dir} ${y} `;
        // Arc (U-bridge) over the vertical line.
        // We want it to bulge UPwards (negative Y).
        const sweep = dir === 1 ? 0 : 1; 
        path += `A ${R} ${R} 0 0 ${sweep} ${ix + R * dir} ${y} `;
      });
      // Line to end of segment
      path += `L ${seg.x2} ${seg.y2} `;
    } else {
      // Vertical line
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

    const start = getPinPosition(sourceNode, wire.sourcePinId);
    const end = getPinPosition(targetNode, wire.targetPinId);

    const segments = getWireSegments(start, end, wire.midX);
    wireSegmentsMap.set(wire.id, segments);
    
    segments.filter(s => !s.isHorizontal).forEach(s => allVerticals.push(s));
  });

  if (draftWireSegments) {
    draftWireSegments.filter(s => !s.isHorizontal).forEach(s => allVerticals.push(s));
  }

  // 2. Generate SVG paths with jumps
  const wirePaths = new Map<string, string>();
  wires.forEach(wire => {
    const segments = wireSegmentsMap.get(wire.id);
    if (segments) {
      wirePaths.set(wire.id, generateWirePath(segments, allVerticals));
    }
  });

  let draftWirePath = '';
  if (draftWireSegments) {
    draftWirePath = generateWirePath(draftWireSegments, allVerticals);
  }

  return { wirePaths, wireSegmentsMap, draftWirePath };
};
