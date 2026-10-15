import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { compilePldToJedec, PldCompileResult } from '../../core/utils/pldCompiler';

interface PldTemplate {
  id: string;
  title: string;
  subtitle: string;
  code: string;
}

const PLD_TEMPLATES: PldTemplate[] = [
  {
    id: 'comb-gates',
    title: 'Combinatorial Logic & Decoder',
    subtitle: 'Basic gates, XOR, and 2-to-4 decoder with active-low enable',
    code: `Name     CombDemo;
PartNo   01;
Date     2026-10-15;
Revision 01;
Designer Logica;
Device   g22v10;

/* Inputs */
PIN 2 = A;
PIN 3 = B;
PIN 4 = C;
PIN 5 = !EN;   /* Active-low enable */

/* Outputs (OLMC pins 14..23) */
PIN 14 = Y_AND;
PIN 15 = Y_OR;
PIN 16 = Y_XOR;
PIN 17 = !DEC0; /* Active-low decoder outputs */
PIN 18 = !DEC1;
PIN 19 = !DEC2;
PIN 20 = !DEC3;

/* Boolean Equations */
Y_AND = A & B;
Y_OR  = A # B;
Y_XOR = A $ B;

/* 2-to-4 Decoder (enabled when Pin 5 is LOW) */
DEC0 = EN & !A & !B;
DEC1 = EN &  A & !B;
DEC2 = EN & !A &  B;
DEC3 = EN &  A &  B;
`,
  },
  {
    id: 'counter-4bit',
    title: '4-Bit Synchronous Counter',
    subtitle: 'Registered outputs (.d) with Clock, Async Reset (.ar), and Enable',
    code: `Name     Counter4Bit;
PartNo   02;
Date     2026-10-15;
Revision 01;
Designer Logica;
Device   g22v10;

/* Dedicated Clock & Inputs */
PIN 1 = CLK;
PIN 2 = RST;
PIN 3 = EN;

/* Registered Counter Outputs */
PIN 14 = Q0;
PIN 15 = Q1;
PIN 16 = Q2;
PIN 17 = Q3;
PIN 18 = CARRY;

/* Global Asynchronous Reset */
Q0.ar = RST;
Q1.ar = RST;
Q2.ar = RST;
Q3.ar = RST;

/* Next-state Registered Equations */
Q0.d = (!EN & Q0) # (EN & !Q0);
Q1.d = (!EN & Q1) # (EN & (Q1 $ Q0));
Q2.d = (!EN & Q2) # (EN & (Q2 $ (Q1 & Q0)));
Q3.d = (!EN & Q3) # (EN & (Q3 $ (Q2 & Q1 & Q0)));

/* Combinatorial Ripple Carry Output */
CARRY = EN & Q3 & Q2 & Q1 & Q0;
`,
  },
  {
    id: 'tristate-reg',
    title: '4-Bit Tri-State Bus Register',
    subtitle: 'D-register with Output Enable (.oe) control',
    code: `Name     BusReg4;
PartNo   03;
Date     2026-10-15;
Revision 01;
Designer Logica;
Device   g22v10;

/* Control & Data Inputs */
PIN 1 = CLK;
PIN 2 = !OE_N;   /* Active-low Output Enable */
PIN 3 = CLR;
PIN 4 = D0;
PIN 5 = D1;
PIN 6 = D2;
PIN 7 = D3;

/* Tri-State Registered Outputs */
PIN 14 = Q0;
PIN 15 = Q1;
PIN 16 = Q2;
PIN 17 = Q3;

/* Register D inputs */
Q0.d = D0;
Q1.d = D1;
Q2.d = D2;
Q3.d = D3;

/* Output Enable (active when Pin 2 is LOW) */
Q0.oe = OE_N;
Q1.oe = OE_N;
Q2.oe = OE_N;
Q3.oe = OE_N;

/* Asynchronous Reset */
Q0.ar = CLR;
Q1.ar = CLR;
Q2.ar = CLR;
Q3.ar = CLR;
`,
  },
];

