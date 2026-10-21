import { NodeDefinition } from '../NodeDefinition';
import { Signal } from '../../../models/types';

const HIGH_Z_4: Signal[] = [undefined, undefined, undefined, undefined];
const HIGH_Z_8: Signal[] = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
const HIGH_Z_16: Signal[] = [
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
];

export const IC74LS125: NodeDefinition = {
  type: '74LS125',
  label: '74LS125 (Quad Bus Buffer 3-State)',
  category: 'Integrated Circuits/Registers & Buffers',
  tags: ['buffer', 'driver', 'tri-state', '3-state', 'quad', '125'],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: "1G'", pinNumber: 1, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: '1A', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { type: 'output', name: '1Y', pinNumber: 3, schematicSide: 'right', schematicRow: 1 },

    { type: 'input', name: "2G'", pinNumber: 4, schematicSide: 'left', schematicRow: 5 },
    { type: 'input', name: '2A', pinNumber: 5, schematicSide: 'left', schematicRow: 4 },
    { type: 'output', name: '2Y', pinNumber: 6, schematicSide: 'right', schematicRow: 4 },

    { type: 'input', name: 'GND', pinNumber: 7 },

    { type: 'output', name: '3Y', pinNumber: 8, schematicSide: 'right', schematicRow: 7 },
    { type: 'input', name: '3A', pinNumber: 9, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: "3G'", pinNumber: 10, schematicSide: 'left', schematicRow: 8 },

    { type: 'output', name: '4Y', pinNumber: 11, schematicSide: 'right', schematicRow: 10 },
    { type: 'input', name: '4A', pinNumber: 12, schematicSide: 'left', schematicRow: 10 },
    { type: 'input', name: "4G'", pinNumber: 13, schematicSide: 'left', schematicRow: 11 },

    { type: 'input', name: 'VCC', pinNumber: 14 },
  ],
  evaluate: (inputs): Signal[] => {
    const g1_n = inputs[0] ?? 1;
    const g2_n = inputs[2] ?? 1;
    const g3_n = inputs[6] ?? 1;
    const g4_n = inputs[8] ?? 1;

    if (g1_n !== 0 && g2_n !== 0 && g3_n !== 0 && g4_n !== 0) {
      return HIGH_Z_4;
    }

    return [
      g1_n === 0 ? inputs[1] : undefined,
      g2_n === 0 ? inputs[3] : undefined,
      g3_n === 0 ? inputs[5] : undefined,
      g4_n === 0 ? inputs[7] : undefined,
    ];
  },
};

export const IC74LS173: NodeDefinition = {
  type: '74LS173',
  label: '74LS173 (4-bit Register)',
  category: 'Integrated Circuits/Registers & Buffers',
  tags: ['register', 'd flip-flop', 'memory'],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: '1M', pinNumber: 1, schematicSide: 'left', schematicRow: 8 },
    { type: 'input', name: '2M', pinNumber: 2, schematicSide: 'left', schematicRow: 9 },
    { type: 'input', name: '1D', pinNumber: 3, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: '2D', pinNumber: 4, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: '3D', pinNumber: 5, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: '4D', pinNumber: 6, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: 'CLK', pinNumber: 7, schematicSide: 'left', schematicRow: 11 },
    { type: 'input', name: 'GND', pinNumber: 8 },
    { type: 'input', name: '1G', pinNumber: 9, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: '2G', pinNumber: 10, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: 'CLR', pinNumber: 11, schematicSide: 'left', schematicRow: 12 },
    { type: 'output', name: '4Q', pinNumber: 12, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: '3Q', pinNumber: 13, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: '2Q', pinNumber: 14, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: '1Q', pinNumber: 15, schematicSide: 'right', schematicRow: 1 },
    { type: 'input', name: 'VCC', pinNumber: 16 },
  ],
  evaluate: (inputs, _, __, internal, prevInputs): Signal[] => {
    if (!internal) return HIGH_Z_4;
    if (internal.data === undefined) internal.data = [0, 0, 0, 0];

    const pInputs = prevInputs || inputs;
    const M1 = inputs[0] ?? 0;
    const M2 = inputs[1] ?? 0;
    const clk = inputs[6] ?? 0;
    if (internal.lastClk === undefined) internal.lastClk = clk === 1 ? 1 : 0;
    const G1 = pInputs[8] ?? 0;
    const G2 = pInputs[9] ?? 0;
    const clr = inputs[10] ?? 0;

    if (clr === 1) {
      internal.data = [0, 0, 0, 0];
    } else if (clk === 1 && internal.lastClk === 0 && G1 === 0 && G2 === 0) {
      internal.data = [
        pInputs[2] === 1 ? 1 : 0,
        pInputs[3] === 1 ? 1 : 0,
        pInputs[4] === 1 ? 1 : 0,
        pInputs[5] === 1 ? 1 : 0,
      ];
    }
    internal.lastClk = clk;

    if (M1 === 0 && M2 === 0) {
      return [internal.data[3], internal.data[2], internal.data[1], internal.data[0]];
    }
    return HIGH_Z_4;
  },
};

