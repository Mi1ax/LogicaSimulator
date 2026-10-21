import { NodeDefinition } from '../NodeDefinition';
import { Signal } from '../../../models/types';
import { parseJedec } from '../../../utils/jedecParser';
import { GAL22V10_COL_MAP, GAL22V10_OLMC_MAP } from '../../../utils/cuplParser';

interface CompiledJedec {
  /** null means row is permanently 0 (contradiction / unprogrammed row); number[] is list of connected columns */
  rows: (number[] | null)[];
  olmcActiveRows: number[][];
  s0: number[];
  s1: number[];
}

const jedecCache = new Map<string, CompiledJedec>();

function getCompiledJedec(jedecString: string): CompiledJedec {
  const cached = jedecCache.get(jedecString);
  if (cached) return cached;

  const fuses = jedecString ? parseJedec(jedecString, 5828) : new Array<boolean>(5828).fill(false);
  const rows: (number[] | null)[] = new Array(132);

  for (let r = 0; r < 132; r++) {
    const rowStart = r * 44;
    let contradiction = false;
    for (let c = 0; c < 44; c += 2) {
      if (!fuses[rowStart + c] && !fuses[rowStart + c + 1]) {
        contradiction = true;
        break;
      }
    }
    if (contradiction) {
      rows[r] = null;
    } else {
      const activeCols: number[] = [];
      for (let c = 0; c < 44; c++) {
        if (!fuses[rowStart + c]) {
          activeCols.push(c);
        }
      }
      rows[r] = activeCols;
    }
  }

  const olmcActiveRows: number[][] = new Array(10);
  const s0: number[] = new Array(10);
  const s1: number[] = new Array(10);

  for (let i = 0; i < 10; i++) {
    const olmc = GAL22V10_OLMC_MAP[i];
    s0[i] = fuses[olmc.s0Fuse] ? 1 : 0;
    s1[i] = fuses[olmc.s1Fuse] ? 1 : 0;
    const active: number[] = [];
    for (let r = 1; r < olmc.size; r++) {
      const rowIdx = olmc.startRow + r;
      if (rows[rowIdx] !== null) {
        active.push(rowIdx);
      }
    }
    olmcActiveRows[i] = active;
  }

  const compiled: CompiledJedec = { rows, olmcActiveRows, s0, s1 };
  if (jedecCache.size > 64) {
    jedecCache.clear();
  }
  jedecCache.set(jedecString, compiled);
  return compiled;
}

const scratchColStates = new Uint8Array(44);
const scratchPrevColStates = new Uint8Array(44);
const scratchDInputsPrev = new Uint8Array(10);
const scratchOrResults = new Uint8Array(10);
const scratchOes = new Uint8Array(10);

function fillColStates(
  sourceInputs: Signal[],
  s1: number[],
  regs: number[],
  outColStates: Uint8Array
): void {
  for (let m = 0; m < GAL22V10_COL_MAP.length; m++) {
    const mapping = GAL22V10_COL_MAP[m];
    let val = 0;
    if (mapping.pin >= 13 && mapping.pin <= 22) {
      const olmcIndex = mapping.pin - 13;
      if (s1[olmcIndex] === 0) {
        val = regs[olmcIndex] === 1 ? 0 : 1;
      } else {
        val = sourceInputs[mapping.pin] === 1 ? 1 : 0;
      }
    } else {
      val = sourceInputs[mapping.pin] === 1 ? 1 : 0;
    }

    outColStates[mapping.trueCol] = val;
    outColStates[mapping.trueCol + 1] = val === 1 ? 0 : 1;
  }
}

function evaluateJedecRow(
  rows: (number[] | null)[],
  rowIdx: number,
  states: Uint8Array
): number {
  const activeCols = rows[rowIdx];
  if (activeCols === null) return 0;
  for (let i = 0; i < activeCols.length; i++) {
    if (states[activeCols[i]] === 0) return 0;
  }
  return 1;
}

