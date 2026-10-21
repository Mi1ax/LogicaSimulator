import { NodeDefinition } from '../NodeDefinition';
import { Signal } from '../../../models/types';

const bit = (v: Signal): number => (v === 1 ? 1 : 0);

const BCD_7SEG_TABLE = [
  0b0000001, // 0
  0b1001111, // 1
  0b0010010, // 2
  0b0000110, // 3
  0b1001100, // 4
  0b0100100, // 5
  0b1100000, // 6
  0b0001111, // 7
  0b0000000, // 8
  0b0001100, // 9
  0b1110010, // 10
  0b0011000, // 11
  0b1011100, // 12
  0b1000110, // 13
  0b0111000, // 14
  0b1111111, // 15
];

const ALL_HIGH_8: Signal[] = [1, 1, 1, 1, 1, 1, 1, 1];
const ALL_LOW_8: Signal[] = [0, 0, 0, 0, 0, 0, 0, 0];
const ALL_HIGH_16: Signal[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

export const IC74LS47: NodeDefinition = {
  type: '74LS47',
  label: '74LS47 (BCD to 7-Segment)',
  category: 'Integrated Circuits/Decoders & Multiplexers',
  tags: ['decoder', '7seg', 'display'],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: 'B', pinNumber: 1, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'C', pinNumber: 2, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: "LT'", pinNumber: 3, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: "BI'", pinNumber: 4, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: "RBI'", pinNumber: 5, schematicSide: 'left', schematicRow: 8 },
    { type: 'input', name: 'D', pinNumber: 6, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: 'A', pinNumber: 7, schematicSide: 'left', schematicRow: 1 },
    { type: 'output', name: "e'", pinNumber: 9, schematicSide: 'right', schematicRow: 5 },
    { type: 'output', name: "d'", pinNumber: 10, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: "c'", pinNumber: 11, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: "b'", pinNumber: 12, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: "a'", pinNumber: 13, schematicSide: 'right', schematicRow: 1 },
    { type: 'output', name: "g'", pinNumber: 14, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: "f'", pinNumber: 15, schematicSide: 'right', schematicRow: 6 },
    { type: 'input', name: 'GND', pinNumber: 8 },
    { type: 'input', name: 'VCC', pinNumber: 16 },
  ],
  evaluate: (inputs): Signal[] => {
    const LT_n = inputs[2] ?? 1;
    const BI_n = inputs[3] ?? 1;
    const RBI_n = inputs[4] ?? 1;
    const value = (bit(inputs[5]) << 3) | (bit(inputs[1]) << 2) | (bit(inputs[0]) << 1) | bit(inputs[6]);

    let segments = 0b1111111;
    if (BI_n === 0) {
      segments = 0b1111111;
    } else if (LT_n === 0) {
      segments = 0b0000000;
    } else if (RBI_n === 0 && value === 0) {
      segments = 0b1111111;
    } else {
      segments = BCD_7SEG_TABLE[value] ?? 0b1111111;
    }

    return [
      (segments & (1 << 2)) ? 1 : 0, // e
      (segments & (1 << 3)) ? 1 : 0, // d
      (segments & (1 << 4)) ? 1 : 0, // c
      (segments & (1 << 5)) ? 1 : 0, // b
      (segments & (1 << 6)) ? 1 : 0, // a
      (segments & (1 << 0)) ? 1 : 0, // g
      (segments & (1 << 1)) ? 1 : 0, // f
    ];
  },
};

