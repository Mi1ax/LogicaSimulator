// Automatic Finite State Machine (FSM) extractor from WinCUPL (.pld) source code
import { IC_GAL22V10 } from '../engine/nodes/ics/pld';

export interface FsmStateOutput {
  name: string;
  pin: number;
  /** '1', '0', or a boolean expression string (for Mealy outputs like '!T') */
  value: string;
  /** True if this output was assigned with active-low LHS (!Out = ...) */
  declaredActiveLow: boolean;
  /** True if this output is 'active' in this state (1 for active-high, 0 for active-low, or conditional) */
  isActive: boolean;
  /** True if this output differs from the idle/first state S0 */
  differsFromDefault: boolean;
}

export interface FsmTransition {
  id: string;
  from: string;
  to: string;
  guard: string;
  isSelfLoop: boolean;
}

export interface FsmStateNode {
  name: string;
  code: string; // binary string MSB..LSB, e.g. "001"
  index: number; // numeric value of code, e.g. 1
  outputs: FsmStateOutput[];
}

export interface ExtractedFsm {
  hasFsm: boolean;
  reason?: string;
  deviceName?: string;
  csBits: { name: string; pin?: number }[]; // MSB -> LSB
  nsBits: { name: string; pin?: number }[]; // MSB -> LSB
  inputSignals: { name: string; pin?: number }[];
  outputSignals: { name: string; pin: number; activeLow: boolean }[];
  states: FsmStateNode[];
  transitions: FsmTransition[];
}

// --- Internal Boolean AST & SOP representation ---

type Expr =
  | { kind: 'const'; value: 0 | 1 }
  | { kind: 'var'; name: string }
  | { kind: 'not'; expr: Expr }
  | { kind: 'and'; left: Expr; right: Expr }
  | { kind: 'or'; left: Expr; right: Expr }
  | { kind: 'xor'; left: Expr; right: Expr };

interface Literal {
  name: string;
  negated: boolean;
}

type ProductTerm = Literal[];
type Sop = ProductTerm[];

const HEADER_KEYWORDS = new Set([
  'NAME', 'PARTNO', 'DATE', 'REVISION', 'REV', 'DESIGNER', 'COMPANY', 'ASSEMBLY', 'LOCATION', 'DEVICE', 'FORMAT',
]);

function stripComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    if (source[i] === '/' && source[i + 1] === '*') {
      out += '  ';
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < source.length) {
        out += '  ';
        i += 2;
      }
    } else if (source[i] === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else {
      out += source[i];
      i++;
    }
  }
  return out;
}

const MAX_BRACKET_RANGE = 64;
const MAX_SOP_TERMS = 256;

function expandBracketList(raw: string): string[] {
  const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!inner) return [];
  const items: string[] = [];
  for (const part of inner.split(',')) {
    const trimmed = part.trim();
    const rangeMatch = trimmed.match(/^([A-Za-z0-9_]*?)(\d+)\s*\.\.\s*([A-Za-z0-9_]*?)(\d+)$/);
    if (rangeMatch) {
      const prefix = rangeMatch[1] || rangeMatch[3];
      const start = parseInt(rangeMatch[2], 10);
      const end = parseInt(rangeMatch[4], 10);
      if (Math.abs(end - start) > MAX_BRACKET_RANGE) {
        return [];
      }
      const step = start <= end ? 1 : -1;
      for (let v = start; step > 0 ? v <= end : v >= end; v += step) {
        items.push(`${prefix}${v}`);
      }
    } else if (trimmed) {
      items.push(trimmed);
    }
  }
  return items;
}

