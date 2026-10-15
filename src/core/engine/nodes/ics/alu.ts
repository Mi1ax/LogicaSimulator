import { NodeDefinition } from '../NodeDefinition';
import { Signal } from '../../../models/types';

export const IC_74LS283: NodeDefinition = {
  type: '74LS283',
  label: '74LS283 (4-bit Adder)',
  category: 'Integrated Circuits/Arithmetic & ALU',
  tags: ["adder", "alu", "math"],
  renderAs: 'DIP',
  numInputs: 11,
  numOutputs: 5,
  customPins: [
    { name: 'S2', type: 'output', pinNumber: 1, schematicSide: 'right', schematicRow: 2 },
    { name: 'B2', type: 'input', pinNumber: 2, schematicSide: 'left', schematicRow: 7 },
    { name: 'A2', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 2 },
    { name: 'S1', type: 'output', pinNumber: 4, schematicSide: 'right', schematicRow: 1 },
    { name: 'A1', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 1 },
    { name: 'B1', type: 'input', pinNumber: 6, schematicSide: 'left', schematicRow: 6 },
    { name: 'C0', type: 'input', pinNumber: 7, schematicSide: 'left', schematicRow: 11 },
    { name: 'GND', type: 'input', pinNumber: 8 },
    { name: 'C4', type: 'output', pinNumber: 9, schematicSide: 'right', schematicRow: 6 },
    { name: 'S4', type: 'output', pinNumber: 10, schematicSide: 'right', schematicRow: 4 },
    { name: 'B4', type: 'input', pinNumber: 11, schematicSide: 'left', schematicRow: 9 },
    { name: 'A4', type: 'input', pinNumber: 12, schematicSide: 'left', schematicRow: 4 },
    { name: 'S3', type: 'output', pinNumber: 13, schematicSide: 'right', schematicRow: 3 },
    { name: 'B3', type: 'input', pinNumber: 14, schematicSide: 'left', schematicRow: 8 },
    { name: 'A3', type: 'input', pinNumber: 15, schematicSide: 'left', schematicRow: 3 },
    { name: 'VCC', type: 'input', pinNumber: 16 },
  ],
  evaluate: (inputs) => {
    const getVal = (v: Signal) => v === 1 ? 1 : 0;
    const A = [getVal(inputs[2]), getVal(inputs[1]), getVal(inputs[9]), getVal(inputs[7])];
    const B = [getVal(inputs[3]), getVal(inputs[0]), getVal(inputs[8]), getVal(inputs[6])];
    const C0 = getVal(inputs[4]);

    const valA = A[0] | (A[1] << 1) | (A[2] << 2) | (A[3] << 3);
    const valB = B[0] | (B[1] << 1) | (B[2] << 2) | (B[3] << 3);
    const sum = valA + valB + C0;

    const S1 = ((sum >> 0) & 1) as Signal;
    const S2 = ((sum >> 1) & 1) as Signal;
    const S3 = ((sum >> 2) & 1) as Signal;
    const S4 = ((sum >> 3) & 1) as Signal;
    const C4 = ((sum >> 4) & 1) as Signal;

    return [S2, S1, C4, S4, S3];
  }
};

