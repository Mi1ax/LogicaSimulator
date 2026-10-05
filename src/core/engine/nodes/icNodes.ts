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
  defaultProperties: { counter: 0, lastClk: 0 },
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
  evaluate: (inputs, props) => {
    // Inputs:
    // 0: ~CLR, 1: CLK, 2: A, 3: B, 4: C, 5: D, 6: ENP, 7: GND, 8: ~LOAD, 9: ENT, 10: VCC
    const [clrN, clk, a, b, c, d, enp, , loadN, ent] = inputs;
    
    if (!props) return [undefined, undefined, undefined, undefined, undefined];
    
    if (props.counter === undefined) props.counter = 0;
    if (props.lastClk === undefined) props.lastClk = 0;

    // Apply User-Friendly Simulator Defaults for floating pins
    const safeClrN = clrN ?? 1;   // Default 1: Don't clear
    const safeLoadN = loadN ?? 1; // Default 1: Don't load
    const safeEnp = enp ?? 1;     // Default 1: Enable counting
    const safeEnt = ent ?? 1;     // Default 1: Enable counting
    
    // Async clear (active low)
    if (safeClrN === 0) {
      props.counter = 0;
    } 
    // Synchronous operations on rising edge
    else if (clk === 1 && props.lastClk === 0) {
      // Synchronous load (active low)
      if (safeLoadN === 0) {
        // Parallel data defaults to 0 if floating
        props.counter = ((d === 1 ? 1 : 0) << 3) | ((c === 1 ? 1 : 0) << 2) | ((b === 1 ? 1 : 0) << 1) | ((a === 1 ? 1 : 0));
      } 
      // Count enable (both ENP and ENT must be high to count)
      else if (safeEnp === 1 && safeEnt === 1) {
        props.counter = (props.counter + 1) % 16;
      }
    }
    
    props.lastClk = clk || 0;
    
    // Outputs:
    // 0: QD, 1: QC, 2: QB, 3: QA, 4: RCO
    const qa = (props.counter & 1) ? 1 : 0;
    const qb = (props.counter & 2) ? 1 : 0;
    const qc = (props.counter & 4) ? 1 : 0;
    const qd = (props.counter & 8) ? 1 : 0;
    
    // Ripple Carry Output (high when counter is 15 and ENT is high)
    const rco = (props.counter === 15 && safeEnt === 1) ? 1 : 0;
    
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
  defaultProperties: { state: 0, lastClk: 0 },
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
  evaluate: (inputs, props) => {
    // Inputs (12):
    // 0: ~MR, 1: D0, 2: D1, 3: D2, 4: D3, 5: GND, 6: CP, 7: D4, 8: D5, 9: D6, 10: D7, 11: VCC
    const [mrN, d0, d1, d2, d3, , cp, d4, d5, d6, d7] = inputs;
    
    if (!props) return Array(8).fill(undefined);
    
    if (props.state === undefined) props.state = 0;
    if (props.lastClk === undefined) props.lastClk = 0;

    const safeMrN = mrN ?? 1; // Default 1: Don't reset
    
    // Async reset (active low)
    if (safeMrN === 0) {
      props.state = 0;
    } 
    // Synchronous operations on rising edge
    else if (cp === 1 && props.lastClk === 0) {
      const bit0 = d0 === 1 ? 1 : 0;
      const bit1 = d1 === 1 ? 1 : 0;
      const bit2 = d2 === 1 ? 1 : 0;
      const bit3 = d3 === 1 ? 1 : 0;
      const bit4 = d4 === 1 ? 1 : 0;
      const bit5 = d5 === 1 ? 1 : 0;
      const bit6 = d6 === 1 ? 1 : 0;
      const bit7 = d7 === 1 ? 1 : 0;
      
      props.state = (bit7 << 7) | (bit6 << 6) | (bit5 << 5) | (bit4 << 4) | (bit3 << 3) | (bit2 << 2) | (bit1 << 1) | bit0;
    }
    
    props.lastClk = cp || 0;
    
    // Outputs (8):
    // 0: Q0, 1: Q1, 2: Q2, 3: Q3, 4: Q4, 5: Q5, 6: Q6, 7: Q7
    const q0 = (props.state & (1 << 0)) ? 1 : 0;
    const q1 = (props.state & (1 << 1)) ? 1 : 0;
    const q2 = (props.state & (1 << 2)) ? 1 : 0;
    const q3 = (props.state & (1 << 3)) ? 1 : 0;
    const q4 = (props.state & (1 << 4)) ? 1 : 0;
    const q5 = (props.state & (1 << 5)) ? 1 : 0;
    const q6 = (props.state & (1 << 6)) ? 1 : 0;
    const q7 = (props.state & (1 << 7)) ? 1 : 0;
    
    return [q0, q1, q2, q3, q4, q5, q6, q7];
  }
};
