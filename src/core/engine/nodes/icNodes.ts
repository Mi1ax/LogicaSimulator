import { NodeDefinition } from './NodeDefinition';
import { Signal } from '../../models/types';

export const IC74LS08: NodeDefinition = {
  type: '74LS08',
  label: '74LS08 (Quad AND)',
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
  tags: ["counter","timer","sync"],
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


export const IC74LS191: NodeDefinition = {
  type: '74LS191',
  label: '74LS191 (Up/Down Counter)',
  tags: ["counter","up","down","timer"],
  renderAs: 'DIP',
  numInputs: 10,
  numOutputs: 6,
  customPins: [
    { name: 'B', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 2 },
    { name: 'QB', type: 'output', pinNumber: 2, schematicSide: 'right', schematicRow: 2 },
    { name: 'QA', type: 'output', pinNumber: 3, schematicSide: 'right', schematicRow: 1 },
    { name: '~CTEN', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 6 },
    { name: 'D/~U', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 7 },
    { name: 'QC', type: 'output', pinNumber: 6, schematicSide: 'right', schematicRow: 3 },
    { name: 'QD', type: 'output', pinNumber: 7, schematicSide: 'right', schematicRow: 4 },
    { name: 'GND', type: 'input', pinNumber: 8 },
    { name: 'D', type: 'input', pinNumber: 9, schematicSide: 'left', schematicRow: 4 },
    { name: 'C', type: 'input', pinNumber: 10, schematicSide: 'left', schematicRow: 3 },
    { name: '~LOAD', type: 'input', pinNumber: 11, schematicSide: 'left', schematicRow: 8 },
    { name: 'MAX/MIN', type: 'output', pinNumber: 12, schematicSide: 'right', schematicRow: 6 },
    { name: '~RCO', type: 'output', pinNumber: 13, schematicSide: 'right', schematicRow: 7 },
    { name: 'CLK', type: 'input', pinNumber: 14, schematicSide: 'left', schematicRow: 5 },
    { name: 'A', type: 'input', pinNumber: 15, schematicSide: 'left', schematicRow: 1 },
    { name: 'VCC', type: 'input', pinNumber: 16 }
  ],
  evaluate: (inputs, _props, _tick, internal = {}) => {
    const b = inputs[0];
    const ctenN = inputs[1] ?? 0;
    const du = inputs[2] ?? 0;
    const d = inputs[4];
    const c = inputs[5];
    const loadN = inputs[6] ?? 1;
    const clk = inputs[7];
    const a = inputs[8];

    const st = internal;
    if (st.counter === undefined) st.counter = 0;
    if (st.lastClk === undefined) st.lastClk = 0;

    if (loadN === 0) {
       let val = 0;
       if (a === 1) val |= 1;
       if (b === 1) val |= 2;
       if (c === 1) val |= 4;
       if (d === 1) val |= 8;
       if (a === 'X' || b === 'X' || c === 'X' || d === 'X' || a === undefined || b === undefined || c === undefined || d === undefined) {
           st.counter = 'X';
       } else {
           st.counter = val;
       }
    } else {
       const risingEdge = st.lastClk === 0 && clk === 1;
       if (risingEdge && ctenN === 0 && st.counter !== 'X') {
           if (du === 0) {
               st.counter = (st.counter + 1) % 16;
           } else if (du === 1) {
               st.counter = (st.counter - 1 + 16) % 16;
           }
       }
    }

    if (clk === 0 || clk === 1) {
        st.lastClk = clk;
    }

    if (st.counter === 'X') return ['X', 'X', 'X', 'X', 'X', 'X'] as any;

    const val = st.counter;
    const qa = (val & 1) ? 1 : 0;
    const qb = (val & 2) ? 1 : 0;
    const qc = (val & 4) ? 1 : 0;
    const qd = (val & 8) ? 1 : 0;

    let maxMin = 0;
    if (du === 0 && val === 15) maxMin = 1;
    if (du === 1 && val === 0) maxMin = 1;

    let rcoN = 1;
    if (maxMin === 1 && ctenN === 0 && clk === 0) rcoN = 0;

    return [qb, qa, qc, qd, maxMin, rcoN] as any;
  }
};

export const IC74LS273: NodeDefinition = {
  type: '74LS273',
  label: '74LS273 (Octal D Flip-Flop)',
  tags: ["register","flip-flop","dff","memory"],
  renderAs: 'DIP',
  numInputs: 12,
  numOutputs: 8,
  customPins: [
    { name: '~MR', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 11 },
    { name: 'Q0', type: 'output', pinNumber: 2, schematicSide: 'right', schematicRow: 1 },
    { name: 'D0', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 1 },
    { name: 'D1', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 2 },
    { name: 'Q1', type: 'output', pinNumber: 5, schematicSide: 'right', schematicRow: 2 },
    { name: 'Q2', type: 'output', pinNumber: 6, schematicSide: 'right', schematicRow: 3 },
    { name: 'D2', type: 'input', pinNumber: 7, schematicSide: 'left', schematicRow: 3 },
    { name: 'D3', type: 'input', pinNumber: 8, schematicSide: 'left', schematicRow: 4 },
    { name: 'Q3', type: 'output', pinNumber: 9, schematicSide: 'right', schematicRow: 4 },
    { name: 'GND', type: 'input', pinNumber: 10 },
    { name: 'CP', type: 'input', pinNumber: 11, schematicSide: 'left', schematicRow: 10 },
    { name: 'Q4', type: 'output', pinNumber: 12, schematicSide: 'right', schematicRow: 5 },
    { name: 'D4', type: 'input', pinNumber: 13, schematicSide: 'left', schematicRow: 5 },
    { name: 'D5', type: 'input', pinNumber: 14, schematicSide: 'left', schematicRow: 6 },
    { name: 'Q5', type: 'output', pinNumber: 15, schematicSide: 'right', schematicRow: 6 },
    { name: 'Q6', type: 'output', pinNumber: 16, schematicSide: 'right', schematicRow: 7 },
    { name: 'D6', type: 'input', pinNumber: 17, schematicSide: 'left', schematicRow: 7 },
    { name: 'D7', type: 'input', pinNumber: 18, schematicSide: 'left', schematicRow: 8 },
    { name: 'Q7', type: 'output', pinNumber: 19, schematicSide: 'right', schematicRow: 8 },
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
  tags: ["rom","memory","eprom"],
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
    // 15: VPP, 16: /CE, 17: /OE, 18: GND, 19: VCC

    const safeCE_L = inputs[16] ?? 0;
    const safeOE_L = inputs[17] ?? 0;

    // High-Z if not enabled
    if (safeCE_L !== 0 || safeOE_L !== 0) {
      return [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
    }

    // Read address
    let address = 0;

    for (let i = 0; i < 15; i++) {
      const val = inputs[i];
      if (val === 'X') return [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]; // Unstable address
      if (val === 1) address |= (1 << i);
      // undefined is treated as 0 for user friendliness
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
  tags: ["ram","memory","sram"],
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

    const safeCE_L = inputs[23] ?? 0;
    const safeOE_L = inputs[24] ?? 0;
    const safeWE_L = inputs[25] ?? 1; // Default to not writing if disconnected

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
      else if (inputs[i] === 'X') {
        // 'X' address -> undefined output if reading, no write if writing
        address = -1;
        break;
      }
      // undefined is treated as 0 for user friendliness
    }

    // Write cycle
    if (safeCE_L === 0 && safeWE_L === 0 && address >= 0) {
      let dataIn = 0;
      let valid = true;
      for (let i = 0; i < 8; i++) {
        if (inputs[15 + i] === 1) dataIn |= (1 << i);
        else if (inputs[15 + i] !== 0) valid = false; // undefined or X data invalidates write
      }
      if (valid) {
        internal.data[address] = dataIn;
      }
    }

    // Read cycle
    if (safeCE_L === 0 && safeOE_L === 0 && safeWE_L !== 0) {
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

export const IC74LS47: NodeDefinition = {
  type: '74LS47',
  label: '74LS47 (BCD to 7-Segment)',
  tags: ["decoder","7seg","display"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: 'B', pinNumber: 1 },
    { type: 'input', name: 'C', pinNumber: 2 },
    { type: 'input', name: 'LT\'', pinNumber: 3 },
    { type: 'input', name: 'BI\'', pinNumber: 4 },
    { type: 'input', name: 'RBI\'', pinNumber: 5 },
    { type: 'input', name: 'D', pinNumber: 6 },
    { type: 'input', name: 'A', pinNumber: 7 },
    { type: 'output', name: 'e\'', pinNumber: 9 },
    { type: 'output', name: 'd\'', pinNumber: 10 },
    { type: 'output', name: 'c\'', pinNumber: 11 },
    { type: 'output', name: 'b\'', pinNumber: 12 },
    { type: 'output', name: 'a\'', pinNumber: 13 },
    { type: 'output', name: 'g\'', pinNumber: 14 },
    { type: 'output', name: 'f\'', pinNumber: 15 },
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


export const IC74LS154: NodeDefinition = {
  type: '74LS154',
  label: '74LS154 (4-to-16 Decoder)',
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
    { type: 'input', name: 'G1\'', pinNumber: 18, schematicSide: 'bottom', schematicRow: 1 },
    { type: 'input', name: 'G2\'', pinNumber: 19, schematicSide: 'bottom', schematicRow: 2 },
    { type: 'input', name: 'D', pinNumber: 20, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: 'C', pinNumber: 21, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: 'B', pinNumber: 22, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'A', pinNumber: 23, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'GND', pinNumber: 12 },
    { type: 'input', name: 'VCC', pinNumber: 24 },
  ],
  evaluate: (inputs): Signal[] => {
    // Inputs (based on customPins order):
    // order in inputs array: G1', G2', D, C, B, A
    const G1_n = inputs[0] ?? 1;
    const G2_n = inputs[1] ?? 1;
    const D = inputs[2] ?? 0;
    const C = inputs[3] ?? 0;
    const B = inputs[4] ?? 0;
    const A = inputs[5] ?? 0;

    const outs: Signal[] = Array(16).fill(1); // Default HIGH (inactive)

    if (G1_n === 0 && G2_n === 0) {
      const val = ((D as number) << 3) | ((C as number) << 2) | ((B as number) << 1) | (A as number);
      if (val >= 0 && val <= 15) {
        outs[val] = 0; // Active LOW
      }
    }

    return outs;
  }
};


export const IC74LS138: NodeDefinition = {
  type: '74LS138',
  label: '74LS138 (3-to-8 Decoder)',
  tags: ["decoder","demux","multiplexer"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: 'A', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'B', pinNumber: 2, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'C', pinNumber: 3, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: 'G2A\'', pinNumber: 4, schematicSide: 'bottom', schematicRow: 1 },
    { type: 'input', name: 'G2B\'', pinNumber: 5, schematicSide: 'bottom', schematicRow: 2 },
    { type: 'input', name: 'G1', pinNumber: 6, schematicSide: 'bottom', schematicRow: 4 },
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
    // inputs: A, B, C, G2A', G2B', G1
    const A = inputs[0] ?? 0;
    const B = inputs[1] ?? 0;
    const C = inputs[2] ?? 0;
    const G2A_n = inputs[3] ?? 1;
    const G2B_n = inputs[4] ?? 1;
    const G1 = inputs[5] ?? 0;

    const outs: Signal[] = Array(8).fill(1); // Default HIGH (inactive)

    if (G1 === 1 && G2A_n === 0 && G2B_n === 0) {
      const val = ((C as number) << 2) | ((B as number) << 1) | (A as number);
      if (val >= 0 && val <= 7) {
        outs[val] = 0; // Active LOW
      }
    }

    // Output order in customPins: Y7', Y6', Y5', Y4', Y3', Y2', Y1', Y0'
    // outs array is indexed by val: outs[0] is Y0', outs[7] is Y7'
    return [outs[7], outs[6], outs[5], outs[4], outs[3], outs[2], outs[1], outs[0]];
  }
};


export const IC74LS241: NodeDefinition = {
  type: '74LS241',
  label: '74LS241 (Octal Buffer/Line Driver)',
  tags: ["buffer","driver","tri-state"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: '1A1', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: '1A2', pinNumber: 4, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: '1A3', pinNumber: 6, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: '1A4', pinNumber: 8, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: '2A1', pinNumber: 11, schematicSide: 'left', schematicRow: 5 },
    { type: 'input', name: '2A2', pinNumber: 13, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: '2A3', pinNumber: 15, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: '2A4', pinNumber: 17, schematicSide: 'left', schematicRow: 8 },

    { type: 'input', name: '1G\'', pinNumber: 1, schematicSide: 'bottom', schematicRow: 2 },
    { type: 'input', name: '2G', pinNumber: 19, schematicSide: 'bottom', schematicRow: 4 },

    { type: 'output', name: '1Y1', pinNumber: 18, schematicSide: 'right', schematicRow: 1 },
    { type: 'output', name: '1Y2', pinNumber: 16, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: '1Y3', pinNumber: 14, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: '1Y4', pinNumber: 12, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: '2Y1', pinNumber: 9, schematicSide: 'right', schematicRow: 5 },
    { type: 'output', name: '2Y2', pinNumber: 7, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: '2Y3', pinNumber: 5, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: '2Y4', pinNumber: 3, schematicSide: 'right', schematicRow: 8 },

    { type: 'input', name: 'GND', pinNumber: 10 },
    { type: 'input', name: 'VCC', pinNumber: 20 },
  ],
  evaluate: (inputs): Signal[] => {
    // Inputs (based on customPins order for type 'input'):
    // 0: 1A1, 1: 1A2, 2: 1A3, 3: 1A4
    // 4: 2A1, 5: 2A2, 6: 2A3, 7: 2A4
    // 8: 1G', 9: 2G
    const a1 = [inputs[0], inputs[1], inputs[2], inputs[3]];
    const a2 = [inputs[4], inputs[5], inputs[6], inputs[7]];
    const g1_n = inputs[8] ?? 1; // Default HIGH (inactive)
    const g2 = inputs[9] ?? 0;   // Default LOW (inactive)

    const outs: Signal[] = Array(8).fill(undefined);

    // Group 1: Active Low Enable
    if (g1_n === 0) {
      outs[0] = a1[0];
      outs[1] = a1[1];
      outs[2] = a1[2];
      outs[3] = a1[3];
    }

    // Group 2: Active High Enable
    if (g2 === 1) {
      outs[4] = a2[0];
      outs[5] = a2[1];
      outs[6] = a2[2];
      outs[7] = a2[3];
    }

    return outs;
  }
};


export const IC74LS244: NodeDefinition = {
  type: '74LS244',
  label: '74LS244 (Octal Buffer/Line Driver)',
  tags: ["buffer","driver","tri-state"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: '1A1', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: '1A2', pinNumber: 4, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: '1A3', pinNumber: 6, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: '1A4', pinNumber: 8, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: '2A1', pinNumber: 11, schematicSide: 'left', schematicRow: 5 },
    { type: 'input', name: '2A2', pinNumber: 13, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: '2A3', pinNumber: 15, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: '2A4', pinNumber: 17, schematicSide: 'left', schematicRow: 8 },

    { type: 'input', name: '1G\'', pinNumber: 1, schematicSide: 'bottom', schematicRow: 2 },
    { type: 'input', name: '2G\'', pinNumber: 19, schematicSide: 'bottom', schematicRow: 4 },

    { type: 'output', name: '1Y1', pinNumber: 18, schematicSide: 'right', schematicRow: 1 },
    { type: 'output', name: '1Y2', pinNumber: 16, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: '1Y3', pinNumber: 14, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: '1Y4', pinNumber: 12, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: '2Y1', pinNumber: 9, schematicSide: 'right', schematicRow: 5 },
    { type: 'output', name: '2Y2', pinNumber: 7, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: '2Y3', pinNumber: 5, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: '2Y4', pinNumber: 3, schematicSide: 'right', schematicRow: 8 },

    { type: 'input', name: 'GND', pinNumber: 10 },
    { type: 'input', name: 'VCC', pinNumber: 20 },
  ],
  evaluate: (inputs): Signal[] => {
    // Inputs (based on customPins order for type 'input'):
    // 0: 1A1, 1: 1A2, 2: 1A3, 3: 1A4
    // 4: 2A1, 5: 2A2, 6: 2A3, 7: 2A4
    // 8: 1G', 9: 2G'
    const a1 = [inputs[0], inputs[1], inputs[2], inputs[3]];
    const a2 = [inputs[4], inputs[5], inputs[6], inputs[7]];
    const g1_n = inputs[8] ?? 1; // Default HIGH (inactive)
    const g2_n = inputs[9] ?? 1; // Default HIGH (inactive)

    const outs: Signal[] = Array(8).fill(undefined);

    // Group 1: Active Low Enable
    if (g1_n === 0) {
      outs[0] = a1[0];
      outs[1] = a1[1];
      outs[2] = a1[2];
      outs[3] = a1[3];
    }

    // Group 2: Active Low Enable
    if (g2_n === 0) {
      outs[4] = a2[0];
      outs[5] = a2[1];
      outs[6] = a2[2];
      outs[7] = a2[3];
    }

    return outs;
  }
};

export const IC_74LS283: NodeDefinition = {
  type: '74LS283',
  label: '74LS283 (4-bit Adder)',
  tags: ["adder", "alu", "math"],
  renderAs: 'DIP',
  numInputs: 11,
  numOutputs: 5,
  customPins: [
    { name: 'S2', type: 'output', pinNumber: 1, schematicSide: 'right', schematicRow: 2 },
    { name: 'B2', type: 'input', pinNumber: 2, schematicSide: 'left', schematicRow: 4 },
    { name: 'A2', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 3 },
    { name: 'S1', type: 'output', pinNumber: 4, schematicSide: 'right', schematicRow: 1 },
    { name: 'A1', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 1 },
    { name: 'B1', type: 'input', pinNumber: 6, schematicSide: 'left', schematicRow: 2 },
    { name: 'C0', type: 'input', pinNumber: 7, schematicSide: 'bottom', schematicRow: 1 },
    { name: 'GND', type: 'input', pinNumber: 8 },
    { name: 'C4', type: 'output', pinNumber: 9, schematicSide: 'right', schematicRow: 5 },
    { name: 'S4', type: 'output', pinNumber: 10, schematicSide: 'right', schematicRow: 4 },
    { name: 'B4', type: 'input', pinNumber: 11, schematicSide: 'left', schematicRow: 8 },
    { name: 'A4', type: 'input', pinNumber: 12, schematicSide: 'left', schematicRow: 7 },
    { name: 'S3', type: 'output', pinNumber: 13, schematicSide: 'right', schematicRow: 3 },
    { name: 'B3', type: 'input', pinNumber: 14, schematicSide: 'left', schematicRow: 6 },
    { name: 'A3', type: 'input', pinNumber: 15, schematicSide: 'left', schematicRow: 5 },
    { name: 'VCC', type: 'input', pinNumber: 16 },
  ],
  evaluate: (inputs) => {
    const getVal = (v: import('../../models/types').Signal) => v === 1 ? 1 : 0;
    const A = [getVal(inputs[2]), getVal(inputs[1]), getVal(inputs[9]), getVal(inputs[7])];
    const B = [getVal(inputs[3]), getVal(inputs[0]), getVal(inputs[8]), getVal(inputs[6])];
    const C0 = getVal(inputs[4]);

    const valA = A[0] | (A[1] << 1) | (A[2] << 2) | (A[3] << 3);
    const valB = B[0] | (B[1] << 1) | (B[2] << 2) | (B[3] << 3);
    const sum = valA + valB + C0;

    const S1 = ((sum >> 0) & 1) as import('../../models/types').Signal;
    const S2 = ((sum >> 1) & 1) as import('../../models/types').Signal;
    const S3 = ((sum >> 2) & 1) as import('../../models/types').Signal;
    const S4 = ((sum >> 3) & 1) as import('../../models/types').Signal;
    const C4 = ((sum >> 4) & 1) as import('../../models/types').Signal;

    return [S2, S1, C4, S4, S3];
  }
};

export const IC_74LS245: NodeDefinition = {
  type: '74LS245',
  label: '74LS245 (Octal Bus Transceiver)',
  tags: ["buffer", "bus", "transceiver"],
  renderAs: 'DIP',
  numInputs: 20,
  numOutputs: 16,
  customPins: [
    { name: 'DIR', type: 'input', pinNumber: 1, schematicSide: 'bottom', schematicRow: 1 },
    { name: 'A1', type: 'bidir', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { name: 'A2', type: 'bidir', pinNumber: 3, schematicSide: 'left', schematicRow: 2 },
    { name: 'A3', type: 'bidir', pinNumber: 4, schematicSide: 'left', schematicRow: 3 },
    { name: 'A4', type: 'bidir', pinNumber: 5, schematicSide: 'left', schematicRow: 4 },
    { name: 'A5', type: 'bidir', pinNumber: 6, schematicSide: 'left', schematicRow: 5 },
    { name: 'A6', type: 'bidir', pinNumber: 7, schematicSide: 'left', schematicRow: 6 },
    { name: 'A7', type: 'bidir', pinNumber: 8, schematicSide: 'left', schematicRow: 7 },
    { name: 'A8', type: 'bidir', pinNumber: 9, schematicSide: 'left', schematicRow: 8 },
    { name: 'GND', type: 'input', pinNumber: 10 },
    { name: 'B8', type: 'bidir', pinNumber: 11, schematicSide: 'right', schematicRow: 8 },
    { name: 'B7', type: 'bidir', pinNumber: 12, schematicSide: 'right', schematicRow: 7 },
    { name: 'B6', type: 'bidir', pinNumber: 13, schematicSide: 'right', schematicRow: 6 },
    { name: 'B5', type: 'bidir', pinNumber: 14, schematicSide: 'right', schematicRow: 5 },
    { name: 'B4', type: 'bidir', pinNumber: 15, schematicSide: 'right', schematicRow: 4 },
    { name: 'B3', type: 'bidir', pinNumber: 16, schematicSide: 'right', schematicRow: 3 },
    { name: 'B2', type: 'bidir', pinNumber: 17, schematicSide: 'right', schematicRow: 2 },
    { name: 'B1', type: 'bidir', pinNumber: 18, schematicSide: 'right', schematicRow: 1 },
    { name: 'OE\'', type: 'input', pinNumber: 19, schematicSide: 'bottom', schematicRow: 2 },
    { name: 'VCC', type: 'input', pinNumber: 20 },
  ],
  evaluate: (inputs) => {
    const DIR = inputs[0] === 0 ? 0 : 1;
    const OE_n = inputs[18] === 0 ? 0 : 1;

    const outs = Array(16).fill(undefined) as import('../../models/types').Signal[];

    if (OE_n === 0) {
      if (DIR === 1) {
        outs[15] = inputs[1];
        outs[14] = inputs[2];
        outs[13] = inputs[3];
        outs[12] = inputs[4];
        outs[11] = inputs[5];
        outs[10] = inputs[6];
        outs[9]  = inputs[7];
        outs[8]  = inputs[8];
      } else {
        outs[0] = inputs[17];
        outs[1] = inputs[16];
        outs[2] = inputs[15];
        outs[3] = inputs[14];
        outs[4] = inputs[13];
        outs[5] = inputs[12];
        outs[6] = inputs[11];
        outs[7] = inputs[10];
      }
    }

    return outs;
  }
};


const createQuad2InputGate = (type: string, label: string, fn: (a: number, b: number) => Signal): NodeDefinition => ({
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
  evaluate: (inputs: any[]): Signal[] => {
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
export const IC74LS02: NodeDefinition = {
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
  evaluate: (inputs: any[]): Signal[] => {
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
    const eq = ((F === 15) ? 1 : 0) as Signal;

    // Outputs: F0(9), F1(10), F2(11), F3(13), A=B(14), P(15), Cn+4(16), G(17)
    // indices 8, 9, 10, 11 (F0-F3), 12 (A=B), 13 (P), 14 (Cn+4), 15 (G)
    return [
      (F & 1) ? 1 : 0,
      (F & 2) ? 1 : 0,
      (F & 4) ? 1 : 0,
      (F & 8) ? 1 : 0,
      eq,
      "X", // P simplified
      cout as Signal,
      "X"  // G simplified
    ] as Signal[];
  }
};


export const IC74LS541: NodeDefinition = {
  type: '74LS541',
  label: '74LS541 (Octal Buffer/Line Driver)',
  tags: ["buffer","driver","tri-state"],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: '!OE1', pinNumber: 1, schematicSide: 'bottom', schematicRow: 2 },
    { type: 'input', name: 'A1', pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'A2', pinNumber: 3, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'A3', pinNumber: 4, schematicSide: 'left', schematicRow: 3 },
    { type: 'input', name: 'A4', pinNumber: 5, schematicSide: 'left', schematicRow: 4 },
    { type: 'input', name: 'A5', pinNumber: 6, schematicSide: 'left', schematicRow: 5 },
    { type: 'input', name: 'A6', pinNumber: 7, schematicSide: 'left', schematicRow: 6 },
    { type: 'input', name: 'A7', pinNumber: 8, schematicSide: 'left', schematicRow: 7 },
    { type: 'input', name: 'A8', pinNumber: 9, schematicSide: 'left', schematicRow: 8 },
    { type: 'input', name: 'GND', pinNumber: 10 },
    { type: 'output', name: 'Y8', pinNumber: 11, schematicSide: 'right', schematicRow: 8 },
    { type: 'output', name: 'Y7', pinNumber: 12, schematicSide: 'right', schematicRow: 7 },
    { type: 'output', name: 'Y6', pinNumber: 13, schematicSide: 'right', schematicRow: 6 },
    { type: 'output', name: 'Y5', pinNumber: 14, schematicSide: 'right', schematicRow: 5 },
    { type: 'output', name: 'Y4', pinNumber: 15, schematicSide: 'right', schematicRow: 4 },
    { type: 'output', name: 'Y3', pinNumber: 16, schematicSide: 'right', schematicRow: 3 },
    { type: 'output', name: 'Y2', pinNumber: 17, schematicSide: 'right', schematicRow: 2 },
    { type: 'output', name: 'Y1', pinNumber: 18, schematicSide: 'right', schematicRow: 1 },
    { type: 'input', name: '!OE2', pinNumber: 19, schematicSide: 'bottom', schematicRow: 4 },
    { type: 'input', name: 'VCC', pinNumber: 20 },
  ],
  evaluate: (inputs): import('../../models/types').Signal[] => {
    const oe1_n = inputs[0] ?? 1;
    const oe2_n = inputs[10] ?? 1;
    
    const outs: import('../../models/types').Signal[] = Array(8).fill(undefined);
    
    if (oe1_n === 0 && oe2_n === 0) {
      outs[0] = inputs[8]; // Y8 <- A8
      outs[1] = inputs[7]; // Y7 <- A7
      outs[2] = inputs[6]; // Y6 <- A6
      outs[3] = inputs[5]; // Y5 <- A5
      outs[4] = inputs[4]; // Y4 <- A4
      outs[5] = inputs[3]; // Y3 <- A3
      outs[6] = inputs[2]; // Y2 <- A2
      outs[7] = inputs[1]; // Y1 <- A1
    }
    
    return outs;
  }
};