export const IC74LS138: NodeDefinition = {
  type: '74LS138',
  label: '74LS138 (3-to-8 Decoder)',
  category: 'Integrated Circuits/Decoders & Multiplexers',
  tags: ['decoder', 'demux', 'multiplexer'],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: 'A', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'B', pinNumber: 2, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'C', pinNumber: 3, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: "G2A'", pinNumber: 4, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: "G2B'", pinNumber: 5, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: 'G1', pinNumber: 6, schematicSide: 'left', schematicRow: 5 },
    { type: 'output', name: "Y7'", pinNumber: 7, schematicSide: 'right', schematicRow: 8 },
    { type: 'input', name: 'GND', pinNumber: 8 },
    { type: 'output', name: "Y6'", pinNumber: 9, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: "Y5'", pinNumber: 10, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: "Y4'", pinNumber: 11, schematicSide: 'right', schematicRow: 5 },
    { type: 'output', name: "Y3'", pinNumber: 12, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: "Y2'", pinNumber: 13, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: "Y1'", pinNumber: 14, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: "Y0'", pinNumber: 15, schematicSide: 'right', schematicRow: 1 },
    { type: 'input', name: 'VCC', pinNumber: 16 },
  ],
  evaluate: (inputs): Signal[] => {
    const G2A_n = inputs[3] ?? 1;
    const G2B_n = inputs[4] ?? 1;
    const G1 = inputs[5] ?? 0;

    if (G1 !== 1 || G2A_n !== 0 || G2B_n !== 0) {
      return ALL_HIGH_8;
    }

    const val = (bit(inputs[2]) << 2) | (bit(inputs[1]) << 1) | bit(inputs[0]);
    // Outputs are ordered [Y7', Y6', Y5', Y4', Y3', Y2', Y1', Y0']
    const outs: Signal[] = [1, 1, 1, 1, 1, 1, 1, 1];
    outs[7 - val] = 0;
    return outs;
  },
};

export const IC74LS238: NodeDefinition = {
  type: '74LS238',
  label: '74LS238 (3-to-8 Decoder)',
  category: 'Integrated Circuits/Decoders & Multiplexers',
  tags: ['decoder', 'demux', 'multiplexer', '238', '74hc238', '74ls238', 'active-high'],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: 'A', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'B', pinNumber: 2, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'C', pinNumber: 3, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: "G2A'", pinNumber: 4, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: "G2B'", pinNumber: 5, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: 'G1', pinNumber: 6, schematicSide: 'left', schematicRow: 5 },
    { type: 'output', name: 'Y7', pinNumber: 7, schematicSide: 'right', schematicRow: 8 },
    { type: 'input', name: 'GND', pinNumber: 8 },
    { type: 'output', name: 'Y6', pinNumber: 9, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: 'Y5', pinNumber: 10, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: 'Y4', pinNumber: 11, schematicSide: 'right', schematicRow: 5 },
    { type: 'output', name: 'Y3', pinNumber: 12, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: 'Y2', pinNumber: 13, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: 'Y1', pinNumber: 14, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: 'Y0', pinNumber: 15, schematicSide: 'right', schematicRow: 1 },
    { type: 'input', name: 'VCC', pinNumber: 16 },
  ],
  evaluate: (inputs): Signal[] => {
    const G2A_n = inputs[3] ?? 1;
    const G2B_n = inputs[4] ?? 1;
    const G1 = inputs[5] ?? 0;

    if (G1 !== 1 || G2A_n !== 0 || G2B_n !== 0) {
      return ALL_LOW_8;
    }

    const val = (bit(inputs[2]) << 2) | (bit(inputs[1]) << 1) | bit(inputs[0]);
    // Outputs are ordered [Y7, Y6, Y5, Y4, Y3, Y2, Y1, Y0]
    const outs: Signal[] = [0, 0, 0, 0, 0, 0, 0, 0];
    outs[7 - val] = 1;
    return outs;
  },
};