type Token =
  | { type: 'IDENT'; value: string }
  | { type: 'CONST'; value: 0 | 1 }
  | { type: 'NOT' }
  | { type: 'AND' }
  | { type: 'OR' }
  | { type: 'XOR' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' };

function tokenizeExpr(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '!' || ch === '~') {
      tokens.push({ type: 'NOT' });
      i++;
    } else if (ch === '&' || ch === '*') {
      tokens.push({ type: 'AND' });
      i++;
    } else if (ch === '#' || ch === '+' || ch === '|') {
      tokens.push({ type: 'OR' });
      i++;
    } else if (ch === '$' || ch === '^') {
      tokens.push({ type: 'XOR' });
      i++;
    } else if (ch === '(') {
      tokens.push({ type: 'LPAREN' });
      i++;
    } else if (ch === ')') {
      tokens.push({ type: 'RPAREN' });
      i++;
    } else if (ch === "'") {
      const m = input.slice(i).match(/^'[bBdDhHoO]'([0-9a-fA-F]+)/);
      if (m) {
        const val = parseInt(m[1], 16);
        tokens.push({ type: 'CONST', value: val ? 1 : 0 });
        i += m[0].length;
      } else {
        throw new Error(`Unexpected "'"`);
      }
    } else if (/[01]/.test(ch) && !/[A-Za-z0-9_]/.test(input[i + 1] || '')) {
      tokens.push({ type: 'CONST', value: ch === '1' ? 1 : 0 });
      i++;
    } else if (/[A-Za-z0-9_]/.test(ch)) {
      let ident = '';
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      tokens.push({ type: 'IDENT', value: ident });
    } else {
      throw new Error(`Unexpected '${ch}'`);
    }
  }
  return tokens;
}

function parseExpression(input: string): Expr {
  const tokens = tokenizeExpr(input);
  if (tokens.length === 0) throw new Error('Empty expression');
  let pos = 0;

  const parseOr = (): Expr => {
    let left = parseXor();
    while (pos < tokens.length && tokens[pos].type === 'OR') {
      pos++;
      left = { kind: 'or', left, right: parseXor() };
    }
    return left;
  };

  const parseXor = (): Expr => {
    let left = parseAnd();
    while (pos < tokens.length && tokens[pos].type === 'XOR') {
      pos++;
      left = { kind: 'xor', left, right: parseAnd() };
    }
    return left;
  };

  const parseAnd = (): Expr => {
    let left = parseUnary();
    while (pos < tokens.length && tokens[pos].type === 'AND') {
      pos++;
      left = { kind: 'and', left, right: parseUnary() };
    }
    return left;
  };

  const parseUnary = (): Expr => {
    if (pos < tokens.length && tokens[pos].type === 'NOT') {
      pos++;
      return { kind: 'not', expr: parseUnary() };
    }
    return parsePrimary();
  };

  const parsePrimary = (): Expr => {
    const tok = tokens[pos];
    if (!tok) throw new Error('Unexpected end');
    if (tok.type === 'LPAREN') {
      pos++;
      const inner = parseOr();
      if (!tokens[pos] || tokens[pos].type !== 'RPAREN') throw new Error('Missing ")"');
      pos++;
      return inner;
    }
    if (tok.type === 'CONST') {
      pos++;
      return { kind: 'const', value: tok.value };
    }
    if (tok.type === 'IDENT') {
      pos++;
      return { kind: 'var', name: tok.value };
    }
    throw new Error('Unexpected token');
  };

  const ast = parseOr();
  if (pos < tokens.length) throw new Error('Extra tokens');
  return ast;
}

function simplifyTerm(term: ProductTerm): ProductTerm | null {
  const map = new Map<string, boolean>();
  for (const lit of term) {
    const key = lit.name.toUpperCase();
    const existing = map.get(key);
    if (existing !== undefined && existing !== lit.negated) {
      return null;
    }
    map.set(key, lit.negated);
  }
  const result: ProductTerm = [];
  for (const [name, negated] of map.entries()) {
    result.push({ name, negated });
  }
  result.sort((a, b) => a.name.localeCompare(b.name) || Number(a.negated) - Number(b.negated));
  return result;
}

function termKey(term: ProductTerm): string {
  return term.map(l => `${l.negated ? '!' : ''}${l.name}`).join('&');
}

function isSubsetTerm(smaller: ProductTerm, larger: ProductTerm): boolean {
  if (smaller.length > larger.length) return false;
  return smaller.every(s => larger.some(l => l.name === s.name && l.negated === s.negated));
}

