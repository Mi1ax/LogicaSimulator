import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { compilePldToJedec, PldCompileResult } from '../../core/utils/pldCompiler';
import { FsmDiagramView } from '../components/FsmDiagramView';

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
  {
    id: 'fsm-controller',
    title: 'Finite State Machine (FSM Controller)',
    subtitle: '6-state keypad debounce & display timer controller (S0..S5)',
    code: `Name     NikoYuri ;
PartNo   00 ;
Date     9/8/2026 ;
Revision 01 ;
Designer Engineer ;
Company  LaSalle ;
Assembly None ;
Location  ;
Device   g22v10 ;

/* ************************* INPUT PINS **************/
PIN 1 = T;
PIN 2 = CS0;
PIN 3 = CS1;
PIN 4 = CS2;
PIN 5 = Key;
PIN 6 = 16Ms;
PIN 7 = 2Sec;

/* *********************** OUTPUT PINS ***************/
PIN 14 = 2Sec_Load;
PIN 15 = 2Sec_Enable;
PIN 16 = SaveValue;
PIN 17 = Key_Pressed;
PIN 18 = Bounce;
PIN 19 = NS2;
PIN 20 = NS1;
PIN 21 = NS0;
PIN 22 = Show_Value;

/* ********************** CODIFICATIONS ***************/
S0 = !CS2 & !CS1 & !CS0;
S1 = !CS2 & !CS1 & CS0;
S2 = !CS2 & CS1 & !CS0;
S3 = !CS2 & CS1 & CS0;
S4 = CS2 & !CS1 & !CS0;
S5 = CS2 & !CS1 & CS0;

/* ****************** STATE EQUATIONS ****************/
CondS0 = (S0 & !Key) # (S1 & !Key) # (S5 & 2Sec);
CondS1 = (S0 & Key) # (S1 & Key & !16Ms) # (S5 & Key & !2Sec);
CondS2 = (S1 & Key & 16Ms) # (S2 & Key) # (S3 & Key);
CondS3 = (S2 & !Key) # (S3 & !Key & !16Ms);
CondS4 = S3 & !Key & 16Ms;
CondS5 = S4 # (S5 & !Key & !2Sec);

NS2 = CondS4 # CondS5;
NS1 = CondS2 # CondS3;
NS0 = CondS1 # CondS3 # CondS5;

/* ******************** OUTPUTS **************/
Bounce = S1 # S3;
Key_Pressed = S4 & !T;
SaveValue = S0 # S2 # S5;
!2Sec_Load = S4;
2Sec_Enable = S4 # S5;
Show_Value = S0 # S1 # S4;
`,
  },
];

const HEADER_KW_REGEX = /^(Name|PartNo|Date|Revision|Rev|Designer|Company|Assembly|Location|Device|Format)\b/i;

// Preserve uncompiled draft code across tab switches (Schematic <-> Code Editor)
const editorDraftCache = new Map<
  string,
  { code: string; isDirty: boolean; result: PldCompileResult; baseSource?: string }
>();