export const IC74LS175: NodeDefinition = {
  type: '74LS175',
  label: '74LS175 (Quad D Flip-Flop)',
  category: 'Integrated Circuits/Registers & Buffers',
  tags: ['register', 'flip-flop', 'dff'],
  renderAs: 'DIP',
  numInputs: 0,
  numOutputs: 0,
  customPins: [
    { name: '!CLR', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 7 },
    { name: '1Q', type: 'output', pinNumber: 2, schematicSide: 'right', schematicRow: 1 },
    { name: '!1Q', type: 'output', pinNumber: 3, schematicSide: 'right', schematicRow: 2 },
    { name: '1D', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 1 },
    { name: '2D', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 2 },
    { name: '!2Q', type: 'output', pinNumber: 6, schematicSide: 'right', schematicRow: 4 },
    { name: '2Q', type: 'output', pinNumber: 7, schematicSide: 'right', schematicRow: 3 },
    { name: 'GND', type: 'input', pinNumber: 8 },
    { name: 'CLK', type: 'input', pinNumber: 9, schematicSide: 'left', schematicRow: 6 },
    { name: '3Q', type: 'output', pinNumber: 10, schematicSide: 'right', schematicRow: 5 },
    { name: '!3Q', type: 'output', pinNumber: 11, schematicSide: 'right', schematicRow: 6 },
    { name: '3D', type: 'input', pinNumber: 12, schematicSide: 'left', schematicRow: 3 },
    { name: '4D', type: 'input', pinNumber: 13, schematicSide: 'left', schematicRow: 4 },
    { name: '!4Q', type: 'output', pinNumber: 14, schematicSide: 'right', schematicRow: 8 },
    { name: '4Q', type: 'output', pinNumber: 15, schematicSide: 'right', schematicRow: 7 },
    { name: 'VCC', type: 'input', pinNumber: 16 },
  ],
  evaluate: (inputs, _, __, internal, prevInputs): Signal[] => {
    if (!internal) return HIGH_Z_8;
    if (internal.data === undefined) internal.data = [0, 0, 0, 0];

    const pInputs = prevInputs || inputs;
    const clrVal = inputs[0] ?? 1; // Active LOW
    const clkVal = inputs[4] === 1 ? 1 : 0;

    if (internal.lastClk === undefined) internal.lastClk = clkVal;

    if (clrVal === 0) {
      internal.data = [0, 0, 0, 0];
    } else if (clkVal === 1 && internal.lastClk === 0) {
      internal.data[0] = pInputs[1] === 1 ? 1 : 0;
      internal.data[1] = pInputs[2] === 1 ? 1 : 0;
      internal.data[2] = pInputs[5] === 1 ? 1 : 0;
      internal.data[3] = pInputs[6] === 1 ? 1 : 0;
    }
    internal.lastClk = clkVal;

    const [q1, q2, q3, q4] = internal.data;
    return [
      q1, q1 ? 0 : 1, // 1Q, !1Q
      q2 ? 0 : 1, q2, // !2Q, 2Q
      q3, q3 ? 0 : 1, // 3Q, !3Q
      q4 ? 0 : 1, q4, // !4Q, 4Q
    ];
  },
};

