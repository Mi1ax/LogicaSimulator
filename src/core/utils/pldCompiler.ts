// WinCUPL (.pld) to JEDEC (.jed) compiler for GAL22V10
import {
  PIN_TO_TRUE_COL,
  OLMC_BY_PIN,
  Expr,
  ProductTerm,
  Sop,
  HEADER_KEYWORDS,
  stripComments,
  expandBracketList,
  parseExpression,
  orSop,
  exprToSop,
} from './cuplParser';

export interface PldCompileError {
  line?: number;
  message: string;
}

export interface PldPinSummary {
  pin: number;
  name: string;
  mode: 'input' | 'combinatorial' | 'registered';
  activeLow: boolean;
  usedTerms: number;
  maxTerms: number;
  hasCustomOe: boolean;
}

export interface PldCompileResult {
  success: boolean;
  jedec?: string;
  fuses?: boolean[];
  errors: PldCompileError[];
  warnings: string[];
  header: Record<string, string>;
  pinSummaries: PldPinSummary[];
}

export function compilePldToJedec(source: string): PldCompileResult {
  const errors: PldCompileError[] = [];
  const warnings: string[] = [];
  const header: Record<string, string> = {};

  const cleaned = stripComments(source);

  // Split by ';' while tracking line numbers
  const statements: { text: string; line: number }[] = [];
  let currentText = '';
  let currentStartLine = 1;
  let lineNum = 1;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === ';') {
      const trimmed = currentText.trim();
      if (trimmed) {
        statements.push({ text: trimmed, line: currentStartLine });
      }
      currentText = '';
      currentStartLine = lineNum;
    } else {
      if (currentText.trim().length === 0 && !/\s/.test(ch)) {
        currentStartLine = lineNum;
      }
      currentText += ch;
      if (ch === '\n') lineNum++;
    }
  }

  // Pin table: name (UPPERCASE) -> { pinNumber, declaredActiveLow, originalName }
  const pinByName = new Map<string, { pin: number; activeLow: boolean; originalName: string }>();
  const pinByNumber = new Map<number, { name: string; activeLow: boolean; originalName: string }>();

  // Equations and intermediate macros
  const macros = new Map<string, Expr>();
  interface RawEquation {
    targetName: string;
    ext: '' | 'D' | 'OE' | 'AR' | 'SP';
    lhsNegated: boolean;
    expr: Expr;
    line: number;
  }
  const equations: RawEquation[] = [];

  for (const stmt of statements) {
    const text = stmt.text;

    // 1. Check Header Keyword (e.g. "Name MyCircuit;" or empty "Location ;")
    const firstWordMatch = text.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+([\s\S]*))?$/);
    if (firstWordMatch && !text.includes('=')) {
      const kw = firstWordMatch[1].toUpperCase();
      if (HEADER_KEYWORDS.has(kw)) {
        header[kw] = (firstWordMatch[2] || '').trim();
        continue;
      }
    }

    // 2. Check PIN declaration: PIN <num|list> = <name|list>
    // In WinCUPL, pin names may start with digits (e.g., 16ms, 2Sec, 2Sec_Load)
    const pinMatch = text.match(/^PIN\s+(\[[^\]]+\]|\d+)\s*=\s*(\[[^\]]+\]|!?\s*[A-Za-z0-9_]+)$/i);
    if (pinMatch) {
      let pinNums: number[];
      let pinNames: string[];
      try {
        pinNums = expandBracketList(pinMatch[1], true).map((s) => parseInt(s, 10));
        pinNames = expandBracketList(pinMatch[2], true);
      } catch (err: unknown) {
        errors.push({
          line: stmt.line,
          message: err instanceof Error ? err.message : 'Invalid PIN range declaration',
        });
        continue;
      }
      if (pinNums.length !== pinNames.length) {
        errors.push({
          line: stmt.line,
          message: `PIN declaration count mismatch: ${pinNums.length} pins vs ${pinNames.length} names`,
        });
        continue;
      }
      for (let i = 0; i < pinNums.length; i++) {
        const pNum = pinNums[i];
        let rawName = pinNames[i].trim();
        let activeLow = false;
        if (rawName.startsWith('!')) {
          activeLow = true;
          rawName = rawName.slice(1).trim();
        }
        if (isNaN(pNum) || pNum < 1 || pNum > 24 || pNum === 12 || pNum === 24) {
          errors.push({
            line: stmt.line,
            message: `Invalid GAL22V10 logic pin number ${pNum} (valid pins are 1..11, 13..23)`,
          });
          continue;
        }
        const upper = rawName.toUpperCase();
        pinByName.set(upper, { pin: pNum, activeLow, originalName: rawName });
        pinByNumber.set(pNum, { name: upper, activeLow, originalName: rawName });
      }
      continue;
    }

    // 3. Check Equation: [!]TARGET[.EXT] = EXPR  or  TARGET := EXPR
    const eqMatch = text.match(/^(!?)\s*([A-Za-z0-9_]+)(?:\.(d|oe|ar|sp))?\s*(:?=)\s*([\s\S]+)$/i);
    if (eqMatch) {
      const lhsNegated = eqMatch[1] === '!';
      const targetName = eqMatch[2].toUpperCase();
      let ext = (eqMatch[3] || '').toUpperCase() as '' | 'D' | 'OE' | 'AR' | 'SP';
      const op = eqMatch[4];
      if (op === ':=' && !ext) {
        ext = 'D';
      }
      const rhsText = eqMatch[5].trim();
      try {
        const expr = parseExpression(rhsText);
        equations.push({ targetName, ext, lhsNegated, expr, line: stmt.line });
      } catch (err: unknown) {
        errors.push({
          line: stmt.line,
          message: `Syntax error in equation for "${eqMatch[2]}": ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      continue;
    }

    errors.push({
      line: stmt.line,
      message: `Unrecognized statement: "${text.slice(0, 50)}"`,
    });
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings, header, pinSummaries: [] };
  }

  // Separate equations into intermediate macros (not a declared pin) vs pin equations
  const pinEquations: RawEquation[] = [];
  for (const eq of equations) {
    if (!pinByName.has(eq.targetName) && eq.ext === '') {
      // Intermediate variable
      const finalExpr: Expr = eq.lhsNegated ? { kind: 'not', expr: eq.expr } : eq.expr;
      macros.set(eq.targetName, finalExpr);
    } else {
      pinEquations.push(eq);
    }
  }

  // First pass: determine which OLMC pins (14..23) are registered (S1=0) vs combinatorial (S1=1),
  // and their output polarity (S0=0 active-low, S0=1 active-high)
  interface OlmcConfig {
    usedAsOutput: boolean;
    registered: boolean; // true -> S1 = 0, false -> S1 = 1
    activeLow: boolean;  // true -> S0 = 0, false -> S0 = 1
    logicSop?: Sop;
    oeSop?: Sop;
    line?: number;
  }

  const olmcConfigs = new Map<number, OlmcConfig>();
  for (let p = 14; p <= 23; p++) {
    const decl = pinByNumber.get(p);
    olmcConfigs.set(p, {
      usedAsOutput: false,
      registered: false,
      activeLow: decl?.activeLow ?? false,
    });
  }

  let arSop: Sop = [];
  let spSop: Sop = [];

  for (const eq of pinEquations) {
    if (eq.ext === 'AR') {
      try {
        arSop = orSop(arSop, exprToSop(eq.expr, macros));
      } catch (err: unknown) {
        errors.push({ line: eq.line, message: err instanceof Error ? err.message : String(err) });
      }
      continue;
    }
    if (eq.ext === 'SP') {
      try {
        spSop = orSop(spSop, exprToSop(eq.expr, macros));
      } catch (err: unknown) {
        errors.push({ line: eq.line, message: err instanceof Error ? err.message : String(err) });
      }
      continue;
    }

    const pinInfo = pinByName.get(eq.targetName);
    if (!pinInfo) {
      errors.push({
        line: eq.line,
        message: `Target "${eq.targetName}" is not assigned to any PIN`,
      });
      continue;
    }

    if (pinInfo.pin < 14 || pinInfo.pin > 23) {
      errors.push({
        line: eq.line,
        message: `Pin ${pinInfo.pin} (${pinInfo.originalName}) is an input-only pin; only pins 14..23 can be used as outputs`,
      });
      continue;
    }

    const cfg = olmcConfigs.get(pinInfo.pin)!;
    try {
      const sop = exprToSop(eq.expr, macros);
      if (eq.ext === 'OE') {
        cfg.oeSop = sop;
      } else {
        cfg.usedAsOutput = true;
        cfg.registered = eq.ext === 'D';
        // Output is active-low if either PIN was declared with '!' OR equation LHS has '!' (XOR)
        cfg.activeLow = pinInfo.activeLow ? !eq.lhsNegated : eq.lhsNegated;
        cfg.logicSop = sop;
        cfg.line = eq.line;
      }
    } catch (err: unknown) {
      errors.push({ line: eq.line, message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings, header, pinSummaries: [] };
  }

  // Initialize fuse array (5892 fuses, default 0)
  const TOTAL_FUSES = 5892;
  const fuses = new Array<boolean>(TOTAL_FUSES).fill(false);

  // Helper to encode a single product term into a 44-column row
  const encodeProductTermRow = (rowIdx: number, term: ProductTerm, line?: number) => {
    const rowStart = rowIdx * 44;
    // Start with all 44 fuses blown (1) so unconnected inputs don't pull the AND gate low
    for (let c = 0; c < 44; c++) {
      fuses[rowStart + c] = true;
    }
    // For each literal in the product term, connect (set fuse to 0) the appropriate column
    for (const lit of term) {
      const pinInfo = pinByName.get(lit.name);
      if (!pinInfo) {
        errors.push({
          line,
          message: `Unknown pin or variable "${lit.name}" in product term`,
        });
        continue;
      }
      const trueCol = PIN_TO_TRUE_COL[pinInfo.pin];
      if (trueCol === undefined) {
        errors.push({
          line,
          message: `Pin ${pinInfo.pin} (${lit.name}) cannot be used as an input in GAL22V10`,
        });
        continue;
      }

      // Check if this pin is a registered OLMC (S1 = 0)
      const olmcCfg = olmcConfigs.get(pinInfo.pin);
      const isRegisteredFeedback = Boolean(olmcCfg?.usedAsOutput && olmcCfg.registered);

      // Account for active-low pin declaration
      let effectiveNegated = pinInfo.activeLow ? !lit.negated : lit.negated;

      // In GAL22V10, registered feedback into the AND array comes from /Q (inverted register state),
      // so trueCol carries !Q and trueCol + 1 carries Q.
      if (isRegisteredFeedback) {
        effectiveNegated = !effectiveNegated;
      }

      const colToConnect = effectiveNegated ? trueCol + 1 : trueCol;
      fuses[rowStart + colToConnect] = false;
    }
  };

  // Encode AR (Row 0) and SP (Row 131) if used
  if (arSop.length > 1) {
    errors.push({ message: `Asynchronous Reset (.ar) supports at most 1 product term, got ${arSop.length}` });
  } else if (arSop.length === 1) {
    encodeProductTermRow(0, arSop[0]);
  }

  if (spSop.length > 1) {
    errors.push({ message: `Synchronous Preset (.sp) supports at most 1 product term, got ${spSop.length}` });
  } else if (spSop.length === 1) {
    encodeProductTermRow(131, spSop[0]);
  }

  // Encode each OLMC (Pins 14..23)
  const pinSummaries: PldPinSummary[] = [];

  for (let p = 14; p <= 23; p++) {
    const olmc = OLMC_BY_PIN[p];
    const cfg = olmcConfigs.get(p)!;
    const pinDecl = pinByNumber.get(p);
    const maxTerms = olmc.size - 1;

    if (!cfg.usedAsOutput) {
      // Unused or pure input pin: S1 = 1 (combinatorial/input), S0 = 1, OE row all 0 (disabled)
      fuses[olmc.s0Fuse] = true;
      fuses[olmc.s1Fuse] = true;
      if (pinDecl) {
        pinSummaries.push({
          pin: p,
          name: pinDecl.originalName,
          mode: 'input',
          activeLow: pinDecl.activeLow,
          usedTerms: 0,
          maxTerms,
          hasCustomOe: false,
        });
      }
      continue;
    }

    // Set S0 (1 = active-high, 0 = active-low) and S1 (1 = combinatorial, 0 = registered)
    fuses[olmc.s0Fuse] = !cfg.activeLow;
    fuses[olmc.s1Fuse] = !cfg.registered;

    // Encode OE row (olmc.startRow)
    if (cfg.oeSop !== undefined) {
      if (cfg.oeSop.length > 1) {
        errors.push({
          line: cfg.line,
          message: `Output Enable (.oe) for pin ${p} (${pinDecl?.originalName}) supports at most 1 product term, got ${cfg.oeSop.length}`,
        });
      } else if (cfg.oeSop.length === 1) {
        encodeProductTermRow(olmc.startRow, cfg.oeSop[0], cfg.line);
      }
      // If cfg.oeSop.length === 0 (constant 0), leave OE row all 0
    } else {
      // Default OE = 1 (all 44 fuses in OE row blown to 1)
      encodeProductTermRow(olmc.startRow, [], cfg.line);
    }

    // Encode logic product terms
    const terms = cfg.logicSop || [];
    if (terms.length > maxTerms) {
      errors.push({
        line: cfg.line,
        message: `Pin ${p} (${pinDecl?.originalName}) requires ${terms.length} product terms, but OLMC ${p} only supports ${maxTerms}`,
      });
    } else {
      for (let t = 0; t < terms.length; t++) {
        encodeProductTermRow(olmc.startRow + 1 + t, terms[t], cfg.line);
      }
    }

    pinSummaries.push({
      pin: p,
      name: pinDecl?.originalName || `IO${p}`,
      mode: cfg.registered ? 'registered' : 'combinatorial',
      activeLow: cfg.activeLow,
      usedTerms: terms.length,
      maxTerms,
      hasCustomOe: cfg.oeSop !== undefined,
    });
  }

  // Also include declared input pins (1..11, 13) in pinSummaries
  for (const [pNum, info] of Array.from(pinByNumber.entries()).sort((a, b) => a[0] - b[0])) {
    if (pNum < 14) {
      pinSummaries.unshift({
        pin: pNum,
        name: info.originalName,
        mode: 'input',
        activeLow: info.activeLow,
        usedTerms: 0,
        maxTerms: 0,
        hasCustomOe: false,
      });
    }
  }
  pinSummaries.sort((a, b) => a.pin - b.pin);

  if (errors.length > 0) {
    return { success: false, errors, warnings, header, pinSummaries };
  }

  // Format standard JEDEC (.jed) string
  const lines: string[] = [
    '\x02',
    `CUPL(WM)        5.0a  Logica Built-in PLD Compiler`,
    `Device          g22v10`,
    `Name            ${header.NAME || 'UNTITLED'}`,
    `Partno          ${header.PARTNO || 'GAL22V10'}`,
    `Revision        ${header.REVISION || header.REV || '01'}`,
    `Designer        ${header.DESIGNER || 'Logica'}`,
    `*QP24`,
    `*QF${TOTAL_FUSES}`,
    `*G0`,
    `*F0`,
  ];

  // Emit *L chunks of 32 fuses for any chunk that contains at least one '1' fuse
  for (let addr = 0; addr < TOTAL_FUSES; addr += 32) {
    const chunkLen = Math.min(32, TOTAL_FUSES - addr);
    let hasOne = false;
    let bits = '';
    for (let i = 0; i < chunkLen; i++) {
      const b = fuses[addr + i];
      if (b) hasOne = true;
      bits += b ? '1' : '0';
    }
    if (hasOne) {
      lines.push(`*L${addr.toString().padStart(5, '0')} ${bits}`);
    }
  }

  // Compute 16-bit JEDEC fuse checksum (*Cxxxx)
  let fuseChecksum = 0;
  for (let byteIdx = 0; byteIdx < Math.ceil(TOTAL_FUSES / 8); byteIdx++) {
    let byteVal = 0;
    for (let bit = 0; bit < 8; bit++) {
      const fIdx = byteIdx * 8 + bit;
      if (fIdx < TOTAL_FUSES && fuses[fIdx]) {
        byteVal |= 1 << bit;
      }
    }
    fuseChecksum = (fuseChecksum + byteVal) & 0xffff;
  }

  lines.push(`*C${fuseChecksum.toString(16).toUpperCase().padStart(4, '0')}`);
  lines.push(`*\x030000`);

  const jedec = lines.join('\r\n');

  return {
    success: true,
    jedec,
    fuses,
    errors: [],
    warnings,
    header,
    pinSummaries,
  };
}
