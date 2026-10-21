// Shared WinCUPL (.pld) parser, Boolean SOP algebra, and GAL22V10 hardware tables

export interface GalColMapping {
  pin: number; // 0-indexed input index in IC_GAL22V10 customPins
  pinNumber: number; // Physical DIP-24 pin number (1..24)
  trueCol: number;
}

export const GAL22V10_COL_MAP: readonly GalColMapping[] = [
  { pin: 0, pinNumber: 1, trueCol: 0 },   // Pin 1
  { pin: 22, pinNumber: 23, trueCol: 2 }, // Pin 23
  { pin: 1, pinNumber: 2, trueCol: 4 },   // Pin 2
  { pin: 21, pinNumber: 22, trueCol: 6 }, // Pin 22
  { pin: 2, pinNumber: 3, trueCol: 8 },   // Pin 3
  { pin: 20, pinNumber: 21, trueCol: 10 }, // Pin 21
  { pin: 3, pinNumber: 4, trueCol: 12 },  // Pin 4
  { pin: 19, pinNumber: 20, trueCol: 14 }, // Pin 20
  { pin: 4, pinNumber: 5, trueCol: 16 },  // Pin 5
  { pin: 18, pinNumber: 19, trueCol: 18 }, // Pin 19
  { pin: 5, pinNumber: 6, trueCol: 20 },  // Pin 6
  { pin: 17, pinNumber: 18, trueCol: 22 }, // Pin 18
  { pin: 6, pinNumber: 7, trueCol: 24 },  // Pin 7
  { pin: 16, pinNumber: 17, trueCol: 26 }, // Pin 17
  { pin: 7, pinNumber: 8, trueCol: 28 },  // Pin 8
  { pin: 15, pinNumber: 16, trueCol: 30 }, // Pin 16
  { pin: 8, pinNumber: 9, trueCol: 32 },  // Pin 9
  { pin: 14, pinNumber: 15, trueCol: 34 }, // Pin 15
  { pin: 9, pinNumber: 10, trueCol: 36 }, // Pin 10
  { pin: 13, pinNumber: 14, trueCol: 38 }, // Pin 14
  { pin: 10, pinNumber: 11, trueCol: 40 }, // Pin 11
  { pin: 12, pinNumber: 13, trueCol: 42 }, // Pin 13
];

export const PIN_TO_TRUE_COL: Readonly<Record<number, number>> = Object.fromEntries(
  GAL22V10_COL_MAP.map((m) => [m.pinNumber, m.trueCol])
);

export interface OlmcInfo {
  pin: number;      // Physical DIP-24 pin number (14..23)
  pinIndex: number; // 0-indexed input index in IC_GAL22V10 customPins (13..22)
  s0Fuse: number;
  s1Fuse: number;
  startRow: number; // OE row; product terms are startRow + 1 .. startRow + size - 1
  size: number;     // Total rows including OE row (max product terms = size - 1)
}

export const GAL22V10_OLMC_MAP: readonly OlmcInfo[] = [
  { pin: 14, pinIndex: 13, s0Fuse: 5826, s1Fuse: 5827, startRow: 122, size: 9 },
  { pin: 15, pinIndex: 14, s0Fuse: 5824, s1Fuse: 5825, startRow: 111, size: 11 },
  { pin: 16, pinIndex: 15, s0Fuse: 5822, s1Fuse: 5823, startRow: 98, size: 13 },
  { pin: 17, pinIndex: 16, s0Fuse: 5820, s1Fuse: 5821, startRow: 83, size: 15 },
  { pin: 18, pinIndex: 17, s0Fuse: 5818, s1Fuse: 5819, startRow: 66, size: 17 },
  { pin: 19, pinIndex: 18, s0Fuse: 5816, s1Fuse: 5817, startRow: 49, size: 17 },
  { pin: 20, pinIndex: 19, s0Fuse: 5814, s1Fuse: 5815, startRow: 34, size: 15 },
  { pin: 21, pinIndex: 20, s0Fuse: 5812, s1Fuse: 5813, startRow: 21, size: 13 },
  { pin: 22, pinIndex: 21, s0Fuse: 5810, s1Fuse: 5811, startRow: 10, size: 11 },
  { pin: 23, pinIndex: 22, s0Fuse: 5808, s1Fuse: 5809, startRow: 1, size: 9 },
];

export const OLMC_BY_PIN: Readonly<Record<number, OlmcInfo>> = Object.fromEntries(
  GAL22V10_OLMC_MAP.map((m) => [m.pin, m])
);

// --- Boolean AST & SOP representation ---

export type Expr =
  | { kind: 'const'; value: 0 | 1 }
  | { kind: 'var'; name: string }
  | { kind: 'not'; expr: Expr }
  | { kind: 'and'; left: Expr; right: Expr }
  | { kind: 'or'; left: Expr; right: Expr }
  | { kind: 'xor'; left: Expr; right: Expr };

export interface Literal {
  name: string;
  negated: boolean;
}