export const IC74LS241: NodeDefinition = {
  type: '74LS241',
  label: '74LS241 (Octal Buffer/Line Driver)',
  category: 'Integrated Circuits/Registers & Buffers',
  tags: ['buffer', 'driver', 'tri-state'],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: '1A1', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: '1A2', pinNumber: 4, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: '1A3', pinNumber: 6, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: '1A4', pinNumber: 8, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: '2A1', pinNumber: 11, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: '2A2', pinNumber: 13, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: '2A3', pinNumber: 15, schematicSide: 'left', schematicRow: 8 },
    { type: 'input', name: '2A4', pinNumber: 17, schematicSide: 'left', schematicRow: 9 },

    { type: 'input', name: "1G'", pinNumber: 1, schematicSide: 'left', schematicRow: 11 },
    { type: 'input', name: '2G', pinNumber: 19, schematicSide: 'left', schematicRow: 12 },

    { type: 'output', name: '1Y1', pinNumber: 18, schematicSide: 'right', schematicRow: 1 },
    { type: 'output', name: '1Y2', pinNumber: 16, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: '1Y3', pinNumber: 14, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: '1Y4', pinNumber: 12, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: '2Y1', pinNumber: 9, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: '2Y2', pinNumber: 7, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: '2Y3', pinNumber: 5, schematicSide: 'right', schematicRow: 8 },
    { type: 'output', name: '2Y4', pinNumber: 3, schematicSide: 'right', schematicRow: 9 },

    { type: 'input', name: 'GND', pinNumber: 10 },
    { type: 'input', name: 'VCC', pinNumber: 20 },
  ],
  evaluate: (inputs): Signal[] => {
    const g1_n = inputs[8] ?? 1;
    const g2 = inputs[9] ?? 0;

    if (g1_n !== 0 && g2 !== 1) {
      return HIGH_Z_8;
    }

    return [
      g1_n === 0 ? inputs[0] : undefined,
      g1_n === 0 ? inputs[1] : undefined,
      g1_n === 0 ? inputs[2] : undefined,
      g1_n === 0 ? inputs[3] : undefined,
      g2 === 1 ? inputs[4] : undefined,
      g2 === 1 ? inputs[5] : undefined,
      g2 === 1 ? inputs[6] : undefined,
      g2 === 1 ? inputs[7] : undefined,
    ];
  },
};

export const IC74LS244: NodeDefinition = {
  type: '74LS244',
  label: '74LS244 (Octal Buffer/Line Driver)',
  category: 'Integrated Circuits/Registers & Buffers',
  tags: ['buffer', 'driver', 'tri-state'],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: '1A1', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: '1A2', pinNumber: 4, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: '1A3', pinNumber: 6, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: '1A4', pinNumber: 8, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: '2A1', pinNumber: 11, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: '2A2', pinNumber: 13, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: '2A3', pinNumber: 15, schematicSide: 'left', schematicRow: 8 },
    { type: 'input', name: '2A4', pinNumber: 17, schematicSide: 'left', schematicRow: 9 },

    { type: 'input', name: "1G'", pinNumber: 1, schematicSide: 'left', schematicRow: 11 },
    { type: 'input', name: "2G'", pinNumber: 19, schematicSide: 'left', schematicRow: 12 },

    { type: 'output', name: '1Y1', pinNumber: 18, schematicSide: 'right', schematicRow: 1 },
    { type: 'output', name: '1Y2', pinNumber: 16, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: '1Y3', pinNumber: 14, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: '1Y4', pinNumber: 12, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: '2Y1', pinNumber: 9, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: '2Y2', pinNumber: 7, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: '2Y3', pinNumber: 5, schematicSide: 'right', schematicRow: 8 },
    { type: 'output', name: '2Y4', pinNumber: 3, schematicSide: 'right', schematicRow: 9 },

    { type: 'input', name: 'GND', pinNumber: 10 },
    { type: 'input', name: 'VCC', pinNumber: 20 },
  ],
  evaluate: (inputs): Signal[] => {
    const g1_n = inputs[8] ?? 1;
    const g2_n = inputs[9] ?? 1;

    if (g1_n !== 0 && g2_n !== 0) {
      return HIGH_Z_8;
    }

    return [
      g1_n === 0 ? inputs[0] : undefined,
      g1_n === 0 ? inputs[1] : undefined,
      g1_n === 0 ? inputs[2] : undefined,
      g1_n === 0 ? inputs[3] : undefined,
      g2_n === 0 ? inputs[4] : undefined,
      g2_n === 0 ? inputs[5] : undefined,
      g2_n === 0 ? inputs[6] : undefined,
      g2_n === 0 ? inputs[7] : undefined,
    ];
  },
};