const HEADER_KW_REGEX = /^(Name|PartNo|Date|Revision|Rev|Designer|Company|Assembly|Location|Device|Format)\b/i;

/**
 * Tokenizes WinCUPL .pld source code into syntax-highlighted React spans
 * while preserving exact character widths and newlines for overlay alignment.
 */
function highlightPldCode(source: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  let atLineStart = true;

  while (i < source.length) {
    // 1. Block comment /* ... */
    if (source[i] === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const slice = end === -1 ? source.slice(i) : source.slice(i, end + 2);
      nodes.push(
        <span key={key++} className="text-emerald-600/80 dark:text-emerald-500/75 italic">
          {slice}
        </span>
      );
      if (slice.includes('\n')) {
        atLineStart = slice.endsWith('\n');
      }
      i += slice.length;
      continue;
    }

    // 2. Single-line comment // ...
    if (source[i] === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i + 2);
      const slice = nl === -1 ? source.slice(i) : source.slice(i, nl);
      nodes.push(
        <span key={key++} className="text-emerald-600/80 dark:text-emerald-500/75 italic">
          {slice}
        </span>
      );
      i += slice.length;
      continue;
    }

    // 3. Newline
    if (source[i] === '\n') {
      nodes.push('\n');
      atLineStart = true;
      i++;
      continue;
    }

    // 4. Whitespace
    if (/[ \t\r]/.test(source[i])) {
      let ws = '';
      while (i < source.length && /[ \t\r]/.test(source[i])) {
        ws += source[i];
        i++;
      }
      nodes.push(ws);
      continue;
    }

    // 5. Header keywords at line start (Name, Device, PartNo, etc.)
    if (atLineStart) {
      const rest = source.slice(i);
      const hMatch = rest.match(HEADER_KW_REGEX);
      if (hMatch) {
        const kw = hMatch[0];
        const afterKw = rest.slice(kw.length);
        const semiOrNl = afterKw.search(/[;\r\n]|\/\*/);
        if (semiOrNl !== -1 && !afterKw.slice(0, semiOrNl).includes('=')) {
          const valPart = afterKw.slice(0, semiOrNl);
          nodes.push(
            <span key={key++} className="text-purple-600 dark:text-purple-400 font-semibold">
              {kw}
            </span>
          );
          if (valPart) {
            nodes.push(
              <span key={key++} className="text-amber-700 dark:text-amber-300">
                {valPart}
              </span>
            );
          }
          i += kw.length + valPart.length;
          atLineStart = false;
          continue;
        }
      }
    }

    atLineStart = false;

    // 6. OLMC extension (.d, .oe, .ar, .sp)
    if (source[i] === '.') {
      const extMatch = source.slice(i).match(/^\.(d|oe|ar|sp)\b/i);
      if (extMatch) {
        nodes.push(
          <span key={key++} className="text-sky-600 dark:text-cyan-400 font-bold">
            {extMatch[0]}
          </span>
        );
        i += extMatch[0].length;
        continue;
      }
      if (source[i + 1] === '.') {
        nodes.push(
          <span key={key++} className="text-rose-500 dark:text-rose-400 font-bold">
            ..
          </span>
        );
        i += 2;
        continue;
      }
    }

    // 7. Base literal like 'b'0, 'h'FF
    if (source[i] === "'") {
      const bMatch = source.slice(i).match(/^'[bBdDhHoO]'[0-9a-fA-F]+/);
      if (bMatch) {
        nodes.push(
          <span key={key++} className="text-teal-600 dark:text-teal-300">
            {bMatch[0]}
          </span>
        );
        i += bMatch[0].length;
        continue;
      }
    }

    // 8. Operators & punctuation (!, &, #, $, =, :=, ;, parentheses, brackets)
    if (/[!&*#+|$^=~;(),[\]]/.test(source[i]) || (source[i] === ':' && source[i + 1] === '=')) {
      if (source[i] === ':' && source[i + 1] === '=') {
        nodes.push(
          <span key={key++} className="text-rose-600 dark:text-rose-400 font-bold">
            :=
          </span>
        );
        i += 2;
        continue;
      }
      const ch = source[i];
      const isLogicOp = /[!&*#+|$^=~]/.test(ch);
      nodes.push(
        <span
          key={key++}
          className={
            isLogicOp
              ? 'text-rose-600 dark:text-rose-400 font-bold'
              : 'text-gray-500 dark:text-slate-400'
          }
        >
          {ch}
        </span>
      );
      i++;
      continue;
    }

    // 9. Identifiers, PIN keyword, or numbers (including digit-leading names like 16ms, 2Sec_Load)
    if (/[A-Za-z0-9_]/.test(source[i])) {
      let word = '';
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        word += source[i];
        i++;
      }
      const upper = word.toUpperCase();
      if (upper === 'PIN') {
        nodes.push(
          <span key={key++} className="text-amber-600 dark:text-amber-400 font-bold">
            {word}
          </span>
        );
      } else if (/^\d+$/.test(word)) {
        nodes.push(
          <span key={key++} className="text-teal-600 dark:text-teal-300">
            {word}
          </span>
        );
      } else if (upper === 'VCC' || upper === 'GND' || upper === 'TRUE' || upper === 'FALSE') {
        nodes.push(
          <span key={key++} className="text-purple-600 dark:text-purple-400 font-semibold">
            {word}
          </span>
        );
      } else {
        nodes.push(
          <span key={key++} className="text-indigo-950 dark:text-sky-200">
            {word}
          </span>
        );
      }
      continue;
    }

    // Fallback character
    nodes.push(source[i]);
    i++;
  }

  return nodes;
}

