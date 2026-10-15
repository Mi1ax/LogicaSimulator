import { NodeDefinition } from '../NodeDefinition';
import { Signal } from '../../../models/types';

export const IC74LS47: NodeDefinition = {
  type: '74LS47',
  label: '74LS47 (BCD to 7-Segment)',
  category: 'Integrated Circuits/Decoders & Multiplexers',
  tags: ["decoder","7seg","display"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: 'B', pinNumber: 1, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'C', pinNumber: 2, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: 'LT\'', pinNumber: 3, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: 'BI\'', pinNumber: 4, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: 'RBI\'', pinNumber: 5, schematicSide: 'left', schematicRow: 8 },
    { type: 'input', name: 'D', pinNumber: 6, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: 'A', pinNumber: 7, schematicSide: 'left', schematicRow: 1 },
    { type: 'output', name: 'e\'', pinNumber: 9, schematicSide: 'right', schematicRow: 5 },
    { type: 'output', name: 'd\'', pinNumber: 10, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: 'c\'', pinNumber: 11, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: 'b\'', pinNumber: 12, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: 'a\'', pinNumber: 13, schematicSide: 'right', schematicRow: 1 },
    { type: 'output', name: 'g\'', pinNumber: 14, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: 'f\'', pinNumber: 15, schematicSide: 'right', schematicRow: 6 },
    { type: 'input', name: 'GND', pinNumber: 8 },
    { type: 'input', name: 'VCC', pinNumber: 16 },
  ],
  evaluate: (inputs) => {
    const B = inputs[0] ?? 0;
    const C = inputs[1] ?? 0;
    const LT_n = inputs[2] ?? 1;
    const BI_n = inputs[3] ?? 1;
    const RBI_n = inputs[4] ?? 1;
    const D = inputs[5] ?? 0;
    const A = inputs[6] ?? 0;

    const value = ((D as number) << 3) | ((C as number) << 2) | ((B as number) << 1) | (A as number);

    let segments = 0b1111111;

    if (BI_n === 0) {
      segments = 0b1111111;
    } else if (LT_n === 0) {
      segments = 0b0000000;
    } else if (RBI_n === 0 && value === 0) {
      segments = 0b1111111;
    } else {
      switch (value) {
        case 0: segments = 0b0000001; break;
        case 1: segments = 0b1001111; break;
        case 2: segments = 0b0010010; break;
        case 3: segments = 0b0000110; break;
        case 4: segments = 0b1001100; break;
        case 5: segments = 0b0100100; break;
        case 6: segments = 0b1100000; break;
        case 7: segments = 0b0001111; break;
        case 8: segments = 0b0000000; break;
        case 9: segments = 0b0001100; break;
        case 10: segments = 0b1110010; break;
        case 11: segments = 0b0011000; break;
        case 12: segments = 0b1011100; break;
        case 13: segments = 0b1000110; break;
        case 14: segments = 0b0111000; break;
        case 15: segments = 0b1111111; break;
        default: segments = 0b1111111;
      }
    }

    return [
      ((segments >> 2) & 1) as Signal, // e
      ((segments >> 3) & 1) as Signal, // d
      ((segments >> 4) & 1) as Signal, // c
      ((segments >> 5) & 1) as Signal, // b
      ((segments >> 6) & 1) as Signal, // a
      ((segments >> 0) & 1) as Signal, // g
      ((segments >> 1) & 1) as Signal, // f
    ];
  }
};

