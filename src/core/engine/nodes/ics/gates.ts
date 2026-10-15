import { NodeDefinition } from '../NodeDefinition';
import { Signal } from '../../../models/types';

export const IC74LS08: NodeDefinition = {
  type: '74LS08',
  label: '74LS08 (Quad AND)',
  category: 'Integrated Circuits/Logic Gates',
  tags: ["gate","and","logic"],
  renderAs: 'DIP',
  numInputs: 10,
  numOutputs: 4,
  customPins: [
    { name: '1A', type: 'input', pinNumber: 1 },
    { name: '1B', type: 'input', pinNumber: 2 },
    { name: '1Y', type: 'output', pinNumber: 3 },
    { name: '2A', type: 'input', pinNumber: 4 },
    { name: '2B', type: 'input', pinNumber: 5 },
    { name: '2Y', type: 'output', pinNumber: 6 },
    { name: 'GND', type: 'input', pinNumber: 7 }, // Pin 7 GND
    { name: '4Y', type: 'output', pinNumber: 8 },
    { name: '4A', type: 'input', pinNumber: 9 },
    { name: '4B', type: 'input', pinNumber: 10 },
    { name: '3Y', type: 'output', pinNumber: 11 },
    { name: '3A', type: 'input', pinNumber: 12 },
    { name: '3B', type: 'input', pinNumber: 13 },
    { name: 'VCC', type: 'input', pinNumber: 14 }, // Pin 14 VCC
  ],
  evaluate: (inputs): Signal[] => {
    const out1Y = (inputs[0] === 1 && inputs[1] === 1) ? 1 : 0;
    const out2Y = (inputs[2] === 1 && inputs[3] === 1) ? 1 : 0;
    const out4Y = (inputs[5] === 1 && inputs[6] === 1) ? 1 : 0;
    const out3Y = (inputs[7] === 1 && inputs[8] === 1) ? 1 : 0;

    const res1 = (inputs[0] === undefined || inputs[1] === undefined) ? undefined : out1Y;
    const res2 = (inputs[2] === undefined || inputs[3] === undefined) ? undefined : out2Y;
    const res4 = (inputs[5] === undefined || inputs[6] === undefined) ? undefined : out4Y;
    const res3 = (inputs[7] === undefined || inputs[8] === undefined) ? undefined : out3Y;

    return [res1, res2, res4, res3];
  }
};

const createQuad2InputGate = (type: string, label: string, fn: (a: number, b: number) => Signal): NodeDefinition => ({
  type,
  label,
  category: 'Integrated Circuits/Logic Gates',
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
  evaluate: (inputs: any[]): Signal[] => {
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

export const IC74LS02: NodeDefinition = {
  type: '74LS02',
  label: '74LS02 (Quad NOR)',
  category: 'Integrated Circuits/Logic Gates',
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

export const IC74LS04: NodeDefinition = {
  type: '74LS04',
  label: '74LS04 (Hex NOT)',
  category: 'Integrated Circuits/Logic Gates',
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

export const IC74LS30: NodeDefinition = {
  type: '74LS30',
  label: '74LS30 (8-Input NAND Gate)',
  category: 'Integrated Circuits/Logic Gates',
  tags: ["logic", "gate", "nand", "8-input"],
  numInputs: 8,
  numOutputs: 1,
  evaluate: (inputs) => {
    const a = inputs[0] ?? 1;
    const b = inputs[1] ?? 1;
    const c = inputs[2] ?? 1;
    const d = inputs[3] ?? 1;
    const e = inputs[4] ?? 1;
    const f = inputs[5] ?? 1;
    const g = inputs[6] ?? 1;
    const h = inputs[7] ?? 1;

    if (a === 'X' || b === 'X' || c === 'X' || d === 'X' || e === 'X' || f === 'X' || g === 'X' || h === 'X') {
       if (a === 0 || b === 0 || c === 0 || d === 0 || e === 0 || f === 0 || g === 0 || h === 0) return [1];
       return ['X' as any];
    }

    const allHigh = (a === 1 && b === 1 && c === 1 && d === 1 && e === 1 && f === 1 && g === 1 && h === 1);
    return [allHigh ? 0 : 1];
  }
};

export const IC74LS32 = createQuad2InputGate('74LS32', '74LS32 (Quad OR)', (a, b) => (a || b) ? 1 : 0);
export const IC74LS86 = createQuad2InputGate('74LS86', '74LS86 (Quad XOR)', (a, b) => (a ^ b) ? 1 : 0);