/**
 * Tokenizes WinCUPL .pld source code into syntax-highlighted React spans
 * while preserving exact character widths and newlines for 1:1 overlay alignment.
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
  const activeSubcircuitId = useSimulatorStore((state) => state.activeSubcircuitId);
  const selection = useSimulatorStore((state) => state.selection);
  const selectedMemoryNodeId = useSimulatorStore((state) => state.selectedMemoryNodeId);
  const setSelectedMemoryNodeId = useSimulatorStore((state) => state.setSelectedMemoryNodeId);
  const setAppMode = useSimulatorStore((state) => state.setAppMode);
  const updateNodeProperties = useSimulatorStore((state) => state.updateNodeProperties);
  const [editorLayout, setEditorLayout] = useState<'code' | 'split' | 'fsm'>('code');

  const galNodes = useMemo(
    () => nodes.filter((n) => n.type === 'GAL22V10'),
    [nodes]
  );

  const activeGalNode = useMemo(
    () =>
      galNodes.find((n) => n.id === selectedMemoryNodeId) ||
      (selection?.type === 'node' ? galNodes.find((n) => n.id === selection.id) : undefined) ||
      galNodes[0] ||
      null,
    [galNodes, selectedMemoryNodeId, selection]
  );

  const nodePldSource =
    typeof activeGalNode?.properties?.pldSource === 'string'
      ? activeGalNode.properties.pldSource
      : undefined;

  const cacheKey = activeGalNode ? `${activeSubcircuitId}:${activeGalNode.id}` : `${activeSubcircuitId}:__global__`;

  const [code, setCode] = useState<string>(() => {
    const cached = editorDraftCache.get(cacheKey);
    if (cached && cached.baseSource === nodePldSource) return cached.code;
    if (nodePldSource !== undefined) return nodePldSource;
    if (cached) return cached.code;
    return PLD_TEMPLATES[0].code;
  });

  const [lastSyncedKey, setLastSyncedKey] = useState<string>(cacheKey);
  const [lastBaseSource, setLastBaseSource] = useState<string | undefined>(nodePldSource);
  const [compileResult, setCompileResult] = useState<PldCompileResult>(() => {
    const cached = editorDraftCache.get(cacheKey);
    if (cached && cached.baseSource === nodePldSource) return cached.result;
    return compilePldToJedec(code);
  });
  const [isDirty, setIsDirty] = useState<boolean>(() => {
    const cached = editorDraftCache.get(cacheKey);
    return cached && cached.baseSource === nodePldSource ? cached.isDirty : false;
  });
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
  const backdropLayerRef = useRef<HTMLDivElement>(null);
  const gutterInnerRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  // Sync editor source when user switches to a different GAL22V10 node or loads a new circuit (must run before cache write)
  useEffect(() => {
    if (cacheKey !== lastSyncedKey || nodePldSource !== lastBaseSource) {
      setLastSyncedKey(cacheKey);
      setLastBaseSource(nodePldSource);
      const cached = editorDraftCache.get(cacheKey);

      if (cached && cached.baseSource === nodePldSource) {
        setCode(cached.code);
        setCompileResult(cached.result);
        setIsDirty(cached.isDirty);
      } else if (nodePldSource !== undefined) {
        setCode(nodePldSource);
        setCompileResult(compilePldToJedec(nodePldSource));
        setIsDirty(false);
      } else if (cached) {
        setCode(cached.code);
        setCompileResult(cached.result);
        setIsDirty(cached.isDirty);
      } else {
        const fallback = PLD_TEMPLATES[0].code;
        setCode(fallback);
        setCompileResult(compilePldToJedec(fallback));
        setIsDirty(false);
      }

      if (textareaRef.current) {
        textareaRef.current.scrollTop = 0;
        textareaRef.current.scrollLeft = 0;
      }
      setCursorPos({ line: 1, col: 1 });
    }
  }, [cacheKey, lastSyncedKey, nodePldSource, lastBaseSource]);

  // Keep draft cache updated only for the already-synced chip so switching never overwrites the target chip's cache
  useEffect(() => {
    if (cacheKey === lastSyncedKey && nodePldSource === lastBaseSource) {
      editorDraftCache.set(cacheKey, {
        code,
        isDirty,
        result: compileResult,
        baseSource: nodePldSource,
      });
    }
  }, [cacheKey, lastSyncedKey, nodePldSource, lastBaseSource, code, isDirty, compileResult]);

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

  // Normalize CRLF -> LF if any so character offsets and newlines match 1:1
  const normalizedCode = useMemo(() => (code.includes('\r') ? code.replace(/\r\n?/g, '\n') : code), [code]);
  const highlightedCode = useMemo(() => highlightPldCode(normalizedCode), [normalizedCode]);

  const lineCount = useMemo(() => Math.max(1, normalizedCode.split('\n').length), [normalizedCode]);
  const errorLines = useMemo(() => {
    const map = new Map<number, string>();
    for (const err of compileResult.errors) {
      if (err.line !== undefined && !map.has(err.line)) {
        map.set(err.line, err.message);
      }
    }
    return map;
  }, [compileResult.errors]);

  /**
   * Synchronizes the <pre> backdrop and line-number gutter directly via CSS transform
   * (`translate3d`). Unlike `pre.scrollTop = scrollTop`, `translate3d` is NEVER clamped
   * by differences in scrollbar thickness or box height, so the highlighted text,
   * caret, and selection highlight stay 100% locked at all scroll positions and boundaries.
   */
  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const top = ta.scrollTop;
    const left = ta.scrollLeft;
    if (backdropLayerRef.current) {
      backdropLayerRef.current.style.transform = `translate3d(${-left}px, ${-top}px, 0)`;
    }
    if (gutterInnerRef.current) {
      gutterInnerRef.current.style.transform = `translate3d(0, ${-top}px, 0)`;
    }
  }, []);

  useEffect(() => {
    syncScroll();
  }, [normalizedCode, isRightPanelOpen, showExpandedConsoleSafe(isConsoleExpanded, compileResult.errors.length), syncScroll]);

  const updateCursorInfo = useCallback(
    (ta: HTMLTextAreaElement) => {
      const pos = ta.selectionStart ?? 0;
      const before = ta.value.slice(0, pos);
      let line = 1;
      let lastNl = -1;
      for (let i = 0; i < before.length; i++) {
        if (before.charCodeAt(i) === 10) {
          line++;
          lastNl = i;
        }
      }
      const col = pos - lastNl;
      setCursorPos((prev) => (prev.line === line && prev.col === col ? prev : { line, col }));
      syncScroll();
    },
    [syncScroll]
  );

  const jumpToLine = (lineNo: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const lines = normalizedCode.split('\n');
    const targetIdx = Math.max(0, Math.min(lines.length - 1, lineNo - 1));
    let charOffset = 0;
    for (let i = 0; i < targetIdx; i++) {
      charOffset += lines[i].length + 1;
    }
    const lineEnd = charOffset + lines[targetIdx].length;
    ta.focus();
    ta.setSelectionRange(charOffset, lineEnd);
    const targetScrollTop = Math.max(0, targetIdx * 24 - ta.clientHeight / 3);
    ta.scrollTop = targetScrollTop;
    updateCursorInfo(ta);
  };

  const applyCodeEdit = (
    nextCode: string,
    nextSelectionStart: number,
    nextSelectionEnd: number = nextSelectionStart
  ) => {
    setCode(nextCode);
    setIsDirty(true);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(nextSelectionStart, nextSelectionEnd);
        updateCursorInfo(ta);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    // Ctrl+Enter / Cmd+Enter -> Compile & Flash
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCompileAndFlash();
      return;
    }

    // Ctrl+/ or Cmd+/ -> Toggle Comment /* ... */
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      const lineStart = normalizedCode.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = normalizedCode.indexOf('\n', end);
      const lineEnd = lineEndIdx === -1 ? normalizedCode.length : lineEndIdx;
      const selectedBlock = normalizedCode.slice(lineStart, lineEnd);
      const trimmed = selectedBlock.trim();

      if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
        const uncommented = selectedBlock
          .replace(/^\s*\/\*\s?/, (m) => m.replace(/\/\*\s?/, ''))
          .replace(/\s?\*\/\s*$/, (m) => m.replace(/\s?\*\//, ''));
        const nextCode =
          normalizedCode.slice(0, lineStart) + uncommented + normalizedCode.slice(lineEnd);
        applyCodeEdit(nextCode, lineStart, lineStart + uncommented.length);
      } else {
        const commented = `/* ${selectedBlock} */`;
        const nextCode =
          normalizedCode.slice(0, lineStart) + commented + normalizedCode.slice(lineEnd);
        applyCodeEdit(nextCode, lineStart, lineStart + commented.length);
      }
      return;
    }

    // Tab / Shift+Tab -> Indent / Outdent
    if (e.key === 'Tab') {
      e.preventDefault();
      const hasMultiLineSelection =
        start !== end && normalizedCode.slice(start, end).includes('\n');

      if (!e.shiftKey && !hasMultiLineSelection) {
        const nextCode =
          normalizedCode.substring(0, start) + '  ' + normalizedCode.substring(end);
        applyCodeEdit(nextCode, start + 2);
        return;
      }

      const lineStart = normalizedCode.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = normalizedCode.indexOf('\n', Math.max(start, end - 1));
      const lineEnd = lineEndIdx === -1 ? normalizedCode.length : lineEndIdx;
      const block = normalizedCode.slice(lineStart, lineEnd);
      const blockLines = block.split('\n');

      let deltaFirst = 0;
      let deltaTotal = 0;
      const transformedLines = blockLines.map((line, idx) => {
        if (e.shiftKey) {
          if (line.startsWith('  ')) {
            if (idx === 0) deltaFirst = -2;
            deltaTotal -= 2;
            return line.slice(2);
          } else if (line.startsWith(' ') || line.startsWith('\t')) {
            if (idx === 0) deltaFirst = -1;
            deltaTotal -= 1;
            return line.slice(1);
          }
          return line;
        } else {
          if (idx === 0) deltaFirst = 2;
          deltaTotal += 2;
          return '  ' + line;
        }
      });

      const joined = transformedLines.join('\n');
      const nextCode =
        normalizedCode.slice(0, lineStart) + joined + normalizedCode.slice(lineEnd);
      const newStart = Math.max(lineStart, start + deltaFirst);
      const newEnd = Math.max(newStart, end + deltaTotal);
      applyCodeEdit(nextCode, newStart, start === end ? newStart : newEnd);
      return;
    }

    // Enter -> Auto-preserve current line indentation
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const lineStart = normalizedCode.lastIndexOf('\n', start - 1) + 1;
      const currentLineBeforeCursor = normalizedCode.slice(lineStart, start);
      const indentMatch = currentLineBeforeCursor.match(/^[ \t]+/);
      const indent = indentMatch ? indentMatch[0] : '';
      const insertStr = '\n' + indent;
      const nextCode =
        normalizedCode.substring(0, start) + insertStr + normalizedCode.substring(end);
      applyCodeEdit(nextCode, start + insertStr.length);
      return;
    }
  };

  const handleCompileAndFlash = () => {
    const res = compilePldToJedec(normalizedCode);
    setCompileResult(res);
    setIsDirty(false);

    if (!res.success || !res.jedec) {
      setIsConsoleExpanded(true);
      setStatusBanner({
        type: 'error',
        text: `Compilation failed with ${res.errors.length} error(s). Click an error below to jump to its line.`,
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
      pldSource: normalizedCode,
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
        const clean = content.replace(/\r\n?/g, '\n');
        setCode(clean);
        const res = compilePldToJedec(clean);
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
    const nameMatch = normalizedCode.match(/Name\s+([^;\r\n]+)\s*;/i);
    const baseName = nameMatch ? nameMatch[1].trim().replace(/\s+/g, '_') : 'gal22v10_logic';
    const blob = new Blob([normalizedCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.pld`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJed = () => {
    const res = compilePldToJedec(normalizedCode);
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
    const nameMatch = normalizedCode.match(/Name\s+([^;\r\n]+)\s*;/i);
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

  const showExpandedConsole = showExpandedConsoleSafe(isConsoleExpanded, compileResult.errors.length);

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
                      if (textareaRef.current) {
                        textareaRef.current.scrollTop = 0;
                        textareaRef.current.scrollLeft = 0;
                      }
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

        {/* Right: View Layout Switcher, Compile Button & Collapsible Panel Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Code / Split / FSM Diagram Switcher */}
          <div className="flex bg-gray-100 dark:bg-slate-900 p-0.5 rounded-md border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setEditorLayout('code')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                editorLayout === 'code'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
              title="Show CUPL Code Editor only"
            >
              Code
            </button>
            <button
              onClick={() => setEditorLayout('split')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                editorLayout === 'split'
                  ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
              title="Split view: CUPL Code + Read-Only UML FSM Diagram"
            >
              Code + Diagram
            </button>
            <button
              onClick={() => setEditorLayout('fsm')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                editorLayout === 'fsm'
                  ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
              title="Full UML FSM State Diagram"
            >
              FSM Diagram
            </button>
          </div>

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

      {/* Main Split Area: Editor + FSM Diagram + Optional Collapsible Right Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Syntax-Highlighted Code Editor */}
        {editorLayout !== 'fsm' && (
        <div className={`${editorLayout === 'split' ? 'w-1/2 border-r border-gray-200 dark:border-slate-800' : 'flex-1'} flex flex-col bg-white dark:bg-slate-950 overflow-hidden`}>
          <div
            className="flex-1 flex relative overflow-hidden font-mono text-sm"
            style={{ fontVariantLigatures: 'none' }}
          >
            {/* Line Numbers Gutter (translated via translate3d to match textarea.scrollTop 1:1) */}
            <div className="w-12 bg-gray-50 dark:bg-slate-900/80 border-r border-gray-200 dark:border-slate-800 text-right select-none overflow-hidden text-xs leading-6 text-gray-400 dark:text-slate-600 shrink-0 relative">
              <div ref={gutterInnerRef} className="py-4 pr-3 will-change-transform">
                {Array.from({ length: lineCount }, (_, idx) => {
                  const lineNo = idx + 1;
                  const errMsg = !isDirty ? errorLines.get(lineNo) : undefined;
                  const isActiveLine = cursorPos.line === lineNo;
                  return (
                    <div
                      key={lineNo}
                      title={errMsg}
                      onClick={() => jumpToLine(lineNo)}
                      className={`h-6 leading-6 cursor-pointer ${
                        errMsg
                          ? 'text-rose-600 dark:text-rose-400 font-bold bg-rose-100/70 dark:bg-rose-950/70 -mr-3 pr-3'
                          : isActiveLine
                          ? 'text-gray-900 dark:text-slate-100 font-bold'
                          : 'hover:text-gray-600 dark:hover:text-slate-400'
                      }`}
                    >
                      {lineNo}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Viewport Container for Transformed Highlight Backdrop + Native Scrollable Textarea */}
            <div className="flex-1 relative overflow-hidden">
              {/* Transform-synced Backdrop (Active Line Highlight + Error Line Stripes + Syntax Pre) */}
              <div
                ref={backdropLayerRef}
                aria-hidden="true"
                className="absolute top-0 left-0 min-w-full pointer-events-none select-none will-change-transform"
              >
                {/* Active Line Highlight Stripe */}
                <div
                  style={{ top: `${16 + (cursorPos.line - 1) * 24}px`, height: '24px' }}
                  className="absolute left-0 right-0 bg-slate-100/80 dark:bg-slate-800/40"
                />

                {/* Error Line Highlight Stripes */}
                {!isDirty &&
                  Array.from(errorLines.keys()).map((errLine) => (
                    <div
                      key={`err-stripe-${errLine}`}
                      style={{ top: `${16 + (errLine - 1) * 24}px`, height: '24px' }}
                      className="absolute left-0 right-0 bg-rose-500/10 dark:bg-rose-500/15"
                    />
                  ))}

                {/* Syntax Highlighted Code */}
                <pre
                  style={{ tabSize: 2, fontVariantLigatures: 'none' }}
                  className="relative m-0 p-4 border-0 font-mono text-sm leading-6 whitespace-pre pointer-events-none select-none"
                >
                  {highlightedCode}
                  {normalizedCode.endsWith('\n') || normalizedCode.length === 0 ? ' ' : ''}
                </pre>
              </div>

              {/* Native Scrollable Textarea (covers 100% of viewport and all lines, overscroll disabled) */}
              <textarea
                ref={textareaRef}
                value={normalizedCode}
                style={{
                  tabSize: 2,
                  fontVariantLigatures: 'none',
                  overscrollBehavior: 'none',
                }}
                onChange={(e) => {
                  setCode(e.target.value);
                  setIsDirty(true);
                  updateCursorInfo(e.currentTarget);
                }}
                onScroll={syncScroll}
                onKeyDown={handleKeyDown}
                onKeyUp={(e) => updateCursorInfo(e.currentTarget)}
                onMouseDown={(e) => {
                  const ta = e.currentTarget;
                  requestAnimationFrame(() => updateCursorInfo(ta));
                }}
                onClick={(e) => updateCursorInfo(e.currentTarget)}
                onSelect={(e) => updateCursorInfo(e.currentTarget)}
                wrap="off"
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="absolute inset-0 w-full h-full m-0 p-4 border-0 bg-transparent text-transparent caret-gray-900 dark:caret-white selection:bg-indigo-500/25 font-mono text-sm leading-6 whitespace-pre focus:outline-none resize-none overflow-auto overscroll-none select-text"
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
              <div className="flex items-center gap-4 text-[11px] text-gray-400 dark:text-slate-500 font-mono">
                <span>
                  Ln {cursorPos.line}, Col {cursorPos.col}
                </span>
                <span>{showExpandedConsole ? 'Hide Output ▾' : 'Output ▴'}</span>
              </div>
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
                  <button
                    key={`e-${i}`}
                    type="button"
                    onClick={() => {
                      if (err.line) jumpToLine(err.line);
                    }}
                    className="w-full text-left text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded px-1 py-0.5 flex items-start gap-2 transition-colors"
                    title={err.line ? `Click to jump to Line ${err.line}` : undefined}
                  >
                    <span className="font-bold shrink-0 underline decoration-dotted">
                      {err.line ? `[Line ${err.line}]` : '[Error]'}
                    </span>
                    <span>{err.message}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {/* UML FSM State Diagram Panel */}
        {editorLayout !== 'code' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <FsmDiagramView
              pldSource={normalizedCode}
              targetNodeId={activeGalNode?.id || null}
              readOnly={editorLayout === 'split'}
              onPlaceOnSchematic={() => {
                if (activeGalNode) {
                  const res = compilePldToJedec(normalizedCode);
                  updateNodeProperties(activeGalNode.id, {
                    pldSource: normalizedCode,
                    ...(res.success && res.jedec ? { jedecString: res.jedec } : {}),
                  });
                }
                const store = useSimulatorStore.getState();
                store.startPlacingNode('FSM_DIAGRAM');
                const newId = useSimulatorStore.getState().placingNodeId;
                if (newId && activeGalNode) {
                  store.updateNodeProperties(newId, {
                    targetNodeId: activeGalNode.id,
                    label: `FSM State Machine — ${activeGalNode.properties?.label || 'GAL22V10'}`,
                  });
                }
                setAppMode('schematic');
              }}
            />
          </div>
        )}

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
                      Editor Shortcuts
                    </h4>
                    <div className="grid grid-cols-2 gap-1 font-mono text-[11px] bg-gray-50 dark:bg-slate-900 p-2 rounded">
                      <span>Ctrl + Enter</span>
                      <span className="text-gray-400">Compile &amp; Load</span>
                      <span>Ctrl + /</span>
                      <span className="text-gray-400">Toggle Comment</span>
                      <span>Tab / Shift+Tab</span>
                      <span className="text-gray-400">Indent / Outdent</span>
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

function showExpandedConsoleSafe(isExpanded: boolean, errorCount: number): boolean {
  return isExpanded || errorCount > 0;
}