/** Product term = conjunction (AND) of literals. Empty array = constant 1 (TRUE). */
export type ProductTerm = Literal[];

/** Sum of Products = disjunction (OR) of product terms. Empty array = constant 0 (FALSE). */
export type Sop = ProductTerm[];

export type Token =
  | { type: 'IDENT'; value: string }
  | { type: 'CONST'; value: 0 | 1 }
  | { type: 'NOT' }
  | { type: 'AND' }
  | { type: 'OR' }
  | { type: 'XOR' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' };

export const HEADER_KEYWORDS = new Set([
  'NAME',
  'PARTNO',
  'DATE',
  'REVISION',
  'REV',
  'DESIGNER',
  'COMPANY',
  'ASSEMBLY',
  'LOCATION',
  'DEVICE',
  'FORMAT',
]);

export const MAX_BRACKET_RANGE = 64;
export const MAX_SOP_TERMS = 256;

/**
 * Replaces block comments `/* ... * /` and line comments `// ...` with spaces,
 * preserving newlines so line numbers remain accurate.
 */
export function stripComments(source: string): string {
  const chunks: string[] = [];
  let i = 0;
  let lastCopyIdx = 0;

  while (i < source.length) {
    if (source[i] === '/' && source[i + 1] === '*') {
      if (i > lastCopyIdx) chunks.push(source.slice(lastCopyIdx, i));
      const commentStart = i;
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        i++;
      }
      if (i < source.length) {
        i += 2;
      }
      const commentSlice = source.slice(commentStart, i);
      chunks.push(commentSlice.replace(/[^\n]/g, ' '));
      lastCopyIdx = i;
    } else if (source[i] === '/' && source[i + 1] === '/') {
      if (i > lastCopyIdx) chunks.push(source.slice(lastCopyIdx, i));
      const commentStart = i;
      while (i < source.length && source[i] !== '\n') {
        i++;
      }
      chunks.push(' '.repeat(i - commentStart));
      lastCopyIdx = i;
    } else {
      i++;
    }
  }

  if (lastCopyIdx === 0) return source;
  if (lastCopyIdx < source.length) chunks.push(source.slice(lastCopyIdx));
  return chunks.join('');
}

export function expandBracketList(raw: string, throwOnOverflow: boolean = true): string[] {
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
        if (throwOnOverflow) {
          throw new Error(`Range "${trimmed}" is too large (max ${MAX_BRACKET_RANGE} pins)`);
        }
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

export function tokenizeExpr(input: string): Token[] {
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
      // WinCUPL base literal like 'b'0, 'b'1, 'd'0, 'h'1
      const m = input.slice(i).match(/^'[bBdDhHoO]'([0-9a-fA-F]+)/);
      if (m) {
        const val = parseInt(m[1], 16);
        tokens.push({ type: 'CONST', value: val ? 1 : 0 });
        i += m[0].length;
      } else {
        throw new Error(`Unexpected character "'" in expression`);
      }
    } else if (/[01]/.test(ch) && !/[A-Za-z0-9_]/.test(input[i + 1] || '')) {
      tokens.push({ type: 'CONST', value: ch === '1' ? 1 : 0 });
      i++;
    } else if (/[A-Za-z0-9_]/.test(ch)) {
      const start = i;
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
        i++;
      }
      tokens.push({ type: 'IDENT', value: input.slice(start, i) });
    } else {
      throw new Error(`Unexpected character '${ch}' in expression`);
    }
  }
  return tokens;
}

export function parseExpression(input: string): Expr {
  const tokens = tokenizeExpr(input);
  if (tokens.length === 0) {
    throw new Error('Empty expression');
  }
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
    if (!tok) {
      throw new Error('Unexpected end of expression');
    }
    if (tok.type === 'LPAREN') {
      pos++;
      const inner = parseOr();
      if (!tokens[pos] || tokens[pos].type !== 'RPAREN') {
        throw new Error('Missing closing parenthesis ")"');
      }
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
    throw new Error('Unexpected token in expression');
  };

  const ast = parseOr();
  if (pos < tokens.length) {
    throw new Error('Unexpected token near end of expression');
  }
  return ast;
}

/**
 * Simplifies a single product term; returns null if it contains a contradiction (A & !A = 0).
 */
