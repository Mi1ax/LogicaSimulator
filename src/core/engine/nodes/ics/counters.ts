import { NodeDefinition } from '../NodeDefinition';
import { Signal } from '../../../models/types';

const CONFLICT_6: Signal[] = ['X', 'X', 'X', 'X', 'X', 'X'];
const OUT_0: Signal[] = [0];
const OUT_1: Signal[] = [1];

export const IC74LS161: NodeDefinition = {
  type: '74LS161',
  label: '74LS161 (4-bit Counter)',
  category: 'Integrated Circuits/Counters & Timers',
  tags: ['counter', 'timer', 'sync'],
  renderAs: 'DIP',
  numInputs: 11,
  numOutputs: 5,
  customPins: [
    { name: '~CLR', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 10 },
    { name: 'CLK', type: 'input', pinNumber: 2, schematicSide: 'left', schematicRow: 9 },
    { name: 'A', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 1 },
    { name: 'B', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 2 },
    { name: 'C', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 3 },
    { name: 'D', type: 'input', pinNumber: 6, schematicSide: 'left', schematicRow: 4 },
    { name: 'ENP', type: 'input', pinNumber: 7, schematicSide: 'left', schematicRow: 6 },
    { name: 'GND', type: 'input', pinNumber: 8 },
    { name: '~LOAD', type: 'input', pinNumber: 9, schematicSide: 'left', schematicRow: 8 },
    { name: 'ENT', type: 'input', pinNumber: 10, schematicSide: 'left', schematicRow: 7 },
    { name: 'QD', type: 'output', pinNumber: 11, schematicSide: 'right', schematicRow: 4 },
    { name: 'QC', type: 'output', pinNumber: 12, schematicSide: 'right', schematicRow: 3 },
    { name: 'QB', type: 'output', pinNumber: 13, schematicSide: 'right', schematicRow: 2 },
    { name: 'QA', type: 'output', pinNumber: 14, schematicSide: 'right', schematicRow: 1 },
    { name: 'RCO', type: 'output', pinNumber: 15, schematicSide: 'right', schematicRow: 6 },
    { name: 'VCC', type: 'input', pinNumber: 16 },
  ],
  evaluate: (inputs, _props, _tick, internal = {}, prevInputs): Signal[] => {
    const pInputs = prevInputs || inputs;
    const clrN = inputs[0]; // Async clear
    const clk = inputs[1];  // Sync trigger
    const a = pInputs[2];
    const b = pInputs[3];
    const c = pInputs[4];
    const d = pInputs[5];
    const enp = pInputs[6];
    const loadN = pInputs[8];
    const ent = pInputs[9];

    const st = internal;
    if (st.counter === undefined) st.counter = 0;
    if (st.lastClk === undefined) st.lastClk = clk === 1 ? 1 : 0;

    const safeClrN = clrN ?? 1;   // Default 1: Don't clear
    const safeLoadN = loadN ?? 1; // Default 1: Don't load
    const safeEnp = enp ?? 1;     // Default 1: Enable counting
    const safeEnt = ent ?? 1;     // Default 1: Enable counting

    if (safeClrN === 0) {
      st.counter = 0;
    } else if (clk === 1 && st.lastClk === 0) {
      if (safeLoadN === 0) {
        st.counter = ((d === 1 ? 1 : 0) << 3) | ((c === 1 ? 1 : 0) << 2) | ((b === 1 ? 1 : 0) << 1) | (a === 1 ? 1 : 0);
      } else if (safeEnp === 1 && safeEnt === 1) {
        st.counter = (st.counter + 1) & 15;
      }
    }

    st.lastClk = clk === 1 ? 1 : 0;

    const qa: Signal = (st.counter & 1) ? 1 : 0;
    const qb: Signal = (st.counter & 2) ? 1 : 0;
    const qc: Signal = (st.counter & 4) ? 1 : 0;
    const qd: Signal = (st.counter & 8) ? 1 : 0;
    const currentEnt = inputs[9] ?? 1;
    const rco: Signal = st.counter === 15 && currentEnt === 1 ? 1 : 0;

    return [qd, qc, qb, qa, rco];
  },
};

