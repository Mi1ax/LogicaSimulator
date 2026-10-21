import { NodeDefinition } from '../NodeDefinition';
import { Signal } from '../../../models/types';

const HIGH_Z_8: Signal[] = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];

const byteToSignals = (byteVal: number): Signal[] => [
  (byteVal & 1) ? 1 : 0,
  (byteVal & 2) ? 1 : 0,
  (byteVal & 4) ? 1 : 0,
  (byteVal & 8) ? 1 : 0,
  (byteVal & 16) ? 1 : 0,
  (byteVal & 32) ? 1 : 0,
  (byteVal & 64) ? 1 : 0,
  (byteVal & 128) ? 1 : 0,
];

export const ROM_27C256: NodeDefinition = {
  type: '27C256',
  label: '27C256 (32K x 8 EPROM)',
  category: 'Integrated Circuits/Memory',
  tags: ['rom', 'memory', 'eprom'],
  renderAs: 'DIP',
  memorySize: 32768,
  numInputs: 20,
  numOutputs: 8,
  customPins: [
    { name: 'A0', type: 'input', pinNumber: 10, schematicSide: 'left', schematicRow: 1 },
    { name: 'A1', type: 'input', pinNumber: 9, schematicSide: 'left', schematicRow: 2 },
    { name: 'A2', type: 'input', pinNumber: 8, schematicSide: 'left', schematicRow: 3 },
    { name: 'A3', type: 'input', pinNumber: 7, schematicSide: 'left', schematicRow: 4 },
    { name: 'A4', type: 'input', pinNumber: 6, schematicSide: 'left', schematicRow: 5 },
    { name: 'A5', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 6 },
    { name: 'A6', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 7 },
    { name: 'A7', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 8 },
    { name: 'A8', type: 'input', pinNumber: 25, schematicSide: 'left', schematicRow: 9 },
    { name: 'A9', type: 'input', pinNumber: 24, schematicSide: 'left', schematicRow: 10 },
    { name: 'A10', type: 'input', pinNumber: 21, schematicSide: 'left', schematicRow: 11 },
    { name: 'A11', type: 'input', pinNumber: 23, schematicSide: 'left', schematicRow: 12 },
    { name: 'A12', type: 'input', pinNumber: 2, schematicSide: 'left', schematicRow: 13 },
    { name: 'A13', type: 'input', pinNumber: 26, schematicSide: 'left', schematicRow: 14 },
    { name: 'A14', type: 'input', pinNumber: 27, schematicSide: 'left', schematicRow: 15 },
    { name: 'VPP', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 19 },

    { name: 'D0', type: 'output', pinNumber: 11, schematicSide: 'right', schematicRow: 1 },
    { name: 'D1', type: 'output', pinNumber: 12, schematicSide: 'right', schematicRow: 2 },
    { name: 'D2', type: 'output', pinNumber: 13, schematicSide: 'right', schematicRow: 3 },
    { name: 'D3', type: 'output', pinNumber: 15, schematicSide: 'right', schematicRow: 4 },
    { name: 'D4', type: 'output', pinNumber: 16, schematicSide: 'right', schematicRow: 5 },
    { name: 'D5', type: 'output', pinNumber: 17, schematicSide: 'right', schematicRow: 6 },
    { name: 'D6', type: 'output', pinNumber: 18, schematicSide: 'right', schematicRow: 7 },
    { name: 'D7', type: 'output', pinNumber: 19, schematicSide: 'right', schematicRow: 8 },

    { name: '/CE', type: 'input', pinNumber: 20, schematicSide: 'left', schematicRow: 18 },
    { name: '/OE', type: 'input', pinNumber: 22, schematicSide: 'left', schematicRow: 17 },

    { name: 'GND', type: 'input', pinNumber: 14 },
    { name: 'VCC', type: 'input', pinNumber: 28 },
  ],
  evaluate: (inputs, properties): Signal[] => {
    const safeCE_L = inputs[16] ?? 0;
    const safeOE_L = inputs[17] ?? 0;

    if (safeCE_L !== 0 || safeOE_L !== 0) {
      return HIGH_Z_8;
    }

    let address = 0;
    for (let i = 0; i < 15; i++) {
      const val = inputs[i];
      if (val === 'X') return HIGH_Z_8;
      if (val === 1) address |= 1 << i;
    }

    const rawData = properties?.data;
    const byteVal = Array.isArray(rawData) && rawData.length > address ? rawData[address] || 0 : 0;

    return byteToSignals(byteVal);
  },
};