/**
 * Simplifies a Sum-of-Products using:
 * 1. Contradiction elimination (A & !A = 0)
 * 2. Duplicate elimination (T # T = T)
 * 3. Absorption (T1 # (T1 & T2) = T1)
 * 4. Adjacency merging ((X & A) # (X & !A) = X)
 * 5. Complement reduction (A # (!A & B) = A # B)
 */
function simplifySop(sop: Sop): Sop {
  let terms: Sop = [];
  const seen = new Set<string>();

  for (const rawTerm of sop) {
    const simplified = simplifyTerm(rawTerm);
    if (simplified === null) continue;
    if (simplified.length === 0) return [[]];
    const k = termKey(simplified);
    if (!seen.has(k)) {
      seen.add(k);
      terms.push(simplified);
      if (terms.length > MAX_SOP_TERMS) {
        throw new Error(`SOP exceeds ${MAX_SOP_TERMS} terms`);
      }
    }
  }

  // Only run O(T^2) boolean minimization passes when the SOP is reasonably small
  let changed = terms.length <= 64;
  let iter = 0;
  while (changed && iter < 12) {
    changed = false;
    iter++;

    // 1. Absorption: remove any term that is a superset of another term
    const absorbed = new Array(terms.length).fill(false);
    for (let i = 0; i < terms.length; i++) {
      if (absorbed[i]) continue;
      for (let j = 0; j < terms.length; j++) {
        if (i === j || absorbed[j]) continue;
        if (isSubsetTerm(terms[i], terms[j])) {
          absorbed[j] = true;
          changed = true;
        }
      }
    }
    if (changed) {
      terms = terms.filter((_, idx) => !absorbed[idx]);
      if (terms.some(t => t.length === 0)) return [[]];
    }

    // 2. Adjacency merging: (X & A) # (X & !A) -> X
    outerMerge: for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        if (terms[i].length !== terms[j].length) continue;
        let diffIdx = -1;
        let sameVars = true;
        for (let k = 0; k < terms[i].length; k++) {
          if (terms[i][k].name !== terms[j][k].name) {
            sameVars = false;
            break;
          }
          if (terms[i][k].negated !== terms[j][k].negated) {
            if (diffIdx !== -1) {
              sameVars = false;
              break;
            }
            diffIdx = k;
          }
        }
        if (sameVars && diffIdx !== -1) {
          const merged = terms[i].filter((_, idx) => idx !== diffIdx);
          if (merged.length === 0) return [[]];
          terms.splice(j, 1);
          terms[i] = merged;
          changed = true;
          break outerMerge;
        }
      }
    }

    // 3. Complement reduction: (X & A) # (X & !A & Y) -> (X & A) # (X & Y)
    outerComp: for (let i = 0; i < terms.length; i++) {
      const ti = terms[i];
      if (ti.length === 0) return [[]];
      for (let j = 0; j < terms.length; j++) {
        if (i === j) continue;
        const tj = terms[j];
        if (tj.length <= ti.length) continue;
        // Check if ti has all literals in tj except exactly one literal L which is negated in tj
        let oppIdxInJ = -1;
        let allOthersPresent = true;
        for (const litI of ti) {
          const matchSame = tj.findIndex(l => l.name === litI.name && l.negated === litI.negated);
          if (matchSame !== -1) continue;
          const matchOpp = tj.findIndex(l => l.name === litI.name && l.negated !== litI.negated);
          if (matchOpp !== -1 && oppIdxInJ === -1) {
            oppIdxInJ = matchOpp;
          } else {
            allOthersPresent = false;
            break;
          }
        }
        if (allOthersPresent && oppIdxInJ !== -1) {
          terms[j] = tj.filter((_, idx) => idx !== oppIdxInJ);
          if (terms[j].length === 0) return [[]];
          changed = true;
          break outerComp;
        }
      }
    }
  }

  // Deduplicate final
  const finalSeen = new Set<string>();
  const finalOut: Sop = [];
  for (const t of terms) {
    const k = termKey(t);
    if (!finalSeen.has(k)) {
      finalSeen.add(k);
      finalOut.push(t);
    }
  }
  return finalOut;
}

