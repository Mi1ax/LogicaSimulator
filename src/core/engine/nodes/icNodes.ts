import { NodeDefinition } from './NodeDefinition';

export const IC74LS08: NodeDefinition = {
  type: '74LS08',
  label: '74LS08 (Quad AND)',
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
  evaluate: (inputs) => {
    // Inputs array order matches the 'input' type pins in customPins:
    // 0: 1A, 1: 1B, 2: 2A, 3: 2B, 4: GND, 5: 4A, 6: 4B, 7: 3A, 8: 3B, 9: VCC
    
    // We ignore VCC and GND for pure logic simulation right now, but they are physically required for 74LS series
    
    // Output array order matches the 'output' type pins in customPins:
    // 0: 1Y, 1: 2Y, 2: 4Y, 3: 3Y
    
    const out1Y = (inputs[0] === 1 && inputs[1] === 1) ? 1 : 0;
    const out2Y = (inputs[2] === 1 && inputs[3] === 1) ? 1 : 0;
    const out4Y = (inputs[5] === 1 && inputs[6] === 1) ? 1 : 0;
    const out3Y = (inputs[7] === 1 && inputs[8] === 1) ? 1 : 0;
    
    // If inputs to a specific gate are missing/floating, output is floating
    const res1 = (inputs[0] === undefined || inputs[1] === undefined) ? undefined : out1Y;
    const res2 = (inputs[2] === undefined || inputs[3] === undefined) ? undefined : out2Y;
    const res4 = (inputs[5] === undefined || inputs[6] === undefined) ? undefined : out4Y;
    const res3 = (inputs[7] === undefined || inputs[8] === undefined) ? undefined : out3Y;

    return [res1, res2, res4, res3];
  }
};

export const IC74LS161: NodeDefinition = {
  type: '74LS161',
  label: '74LS161 (4-bit Counter)',
  renderAs: 'DIP',
  numInputs: 11,
  numOutputs: 5,
  customPins: [
    { name: '~CLR', type: 'input', pinNumber: 1 },
    { name: 'CLK', type: 'input', pinNumber: 2 },
    { name: 'A', type: 'input', pinNumber: 3 },
    { name: 'B', type: 'input', pinNumber: 4 },
    { name: 'C', type: 'input', pinNumber: 5 },
    { name: 'D', type: 'input', pinNumber: 6 },
    { name: 'ENP', type: 'input', pinNumber: 7 },
    { name: 'GND', type: 'input', pinNumber: 8 },
    { name: '~LOAD', type: 'input', pinNumber: 9 },
    { name: 'ENT', type: 'input', pinNumber: 10 },
    { name: 'QD', type: 'output', pinNumber: 11 },
    { name: 'QC', type: 'output', pinNumber: 12 },
    { name: 'QB', type: 'output', pinNumber: 13 },
    { name: 'QA', type: 'output', pinNumber: 14 },
    { name: 'RCO', type: 'output', pinNumber: 15 },
    { name: 'VCC', type: 'input', pinNumber: 16 }
  ],
  evaluate: (inputs, _props, _tick, internal = {}) => {
    // Inputs:
    // 0: ~CLR, 1: CLK, 2: A, 3: B, 4: C, 5: D, 6: ENP, 7: GND, 8: ~LOAD, 9: ENT, 10: VCC
    const [clrN, clk, a, b, c, d, enp, , loadN, ent] = inputs;
    
    const st = internal;
    if (st.counter === undefined) st.counter = 0;
    if (st.lastClk === undefined) st.lastClk = 0;

    // Apply User-Friendly Simulator Defaults for floating pins
    const safeClrN = clrN ?? 1;   // Default 1: Don't clear
    const safeLoadN = loadN ?? 1; // Default 1: Don't load
    const safeEnp = enp ?? 1;     // Default 1: Enable counting
    const safeEnt = ent ?? 1;     // Default 1: Enable counting
    
    // Async clear (active low)
    if (safeClrN === 0) {
      st.counter = 0;
    } 
    // Synchronous operations on rising edge
    else if (clk === 1 && st.lastClk === 0) {
      // Synchronous load (active low)
      if (safeLoadN === 0) {
        // Parallel data defaults to 0 if floating
        st.counter = ((d === 1 ? 1 : 0) << 3) | ((c === 1 ? 1 : 0) << 2) | ((b === 1 ? 1 : 0) << 1) | ((a === 1 ? 1 : 0));
      } 
      // Count enable (both ENP and ENT must be high to count)
      else if (safeEnp === 1 && safeEnt === 1) {
        st.counter = (st.counter + 1) % 16;
      }
    }
    
    st.lastClk = clk || 0;
    
    // Outputs:
    // 0: QD, 1: QC, 2: QB, 3: QA, 4: RCO
    const qa = (st.counter & 1) ? 1 : 0;
    const qb = (st.counter & 2) ? 1 : 0;
    const qc = (st.counter & 4) ? 1 : 0;
    const qd = (st.counter & 8) ? 1 : 0;
    
    // Ripple Carry Output (high when counter is 15 and ENT is high)
    const rco = (st.counter === 15 && safeEnt === 1) ? 1 : 0;
    
    // Output floating state if VCC/GND are not connected properly? 
    // In many software sims we ignore power pins unless strict. 
    // Here we'll just output the logic state unconditionally for ease of use.
    return [qd, qc, qb, qa, rco];
  }
};

