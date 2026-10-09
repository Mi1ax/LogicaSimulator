import * as fs from 'fs';

const file = 'src/core/engine/nodes/icNodes.ts';
let content = fs.readFileSync(file, 'utf8');

const logicGenerators = `
const createQuad2InputGate = (type: string, label: string, fn: (a: number, b: number) => number): any => ({
  type,
  label,
  tags: ["logic", "gate"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: '1A', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: '1B', pinNumber: 2, schematicSide: 'left', schematicRow: 2 },
    { type: 'output', name: '1Y', pinNumber: 3, schematicSide: 'right', schematicRow: 1 },
    { type: 'input', name: '2A', pinNumber: 4, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: '2B', pinNumber: 5, schematicSide: 'left', schematicRow: 5 },
    { type: 'output', name: '2Y', pinNumber: 6, schematicSide: 'right', schematicRow: 4 },
    { type: 'input', name: 'GND', pinNumber: 7 },
    { type: 'output', name: '3Y', pinNumber: 8, schematicSide: 'right', schematicRow: 7 },
    { type: 'input', name: '3A', pinNumber: 9, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: '3B', pinNumber: 10, schematicSide: 'left', schematicRow: 8 },
    { type: 'output', name: '4Y', pinNumber: 11, schematicSide: 'right', schematicRow: 10 },
    { type: 'input', name: '4A', pinNumber: 12, schematicSide: 'left', schematicRow: 10 },
    { type: 'input', name: '4B', pinNumber: 13, schematicSide: 'left', schematicRow: 11 },
    { type: 'input', name: 'VCC', pinNumber: 14 }
  ],
  evaluate: (inputs: any[]) => {
    // inputs: 1A, 1B, 2A, 2B, GND, 3A, 3B, 4A, 4B, VCC
    const i1a = inputs[0] === 1 ? 1 : 0;
    const i1b = inputs[1] === 1 ? 1 : 0;
    const i2a = inputs[2] === 1 ? 1 : 0;
    const i2b = inputs[3] === 1 ? 1 : 0;
    const i3a = inputs[5] === 1 ? 1 : 0;
    const i3b = inputs[6] === 1 ? 1 : 0;
    const i4a = inputs[7] === 1 ? 1 : 0;
    const i4b = inputs[8] === 1 ? 1 : 0;
    
    return [
      fn(i1a, i1b),
      fn(i2a, i2b),
      fn(i3a, i3b),
      fn(i4a, i4b)
    ];
  }
});

export const IC74LS00 = createQuad2InputGate('74LS00', '74LS00 (Quad NAND)', (a, b) => (a && b) ? 0 : 1);
export const IC74LS02 = {
  type: '74LS02',
  label: '74LS02 (Quad NOR)',
  tags: ["logic", "gate"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'output', name: '1Y', pinNumber: 1, schematicSide: 'right', schematicRow: 1 },
    { type: 'input', name: '1A', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: '1B', pinNumber: 3, schematicSide: 'left', schematicRow: 2 },
    { type: 'output', name: '2Y', pinNumber: 4, schematicSide: 'right', schematicRow: 4 },
    { type: 'input', name: '2A', pinNumber: 5, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: '2B', pinNumber: 6, schematicSide: 'left', schematicRow: 5 },
    { type: 'input', name: 'GND', pinNumber: 7 },
    { type: 'input', name: '3A', pinNumber: 8, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: '3B', pinNumber: 9, schematicSide: 'left', schematicRow: 8 },
    { type: 'output', name: '3Y', pinNumber: 10, schematicSide: 'right', schematicRow: 7 },
    { type: 'input', name: '4A', pinNumber: 11, schematicSide: 'left', schematicRow: 10 },
    { type: 'input', name: '4B', pinNumber: 12, schematicSide: 'left', schematicRow: 11 },
    { type: 'output', name: '4Y', pinNumber: 13, schematicSide: 'right', schematicRow: 10 },
    { type: 'input', name: 'VCC', pinNumber: 14 }
  ],
  evaluate: (inputs: any[]) => {
    const i1a = inputs[0] === 1 ? 1 : 0;
    const i1b = inputs[1] === 1 ? 1 : 0;
    const i2a = inputs[2] === 1 ? 1 : 0;
    const i2b = inputs[3] === 1 ? 1 : 0;
    const i3a = inputs[5] === 1 ? 1 : 0;
    const i3b = inputs[6] === 1 ? 1 : 0;
    const i4a = inputs[7] === 1 ? 1 : 0;
    const i4b = inputs[8] === 1 ? 1 : 0;
    const fn = (a: number, b: number) => (a || b) ? 0 : 1;
    return [
      fn(i1a, i1b),
      fn(i2a, i2b),
      fn(i3a, i3b),
      fn(i4a, i4b)
    ];
  }
};
export const IC74LS32 = createQuad2InputGate('74LS32', '74LS32 (Quad OR)', (a, b) => (a || b) ? 1 : 0);
export const IC74LS86 = createQuad2InputGate('74LS86', '74LS86 (Quad XOR)', (a, b) => (a ^ b) ? 1 : 0);

export const IC74LS04: NodeDefinition = {
  type: '74LS04',
  label: '74LS04 (Hex NOT)',
  tags: ["logic", "gate"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: '1A', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { type: 'output', name: '1Y', pinNumber: 2, schematicSide: 'right', schematicRow: 1 },
    { type: 'input', name: '2A', pinNumber: 3, schematicSide: 'left', schematicRow: 3 },
    { type: 'output', name: '2Y', pinNumber: 4, schematicSide: 'right', schematicRow: 3 },
    { type: 'input', name: '3A', pinNumber: 5, schematicSide: 'left', schematicRow: 5 },
    { type: 'output', name: '3Y', pinNumber: 6, schematicSide: 'right', schematicRow: 5 },
    { type: 'input', name: 'GND', pinNumber: 7 },
    { type: 'output', name: '4Y', pinNumber: 8, schematicSide: 'right', schematicRow: 7 },
    { type: 'input', name: '4A', pinNumber: 9, schematicSide: 'left', schematicRow: 7 },
    { type: 'output', name: '5Y', pinNumber: 10, schematicSide: 'right', schematicRow: 9 },
    { type: 'input', name: '5A', pinNumber: 11, schematicSide: 'left', schematicRow: 9 },
    { type: 'output', name: '6Y', pinNumber: 12, schematicSide: 'right', schematicRow: 11 },
    { type: 'input', name: '6A', pinNumber: 13, schematicSide: 'left', schematicRow: 11 },
    { type: 'input', name: 'VCC', pinNumber: 14 }
  ],
  evaluate: (inputs: any[]) => {
    // 1A, 2A, 3A, GND, 4A, 5A, 6A, VCC
    const i1a = inputs[0] === 1 ? 1 : 0;
    const i2a = inputs[1] === 1 ? 1 : 0;
    const i3a = inputs[2] === 1 ? 1 : 0;
    const i4a = inputs[4] === 1 ? 1 : 0;
    const i5a = inputs[5] === 1 ? 1 : 0;
    const i6a = inputs[6] === 1 ? 1 : 0;
    return [
      i1a ? 0 : 1,
      i2a ? 0 : 1,
      i3a ? 0 : 1,
      i4a ? 0 : 1,
      i5a ? 0 : 1,
      i6a ? 0 : 1
    ];
  }
};
`;

content = content + '\n' + logicGenerators + '\n';
fs.writeFileSync(file, content);
console.log('done logic gates');