export const IC74LS139: NodeDefinition = {
  type: '74LS139',
  label: '74LS139 (Dual 2-to-4 Decoder)',
  category: 'Integrated Circuits/Decoders & Multiplexers',
  tags: ['decoder', 'demux', 'multiplexer', 'dual'],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    // Unit 1 (rows 1..4)
    { type: 'input', name: "1G'", pinNumber: 1, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: '1A', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: '1B', pinNumber: 3, schematicSide: 'left', schematicRow: 2 },
    { type: 'output', name: "1Y0'", pinNumber: 4, schematicSide: 'right', schematicRow: 1 },
    { type: 'output', name: "1Y1'", pinNumber: 5, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: "1Y2'", pinNumber: 6, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: "1Y3'", pinNumber: 7, schematicSide: 'right', schematicRow: 4 },
    { type: 'input', name: 'GND', pinNumber: 8 },
    // Unit 2 (rows 6..9)
    { type: 'output', name: "2Y3'", pinNumber: 9, schematicSide: 'right', schematicRow: 9 },
    { type: 'output', name: "2Y2'", pinNumber: 10, schematicSide: 'right', schematicRow: 8 },
    { type: 'output', name: "2Y1'", pinNumber: 11, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: "2Y0'", pinNumber: 12, schematicSide: 'right', schematicRow: 6 },
    { type: 'input', name: '2B', pinNumber: 13, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: '2A', pinNumber: 14, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: "2G'", pinNumber: 15, schematicSide: 'left', schematicRow: 9 },
    { type: 'input', name: 'VCC', pinNumber: 16 },
  ],
  evaluate: (inputs): Signal[] => {
    const G1_n = inputs[0] ?? 1;
    const G2_n = inputs[6] ?? 1;

    if (G1_n !== 0 && G2_n !== 0) {
      return ALL_HIGH_8;
    }

    const outs: Signal[] = [1, 1, 1, 1, 1, 1, 1, 1];
    if (G1_n === 0) {
      const val1 = (bit(inputs[2]) << 1) | bit(inputs[1]);
      outs[val1] = 0; // 1Y0'..1Y3' at indices 0..3
    }
    if (G2_n === 0) {
      const val2 = (bit(inputs[4]) << 1) | bit(inputs[5]);
      outs[7 - val2] = 0; // 2Y3'..2Y0' at indices 4..7
    }
    return outs;
  },
};

export const IC74LS154: NodeDefinition = {
  type: '74LS154',
  label: '74LS154 (4-to-16 Decoder)',
  category: 'Integrated Circuits/Decoders & Multiplexers',
  tags: ['decoder', 'demux', 'multiplexer'],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'output', name: "Y0'", pinNumber: 1, schematicSide: 'right', schematicRow: 1 },
    { type: 'output', name: "Y1'", pinNumber: 2, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: "Y2'", pinNumber: 3, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: "Y3'", pinNumber: 4, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: "Y4'", pinNumber: 5, schematicSide: 'right', schematicRow: 5 },
    { type: 'output', name: "Y5'", pinNumber: 6, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: "Y6'", pinNumber: 7, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: "Y7'", pinNumber: 8, schematicSide: 'right', schematicRow: 8 },
    { type: 'output', name: "Y8'", pinNumber: 9, schematicSide: 'right', schematicRow: 9 },
    { type: 'output', name: "Y9'", pinNumber: 10, schematicSide: 'right', schematicRow: 10 },
    { type: 'output', name: "Y10'", pinNumber: 11, schematicSide: 'right', schematicRow: 11 },
    { type: 'output', name: "Y11'", pinNumber: 13, schematicSide: 'right', schematicRow: 12 },
    { type: 'output', name: "Y12'", pinNumber: 14, schematicSide: 'right', schematicRow: 13 },
    { type: 'output', name: "Y13'", pinNumber: 15, schematicSide: 'right', schematicRow: 14 },
    { type: 'output', name: "Y14'", pinNumber: 16, schematicSide: 'right', schematicRow: 15 },
    { type: 'output', name: "Y15'", pinNumber: 17, schematicSide: 'right', schematicRow: 16 },
    { type: 'input', name: "G1'", pinNumber: 18, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: "G2'", pinNumber: 19, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: 'D', pinNumber: 20, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: 'C', pinNumber: 21, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: 'B', pinNumber: 22, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'A', pinNumber: 23, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'GND', pinNumber: 12 },
    { type: 'input', name: 'VCC', pinNumber: 24 },
  ],
  evaluate: (inputs): Signal[] => {
    const G1_n = inputs[0] ?? 1;
    const G2_n = inputs[1] ?? 1;

    if (G1_n !== 0 || G2_n !== 0) {
      return ALL_HIGH_16;
    }

    const val = (bit(inputs[2]) << 3) | (bit(inputs[3]) << 2) | (bit(inputs[4]) << 1) | bit(inputs[5]);
    const outs: Signal[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    outs[val] = 0;
    return outs;
  },
};