function andSop(a: Sop, b: Sop): Sop {
  if (a.length === 0 || b.length === 0) return [];
  if (a.length * b.length > MAX_SOP_TERMS * 8) {
    throw new Error(`SOP multiplication exceeds limit`);
  }
  const combined: Sop = [];
  for (const ta of a) {
    for (const tb of b) {
      combined.push([...ta, ...tb]);
    }
  }
  return simplifySop(combined);
}

function orSop(a: Sop, b: Sop): Sop {
  return simplifySop([...a, ...b]);
}

function notSop(sop: Sop): Sop {
  if (sop.length === 0) return [[]];
  let acc: Sop = [[]];
  for (const term of sop) {
    if (term.length === 0) return [];
    const invertedLiterals: Sop = term.map(lit => [{ name: lit.name, negated: !lit.negated }]);
    acc = andSop(acc, invertedLiterals);
  }
  return acc;
}

function exprToDualSop(
  expr: Expr,
  macros: Map<string, Expr>,
  visiting: Set<string> = new Set()
): { pos: Sop; neg: Sop } {
  switch (expr.kind) {
    case 'const':
      return expr.value === 1 ? { pos: [[]], neg: [] } : { pos: [], neg: [[]] };
    case 'var': {
      const upper = expr.name.toUpperCase();
      if (upper === 'VCC' || upper === 'TRUE') return { pos: [[]], neg: [] };
      if (upper === 'GND' || upper === 'FALSE') return { pos: [], neg: [[]] };
      const macroExpr = macros.get(upper);
      if (macroExpr) {
        if (visiting.has(upper)) {
          return {
            pos: [[{ name: upper, negated: false }]],
            neg: [[{ name: upper, negated: true }]],
          };
        }
        const nextVisiting = new Set(visiting);
        nextVisiting.add(upper);
        return exprToDualSop(macroExpr, macros, nextVisiting);
      }
      return {
        pos: [[{ name: upper, negated: false }]],
        neg: [[{ name: upper, negated: true }]],
      };
    }
    case 'not': {
      const inner = exprToDualSop(expr.expr, macros, visiting);
      return { pos: inner.neg, neg: inner.pos };
    }
    case 'and': {
      const l = exprToDualSop(expr.left, macros, visiting);
      const r = exprToDualSop(expr.right, macros, visiting);
      return {
        pos: andSop(l.pos, r.pos),
        neg: orSop(l.neg, r.neg),
      };
    }
    case 'or': {
      const l = exprToDualSop(expr.left, macros, visiting);
      const r = exprToDualSop(expr.right, macros, visiting);
      return {
        pos: orSop(l.pos, r.pos),
        neg: andSop(l.neg, r.neg),
      };
    }
    case 'xor': {
      const l = exprToDualSop(expr.left, macros, visiting);
      const r = exprToDualSop(expr.right, macros, visiting);
      return {
        pos: orSop(andSop(l.pos, r.neg), andSop(l.neg, r.pos)),
        neg: orSop(andSop(l.pos, r.pos), andSop(l.neg, r.neg)),
      };
    }
  }
}

function exprToSop(
  expr: Expr,
  macros: Map<string, Expr>,
  visiting: Set<string> = new Set()
): Sop {
  return exprToDualSop(expr, macros, visiting).pos;
}

/**
 * Partially evaluates a SOP given a partial assignment of state bit variables.
 */
function restrictSop(sop: Sop, assignment: Map<string, 0 | 1>): Sop {
  const restricted: Sop = [];
  for (const term of sop) {
    let termZero = false;
    const remaining: ProductTerm = [];
    for (const lit of term) {
      const val = assignment.get(lit.name.toUpperCase());
      if (val !== undefined) {
        const litVal = lit.negated ? (val === 1 ? 0 : 1) : val;
        if (litVal === 0) {
          termZero = true;
          break;
        }
      } else {
        remaining.push(lit);
      }
    }
    if (!termZero) {
      restricted.push(remaining);
    }
  }
  return simplifySop(restricted);
}

function formatSop(sop: Sop, displayNames: Map<string, string>): string {
  if (sop.length === 0) return '0';
  if (sop.length === 1 && sop[0].length === 0) return '1';

  const termStrings = sop.map(term => {
    if (term.length === 0) return '1';
    return term
      .map(l => `${l.negated ? '!' : ''}${displayNames.get(l.name.toUpperCase()) || l.name}`)
      .join(' & ');
  });

  if (termStrings.length === 1) return termStrings[0];
  return termStrings.map(s => (s.includes(' & ') ? `(${s})` : s)).join(' # ');
}