export const SRAM_62256: NodeDefinition = {
  type: '62256',
  label: '62256 (32K x 8 SRAM)',
  category: 'Integrated Circuits/Memory',
  tags: ['ram', 'memory', 'sram'],
  renderAs: 'DIP',
  memorySize: 32768,
  numInputs: 28,
  numOutputs: 8,
  customPins: [
    { name: 'A0', type: 'input', pinNumber: 10, schematicSide: 'left', schematicRow: 1 },
    { name: 'A1', type: 'input', pinNumber: 9, schematicSide: 'left', schematicRow: 2 },
    { name: 'A2', type: 'input', pinNumber: 8, schematicSide: 'left', schematicRow: 3 },
    { name: 'A3', type: 'input', pinNumber: 7, schematicSide: 'left', schematicRow: 4 },
    { name: 'A4', type: 'input', pinNumber: 6, schematicSide: 'left', schematicRow: 5 },
    { name: 'A5', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 6 },
    { name: 'A6', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 7 },
    { name: 'A7', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 8 },
    { name: 'A8', type: 'input', pinNumber: 25, schematicSide: 'left', schematicRow: 9 },
    { name: 'A9', type: 'input', pinNumber: 24, schematicSide: 'left', schematicRow: 10 },
    { name: 'A10', type: 'input', pinNumber: 21, schematicSide: 'left', schematicRow: 11 },
    { name: 'A11', type: 'input', pinNumber: 23, schematicSide: 'left', schematicRow: 12 },
    { name: 'A12', type: 'input', pinNumber: 2, schematicSide: 'left', schematicRow: 13 },
    { name: 'A13', type: 'input', pinNumber: 26, schematicSide: 'left', schematicRow: 14 },
    { name: 'A14', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 15 },

    { name: 'D0', type: 'bidir', pinNumber: 11, schematicSide: 'right', schematicRow: 1 },
    { name: 'D1', type: 'bidir', pinNumber: 12, schematicSide: 'right', schematicRow: 2 },
    { name: 'D2', type: 'bidir', pinNumber: 13, schematicSide: 'right', schematicRow: 3 },
    { name: 'D3', type: 'bidir', pinNumber: 15, schematicSide: 'right', schematicRow: 4 },
    { name: 'D4', type: 'bidir', pinNumber: 16, schematicSide: 'right', schematicRow: 5 },
    { name: 'D5', type: 'bidir', pinNumber: 17, schematicSide: 'right', schematicRow: 6 },
    { name: 'D6', type: 'bidir', pinNumber: 18, schematicSide: 'right', schematicRow: 7 },
    { name: 'D7', type: 'bidir', pinNumber: 19, schematicSide: 'right', schematicRow: 8 },

    { name: '/CE', type: 'input', pinNumber: 20, schematicSide: 'left', schematicRow: 19 },
    { name: '/OE', type: 'input', pinNumber: 22, schematicSide: 'left', schematicRow: 17 },
    { name: '/WE', type: 'input', pinNumber: 27, schematicSide: 'left', schematicRow: 18 },

    { name: 'GND', type: 'input', pinNumber: 14 },
    { name: 'VCC', type: 'input', pinNumber: 28 },
  ],
  evaluate: (inputs, properties, _tickCount, internal): Signal[] => {
    const safeCE_L = inputs[23] ?? 0;
    const safeOE_L = inputs[24] ?? 0;
    const safeWE_L = inputs[25] ?? 1;

    if (!internal) return HIGH_Z_8;
    if (!internal.memory) {
      internal.memory = new Uint8Array(32768);
      if (properties?.data && Array.isArray(properties.data)) {
        for (let i = 0; i < Math.min(properties.data.length, 32768); i++) {
          internal.memory[i] = properties.data[i] || 0;
        }
      }
    }

    let address = 0;
    for (let i = 0; i < 15; i++) {
      if (inputs[i] === 1) address |= 1 << i;
      else if (inputs[i] === 'X') {
        address = -1;
        break;
      }
    }

    if (safeCE_L === 0 && safeWE_L === 0 && address >= 0) {
      let dataIn = 0;
      let valid = true;
      for (let i = 0; i < 8; i++) {
        if (inputs[15 + i] === 1) dataIn |= 1 << i;
        else if (inputs[15 + i] !== 0) valid = false;
      }
      if (valid && internal.memory[address] !== dataIn) {
        internal.memory = new Uint8Array(internal.memory);
        internal.memory[address] = dataIn;
      }
    }

    if (safeCE_L === 0 && safeOE_L === 0 && safeWE_L !== 0) {
      if (address < 0) return HIGH_Z_8;
      return byteToSignals(internal.memory[address]);
    }

    return HIGH_Z_8;
  },
};

