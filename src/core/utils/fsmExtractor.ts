// Automatic Finite State Machine (FSM) extractor from WinCUPL (.pld) source code
import { IC_GAL22V10 } from '../engine/nodes/ics/pld';
import { Signal } from '../models/types';
import { PinDefinition } from '../engine/nodes/NodeDefinition';
import {
  Expr,
  ProductTerm,
  Sop,
  HEADER_KEYWORDS,
  stripComments,
  expandBracketList,
  parseExpression,
  simplifySop,
  andSop,
  notSop,
  exprToSop,
} from './cuplParser';

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

const GAL_PIN_BY_NUMBER = new Map<number, PinDefinition>(
  (IC_GAL22V10.customPins || [])
    .filter((p): p is PinDefinition & { pinNumber: number } => p.pinNumber !== undefined)
    .map((p) => [p.pinNumber, p])
);

function expandMinimizedSop(expr: Expr, macros: Map<string, Expr>): Sop {
  return exprToSop(expr, macros, new Set(), { minimize: true, throwOnCircular: false });
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
  return simplifySop(restricted, true);
}

function formatSop(sop: Sop, displayNames: Map<string, string>): string {
  if (sop.length === 0) return '0';
  if (sop.length === 1 && sop[0].length === 0) return '1';

  const termStrings = sop.map((term) => {
    if (term.length === 0) return '1';
    return term
      .map((l) => `${l.negated ? '!' : ''}${displayNames.get(l.name.toUpperCase()) || l.name}`)
      .join(' & ');
  });

  if (termStrings.length === 1) return termStrings[0];
  return termStrings.map((s) => (s.includes(' & ') ? `(${s})` : s)).join(' # ');
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
    .map((s) => s.trim())
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
      const pinNums = expandBracketList(pinMatch[1], false).map((s) => parseInt(s, 10));
      const pinNames = expandBracketList(pinMatch[2], false);
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
      const sop = expandMinimizedSop(expr, macros);
      if (sop.length === 1 && sop[0].length >= 1 && sop[0].length <= 6) {
        const term = sop[0];
        if (term.every((l) => pinByName.has(l.name))) {
          const vars = term.map((l) => l.name).sort();
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
  const nsEquationsByBit: { name: string; pin?: number; sop: Sop }[] = []; // MSB -> LSB

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
    const regEqs = pinEquations.filter((eq) => eq.ext === 'D');
    if (regEqs.length >= 2 && regEqs.length <= 5) {
      const sortedReg = [...regEqs].sort((a, b) => {
        const na = extractTrailingNumber(a.targetName);
        const nb = extractTrailingNumber(b.targetName);
        if (na !== nb) return nb - na;
        return b.targetName.localeCompare(a.targetName);
      });
      csVarNames = sortedReg.map((r) => r.targetName);
    }
  }

  if (csVarNames.length === 0) {
    return emptyResult('No state bits or state definitions (e.g. S0..Sn or registered .d bits) found in PLD code.');
  }

  // 2. Match Next-State equations for each CS bit (MSB -> LSB)
  try {
    for (const csVar of csVarNames) {
      // Check if csVar itself has a registered .D equation
      const regEq = pinEquations.find((eq) => eq.targetName === csVar && eq.ext === 'D');
      if (regEq) {
        const effectiveExpr: Expr = regEq.lhsNegated ? { kind: 'not', expr: regEq.expr } : regEq.expr;
        const pinInfo = pinByName.get(csVar);
        nsEquationsByBit.push({
          name: `${displayNames.get(csVar) || csVar}.d`,
          pin: pinInfo?.pin,
          sop: expandMinimizedSop(effectiveExpr, macros),
        });
        continue;
      }

      // Otherwise find corresponding combinatorial next-state pin equation (e.g. CS2 -> NS2 / FS2 / D2)
      const bitNum = extractTrailingNumber(csVar);
      const matchingEq = pinEquations.find((eq) => {
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
          sop: expandMinimizedSop(effectiveExpr, macros),
        });
      }
    }
  } catch (err: unknown) {
    return emptyResult(
      err instanceof Error ? err.message : 'Next-State equations are too complex to extract FSM.'
    );
  }

  if (nsEquationsByBit.length !== csVarNames.length) {
    return emptyResult('Could not match Next-State equations (NS / FS / .d) for all Current-State bits.');
  }

  const csSet = new Set(csVarNames);
  const nsSet = new Set(nsEquationsByBit.map((n) => n.name.replace(/\.d$/i, '').toUpperCase()));

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
        const lit = sm.term.find((l) => l.name === csBit);
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
  const nonStateOutputEqs = pinEquations.filter((eq) => {
    if (eq.ext === 'OE' || eq.ext === 'AR' || eq.ext === 'SP') return false;
    if (nsSet.has(eq.targetName)) return false;
    return true;
  });

  const compiledOutputs = nonStateOutputEqs.map((eq) => {
    const pinInfo = pinByName.get(eq.targetName);
    const declaredActiveLow = Boolean(pinInfo?.activeLow) || eq.lhsNegated;
    const invertForPhysical = Boolean(pinInfo?.activeLow) !== eq.lhsNegated;
    const physicalExpr: Expr = invertForPhysical ? { kind: 'not', expr: eq.expr } : eq.expr;
    let fullSop: Sop = [];
    try {
      fullSop = expandMinimizedSop(physicalExpr, macros);
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
  const stateNodes: FsmStateNode[] = internalStates.map((st) => {
    const outputs: FsmStateOutput[] = compiledOutputs.map((co) => {
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
      const restrictedNsBits = nsEquationsByBit.map((ns) => restrictSop(ns.sop, fromSt.assignment));
      const negRestrictedNsBits = restrictedNsBits.map((sop) => notSop(sop, true));

      for (const toSt of internalStates) {
        let guardSop: Sop = [[]]; // Start with TRUE (1)
        for (let b = 0; b < csVarNames.length; b++) {
          const targetBitVal = toSt.code[b] === '1' ? 1 : 0;
          const bitSop = targetBitVal === 1 ? restrictedNsBits[b] : negRestrictedNsBits[b];
          guardSop = andSop(guardSop, bitSop, true);
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
  } catch (err: unknown) {
    return emptyResult(
      err instanceof Error ? err.message : 'Transition guard expressions are too complex to extract FSM.'
    );
  }

  // Collect input and output metadata
  const inputSignals: { name: string; pin?: number }[] = [];
  const outputSignals: { name: string; pin: number; activeLow: boolean }[] = [];

  for (const [upper, info] of pinByName.entries()) {
    if (csSet.has(upper) || nsSet.has(upper)) continue;
    const eq = nonStateOutputEqs.find((e) => e.targetName === upper);
    if (eq) {
      outputSignals.push({
        name: info.originalName,
        pin: info.pin,
        activeLow: info.activeLow || Boolean(eq.lhsNegated),
      });
    } else {
      inputSignals.push({ name: info.originalName, pin: info.pin });
    }
  }

  return {
    hasFsm: true,
    deviceName: header.NAME || 'FSM',
    csBits: csVarNames.map((v) => ({
      name: displayNames.get(v) || v,
      pin: pinByName.get(v)?.pin,
    })),
    nsBits: nsEquationsByBit.map((n) => ({
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
  pinStates: Record<string, Signal>
): {
  currentStateName: string | null;
  currentStateCode: string;
  nextStateName: string | null;
  nextStateCode: string;
  liveInputs: Record<string, number>;
} {
  const getPinVal = (pinNumber?: number): number => {
    if (!pinNumber) return 0;
    const galPin = GAL_PIN_BY_NUMBER.get(pinNumber);
    if (!galPin) return 0;
    const pinId = `pin-${nodeId}-${galPin.type}-${galPin.name}`;
    return pinStates[pinId] === 1 ? 1 : 0;
  };

  const currentStateCode = fsm.csBits.map((b) => getPinVal(b.pin)).join('');
  const nextStateCode = fsm.nsBits.map((b) => getPinVal(b.pin)).join('');

  const currentState = fsm.states.find((s) => s.code === currentStateCode) || null;
  const nextState = fsm.states.find((s) => s.code === nextStateCode) || null;

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