function extractTrailingNumber(name: string): number {
  const m = name.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : -1;
}

export function extractFsmFromPld(source: string): ExtractedFsm {
  const emptyResult = (reason: string): ExtractedFsm => ({
    hasFsm: false,
    reason,
    csBits: [],
    nsBits: [],
    inputSignals: [],
    outputSignals: [],
    states: [],
    transitions: [],
  });

  if (!source || !source.trim()) {
    return emptyResult('Empty PLD source');
  }

  const cleaned = stripComments(source);
  const statements: string[] = cleaned
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  const header: Record<string, string> = {};
  const pinByName = new Map<string, { pin: number; activeLow: boolean; originalName: string }>();
  const displayNames = new Map<string, string>();
  const macros = new Map<string, Expr>();
  const macroOriginalNames = new Map<string, string>();

  interface RawEq {
    targetName: string;
    originalTargetName: string;
    ext: '' | 'D' | 'OE' | 'AR' | 'SP';
    lhsNegated: boolean;
    expr: Expr;
  }
  const allEquations: RawEq[] = [];

  for (const text of statements) {
    const firstWordMatch = text.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+([\s\S]*))?$/);
    if (firstWordMatch && !text.includes('=')) {
      const kw = firstWordMatch[1].toUpperCase();
      if (HEADER_KEYWORDS.has(kw)) {
        header[kw] = (firstWordMatch[2] || '').trim();
        continue;
      }
    }

    const pinMatch = text.match(/^PIN\s+(\[[^\]]+\]|\d+)\s*=\s*(\[[^\]]+\]|!?\s*[A-Za-z0-9_]+)$/i);
    if (pinMatch) {
      const pinNums = expandBracketList(pinMatch[1]).map(s => parseInt(s, 10));
      const pinNames = expandBracketList(pinMatch[2]);
      if (pinNums.length === pinNames.length) {
        for (let i = 0; i < pinNums.length; i++) {
          const pNum = pinNums[i];
          let rawName = pinNames[i].trim();
          let activeLow = false;
          if (rawName.startsWith('!')) {
            activeLow = true;
            rawName = rawName.slice(1).trim();
          }
          const upper = rawName.toUpperCase();
          pinByName.set(upper, { pin: pNum, activeLow, originalName: rawName });
          displayNames.set(upper, rawName);
        }
      }
      continue;
    }

    const eqMatch = text.match(/^(!?)\s*([A-Za-z0-9_]+)(?:\.(d|oe|ar|sp))?\s*(:?=)\s*([\s\S]+)$/i);
    if (eqMatch) {
      const lhsNegated = eqMatch[1] === '!';
      const originalTargetName = eqMatch[2];
      const targetName = originalTargetName.toUpperCase();
      let ext = (eqMatch[3] || '').toUpperCase() as '' | 'D' | 'OE' | 'AR' | 'SP';
      if (eqMatch[4] === ':=' && !ext) ext = 'D';
      try {
        const expr = parseExpression(eqMatch[5].trim());
        allEquations.push({ targetName, originalTargetName, ext, lhsNegated, expr });
      } catch {
        // Ignore unparseable equation while typing
      }
    }
  }

  const pinEquations: RawEq[] = [];
  for (const eq of allEquations) {
    if (!pinByName.has(eq.targetName) && eq.ext === '') {
      const finalExpr: Expr = eq.lhsNegated ? { kind: 'not', expr: eq.expr } : eq.expr;
      macros.set(eq.targetName, finalExpr);
      macroOriginalNames.set(eq.targetName, eq.originalTargetName);
      displayNames.set(eq.targetName, eq.originalTargetName);
    } else {
      pinEquations.push(eq);
    }
  }

  // 1. Detect state macros (e.g. S0 = !CS2 & !CS1 & !CS0)
  // A state macro is a single product term over K >= 1 pin variables where multiple macros share the exact same variable set
  interface CandidateStateMacro {
    name: string;
    upperName: string;
    varKey: string;
    vars: string[];
    term: ProductTerm;
  }
  const candidateGroups = new Map<string, CandidateStateMacro[]>();

  for (const [macroName, expr] of macros.entries()) {
    try {
      const sop = exprToSop(expr, macros);
      if (sop.length === 1 && sop[0].length >= 1 && sop[0].length <= 6) {
        const term = sop[0];
        if (term.every(l => pinByName.has(l.name))) {
          const vars = term.map(l => l.name).sort();
          const varKey = vars.join(',');
          const list = candidateGroups.get(varKey) || [];
          list.push({
            name: macroOriginalNames.get(macroName) || macroName,
            upperName: macroName,
            varKey,
            vars,
            term,
          });
          candidateGroups.set(varKey, list);
        }
      }
    } catch {
      // skip
    }
  }

  // Pick the group with the most state definitions (at least 2 states)
  let bestStateGroup: CandidateStateMacro[] | null = null;
  for (const group of candidateGroups.values()) {
    if (group.length >= 2) {
      if (!bestStateGroup || group.length > bestStateGroup.length) {
        bestStateGroup = group;
      }
    }
  }

  let csVarNames: string[] = []; // MSB -> LSB
  let nsEquationsByBit: { name: string; pin?: number; sop: Sop }[] = []; // MSB -> LSB

  if (bestStateGroup) {
    // Sort CS bits from MSB to LSB (highest trailing number first, e.g. CS2, CS1, CS0)
    csVarNames = [...bestStateGroup[0].vars].sort((a, b) => {
      const na = extractTrailingNumber(a);
      const nb = extractTrailingNumber(b);
      if (na !== nb) return nb - na;
      return b.localeCompare(a);
    });
  } else {
    // Fallback: Check for registered .D equations (e.g. Q2.d, Q1.d, Q0.d) or CS/NS pairs
    const regEqs = pinEquations.filter(eq => eq.ext === 'D');
    if (regEqs.length >= 2 && regEqs.length <= 5) {
      const sortedReg = [...regEqs].sort((a, b) => {
        const na = extractTrailingNumber(a.targetName);
        const nb = extractTrailingNumber(b.targetName);
        if (na !== nb) return nb - na;
        return b.targetName.localeCompare(a.targetName);
      });
      csVarNames = sortedReg.map(r => r.targetName);
    }
  }

  if (csVarNames.length === 0) {
    return emptyResult('No state bits or state definitions (e.g. S0..Sn or registered .d bits) found in PLD code.');
  }

  // 2. Match Next-State equations for each CS bit (MSB -> LSB)
  try {
    for (const csVar of csVarNames) {
      // Check if csVar itself has a registered .D equation
      const regEq = pinEquations.find(eq => eq.targetName === csVar && eq.ext === 'D');
      if (regEq) {
        const effectiveExpr: Expr = regEq.lhsNegated ? { kind: 'not', expr: regEq.expr } : regEq.expr;
        const pinInfo = pinByName.get(csVar);
        nsEquationsByBit.push({
          name: `${displayNames.get(csVar) || csVar}.d`,
          pin: pinInfo?.pin,
          sop: exprToSop(effectiveExpr, macros),
        });
        continue;
      }

      // Otherwise find corresponding combinatorial next-state pin equation (e.g. CS2 -> NS2 / FS2 / D2)
      const bitNum = extractTrailingNumber(csVar);
      const matchingEq = pinEquations.find(eq => {
        if (eq.ext !== '') return false;
        const eqNum = extractTrailingNumber(eq.targetName);
        if (bitNum !== -1 && eqNum === bitNum && eq.targetName !== csVar) {
          return /^(NS|FS|NEXT|N_|D)/i.test(eq.targetName);
        }
        return false;
      });

      if (matchingEq) {
        const pinInfo = pinByName.get(matchingEq.targetName);
        const invert = Boolean(pinInfo?.activeLow) !== matchingEq.lhsNegated;
        const effectiveExpr: Expr = invert ? { kind: 'not', expr: matchingEq.expr } : matchingEq.expr;
        nsEquationsByBit.push({
          name: displayNames.get(matchingEq.targetName) || matchingEq.targetName,
          pin: pinInfo?.pin,
          sop: exprToSop(effectiveExpr, macros),
        });
      }
    }
  } catch (err: any) {
    return emptyResult(err?.message || 'Next-State equations are too complex to extract FSM.');
  }

  if (nsEquationsByBit.length !== csVarNames.length) {
    return emptyResult('Could not match Next-State equations (NS / FS / .d) for all Current-State bits.');
  }

  const csSet = new Set(csVarNames);
  const nsSet = new Set(nsEquationsByBit.map(n => n.name.replace(/\.d$/i, '').toUpperCase()));

  // 3. Build the list of FSM states
  interface InternalState {
    name: string;
    code: string;
    index: number;
    assignment: Map<string, 0 | 1>;
  }
  const internalStates: InternalState[] = [];

  if (bestStateGroup) {
    for (const sm of bestStateGroup) {
      const assignment = new Map<string, 0 | 1>();
      let code = '';
      for (const csBit of csVarNames) {
        const lit = sm.term.find(l => l.name === csBit);
        const bitVal: 0 | 1 = lit && !lit.negated ? 1 : 0;
        assignment.set(csBit, bitVal);
        code += bitVal.toString();
      }
      internalStates.push({
        name: sm.name,
        code,
        index: parseInt(code, 2),
        assignment,
      });
    }
    internalStates.sort((a, b) => a.index - b.index);
  } else {
    const totalStates = 1 << csVarNames.length;
    for (let idx = 0; idx < totalStates; idx++) {
      const assignment = new Map<string, 0 | 1>();
      const code = idx.toString(2).padStart(csVarNames.length, '0');
      for (let b = 0; b < csVarNames.length; b++) {
        assignment.set(csVarNames[b], code[b] === '1' ? 1 : 0);
      }
      internalStates.push({
        name: `S${idx}`,
        code,
        index: idx,
        assignment,
      });
    }
  }

  // 4. Identify non-state Output Equations and precompute their SOP once
  const nonStateOutputEqs = pinEquations.filter(eq => {
    if (eq.ext === 'OE' || eq.ext === 'AR' || eq.ext === 'SP') return false;
    if (nsSet.has(eq.targetName)) return false;
    return true;
  });

  const compiledOutputs = nonStateOutputEqs.map(eq => {
    const pinInfo = pinByName.get(eq.targetName);
    const declaredActiveLow = Boolean(pinInfo?.activeLow) || eq.lhsNegated;
    const invertForPhysical = Boolean(pinInfo?.activeLow) !== eq.lhsNegated;
    const physicalExpr: Expr = invertForPhysical ? { kind: 'not', expr: eq.expr } : eq.expr;
    let fullSop: Sop = [];
    try {
      fullSop = exprToSop(physicalExpr, macros);
    } catch {
      fullSop = [];
    }
    return {
      name: displayNames.get(eq.targetName) || eq.originalTargetName,
      pin: pinInfo?.pin || 0,
      declaredActiveLow,
      fullSop,
    };
  });

  // Evaluate outputs for each state
  const stateNodes: FsmStateNode[] = internalStates.map(st => {
    const outputs: FsmStateOutput[] = compiledOutputs.map(co => {
      const restricted = restrictSop(co.fullSop, st.assignment);
      const valueStr = formatSop(restricted, displayNames);
      const isActive = co.declaredActiveLow ? valueStr === '0' : valueStr !== '0';

      return {
        name: co.name,
        pin: co.pin,
        value: valueStr,
        declaredActiveLow: co.declaredActiveLow,
        isActive,
        differsFromDefault: false,
      };
    });

    return {
      name: st.name,
      code: st.code,
      index: st.index,
      outputs,
    };
  });

  // Mark which outputs differ from S0 (the initial/idle state)
  if (stateNodes.length > 0) {
    const baseline = stateNodes[0].outputs;
    for (const st of stateNodes) {
      st.outputs.forEach((out, idx) => {
        const baseVal = baseline[idx]?.value;
        out.differsFromDefault = out.value !== baseVal || out.isActive;
      });
    }
  }

  // 5. Compute transitions between all pairs of states (S_from -> S_to)
  const transitions: FsmTransition[] = [];

  try {
    for (const fromSt of internalStates) {
      // Restrict each NS bit equation to fromSt and precompute its complement once per source state
      const restrictedNsBits = nsEquationsByBit.map(ns => restrictSop(ns.sop, fromSt.assignment));
      const negRestrictedNsBits = restrictedNsBits.map(sop => notSop(sop));

      for (const toSt of internalStates) {
        let guardSop: Sop = [[]]; // Start with TRUE (1)
        for (let b = 0; b < csVarNames.length; b++) {
          const targetBitVal = toSt.code[b] === '1' ? 1 : 0;
          const bitSop = targetBitVal === 1 ? restrictedNsBits[b] : negRestrictedNsBits[b];
          guardSop = andSop(guardSop, bitSop);
          if (guardSop.length === 0) break;
        }

        if (guardSop.length > 0) {
          const guardStr = formatSop(guardSop, displayNames);
          transitions.push({
            id: `${fromSt.name}->${toSt.name}`,
            from: fromSt.name,
            to: toSt.name,
            guard: guardStr === '1' ? 'always (1)' : guardStr,
            isSelfLoop: fromSt.name === toSt.name,
          });
        }
      }
    }
  } catch (err: any) {
    return emptyResult(err?.message || 'Transition guard expressions are too complex to extract FSM.');
  }

  // Collect input and output metadata
  const inputSignals: { name: string; pin?: number }[] = [];
  const outputSignals: { name: string; pin: number; activeLow: boolean }[] = [];

  for (const [upper, info] of pinByName.entries()) {
    if (csSet.has(upper) || nsSet.has(upper)) continue;
    const isOut = nonStateOutputEqs.some(eq => eq.targetName === upper);
    if (isOut) {
      const eq = nonStateOutputEqs.find(e => e.targetName === upper);
      outputSignals.push({
        name: info.originalName,
        pin: info.pin,
        activeLow: info.activeLow || Boolean(eq?.lhsNegated),
      });
    } else {
      inputSignals.push({ name: info.originalName, pin: info.pin });
    }
  }

  return {
    hasFsm: true,
    deviceName: header.NAME || 'FSM',
    csBits: csVarNames.map(v => ({
      name: displayNames.get(v) || v,
      pin: pinByName.get(v)?.pin,
    })),
    nsBits: nsEquationsByBit.map(n => ({
      name: n.name,
      pin: n.pin,
    })),
    inputSignals,
    outputSignals,
    states: stateNodes,
    transitions,
  };
}

