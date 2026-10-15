import { NodeDefinition } from '../NodeDefinition';

export const ROM_27C256: NodeDefinition = {
  type: '27C256',
  label: '27C256 (32K x 8 EPROM)',
  category: 'Integrated Circuits/Memory',
  tags: ["rom","memory","eprom"],
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
    { name: 'VPP', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 17 },

    { name: 'D0', type: 'output', pinNumber: 11, schematicSide: 'right', schematicRow: 1 },
    { name: 'D1', type: 'output', pinNumber: 12, schematicSide: 'right', schematicRow: 2 },
    { name: 'D2', type: 'output', pinNumber: 13, schematicSide: 'right', schematicRow: 3 },
    { name: 'D3', type: 'output', pinNumber: 15, schematicSide: 'right', schematicRow: 4 },
    { name: 'D4', type: 'output', pinNumber: 16, schematicSide: 'right', schematicRow: 5 },
    { name: 'D5', type: 'output', pinNumber: 17, schematicSide: 'right', schematicRow: 6 },
    { name: 'D6', type: 'output', pinNumber: 18, schematicSide: 'right', schematicRow: 7 },
    { name: 'D7', type: 'output', pinNumber: 19, schematicSide: 'right', schematicRow: 8 },

    { name: '/CE', type: 'input', pinNumber: 20, schematicSide: 'right', schematicRow: 10 },
    { name: '/OE', type: 'input', pinNumber: 22, schematicSide: 'right', schematicRow: 11 },

    { name: 'GND', type: 'input', pinNumber: 14 },
    { name: 'VCC', type: 'input', pinNumber: 28 },
  ],
  evaluate: (inputs, properties) => {
    const safeCE_L = inputs[16] ?? 0;
    const safeOE_L = inputs[17] ?? 0;

    if (safeCE_L !== 0 || safeOE_L !== 0) {
      return [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
    }

    let address = 0;

    for (let i = 0; i < 15; i++) {
      const val = inputs[i];
      if (val === 'X') return [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
      if (val === 1) address |= (1 << i);
    }

    const rawData = properties?.data;
    let byteVal = 0;

    if (Array.isArray(rawData) && rawData.length > address) {
      byteVal = rawData[address] || 0;
    }

    return [
      (byteVal & (1 << 0)) ? 1 : 0,
      (byteVal & (1 << 1)) ? 1 : 0,
      (byteVal & (1 << 2)) ? 1 : 0,
      (byteVal & (1 << 3)) ? 1 : 0,
      (byteVal & (1 << 4)) ? 1 : 0,
      (byteVal & (1 << 5)) ? 1 : 0,
      (byteVal & (1 << 6)) ? 1 : 0,
      (byteVal & (1 << 7)) ? 1 : 0,
    ];
  }
};

export const SRAM_62256: NodeDefinition = {
  type: '62256',
  label: '62256 (32K x 8 SRAM)',
  category: 'Integrated Circuits/Memory',
  tags: ["ram","memory","sram"],
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

    { name: '/CE', type: 'input', pinNumber: 20, schematicSide: 'right', schematicRow: 10 },
    { name: '/OE', type: 'input', pinNumber: 22, schematicSide: 'right', schematicRow: 11 },
    { name: '/WE', type: 'input', pinNumber: 27, schematicSide: 'right', schematicRow: 12 },

    { name: 'GND', type: 'input', pinNumber: 14 },
    { name: 'VCC', type: 'input', pinNumber: 28 },
  ],
  evaluate: (inputs, properties, _tickCount, internal) => {
    const safeCE_L = inputs[23] ?? 0;
    const safeOE_L = inputs[24] ?? 0;
    const safeWE_L = inputs[25] ?? 1;

    if (!internal) return [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
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
      if (inputs[i] === 1) address |= (1 << i);
      else if (inputs[i] === 'X') {
        address = -1;
        break;
      }
    }

    if (safeCE_L === 0 && safeWE_L === 0 && address >= 0) {
      let dataIn = 0;
      let valid = true;
      for (let i = 0; i < 8; i++) {
        if (inputs[15 + i] === 1) dataIn |= (1 << i);
        else if (inputs[15 + i] !== 0) valid = false;
      }
      if (valid) {
        internal.memory[address] = dataIn;
      }
    }

    if (safeCE_L === 0 && safeOE_L === 0 && safeWE_L !== 0) {
      if (address < 0) return [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
      const dataOut = internal.memory[address];
      return [
        (dataOut & (1 << 0)) ? 1 : 0,
        (dataOut & (1 << 1)) ? 1 : 0,
        (dataOut & (1 << 2)) ? 1 : 0,
        (dataOut & (1 << 3)) ? 1 : 0,
        (dataOut & (1 << 4)) ? 1 : 0,
        (dataOut & (1 << 5)) ? 1 : 0,
        (dataOut & (1 << 6)) ? 1 : 0,
        (dataOut & (1 << 7)) ? 1 : 0,
      ];
    }

    return [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
  }
};

export const IC6116: NodeDefinition = {
  type: '6116',
  label: '6116 (2K x 8 SRAM)',
  category: 'Integrated Circuits/Memory',
  tags: ["ram", "memory", "sram", "3-state"],
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
    { name: '~CE', type: 'input', pinNumber: 18, schematicSide: 'bottom', schematicRow: 2 },
    { name: 'A10', type: 'input', pinNumber: 19, schematicSide: 'left', schematicRow: 11 },
    { name: '~OE', type: 'input', pinNumber: 20, schematicSide: 'bottom', schematicRow: 4 },
    { name: '~WE', type: 'input', pinNumber: 21, schematicSide: 'bottom', schematicRow: 6 },
    { name: 'A9', type: 'input', pinNumber: 22, schematicSide: 'left', schematicRow: 10 },
    { name: 'A8', type: 'input', pinNumber: 23, schematicSide: 'left', schematicRow: 9 },
    { name: 'VCC', type: 'input', pinNumber: 24 },
  ],
  evaluate: (inputs, properties, _tickCount, internal, prevInputs) => {
    if (!internal) return Array(8).fill(undefined);
    if (!internal.memory) {
      internal.memory = new Uint8Array(2048);
      if (properties && properties.data) {
        for (let i = 0; i < 2048; i++) {
          internal.memory[i] = properties.data[i] || 0;
        }
      }
    }
    
    const a0 = inputs[7] ?? 0;
    const a1 = inputs[6] ?? 0;
    const a2 = inputs[5] ?? 0;
    const a3 = inputs[4] ?? 0;
    const a4 = inputs[3] ?? 0;
    const a5 = inputs[2] ?? 0;
    const a6 = inputs[1] ?? 0;
    const a7 = inputs[0] ?? 0;
    const a8 = inputs[22] ?? 0;
    const a9 = inputs[21] ?? 0;
    const a10 = inputs[18] ?? 0;
    
    let addr = 0;
    if (a0 === 1) addr |= 1;
    if (a1 === 1) addr |= 2;
    if (a2 === 1) addr |= 4;
    if (a3 === 1) addr |= 8;
    if (a4 === 1) addr |= 16;
    if (a5 === 1) addr |= 32;
    if (a6 === 1) addr |= 64;
    if (a7 === 1) addr |= 128;
    if (a8 === 1) addr |= 256;
    if (a9 === 1) addr |= 512;
    if (a10 === 1) addr |= 1024;
    
    const pInputs = prevInputs || inputs;
    const p_ce_n = pInputs[17] ?? 1;
    const p_we_n = pInputs[20] ?? 1;

    if (p_ce_n === 0 && p_we_n === 0) {
      let p_addr = 0;
      if (pInputs[7] === 1) p_addr |= 1;
      if (pInputs[6] === 1) p_addr |= 2;
      if (pInputs[5] === 1) p_addr |= 4;
      if (pInputs[4] === 1) p_addr |= 8;
      if (pInputs[3] === 1) p_addr |= 16;
      if (pInputs[2] === 1) p_addr |= 32;
      if (pInputs[1] === 1) p_addr |= 64;
      if (pInputs[0] === 1) p_addr |= 128;
      if (pInputs[22] === 1) p_addr |= 256;
      if (pInputs[21] === 1) p_addr |= 512;
      if (pInputs[18] === 1) p_addr |= 1024;

      let p_data = 0;
      if (pInputs[8] === 1) p_data |= 1;
      if (pInputs[9] === 1) p_data |= 2;
      if (pInputs[10] === 1) p_data |= 4;
      if (pInputs[12] === 1) p_data |= 8;
      if (pInputs[13] === 1) p_data |= 16;
      if (pInputs[14] === 1) p_data |= 32;
      if (pInputs[15] === 1) p_data |= 64;
      if (pInputs[16] === 1) p_data |= 128;

      internal.memory[p_addr] = p_data;
    }
    
    const ce_n = inputs[17] ?? 1;
    const oe_n = inputs[19] ?? 1;
    const we_n = inputs[20] ?? 1;
    
    const outs = Array(8).fill(undefined);
    
    if (ce_n === 0) {
      if (we_n === 1 && oe_n === 0) {
        const data = internal.memory[addr];
        outs[0] = (data & 1) ? 1 : 0;
        outs[1] = (data & 2) ? 1 : 0;
        outs[2] = (data & 4) ? 1 : 0;
        outs[3] = (data & 8) ? 1 : 0;
        outs[4] = (data & 16) ? 1 : 0;
        outs[5] = (data & 32) ? 1 : 0;
        outs[6] = (data & 64) ? 1 : 0;
        outs[7] = (data & 128) ? 1 : 0;
      }
    }
    
    return outs;
  }
};
