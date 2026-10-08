import React, { useState, useRef } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import {  Trash2, Sun, Moon, Settings, Save, FolderOpen, Library , Menu as MenuIcon, ChevronRight } from 'lucide-react';
import { NumberInput } from './NumberInput';

export const Topbar: React.FC = () => {
  const [showMenu, setShowMenu] = useState(false);
  const [showSettingsSub, setShowSettingsSub] = useState(false);
  const [showExamplesSub, setShowExamplesSub] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const clearNodes = useSimulatorStore(state => state.clearNodes);
  const theme = useSimulatorStore(state => state.theme);
  const toggleTheme = useSimulatorStore(state => state.toggleTheme);
  const settings = useSimulatorStore(state => state.settings);
  const updateSettings = useSimulatorStore(state => state.updateSettings);

  const appMode = useSimulatorStore(state => state.appMode);
  const setAppMode = useSimulatorStore(state => state.setAppMode);
  const activeWireType = useSimulatorStore(state => state.activeWireType);
  const setWireType = useSimulatorStore(state => state.setActiveWireType);

  const handleSave = async () => {
    const store = useSimulatorStore.getState();
    const data = {
      nodes: store.nodes,
      wires: store.wires,
      boardTraces: store.boardTraces,
    };
    const json = JSON.stringify(data, null, 2);
    
    if ('showSaveFilePicker' in window) {
      try {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: 'circuit.logica',
          types: [{
            description: 'Logica Circuit File',
            accept: { 'application/json': ['.logica'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to save file:', err);
        }
      }
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'circuit.logica';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);
        useSimulatorStore.setState({
          nodes: data.nodes || [],
          wires: data.wires || [],
          boardTraces: data.boardTraces || [],
          history: [],
          future: [],
          simState: { tickCount: 0, pinStates: {}, wireStates: {}, nodeStates: {} }
        });
      } catch (err) {
        console.error('Failed to load circuit file:', err);
        alert('Invalid circuit file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadExample = async (filename: string) => {
    try {
      const response = await fetch(`/examples/${filename}`);
      if (!response.ok) throw new Error('Failed to load example');
      const data = await response.json();
      useSimulatorStore.setState({
        nodes: data.nodes || [],
        wires: data.wires || [],
        boardTraces: data.boardTraces || [],
        history: [],
        future: [],
        simState: { tickCount: 0, pinStates: {}, wireStates: {}, nodeStates: {} }
      });
      setShowExamplesSub(false); setShowMenu(false);
    } catch (err) {
      console.error(err);
      alert('Could not load example.');
    }
  };

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
            title="Board traces are purely visual and do not affect the logic simulation."
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${appMode === 'board' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
          >
            Board
          </button>
        </div>
        
        {appMode === 'board' && (
          <span className="text-[10px] text-gray-400 dark:text-slate-500 italic hidden md:inline-block">
            (Visual layout only)
          </span>
        )}
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



            <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          title="Toggle Dark Mode"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleLoad}
          accept=".logica,.json"
          className="hidden"
        />

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${showMenu ? 'bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-slate-100' : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
            title="Menu"
          >
            <MenuIcon size={16} />
            <span className="hidden sm:inline">Menu</span>
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => {
                  setShowMenu(false);
                  setShowSettingsSub(false);
                  setShowExamplesSub(false);
                }}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-50">
                <button
                  onClick={() => { fileInputRef.current?.click(); setShowMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                >
                  <FolderOpen size={16} /> Load Circuit
                </button>
                <button
                  onClick={() => { handleSave(); setShowMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                >
                  <Save size={16} /> Save Circuit
                </button>

                <div className="w-full h-px bg-gray-200 dark:bg-slate-700 my-1" />

                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowExamplesSub(!showExamplesSub);
                      setShowSettingsSub(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                  >
                    <div className="flex items-center gap-3"><Library size={16} /> Examples</div>
                    <ChevronRight size={14} className={`transition-transform ${showExamplesSub ? 'rotate-90' : ''}`} />
                  </button>
                  {showExamplesSub && (
                    <div className="absolute right-[100%] top-0 mr-1 w-64 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-50 max-h-96 overflow-y-auto">
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 px-4 mb-2 uppercase tracking-wider">Circuit Examples</h3>
                      <button onClick={() => loadExample('01_logic_gates.logica')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">01. Basic Logic Gates</button>
                      <button onClick={() => loadExample('02_74LS161_counter.logica')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">02. 74LS161 4-bit Counter</button>
                      <button onClick={() => loadExample('03_74LS191_up_down_counter.logica')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">03. 74LS191 Up/Down Counter</button>
                      <button onClick={() => loadExample('04_62256_sram.logica')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">04. 62256 SRAM Chip</button>
                      <button onClick={() => loadExample('05_74LS273_register.logica')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">05. 74LS273 Octal Register</button>
                      <button onClick={() => loadExample('06_74LS08_quad_and.logica')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">06. 74LS08 Quad AND Gate</button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettingsSub(!showSettingsSub);
                      setShowExamplesSub(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                  >
                    <div className="flex items-center gap-3"><Settings size={16} /> Settings</div>
                    <ChevronRight size={14} className={`transition-transform ${showSettingsSub ? 'rotate-90' : ''}`} />
                  </button>
                  {showSettingsSub && (
                    <div 
                      className="absolute right-[100%] top-0 mr-1 w-72 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 p-4 z-50 cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                              <NumberInput
                                min={10} max={1000}
                                value={settings.boardWidthMm}
                                onChangeValue={(val) => updateSettings({ boardWidthMm: val })}
                                fallbackValue={50}
                                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-[10px] text-gray-500 dark:text-slate-400 mb-1">Height (mm)</label>
                              <NumberInput
                                min={10} max={1000}
                                value={settings.boardHeightMm}
                                onChangeValue={(val) => updateSettings({ boardHeightMm: val })}
                                fallbackValue={70}
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
                  )}
                </div>

                <div className="w-full h-px bg-gray-200 dark:bg-slate-700 my-1" />

                <button
                  onClick={() => { clearNodes(); setShowMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-left"
                >
                  <Trash2 size={16} /> Clear Canvas
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
