import React, { useEffect, useRef, useState } from 'react';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { useSimulatorStore, subscribeTickCount } from '../../store/useSimulatorStore';
import {
  isTauriEnvironment,
  getLastRustStepElapsedUs,
  getCompiledRustPinCount,
} from '../../core/engine/tauriBridge';

export const DebugOverlay: React.FC = React.memo(() => {
  if (!import.meta.env.DEV) {
    return null;
  }

  const [collapsed, setCollapsed] = useState(false);

  const nodeCount = useSimulatorStore(state => state.nodes.length);
  const wireCount = useSimulatorStore(state => state.wires.length);
  const simSpeed = useSimulatorStore(state => state.simSpeed);
  const stepTicks = useSimulatorStore(state => state.stepTicks);
  const simRunning = useSimulatorStore(state => state.simRunning);
  const schematicScale = useSimulatorStore(state => state.schematicScale);
  const schematicPos = useSimulatorStore(state => state.schematicPos);

  const tickRef = useRef<HTMLSpanElement>(null);
  const rustUsRef = useRef<HTMLSpanElement>(null);
  const pinsRef = useRef<HTMLSpanElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);

  // Direct DOM updates for high-frequency tick & Rust step timing (0 React re-renders)
  useEffect(() => {
    if (collapsed) return;
    let lastUpdate = 0;
    return subscribeTickCount((tickCount) => {
      const now = performance.now();
      if (!useSimulatorStore.getState().simRunning || tickCount <= 1 || now - lastUpdate >= 90) {
        lastUpdate = now;
        if (tickRef.current) {
          tickRef.current.textContent = String(tickCount);
        }
        if (rustUsRef.current) {
          rustUsRef.current.textContent = `${getLastRustStepElapsedUs()} µs`;
        }
        if (pinsRef.current) {
          pinsRef.current.textContent = String(getCompiledRustPinCount());
        }
      }
    });
  }, [collapsed]);

  // Lightweight rAF FPS counter
  useEffect(() => {
    if (collapsed) return;
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId = 0;

    const loop = (now: number) => {
      frameCount++;
      const elapsed = now - lastTime;
      if (elapsed >= 500) {
        const fps = Math.round((frameCount * 1000) / elapsed);
        if (fpsRef.current) {
          fpsRef.current.textContent = `${fps}`;
        }
        if (pinsRef.current) {
          pinsRef.current.textContent = String(getCompiledRustPinCount());
        }
        frameCount = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [collapsed]);

  const initialTick = useSimulatorStore.getState().simState.tickCount;
  const isTauri = isTauriEnvironment();

  if (collapsed) {
    return (
      <div className="absolute bottom-2.5 left-2.5 z-30 pointer-events-auto select-none">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-950/85 text-slate-300 border border-slate-700/80 shadow-md text-[11px] font-mono hover:text-white hover:border-slate-600 backdrop-blur-sm transition-colors"
          title="Expand Debug Overlay (DEV build)"
        >
          <Bug size={12} className="text-orange-400 shrink-0" />
          <span>DBG</span>
          <ChevronUp size={11} />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-2.5 left-2.5 z-30 pointer-events-none select-none">
      <div className="w-56 rounded-lg bg-slate-950/90 text-slate-200 border border-slate-700/80 shadow-xl backdrop-blur-sm text-[11px] font-mono overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-1.5 font-semibold text-orange-400">
            <Bug size={12} className="shrink-0" />
            <span>DEBUG OVERLAY</span>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="pointer-events-auto p-0.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            title="Minimize Debug Overlay"
          >
            <ChevronDown size={12} />
          </button>
        </div>

        <div className="p-2.5 space-y-1 tabular-nums">
          <div className="flex justify-between">
            <span className="text-slate-400">Engine:</span>
            <span className="text-orange-300 font-semibold">
              {isTauri ? 'Rust Native' : 'Web'} (
              <span ref={rustUsRef}>{getLastRustStepElapsedUs()} µs</span>)
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Tick:</span>
            <span ref={tickRef} className="text-emerald-400 font-semibold">
              {initialTick}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">UI FPS:</span>
            <span ref={fpsRef} className="text-cyan-400 font-semibold">
              60
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Sim Rate:</span>
            <span className="text-slate-200">
              {simSpeed} Hz · {stepTicks}T/step {simRunning ? '●' : '⏸'}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Graph:</span>
            <span className="text-slate-200">
              {nodeCount}N / {wireCount}W / <span ref={pinsRef}>{getCompiledRustPinCount()}</span>P
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-400">Viewport:</span>
            <span className="text-slate-300">
              {Math.round(schematicScale * 100)}% ({Math.round(schematicPos.x)}, {Math.round(schematicPos.y)})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