export const IC_74LS245: NodeDefinition = {
  type: '74LS245',
  label: '74LS245 (Octal Bus Transceiver)',
  category: 'Integrated Circuits/Registers & Buffers',
  tags: ['buffer', 'bus', 'transceiver'],
  renderAs: 'DIP',
  numInputs: 20,
  numOutputs: 16,
  customPins: [
    { name: 'DIR', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 10 },
    { name: 'A1', type: 'bidir', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { name: 'A2', type: 'bidir', pinNumber: 3, schematicSide: 'left', schematicRow: 2 },
    { name: 'A3', type: 'bidir', pinNumber: 4, schematicSide: 'left', schematicRow: 3 },
    { name: 'A4', type: 'bidir', pinNumber: 5, schematicSide: 'left', schematicRow: 4 },
    { name: 'A5', type: 'bidir', pinNumber: 6, schematicSide: 'left', schematicRow: 5 },
    { name: 'A6', type: 'bidir', pinNumber: 7, schematicSide: 'left', schematicRow: 6 },
    { name: 'A7', type: 'bidir', pinNumber: 8, schematicSide: 'left', schematicRow: 7 },
    { name: 'A8', type: 'bidir', pinNumber: 9, schematicSide: 'left', schematicRow: 8 },
    { name: 'GND', type: 'input', pinNumber: 10 },
    { name: 'B8', type: 'bidir', pinNumber: 11, schematicSide: 'right', schematicRow: 8 },
    { name: 'B7', type: 'bidir', pinNumber: 12, schematicSide: 'right', schematicRow: 7 },
    { name: 'B6', type: 'bidir', pinNumber: 13, schematicSide: 'right', schematicRow: 6 },
    { name: 'B5', type: 'bidir', pinNumber: 14, schematicSide: 'right', schematicRow: 5 },
    { name: 'B4', type: 'bidir', pinNumber: 15, schematicSide: 'right', schematicRow: 4 },
    { name: 'B3', type: 'bidir', pinNumber: 16, schematicSide: 'right', schematicRow: 3 },
    { name: 'B2', type: 'bidir', pinNumber: 17, schematicSide: 'right', schematicRow: 2 },
    { name: 'B1', type: 'bidir', pinNumber: 18, schematicSide: 'right', schematicRow: 1 },
    { name: "OE'", type: 'input', pinNumber: 19, schematicSide: 'left', schematicRow: 11 },
    { name: 'VCC', type: 'input', pinNumber: 20 },
  ],
  evaluate: (inputs): Signal[] => {
    const OE_n = inputs[18] === 0 ? 0 : 1;
    if (OE_n !== 0) {
      return HIGH_Z_16;
    }

    const DIR = inputs[0] === 0 ? 0 : 1;
    const outs = new Array<Signal>(16);

    if (DIR === 1) {
      outs[15] = inputs[1];
      outs[14] = inputs[2];
      outs[13] = inputs[3];
      outs[12] = inputs[4];
      outs[11] = inputs[5];
      outs[10] = inputs[6];
      outs[9] = inputs[7];
      outs[8] = inputs[8];
    } else {
      outs[0] = inputs[17];
      outs[1] = inputs[16];
      outs[2] = inputs[15];
      outs[3] = inputs[14];
      outs[4] = inputs[13];
      outs[5] = inputs[12];
      outs[6] = inputs[11];
      outs[7] = inputs[10];
    }

    return outs;
  },
};

export const IC74LS273: NodeDefinition = {
  type: '74LS273',
  label: '74LS273 (Octal D Flip-Flop)',
  category: 'Integrated Circuits/Registers & Buffers',
  tags: ['register', 'flip-flop', 'dff', 'memory'],
  renderAs: 'DIP',
  numInputs: 12,
  numOutputs: 8,
  customPins: [
    { name: '~MR', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 11 },
    { name: 'Q0', type: 'output', pinNumber: 2, schematicSide: 'right', schematicRow: 1 },
    { name: 'D0', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 1 },
    { name: 'D1', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 2 },
    { name: 'Q1', type: 'output', pinNumber: 5, schematicSide: 'right', schematicRow: 2 },
    { name: 'Q2', type: 'output', pinNumber: 6, schematicSide: 'right', schematicRow: 3 },
    { name: 'D2', type: 'input', pinNumber: 7, schematicSide: 'left', schematicRow: 3 },
    { name: 'D3', type: 'input', pinNumber: 8, schematicSide: 'left', schematicRow: 4 },
    { name: 'Q3', type: 'output', pinNumber: 9, schematicSide: 'right', schematicRow: 4 },
    { name: 'GND', type: 'input', pinNumber: 10 },
    { name: 'CP', type: 'input', pinNumber: 11, schematicSide: 'left', schematicRow: 10 },
    { name: 'Q4', type: 'output', pinNumber: 12, schematicSide: 'right', schematicRow: 5 },
    { name: 'D4', type: 'input', pinNumber: 13, schematicSide: 'left', schematicRow: 5 },
    { name: 'D5', type: 'input', pinNumber: 14, schematicSide: 'left', schematicRow: 6 },
    { name: 'Q5', type: 'output', pinNumber: 15, schematicSide: 'right', schematicRow: 6 },
    { name: 'Q6', type: 'output', pinNumber: 16, schematicSide: 'right', schematicRow: 7 },
    { name: 'D6', type: 'input', pinNumber: 17, schematicSide: 'left', schematicRow: 7 },
    { name: 'D7', type: 'input', pinNumber: 18, schematicSide: 'left', schematicRow: 8 },
    { name: 'Q7', type: 'output', pinNumber: 19, schematicSide: 'right', schematicRow: 8 },
    { name: 'VCC', type: 'input', pinNumber: 20 },
  ],
  evaluate: (inputs, _props, _tick, internal = {}, prevInputs): Signal[] => {
    const pInputs = prevInputs || inputs;
    const mrN = inputs[0] ?? 1;
    const cp = inputs[6];

    const st = internal;
    if (st.state === undefined) st.state = 0;
    if (st.lastClk === undefined) st.lastClk = cp === 1 ? 1 : 0;

    if (mrN === 0) {
      st.state = 0;
    } else if (cp === 1 && st.lastClk === 0) {
      st.state =
        ((pInputs[10] === 1 ? 1 : 0) << 7) |
        ((pInputs[9] === 1 ? 1 : 0) << 6) |
        ((pInputs[8] === 1 ? 1 : 0) << 5) |
        ((pInputs[7] === 1 ? 1 : 0) << 4) |
        ((pInputs[4] === 1 ? 1 : 0) << 3) |
        ((pInputs[3] === 1 ? 1 : 0) << 2) |
        ((pInputs[2] === 1 ? 1 : 0) << 1) |
        (pInputs[1] === 1 ? 1 : 0);
    }

    st.lastClk = cp === 1 ? 1 : 0;

    const val = st.state as number;
    return [
      (val & 1) ? 1 : 0,
      (val & 2) ? 1 : 0,
      (val & 4) ? 1 : 0,
      (val & 8) ? 1 : 0,
      (val & 16) ? 1 : 0,
      (val & 32) ? 1 : 0,
      (val & 64) ? 1 : 0,
      (val & 128) ? 1 : 0,
    ];
  },
};

export const IC74LS373: NodeDefinition = {
  type: '74LS373',
  label: '74LS373 (Octal Transparent Latch)',
  category: 'Integrated Circuits/Registers & Buffers',
  tags: ['latch', 'register', 'memory', '3-state'],
  renderAs: 'DIP',
  numInputs: 0,
  numOutputs: 0,
  customPins: [
    { name: '!OE', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 11 },
    { name: '1D', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 1 },
    { name: '2D', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 2 },
    { name: '3D', type: 'input', pinNumber: 7, schematicSide: 'left', schematicRow: 3 },
    { name: '4D', type: 'input', pinNumber: 8, schematicSide: 'left', schematicRow: 4 },
    { name: '5D', type: 'input', pinNumber: 13, schematicSide: 'left', schematicRow: 5 },
    { name: '6D', type: 'input', pinNumber: 14, schematicSide: 'left', schematicRow: 6 },
    { name: '7D', type: 'input', pinNumber: 17, schematicSide: 'left', schematicRow: 7 },
    { name: '8D', type: 'input', pinNumber: 18, schematicSide: 'left', schematicRow: 8 },
    { name: 'LE', type: 'input', pinNumber: 11, schematicSide: 'left', schematicRow: 10 },

    { name: '1Q', type: 'output', pinNumber: 2, schematicSide: 'right', schematicRow: 1 },
    { name: '2Q', type: 'output', pinNumber: 5, schematicSide: 'right', schematicRow: 2 },
    { name: '3Q', type: 'output', pinNumber: 6, schematicSide: 'right', schematicRow: 3 },
    { name: '4Q', type: 'output', pinNumber: 9, schematicSide: 'right', schematicRow: 4 },
    { name: '5Q', type: 'output', pinNumber: 12, schematicSide: 'right', schematicRow: 5 },
    { name: '6Q', type: 'output', pinNumber: 15, schematicSide: 'right', schematicRow: 6 },
    { name: '7Q', type: 'output', pinNumber: 16, schematicSide: 'right', schematicRow: 7 },
    { name: '8Q', type: 'output', pinNumber: 19, schematicSide: 'right', schematicRow: 8 },

    { name: 'GND', type: 'input', pinNumber: 10 },
    { name: 'VCC', type: 'input', pinNumber: 20 },
  ],
  evaluate: (inputs, _, __, internal): Signal[] => {
    if (!internal) return HIGH_Z_8;
    if (!internal.data) internal.data = [0, 0, 0, 0, 0, 0, 0, 0];

    const oe_n = inputs[0] ?? 1;
    const le = inputs[9] ?? 0;

    if (le === 1) {
      for (let i = 0; i < 8; i++) {
        internal.data[i] = inputs[i + 1] === 1 ? 1 : 0;
      }
    }

    if (oe_n === 1) {
      return HIGH_Z_8;
    }

    return internal.data.slice();
  },
};

export const IC74LS374: NodeDefinition = {
  type: '74LS374',
  label: '74LS374 (Octal D Flip-Flop 3-State)',
  category: 'Integrated Circuits/Registers & Buffers',
  tags: ['register', 'flip-flop', 'dff', 'memory', '3-state', 'tri-state'],
  renderAs: 'DIP',
  numInputs: 0,
  numOutputs: 0,
  customPins: [
    { name: '!OE', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 11 },
    { name: '1D', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 1 },
    { name: '2D', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 2 },
    { name: '3D', type: 'input', pinNumber: 7, schematicSide: 'left', schematicRow: 3 },
    { name: '4D', type: 'input', pinNumber: 8, schematicSide: 'left', schematicRow: 4 },
    { name: '5D', type: 'input', pinNumber: 13, schematicSide: 'left', schematicRow: 5 },
    { name: '6D', type: 'input', pinNumber: 14, schematicSide: 'left', schematicRow: 6 },
    { name: '7D', type: 'input', pinNumber: 17, schematicSide: 'left', schematicRow: 7 },
    { name: '8D', type: 'input', pinNumber: 18, schematicSide: 'left', schematicRow: 8 },
    { name: 'CLK', type: 'input', pinNumber: 11, schematicSide: 'left', schematicRow: 10 },

    { name: '1Q', type: 'output', pinNumber: 2, schematicSide: 'right', schematicRow: 1 },
    { name: '2Q', type: 'output', pinNumber: 5, schematicSide: 'right', schematicRow: 2 },
    { name: '3Q', type: 'output', pinNumber: 6, schematicSide: 'right', schematicRow: 3 },
    { name: '4Q', type: 'output', pinNumber: 9, schematicSide: 'right', schematicRow: 4 },
    { name: '5Q', type: 'output', pinNumber: 12, schematicSide: 'right', schematicRow: 5 },
    { name: '6Q', type: 'output', pinNumber: 15, schematicSide: 'right', schematicRow: 6 },
    { name: '7Q', type: 'output', pinNumber: 16, schematicSide: 'right', schematicRow: 7 },
    { name: '8Q', type: 'output', pinNumber: 19, schematicSide: 'right', schematicRow: 8 },

    { name: 'GND', type: 'input', pinNumber: 10 },
    { name: 'VCC', type: 'input', pinNumber: 20 },
  ],
  evaluate: (inputs, _, __, internal, prevInputs): Signal[] => {
    if (!internal) return HIGH_Z_8;
    if (!internal.data) internal.data = [0, 0, 0, 0, 0, 0, 0, 0];

    const pInputs = prevInputs || inputs;
    const oe_n = inputs[0] ?? 1;
    const clk = inputs[9] === 1 ? 1 : 0;

    if (internal.lastClk === undefined) internal.lastClk = clk;

    if (clk === 1 && internal.lastClk === 0) {
      for (let i = 0; i < 8; i++) {
        internal.data[i] = pInputs[i + 1] === 1 ? 1 : 0;
      }
    }
    internal.lastClk = clk;

    if (oe_n === 1) {
      return HIGH_Z_8;
    }

    return internal.data.slice();
  },
};

export const IC74LS541: NodeDefinition = {
  type: '74LS541',
  label: '74LS541 (Octal Buffer/Line Driver)',
  category: 'Integrated Circuits/Registers & Buffers',
  tags: ['buffer', 'driver', 'tri-state'],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: '!OE1', pinNumber: 1, schematicSide: 'left', schematicRow: 10 },
    { type: 'input', name: 'A1', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'A2', pinNumber: 3, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'A3', pinNumber: 4, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: 'A4', pinNumber: 5, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: 'A5', pinNumber: 6, schematicSide: 'left', schematicRow: 5 },
    { type: 'input', name: 'A6', pinNumber: 7, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: 'A7', pinNumber: 8, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: 'A8', pinNumber: 9, schematicSide: 'left', schematicRow: 8 },
    { type: 'input', name: 'GND', pinNumber: 10 },
    { type: 'output', name: 'Y8', pinNumber: 11, schematicSide: 'right', schematicRow: 8 },
    { type: 'output', name: 'Y7', pinNumber: 12, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: 'Y6', pinNumber: 13, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: 'Y5', pinNumber: 14, schematicSide: 'right', schematicRow: 5 },
    { type: 'output', name: 'Y4', pinNumber: 15, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: 'Y3', pinNumber: 16, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: 'Y2', pinNumber: 17, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: 'Y1', pinNumber: 18, schematicSide: 'right', schematicRow: 1 },
    { type: 'input', name: '!OE2', pinNumber: 19, schematicSide: 'left', schematicRow: 11 },
    { type: 'input', name: 'VCC', pinNumber: 20 },
  ],
  evaluate: (inputs): Signal[] => {
    const oe1_n = inputs[0] ?? 1;
    const oe2_n = inputs[10] ?? 1;

    if (oe1_n !== 0 || oe2_n !== 0) {
      return HIGH_Z_8;
    }

    return [
      inputs[8], // Y8 <- A8
      inputs[7], // Y7 <- A7
      inputs[6], // Y6 <- A6
      inputs[5], // Y5 <- A5
      inputs[4], // Y4 <- A4
      inputs[3], // Y3 <- A3
      inputs[2], // Y2 <- A2
      inputs[1], // Y1 <- A1
    ];
  },
};
