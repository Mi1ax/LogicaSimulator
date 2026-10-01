import React from 'react';
import { Path, Group, Circle } from 'react-konva';
import { useSimulatorStore } from '../../../store/useSimulatorStore';

import { isTraceValid } from '../../../core/utils/geometry';

export const BoardTraceRenderer: React.FC = () => {
  const traces = useSimulatorStore(state => state.boardTraces || []);
  const draftTrace = useSimulatorStore(state => state.draftBoardTrace);

  const renderTrace = (points: {x: number, y: number}[], type: 'solder' | 'jumper', isDraft: boolean, id: string) => {
    if (points.length < 2) return null;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }

    const isValid = !isDraft || type !== 'solder' || isTraceValid(points, traces);
    
    let strokeColor = type === 'solder' ? '#94a3b8' : '#3b82f6';
    if (!isValid) strokeColor = '#ef4444'; // Red for invalid overlap

    const strokeWidth = type === 'solder' ? 8 : 4;
    const opacity = isDraft ? 0.6 : 1;

    return (
      <Group key={id}>
        <Path
          data={d}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={opacity}
          lineCap="round"
          lineJoin="round"
        />
        {/* Render waypoints for completed jumpers/traces, or ends */}
        {points.map((p, i) => (
          <Circle
            key={`${id}-pt-${i}`}
            x={p.x}
            y={p.y}
            radius={type === 'solder' ? 4 : 2}
            fill={strokeColor}
            opacity={opacity}
          />
        ))}
      </Group>
    );
  };

  return (
    <Group>
      {traces.map(t => renderTrace(t.points, t.type, false, t.id))}
      {draftTrace && renderTrace(draftTrace.points, draftTrace.type, true, draftTrace.id)}
    </Group>
  );
};