/**
 * Reads the live Current State code, Next State code, and input signal values from simulation state.
 */
export function getLiveFsmStatus(
  fsm: ExtractedFsm,
  nodeId: string,
  pinStates: Record<string, any>
): {
  currentStateName: string | null;
  currentStateCode: string;
  nextStateName: string | null;
  nextStateCode: string;
  liveInputs: Record<string, number>;
} {
  const getPinVal = (pinNumber?: number): number => {
    if (!pinNumber) return 0;
    const galPin = IC_GAL22V10.customPins?.find(p => p.pinNumber === pinNumber);
    if (!galPin) return 0;
    const pinId = `pin-${nodeId}-${galPin.type}-${galPin.name}`;
    return pinStates[pinId] === 1 ? 1 : 0;
  };

  const currentStateCode = fsm.csBits.map(b => getPinVal(b.pin)).join('');
  const nextStateCode = fsm.nsBits.map(b => getPinVal(b.pin)).join('');

  const currentState = fsm.states.find(s => s.code === currentStateCode) || null;
  const nextState = fsm.states.find(s => s.code === nextStateCode) || null;

  const liveInputs: Record<string, number> = {};
  for (const inp of fsm.inputSignals) {
    if (inp.pin) {
      liveInputs[inp.name] = getPinVal(inp.pin);
    }
  }

  return {
    currentStateName: currentState?.name || null,
    currentStateCode,
    nextStateName: nextState?.name || null,
    nextStateCode,
    liveInputs,
  };
}
