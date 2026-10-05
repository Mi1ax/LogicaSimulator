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
