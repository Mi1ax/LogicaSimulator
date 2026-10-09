import React, { useState, useEffect } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';

const MEM_SIZE = 32768;
const PAGE_SIZE = 1024; // Bytes per page (64 rows of 16)

export const HexEditorView: React.FC = () => {
  const nodes = useSimulatorStore(state => state.nodes);
  const updateNodeProperties = useSimulatorStore(state => state.updateNodeProperties);
  const memoryNodes = nodes.filter(n => ['27C256', '62256'].includes(n.type));
  
  const selectedNodeId = useSimulatorStore(state => state.selectedMemoryNodeId);
  const setSelectedNodeId = useSimulatorStore(state => state.setSelectedMemoryNodeId);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // Local copy of memory for editing
  const [memory, setMemory] = useState<Uint8Array>(new Uint8Array(MEM_SIZE));
  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [editingVal, setEditingVal] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(0);
  const [jumpAddressInput, setJumpAddressInput] = useState('');
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const handleJump = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let addr = parseInt(jumpAddressInput, 16);
    if (isNaN(addr)) return;
    addr = Math.max(0, Math.min(addr, MEM_SIZE - 1));
    const targetPage = Math.floor(addr / PAGE_SIZE);
    setCurrentPage(targetPage);
    
    const absoluteRowIndex = Math.floor(addr / 16);
    setHighlightedRow(absoluteRowIndex);
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
      setHighlightedRow(current => current === absoluteRowIndex ? null : current);
    }, 2000);
    
    setTimeout(() => {
      const rowId = `hex-row-${Math.floor(addr / 16)}`;
      const el = document.getElementById(rowId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      const cellId = `hex-cell-${addr}`;
      const cellEl = document.getElementById(cellId) as HTMLInputElement;
      if (cellEl) {
        cellEl.focus();
        cellEl.select();
      }
    }, 50);
  };

  useEffect(() => {
    if (selectedNode) {
      const data = selectedNode.properties?.data;
      const newMem = new Uint8Array(MEM_SIZE);
      if (Array.isArray(data)) {
        for (let i = 0; i < Math.min(data.length, MEM_SIZE); i++) {
          newMem[i] = data[i] || 0;
        }
      }
      setMemory(newMem);
      setCurrentPage(0);
      setIsDirty(false);
    }
  }, [selectedNode?.id]); // Intentionally not depending on data so we don't overwrite user edits unexpectedly if we haven't saved

  
  const focusCell = (targetAddr: number) => {
    if (targetAddr < 0 || targetAddr >= MEM_SIZE) return;
    const targetPage = Math.floor(targetAddr / PAGE_SIZE);
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
      setTimeout(() => {
        const el = document.getElementById(`hex-cell-${targetAddr}`);
        if (el) (el as HTMLInputElement).focus();
      }, 50);
    } else {
      const el = document.getElementById(`hex-cell-${targetAddr}`);
      if (el) (el as HTMLInputElement).focus();
    }
  };

  const handleByteChange = (addr: number, valStr: string) => {
    let val = valStr.toUpperCase();
    if (!/^[0-9A-F]{0,2}$/.test(val)) return;
    setEditingVal(val);
    
    
    const newMem = new Uint8Array(memory);
    newMem[addr] = parseInt(val || '0', 16);
    setMemory(newMem);
    setIsDirty(true);

    if (val.length === 2) {
      focusCell(addr + 1);
    }
  };

  const handleSave = () => {
    if (selectedNode) {
      // Convert typed array back to normal array for store (since we serialize to JSON)
      const dataArray = Array.from(memory);
      updateNodeProperties(selectedNode.id, { data: dataArray });
      setIsDirty(false);
    }
  };

  const handleImport = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        // @ts-ignore
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{ description: 'Binary File', accept: { 'application/octet-stream': ['.bin'] } }],
        });
        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        const importedMem = new Uint8Array(buffer);
        const newMem = new Uint8Array(MEM_SIZE);
        newMem.set(importedMem.slice(0, MEM_SIZE));
        setMemory(newMem);
        setIsDirty(true);
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error(err);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.bin';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const buffer = await file.arrayBuffer();
          const importedMem = new Uint8Array(buffer);
          const newMem = new Uint8Array(MEM_SIZE);
          newMem.set(importedMem.slice(0, MEM_SIZE));
          setMemory(newMem);
        }
      };
      input.click();
    }
  };

  const handleExport = () => {
    const blob = new Blob([memory as any], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNode?.properties?.label || selectedNode?.type || 'memory'}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render logic
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [memory, selectedNode]);

  const numPages = Math.ceil(MEM_SIZE / PAGE_SIZE);
  const startAddr = currentPage * PAGE_SIZE;
  const endAddr = Math.min(startAddr + PAGE_SIZE, MEM_SIZE);
  const pageBytes = memory.slice(startAddr, endAddr);
  const rows = Math.ceil(pageBytes.length / 16);

  return (
    <div className="flex flex-1 overflow-hidden bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
            Memory Chips
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {memoryNodes.length === 0 ? (
            <div className="text-xs text-gray-500 dark:text-slate-400 p-2 text-center">
              No RAM/ROM chips on the schematic.
            </div>
          ) : (
            memoryNodes.map(node => (
              <button
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedNodeId === node.id 
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium' 
                    : 'hover:bg-gray-200 dark:hover:bg-slate-700/50 text-gray-700 dark:text-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span>{node.properties?.label || node.type}</span>
                  <span className="text-[10px] bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-gray-500 dark:text-slate-400">
                    {node.type.includes('27C') ? 'ROM' : 'RAM'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col relative bg-gray-50 dark:bg-[#1e1e1e]">
        {!selectedNode ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500">
            <div className="text-4xl mb-4">🖧</div>
            <p>Select a memory chip from the sidebar to edit its contents.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full">
            {/* Editor Toolbar */}
            <div className="h-10 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-[#252526] flex items-center px-4 justify-between shrink-0">
              <div className="text-sm font-medium text-gray-700 dark:text-slate-300 flex items-center gap-4">
                <span>{selectedNode.properties?.label || selectedNode.type}{isDirty ? <span className="text-blue-500 ml-1">*</span> : ''}</span>
                <div className="flex items-center gap-2">
                  <button 
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(c => c - 1)}
                    className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-slate-700 rounded disabled:opacity-50"
                  >
                    &lt;
                  </button>
                  <span className="text-xs text-gray-500 w-24 text-center">
                    Page {currentPage + 1} / {numPages}
                  </span>
                  <button 
                    disabled={currentPage === numPages - 1}
                    onClick={() => setCurrentPage(c => c + 1)}
                    className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-slate-700 rounded disabled:opacity-50"
                  >
                    &gt;
                  </button>
                </div>
                <div className="h-4 w-px bg-gray-300 dark:bg-slate-600"></div>
                <form onSubmit={handleJump} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Go to: 0x</span>
                  <input 
                    type="text" 
                    value={jumpAddressInput}
                    onChange={e => setJumpAddressInput(e.target.value)}
                    placeholder="0000"
                    className="w-16 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500 uppercase font-mono"
                  />
                  <button type="submit" className="text-xs px-2 py-0.5 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded">
                    Jump
                  </button>
                </form>
              </div>
              <div className="flex gap-2">
                <button onClick={handleImport} className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-gray-700 dark:text-slate-200 transition-colors">
                  Import .bin
                </button>
                <button onClick={handleExport} className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-gray-700 dark:text-slate-200 transition-colors">
                  Export .bin
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={!isDirty}
                  className={`text-xs px-3 py-1 rounded transition-colors ${
                    isDirty 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isDirty ? 'Save Changes *' : 'Saved'}
                </button>
              </div>
            </div>
            
            {/* Hex Grid UI */}
            <div className="flex-1 overflow-auto p-4 font-mono text-sm">
              <div className="flex text-gray-400 dark:text-[#858585] mb-2 px-1 -mx-1">
                <div className="w-16 mr-3"></div>
                <div className="flex gap-2">
                  {[...Array(16)].map((_, i) => (
                    <span key={i} className={`w-[1.2rem] text-center inline-block ${i === 8 ? 'ml-2' : ''}`}>
                      {i.toString(16).padStart(2, '0').toUpperCase()}
                    </span>
                  ))}
                </div>
                <div className="ml-8 tracking-widest text-xs mt-0.5">
                  DECODED TEXT
                </div>
              </div>
              
              {/* Rows */}
              {[...Array(rows)].map((_, rowIndex) => {
                const rowStartAddr = startAddr + rowIndex * 16;
                const rowAddrHex = rowStartAddr.toString(16).padStart(4, '0').toUpperCase();
                const absoluteRowIndex = Math.floor(rowStartAddr / 16);
                
                const isHighlighted = highlightedRow === absoluteRowIndex;
                const rowClass = `flex mb-1 rounded px-1 -mx-1 group transition-colors duration-500 ${isHighlighted ? 'bg-yellow-100 dark:bg-yellow-900/40' : 'hover:bg-gray-200 dark:hover:bg-[#2a2d2e]'}`;
                
                return (
                  <div key={rowIndex} id={`hex-row-${absoluteRowIndex}`} className={rowClass}>
                    <div className="w-16 text-gray-400 dark:text-[#858585] select-none text-right mr-3 py-0.5">
                      {rowAddrHex}
                    </div>
                    <div className="flex gap-2 text-gray-800 dark:text-[#d4d4d4]">
                      {[...Array(16)].map((_, colIndex) => {
                        const addr = rowStartAddr + colIndex;
                        if (addr >= MEM_SIZE) return <span key={colIndex} className="w-4" />;
                        
                        const byteVal = memory[addr];
                        const hexStr = byteVal.toString(16).padStart(2, '0').toUpperCase();
                        
                        return (
                          <input
                            key={colIndex}
                            id={`hex-cell-${addr}`}
                            className={`w-[1.2rem] bg-transparent text-center focus:bg-blue-100 dark:focus:bg-blue-900/50 outline-none rounded ${colIndex === 8 ? 'ml-2' : ''}`}
                            value={editingAddr === addr ? editingVal : hexStr}
                            maxLength={2}
                            onChange={(e) => handleByteChange(addr, e.target.value)}
                            onFocus={(e) => {
                              setEditingAddr(addr);
                              setEditingVal(hexStr);
                              e.target.select();
                            }}
                            onBlur={() => setEditingAddr(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowRight') { e.preventDefault(); focusCell(addr + 1); }
                              else if (e.key === 'ArrowLeft') { e.preventDefault(); focusCell(addr - 1); }
                              else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(addr - 16); }
                              else if (e.key === 'ArrowDown') { e.preventDefault(); focusCell(addr + 16); }
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="ml-8 text-gray-400 dark:text-[#6A9955] whitespace-pre py-0.5">
                      {[...Array(16)].map((_, colIndex) => {
                        const addr = rowStartAddr + colIndex;
                        if (addr >= MEM_SIZE) return ' ';
                        const byteVal = memory[addr];
                        return (byteVal >= 32 && byteVal <= 126) ? String.fromCharCode(byteVal) : '.';
                      }).join('')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
