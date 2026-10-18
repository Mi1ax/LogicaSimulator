import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  MoreVertical,
  Eraser,
  Sparkles,
} from 'lucide-react';
import { useSimulatorStore, subscribeTickCount } from '../../store/useSimulatorStore';
import {
  AnalyzerChannel,
  BreakpointCondition,
  BusRadix,
  discoverCircuitProbes,
  formatBusSample,
  globalAnalyzerBuffer,
  LA_VAL_0,
  LA_VAL_1,
  LA_VAL_X,
  LA_VAL_Z,
} from '../../core/engine/logicAnalyzer';
import { generateId } from '../../core/utils/id';

export interface LogicAnalyzerDrawerProps {
  isOpen: boolean;
  onToggleOpen: () => void;
}

const RULER_HEIGHT = 24;
const MAIN_ROW_HEIGHT = 32;
const SUB_ROW_HEIGHT = 24;

function formatDurationMs(ticks: number, simSpeedHz: number): string {
  const safeHz = Math.max(0.1, simSpeedHz || 200);
  const ms = (Math.max(0, ticks) * 1000) / safeHz;
  if (ms === 0) return '0 ms';
  if (ms < 0.001) return `${(ms * 1e6).toFixed(1)} ns`;
  if (ms < 1) {
    const us = ms * 1000;
    return `${us < 10 ? us.toFixed(2) : us < 100 ? us.toFixed(1) : Math.round(us)} µs`;
  }
  if (ms < 1000) {
    return `${ms < 10 ? ms.toFixed(2) : ms < 100 ? ms.toFixed(1) : Math.round(ms)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatFrequencyHz(ticks: number, simSpeedHz: number): string {
  if (ticks <= 0) return '—';
  const hz = Math.max(0.1, simSpeedHz || 200) / ticks;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
  return `${hz < 10 ? hz.toFixed(2) : Math.round(hz)} Hz`;
}

export const LogicAnalyzerDrawer: React.FC<LogicAnalyzerDrawerProps> = ({
  isOpen,
  onToggleOpen,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [drawerHeight, setDrawerHeight] = useState<number>(250);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'waveforms' | 'breakpoints'>('waveforms');
  const [tickWidth, setTickWidth] = useState<number>(24);
  const [cursorLogicalIdx, setCursorLogicalIdx] = useState<number | null>(null);
  const [cursorEndLogicalIdx, setCursorEndLogicalIdx] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Zero-React-state hover & cursor-drag refs for 0-CPU interactive canvas feedback
  const hoverRef = useRef<{ sampleIdx: number | null; rowIdx: number | null }>({
    sampleIdx: null,
    rowIdx: null,
  });
  const cursorDragRef = useRef<{
    active: boolean;
    mode: 'new' | 't1' | 't2';
    anchorIdx: number;
  }>({ active: false, mode: 'new', anchorIdx: 0 });

  // Menus
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [customBusMode, setCustomBusMode] = useState<boolean>(false);
  const [customBusName, setCustomBusName] = useState<string>('BUS[7:0]');
  const [customBusPinIds, setCustomBusPinIds] = useState<string[]>([]);

  // Throttled render version for value readouts at cursor
  const [, setRenderTick] = useState<number>(0);

  // Store subscriptions (structural & analyzer config only — NOT subscribing to simState!)
  const nodes = useSimulatorStore(s => s.nodes);
  const wires = useSimulatorStore(s => s.wires);
  const selection = useSimulatorStore(s => s.selection);
  const multiSelection = useSimulatorStore(s => s.multiSelection);
  const theme = useSimulatorStore(s => s.theme);
  const simSpeed = useSimulatorStore(s => s.simSpeed);
  const channels = useSimulatorStore(s => s.analyzerChannels);
  const setChannels = useSimulatorStore(s => s.setAnalyzerChannels);
  const breakpoints = useSimulatorStore(s => s.breakpoints);
  const setBreakpoints = useSimulatorStore(s => s.setBreakpoints);
  const trapShortCircuit = useSimulatorStore(s => s.trapShortCircuit);
  const setTrapShortCircuit = useSimulatorStore(s => s.setTrapShortCircuit);
  const lastTriggeredBpId = useSimulatorStore(s => s.lastTriggeredBreakpointId);
  const clearAnalyzerHistory = useSimulatorStore(s => s.clearAnalyzerHistory);

  // Breakpoint quick-add form state
  const [newBpTargetId, setNewBpTargetId] = useState<string>('');
  const [newBpCond, setNewBpCond] = useState<BreakpointCondition>('rising');
  const [newBpVal, setNewBpVal] = useState<string>('0x00');

  // Auto-populate key buses & signals when opening the analyzer on a non-empty circuit for the first time
  const autoSeededForNodesRef = useRef<number>(0);
  useEffect(() => {
    if (!isOpen) return;
    if (nodes.length === 0) {
      autoSeededForNodesRef.current = 0;
      return;
    }
    if (channels.length === 0 && autoSeededForNodesRef.current !== nodes.length) {
      autoSeededForNodesRef.current = nodes.length;
      const discovered = discoverCircuitProbes(nodes, wires, []);
      if (discovered.length > 0) {
        const busPinSet = new Set<string>();
        const buses = discovered.filter(p => p.type === 'bus' && p.category !== 'Selected');
        for (const b of buses) {
          for (const pid of b.pinIds) busPinSet.add(pid);
        }
        const clocks = discovered.filter(
          p => p.type === 'wire' && p.category === 'Signals & Clocks' && /^CLK/i.test(p.name)
        );
        const standaloneWires = discovered.filter(
          p =>
            p.type === 'wire' &&
            p.category !== 'Selected' &&
            !busPinSet.has(p.pinIds[0]) &&
            !/^CLK/i.test(p.name)
        );
        const prioritized = [...clocks, ...buses, ...standaloneWires];
        const initial: AnalyzerChannel[] = prioritized.slice(0, 6).map(p => ({
          id: generateId('ch'),
          name: p.name,
          type: p.type,
          pinIds: p.pinIds,
          radix: p.radix || 'HEX',
          expanded: false,
        }));
        setChannels(initial);
      }
    }
  }, [isOpen, nodes, wires, channels.length, setChannels]);

  // Keep default breakpoint target valid when channels change
  useEffect(() => {
    if (channels.length > 0 && !channels.some(c => c.id === newBpTargetId)) {
      const firstCh = channels[0];
      setNewBpTargetId(firstCh.id);
      setNewBpCond(firstCh.type === 'bus' ? 'equals' : 'rising');
    } else if (channels.length === 0) {
      setNewBpTargetId('__ANY_NET__');
      setNewBpCond('short_circuit');
    }
  }, [channels, newBpTargetId]);

  // Compute flattened visual rows (including expanded bus sub-bits)
  const visualRows = useMemo(() => {
    const rows: Array<
      | { kind: 'main'; channel: AnalyzerChannel; y: number; height: number }
      | {
          kind: 'sub';
          parentId: string;
          pinId: string;
          name: string;
          y: number;
          height: number;
        }
    > = [];
    let currentY = RULER_HEIGHT;
    for (const ch of channels) {
      rows.push({
        kind: 'main',
        channel: ch,
        y: currentY,
        height: MAIN_ROW_HEIGHT,
      });
      currentY += MAIN_ROW_HEIGHT;
      if (ch.type === 'bus' && ch.expanded) {
        const bitCount = ch.pinIds.length;
        for (let i = 0; i < bitCount; i++) {
          const bitIdx = bitCount - 1 - i;
          rows.push({
            kind: 'sub',
            parentId: ch.id,
            pinId: ch.pinIds[i],
            name: `[${bitIdx}]`,
            y: currentY,
            height: SUB_ROW_HEIGHT,
          });
          currentY += SUB_ROW_HEIGHT;
        }
      }
    }
    return { rows, totalHeight: Math.max(currentY, 120) };
  }, [channels]);

  // Helper to compute the contiguous pulse/state span [startSample, endSampleExclusive] for any row at sampleIdx
  const getPulseSpanAt = useCallback(
    (rowIdx: number, sampleIdx: number) => {
      const sampleCount = globalAnalyzerBuffer.count;
      if (
        sampleIdx < 0 ||
        sampleIdx >= sampleCount ||
        rowIdx < 0 ||
        rowIdx >= visualRows.rows.length
      ) {
        return null;
      }
      const r = visualRows.rows[rowIdx];
      if (r.kind === 'main' && r.channel.type === 'bus') {
        const pinIds = r.channel.pinIds;
        const targetVal = globalAnalyzerBuffer.getBusSampleAt(pinIds, sampleIdx);
        let s0 = sampleIdx;
        while (s0 > 0 && globalAnalyzerBuffer.getBusSampleAt(pinIds, s0 - 1) === targetVal) {
          s0--;
        }
        let s1 = sampleIdx + 1;
        while (
          s1 < sampleCount &&
          globalAnalyzerBuffer.getBusSampleAt(pinIds, s1) === targetVal
        ) {
          s1++;
        }
        const label = formatBusSample(targetVal, r.channel.radix || 'HEX', pinIds.length);
        return { startIdx: s0, endIdx: s1, stateLabel: label, row: r };
      } else {
        const pinId = r.kind === 'main' ? r.channel.pinIds[0] : r.pinId;
        const targetBit = globalAnalyzerBuffer.getPinSampleAt(pinId, sampleIdx);
        let s0 = sampleIdx;
        while (s0 > 0 && globalAnalyzerBuffer.getPinSampleAt(pinId, s0 - 1) === targetBit) {
          s0--;
        }
        let s1 = sampleIdx + 1;
        while (
          s1 < sampleCount &&
          globalAnalyzerBuffer.getPinSampleAt(pinId, s1) === targetBit
        ) {
          s1++;
        }
        const stateLabel =
          targetBit === LA_VAL_1
            ? 'HIGH'
            : targetBit === LA_VAL_0
            ? 'LOW'
            : targetBit === LA_VAL_X
            ? 'SHORT'
            : 'Hi-Z';
        return { startIdx: s0, endIdx: s1, stateLabel, row: r };
      }
    },
    [visualRows.rows]
  );

  // Fast viewport-culled HTML5 Canvas waveform renderer (< 0.15 ms per frame)
  const drawWaveformsCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const scroller = scrollContainerRef.current;
    if (!canvas || !scroller) return;

    const dpr = window.devicePixelRatio || 1;
    const viewW = scroller.clientWidth;
    const viewH = Math.max(scroller.clientHeight, visualRows.totalHeight);

    const targetW = Math.floor(viewW * dpr);
    const targetH = Math.floor(viewH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${viewW}px`;
      canvas.style.height = `${viewH}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = theme === 'dark';
    const scrollLeft = scroller.scrollLeft;
    const sampleCount = globalAnalyzerBuffer.count;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear background
    ctx.fillStyle = isDark ? '#020617' : '#ffffff';
    ctx.fillRect(0, 0, viewW, viewH);

    // Determine visible sample range [startIdx .. endIdx]
    const startIdx = Math.max(0, Math.floor(scrollLeft / tickWidth) - 1);
    const visibleSlots = Math.ceil(viewW / tickWidth) + 3;
    const maxSlots = Math.max(sampleCount, Math.ceil(viewW / tickWidth));
    const endIdx = Math.min(maxSlots, startIdx + visibleSlots);

    // 2. Vertical tick grid lines & horizontal row dividers
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.06)' : 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let s = startIdx; s <= endIdx; s++) {
      const x = Math.floor(s * tickWidth - scrollLeft) + 0.5;
      ctx.moveTo(x, RULER_HEIGHT);
      ctx.lineTo(x, viewH);
    }
    for (const r of visualRows.rows) {
      const y = r.y + r.height + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(viewW, y);
    }
    ctx.stroke();

    // 3. Draw each visible row's waveform in [startIdx .. min(endIdx, sampleCount)]
    const drawEnd = Math.min(endIdx, sampleCount);

    if (drawEnd > startIdx) {
      for (const r of visualRows.rows) {
        if (r.kind === 'main' && r.channel.type === 'bus') {
          // Draw Bus Envelope + HEX/DEC/BIN values
          const pinIds = r.channel.pinIds;
          const radix = r.channel.radix || 'HEX';
          const bitWidth = pinIds.length;
          const topY = r.y + 6;
          const botY = r.y + r.height - 6;
          const midY = r.y + r.height / 2;
          const slant = Math.min(4, tickWidth * 0.18);

          // Group consecutive identical bus values around the visible window
          let spanStart = startIdx;
          while (spanStart > 0) {
            const vPrev = globalAnalyzerBuffer.getBusSampleAt(pinIds, spanStart - 1);
            const vCur = globalAnalyzerBuffer.getBusSampleAt(pinIds, spanStart);
            if (vPrev !== vCur || spanStart <= startIdx - 16) break;
            spanStart--;
          }

          let curIdx = spanStart;
          while (curIdx < drawEnd) {
            const val = globalAnalyzerBuffer.getBusSampleAt(pinIds, curIdx);
            let nextIdx = curIdx + 1;
            while (
              nextIdx < sampleCount &&
              nextIdx <= endIdx + 16 &&
              globalAnalyzerBuffer.getBusSampleAt(pinIds, nextIdx) === val
            ) {
              nextIdx++;
            }

            const x0 = curIdx * tickWidth - scrollLeft;
            const x1 = nextIdx * tickWidth - scrollLeft;
            const w = x1 - x0;

            if (val === -1) {
              // High-Z bus
              ctx.save();
              ctx.strokeStyle = '#64748b';
              ctx.lineWidth = 1.2;
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.moveTo(x0, midY);
              ctx.lineTo(x1, midY);
              ctx.stroke();
              ctx.restore();
            } else {
              const isErr = val === -2;
              const strokeCol = isErr ? '#ef4444' : '#64748b';
              ctx.fillStyle = isErr
                ? 'rgba(239, 68, 68, 0.18)'
                : isDark
                ? 'rgba(100, 116, 139, 0.14)'
                : 'rgba(100, 116, 139, 0.08)';
              ctx.strokeStyle = strokeCol;
              ctx.lineWidth = 1.3;

              ctx.beginPath();
              ctx.moveTo(x0, midY);
              ctx.lineTo(x0 + slant, topY);
              ctx.lineTo(x1 - slant, topY);
              ctx.lineTo(x1, midY);
              ctx.lineTo(x1 - slant, botY);
              ctx.lineTo(x0 + slant, botY);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();

              if (w >= 32) {
                const label = formatBusSample(val, radix, bitWidth);
                ctx.fillStyle = isErr ? '#f87171' : isDark ? '#e2e8f0' : '#334155';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const clampedCenter = Math.max(
                  Math.max(0, x0) + 16,
                  Math.min(Math.min(viewW, x1) - 16, (x0 + x1) / 2)
                );
                ctx.fillText(label, clampedCenter, midY + 0.5);
              }
            }

            curIdx = nextIdx;
          }
        } else {
          // Single 1-bit wire or bus sub-bit
          const pinId = r.kind === 'main' ? r.channel.pinIds[0] : r.pinId;
          const isSub = r.kind === 'sub';
          const highY = r.y + (isSub ? 5 : 7);
          const lowY = r.y + r.height - (isSub ? 5 : 7);
          const midY = r.y + r.height / 2;

          // Draw High-Z dashed lines and X red blocks first
          for (let s = startIdx; s < drawEnd; s++) {
            const bit = globalAnalyzerBuffer.getPinSampleAt(pinId, s);
            const x0 = s * tickWidth - scrollLeft;
            const x1 = (s + 1) * tickWidth - scrollLeft;

            if (bit === LA_VAL_Z) {
              ctx.save();
              ctx.strokeStyle = '#64748b';
              ctx.lineWidth = 1.2;
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.moveTo(x0, midY);
              ctx.lineTo(x1, midY);
              ctx.stroke();
              ctx.restore();
            } else if (bit === LA_VAL_X) {
              ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 1.2;
              ctx.fillRect(x0, highY, tickWidth, lowY - highY);
              ctx.strokeRect(x0, highY, tickWidth, lowY - highY);
            }
          }

          // Draw continuous digital 0/1 step path
          ctx.strokeStyle = isSub ? '#64748b' : '#10b981';
          ctx.lineWidth = 1.5;
          ctx.lineJoin = 'round';
          ctx.beginPath();

          let prevY: number | null = null;
          for (let s = startIdx; s < drawEnd; s++) {
            const bit = globalAnalyzerBuffer.getPinSampleAt(pinId, s);
            if (bit !== LA_VAL_0 && bit !== LA_VAL_1) {
              prevY = null;
              continue;
            }
            const x0 = s * tickWidth - scrollLeft;
            const x1 = (s + 1) * tickWidth - scrollLeft;
            const y = bit === LA_VAL_1 ? highY : lowY;

            if (prevY === null) {
              // Check previous sample just before startIdx so vertical edge at left boundary isn't lost
              if (s === startIdx && s > 0) {
                const prevBit = globalAnalyzerBuffer.getPinSampleAt(pinId, s - 1);
                if (prevBit === LA_VAL_0 || prevBit === LA_VAL_1) {
                  const py = prevBit === LA_VAL_1 ? highY : lowY;
                  ctx.moveTo(x0, py);
                  if (py !== y) ctx.lineTo(x0, y);
                  ctx.lineTo(x1, y);
                  prevY = y;
                  continue;
                }
              }
              ctx.moveTo(x0, y);
              ctx.lineTo(x1, y);
            } else {
              if (prevY !== y) {
                ctx.lineTo(x0, y);
              }
              ctx.lineTo(x1, y);
            }
            prevY = y;
          }
          ctx.stroke();
        }
      }
    }

    // 4. Live Hover Pulse / Span Duration Overlay (0 React state overhead)
    const { sampleIdx: hSample, rowIdx: hRow } = hoverRef.current;
    if (hSample !== null && hSample >= 0 && hSample < sampleCount) {
      const hx = hSample * tickWidth + tickWidth / 2 - scrollLeft;
      if (hx >= 0 && hx <= viewW && !cursorDragRef.current.active) {
        ctx.save();
        ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.28)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(hx, RULER_HEIGHT);
        ctx.lineTo(hx, viewH);
        ctx.stroke();
        ctx.restore();
      }

      if (hRow !== null) {
        const span = getPulseSpanAt(hRow, hSample);
        if (span) {
          const px0 = span.startIdx * tickWidth - scrollLeft;
          const px1 = span.endIdx * tickWidth - scrollLeft;
          const clampedX0 = Math.max(0, px0);
          const clampedX1 = Math.min(viewW, px1);

          if (clampedX1 > clampedX0) {
            const ry = span.row.y;
            const rh = span.row.height;
            const midY = ry + rh / 2;

            // Highlight the pulse span on the hovered row
            ctx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)';
            ctx.fillRect(clampedX0, ry, clampedX1 - clampedX0, rh);

            // Dimension bracket |<--->|
            ctx.strokeStyle = isDark ? '#60a5fa' : '#2563eb';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            if (px0 >= 0 && px0 <= viewW) {
              ctx.moveTo(px0, ry + 3);
              ctx.lineTo(px0, ry + rh - 3);
            }
            if (px1 >= 0 && px1 <= viewW) {
              ctx.moveTo(px1, ry + 3);
              ctx.lineTo(px1, ry + rh - 3);
            }
            ctx.moveTo(clampedX0, midY);
            ctx.lineTo(clampedX1, midY);
            ctx.stroke();

            // Compute exact tick duration and real-time ms
            const tStart = globalAnalyzerBuffer.getTickAt(span.startIdx);
            const tEnd = globalAnalyzerBuffer.getTickAt(span.endIdx - 1);
            const spanTicks = Math.max(1, tEnd - tStart + 1);
            const durText = `${span.stateLabel}: ${formatDurationMs(spanTicks, simSpeed)} (${spanTicks}t)`;

            ctx.font = '10px monospace';
            const textW = ctx.measureText(durText).width + 10;
            const centerX = Math.max(
              textW / 2 + 4,
              Math.min(viewW - textW / 2 - 4, (clampedX0 + clampedX1) / 2)
            );
            const badgeH = 15;
            const badgeY = midY - badgeH / 2;

            ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.94)';
            ctx.strokeStyle = isDark ? '#3b82f6' : '#60a5fa';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(centerX - textW / 2, badgeY, textW, badgeH, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isDark ? '#93c5fd' : '#1d4ed8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(durText, centerX, midY + 0.5);
          }
        }
      }
    }

    // 5. Draw Top Ruler Bar (painted before cursors so cursor flags sit cleanly on top)
    ctx.fillStyle = isDark ? '#0f172a' : '#f8fafc';
    ctx.fillRect(0, 0, viewW, RULER_HEIGHT);
    ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(0, RULER_HEIGHT - 0.5);
    ctx.lineTo(viewW, RULER_HEIGHT - 0.5);
    ctx.stroke();

    ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const labelStep = tickWidth >= 28 ? 2 : 4;
    for (let s = startIdx; s <= endIdx; s++) {
      if (s < 0) continue;
      const x = Math.floor(s * tickWidth - scrollLeft) + 0.5;
      ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();

      if (s % labelStep === 0) {
        const tickNum = s < sampleCount ? globalAnalyzerBuffer.getTickAt(s) : s;
        ctx.fillText(String(tickNum), x + 3, RULER_HEIGHT / 2 + 0.5);
      }
    }

    // 6. Draw Inspection Cursors (T1 & optional T2 Range Measurement)
    const activeT1 =
      cursorLogicalIdx !== null && cursorLogicalIdx < sampleCount
        ? cursorLogicalIdx
        : null;
    const activeT2 =
      cursorEndLogicalIdx !== null &&
      cursorEndLogicalIdx < sampleCount &&
      cursorEndLogicalIdx !== activeT1
        ? cursorEndLogicalIdx
        : null;

    if (activeT1 !== null && activeT2 !== null) {
      const minIdx = Math.min(activeT1, activeT2);
      const maxIdx = Math.max(activeT1, activeT2);
      // Inclusive of the full sample span [minIdx .. maxIdx + 1]
      const xLeft = minIdx * tickWidth - scrollLeft;
      const xRight = (maxIdx + 1) * tickWidth - scrollLeft;
      const clampL = Math.max(0, xLeft);
      const clampR = Math.min(viewW, xRight);

      if (clampR > clampL) {
        ctx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.11)' : 'rgba(59, 130, 246, 0.08)';
        ctx.fillRect(clampL, RULER_HEIGHT, clampR - clampL, viewH - RULER_HEIGHT);
        ctx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.22)' : 'rgba(59, 130, 246, 0.16)';
        ctx.fillRect(clampL, 0, clampR - clampL, RULER_HEIGHT);
      }

      // Draw left boundary line (start of minIdx) and right boundary line (end of maxIdx)
      for (const [bx, tag] of [
        [xLeft, 'T1'],
        [xRight, 'T2'],
      ] as const) {
        if (bx >= -20 && bx <= viewW + 20) {
          ctx.strokeStyle = tag === 'T1' ? '#3b82f6' : '#8b5cf6';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx, 0);
          ctx.lineTo(bx, viewH);
          ctx.stroke();
        }
      }

      // Draw range duration pill in the ruler bar
      const tStart = globalAnalyzerBuffer.getTickAt(minIdx);
      const tEnd = globalAnalyzerBuffer.getTickAt(maxIdx);
      const deltaTicks = Math.max(1, tEnd - tStart + 1);
      const rangeLabel = `Δ ${formatDurationMs(deltaTicks, simSpeed)} (${deltaTicks}t · ${formatFrequencyHz(deltaTicks, simSpeed)})`;

      ctx.font = '10px monospace';
      const rw = ctx.measureText(rangeLabel).width + 12;
      const midX = Math.max(
        rw / 2 + 4,
        Math.min(viewW - rw / 2 - 4, (clampL + clampR) / 2)
      );
      ctx.fillStyle = isDark ? '#1e3a8a' : '#dbeafe';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(midX - rw / 2, 3, rw, RULER_HEIGHT - 6, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isDark ? '#dbeafe' : '#1e40af';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rangeLabel, midX, RULER_HEIGHT / 2 + 0.5);
    } else if (activeT1 !== null) {
      const cx = activeT1 * tickWidth + tickWidth / 2 - scrollLeft;
      if (cx >= -20 && cx <= viewW + 20) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, viewH);
        ctx.stroke();

        // Top ruler cursor flag
        const tickNum = globalAnalyzerBuffer.getTickAt(activeT1);
        const flagText = `T1: ${tickNum} (${formatDurationMs(tickNum, simSpeed)})`;
        ctx.font = '9px monospace';
        const fw = ctx.measureText(flagText).width + 8;
        const fx = Math.max(fw / 2 + 2, Math.min(viewW - fw / 2 - 2, cx));
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.roundRect(fx - fw / 2, 3, fw, RULER_HEIGHT - 6, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(flagText, fx, RULER_HEIGHT / 2 + 0.5);
      }
    }

    ctx.restore();
  }, [theme, tickWidth, visualRows, cursorLogicalIdx, cursorEndLogicalIdx, simSpeed, getPulseSpanAt]);

  // Redraw canvas whenever layout/channels/zoom/cursor change
  useEffect(() => {
    if (!isOpen || activeTab !== 'waveforms') return;
    drawWaveformsCanvas();
  }, [isOpen, activeTab, drawWaveformsCanvas, channels]);

  // Subscribe to simulation ticks (throttled to ~20 FPS so high-speed simulation never lags the UI)
  useEffect(() => {
    if (!isOpen) return;
    let lastFlush = 0;
    let pendingRaf: number | null = null;

    const flush = () => {
      pendingRaf = null;
      lastFlush = performance.now();
      const scroller = scrollContainerRef.current;
      if (scroller && autoScroll) {
        const totalContentW = globalAnalyzerBuffer.count * tickWidth;
        if (totalContentW > scroller.clientWidth) {
          scroller.scrollLeft = totalContentW - scroller.clientWidth + tickWidth;
        }
      }
      drawWaveformsCanvas();
      setRenderTick(v => (v + 1) & 0xffff);
    };

    const unsub = subscribeTickCount(() => {
      const now = performance.now();
      if (now - lastFlush >= 50) {
        flush();
      } else if (pendingRaf === null) {
        pendingRaf = window.requestAnimationFrame(flush);
      }
    });

    return () => {
      unsub();
      if (pendingRaf !== null) window.cancelAnimationFrame(pendingRaf);
    };
  }, [isOpen, autoScroll, tickWidth, drawWaveformsCanvas]);

  // Zero-CPU direct DOM height update during drag resize
  const isResizingRef = useRef<boolean>(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(250);
  const liveHeightRef = useRef<number>(250);

  useEffect(() => {
    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaY = startYRef.current - e.clientY;
      const nextHeight = Math.max(
        160,
        Math.min(window.innerHeight - 140, startHeightRef.current + deltaY)
      );
      liveHeightRef.current = nextHeight;

      if (rafId === null) {
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          if (drawerRef.current) {
            drawerRef.current.style.height = `${liveHeightRef.current}px`;
          }
          drawWaveformsCanvas();
        });
      }
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDrawerHeight(liveHeightRef.current);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [drawWaveformsCanvas]);

  // Discoverable probes for "+ Add Signal" menu
  const discoverableProbes = useMemo(() => {
    if (!showAddMenu) return [];
    const selectedIds =
      multiSelection.length > 0
        ? multiSelection
        : selection?.type === 'node'
        ? [selection.id]
        : [];
    const all = discoverCircuitProbes(nodes, wires, selectedIds);
    const existingKeys = new Set(channels.map(c => c.pinIds.join(',')));
    return all.filter(p => !existingKeys.has(p.pinIds.join(',')));
  }, [showAddMenu, nodes, wires, selection, multiSelection, channels]);

  if (!isOpen) {
    return null;
  }

  const toggleBusExpand = (id: string) => {
    setChannels(prev =>
      prev.map(ch => (ch.id === id ? { ...ch, expanded: !ch.expanded } : ch))
    );
  };

  const cycleBusRadix = (id: string) => {
    const order: BusRadix[] = ['HEX', 'DEC', 'BIN'];
    setChannels(prev =>
      prev.map(ch => {
        if (ch.id !== id) return ch;
        const nextIdx = (order.indexOf(ch.radix || 'HEX') + 1) % order.length;
        return { ...ch, radix: order[nextIdx] };
      })
    );
  };

  const removeChannel = (id: string) => {
    setChannels(prev => prev.filter(ch => ch.id !== id));
  };

  const handleAddProbe = (probe: {
    name: string;
    type: 'wire' | 'bus';
    pinIds: string[];
    radix?: BusRadix;
  }) => {
    setChannels(prev => [
      ...prev,
      {
        id: generateId('ch'),
        name: probe.name,
        type: probe.type,
        pinIds: probe.pinIds,
        radix: probe.radix || 'HEX',
        expanded: false,
      },
    ]);
    setShowAddMenu(false);
  };

  const handleAutoDetect = () => {
    const selectedIds =
      multiSelection.length > 0
        ? multiSelection
        : selection?.type === 'node'
        ? [selection.id]
        : [];
    const discovered = discoverCircuitProbes(nodes, wires, selectedIds);
    if (discovered.length === 0) return;

    // Collect all pins that belong to discovered multi-bit buses so we don't duplicate
    // individual [#] bit signals (like A[0], A[1]) when their bus A[N:0] is already added.
    const busPinSet = new Set<string>();
    const buses = discovered.filter(p => p.type === 'bus' && p.category !== 'Selected');
    for (const b of buses) {
      for (const pid of b.pinIds) busPinSet.add(pid);
    }

    const clocks = discovered.filter(
      p => p.type === 'wire' && p.category === 'Signals & Clocks' && /^CLK/i.test(p.name)
    );
    const standaloneWires = discovered.filter(
      p =>
        p.type === 'wire' &&
        p.category !== 'Selected' &&
        !busPinSet.has(p.pinIds[0]) &&
        !/^CLK/i.test(p.name)
    );

    const prioritized = [...clocks, ...buses, ...standaloneWires];
    const seenKeys = new Set<string>();
    const picked: typeof prioritized = [];
    for (const p of prioritized) {
      const key = p.pinIds.join(',');
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        picked.push(p);
      }
      if (picked.length >= 8) break;
    }

    setChannels(
      picked.map(p => ({
        id: generateId('ch'),
        name: p.name,
        type: p.type,
        pinIds: p.pinIds,
        radix: p.radix || 'HEX',
        expanded: false,
      }))
    );
    setShowAddMenu(false);
  };

  const handleCreateCustomBus = (e: React.FormEvent) => {
    e.preventDefault();
    if (customBusPinIds.length === 0) return;
    setChannels(prev => [
      ...prev,
      {
        id: generateId('ch'),
        name: customBusName.trim() || `BUS[${customBusPinIds.length - 1}:0]`,
        type: 'bus',
        pinIds: customBusPinIds,
        radix: 'HEX',
        expanded: false,
      },
    ]);
    setCustomBusMode(false);
    setCustomBusPinIds([]);
    setShowAddMenu(false);
  };

  const handleAddBreakpoint = (e: React.FormEvent) => {
    e.preventDefault();
    const isShort = newBpCond === 'short_circuit';
    const targetCh = channels.find(c => c.id === newBpTargetId);
    const targetChannelId = isShort && !targetCh ? '__ANY_NET__' : targetCh?.id || '__ANY_NET__';
    const targetLabel =
      targetChannelId === '__ANY_NET__' ? 'Any Net' : targetCh?.name || 'Signal';

    setBreakpoints(prev => [
      ...prev,
      {
        id: generateId('bp'),
        enabled: true,
        targetChannelId,
        targetLabel,
        conditionType: newBpCond,
        value: newBpCond === 'equals' ? newBpVal.trim() || '0x00' : undefined,
        hitCount: 0,
      },
    ]);
  };

  const updateBreakpointField = (id: string, patch: Partial<(typeof breakpoints)[0]>) => {
    setBreakpoints(prev => prev.map(bp => (bp.id === id ? { ...bp, ...patch } : bp)));
  };

  const sampleCount = globalAnalyzerBuffer.count;
  const inspectedIdx =
    cursorLogicalIdx !== null && cursorLogicalIdx < sampleCount
      ? cursorLogicalIdx
      : sampleCount > 0
      ? sampleCount - 1
      : -1;
  const inspectedTick =
    inspectedIdx >= 0 ? globalAnalyzerBuffer.getTickAt(inspectedIdx) : null;

  const activeRangeSummary = (() => {
    if (cursorLogicalIdx === null || cursorLogicalIdx >= sampleCount) return null;
    if (
      cursorEndLogicalIdx !== null &&
      cursorEndLogicalIdx < sampleCount &&
      cursorEndLogicalIdx !== cursorLogicalIdx
    ) {
      const minIdx = Math.min(cursorLogicalIdx, cursorEndLogicalIdx);
      const maxIdx = Math.max(cursorLogicalIdx, cursorEndLogicalIdx);
      const tStart = globalAnalyzerBuffer.getTickAt(minIdx);
      const tEnd = globalAnalyzerBuffer.getTickAt(maxIdx);
      const deltaTicks = Math.max(1, tEnd - tStart + 1);
      return {
        isRange: true,
        text: `Δ ${formatDurationMs(deltaTicks, simSpeed)} (${deltaTicks}t · ${formatFrequencyHz(deltaTicks, simSpeed)})`,
      };
    }
    const tickNum = globalAnalyzerBuffer.getTickAt(cursorLogicalIdx);
    return {
      isRange: false,
      text: `T1: #${tickNum} (${formatDurationMs(tickNum, simSpeed)})`,
    };
  })();

  const stepCursor = (delta: number) => {
    if (sampleCount === 0) return;
    const base =
      cursorLogicalIdx !== null && cursorLogicalIdx < sampleCount
        ? cursorLogicalIdx
        : sampleCount - 1;
    const next = Math.max(0, Math.min(sampleCount - 1, base + delta));
    setCursorLogicalIdx(next);
    setCursorEndLogicalIdx(null);
  };

  const activeBreakpointCount = breakpoints.filter(b => b.enabled).length;

  return (
    <div
      ref={drawerRef}
      style={{ height: isMaximized ? '100%' : `${drawerHeight}px` }}
      className="absolute bottom-0 left-0 right-0 z-20 bg-white dark:bg-slate-900 border-t border-gray-300 dark:border-slate-700 flex flex-col shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
    >
      {/* Subtle Top Drag Handle */}
      {!isMaximized && (
        <div
          onMouseDown={(e) => {
            isResizingRef.current = true;
            startYRef.current = e.clientY;
            startHeightRef.current = drawerHeight;
            liveHeightRef.current = drawerHeight;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
          }}
          className="h-1.5 w-full cursor-ns-resize bg-transparent hover:bg-blue-500/40 transition-colors shrink-0"
          title="Drag to resize"
        />
      )}

      {/* Minimal Header Bar */}
      <div className="h-9 px-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between select-none shrink-0">
        {/* Left: Clean Tab Switcher + Measurement Pill + Triggered Banner */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                setActiveTab('waveforms');
                setShowAddMenu(false);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                activeTab === 'waveforms'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-2xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
            >
              Waveforms
            </button>
            <button
              onClick={() => {
                setActiveTab('breakpoints');
                setShowAddMenu(false);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'breakpoints'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-2xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
            >
              <span>Breakpoints</span>
              {activeBreakpointCount > 0 && (
                <span className="text-[10px] font-mono text-gray-400 dark:text-slate-400">
                  ({activeBreakpointCount})
                </span>
              )}
            </button>
          </div>

          {activeTab === 'waveforms' && activeRangeSummary && (
            <div className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/25 truncate">
              <button
                onClick={() => stepCursor(-1)}
                className="hover:text-blue-500 px-0.5"
                title="Step cursor left (←)"
              >
                ‹
              </button>
              <span className="truncate">{activeRangeSummary.text}</span>
              <button
                onClick={() => stepCursor(1)}
                className="hover:text-blue-500 px-0.5"
                title="Step cursor right (→)"
              >
                ›
              </button>
              <button
                onClick={() => {
                  setCursorLogicalIdx(null);
                  setCursorEndLogicalIdx(null);
                }}
                className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                title="Clear cursor / measurement (Esc)"
              >
                ×
              </button>
            </div>
          )}

          {lastTriggeredBpId && (
            <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 truncate">
              {lastTriggeredBpId === '__TRAP_SHORT__'
                ? 'Paused: Short circuit (X) detected'
                : `Paused at breakpoint (${
                    breakpoints.find(b => b.id === lastTriggeredBpId)?.targetLabel || 'Hit'
                  })`}
            </span>
          )}
        </div>

        {/* Right: Minimal Actions & Menus */}
        <div className="flex items-center gap-1 relative">
          {activeTab === 'waveforms' && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowAddMenu(!showAddMenu);
                  setCustomBusMode(false);
                  setShowMoreMenu(false);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-200/70 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <Plus size={14} />
                <span>Add Signal</span>
              </button>

              {showAddMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAddMenu(false)}
                  />
                  {!customBusMode ? (
                    <div className="absolute right-0 top-full mt-1 w-64 max-h-72 overflow-y-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg py-1 z-50 text-xs">
                      {discoverableProbes.length === 0 ? (
                        <div className="px-3 py-3 text-gray-400 dark:text-slate-500 text-center">
                          {nodes.length === 0
                            ? 'Place components on the canvas first'
                            : 'All discovered signals are already added'}
                        </div>
                      ) : (
                        <>
                          {nodes.length > 0 && (
                            <div className="px-1.5 pt-1 pb-1.5 border-b border-gray-100 dark:border-slate-700/70 mb-1">
                              <button
                                onClick={handleAutoDetect}
                                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-medium transition-colors"
                              >
                                <Sparkles size={13} />
                                <span>Auto-detect Buses & Signals</span>
                              </button>
                            </div>
                          )}
                          {(['Selected', 'Buses & ICs', 'Signals & Clocks', 'Net Labels'] as const).map(
                            cat => {
                              const group = discoverableProbes.filter(p => p.category === cat);
                              if (group.length === 0) return null;
                              return (
                                <div key={cat} className="mb-1">
                                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                                    {cat}
                                  </div>
                                  {group.map((p, idx) => (
                                    <button
                                      key={`${p.name}-${idx}`}
                                      onClick={() => handleAddProbe(p)}
                                      className="w-full text-left px-3 py-1.5 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 font-mono flex items-center justify-between"
                                    >
                                      <span className="truncate">+ {p.name}</span>
                                      {p.type === 'bus' && (
                                        <span className="text-[10px] text-blue-500 dark:text-blue-400 ml-2 shrink-0">
                                          bus ({p.pinIds.length}-bit)
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              );
                            }
                          )}
                        </>
                      )}

                      {channels.some(c => c.type === 'wire') && (
                        <>
                          <div className="my-1 border-t border-gray-200 dark:border-slate-700" />
                          <button
                            onClick={() => {
                              setCustomBusMode(true);
                              setCustomBusPinIds(
                                channels
                                  .filter(c => c.type === 'wire')
                                  .map(c => c.pinIds[0])
                              );
                            }}
                            className="w-full text-left px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 font-medium"
                          >
                            + Group Signals into Bus...
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <form
                      onSubmit={handleCreateCustomBus}
                      className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg p-3 z-50 space-y-2.5 text-xs"
                    >
                      <div className="font-medium text-gray-800 dark:text-slate-200">
                        Group Signals into Bus
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 dark:text-slate-400 mb-1">
                          Bus Name
                        </label>
                        <input
                          type="text"
                          value={customBusName}
                          onChange={(e) => setCustomBusName(e.target.value)}
                          placeholder="BUS[7:0]"
                          className="w-full text-xs font-mono bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded px-2 py-1 text-gray-800 dark:text-slate-200"
                        />
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 border border-gray-200 dark:border-slate-700 rounded p-1.5">
                        {channels
                          .filter(c => c.type === 'wire')
                          .map(c => {
                            const pid = c.pinIds[0];
                            const checked = customBusPinIds.includes(pid);
                            return (
                              <label
                                key={c.id}
                                className="flex items-center gap-2 text-xs font-mono text-gray-700 dark:text-slate-200 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setCustomBusPinIds(prev =>
                                      checked
                                        ? prev.filter(x => x !== pid)
                                        : [...prev, pid]
                                    )
                                  }
                                  className="rounded accent-blue-600"
                                />
                                <span className="truncate">{c.name}</span>
                              </label>
                            );
                          })}
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setCustomBusMode(false)}
                          className="px-2 py-1 text-gray-500 hover:text-gray-700 dark:text-slate-400"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={customBusPinIds.length < 2}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded font-medium"
                        >
                          Create Bus
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          )}

          {/* Zoom buttons (only in Waveforms tab) */}
          {activeTab === 'waveforms' && (
            <>
              <button
                onClick={() => setTickWidth(w => Math.max(10, w - 4))}
                className="p-1 text-gray-500 dark:text-slate-400 hover:bg-gray-200/70 dark:hover:bg-slate-700 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={() => setTickWidth(w => Math.min(56, w + 4))}
                className="p-1 text-gray-500 dark:text-slate-400 hover:bg-gray-200/70 dark:hover:bg-slate-700 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
            </>
          )}

          {/* Overflow Options Menu (⋮) */}
          <div className="relative">
            <button
              onClick={() => {
                setShowMoreMenu(!showMoreMenu);
                setShowAddMenu(false);
              }}
              className="p-1 text-gray-500 dark:text-slate-400 hover:bg-gray-200/70 dark:hover:bg-slate-700 rounded transition-colors"
              title="Waveforms Options"
            >
              <MoreVertical size={14} />
            </button>

            {showMoreMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMoreMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg py-1.5 z-50 text-xs">
                  <label className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-gray-700 dark:text-slate-200">
                    <span>Auto-scroll with clock</span>
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                      className="rounded accent-blue-600"
                    />
                  </label>
                  <label className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-gray-700 dark:text-slate-200">
                    <span>Pause on Short ('X')</span>
                    <input
                      type="checkbox"
                      checked={trapShortCircuit}
                      onChange={(e) => setTrapShortCircuit(e.target.checked)}
                      className="rounded accent-blue-600"
                    />
                  </label>
                  <div className="my-1 border-t border-gray-200 dark:border-slate-700" />
                  <button
                    onClick={() => {
                      clearAnalyzerHistory();
                      setCursorLogicalIdx(null);
                      setCursorEndLogicalIdx(null);
                      drawWaveformsCanvas();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <Eraser size={13} />
                    <span>Clear recorded history</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="h-3.5 w-px bg-gray-300 dark:bg-slate-700 mx-0.5" />

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 text-gray-500 dark:text-slate-400 hover:bg-gray-200/70 dark:hover:bg-slate-700 rounded transition-colors"
            title={isMaximized ? 'Restore Size' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            onClick={() => {
              setIsMaximized(false);
              onToggleOpen();
            }}
            className="p-1 text-gray-500 dark:text-slate-400 hover:bg-gray-200/70 dark:hover:bg-slate-700 rounded transition-colors"
            title="Close Panel"
          >
            <ChevronDown size={15} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'waveforms' ? (
        channels.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-gray-400 dark:text-slate-500">
            <span>No signals added to Waveforms yet.</span>
            {nodes.length > 0 && (
              <button
                onClick={handleAutoDetect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors"
              >
                <Sparkles size={13} />
                <span>Auto-detect Circuit Signals</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden min-w-0">
            {/* Left: Clean Signal Names Column */}
            <div className="w-52 shrink-0 border-r border-gray-200 dark:border-slate-800 flex flex-col bg-gray-50/40 dark:bg-slate-900">
              <div className="h-6 px-3 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-medium text-gray-400 dark:text-slate-500 shrink-0">
                <span>Signal</span>
                <span>{inspectedTick !== null ? `@ Tick ${inspectedTick}` : 'Value'}</span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60">
                {channels.map(ch => {
                  let valStr = '—';
                  if (inspectedIdx >= 0) {
                    if (ch.type === 'bus') {
                      const bVal = globalAnalyzerBuffer.getBusSampleAt(ch.pinIds, inspectedIdx);
                      valStr = formatBusSample(bVal, ch.radix, ch.pinIds.length);
                    } else {
                      const pVal = globalAnalyzerBuffer.getPinSampleAt(
                        ch.pinIds[0],
                        inspectedIdx
                      );
                      valStr =
                        pVal === LA_VAL_0
                          ? '0'
                          : pVal === LA_VAL_1
                          ? '1'
                          : pVal === LA_VAL_X
                          ? 'X'
                          : 'Z';
                    }
                  }

                  return (
                    <React.Fragment key={ch.id}>
                      <div className="h-8 px-2.5 flex items-center justify-between gap-2 hover:bg-gray-100/80 dark:hover:bg-slate-800/60 group">
                        <div className="flex items-center gap-1 min-w-0">
                          {ch.type === 'bus' ? (
                            <button
                              onClick={() => toggleBusExpand(ch.id)}
                              className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200"
                            >
                              {ch.expanded ? (
                                <ChevronDown size={12} />
                              ) : (
                                <ChevronRight size={12} />
                              )}
                            </button>
                          ) : (
                            <span className="w-3.5 shrink-0" />
                          )}
                          <span className="text-xs font-mono text-gray-800 dark:text-slate-200 truncate">
                            {ch.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {ch.type === 'bus' && (
                            <button
                              onClick={() => cycleBusRadix(ch.id)}
                              className="opacity-0 group-hover:opacity-100 text-[9px] font-mono px-1 rounded bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 transition-opacity"
                              title="Switch format (HEX / DEC / BIN)"
                            >
                              {ch.radix}
                            </button>
                          )}
                          <span
                            className={`text-[11px] font-mono tabular-nums ${
                              valStr === 'X'
                                ? 'text-red-500 font-bold'
                                : 'text-gray-500 dark:text-slate-400'
                            }`}
                          >
                            {valStr}
                          </span>
                          <button
                            onClick={() => removeChannel(ch.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-opacity"
                            title="Remove Signal"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {ch.type === 'bus' &&
                        ch.expanded &&
                        (() => {
                          const rangeMatch = ch.name.match(/\[(\d+):(\d+)\]/);
                          const lowBit = rangeMatch
                            ? Math.min(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10))
                            : 0;
                          return ch.pinIds.map((pid, idx) => {
                            const bitIdx = lowBit + (ch.pinIds.length - 1 - idx);
                            const bSample =
                              inspectedIdx >= 0
                                ? globalAnalyzerBuffer.getPinSampleAt(pid, inspectedIdx)
                                : LA_VAL_Z;
                            const bStr =
                              bSample === LA_VAL_0
                                ? '0'
                                : bSample === LA_VAL_1
                                ? '1'
                                : bSample === LA_VAL_X
                                ? 'X'
                                : 'Z';
                            return (
                              <div
                                key={pid}
                                className="h-6 pl-7 pr-3 flex items-center justify-between bg-gray-50/70 dark:bg-slate-900/60 text-[11px] font-mono text-gray-500 dark:text-slate-400"
                              >
                                <span>[{bitIdx}]</span>
                                <span>{bStr}</span>
                              </div>
                            );
                          });
                        })()}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Right: Viewport-Culled HTML5 Canvas Timeline */}
            <div
              ref={scrollContainerRef}
              tabIndex={0}
              onScroll={() => drawWaveformsCanvas()}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  stepCursor(e.shiftKey ? -5 : -1);
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  stepCursor(e.shiftKey ? 5 : 1);
                } else if (e.key === 'Escape') {
                  setCursorLogicalIdx(null);
                  setCursorEndLogicalIdx(null);
                }
              }}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                const scroller = scrollContainerRef.current;
                if (!scroller || globalAnalyzerBuffer.count === 0) return;
                scroller.focus({ preventScroll: true });
                const rect = scroller.getBoundingClientRect();
                const clickX = e.clientX - rect.left + scroller.scrollLeft;
                const idx = Math.max(
                  0,
                  Math.min(
                    globalAnalyzerBuffer.count - 1,
                    Math.floor(clickX / tickWidth)
                  )
                );

                // Check if user grabbed near existing T1 or T2 boundary to adjust it
                if (
                  cursorLogicalIdx !== null &&
                  cursorEndLogicalIdx !== null &&
                  cursorLogicalIdx !== cursorEndLogicalIdx
                ) {
                  const minIdx = Math.min(cursorLogicalIdx, cursorEndLogicalIdx);
                  const maxIdx = Math.max(cursorLogicalIdx, cursorEndLogicalIdx);
                  const xLeft = minIdx * tickWidth;
                  const xRight = (maxIdx + 1) * tickWidth;
                  if (Math.abs(clickX - xLeft) <= 8) {
                    cursorDragRef.current = { active: true, mode: 't1', anchorIdx: maxIdx };
                    setCursorLogicalIdx(idx);
                    setCursorEndLogicalIdx(maxIdx);
                    return;
                  }
                  if (Math.abs(clickX - xRight) <= 8) {
                    cursorDragRef.current = { active: true, mode: 't2', anchorIdx: minIdx };
                    setCursorLogicalIdx(minIdx);
                    setCursorEndLogicalIdx(idx);
                    return;
                  }
                }

                // Shift+Click extends existing T1 into a [T1..T2] range measurement
                if (e.shiftKey && cursorLogicalIdx !== null) {
                  cursorDragRef.current = {
                    active: true,
                    mode: 't2',
                    anchorIdx: cursorLogicalIdx,
                  };
                  setCursorEndLogicalIdx(idx);
                  return;
                }

                cursorDragRef.current = { active: true, mode: 'new', anchorIdx: idx };
                setCursorLogicalIdx(idx);
                setCursorEndLogicalIdx(null);
              }}
              onMouseMove={(e) => {
                const scroller = scrollContainerRef.current;
                if (!scroller || globalAnalyzerBuffer.count === 0) return;
                const rect = scroller.getBoundingClientRect();
                const relX = e.clientX - rect.left + scroller.scrollLeft;
                const relY = e.clientY - rect.top + scroller.scrollTop;

                const sampleIdx = Math.max(
                  0,
                  Math.min(
                    globalAnalyzerBuffer.count - 1,
                    Math.floor(relX / tickWidth)
                  )
                );

                let rowIdx: number | null = null;
                if (relY >= RULER_HEIGHT) {
                  for (let i = 0; i < visualRows.rows.length; i++) {
                    const r = visualRows.rows[i];
                    if (relY >= r.y && relY < r.y + r.height) {
                      rowIdx = i;
                      break;
                    }
                  }
                }

                const prevHover = hoverRef.current;
                if (prevHover.sampleIdx !== sampleIdx || prevHover.rowIdx !== rowIdx) {
                  hoverRef.current = { sampleIdx, rowIdx };
                  drawWaveformsCanvas();
                }

                if (cursorDragRef.current.active) {
                  const anchor = cursorDragRef.current.anchorIdx;
                  if (sampleIdx === anchor) {
                    setCursorLogicalIdx(anchor);
                    setCursorEndLogicalIdx(null);
                  } else {
                    setCursorLogicalIdx(anchor);
                    setCursorEndLogicalIdx(sampleIdx);
                  }
                }
              }}
              onMouseUp={() => {
                cursorDragRef.current.active = false;
              }}
              onMouseLeave={() => {
                cursorDragRef.current.active = false;
                if (hoverRef.current.sampleIdx !== null || hoverRef.current.rowIdx !== null) {
                  hoverRef.current = { sampleIdx: null, rowIdx: null };
                  drawWaveformsCanvas();
                }
              }}
              onDoubleClick={(e) => {
                const scroller = scrollContainerRef.current;
                if (!scroller || globalAnalyzerBuffer.count === 0) return;
                const rect = scroller.getBoundingClientRect();
                const relX = e.clientX - rect.left + scroller.scrollLeft;
                const relY = e.clientY - rect.top + scroller.scrollTop;

                // Double-clicking on ruler clears cursor/measurement
                if (relY < RULER_HEIGHT) {
                  setCursorLogicalIdx(null);
                  setCursorEndLogicalIdx(null);
                  return;
                }

                // Double-clicking on a waveform pulse snaps [T1..T2] to that pulse's exact start & end edges
                const sampleIdx = Math.max(
                  0,
                  Math.min(
                    globalAnalyzerBuffer.count - 1,
                    Math.floor(relX / tickWidth)
                  )
                );
                for (let i = 0; i < visualRows.rows.length; i++) {
                  const r = visualRows.rows[i];
                  if (relY >= r.y && relY < r.y + r.height) {
                    const span = getPulseSpanAt(i, sampleIdx);
                    if (span) {
                      setCursorLogicalIdx(span.startIdx);
                      setCursorEndLogicalIdx(
                        span.endIdx - 1 > span.startIdx ? span.endIdx - 1 : null
                      );
                    }
                    break;
                  }
                }
              }}
              className="flex-1 overflow-auto relative bg-white dark:bg-slate-950 cursor-crosshair focus:outline-none"
              title="Click to inspect · Drag or Shift+Click to measure range · Double-click pulse to measure pulse width"
            >
              {/* Spacer div defines scrollable width for recorded ticks */}
              <div
                style={{
                  width: `${Math.max(sampleCount * tickWidth, 100)}px`,
                  height: `${visualRows.totalHeight}px`,
                }}
                className="relative"
              >
                <canvas
                  ref={canvasRef}
                  className="sticky left-0 top-0 block pointer-events-none"
                />
              </div>
            </div>
          </div>
        )
      ) : (
        /* Breakpoints View: Clean Structured Table + Inline Quick-Add Row */
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950">
          {/* Inline Quick-Add Bar */}
          <form
            onSubmit={handleAddBreakpoint}
            className="px-4 py-2 bg-gray-50/70 dark:bg-slate-900/70 border-b border-gray-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
          >
            <span className="text-xs text-gray-500 dark:text-slate-400 mr-1">
              Pause when:
            </span>

            <select
              value={newBpTargetId}
              onChange={(e) => {
                const val = e.target.value;
                setNewBpTargetId(val);
                if (val === '__ANY_NET__') {
                  setNewBpCond('short_circuit');
                } else {
                  const ch = channels.find(c => c.id === val);
                  if (ch?.type === 'bus' && newBpCond !== 'equals') {
                    setNewBpCond('equals');
                  }
                }
              }}
              className="text-xs font-mono bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2.5 py-1 text-gray-800 dark:text-slate-200"
            >
              {channels.map(ch => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
              <option value="__ANY_NET__">Any Net (Global)</option>
            </select>

            <select
              value={newBpCond}
              onChange={(e) =>
                setNewBpCond(e.target.value as BreakpointCondition)
              }
              className="text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2.5 py-1 text-gray-800 dark:text-slate-200"
            >
              <option value="equals">equals (==)</option>
              <option value="rising">rises (0 → 1)</option>
              <option value="falling">falls (1 → 0)</option>
              <option value="high">is High (1)</option>
              <option value="low">is Low (0)</option>
              <option value="short_circuit">has Short Circuit (X)</option>
            </select>

            {newBpCond === 'equals' && (
              <input
                type="text"
                value={newBpVal}
                onChange={(e) => setNewBpVal(e.target.value)}
                placeholder="0x0A or 1"
                className="w-28 text-xs font-mono bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2.5 py-1 text-gray-800 dark:text-slate-200"
              />
            )}

            <button
              type="submit"
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded flex items-center gap-1 transition-colors"
            >
              <Plus size={13} />
              <span>Add</span>
            </button>
          </form>

          {/* Table Header */}
          <div className="grid grid-cols-12 px-4 py-1.5 border-b border-gray-200 dark:border-slate-800 text-[11px] font-medium text-gray-400 dark:text-slate-500 select-none shrink-0">
            <div className="col-span-1">Active</div>
            <div className="col-span-4">Signal / Bus</div>
            <div className="col-span-3">Condition</div>
            <div className="col-span-2">Value</div>
            <div className="col-span-1">Hits</div>
            <div className="col-span-1 text-right"></div>
          </div>

          {/* Table Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/70">
            {breakpoints.length === 0 ? (
              <div className="text-xs text-gray-400 dark:text-slate-500 py-8 text-center">
                No breakpoints configured. Use the bar above to pause simulation on a condition.
              </div>
            ) : (
              breakpoints.map(bp => {
                const isTriggered = lastTriggeredBpId === bp.id;
                return (
                  <div
                    key={bp.id}
                    className={`grid grid-cols-12 items-center px-4 py-2 text-xs transition-colors group ${
                      isTriggered
                        ? 'bg-amber-500/10 dark:bg-amber-950/30'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-900/60'
                    } ${!bp.enabled ? 'opacity-50' : ''}`}
                  >
                    {/* Active Checkbox */}
                    <div className="col-span-1 flex items-center">
                      <input
                        type="checkbox"
                        checked={bp.enabled}
                        onChange={() =>
                          updateBreakpointField(bp.id, { enabled: !bp.enabled })
                        }
                        className="rounded accent-blue-600 cursor-pointer"
                      />
                    </div>

                    {/* Target Signal / Bus */}
                    <div className="col-span-4 font-mono font-medium text-gray-800 dark:text-slate-200 truncate pr-2">
                      {bp.targetLabel}
                    </div>

                    {/* Condition Selector (editable inline) */}
                    <div className="col-span-3 pr-2">
                      <select
                        value={bp.conditionType}
                        onChange={(e) =>
                          updateBreakpointField(bp.id, {
                            conditionType: e.target.value as BreakpointCondition,
                          })
                        }
                        className="text-xs bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800 border border-transparent hover:border-gray-300 dark:hover:border-slate-700 rounded px-1.5 py-0.5 text-gray-700 dark:text-slate-300 focus:outline-none"
                      >
                        <option value="equals">Equals (==)</option>
                        <option value="rising">Rising edge (0 → 1)</option>
                        <option value="falling">Falling edge (1 → 0)</option>
                        <option value="high">Is High (1)</option>
                        <option value="low">Is Low (0)</option>
                        <option value="short_circuit">Short circuit (X)</option>
                      </select>
                    </div>

                    {/* Value (editable inline when condition === 'equals') */}
                    <div className="col-span-2 font-mono text-gray-600 dark:text-slate-300">
                      {bp.conditionType === 'equals' ? (
                        <input
                          type="text"
                          value={bp.value || ''}
                          onChange={(e) =>
                            updateBreakpointField(bp.id, { value: e.target.value })
                          }
                          className="w-24 bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 border border-transparent hover:border-gray-300 dark:hover:border-slate-700 focus:border-blue-500 rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none"
                        />
                      ) : (
                        <span className="text-gray-400 dark:text-slate-600 px-1.5">—</span>
                      )}
                    </div>

                    {/* Hits counter */}
                    <div className="col-span-1 font-mono text-gray-400 dark:text-slate-500 tabular-nums">
                      {bp.hitCount}
                    </div>

                    {/* Delete */}
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() =>
                          setBreakpoints(prev => prev.filter(b => b.id !== bp.id))
                        }
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-opacity"
                        title="Delete breakpoint"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
