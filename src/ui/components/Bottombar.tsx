import React, { useState, useEffect } from 'react';
import { Play, Pause, StepForward, Square } from 'lucide-react';
import { useSimulatorStore } from '../../store/useSimulatorStore';

export const Bottombar: React.FC = () => {
  const simRunning = useSimulatorStore(state => state.simRunning);
  const setSimRunning = useSimulatorStore(state => state.setSimRunning);
  const stepSimulation = useSimulatorStore(state => state.stepSimulation);
  const resetSimulation = useSimulatorStore(state => state.resetSimulation);
  const simSpeed = useSimulatorStore(state => state.simSpeed);
  const setSimSpeed = useSimulatorStore(state => state.setSimSpeed);
  const simState = useSimulatorStore(state => state.simState);

  const [localSpeed, setLocalSpeed] = useState(simSpeed.toString());
  useEffect(() => {
    setLocalSpeed(simSpeed.toString());
  }, [simSpeed]);

  return (
    <div className="h-12 bg-white dark:bg-slate-800 border-t border-gray-300 dark:border-slate-700 flex items-center justify-center px-4 shadow-[0_-1px_2px_rgba(0,0,0,0.05)] z-20 relative transition-colors">
      <div className="absolute left-6 text-sm font-medium text-gray-500 dark:text-slate-400">
        Tick: {simState.tickCount}
      </div>

      <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-900/50 p-1 rounded-md border border-gray-200 dark:border-slate-600">
        <button
          onClick={() => setSimRunning(!simRunning)}
          className={`flex items-center gap-2 px-3 py-1 rounded text-sm font-medium transition-colors ${
            simRunning 
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-900/60' 
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60'
          }`}
          title={simRunning ? "Pause Simulation" : "Start Simulation"}
        >
          {simRunning ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          {simRunning ? "Pause" : "Run"}
        </button>

        <button
          onClick={stepSimulation}
          disabled={simRunning}
          className={`p-1 rounded transition-colors ${
            simRunning 
              ? 'opacity-50 cursor-not-allowed text-gray-400' 
              : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
          }`}
          title="Step Forward (1 Tick)"
        >
          <StepForward size={18} />
        </button>

        <button
          onClick={() => { setSimRunning(false); resetSimulation(); }}
          disabled={!simRunning && simState.tickCount === 0}
          className={`p-1 rounded transition-colors ${
            (!simRunning && simState.tickCount === 0)
              ? 'opacity-50 cursor-not-allowed text-gray-400' 
              : 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
          }`}
          title="Stop & Reset Simulation"
        >
          <Square size={16} fill="currentColor" />
        </button>
      </div>

      <div className="absolute right-6 flex items-center gap-2 px-2" title={`Speed: ${simSpeed} Hz`}>
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
          className="text-xs font-medium text-gray-700 dark:text-slate-300 w-16 text-right bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-1"
        />
        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Hz</span>
        <input
          type="range"
          min="1"
          max="10000"
          step="1"
          value={simSpeed}
          onChange={(e) => setSimSpeed(Number(e.target.value))}
          className="w-24 h-1 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    </div>
  );
};