export function simplifyTerm(term: ProductTerm): ProductTerm | null {
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

export function termKey(term: ProductTerm): string {
  return term.map((l) => `${l.negated ? '!' : ''}${l.name}`).join('&');
}

function isSubsetTerm(smaller: ProductTerm, larger: ProductTerm): boolean {
  if (smaller.length > larger.length) return false;
  return smaller.every((s) => larger.some((l) => l.name === s.name && l.negated === s.negated));
}

/**
 * Simplifies a Sum-of-Products:
 * Always eliminates contradictions (A & !A = 0) and duplicates (T # T = T).
 * When `minimize` is true, also runs absorption, adjacency merging, and complement reduction.
 */
export function simplifySop(sop: Sop, minimize: boolean = false): Sop {
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
        throw new Error(
          `Expression expands to more than ${MAX_SOP_TERMS} product terms (exceeds GAL22V10 hardware limits)`
        );
      }
    }
  }

  if (!minimize) {
    return terms;
  }

  // Only run O(T^2) boolean minimization passes when the SOP is reasonably small
  let changed = terms.length <= 64;
  let iter = 0;
  while (changed && iter < 12) {
    changed = false;
    iter++;

    // 1. Absorption: remove any term that is a superset of another term
    const absorbed = new Array<boolean>(terms.length).fill(false);
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
      if (terms.some((t) => t.length === 0)) return [[]];
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
        let oppIdxInJ = -1;
        let allOthersPresent = true;
        for (const litI of ti) {
          const matchSame = tj.findIndex((l) => l.name === litI.name && l.negated === litI.negated);
          if (matchSame !== -1) continue;
          const matchOpp = tj.findIndex((l) => l.name === litI.name && l.negated !== litI.negated);
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

export function andSop(a: Sop, b: Sop, minimize: boolean = false): Sop {
  if (a.length === 0 || b.length === 0) return [];
  if (a.length * b.length > MAX_SOP_TERMS * 8) {
    throw new Error(
      `Expression expands to more than ${MAX_SOP_TERMS} product terms (exceeds GAL22V10 hardware limits)`
    );
  }
  const combined: Sop = [];
  for (const ta of a) {
    for (const tb of b) {
      combined.push([...ta, ...tb]);
    }
  }
  return simplifySop(combined, minimize);
}

export function orSop(a: Sop, b: Sop, minimize: boolean = false): Sop {
  return simplifySop([...a, ...b], minimize);
}

export function notSop(sop: Sop, minimize: boolean = false): Sop {
  if (sop.length === 0) return [[]];
  let acc: Sop = [[]];
  for (const term of sop) {
    if (term.length === 0) return [];
    const invertedLiterals: Sop = term.map((lit) => [{ name: lit.name, negated: !lit.negated }]);
    acc = andSop(acc, invertedLiterals, minimize);
  }
  return acc;
}

export interface ExprToSopOptions {
  negated?: boolean;
  minimize?: boolean;
  throwOnCircular?: boolean;
}

export function exprToSop(
  expr: Expr,
  macros: Map<string, Expr>,
  visiting: Set<string> = new Set(),
  options: ExprToSopOptions = {}
): Sop {
  const { negated = false, minimize = false, throwOnCircular = true } = options;

  switch (expr.kind) {
    case 'const': {
      const val = negated ? (expr.value === 1 ? 0 : 1) : expr.value;
      return val === 1 ? [[]] : [];
    }
    case 'var': {
      const upper = expr.name.toUpperCase();
      if (upper === 'VCC' || upper === 'TRUE') return negated ? [] : [[]];
      if (upper === 'GND' || upper === 'FALSE') return negated ? [[]] : [];
      const macroExpr = macros.get(upper);
      if (macroExpr) {
        if (visiting.has(upper)) {
          if (throwOnCircular) {
            throw new Error(`Circular intermediate variable definition involving "${expr.name}"`);
          }
          return [[{ name: upper, negated }]];
        }
        const nextVisiting = new Set(visiting);
        nextVisiting.add(upper);
        return exprToSop(macroExpr, macros, nextVisiting, options);
      }
      return [[{ name: upper, negated }]];
    }
    case 'not':
      return exprToSop(expr.expr, macros, visiting, { ...options, negated: !negated });
    case 'and':
      return negated
        ? orSop(
            exprToSop(expr.left, macros, visiting, { ...options, negated: true }),
            exprToSop(expr.right, macros, visiting, { ...options, negated: true }),
            minimize
          )
        : andSop(
            exprToSop(expr.left, macros, visiting, { ...options, negated: false }),
            exprToSop(expr.right, macros, visiting, { ...options, negated: false }),
            minimize
          );
    case 'or':
      return negated
        ? andSop(
            exprToSop(expr.left, macros, visiting, { ...options, negated: true }),
            exprToSop(expr.right, macros, visiting, { ...options, negated: true }),
            minimize
          )
        : orSop(
            exprToSop(expr.left, macros, visiting, { ...options, negated: false }),
            exprToSop(expr.right, macros, visiting, { ...options, negated: false }),
            minimize
          );
    case 'xor': {
      const lPos = exprToSop(expr.left, macros, visiting, { ...options, negated: false });
      const lNeg = exprToSop(expr.left, macros, visiting, { ...options, negated: true });
      const rPos = exprToSop(expr.right, macros, visiting, { ...options, negated: false });
      const rNeg = exprToSop(expr.right, macros, visiting, { ...options, negated: true });
      return negated
        ? orSop(andSop(lPos, rPos, minimize), andSop(lNeg, rNeg, minimize), minimize)
        : orSop(andSop(lPos, rNeg, minimize), andSop(lNeg, rPos, minimize), minimize);
    }
  }
}