export const CodeEditorView: React.FC = () => {
  const nodes = useSimulatorStore((state) => state.nodes);
  const selectedMemoryNodeId = useSimulatorStore((state) => state.selectedMemoryNodeId);
  const setSelectedMemoryNodeId = useSimulatorStore((state) => state.setSelectedMemoryNodeId);
  const updateNodeProperties = useSimulatorStore((state) => state.updateNodeProperties);

  const galNodes = useMemo(
    () => nodes.filter((n) => n.type === 'GAL22V10'),
    [nodes]
  );

  const activeGalNode = useMemo(
    () => galNodes.find((n) => n.id === selectedMemoryNodeId) || galNodes[0] || null,
    [galNodes, selectedMemoryNodeId]
  );

  const [code, setCode] = useState<string>(() => {
    if (activeGalNode?.properties?.pldSource) {
      return activeGalNode.properties.pldSource;
    }
    return PLD_TEMPLATES[0].code;
  });

  const [lastSyncedNodeId, setLastSyncedNodeId] = useState<string | null>(
    activeGalNode?.id ?? null
  );
  const [compileResult, setCompileResult] = useState<PldCompileResult>(() =>
    compilePldToJedec(code)
  );
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(false);
  const [rightTab, setRightTab] = useState<'summary' | 'jedec' | 'reference'>('summary');
  const [openMenu, setOpenMenu] = useState<'file' | 'templates' | null>(null);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jedInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Sync editor source when user switches to a different GAL22V10 node that has saved PLD source
  useEffect(() => {
    if (activeGalNode && activeGalNode.id !== lastSyncedNodeId) {
      setLastSyncedNodeId(activeGalNode.id);
      if (typeof activeGalNode.properties?.pldSource === 'string') {
        setCode(activeGalNode.properties.pldSource);
        setCompileResult(compilePldToJedec(activeGalNode.properties.pldSource));
        setIsDirty(false);
      }
    }
  }, [activeGalNode, lastSyncedNodeId]);

  // Close dropdown menus on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  const activeOlmcs = useMemo(
    () => compileResult.pinSummaries.filter((p) => p.mode !== 'input'),
    [compileResult.pinSummaries]
  );

  const highlightedCode = useMemo(() => highlightPldCode(code), [code]);

  const lineCount = useMemo(() => Math.max(1, code.split('\n').length), [code]);
  const errorLines = useMemo(() => {
    const map = new Map<number, string>();
    for (const err of compileResult.errors) {
      if (err.line !== undefined && !map.has(err.line)) {
        map.set(err.line, err.message);
      }
    }
    return map;
  }, [compileResult.errors]);

  const handleScroll = () => {
    if (!textareaRef.current) return;
    const { scrollTop, scrollLeft } = textareaRef.current;
    if (gutterRef.current) {
      gutterRef.current.scrollTop = scrollTop;
    }
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCompileAndFlash();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const nextCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(nextCode);
      setIsDirty(true);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  };

  const handleCompileAndFlash = () => {
    const res = compilePldToJedec(code);
    setCompileResult(res);
    setIsDirty(false);

    if (!res.success || !res.jedec) {
      setIsConsoleExpanded(true);
      setStatusBanner({
        type: 'error',
        text: `Compilation failed with ${res.errors.length} error(s).`,
      });
      return;
    }

    const olmcCount = res.pinSummaries.filter((p) => p.mode !== 'input').length;

    if (!activeGalNode) {
      setStatusBanner({
        type: 'info',
        text: `Compiled successfully (${olmcCount} OLMCs). Place a GAL22V10 on the Schematic to load it, or use File → Export .jed.`,
      });
      return;
    }

    updateNodeProperties(activeGalNode.id, {
      jedecString: res.jedec,
      pldSource: code,
    });

    const nodeLabel = activeGalNode.properties?.label || `GAL22V10 (#${activeGalNode.id.slice(0, 6)})`;
    setStatusBanner({
      type: 'success',
      text: `Compiled and loaded into ${nodeLabel} (${olmcCount} active OLMCs).`,
    });
  };

  const handleImportPld = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        setCode(content);
        const res = compilePldToJedec(content);
        setCompileResult(res);
        setIsDirty(false);
        const olmcCount = res.pinSummaries.filter((p) => p.mode !== 'input').length;
        setStatusBanner({
          type: res.success ? 'info' : 'error',
          text: res.success
            ? `Loaded "${file.name}" (${olmcCount} OLMCs configured).`
            : `Loaded "${file.name}" with ${res.errors.length} error(s).`,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDirectImportJed = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        if (!activeGalNode) {
          setStatusBanner({
            type: 'error',
            text: 'No GAL22V10 chip on the schematic to load .jed file into.',
          });
          return;
        }
        updateNodeProperties(activeGalNode.id, {
          jedecString: content,
        });
        const nodeLabel = activeGalNode.properties?.label || `GAL22V10 (#${activeGalNode.id.slice(0, 6)})`;
        setStatusBanner({
          type: 'success',
          text: `Loaded "${file.name}" into ${nodeLabel}.`,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportPld = () => {
    const nameMatch = code.match(/Name\s+([^;\r\n]+)\s*;/i);
    const baseName = nameMatch ? nameMatch[1].trim().replace(/\s+/g, '_') : 'gal22v10_logic';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.pld`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJed = () => {
    const res = compilePldToJedec(code);
    setCompileResult(res);
    setIsDirty(false);
    if (!res.success || !res.jedec) {
      setIsConsoleExpanded(true);
      setStatusBanner({
        type: 'error',
        text: `Cannot export .jed: fix ${res.errors.length} compile error(s) first.`,
      });
      return;
    }
    const nameMatch = code.match(/Name\s+([^;\r\n]+)\s*;/i);
    const baseName = nameMatch ? nameMatch[1].trim().replace(/\s+/g, '_') : 'gal22v10_logic';
    const blob = new Blob([res.jedec], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.jed`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner({
      type: 'info',
      text: `Exported "${baseName}.jed".`,
    });
  };

  const showExpandedConsole = isConsoleExpanded || compileResult.errors.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-100 dark:bg-slate-900 overflow-hidden select-none">
      {/* Compact Top Toolbar */}
      <div className="h-11 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 flex items-center justify-between gap-3 shrink-0">
        {/* Left: Menus (File, Templates), File Title, Target GAL selector */}
        <div className="flex items-center gap-2.5 min-w-0" ref={menuContainerRef}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportPld}
            accept=".pld,.txt,.cupl"
            className="hidden"
          />
          <input
            type="file"
            ref={jedInputRef}
            onChange={handleDirectImportJed}
            accept=".jed"
            className="hidden"
          />

          {/* File Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu((prev) => (prev === 'file' ? null : 'file'))}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-medium rounded transition-colors flex items-center gap-1.5"
            >
              <span>File</span>
              <span className="text-[10px] opacity-70">▾</span>
            </button>
            {openMenu === 'file' && (
              <div className="absolute left-0 mt-1.5 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    setOpenMenu(null);
                    fileInputRef.current?.click();
                  }}
                  className="w-full text-left px-3 py-1.5 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between"
                >
                  <span>Load .pld...</span>
                  <span className="text-[10px] text-gray-400 font-mono">.pld</span>
                </button>
                <button
                  onClick={() => {
                    setOpenMenu(null);
                    handleExportPld();
                  }}
                  className="w-full text-left px-3 py-1.5 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between"
                >
                  <span>Save .pld</span>
                  <span className="text-[10px] text-gray-400 font-mono">↓</span>
                </button>
                <div className="my-1 border-t border-gray-200 dark:border-slate-700" />
                <button
                  onClick={() => {
                    setOpenMenu(null);
                    jedInputRef.current?.click();
                  }}
                  className="w-full text-left px-3 py-1.5 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between"
                >
                  <span>Import .jed to IC...</span>
                  <span className="text-[10px] text-gray-400 font-mono">.jed</span>
                </button>
                <button
                  onClick={() => {
                    setOpenMenu(null);
                    handleExportJed();
                  }}
                  className="w-full text-left px-3 py-1.5 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between"
                >
                  <span>Export .jed</span>
                  <span className="text-[10px] text-gray-400 font-mono">↓</span>
                </button>
              </div>
            )}
          </div>

          {/* Templates Dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu((prev) => (prev === 'templates' ? null : 'templates'))}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-medium rounded transition-colors flex items-center gap-1.5"
            >
              <span>Templates</span>
              <span className="text-[10px] opacity-70">▾</span>
            </button>
            {openMenu === 'templates' && (
              <div className="absolute left-0 mt-1.5 w-72 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                  WinCUPL Starter Templates
                </div>
                {PLD_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      setCode(tpl.code);
                      setCompileResult(compilePldToJedec(tpl.code));
                      setIsDirty(false);
                      setOpenMenu(null);
                      setStatusBanner({
                        type: 'info',
                        text: `Loaded template: "${tpl.title}"`,
                      });
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700/70 transition-colors"
                  >
                    <div className="text-xs font-semibold text-gray-800 dark:text-slate-200">
                      {tpl.title}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-slate-400 leading-snug">
                      {tpl.subtitle}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-gray-200 dark:bg-slate-700 mx-0.5" />

          {/* Current Document Name */}
          <span className="text-xs font-mono font-semibold text-gray-700 dark:text-slate-200 truncate">
            {compileResult.header.NAME || 'Untitled'}.pld
            {isDirty ? ' *' : ''}
          </span>

          {/* Target GAL22V10 Selector */}
          <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-slate-700 pl-3">
            <span className="text-xs text-gray-400 dark:text-slate-400">IC:</span>
            {galNodes.length === 0 ? (
              <span className="text-xs text-gray-500 dark:text-slate-400">
                None on schematic
              </span>
            ) : (
              <select
                value={activeGalNode?.id || ''}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedMemoryNodeId(id);
                  const target = galNodes.find((n) => n.id === id);
                  if (target && typeof target.properties?.pldSource === 'string') {
                    setCode(target.properties.pldSource);
                    setCompileResult(compilePldToJedec(target.properties.pldSource));
                    setIsDirty(false);
                  }
                }}
                className="bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 text-xs font-medium rounded px-2 py-1 border border-gray-200 dark:border-slate-600 focus:outline-none focus:border-slate-400"
              >
                {galNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.properties?.label || 'GAL22V10'} (#{n.id.slice(0, 5)}){' '}
                    {n.properties?.jedecString ? '• Programmed' : '• Empty'}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Right: Strict Compile Button & Collapsible Panel Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCompileAndFlash}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white dark:text-slate-100 border border-slate-700 dark:border-slate-600 text-xs font-medium rounded transition-colors"
            title="Compile .pld to JEDEC and load into selected GAL22V10 (Ctrl+Enter)"
          >
            Compile
          </button>

          <button
            onClick={() => setIsRightPanelOpen((prev) => !prev)}
            className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
              isRightPanelOpen
                ? 'bg-gray-200 text-gray-800 border-gray-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500'
                : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
            }`}
            title={isRightPanelOpen ? 'Hide Inspector Panel' : 'Show Pins, JEDEC & Guide'}
          >
            {isRightPanelOpen ? 'Inspector ▸' : '◂ Inspector'}
          </button>
        </div>
      </div>

      {/* Status Notification Banner */}
      {statusBanner && (
        <div
          className={`px-4 py-1.5 text-xs font-medium flex items-center justify-between border-b shrink-0 ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
              : statusBanner.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'
              : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
          }`}
        >
          <span>{statusBanner.text}</span>
          <button
            onClick={() => setStatusBanner(null)}
            className="text-current opacity-60 hover:opacity-100 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Split Area: Editor + Optional Collapsible Right Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Syntax-Highlighted Code Editor */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
          <div className="flex-1 flex relative overflow-hidden font-mono text-sm">
            {/* Line Numbers Gutter */}
            <div
              ref={gutterRef}
              className="w-12 py-4 bg-gray-50 dark:bg-slate-900/80 border-r border-gray-200 dark:border-slate-800 text-right pr-3 select-none overflow-hidden text-xs leading-6 text-gray-400 dark:text-slate-600 shrink-0"
            >
              {Array.from({ length: lineCount }, (_, idx) => {
                const lineNo = idx + 1;
                const errMsg = !isDirty ? errorLines.get(lineNo) : undefined;
                return (
                  <div
                    key={lineNo}
                    title={errMsg}
                    className={`leading-6 ${
                      errMsg
                        ? 'text-rose-600 dark:text-rose-400 font-bold bg-rose-100/70 dark:bg-rose-950/70 -mr-3 pr-3'
                        : ''
                    }`}
                  >
                    {lineNo}
                  </div>
                );
              })}
            </div>

            {/* Overlay Container for Highlighted Pre + Transparent Textarea */}
            <div className="flex-1 relative overflow-hidden">
              {/* Syntax Highlight Backdrop */}
              <pre
                ref={preRef}
                aria-hidden="true"
                className="absolute inset-0 m-0 p-4 font-mono text-sm leading-6 whitespace-pre overflow-hidden pointer-events-none select-none"
              >
                {highlightedCode}
                {'\n'}
              </pre>

              {/* Interactive Textarea */}
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setIsDirty(true);
                }}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                wrap="off"
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="absolute inset-0 w-full h-full m-0 p-4 bg-transparent text-transparent caret-gray-900 dark:caret-white selection:bg-indigo-500/25 font-mono text-sm leading-6 whitespace-pre focus:outline-none resize-none overflow-auto select-text"
                placeholder="Write your WinCUPL .pld logic equations here..."
              />
            </div>
          </div>

          {/* Compact / Collapsible Diagnostics Footer */}
          <div className="border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 flex flex-col shrink-0">
            <button
              onClick={() => setIsConsoleExpanded((prev) => !prev)}
              className="px-4 py-1.5 flex items-center justify-between text-xs hover:bg-gray-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isDirty ? (
                  <span className="text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span>●</span>
                    <span>Modified — click Compile (or Ctrl+Enter) to validate &amp; build JEDEC</span>
                  </span>
                ) : compileResult.success ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <span>✓</span>
                    <span>
                      Build succeeded • {compileResult.pinSummaries.length} Pins • {activeOlmcs.length}/10 OLMCs
                    </span>
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
                    <span>▲</span>
                    <span>{compileResult.errors.length} Compilation Error(s)</span>
                  </span>
                )}
              </div>
              <span className="text-[11px] text-gray-400 dark:text-slate-500 font-mono">
                {showExpandedConsole ? 'Hide Output ▾' : 'Output ▴'}
              </span>
            </button>

            {showExpandedConsole && (
              <div className="max-h-32 overflow-y-auto px-4 py-2 border-t border-gray-200 dark:border-slate-800 font-mono text-xs space-y-1 select-text bg-white/50 dark:bg-slate-950/50">
                {compileResult.errors.length === 0 && compileResult.warnings.length === 0 && (
                  <div className="text-gray-500 dark:text-slate-400">
                    0 errors, 0 warnings. Fuse map (5828 bits) generated.
                  </div>
                )}
                {compileResult.warnings.map((warn, i) => (
                  <div
                    key={`w-${i}`}
                    className="text-amber-600 dark:text-amber-400 flex items-start gap-2"
                  >
                    <span className="font-bold shrink-0">[Warn]</span>
                    <span>{warn}</span>
                  </div>
                ))}
                {compileResult.errors.map((err, i) => (
                  <div
                    key={`e-${i}`}
                    className="text-rose-600 dark:text-rose-400 flex items-start gap-2"
                  >
                    <span className="font-bold shrink-0">
                      {err.line ? `[Line ${err.line}]` : '[Error]'}
                    </span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Right Panel: OLMC Summary / JEDEC Fuse Preview / Guide */}
        {isRightPanelOpen && (
          <div className="w-80 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 flex flex-col shrink-0 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 text-xs font-semibold">
              <button
                onClick={() => setRightTab('summary')}
                className={`flex-1 py-2 border-b-2 transition-colors ${
                  rightTab === 'summary'
                    ? 'border-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-300 bg-white dark:bg-slate-800'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
                }`}
              >
                OLMC &amp; Pins
              </button>
              <button
                onClick={() => setRightTab('jedec')}
                className={`flex-1 py-2 border-b-2 transition-colors ${
                  rightTab === 'jedec'
                    ? 'border-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-300 bg-white dark:bg-slate-800'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
                }`}
              >
                JEDEC (.jed)
              </button>
              <button
                onClick={() => setRightTab('reference')}
                className={`flex-1 py-2 border-b-2 transition-colors ${
                  rightTab === 'reference'
                    ? 'border-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-300 bg-white dark:bg-slate-800'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
                }`}
              >
                Syntax Guide
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-3.5 select-text">
              {rightTab === 'summary' && (
                <div className="space-y-4">
                  {/* Declared Pins */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
                      Declared Pins ({compileResult.pinSummaries.length})
                    </h4>
                    {compileResult.pinSummaries.length === 0 ? (
                      <div className="text-xs text-gray-400 italic">
                        No PIN declarations found.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {compileResult.pinSummaries.map((p) => (
                          <div
                            key={p.pin}
                            className="px-2 py-1 rounded bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-700 flex items-center justify-between text-xs font-mono"
                          >
                            <span className="text-gray-400 dark:text-slate-400">
                              P{p.pin}
                            </span>
                            <span className="font-bold text-gray-800 dark:text-slate-200 truncate ml-1">
                              {p.activeLow ? `!${p.name}` : p.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* OLMC Macrocell Utilization */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
                      OLMC Macrocells (Pins 14..23)
                    </h4>
                    <div className="space-y-1.5">
                      {Array.from({ length: 10 }, (_, idx) => {
                        const pinNum = 23 - idx;
                        const olmc = activeOlmcs.find((o) => o.pin === pinNum);
                        const maxTermsMap: Record<number, number> = {
                          23: 8,
                          22: 10,
                          21: 12,
                          20: 14,
                          19: 16,
                          18: 16,
                          17: 14,
                          16: 12,
                          15: 10,
                          14: 8,
                        };
                        const maxTerms = maxTermsMap[pinNum];
                        return (
                          <div
                            key={pinNum}
                            className={`p-2 rounded border text-xs ${
                              olmc
                                ? 'bg-gray-50 dark:bg-slate-800/90 border-gray-300 dark:border-slate-600'
                                : 'bg-gray-50/50 dark:bg-slate-800/30 border-gray-200 dark:border-slate-700/50 opacity-50'
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono">
                              <span className="font-bold text-gray-800 dark:text-slate-200">
                                Pin {pinNum}{' '}
                                {olmc ? `(${olmc.activeLow ? '!' : ''}${olmc.name})` : ''}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  !olmc
                                    ? 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
                                    : olmc.mode === 'registered'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                    : 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                                }`}
                              >
                                {olmc ? olmc.mode : 'Unused'}
                              </span>
                            </div>
                            {olmc && (
                              <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400">
                                <span>
                                  {olmc.activeLow ? 'Active-Low (S0=0)' : 'Active-High (S0=1)'}
                                </span>
                                <span className="font-mono">
                                  {olmc.usedTerms}/{maxTerms} PTs
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {rightTab === 'jedec' && (
                <div className="space-y-2.5 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                      JEDEC Fuse Map
                    </span>
                    {compileResult.success && (
                      <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                        5828 Fuses
                      </span>
                    )}
                  </div>
                  {compileResult.success && compileResult.jedec ? (
                    <pre className="flex-1 p-2.5 rounded bg-slate-950 text-emerald-400 font-mono text-[11px] leading-relaxed overflow-auto border border-slate-800">
                      {compileResult.jedec}
                    </pre>
                  ) : (
                    <div className="p-3 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                      Fix compilation errors in the editor to generate the JEDEC fuse map.
                    </div>
                  )}
                </div>
              )}

              {rightTab === 'reference' && (
                <div className="space-y-3 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-slate-100 mb-1">
                      CUPL Operators
                    </h4>
                    <div className="grid grid-cols-2 gap-1 font-mono text-[11px] bg-gray-50 dark:bg-slate-900 p-2 rounded">
                      <span>! or ~</span>
                      <span className="text-gray-400">NOT</span>
                      <span>&amp; or *</span>
                      <span className="text-gray-400">AND</span>
                      <span># or +</span>
                      <span className="text-gray-400">OR</span>
                      <span>$ or ^</span>
                      <span className="text-gray-400">XOR</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-slate-100 mb-1">
                      GAL22V10 Pins
                    </h4>
                    <ul className="list-disc pl-4 space-y-0.5 font-mono text-[11px]">
                      <li>Pin 1: CLK / IN1</li>
                      <li>Pins 2..11, 13: Dedicated Inputs</li>
                      <li>Pin 12: GND, Pin 24: VCC</li>
                      <li>Pins 14..23: 10 OLMCs (Out / Feedback)</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-slate-100 mb-1">
                      OLMC Extensions
                    </h4>
                    <ul className="space-y-1 text-[11px]">
                      <li>
                        <code className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          Y = expr;
                        </code>{' '}
                        — Combinatorial
                      </li>
                      <li>
                        <code className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          Y.d = expr;
                        </code>{' '}
                        — Registered D-FF
                      </li>
                      <li>
                        <code className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          Y.oe = expr;
                        </code>{' '}
                        — Output Enable
                      </li>
                      <li>
                        <code className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          Y.ar / Y.sp
                        </code>{' '}
                        — Async Reset / Sync Preset
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
