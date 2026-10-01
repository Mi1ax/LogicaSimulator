type Point = { x: number, y: number };

// Check if two orthogonal segments overlap or cross
export const doSolderSegmentsOverlap = (p1: Point, p2: Point, p3: Point, p4: Point): boolean => {
  // Determine bounds of segment 1
  const minX1 = Math.min(p1.x, p2.x);
  const maxX1 = Math.max(p1.x, p2.x);
  const minY1 = Math.min(p1.y, p2.y);
  const maxY1 = Math.max(p1.y, p2.y);

  // Determine bounds of segment 2
  const minX2 = Math.min(p3.x, p4.x);
  const maxX2 = Math.max(p3.x, p4.x);
  const minY2 = Math.min(p3.y, p4.y);
  const maxY2 = Math.max(p3.y, p4.y);

  const isSeg1Horiz = minY1 === maxY1;
  const isSeg2Horiz = minY2 === maxY2;

  // If both are horizontal
  if (isSeg1Horiz && isSeg2Horiz) {
    if (minY1 !== minY2) return false; // Not collinear
    // Check 1D overlap (excluding exactly touching at endpoints)
    return Math.max(minX1, minX2) < Math.min(maxX1, maxX2);
  }

  // If both are vertical
  if (!isSeg1Horiz && !isSeg2Horiz) {
    if (minX1 !== minX2) return false; // Not collinear
    // Check 1D overlap
    return Math.max(minY1, minY2) < Math.min(maxY1, maxY2);
  }

  // One is horizontal, one is vertical (Cross intersection)
  const horiz = isSeg1Horiz ? { minX: minX1, maxX: maxX1, y: minY1 } : { minX: minX2, maxX: maxX2, y: minY2 };
  const vert = !isSeg1Horiz ? { minY: minY1, maxY: maxY1, x: minX1 } : { minY: minY2, maxY: maxY2, x: minX2 };

  // Check if they cross
  const crosses = horiz.y > vert.minY && horiz.y < vert.maxY && vert.x > horiz.minX && vert.x < horiz.maxX;
  
  // They are allowed to touch at a T-junction or L-junction (endpoint exactly on the line or endpoint on endpoint).
  // The strictly > and < above ensure we only return true if they CROSS through the middle.
  // Wait, if a vertical line goes through the MIDDLE of a horizontal line but ends exactly on it? That is a T-junction.
  // Is a T-junction allowed? On a perfboard, branching a trace mid-way is totally fine! It just connects.
  // The user said "disable overlapping". Overlapping usually means crossing without connecting or drawing over the same path.
  // So T-junctions (where one endpoint lies on the other segment) are fine electrically if they are soldered.
  // BUT wait, on a perfboard, you solder from hole to hole. A T-junction must happen AT A HOLE.
  // Since our grid snaps to 20px, any intersection will happen at a hole anyway.
  // So `crosses` means they cross each other in an X shape. X shape is valid on a breadboard if it's the SAME net, but since we don't know nets here, usually crossing traces on a single layer board is a short circuit!
  // So crossing is definitely an overlap.

  return crosses;
};

// Check if a full trace overlaps with an array of existing traces
export const isTraceValid = (
  newPoints: Point[], 
  existingTraces: { type: string, points: Point[] }[]
): boolean => {
  if (newPoints.length < 2) return true;

  const solderTraces = existingTraces.filter(t => t.type === 'solder');
  
  // Check every segment of the new trace
  for (let i = 0; i < newPoints.length - 1; i++) {
    const p1 = newPoints[i];
    const p2 = newPoints[i + 1];

    // Check against all existing solder traces
    for (const trace of solderTraces) {
      for (let j = 0; j < trace.points.length - 1; j++) {
        const p3 = trace.points[j];
        const p4 = trace.points[j + 1];
        if (doSolderSegmentsOverlap(p1, p2, p3, p4)) {
          return false;
        }
      }
    }

    // Check against previous segments in the SAME trace (self-intersection)
    for (let j = 0; j < i - 1; j++) {
      const p3 = newPoints[j];
      const p4 = newPoints[j + 1];
      if (doSolderSegmentsOverlap(p1, p2, p3, p4)) {
        return false;
      }
    }
  }

  return true;
};
