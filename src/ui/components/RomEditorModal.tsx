import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Pin, MapPin } from 'lucide-react';

const ROW_HEIGHT = 24;
const TOTAL_BYTES = 32768;
const BYTES_PER_ROW = 16;
const NUM_ROWS = TOTAL_BYTES / BYTES_PER_ROW;

const VirtualHexEditor: React.FC<{
  data: number[];
  onChange: (data: number[]) => void;
  isReadOnly: boolean;
  highlightAddress?: number | null;
}> = ({ data, onChange, isReadOnly, highlightAddress }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedNibble, setSelectedNibble] = useState<0 | 1>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleHeight = 2000; // very safe max height to prevent blank space
  const visibleRows = Math.ceil(visibleHeight / ROW_HEIGHT) + 2;
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT));
  const endRow = Math.min(NUM_ROWS, startRow + visibleRows);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (isReadOnly || selectedIdx === null) return;

    if (e.key === 'ArrowRight') {
      if (selectedNibble === 0) setSelectedNibble(1);
      else {
        setSelectedIdx(Math.min(TOTAL_BYTES - 1, selectedIdx + 1));
        setSelectedNibble(0);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      if (selectedNibble === 1) setSelectedNibble(0);
      else {
        setSelectedIdx(Math.max(0, selectedIdx - 1));
        setSelectedNibble(1);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      setSelectedIdx(Math.min(TOTAL_BYTES - 1, selectedIdx + BYTES_PER_ROW));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setSelectedIdx(Math.max(0, selectedIdx - BYTES_PER_ROW));
      e.preventDefault();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      const newData = [...data];
      newData[selectedIdx] = 0;
      onChange(newData);
      if (e.key === 'Backspace') {
        setSelectedIdx(Math.max(0, selectedIdx - 1));
        setSelectedNibble(0);
      }
      e.preventDefault();
    } else {
      const hexVal = parseInt(e.key, 16);
      if (!isNaN(hexVal) && e.key.length === 1 && e.key !== ' ') {
        const newData = [...data];
        const current = newData[selectedIdx] || 0;
        if (selectedNibble === 0) {
          newData[selectedIdx] = (hexVal << 4) | (current & 0x0F);
          setSelectedNibble(1);
        } else {
          newData[selectedIdx] = (current & 0xF0) | hexVal;
          setSelectedIdx(Math.min(TOTAL_BYTES - 1, selectedIdx + 1));
          setSelectedNibble(0);
        }
        onChange(newData);
        e.preventDefault();
      }
    }
  };

  const header = (
    <div className="flex h-[32px] items-center text-sm font-mono px-6 font-bold text-gray-700 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 sticky top-0 z-20">
      <div className="w-16 mr-2" title="Memory Address in Hexadecimal">Addr(Hex)</div>
      <div className="flex mr-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={`hpair-${idx}`} className="flex gap-0 mr-3 w-[48px] justify-center text-xs opacity-80">
            {idx * 2}{(idx * 2 + 1).toString(16).toUpperCase()}
          </div>
        ))}
      </div>
      <div className="flex text-xs opacity-80" title="ASCII representation">
        ASCII
      </div>
    </div>
  );

  const rows = [];
  for (let i = startRow; i < endRow; i++) {
    const rowOffset = i * BYTES_PER_ROW;
    const address = rowOffset.toString(16).padStart(4, '0').toUpperCase();

    const hexCells: React.ReactNode[] = [];
    const asciiCells: React.ReactNode[] = [];

      for (let j = 0; j < BYTES_PER_ROW; j++) {
      const idx = rowOffset + j;
      const byte = data[idx] || 0;
      const isSelected = selectedIdx === idx;
      const isHighlighted = highlightAddress === idx;

      const hexStr = byte.toString(16).padStart(2, '0').toUpperCase();
      const asciiChar = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
      
      let bgClass = 'hover:bg-gray-200 dark:hover:bg-slate-700';
      if (isSelected) bgClass = 'bg-blue-500 text-white';
      else if (isHighlighted) bgClass = 'bg-green-500 text-white font-bold ring-2 ring-green-300 dark:ring-green-600 rounded-sm z-10 relative';

      hexCells.push(
        <div
          key={`hex-${j}`}
          onClick={() => {
            if (!isReadOnly) {
              setSelectedIdx(idx);
              setSelectedNibble(0);
              containerRef.current?.focus();
            }
          }}
          className={`w-6 text-center cursor-pointer ${bgClass}`}
        >
          {isSelected ? (
            <span>
              <span className={selectedNibble === 0 ? 'bg-white text-blue-600' : ''}>{hexStr[0]}</span>
              <span className={selectedNibble === 1 ? 'bg-white text-blue-600' : ''}>{hexStr[1]}</span>
            </span>
          ) : hexStr}
        </div>
      );

      asciiCells.push(
        <div key={`asc-${j}`} className={`w-3 text-center ${isSelected ? 'text-blue-500 font-bold' : 'text-gray-500 dark:text-slate-400'}`}>
          {asciiChar}
        </div>
      );
    }

    rows.push(
      <div key={i} className="flex h-[24px] items-center text-sm font-mono px-6 hover:bg-gray-100/50 dark:hover:bg-slate-800/50" style={{ position: 'absolute', top: i * ROW_HEIGHT + 32, left: 0, right: 0 }}>
        <div className="w-16 text-gray-500 dark:text-slate-400 mr-2 select-none" title={`Address 0x${address}`}>{address}:</div>
        <div className="flex mr-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={`pair-${idx}`} className="flex gap-0 mr-3">
              {hexCells[idx * 2]}
              {hexCells[idx * 2 + 1]}
            </div>
          ))}
        </div>
        <div className="flex text-xs">
          {asciiCells}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-hex-editor="true"
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      onWheel={e => e.stopPropagation()}
      className="flex-1 w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md overflow-auto outline-none focus:ring-2 focus:ring-blue-500 relative"
    >
      <div style={{ height: (TOTAL_BYTES / BYTES_PER_ROW * ROW_HEIGHT) + 48 }} />
      {header}
      {rows}
    </div>
  );
};


