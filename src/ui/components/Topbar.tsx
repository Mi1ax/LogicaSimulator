import React from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Trash2, Sun, Moon, Play, Pause, StepForward } from 'lucide-react';

export const Topbar: React.FC = () => {
  const clearNodes = useSimulatorStore(state => state.clearNodes);
  const theme = useSimulatorStore(state => state.theme);
  const toggleTheme = useSimulatorStore(state => state.toggleTheme);
  const simRunning = useSimulatorStore(state => state.simRunning);
  const setSimRunning = useSimulatorStore(state => state.setSimRunning);
  const stepSimulation = useSimulatorStore(state => state.stepSimulation);
  const simSpeed = useSimulatorStore(state => state.simSpeed);
  const setSimSpeed = useSimulatorStore(state => state.setSimSpeed);

  return (
    <div className="h-14 bg-white dark:bg-slate-800 border-b border-gray-300 dark:border-slate-700 flex items-center justify-between px-6 shadow-sm z-10 relative transition-colors">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded flex items-center justify-center text-white font-bold text-xl">
          L
        </div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Logica Simulator</h1>
      </div>

      {/* Simulation Controls (Center) */}
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-900/50 p-1 rounded-md border border-gray-200 dark:border-slate-600">
        <button
          onClick={() => setSimRunning(!simRunning)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
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
          className={`p-1.5 rounded transition-colors ${
            simRunning 
              ? 'opacity-50 cursor-not-allowed text-gray-400' 
              : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
          }`}
          title="Step Forward (1 Tick)"
        >
          <StepForward size={18} />
        </button>

        <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />

        <div className="flex items-center gap-2 px-2" title={`Speed: ${simSpeed} Hz`}>
          <span className="text-xs font-medium text-gray-500 dark:text-slate-400 w-8 text-right">
            {simSpeed}Hz
          </span>
          <input
            type="range"
            min="1"
            max="50"
            value={simSpeed}
            onChange={(e) => setSimSpeed(Number(e.target.value))}
            className="w-24 h-1 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          title="Toggle Dark Mode"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        
        <div className="w-px h-6 bg-gray-200 dark:bg-slate-700" />
        
        <button
          onClick={clearNodes}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
        >
          <Trash2 size={16} />
          Clear Canvas
        </button>
      </div>
    </div>
  );
};