export const IC74LS273: NodeDefinition = {
  type: '74LS273',
  label: '74LS273 (Octal D Flip-Flop)',
  renderAs: 'DIP',
  numInputs: 12,
  numOutputs: 8,
  customPins: [
    { name: '~MR', type: 'input', pinNumber: 1 },
    { name: 'Q0', type: 'output', pinNumber: 2 },
    { name: 'D0', type: 'input', pinNumber: 3 },
    { name: 'D1', type: 'input', pinNumber: 4 },
    { name: 'Q1', type: 'output', pinNumber: 5 },
    { name: 'Q2', type: 'output', pinNumber: 6 },
    { name: 'D2', type: 'input', pinNumber: 7 },
    { name: 'D3', type: 'input', pinNumber: 8 },
    { name: 'Q3', type: 'output', pinNumber: 9 },
    { name: 'GND', type: 'input', pinNumber: 10 },
    { name: 'CP', type: 'input', pinNumber: 11 },
    { name: 'Q4', type: 'output', pinNumber: 12 },
    { name: 'D4', type: 'input', pinNumber: 13 },
    { name: 'D5', type: 'input', pinNumber: 14 },
    { name: 'Q5', type: 'output', pinNumber: 15 },
    { name: 'Q6', type: 'output', pinNumber: 16 },
    { name: 'D6', type: 'input', pinNumber: 17 },
    { name: 'D7', type: 'input', pinNumber: 18 },
    { name: 'Q7', type: 'output', pinNumber: 19 },
    { name: 'VCC', type: 'input', pinNumber: 20 }
  ],
  evaluate: (inputs, _props, _tick, internal = {}) => {
    // Inputs (12):
    // 0: ~MR, 1: D0, 2: D1, 3: D2, 4: D3, 5: GND, 6: CP, 7: D4, 8: D5, 9: D6, 10: D7, 11: VCC
    const [mrN, d0, d1, d2, d3, , cp, d4, d5, d6, d7] = inputs;
    
    const st = internal;
    if (st.state === undefined) st.state = 0;
    if (st.lastClk === undefined) st.lastClk = 0;

    const safeMrN = mrN ?? 1; // Default 1: Don't reset
    
    // Async reset (active low)
    if (safeMrN === 0) {
      st.state = 0;
    } 
    // Synchronous operations on rising edge
    else if (cp === 1 && st.lastClk === 0) {
      const bit0 = d0 === 1 ? 1 : 0;
      const bit1 = d1 === 1 ? 1 : 0;
      const bit2 = d2 === 1 ? 1 : 0;
      const bit3 = d3 === 1 ? 1 : 0;
      const bit4 = d4 === 1 ? 1 : 0;
      const bit5 = d5 === 1 ? 1 : 0;
      const bit6 = d6 === 1 ? 1 : 0;
      const bit7 = d7 === 1 ? 1 : 0;
      
      st.state = (bit7 << 7) | (bit6 << 6) | (bit5 << 5) | (bit4 << 4) | (bit3 << 3) | (bit2 << 2) | (bit1 << 1) | bit0;
    }
    
    st.lastClk = cp || 0;
    
    // Outputs (8):
    // 0: Q0, 1: Q1, 2: Q2, 3: Q3, 4: Q4, 5: Q5, 6: Q6, 7: Q7
    const q0 = (st.state & (1 << 0)) ? 1 : 0;
    const q1 = (st.state & (1 << 1)) ? 1 : 0;
    const q2 = (st.state & (1 << 2)) ? 1 : 0;
    const q3 = (st.state & (1 << 3)) ? 1 : 0;
    const q4 = (st.state & (1 << 4)) ? 1 : 0;
    const q5 = (st.state & (1 << 5)) ? 1 : 0;
    const q6 = (st.state & (1 << 6)) ? 1 : 0;
    const q7 = (st.state & (1 << 7)) ? 1 : 0;
    
    return [q0, q1, q2, q3, q4, q5, q6, q7];
  }
};