export const IC74LS191: NodeDefinition = {
  type: '74LS191',
  label: '74LS191 (Up/Down Counter)',
  category: 'Integrated Circuits/Counters & Timers',
  tags: ['counter', 'up', 'down', 'timer'],
  renderAs: 'DIP',
  numInputs: 10,
  numOutputs: 6,
  customPins: [
    { name: 'B', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 2 },
    { name: 'QB', type: 'output', pinNumber: 2, schematicSide: 'right', schematicRow: 2 },
    { name: 'QA', type: 'output', pinNumber: 3, schematicSide: 'right', schematicRow: 1 },
    { name: '~CTEN', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 6 },
    { name: 'D/~U', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 7 },
    { name: 'QC', type: 'output', pinNumber: 6, schematicSide: 'right', schematicRow: 3 },
    { name: 'QD', type: 'output', pinNumber: 7, schematicSide: 'right', schematicRow: 4 },
    { name: 'GND', type: 'input', pinNumber: 8 },
    { name: 'D', type: 'input', pinNumber: 9, schematicSide: 'left', schematicRow: 4 },
    { name: 'C', type: 'input', pinNumber: 10, schematicSide: 'left', schematicRow: 3 },
    { name: '~LOAD', type: 'input', pinNumber: 11, schematicSide: 'left', schematicRow: 8 },
    { name: 'MAX/MIN', type: 'output', pinNumber: 12, schematicSide: 'right', schematicRow: 6 },
    { name: '~RCO', type: 'output', pinNumber: 13, schematicSide: 'right', schematicRow: 7 },
    { name: 'CLK', type: 'input', pinNumber: 14, schematicSide: 'left', schematicRow: 9 },
    { name: 'A', type: 'input', pinNumber: 15, schematicSide: 'left', schematicRow: 1 },
    { name: 'VCC', type: 'input', pinNumber: 16 },
  ],
  evaluate: (inputs, _props, _tick, internal = {}, prevInputs): Signal[] => {
    const pInputs = prevInputs || inputs;
    const b = inputs[0];
    const ctenN = pInputs[1] ?? 0;
    const du = pInputs[2] ?? 0;
    const d = inputs[4];
    const c = inputs[5];
    const loadN = inputs[6] ?? 1;
    const clk = inputs[7];
    const a = inputs[8];

    const st = internal;
    if (st.counter === undefined) st.counter = 0;
    if (st.lastClk === undefined) st.lastClk = clk === 1 ? 1 : 0;

    if (loadN === 0) {
      if (
        a === 'X' || b === 'X' || c === 'X' || d === 'X' ||
        a === undefined || b === undefined || c === undefined || d === undefined
      ) {
        st.counter = 'X';
      } else {
        st.counter = (a === 1 ? 1 : 0) | (b === 1 ? 2 : 0) | (c === 1 ? 4 : 0) | (d === 1 ? 8 : 0);
      }
    } else {
      const risingEdge = st.lastClk === 0 && clk === 1;
      if (risingEdge && ctenN === 0 && st.counter !== 'X') {
        if (du === 0) {
          st.counter = (st.counter + 1) & 15;
        } else if (du === 1) {
          st.counter = (st.counter - 1) & 15;
        }
      }
    }

    if (clk === 0 || clk === 1) {
      st.lastClk = clk;
    }

    if (st.counter === 'X') return CONFLICT_6;

    const val = st.counter as number;
    const qa: Signal = (val & 1) ? 1 : 0;
    const qb: Signal = (val & 2) ? 1 : 0;
    const qc: Signal = (val & 4) ? 1 : 0;
    const qd: Signal = (val & 8) ? 1 : 0;

    let maxMin: Signal = 0;
    if (du === 0 && val === 15) maxMin = 1;
    if (du === 1 && val === 0) maxMin = 1;

    const rcoN: Signal = maxMin === 1 && ctenN === 0 && clk === 0 ? 0 : 1;

    return [qb, qa, qc, qd, maxMin, rcoN];
  },
};

export const IC_NE555: NodeDefinition = {
  type: 'NE555',
  label: 'NE555 (Timer / Oscillator)',
  category: 'Integrated Circuits/Counters & Timers',
  tags: ['555', 'ne555', 'timer', 'oscillator', 'clock', 'astable'],
  renderAs: 'DIP',
  numInputs: 0,
  numOutputs: 0,
  customPins: [
    { name: 'GND', type: 'input', pinNumber: 1 },
    { name: "TRIG'", type: 'input', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { name: 'OUT', type: 'output', pinNumber: 3, schematicSide: 'right', schematicRow: 1 },
    { name: "RST'", type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 3 },
    { name: 'VCC', type: 'input', pinNumber: 8 },
  ],
  defaultProperties: {
    highTicks: 5,
    lowTicks: 5,
    startHigh: true,
    ne555Mode: 'astable',
    pulseTicks: 10,
    r1Value: 10,
    r1Unit: 'kΩ',
    r2Value: 47,
    r2Unit: 'kΩ',
    cValue: 10,
    cUnit: 'µF',
    vcc: 5.0,
    bypassDiode: false,
  },
  evaluate: (inputs, props, tickCount, internal = {}): Signal[] => {
    // inputs: 0 = GND, 1 = TRIG', 2 = RST', 3 = VCC
    const trigN = inputs[1] ?? 1;
    const rstN = inputs[2] ?? 1;
    const mode = props?.ne555Mode || 'astable';
    const st = internal;

    if (rstN === 0) {
      st.latchQ = 0;
      st.monoRemaining = 0;
      return OUT_0;
    }

    if (mode === 'bistable') {
      if (st.latchQ === undefined) st.latchQ = 0;
      if (trigN === 0) {
        st.latchQ = 1;
      }
      return st.latchQ ? OUT_1 : OUT_0;
    }

    if (mode === 'monostable') {
      const pulseTicks = Math.max(1, props?.pulseTicks ?? props?.highTicks ?? 10);
      if (st.monoRemaining === undefined) st.monoRemaining = 0;
      if (st.lastTick === undefined) st.lastTick = tickCount ?? 0;

      const tickAdvanced = (tickCount ?? 0) !== st.lastTick;
      st.lastTick = tickCount ?? 0;

      if (trigN === 0) {
        st.monoRemaining = pulseTicks;
        return OUT_1;
      }

      if (st.monoRemaining > 0) {
        if (tickAdvanced) {
          st.monoRemaining = Math.max(0, st.monoRemaining - 1);
        }
        return st.monoRemaining > 0 ? OUT_1 : OUT_0;
      }
      return OUT_0;
    }

    // Default: Astable mode
    if (trigN === 0) {
      return OUT_1;
    }

    const highTicks = Math.max(1, props?.highTicks ?? props?.interval ?? 5);
    const lowTicks = Math.max(1, props?.lowTicks ?? props?.interval ?? 5);
    const cycleLength = highTicks + lowTicks;
    if (cycleLength <= 0) return OUT_0;

    const currentTick = (tickCount ?? 0) % cycleLength;
    const startHigh = props?.startHigh !== false;
    const val = startHigh
      ? (currentTick < highTicks ? 1 : 0)
      : (currentTick < lowTicks ? 0 : 1);

    return val === 1 ? OUT_1 : OUT_0;
  },
};
