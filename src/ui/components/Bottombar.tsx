import React, { useState, useEffect } from 'react';
import { Play, Pause, StepForward, Square, Activity, ChevronUp } from 'lucide-react';
import { useSimulatorStore } from '../../store/useSimulatorStore';

function formatStepLabel(ticks: number): string {
  if (ticks >= 1000 && ticks % 1000 === 0) return `${ticks / 1000}kT`;
  return `${ticks}T`;
}

interface BottombarProps {
  analyzerOpen?: boolean;
  onToggleAnalyzer?: () => void;
}

export const Bottombar: React.FC<BottombarProps> = ({
  analyzerOpen = false,
  onToggleAnalyzer,
}) => {
  const simRunning = useSimulatorStore(state => state.simRunning);
  const setSimRunning = useSimulatorStore(state => state.setSimRunning);
  const stepSimulation = useSimulatorStore(state => state.stepSimulation);
  const resetSimulation = useSimulatorStore(state => state.resetSimulation);
  const simSpeed = useSimulatorStore(state => state.simSpeed);
  const setSimSpeed = useSimulatorStore(state => state.setSimSpeed);
  const stepTicks = useSimulatorStore(state => state.stepTicks);
  const setStepTicks = useSimulatorStore(state => state.setStepTicks);
  const hasTicks = useSimulatorStore(state => state.simState.tickCount > 0);

  const [localSpeed, setLocalSpeed] = useState(simSpeed.toString());
  const [showStepMenu, setShowStepMenu] = useState(false);
  const [localStepInput, setLocalStepInput] = useState(stepTicks.toString());

  useEffect(() => {
    setLocalSpeed(simSpeed.toString());
  }, [simSpeed]);

  useEffect(() => {
    setLocalStepInput(stepTicks.toString());
  }, [stepTicks]);

  const stepPresets = [
    { ticks: 1, label: '1T', desc: '1 tick (single step)' },
    { ticks: 2, label: '2T', desc: '1 kHz period @ 2 kHz sim' },
    { ticks: 4, label: '4T', desc: '500 Hz period @ 2 kHz sim' },
    { ticks: 16, label: '16T', desc: '16 ticks' },
    { ticks: 100, label: '100T', desc: '100 ticks' },
    { ticks: 500, label: '500T (500Hz)', desc: '500 ticks (0.25s @ 2 kHz)' },
    { ticks: 1000, label: '1kT (1kHz)', desc: '1000 ticks (0.5s @ 2 kHz)' },
    { ticks: 2000, label: '2kT (2kHz)', desc: '2000 ticks (1.0s @ 2 kHz)' },
  ];

  return (
    <div className="h-12 bg-white dark:bg-slate-800 border-t border-gray-300 dark:border-slate-700 flex items-center justify-between gap-2 px-3 sm:px-6 shadow-[0_-1px_2px_rgba(0,0,0,0.05)] z-20 relative transition-colors shrink-0">
      <div className="flex-1 flex items-center justify-start gap-2 sm:gap-3 min-w-0">
        {onToggleAnalyzer && (
          <button
            onClick={onToggleAnalyzer}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              analyzerOpen
                ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700'
                : 'bg-gray-100 dark:bg-slate-900/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
            title="Toggle Waveforms & Breakpoints Drawer"
          >
            <Activity size={14} className="text-cyan-500 shrink-0" />
            <span className="hidden sm:inline">Waveforms</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-900/50 p-1 rounded-md border border-gray-200 dark:border-slate-600 shrink-0 relative">
        <button
          onClick={() => setSimRunning(!simRunning)}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
            simRunning 
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-900/60' 
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60'
          }`}
          title={simRunning ? "Pause Simulation" : "Start Simulation"}
        >
          {simRunning ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          {simRunning ? "Pause" : "Run"}
        </button>

        <div className="flex items-center rounded border border-transparent hover:border-gray-300 dark:hover:border-slate-600">
          <button
            onClick={() => stepSimulation()}
            disabled={simRunning}
            className={`flex items-center gap-1 px-1.5 py-1 rounded-l transition-colors ${
              simRunning 
                ? 'opacity-50 cursor-not-allowed text-gray-400' 
                : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
            }`}
            title={`Step Forward (${stepTicks} ${stepTicks === 1 ? 'Tick' : 'Ticks'})`}
          >
            <StepForward size={18} />
            <span className="text-[11px] font-mono font-semibold tabular-nums">
              {formatStepLabel(stepTicks)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowStepMenu(v => !v)}
            className="px-1 py-1 rounded-r hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 transition-colors"
            title="Configure Step Mode (Ticks per Step)"
          >
            <ChevronUp size={13} className={`transition-transform ${showStepMenu ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showStepMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowStepMenu(false)}
            />
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 p-3 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">
                  Step Mode (Ticks / Step)
                </span>
                <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                  {stepTicks} {stepTicks === 1 ? 'tick' : 'ticks'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1 mb-2.5">
                {stepPresets.map((p) => (
                  <button
                    key={p.ticks}
                    type="button"
                    title={p.desc}
                    onClick={() => {
                      setStepTicks(p.ticks);
                      setShowStepMenu(false);
                    }}
                    className={`px-2 py-1 text-xs font-mono rounded border text-left flex items-center justify-between transition-colors ${
                      stepTicks === p.ticks
                        ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                        : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-400'
                    }`}
                  >
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 pt-1 border-t border-gray-200 dark:border-slate-700">
                <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                  Custom:
                </span>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={localStepInput}
                  onChange={(e) => {
                    setLocalStepInput(e.target.value);
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n >= 1) {
                      setStepTicks(n);
                    }
                  }}
                  className="flex-1 min-w-0 text-xs font-mono bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-right text-gray-800 dark:text-slate-200"
                />
                <span className="text-xs text-gray-400 font-mono">ticks</span>
              </div>
            </div>
          </>
        )}

        <button
          onClick={() => { setSimRunning(false); resetSimulation(); }}
          disabled={!simRunning && !hasTicks}
          className={`p-1 rounded transition-colors ${
            (!simRunning && !hasTicks)
              ? 'opacity-50 cursor-not-allowed text-gray-400' 
              : 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
          }`}
          title="Stop & Reset Simulation"
        >
          <Square size={16} fill="currentColor" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-end gap-1.5 sm:gap-2 min-w-0" title={`Speed: ${simSpeed} Hz`}>
        <input
          type="number"
          min="1"
          max="100000"
          value={localSpeed}
          onChange={(e) => {
            setLocalSpeed(e.target.value);
            const num = parseInt(e.target.value, 10);
            if (!isNaN(num) && num >= 1) {
              setSimSpeed(num);
            }
          }}
          onBlur={() => {
            if (!localSpeed || isNaN(parseInt(localSpeed, 10)) || parseInt(localSpeed, 10) < 1) {
              setLocalSpeed('1');
              setSimSpeed(1);
            }
          }}
          className="text-xs font-medium text-gray-700 dark:text-slate-300 w-14 sm:w-16 text-right bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-1 py-0.5"
        />
        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Hz</span>
        <input
          type="range"
          min="1"
          max="10000"
          step="1"
          value={simSpeed}
          onChange={(e) => setSimSpeed(Number(e.target.value))}
          className="hidden lg:inline-block w-20 xl:w-24 h-1 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    </div>
  );
};
