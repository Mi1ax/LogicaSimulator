import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { extractFsmFromPld, getLiveFsmStatus, FsmStateNode } from '../../core/utils/fsmExtractor';
import { RotateCcw, Eye, EyeOff, ExternalLink, Activity, GitCommitHorizontal } from 'lucide-react';

interface FsmDiagramViewProps {
  pldSource: string;
  targetNodeId: string | null;
  /** When true (in Code + Diagram split view), hides all buttons and disables node clicking/dragging — only pan & zoom are allowed */
  readOnly?: boolean;
  onPlaceOnSchematic?: () => void;
}

export interface Point {
  x: number;
  y: number;
}

// Persist custom dragged state positions across tab switches and share with SchematicFsmDiagramNode
export const customPositionsCache = new Map<string, Record<string, Point>>();

export const FSM_CARD_WIDTH = 188;

export function getFsmCardHeight(state: FsmStateNode, showAllOutputs: boolean): number {
  const visibleOutputs = showAllOutputs
    ? state.outputs
    : state.outputs.filter(o => o.isActive || o.differsFromDefault);
  const count = Math.max(1, visibleOutputs.length);
  return 40 + count * 22 + 10;
}

/**
 * Computes the intersection point of a ray from center (cx, cy) toward (tx, ty)
 * with a rectangle of size (w, h) centered at (cx, cy).
 */
export function getRectBorderPoint(
  cx: number,
  cy: number,
  w: number,
  h: number,
  tx: number,
  ty: number,
  pad = 4
): Point {
  const dx = tx - cx;
  const dy = ty - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx, y: cy };
  }
  const hw = w / 2 + pad;
  const hh = h / 2 + pad;
  const scaleX = Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

export function computeDefaultFsmPositions(states: FsmStateNode[]): Record<string, Point> {
  const map: Record<string, Point> = {};
  const n = states.length;
  if (n === 0) return map;

  const centerX = 460;
  const centerY = 320;
  const radiusX = Math.max(190, n * 48);
  const radiusY = Math.max(155, n * 38);

  states.forEach((st, idx) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / n;
    map[st.name] = {
      x: Math.round(centerX + radiusX * Math.cos(angle)),
      y: Math.round(centerY + radiusY * Math.sin(angle)),
    };
  });
  return map;
}