export const RomEditorModal: React.FC<{ nodeId: string, onClose: () => void }> = ({ nodeId, onClose }) => {
  const selection = useSimulatorStore(state => state.selection);
  const node = useSimulatorStore(state => state.nodes.find(n => n.id === nodeId));
  const updateNodeProperties = useSimulatorStore(state => state.updateNodeProperties);
  const simRunning = useSimulatorStore(state => state.simRunning);
  const simState = useSimulatorStore(state => state.simState);

  const [romData, setRomData] = useState<number[]>([]);
  const [pinMode, setPinMode] = useState<'unpinned' | 'screen' | 'schematic'>('unpinned');
  const [customScale, setCustomScale] = useState(1.4);

  const isStopped = !simRunning && simState.tickCount === 0;
  const isReadOnly = !isStopped || pinMode === 'schematic';

  let currentAddress: number | null = null;
  if (node && !isStopped) {
    let addr = 0;
    let valid = true;
    for (let i = 0; i < 15; i++) {
      const pinId = node.inputs[i]?.id;
      if (pinId) {
        const val = simState.pinStates[pinId];
        if (val === undefined || val === 'X') {
          valid = false;
          break;
        }
        if (val === 1) {
          addr |= (1 << i);
        }
      } else {
        valid = false;
        break;
      }
    }
    if (valid) {
      currentAddress = addr;
    }
  }

  const handleSave = () => {
    updateNodeProperties(nodeId, { data: romData });
  };

  const handleClose = () => {
    if (!isReadOnly) handleSave();
    onClose();
  };

  useEffect(() => {
    if (pinMode === 'unpinned' && selection?.id !== nodeId) {
      handleClose();
    }
  }, [selection, pinMode, nodeId]);

  useEffect(() => {
    if (node?.properties?.data) {
      const arr = node.properties.data as number[];
      if (arr.length === TOTAL_BYTES) {
        setRomData(arr);
      } else {
        const padded = new Array(TOTAL_BYTES).fill(0);
        for(let i=0; i<Math.min(arr.length, TOTAL_BYTES); i++) padded[i] = arr[i];
        setRomData(padded);
      }
    } else {
      setRomData(new Array(TOTAL_BYTES).fill(0));
    }
  }, [node]);

  if (!node) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const arr = Array.from(new Uint8Array(buffer));

      const padded = new Array(TOTAL_BYTES).fill(0);
      for(let i=0; i<Math.min(arr.length, TOTAL_BYTES); i++) padded[i] = arr[i];

      setRomData(padded);
      updateNodeProperties(node.id, { data: padded });
    };
    reader.readAsArrayBuffer(file);
  };

  const schematicPos = useSimulatorStore(state => state.schematicPos);
  const schematicScale = useSimulatorStore(state => state.schematicScale);
  const appMode = useSimulatorStore(state => state.appMode);

  const [schematicOffset, setSchematicOffset] = useState({ x: 80, y: 0 });
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 350, y: window.innerHeight / 2 - 300 });

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, mode: '', initialScreen: { x: 0, y: 0 }, initialSchematic: { x: 0, y: 0 } });

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      mode: pinMode,
      initialScreen: position,
      initialSchematic: schematicOffset
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;

      if (dragStart.current.mode === 'schematic') {
        const scaledDx = dx / schematicScale;
        const scaledDy = dy / schematicScale;
        setSchematicOffset({
          x: dragStart.current.initialSchematic.x + scaledDx,
          y: dragStart.current.initialSchematic.y + scaledDy
        });
      } else {
        setPosition({
          x: dragStart.current.initialScreen.x + dx,
          y: dragStart.current.initialScreen.y + dy
        });
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, initialScale: 1 });

  const onResizePointerDown = (e: React.PointerEvent) => {
    isResizing.current = true;
    resizeStart.current = { x: e.clientX, initialScale: customScale };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    if (isResizing.current) {
      const dx = e.clientX - resizeStart.current.x;
      const newScale = Math.max(0.2, resizeStart.current.initialScale + dx / 500);
      setCustomScale(newScale);
    }
  };

  const onResizePointerUp = (e: React.PointerEvent) => {
    isResizing.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const canvasOffset = useSimulatorStore(state => state.canvasOffset);

  let finalStyle: React.CSSProperties = {};
  if (pinMode === 'schematic' && appMode === 'schematic') {
    const x = (node.x + schematicOffset.x) * schematicScale + schematicPos.x + canvasOffset.x;
    const y = (node.y + schematicOffset.y) * schematicScale + schematicPos.y + canvasOffset.y;
    finalStyle = {
      left: x,
      top: y,
      transform: `scale(${schematicScale * customScale})`,
      transformOrigin: 'top left',
      zIndex: 5
    };
  } else {
    finalStyle = {
      left: position.x,
      top: position.y
    };
  }

  return (
    <div
      className={`fixed bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-[850px] h-[750px] flex flex-col border border-gray-300 dark:border-slate-600 overflow-hidden group ${pinMode === 'schematic' ? 'pointer-events-auto !bg-transparent !shadow-none !border-transparent !rounded-none select-none' : (pinMode !== 'unpinned' ? 'pointer-events-auto z-50' : 'z-[100]')}`}
      style={finalStyle}
    >
      {pinMode === 'schematic' && (
        <div 
          className="bg-slate-700 text-white rounded-t-md px-3 py-1.5 flex justify-between items-center pointer-events-auto shadow-sm z-10 relative cursor-move"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-200">ROM Editor</span>
          <div className="flex gap-3 items-center">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setPinMode('unpinned')}
              className="text-slate-400 hover:text-white transition-colors"
              title="Unpin"
            >
              <MapPin size={14} />
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleClose}
              className="text-slate-400 hover:text-red-400 transition-colors text-xs"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {pinMode !== 'schematic' && (
        <div
          className={`px-4 py-3 bg-gray-100 dark:bg-slate-900 border-b border-gray-300 dark:border-slate-700 flex justify-between items-center select-none ${pinMode !== 'unpinned' ? 'cursor-default' : 'cursor-move'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <h2 className="text-sm font-bold text-gray-800 dark:text-white">ROM Editor (27C256)</h2>
          <div className="flex gap-3">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setPinMode(pinMode === 'screen' ? 'unpinned' : 'screen')}
              className={`cursor-pointer transition-colors ${pinMode === 'screen' ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              title="Pin to Screen"
            >
              <Pin size={16} fill={pinMode === 'screen' ? "currentColor" : "none"} />
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setPinMode('schematic')}
              className={`cursor-pointer transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`}
              title="Pin to Schematic"
            >
              <MapPin size={16} />
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className={`p-4 flex-1 flex flex-col min-h-0 ${pinMode === 'schematic' ? '!p-0 relative' : ''}`}>
        {isReadOnly && (
          <div className={`mb-4 p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded border border-amber-200 dark:border-amber-700/50 text-sm ${pinMode === 'schematic' ? 'hidden' : ''}`}>
            Simulation is running or paused. Editor is read-only. Stop simulation (Tick 0) to edit.
          </div>
        )}

        {pinMode === 'unpinned' && (
          <div className="mb-4 flex gap-4 items-center shrink-0">
            <label className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer px-4 py-2 rounded text-sm font-medium text-slate-800 dark:text-slate-200 transition-colors">
              Load from File
              <input type="file" accept=".bin,.hex" className="hidden" onChange={handleFileUpload} disabled={isReadOnly} />
            </label>
            <div className="ml-auto flex gap-2">
              <button
                onClick={handleSave}
                disabled={isReadOnly}
                className={`px-3 py-1.5 rounded text-xs font-medium text-white transition-colors ${isReadOnly ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        <VirtualHexEditor data={romData} onChange={setRomData} isReadOnly={isReadOnly} highlightAddress={currentAddress} />

        {pinMode === 'schematic' && (
          <div
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize bg-blue-500/20 hover:bg-blue-500/50 rounded-tl z-50 opacity-0 group-hover:opacity-100 transition-colors pointer-events-auto"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
          />
        )}
      </div>
    </div>
  );
};
