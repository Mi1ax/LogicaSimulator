import { NodeDefinition } from '../NodeDefinition';

export const IC74LS08: NodeDefinition = {
  type: '74LS08',
  label: '74LS08 (Quad AND)',
  category: 'Integrated Circuits/Logic Gates',
  tags: ['gate', 'and', 'logic'],
  renderAs: 'DIP',
  numInputs: 10,
  numOutputs: 4,
  customPins: [
    { name: '1A', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { name: '1B', type: 'input', pinNumber: 2, schematicSide: 'left', schematicRow: 2 },
    { name: '1Y', type: 'output', pinNumber: 3, schematicSide: 'right', schematicRow: 1 },
    { name: '2A', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 4 },
    { name: '2B', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 5 },
    { name: '2Y', type: 'output', pinNumber: 6, schematicSide: 'right', schematicRow: 4 },
    { name: 'GND', type: 'input', pinNumber: 7 },
    { name: '4Y', type: 'output', pinNumber: 8, schematicSide: 'right', schematicRow: 10 },
    { name: '4A', type: 'input', pinNumber: 9, schematicSide: 'left', schematicRow: 10 },
    { name: '4B', type: 'input', pinNumber: 10, schematicSide: 'left', schematicRow: 11 },
    { name: '3Y', type: 'output', pinNumber: 11, schematicSide: 'right', schematicRow: 7 },
    { name: '3A', type: 'input', pinNumber: 12, schematicSide: 'left', schematicRow: 7 },
    { name: '3B', type: 'input', pinNumber: 13, schematicSide: 'left', schematicRow: 8 },
    { name: 'VCC', type: 'input', pinNumber: 14 },
  ],
};

const createQuad2InputGate = (type: string, label: string): NodeDefinition => ({
  type,
  label,
  category: 'Integrated Circuits/Logic Gates',
  tags: ['logic', 'gate'],
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
    { type: 'input', name: 'VCC', pinNumber: 14 },
  ],
});

export const IC74LS00 = createQuad2InputGate('74LS00', '74LS00 (Quad NAND)');

export const IC74LS02: NodeDefinition = {
  type: '74LS02',
  label: '74LS02 (Quad NOR)',
  category: 'Integrated Circuits/Logic Gates',
  tags: ['logic', 'gate'],
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
    { type: 'input', name: 'VCC', pinNumber: 14 },
  ],
};

export const IC74LS04: NodeDefinition = {
  type: '74LS04',
  label: '74LS04 (Hex NOT)',
  category: 'Integrated Circuits/Logic Gates',
  tags: ['logic', 'gate'],
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
    { type: 'input', name: 'VCC', pinNumber: 14 },
  ],
};

export const IC74LS30: NodeDefinition = {
  type: '74LS30',
  label: '74LS30 (8-Input NAND Gate)',
  category: 'Integrated Circuits/Logic Gates',
  tags: ['logic', 'gate', 'nand', '8-input'],
  numInputs: 8,
  numOutputs: 1,
};

export const IC74LS32 = createQuad2InputGate('74LS32', '74LS32 (Quad OR)');
export const IC74LS86 = createQuad2InputGate('74LS86', '74LS86 (Quad XOR)');