export const FsmDiagramView: React.FC<FsmDiagramViewProps> = ({
  pldSource,
  targetNodeId,
  readOnly = false,
  onPlaceOnSchematic,
}) => {
  const pinStates = useSimulatorStore(state => state.simState.pinStates);
  const theme = useSimulatorStore(state => state.theme);
  const isDark = theme === 'dark';

  const [showAllOutputs, setShowAllOutputs] = useState(false);
  const [showSelfLoops, setShowSelfLoops] = useState(true);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const cacheKey = targetNodeId || 'default';
  const [customPositions, setCustomPositions] = useState<Record<string, Point>>(
    () => customPositionsCache.get(cacheKey) || {}
  );

  useEffect(() => {
    setCustomPositions(customPositionsCache.get(cacheKey) || {});
  }, [cacheKey]);

  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(readOnly ? 0.85 : 0.95);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    type: 'pan' | 'node';
    stateName?: string;
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const fsm = useMemo(() => extractFsmFromPld(pldSource), [pldSource]);

  const liveStatus = useMemo(() => {
    if (!fsm.hasFsm || !targetNodeId) return null;
    return getLiveFsmStatus(fsm, targetNodeId, pinStates);
  }, [fsm, targetNodeId, pinStates]);

  const defaultPositions = useMemo(() => computeDefaultFsmPositions(fsm.states), [fsm.states]);

  const statePositions = useMemo(() => {
    const merged: Record<string, Point> = {};
    for (const st of fsm.states) {
      merged[st.name] = customPositions[st.name] || defaultPositions[st.name] || { x: 400, y: 300 };
    }
    return merged;
  }, [fsm.states, customPositions, defaultPositions]);

  const graphCenter = useMemo(() => {
    const pts = Object.values(statePositions);
    if (pts.length === 0) return { x: 460, y: 320 };
    const sx = pts.reduce((acc, p) => acc + p.x, 0);
    const sy = pts.reduce((acc, p) => acc + p.y, 0);
    return { x: sx / pts.length, y: sy / pts.length };
  }, [statePositions]);

  const handleResetLayout = useCallback(() => {
    customPositionsCache.delete(cacheKey);
    setCustomPositions({});
    setPan({ x: 0, y: 0 });
    setZoom(readOnly ? 0.85 : 0.95);
  }, [cacheKey, readOnly]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(z => Math.min(2.2, Math.max(0.35, Number((z * factor).toFixed(3)))));
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.type === 'pan') {
        setPan({
          x: d.startX + (e.clientX - d.startMouseX),
          y: d.startY + (e.clientY - d.startMouseY),
        });
      } else if (d.type === 'node' && d.stateName && !readOnly) {
        const dx = (e.clientX - d.startMouseX) / zoom;
        const dy = (e.clientY - d.startMouseY) / zoom;
        const nextPos = {
          x: Math.round((d.startX + dx) / 10) * 10,
          y: Math.round((d.startY + dy) / 10) * 10,
        };
        setCustomPositions(prev => {
          const updated = { ...prev, [d.stateName!]: nextPos };
          customPositionsCache.set(cacheKey, updated);
          return updated;
        });
      }
    };

    const onMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [zoom, cacheKey, readOnly]);

  if (!fsm.hasFsm) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-slate-950 text-gray-500 dark:text-slate-400">
        <GitCommitHorizontal size={36} className="mb-3 text-gray-400 dark:text-slate-600" />
        <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
          FSM State Diagram Not Detected
        </p>
        <p className="text-xs max-w-md text-gray-500 dark:text-slate-400">
          {fsm.reason || 'Define state macros (e.g. S0..S5 over CS bits and NS equations) or registered .d state bits in your CUPL code to visualize the UML statechart.'}
        </p>
      </div>
    );
  }

  const transitionPairSet = new Set(fsm.transitions.map(t => `${t.from}->${t.to}`));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950 select-none relative">
      {/* Diagram Toolbar (only shown in full interactive FSM Diagram mode, hidden in readOnly Code+Diagram split view) */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 text-xs z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-700 dark:text-slate-200 flex items-center gap-1.5">
              <Activity size={14} className="text-orange-500" />
              UML FSM ({fsm.states.length} States)
            </span>

            {liveStatus && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200 dark:border-slate-700">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono font-semibold">
                  CS: {liveStatus.currentStateName || '?'} ({liveStatus.currentStateCode})
                </span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-mono font-semibold">
                  NS: {liveStatus.nextStateName || '?'} ({liveStatus.nextStateCode})
                </span>
                {Object.entries(liveStatus.liveInputs).map(([k, v]) => (
                  <span
                    key={k}
                    className={`px-1.5 py-0.5 rounded font-mono text-[11px] border ${
                      v === 1
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    {k}={v}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAllOutputs(v => !v)}
              className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-colors ${
                showAllOutputs
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
              title="Toggle between showing only active/changed outputs vs all 0/1 outputs inside each state"
            >
              {showAllOutputs ? 'All Outputs (0/1)' : 'Active Outputs'}
            </button>

            <button
              onClick={() => setShowSelfLoops(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-medium transition-colors ${
                showSelfLoops
                  ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-800'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
              title="Show or hide self-loop transitions (e.g. S1 -> S1)"
            >
              {showSelfLoops ? <Eye size={12} /> : <EyeOff size={12} />}
              Self-Loops
            </button>

            <button
              onClick={handleResetLayout}
              className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 text-[11px] font-medium transition-colors"
              title="Reset state positions and zoom"
            >
              <RotateCcw size={12} />
              Reset
            </button>

            {onPlaceOnSchematic && (
              <button
                onClick={onPlaceOnSchematic}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-semibold shadow-xs transition-colors"
                title="Place an informative FSM Diagram card in the background of the Schematic"
              >
                <ExternalLink size={12} />
                Live on Schematic
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive SVG Canvas */}
      <div
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          if (!readOnly) setSelectedState(null);
          dragRef.current = {
            type: 'pan',
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startX: pan.x,
            startY: pan.y,
          };
        }}
      >
        <svg ref={svgRef} className="w-full h-full">
          <defs>
            <pattern id="fsm-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle
                cx="2"
                cy="2"
                r="1"
                fill={isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(100, 116, 139, 0.18)'}
              />
            </pattern>
            <marker
              id="fsm-arrow"
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={isDark ? '#94a3b8' : '#475569'} />
            </marker>
            <marker
              id="fsm-arrow-active"
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9.5 5 L 0 9 z" fill="#10b981" />
            </marker>
            <marker
              id="fsm-arrow-selected"
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9.5 5 L 0 9 z" fill="#3b82f6" />
            </marker>
          </defs>

          <rect width="100%" height="100%" fill="url(#fsm-grid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Render Transition Arrows */}
            {fsm.transitions.map((tr) => {
              if (tr.isSelfLoop && !showSelfLoops) return null;

              const fromState = fsm.states.find(s => s.name === tr.from);
              const toState = fsm.states.find(s => s.name === tr.to);
              if (!fromState || !toState) return null;

              const fromPos = statePositions[tr.from];
              const toPos = statePositions[tr.to];
              if (!fromPos || !toPos) return null;

              const fromH = getFsmCardHeight(fromState, showAllOutputs);
              const toH = getFsmCardHeight(toState, showAllOutputs);

              const isLiveArmed =
                liveStatus?.currentStateName === tr.from &&
                liveStatus?.nextStateName === tr.to;
              const isHighlighted =
                isLiveArmed ||
                (!readOnly && (selectedState === tr.from || selectedState === tr.to));
              const isDimmed =
                !readOnly &&
                selectedState !== null &&
                selectedState !== tr.from &&
                selectedState !== tr.to;

              const strokeColor = isLiveArmed
                ? '#10b981'
                : !readOnly && (selectedState === tr.from || selectedState === tr.to)
                ? '#3b82f6'
                : isDark
                ? '#64748b'
                : '#64748b';

              const markerEnd = isLiveArmed
                ? 'url(#fsm-arrow-active)'
                : !readOnly && (selectedState === tr.from || selectedState === tr.to)
                ? 'url(#fsm-arrow-selected)'
                : 'url(#fsm-arrow)';

              if (tr.isSelfLoop) {
                let vx = fromPos.x - graphCenter.x;
                let vy = fromPos.y - graphCenter.y;
                const vLen = Math.hypot(vx, vy) || 1;
                vx /= vLen;
                vy /= vLen;

                const startPt = getRectBorderPoint(
                  fromPos.x,
                  fromPos.y,
                  FSM_CARD_WIDTH,
                  fromH,
                  fromPos.x + vx * 120 - vy * 35,
                  fromPos.y + vy * 120 + vx * 35,
                  2
                );
                const endPt = getRectBorderPoint(
                  fromPos.x,
                  fromPos.y,
                  FSM_CARD_WIDTH,
                  fromH,
                  fromPos.x + vx * 120 + vy * 35,
                  fromPos.y + vy * 120 - vx * 35,
                  6
                );

                const ctrl1X = startPt.x + vx * 58 - vy * 28;
                const ctrl1Y = startPt.y + vy * 58 + vx * 28;
                const ctrl2X = endPt.x + vx * 58 + vy * 28;
                const ctrl2Y = endPt.y + vy * 58 - vx * 28;
                const labelX = fromPos.x + vx * (FSM_CARD_WIDTH / 2 + 54);
                const labelY = fromPos.y + vy * (fromH / 2 + 46);

                const pillW = Math.max(48, tr.guard.length * 6.8 + 16);

                return (
                  <g key={tr.id} opacity={isDimmed ? 0.25 : 1}>
                    <path
                      d={`M ${startPt.x} ${startPt.y} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${endPt.x} ${endPt.y}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isLiveArmed ? 2.6 : isHighlighted ? 2.2 : 1.5}
                      strokeDasharray="4 3"
                      markerEnd={markerEnd}
                    />
                    <g transform={`translate(${labelX}, ${labelY})`}>
                      <rect
                        x={-pillW / 2}
                        y={-10}
                        width={pillW}
                        height={20}
                        rx={5}
                        fill={isDark ? '#0f172a' : '#ffffff'}
                        stroke={strokeColor}
                        strokeWidth={isLiveArmed ? 1.8 : 1}
                      />
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fontSize={10.5}
                        fontFamily="monospace"
                        fontWeight={isLiveArmed ? 'bold' : 'normal'}
                        fill={isLiveArmed ? '#10b981' : isDark ? '#cbd5e1' : '#334155'}
                      >
                        [{tr.guard}]
                      </text>
                    </g>
                  </g>
                );
              }

              const hasReverse = transitionPairSet.has(`${tr.to}->${tr.from}`);
              const dx = toPos.x - fromPos.x;
              const dy = toPos.y - fromPos.y;
              const dist = Math.hypot(dx, dy) || 1;
              const nx = -dy / dist;
              const ny = dx / dist;

              const curveOffset = hasReverse ? 38 : 18;
              const midX = (fromPos.x + toPos.x) / 2 + nx * curveOffset;
              const midY = (fromPos.y + toPos.y) / 2 + ny * curveOffset;

              const startPt = getRectBorderPoint(fromPos.x, fromPos.y, FSM_CARD_WIDTH, fromH, midX, midY, 2);
              const endPt = getRectBorderPoint(toPos.x, toPos.y, FSM_CARD_WIDTH, toH, midX, midY, 6);

              const labelX = 0.25 * startPt.x + 0.5 * midX + 0.25 * endPt.x;
              const labelY = 0.25 * startPt.y + 0.5 * midY + 0.25 * endPt.y;
              const pillW = Math.max(48, tr.guard.length * 6.8 + 16);

              return (
                <g key={tr.id} opacity={isDimmed ? 0.25 : 1}>
                  <path
                    d={`M ${startPt.x} ${startPt.y} Q ${midX} ${midY} ${endPt.x} ${endPt.y}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isLiveArmed ? 2.8 : isHighlighted ? 2.2 : 1.7}
                    markerEnd={markerEnd}
                  />
                  <g transform={`translate(${labelX}, ${labelY})`}>
                    <rect
                      x={-pillW / 2}
                      y={-10}
                      width={pillW}
                      height={20}
                      rx={5}
                      fill={isDark ? '#0f172a' : '#ffffff'}
                      stroke={strokeColor}
                      strokeWidth={isLiveArmed ? 1.8 : 1}
                    />
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontFamily="monospace"
                      fontWeight={isLiveArmed ? 'bold' : 'normal'}
                      fill={isLiveArmed ? '#10b981' : isDark ? '#e2e8f0' : '#1e293b'}
                    >
                      [{tr.guard}]
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 2. Render UML State Cards */}
            {fsm.states.map((st, idx) => {
              const pos = statePositions[st.name] || { x: 400, y: 300 };
              const cardH = getFsmCardHeight(st, showAllOutputs);
              const x = pos.x - FSM_CARD_WIDTH / 2;
              const y = pos.y - cardH / 2;

              const isCurrent = liveStatus?.currentStateName === st.name;
              const isNext =
                liveStatus?.nextStateName === st.name &&
                liveStatus?.nextStateName !== liveStatus?.currentStateName;
              const isSelected = !readOnly && selectedState === st.name;

              const visibleOutputs = showAllOutputs
                ? st.outputs
                : st.outputs.filter(o => o.isActive || o.differsFromDefault);

              const borderColor = isCurrent
                ? '#10b981'
                : isSelected
                ? '#3b82f6'
                : isNext
                ? '#0ea5e9'
                : isDark
                ? '#334155'
                : '#cbd5e1';

              return (
                <g
                  key={st.name}
                  transform={`translate(${x}, ${y})`}
                  className={readOnly ? 'pointer-events-none' : 'cursor-move'}
                  onMouseDown={
                    readOnly
                      ? undefined
                      : (e) => {
                          e.stopPropagation();
                          setSelectedState(st.name);
                          dragRef.current = {
                            type: 'node',
                            stateName: st.name,
                            startMouseX: e.clientX,
                            startMouseY: e.clientY,
                            startX: pos.x,
                            startY: pos.y,
                          };
                        }
                  }
                >
                  {/* Initial Pseudostate (● ──>) on S0 */}
                  {idx === 0 && (
                    <g>
                      <circle
                        cx={-26}
                        cy={18}
                        r={6}
                        fill={isDark ? '#e2e8f0' : '#1e293b'}
                      />
                      <line
                        x1={-20}
                        y1={18}
                        x2={-4}
                        y2={18}
                        stroke={isDark ? '#94a3b8' : '#475569'}
                        strokeWidth={1.8}
                        markerEnd="url(#fsm-arrow)"
                      />
                    </g>
                  )}

                  {/* Active State Outer Glow */}
                  {isCurrent && (
                    <rect
                      x={-4}
                      y={-4}
                      width={FSM_CARD_WIDTH + 8}
                      height={cardH + 8}
                      rx={12}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeOpacity={0.45}
                    />
                  )}

                  {/* UML State Card Container */}
                  <rect
                    x={0}
                    y={0}
                    width={FSM_CARD_WIDTH}
                    height={cardH}
                    rx={9}
                    fill={isDark ? '#0f172a' : '#ffffff'}
                    stroke={borderColor}
                    strokeWidth={isCurrent || isSelected ? 2.5 : 1.5}
                  />

                  {/* UML State Header Compartment */}
                  <path
                    d={`M 0 9 A 9 9 0 0 1 9 0 L ${FSM_CARD_WIDTH - 9} 0 A 9 9 0 0 1 ${FSM_CARD_WIDTH} 9 L ${FSM_CARD_WIDTH} 34 L 0 34 Z`}
                    fill={
                      isCurrent
                        ? isDark
                          ? '#064e3b'
                          : '#d1fae5'
                        : isSelected
                        ? isDark
                          ? '#1e3a8a'
                          : '#dbeafe'
                        : isDark
                        ? '#1e293b'
                        : '#f1f5f9'
                    }
                  />
                  <line
                    x1={0}
                    y1={34}
                    x2={FSM_CARD_WIDTH}
                    y2={34}
                    stroke={borderColor}
                    strokeWidth={1.2}
                  />

                  {/* State Name & Binary Code */}
                  <text
                    x={12}
                    y={22}
                    fontSize={13.5}
                    fontWeight="bold"
                    fontFamily="sans-serif"
                    fill={
                      isCurrent
                        ? isDark
                          ? '#6ee7b7'
                          : '#065f46'
                        : isDark
                        ? '#f8fafc'
                        : '#0f172a'
                    }
                  >
                    {st.name}
                  </text>

                  <text
                    x={FSM_CARD_WIDTH - 12}
                    y={21}
                    textAnchor="end"
                    fontSize={11}
                    fontFamily="monospace"
                    fill={isDark ? '#94a3b8' : '#64748b'}
                  >
                    {isCurrent ? '● ACTIVE ' : isNext ? 'NEXT ' : ''}({st.code})
                  </text>

                  {/* UML State Outputs / Actions Compartment */}
                  {visibleOutputs.length === 0 ? (
                    <text
                      x={12}
                      y={54}
                      fontSize={11}
                      fontStyle="italic"
                      fill={isDark ? '#64748b' : '#94a3b8'}
                    >
                      (default idle outputs)
                    </text>
                  ) : (
                    visibleOutputs.map((out, oIdx) => {
                      const rowY = 42 + oIdx * 22;
                      const isCond = out.value !== '0' && out.value !== '1';
                      const badgeBg = isCond
                        ? isDark
                          ? 'rgba(168, 85, 247, 0.2)'
                          : 'rgba(168, 85, 247, 0.12)'
                        : out.isActive
                        ? isDark
                          ? 'rgba(16, 185, 129, 0.18)'
                          : 'rgba(16, 185, 129, 0.12)'
                        : isDark
                        ? 'rgba(51, 65, 85, 0.45)'
                        : 'rgba(241, 245, 249, 0.9)';

                      const textColor = isCond
                        ? isDark
                          ? '#d8b4fe'
                          : '#7e22ce'
                        : out.isActive
                        ? isDark
                          ? '#6ee7b7'
                          : '#047857'
                        : isDark
                        ? '#94a3b8'
                        : '#64748b';

                      return (
                        <g key={out.name} transform={`translate(8, ${rowY})`}>
                          <rect
                            x={0}
                            y={0}
                            width={FSM_CARD_WIDTH - 16}
                            height={18}
                            rx={4}
                            fill={badgeBg}
                          />
                          <text
                            x={7}
                            y={13}
                            fontSize={11}
                            fontFamily="monospace"
                            fill={textColor}
                          >
                            {out.name}
                          </text>
                          <text
                            x={FSM_CARD_WIDTH - 23}
                            y={13}
                            textAnchor="end"
                            fontSize={11}
                            fontFamily="monospace"
                            fontWeight="bold"
                            fill={textColor}
                          >
                            = {out.value}
                          </text>
                        </g>
                      );
                    })
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {!readOnly && (
          <div className="absolute bottom-2.5 left-3 flex items-center gap-3 px-2.5 py-1 rounded-md bg-white/85 dark:bg-slate-900/85 backdrop-blur-xs border border-gray-200 dark:border-slate-800 text-[10px] text-gray-500 dark:text-slate-400 pointer-events-none">
            <span>Drag state cards to rearrange</span>
            <span>•</span>
            <span>Scroll to zoom</span>
            <span>•</span>
            <span>Click a state to highlight its transitions</span>
          </div>
        )}
      </div>
    </div>
  );
};
