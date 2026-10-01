import { describe, it, expect } from 'vitest';
import { getWireSegments, Point } from '../routing';

describe('Wire Routing', () => {
  describe('getWireSegments (Manhattan Routing)', () => {
    it('creates a simple U-shape or S-shape for straight connections', () => {
      // From (0,0) right to (100,50) right-facing input (left of node)
      const start: Point = { x: 0, y: 0, nx: 1, ny: 0 };
      const end: Point = { x: 100, y: 50, nx: -1, ny: 0 };
      
      const segments = getWireSegments(start, end);
      
      expect(segments.length).toBe(3);
      // Segment 1: start out
      expect(segments[0].x1).toBe(0);
      expect(segments[0].y1).toBe(0);
      expect(segments[0].isHorizontal).toBe(true);
      
      // Segment 2: down
      expect(segments[1].isHorizontal).toBe(false);
      
      // Segment 3: into target
      expect(segments[2].x2).toBe(100);
      expect(segments[2].y2).toBe(50);
      expect(segments[2].isHorizontal).toBe(true);
    });

    it('respects waypoints and routes strictly through them', () => {
      const start: Point = { x: 0, y: 0, nx: 1, ny: 0 };
      const end: Point = { x: 100, y: 100, nx: -1, ny: 0 };
      const waypoints: Point[] = [{ x: 50, y: 0 }, { x: 50, y: 100 }];
      
      const segments = getWireSegments(start, end, undefined, waypoints);
      
      // Points in path: start -> outStub -> w1 -> w2 -> inStub -> end
      // 0,0 -> 20,0 -> 50,0 -> 50,100 -> 80,100 -> 100,100
      expect(segments.length).toBeGreaterThan(3);
      
      // First waypoint check (horizontal from 20,0 to 50,0)
      const w1ToW2 = segments.find(s => s.x1 === 50 && s.y1 === 0 && s.x2 === 50 && s.y2 === 100);
      expect(w1ToW2).toBeDefined();
      expect(w1ToW2?.isHorizontal).toBe(false);
    });

    it('handles same-side connections using simple X fallback', () => {
      // Trying to connect output pointing right (1) to an output pin also pointing right (1)
      const start: Point = { x: 0, y: 0, nx: 1, ny: 0 };
      const end: Point = { x: 100, y: 50, nx: 1, ny: 0 };
      
      const segments = getWireSegments(start, end);
      
      // The current implementation treats this as a simple X route returning 3 segments
      expect(segments.length).toBe(3);
    });
  });
});