export const IC6116: NodeDefinition = {
  type: '6116',
  label: '6116 (2K x 8 SRAM)',
  category: 'Integrated Circuits/Memory',
  tags: ['ram', 'memory', 'sram', '3-state'],
  renderAs: 'DIP',
  memorySize: 2048,
  numInputs: 24,
  numOutputs: 8,
  customPins: [
    { name: 'A7', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 8 },
    { name: 'A6', type: 'input', pinNumber: 2, schematicSide: 'left', schematicRow: 7 },
    { name: 'A5', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 6 },
    { name: 'A4', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 5 },
    { name: 'A3', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 4 },
    { name: 'A2', type: 'input', pinNumber: 6, schematicSide: 'left', schematicRow: 3 },
    { name: 'A1', type: 'input', pinNumber: 7, schematicSide: 'left', schematicRow: 2 },
    { name: 'A0', type: 'input', pinNumber: 8, schematicSide: 'left', schematicRow: 1 },
    { name: 'DQ0', type: 'bidir', pinNumber: 9, schematicSide: 'right', schematicRow: 1 },
    { name: 'DQ1', type: 'bidir', pinNumber: 10, schematicSide: 'right', schematicRow: 2 },
    { name: 'DQ2', type: 'bidir', pinNumber: 11, schematicSide: 'right', schematicRow: 3 },
    { name: 'GND', type: 'input', pinNumber: 12 },
    { name: 'DQ3', type: 'bidir', pinNumber: 13, schematicSide: 'right', schematicRow: 4 },
    { name: 'DQ4', type: 'bidir', pinNumber: 14, schematicSide: 'right', schematicRow: 5 },
    { name: 'DQ5', type: 'bidir', pinNumber: 15, schematicSide: 'right', schematicRow: 6 },
    { name: 'DQ6', type: 'bidir', pinNumber: 16, schematicSide: 'right', schematicRow: 7 },
    { name: 'DQ7', type: 'bidir', pinNumber: 17, schematicSide: 'right', schematicRow: 8 },
    { name: '~CE', type: 'input', pinNumber: 18, schematicSide: 'left', schematicRow: 15 },
    { name: 'A10', type: 'input', pinNumber: 19, schematicSide: 'left', schematicRow: 11 },
    { name: '~OE', type: 'input', pinNumber: 20, schematicSide: 'left', schematicRow: 13 },
    { name: '~WE', type: 'input', pinNumber: 21, schematicSide: 'left', schematicRow: 14 },
    { name: 'A9', type: 'input', pinNumber: 22, schematicSide: 'left', schematicRow: 10 },
    { name: 'A8', type: 'input', pinNumber: 23, schematicSide: 'left', schematicRow: 9 },
    { name: 'VCC', type: 'input', pinNumber: 24 },
  ],
  evaluate: (inputs, properties, _tickCount, internal, prevInputs): Signal[] => {
    if (!internal) return HIGH_Z_8;
    if (!internal.memory) {
      internal.memory = new Uint8Array(2048);
      if (properties?.data && Array.isArray(properties.data)) {
        for (let i = 0; i < Math.min(properties.data.length, 2048); i++) {
          internal.memory[i] = properties.data[i] || 0;
        }
      }
    }

    const decodeAddr = (inp: Signal[]): number => {
      let a = 0;
      if (inp[7] === 1) a |= 1;
      if (inp[6] === 1) a |= 2;
      if (inp[5] === 1) a |= 4;
      if (inp[4] === 1) a |= 8;
      if (inp[3] === 1) a |= 16;
      if (inp[2] === 1) a |= 32;
      if (inp[1] === 1) a |= 64;
      if (inp[0] === 1) a |= 128;
      if (inp[22] === 1) a |= 256;
      if (inp[21] === 1) a |= 512;
      if (inp[18] === 1) a |= 1024;
      return a;
    };

    const pInputs = prevInputs || inputs;
    const p_ce_n = pInputs[17] ?? 1;
    const p_we_n = pInputs[20] ?? 1;

    if (p_ce_n === 0 && p_we_n === 0) {
      const p_addr = decodeAddr(pInputs);
      let p_data = 0;
      if (pInputs[8] === 1) p_data |= 1;
      if (pInputs[9] === 1) p_data |= 2;
      if (pInputs[10] === 1) p_data |= 4;
      if (pInputs[12] === 1) p_data |= 8;
      if (pInputs[13] === 1) p_data |= 16;
      if (pInputs[14] === 1) p_data |= 32;
      if (pInputs[15] === 1) p_data |= 64;
      if (pInputs[16] === 1) p_data |= 128;

      if (internal.memory[p_addr] !== p_data) {
        internal.memory = new Uint8Array(internal.memory);
        internal.memory[p_addr] = p_data;
      }
    }

    const ce_n = inputs[17] ?? 1;
    const oe_n = inputs[19] ?? 1;
    const we_n = inputs[20] ?? 1;

    if (ce_n === 0 && we_n === 1 && oe_n === 0) {
      const addr = decodeAddr(inputs);
      return byteToSignals(internal.memory[addr]);
    }

    return HIGH_Z_8;
  },
};