export const IC74LS181: NodeDefinition = {
  type: '74LS181',
  label: '74LS181 (4-bit ALU)',
  category: 'Integrated Circuits/Arithmetic & ALU',
  tags: ["alu","arithmetic","logic"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: 'B0', pinNumber: 1, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: 'A0', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'S3', pinNumber: 3, schematicSide: 'left', schematicRow: 14 },
    { type: 'input', name: 'S2', pinNumber: 4, schematicSide: 'left', schematicRow: 13 },
    { type: 'input', name: 'S1', pinNumber: 5, schematicSide: 'left', schematicRow: 12 },
    { type: 'input', name: 'S0', pinNumber: 6, schematicSide: 'left', schematicRow: 11 },
    { type: 'input', name: 'Cn', pinNumber: 7, schematicSide: 'left', schematicRow: 17 },
    { type: 'input', name: 'M', pinNumber: 8, schematicSide: 'left', schematicRow: 16 },
    { type: 'output', name: 'F0', pinNumber: 9, schematicSide: 'right', schematicRow: 1 },
    { type: 'output', name: 'F1', pinNumber: 10, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: 'F2', pinNumber: 11, schematicSide: 'right', schematicRow: 3 },
    { type: 'input', name: 'GND', pinNumber: 12 },
    { type: 'output', name: 'F3', pinNumber: 13, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: 'A=B', pinNumber: 14, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: 'P', pinNumber: 15, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: 'Cn+4', pinNumber: 16, schematicSide: 'right', schematicRow: 8 },
    { type: 'output', name: 'G', pinNumber: 17, schematicSide: 'right', schematicRow: 9 },
    { type: 'input', name: 'B1', pinNumber: 18, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: 'A1', pinNumber: 19, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'B2', pinNumber: 20, schematicSide: 'left', schematicRow: 8 },
    { type: 'input', name: 'A2', pinNumber: 21, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: 'B3', pinNumber: 22, schematicSide: 'left', schematicRow: 9 },
    { type: 'input', name: 'A3', pinNumber: 23, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: 'VCC', pinNumber: 24 }
  ],
  evaluate: (inputs: any[]): Signal[] => {
    const A = ((inputs[1]===1?1:0)) | ((inputs[18]===1?1:0)<<1) | ((inputs[20]===1?1:0)<<2) | ((inputs[22]===1?1:0)<<3);
    const B = ((inputs[0]===1?1:0)) | ((inputs[17]===1?1:0)<<1) | ((inputs[19]===1?1:0)<<2) | ((inputs[21]===1?1:0)<<3);
    const S = ((inputs[5]===1?1:0)) | ((inputs[4]===1?1:0)<<1) | ((inputs[3]===1?1:0)<<2) | ((inputs[2]===1?1:0)<<3);
    const M = inputs[7] === 1 ? 1 : 0;
    const Cn = inputs[6] === 0 ? 1 : 0; // Active LOW carry in

    let F = 0;
    let cout = 0;

    if (M === 1) {
      switch (S) {
        case 0: F = ~A; break;
        case 1: F = ~(A & B); break;
        case 2: F = (~A) & B; break;
        case 3: F = 0; break;
        case 4: F = ~(A | B); break;
        case 5: F = ~B; break;
        case 6: F = A ^ B; break;
        case 7: F = A & (~B); break;
        case 8: F = (~A) | B; break;
        case 9: F = ~(A ^ B); break;
        case 10: F = B; break;
        case 11: F = A & B; break;
        case 12: F = 15; break;
        case 13: F = A | (~B); break;
        case 14: F = A | B; break;
        case 15: F = A; break;
      }
      F &= 15;
    } else {
      let op1 = 0, op2 = 0;
      switch (S) {
        case 0: op1 = A; op2 = Cn; break;
        case 1: op1 = A | B; op2 = Cn; break;
        case 2: op1 = A | (~B); op2 = Cn; break;
        case 3: op1 = -1; op2 = Cn; break;
        case 4: op1 = A; op2 = (A & ~B) + Cn; break;
        case 5: op1 = (A | B); op2 = (A & ~B) + Cn; break;
        case 6: op1 = A; op2 = -B - 1 + Cn; break;
        case 7: op1 = (A & ~B); op2 = -1 + Cn; break;
        case 8: op1 = A; op2 = (A & B) + Cn; break;
        case 9: op1 = A + B; op2 = Cn; break;
        case 10: op1 = (A | ~B); op2 = (A & B) + Cn; break;
        case 11: op1 = (A & B); op2 = -1 + Cn; break;
        case 12: op1 = A; op2 = A + Cn; break;
        case 13: op1 = (A | B); op2 = A + Cn; break;
        case 14: op1 = (A | ~B); op2 = A + Cn; break;
        case 15: op1 = A; op2 = -1 + Cn; break;
      }
      const sum = (op1 & 15) + (op2 & 15);
      F = sum & 15;
      cout = (sum > 15) ? 0 : 1;
    }

    const eq = ((F === 15) ? 1 : 0) as Signal;

    return [
      (F & 1) ? 1 : 0,
      (F & 2) ? 1 : 0,
      (F & 4) ? 1 : 0,
      (F & 8) ? 1 : 0,
      eq,
      "X",
      cout as Signal,
      "X"
    ] as Signal[];
  }
};