export const ROM_27C256: NodeDefinition = {
  type: '27C256',
  label: '27C256 (32K x 8 EPROM)',
  renderAs: 'DIP',
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
    { name: 'VPP', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 17 }, // Gap after A14
    
    { name: 'D0', type: 'output', pinNumber: 11, schematicSide: 'right', schematicRow: 1 },
    { name: 'D1', type: 'output', pinNumber: 12, schematicSide: 'right', schematicRow: 2 },
    { name: 'D2', type: 'output', pinNumber: 13, schematicSide: 'right', schematicRow: 3 },
    { name: 'D3', type: 'output', pinNumber: 15, schematicSide: 'right', schematicRow: 4 },
    { name: 'D4', type: 'output', pinNumber: 16, schematicSide: 'right', schematicRow: 5 },
    { name: 'D5', type: 'output', pinNumber: 17, schematicSide: 'right', schematicRow: 6 },
    { name: 'D6', type: 'output', pinNumber: 18, schematicSide: 'right', schematicRow: 7 },
    { name: 'D7', type: 'output', pinNumber: 19, schematicSide: 'right', schematicRow: 8 },
    
    { name: '/CE', type: 'input', pinNumber: 20, schematicSide: 'right', schematicRow: 10 }, // Gap after D7
    { name: '/OE', type: 'input', pinNumber: 22, schematicSide: 'right', schematicRow: 11 },

    { name: 'GND', type: 'input', pinNumber: 14 },
    { name: 'VCC', type: 'input', pinNumber: 28 },
  ],
  evaluate: (inputs, properties) => {
    // Inputs array mapped from customPins:
    // 0..14: A0..A14
    // 15: /CE, 16: /OE, 17: VPP, 18: GND, 19: VCC

    const CE_L = inputs[15];
    const OE_L = inputs[16];

    // High-Z if not enabled
    if (CE_L !== 0 || OE_L !== 0) {
      return [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
    }

    // Read address
    let address = 0;
    
    for (let i = 0; i < 15; i++) {
      const val = inputs[i];
      if (val === undefined || val === 'X') return [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]; // Unstable address
      if (val === 1) address |= (1 << i);
    }

    // Read data from properties
    const rawData = properties?.data; // Array of numbers or base64
    let byteVal = 0;
    
    if (Array.isArray(rawData) && rawData.length > address) {
      byteVal = rawData[address] || 0;
    } else if (typeof rawData === 'string') {
      // Decode base64 if needed, but for performance, we should decode it once, or let the UI handle string->array conversion before saving to properties
      // Assuming UI saves it as an array of bytes
    }

    // Output D0..D7
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
  renderAs: 'DIP',
  numInputs: 28, // 15 addr + 8 data + 3 ctrl + 2 pwr
  numOutputs: 8, // 8 data
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
    // inputs array order based on customPins:
    // 0..14: A0..A14
    // 15..22: D0..D7
    // 23: /CE, 24: /OE, 25: /WE
    // 26: GND, 27: VCC

    const CE_L = inputs[23];
    const OE_L = inputs[24];
    const WE_L = inputs[25];

    if (!internal) return [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
    if (!internal.data) {
      internal.data = new Uint8Array(32768);
      if (properties?.data && Array.isArray(properties.data)) {
        for (let i = 0; i < Math.min(properties.data.length, 32768); i++) {
          internal.data[i] = properties.data[i] || 0;
        }
      }
    }

    let address = 0;
    for (let i = 0; i < 15; i++) {
      if (inputs[i] === 1) address |= (1 << i);
      else if (inputs[i] !== 0) {
        // floating or 'X' address -> undefined output if reading, no write if writing
        address = -1;
        break;
      }
    }

    // Write cycle
    if (CE_L === 0 && WE_L === 0 && address >= 0) {
      let dataIn = 0;
      let valid = true;
      for (let i = 0; i < 8; i++) {
        if (inputs[15 + i] === 1) dataIn |= (1 << i);
        else if (inputs[15 + i] !== 0) valid = false;
      }
      if (valid) {
        internal.data[address] = dataIn;
      }
    }

    // Read cycle
    if (CE_L === 0 && OE_L === 0 && WE_L !== 0) {
      if (address < 0) return [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
      const dataOut = internal.data[address];
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