export const IC74LS138: NodeDefinition = {
  type: '74LS138',
  label: '74LS138 (3-to-8 Decoder)',
  category: 'Integrated Circuits/Decoders & Multiplexers',
  tags: ["decoder","demux","multiplexer"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: 'A', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'B', pinNumber: 2, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'C', pinNumber: 3, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: 'G2A\'', pinNumber: 4, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: 'G2B\'', pinNumber: 5, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: 'G1', pinNumber: 6, schematicSide: 'left', schematicRow: 5 },
    { type: 'output', name: 'Y7\'', pinNumber: 7, schematicSide: 'right', schematicRow: 8 },
    { type: 'input', name: 'GND', pinNumber: 8 },
    { type: 'output', name: 'Y6\'', pinNumber: 9, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: 'Y5\'', pinNumber: 10, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: 'Y4\'', pinNumber: 11, schematicSide: 'right', schematicRow: 5 },
    { type: 'output', name: 'Y3\'', pinNumber: 12, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: 'Y2\'', pinNumber: 13, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: 'Y1\'', pinNumber: 14, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: 'Y0\'', pinNumber: 15, schematicSide: 'right', schematicRow: 1 },
    { type: 'input', name: 'VCC', pinNumber: 16 },
  ],
  evaluate: (inputs): Signal[] => {
    const A = inputs[0] ?? 0;
    const B = inputs[1] ?? 0;
    const C = inputs[2] ?? 0;
    const G2A_n = inputs[3] ?? 1;
    const G2B_n = inputs[4] ?? 1;
    const G1 = inputs[5] ?? 0;

    const outs: Signal[] = Array(8).fill(1);

    if (G1 === 1 && G2A_n === 0 && G2B_n === 0) {
      const val = ((C as number) << 2) | ((B as number) << 1) | (A as number);
      if (val >= 0 && val <= 7) {
        outs[val] = 0;
      }
    }

    return [outs[7], outs[6], outs[5], outs[4], outs[3], outs[2], outs[1], outs[0]];
  }
};

export const IC74LS154: NodeDefinition = {
  type: '74LS154',
  label: '74LS154 (4-to-16 Decoder)',
  category: 'Integrated Circuits/Decoders & Multiplexers',
  tags: ["decoder","demux","multiplexer"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'output', name: 'Y0\'', pinNumber: 1, schematicSide: 'right', schematicRow: 1 },
    { type: 'output', name: 'Y1\'', pinNumber: 2, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: 'Y2\'', pinNumber: 3, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: 'Y3\'', pinNumber: 4, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: 'Y4\'', pinNumber: 5, schematicSide: 'right', schematicRow: 5 },
    { type: 'output', name: 'Y5\'', pinNumber: 6, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: 'Y6\'', pinNumber: 7, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: 'Y7\'', pinNumber: 8, schematicSide: 'right', schematicRow: 8 },
    { type: 'output', name: 'Y8\'', pinNumber: 9, schematicSide: 'right', schematicRow: 9 },
    { type: 'output', name: 'Y9\'', pinNumber: 10, schematicSide: 'right', schematicRow: 10 },
    { type: 'output', name: 'Y10\'', pinNumber: 11, schematicSide: 'right', schematicRow: 11 },
    { type: 'output', name: 'Y11\'', pinNumber: 13, schematicSide: 'right', schematicRow: 12 },
    { type: 'output', name: 'Y12\'', pinNumber: 14, schematicSide: 'right', schematicRow: 13 },
    { type: 'output', name: 'Y13\'', pinNumber: 15, schematicSide: 'right', schematicRow: 14 },
    { type: 'output', name: 'Y14\'', pinNumber: 16, schematicSide: 'right', schematicRow: 15 },
    { type: 'output', name: 'Y15\'', pinNumber: 17, schematicSide: 'right', schematicRow: 16 },
    { type: 'input', name: 'G1\'', pinNumber: 18, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: 'G2\'', pinNumber: 19, schematicSide: 'left', schematicRow: 7 },
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
    const D = inputs[2] ?? 0;
    const C = inputs[3] ?? 0;
    const B = inputs[4] ?? 0;
    const A = inputs[5] ?? 0;

    const outs: Signal[] = Array(16).fill(1);

    if (G1_n === 0 && G2_n === 0) {
      const val = ((D as number) << 3) | ((C as number) << 2) | ((B as number) << 1) | (A as number);
      if (val >= 0 && val <= 15) {
        outs[val] = 0;
      }
    }

    return outs;
  }
};
