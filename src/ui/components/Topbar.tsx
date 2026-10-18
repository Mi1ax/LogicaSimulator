import React, { useState, useRef, useEffect } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Trash2, Sun, Moon, Settings, Save, FolderOpen, Library, Menu as MenuIcon, ChevronRight, X } from 'lucide-react';
import { serializeCircuit, deserializeCircuit } from '../../core/utils/serialization';
import { globalAnalyzerBuffer } from '../../core/engine/logicAnalyzer';

export const Topbar: React.FC = () => {
  const [showMenu, setShowMenu] = useState(false);
  const [showSettingsSub, setShowSettingsSub] = useState(false);
  const [showExamplesSub, setShowExamplesSub] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [fileName, setFileName] = useState('circuit');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);
  
  const clearNodes = useSimulatorStore(state => state.clearNodes);
  const theme = useSimulatorStore(state => state.theme);
  const toggleTheme = useSimulatorStore(state => state.toggleTheme);
  const settings = useSimulatorStore(state => state.settings);
  const updateSettings = useSimulatorStore(state => state.updateSettings);

  const appMode = useSimulatorStore(state => state.appMode);
  const setAppMode = useSimulatorStore(state => state.setAppMode);

  const stripExtension = (name: string) => name.replace(/\.(logica|json)$/i, '') || 'circuit';

  const applyLoadedCircuit = (rawData: any, loadedFileName?: string) => {
    const { nodes, wires, subcircuits, simSpeed } = deserializeCircuit(rawData);
    if (loadedFileName) {
      setFileName(stripExtension(loadedFileName));
    }
    globalAnalyzerBuffer.clear();
    useSimulatorStore.setState(() => ({
      nodes,
      wires,
      ...(typeof simSpeed === 'number' ? { simSpeed } : {}),
      savedCircuits: {
        main: { name: 'Main', nodes, wires, history: [], future: [] },
        ...(subcircuits || {}),
      },
      activeSubcircuitId: 'main',
      history: [],
      future: [],
      selection: null,
      multiSelection: [],
      analyzerChannels: [],
      breakpoints: [],
      lastTriggeredBreakpointId: null,
      simState: { tickCount: 0, pinStates: {}, wireStates: {}, nodeStates: {} },
    }));
  };

  const buildSerializedCurrentProject = () => {
    const store = useSimulatorStore.getState();
    const syncedSaved = {
      ...store.savedCircuits,
      [store.activeSubcircuitId]: {
        name: store.savedCircuits[store.activeSubcircuitId]?.name || (store.activeSubcircuitId === 'main' ? 'Main' : 'Subcircuit'),
        nodes: store.nodes,
        wires: store.wires,
        history: store.history,
        future: store.future,
      },
    };
    const mainCircuit = syncedSaved['main'] || { nodes: store.nodes, wires: store.wires };
    return serializeCircuit(mainCircuit.nodes, mainCircuit.wires, syncedSaved, store.simSpeed);
  };

  const triggerBrowserDownload = (json: string, targetName: string) => {
    const cleanBase = stripExtension(targetName.trim());
    const finalFileName = `${cleanBase}.logica`;
    setFileName(cleanBase);
    const blob = new Blob([json], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    const json = buildSerializedCurrentProject();
    const suggested = `${stripExtension(fileName)}.logica`;
    
    if (typeof (window as any).showSaveFilePicker === 'function') {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: suggested,
          types: [{
            description: 'Logica Circuit File (.logica)',
            accept: {
              'application/json': ['.logica', '.json'],
            },
          }],
        });
        if (handle?.name) {
          setFileName(stripExtension(handle.name));
        }
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return;
        }
        // If browser blocked showSaveFilePicker (e.g. Brave shields) or threw an error, fall through to modal dialog
      }
    }

    setShowSaveModal(true);
  };

  const handleConfirmModalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const json = buildSerializedCurrentProject();
    setShowSaveModal(false);
    triggerBrowserDownload(json, fileName);
  };

  useEffect(() => {
    if (showSaveModal) {
      setTimeout(() => {
        saveInputRef.current?.focus();
        saveInputRef.current?.select();
      }, 20);
    }
  }, [showSaveModal]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSaveModal) {
        e.preventDefault();
        e.stopPropagation();
        setShowSaveModal(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [fileName, showSaveModal]);

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);
        applyLoadedCircuit(data, file.name);
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
      const response = await fetch(`${import.meta.env.BASE_URL}examples/${filename}`);
      if (!response.ok) throw new Error('Failed to load example');
      const data = await response.json();
      applyLoadedCircuit(data, filename);
      setShowExamplesSub(false); setShowMenu(false);
    } catch (err) {
      console.error(err);
      alert('Could not load example.');
    }
  };

  return (
    <div className="h-14 bg-white dark:bg-slate-800 border-b border-gray-300 dark:border-slate-700 flex items-center justify-between px-6 shadow-sm z-10 relative transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded flex items-center justify-center shrink-0">
          <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7 text-white">
            <path d="M4 11.5H9.5M4 20.5H9.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M25 16H28" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M8.5 7.5Q13.5 16 8.5 24.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M12.2 7.5C18 7.5 22.4 10.7 25 16C22.4 21.3 18 24.5 12.2 24.5Q17.2 16 12.2 7.5Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          </svg>
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
            onClick={() => setAppMode('hex')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${appMode === 'hex' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
          >
            Hex Editor
          </button>
          <button
            onClick={() => setAppMode('code')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${appMode === 'code' ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
          >
            Code Editor
          </button>
          <button
            onClick={() => setAppMode('ne555')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${appMode === 'ne555' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'}`}
          >
            555 Lab
          </button>
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
                      <button onClick={() => loadExample('mqc.logica')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700">07. MQC CPU Computer</button>
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

      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-gray-800 dark:text-slate-100 font-semibold text-base">
                <Save size={18} className="text-blue-600 dark:text-blue-400" />
                Save Circuit
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmModalSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1.5">
                  File Name
                </label>
                <div className="flex items-center rounded-md border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden">
                  <input
                    ref={saveInputRef}
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="circuit"
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:outline-none"
                  />
                  <span className="px-3 py-2 text-xs font-mono text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 border-l border-gray-300 dark:border-slate-600 select-none">
                    .logica
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Save size={14} />
                  Save File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
