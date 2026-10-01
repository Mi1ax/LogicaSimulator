import React, { useState } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Trash2, Sun, Moon, Play, Pause, StepForward, Settings, MousePointer2, PenTool } from 'lucide-react';

export const Topbar: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const clearNodes = useSimulatorStore(state => state.clearNodes);
  const theme = useSimulatorStore(state => state.theme);
  const toggleTheme = useSimulatorStore(state => state.toggleTheme);
  const simRunning = useSimulatorStore(state => state.simRunning);
  const setSimRunning = useSimulatorStore(state => state.setSimRunning);
  const stepSimulation = useSimulatorStore(state => state.stepSimulation);
  const simSpeed = useSimulatorStore(state => state.simSpeed);
  const setSimSpeed = useSimulatorStore(state => state.setSimSpeed);
  const settings = useSimulatorStore(state => state.settings);
  const updateSettings = useSimulatorStore(state => state.updateSettings);

  const appMode = useSimulatorStore(state => state.appMode);
  const setAppMode = useSimulatorStore(state => state.setAppMode);
  const activeWireType = useSimulatorStore(state => state.activeWireType);
  const setWireType = useSimulatorStore(state => state.setActiveWireType);
  const interactionMode = useSimulatorStore(state => state.interactionMode);
  const setInteractionMode = useSimulatorStore(state => state.setInteractionMode);

  return (
    <div className="h-14 bg-white dark:bg-slate-800 border-b border-gray-300 dark:border-slate-700 flex items-center justify-between px-6 shadow-sm z-10 relative transition-colors">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded flex items-center justify-center text-white font-bold text-xl">
          L
        </div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100 mr-4">Logica Simulator</h1>
        
        {/* Mode Switcher */}
        <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-md border border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setAppMode('schematic')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${appMode === 'schematic' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
          >
            Schematic
          </button>
          <button
            onClick={() => setAppMode('board')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${appMode === 'board' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
          >
            Board
          </button>
        </div>
        
        {/* Interaction Mode Switcher */}
        <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-md border border-gray-200 dark:border-slate-700 ml-4">
          <button
            onClick={() => setInteractionMode('cursor')}
            className={`px-3 py-1 flex items-center justify-center rounded transition-colors ${interactionMode === 'cursor' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
            title="Cursor Mode (M)"
          >
            <MousePointer2 size={16} />
          </button>
          <button
            onClick={() => setInteractionMode('wire')}
            className={`px-3 py-1 flex items-center justify-center rounded transition-colors ${interactionMode === 'wire' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
            title="Wire Mode (W)"
          >
            <PenTool size={16} />
          </button>
        </div>

        {/* Wire Type Switcher (Board Mode Only) */}
        {appMode === 'board' && (
          <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-md border border-gray-200 dark:border-slate-700 ml-2">
            <button
              onClick={() => setWireType('solder')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${activeWireType === 'solder' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-500 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
            >
              Solder
            </button>
            <button
              onClick={() => setWireType('jumper')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${activeWireType === 'jumper' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
            >
              Jumper
            </button>
          </div>
        )}
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
        
        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-md transition-colors ${showSettings ? 'bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
            title="Settings"
          >
            <Settings size={20} />
          </button>
          
          {showSettings && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowSettings(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 p-4 z-50">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-3 border-b border-gray-200 dark:border-slate-700 pb-2">Canvas Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Mouse Wheel Action</label>
                  <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-md">
                    <button
                      className={`flex-1 text-xs py-1 rounded transition-colors ${settings.mouseWheelBehavior === 'pan' ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'}`}
                      onClick={() => updateSettings({ mouseWheelBehavior: 'pan' })}
                    >
                      Pan (Figma)
                    </button>
                    <button
                      className={`flex-1 text-xs py-1 rounded transition-colors ${settings.mouseWheelBehavior === 'zoom' ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'}`}
                      onClick={() => updateSettings({ mouseWheelBehavior: 'zoom' })}
                    >
                      Zoom (CAD)
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Pan Speed</label>
                    <span className="text-xs text-gray-400">{settings.panSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.1" max="3" step="0.1"
                    value={settings.panSpeed}
                    onChange={(e) => updateSettings({ panSpeed: Number(e.target.value) })}
                    className="w-full h-1 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Zoom Sensitivity</label>
                    <span className="text-xs text-gray-400">{settings.zoomSensitivity.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min="0.1" max="3" step="0.1"
                    value={settings.zoomSensitivity}
                    onChange={(e) => updateSettings({ zoomSensitivity: Number(e.target.value) })}
                    className="w-full h-1 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Invert Zoom</label>
                  <button
                    onClick={() => updateSettings({ invertZoom: !settings.invertZoom })}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors ${settings.invertZoom ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${settings.invertZoom ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Board Dimensions</h4>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-500 dark:text-slate-400 mb-1">Width (mm)</label>
                      <input
                        type="number"
                        min="10" max="1000"
                        value={settings.boardWidthMm}
                        onChange={(e) => updateSettings({ boardWidthMm: Number(e.target.value) || 50 })}
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-500 dark:text-slate-400 mb-1">Height (mm)</label>
                      <input
                        type="number"
                        min="10" max="1000"
                        value={settings.boardHeightMm}
                        onChange={(e) => updateSettings({ boardHeightMm: Number(e.target.value) || 70 })}
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>
                
                <p className="text-[10px] text-gray-400 dark:text-slate-500 pt-2 border-t border-gray-200 dark:border-slate-700">
                  Tip: Trackpad pinch-to-zoom and two-finger pan are automatically detected on modern browsers.
                </p>
              </div>
            </div>
            </>
          )}
        </div>
        
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
