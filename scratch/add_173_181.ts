import * as fs from 'fs';

const file = 'src/core/engine/nodes/icNodes.ts';
let content = fs.readFileSync(file, 'utf8');

const advancedIcs = `
export const IC74LS173: NodeDefinition = {
  type: '74LS173',
  label: '74LS173 (4-bit Register)',
  tags: ["register","d flip-flop","memory"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: '1M', pinNumber: 1, schematicSide: 'bottom', schematicRow: 1 },
    { type: 'input', name: '2M', pinNumber: 2, schematicSide: 'bottom', schematicRow: 2 },
    { type: 'input', name: '1D', pinNumber: 3, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: '2D', pinNumber: 4, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: '3D', pinNumber: 5, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: '4D', pinNumber: 6, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: 'CLK', pinNumber: 7, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: 'GND', pinNumber: 8 },
    { type: 'input', name: '1G', pinNumber: 9, schematicSide: 'bottom', schematicRow: 4 },
    { type: 'input', name: '2G', pinNumber: 10, schematicSide: 'bottom', schematicRow: 5 },
    { type: 'input', name: 'CLR', pinNumber: 11, schematicSide: 'top', schematicRow: 3 },
    { type: 'output', name: '4Q', pinNumber: 12, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: '3Q', pinNumber: 13, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: '2Q', pinNumber: 14, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: '1Q', pinNumber: 15, schematicSide: 'right', schematicRow: 1 },
    { type: 'input', name: 'VCC', pinNumber: 16 }
  ],
  evaluate: (inputs: any[], _, __, internal) => {
    if (!internal) return [undefined, undefined, undefined, undefined];
    if (internal.data === undefined) internal.data = [0, 0, 0, 0];
    if (internal.lastClk === undefined) internal.lastClk = 0;

    const M1 = inputs[0] ?? 0;
    const M2 = inputs[1] ?? 0;
    const D = [inputs[2], inputs[3], inputs[4], inputs[5]];
    const clk = inputs[6] ?? 0;
    const G1 = inputs[8] ?? 0;
    const G2 = inputs[9] ?? 0;
    const clr = inputs[10] ?? 0;

    if (clr === 1) {
      internal.data = [0, 0, 0, 0];
    } else if (clk === 1 && internal.lastClk === 0) {
      if (G1 === 0 && G2 === 0) {
        internal.data = D.map(val => val === 1 ? 1 : 0);
      }
    }
    internal.lastClk = clk;

    if (M1 === 0 && M2 === 0) {
      return [internal.data[3], internal.data[2], internal.data[1], internal.data[0]];
    } else {
      return [undefined, undefined, undefined, undefined];
    }
  }
};

export const IC74LS181: NodeDefinition = {
  type: '74LS181',
  label: '74LS181 (4-bit ALU)',
  tags: ["alu","arithmetic","logic"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: 'B0', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'A0', pinNumber: 2, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'S3', pinNumber: 3, schematicSide: 'top', schematicRow: 4 },
    { type: 'input', name: 'S2', pinNumber: 4, schematicSide: 'top', schematicRow: 3 },
    { type: 'input', name: 'S1', pinNumber: 5, schematicSide: 'top', schematicRow: 2 },
    { type: 'input', name: 'S0', pinNumber: 6, schematicSide: 'top', schematicRow: 1 },
    { type: 'input', name: 'Cn', pinNumber: 7, schematicSide: 'bottom', schematicRow: 1 },
    { type: 'input', name: 'M', pinNumber: 8, schematicSide: 'bottom', schematicRow: 3 },
    { type: 'output', name: 'F0', pinNumber: 9, schematicSide: 'right', schematicRow: 1 },
    { type: 'output', name: 'F1', pinNumber: 10, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: 'F2', pinNumber: 11, schematicSide: 'right', schematicRow: 3 },
    { type: 'input', name: 'GND', pinNumber: 12 },
    { type: 'output', name: 'F3', pinNumber: 13, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: 'A=B', pinNumber: 14, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: 'P', pinNumber: 15, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: 'Cn+4', pinNumber: 16, schematicSide: 'right', schematicRow: 8 },
    { type: 'output', name: 'G', pinNumber: 17, schematicSide: 'right', schematicRow: 9 },
    { type: 'input', name: 'B1', pinNumber: 18, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: 'A1', pinNumber: 19, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: 'B2', pinNumber: 20, schematicSide: 'left', schematicRow: 5 },
    { type: 'input', name: 'A2', pinNumber: 21, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: 'B3', pinNumber: 22, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: 'A3', pinNumber: 23, schematicSide: 'left', schematicRow: 8 },
    { type: 'input', name: 'VCC', pinNumber: 24 }
  ],
  evaluate: (inputs: any[]) => {
    // Read A and B
    const A = ((inputs[1]===1?1:0)) | ((inputs[18]===1?1:0)<<1) | ((inputs[20]===1?1:0)<<2) | ((inputs[22]===1?1:0)<<3);
    const B = ((inputs[0]===1?1:0)) | ((inputs[17]===1?1:0)<<1) | ((inputs[19]===1?1:0)<<2) | ((inputs[21]===1?1:0)<<3);
    const S = ((inputs[5]===1?1:0)) | ((inputs[4]===1?1:0)<<1) | ((inputs[3]===1?1:0)<<2) | ((inputs[2]===1?1:0)<<3);
    const M = inputs[7] === 1 ? 1 : 0;
    const Cn = inputs[6] === 0 ? 1 : 0; // Active LOW carry in

    let F = 0;
    let cout = 0;

    if (M === 1) { // Logic operations
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
    } else { // Arithmetic operations
      // Simplified simulation for 181 arithmetic
      // We will just do the basic addition logic for A + B etc.
      let op1 = 0, op2 = 0;
      switch (S) {
        case 0: op1 = A; op2 = Cn; break; // A
        case 1: op1 = A | B; op2 = Cn; break; // A | B
        case 2: op1 = A | (~B); op2 = Cn; break; // A | ~B
        case 3: op1 = -1; op2 = Cn; break; // minus 1 (2s comp)
        case 4: op1 = A; op2 = (A & ~B) + Cn; break; // A plus (A & ~B)
        case 5: op1 = (A | B); op2 = (A & ~B) + Cn; break; 
        case 6: op1 = A; op2 = -B - 1 + Cn; break; // A minus B minus 1
        case 7: op1 = (A & ~B); op2 = -1 + Cn; break;
        case 8: op1 = A; op2 = (A & B) + Cn; break;
        case 9: op1 = A + B; op2 = Cn; break; // A plus B
        case 10: op1 = (A | ~B); op2 = (A & B) + Cn; break;
        case 11: op1 = (A & B); op2 = -1 + Cn; break;
        case 12: op1 = A; op2 = A + Cn; break; // A plus A
        case 13: op1 = (A | B); op2 = A + Cn; break; // (A|B) plus A
        case 14: op1 = (A | ~B); op2 = A + Cn; break; // (A|~B) plus A
        case 15: op1 = A; op2 = -1 + Cn; break; // A minus 1
      }
      const sum = (op1 & 15) + (op2 & 15); // approximation for 4-bit, keeping it simple
      F = sum & 15;
      cout = (sum > 15) ? 0 : 1; // Active LOW carry out
    }
    
    // P and G are complex, simplified for now
    const eq = (F === 15) ? 1 : 0;
    
    // Outputs: F0(9), F1(10), F2(11), F3(13), A=B(14), P(15), Cn+4(16), G(17)
    // indices 8, 9, 10, 11 (F0-F3), 12 (A=B), 13 (P), 14 (Cn+4), 15 (G)
    return [
      (F & 1) ? 1 : 0,
      (F & 2) ? 1 : 0,
      (F & 4) ? 1 : 0,
      (F & 8) ? 1 : 0,
      eq,
      undefined, // P simplified
      cout,
      undefined  // G simplified
    ];
  }
};
`;

content = content + '\n' + advancedIcs + '\n';
fs.writeFileSync(file, content);
console.log('done advanced');