export const IC_GAL22V10: NodeDefinition = {
  type: 'GAL22V10',
  label: 'GAL22V10 (Programmable Logic Device)',
  category: 'Integrated Circuits/Programmable Logic',
  tags: ['pld', 'gal', 'programmable', 'logic'],
  renderAs: 'DIP',
  numInputs: 0,
  numOutputs: 0,
  customPins: [
    { name: 'I/CLK', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { name: 'I2', type: 'input', pinNumber: 2, schematicSide: 'left', schematicRow: 3 },
    { name: 'I3', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 4 },
    { name: 'I4', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 5 },
    { name: 'I5', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 6 },
    { name: 'I6', type: 'input', pinNumber: 6, schematicSide: 'left', schematicRow: 7 },
    { name: 'I7', type: 'input', pinNumber: 7, schematicSide: 'left', schematicRow: 8 },
    { name: 'I8', type: 'input', pinNumber: 8, schematicSide: 'left', schematicRow: 9 },
    { name: 'I9', type: 'input', pinNumber: 9, schematicSide: 'left', schematicRow: 10 },
    { name: 'I10', type: 'input', pinNumber: 10, schematicSide: 'left', schematicRow: 11 },
    { name: 'I11', type: 'input', pinNumber: 11, schematicSide: 'left', schematicRow: 12 },
    { name: 'GND', type: 'input', pinNumber: 12 },
    { name: 'I13', type: 'input', pinNumber: 13, schematicSide: 'left', schematicRow: 13 },

    { name: 'IO14', type: 'bidir', pinNumber: 14, schematicSide: 'right', schematicRow: 1 },
    { name: 'IO15', type: 'bidir', pinNumber: 15, schematicSide: 'right', schematicRow: 2 },
    { name: 'IO16', type: 'bidir', pinNumber: 16, schematicSide: 'right', schematicRow: 3 },
    { name: 'IO17', type: 'bidir', pinNumber: 17, schematicSide: 'right', schematicRow: 4 },
    { name: 'IO18', type: 'bidir', pinNumber: 18, schematicSide: 'right', schematicRow: 5 },
    { name: 'IO19', type: 'bidir', pinNumber: 19, schematicSide: 'right', schematicRow: 6 },
    { name: 'IO20', type: 'bidir', pinNumber: 20, schematicSide: 'right', schematicRow: 7 },
    { name: 'IO21', type: 'bidir', pinNumber: 21, schematicSide: 'right', schematicRow: 8 },
    { name: 'IO22', type: 'bidir', pinNumber: 22, schematicSide: 'right', schematicRow: 9 },
    { name: 'IO23', type: 'bidir', pinNumber: 23, schematicSide: 'right', schematicRow: 10 },
    { name: 'VCC', type: 'input', pinNumber: 24 },
  ],
  evaluate: (inputs, properties, _, internal = {}, prevInputs): Signal[] => {
    if (!internal.registers) internal.registers = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const clk = inputs[0] === 1 ? 1 : 0;
    if (internal.lastClk === undefined) internal.lastClk = clk;
    const isRisingEdge = clk === 1 && internal.lastClk === 0;
    internal.lastClk = clk;

    const compiled = getCompiledJedec(properties?.jedecString || '');
    const { rows, olmcActiveRows, s0, s1 } = compiled;
    const regs = internal.registers;

    fillColStates(inputs, s1, regs, scratchColStates);
    const hasPrev = Boolean(isRisingEdge && prevInputs);
    if (hasPrev) {
      fillColStates(prevInputs!, s1, regs, scratchPrevColStates);
    }
    const prevColStates = hasPrev ? scratchPrevColStates : scratchColStates;

    const ar = evaluateJedecRow(rows, 0, scratchColStates);
    const arPrev = hasPrev ? evaluateJedecRow(rows, 0, prevColStates) : ar;
    const spPrev = isRisingEdge ? evaluateJedecRow(rows, 131, prevColStates) : 0;

    const returnOutputs = new Array<Signal>(10);

    for (let i = 0; i < 10; i++) {
      const olmc = GAL22V10_OLMC_MAP[i];
      scratchOes[i] = evaluateJedecRow(rows, olmc.startRow, scratchColStates);

      let orResult = 0;
      let orResultPrev = 0;
      const activeRows = olmcActiveRows[i];
      for (let r = 0; r < activeRows.length; r++) {
        const rowIdx = activeRows[r];
        if (orResult === 0 && evaluateJedecRow(rows, rowIdx, scratchColStates) === 1) {
          orResult = 1;
        }
        if (hasPrev && orResultPrev === 0 && evaluateJedecRow(rows, rowIdx, prevColStates) === 1) {
          orResultPrev = 1;
        }
      }
      if (!hasPrev) orResultPrev = orResult;

      scratchOrResults[i] = orResult;
      scratchDInputsPrev[i] = orResultPrev;
    }

    if (ar === 1 || arPrev === 1) {
      regs.fill(0);
    } else if (isRisingEdge) {
      if (spPrev === 1) {
        regs.fill(1);
      } else {
        for (let i = 0; i < 10; i++) {
          regs[i] = scratchDInputsPrev[i];
        }
      }
    }

    for (let i = 0; i < 10; i++) {
      let pinOutputValue: Signal = s1[i] === 0 ? (regs[i] ? 1 : 0) : (scratchOrResults[i] ? 1 : 0);
      if (s0[i] === 0) {
        pinOutputValue = pinOutputValue === 1 ? 0 : 1;
      }
      returnOutputs[i] = scratchOes[i] === 1 ? pinOutputValue : undefined;
    }

    return returnOutputs;
  },
};
