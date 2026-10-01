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
