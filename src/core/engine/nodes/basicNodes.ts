import { NodeDefinition } from './NodeDefinition';

export const AndNode: NodeDefinition = {
  type: 'AND',
  label: 'AND Gate',
  numInputs: 2,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    return [inputs.every(i => i === 1) ? 1 : 0];
  }
};

export const OrNode: NodeDefinition = {
  type: 'OR',
  label: 'OR Gate',
  numInputs: 2,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    return [inputs.some(i => i === 1) ? 1 : 0];
  }
};

export const NorNode: NodeDefinition = {
  type: 'NOR',
  label: 'NOR Gate',
  numInputs: 2,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    return [inputs.every(i => i === 0) ? 1 : 0];
  }
};

export const NotNode: NodeDefinition = {
  type: 'NOT',
  label: 'NOT Gate',
  numInputs: 1,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs[0] === undefined) return [undefined];
    return [inputs[0] === 1 ? 0 : 1];
  }
};

export const XorNode: NodeDefinition = {
  type: 'XOR',
  label: 'XOR Gate',
  numInputs: 2,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    // XOR is true if the inputs are different (or if an odd number of inputs are 1)
    const count = inputs.filter(i => i === 1).length;
    return [count % 2 === 1 ? 1 : 0];
  }
};

export const NandNode: NodeDefinition = {
  type: 'NAND',
  label: 'NAND Gate',
  numInputs: 2,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    return [inputs.every(i => i === 1) ? 0 : 1];
  }
};

export const XnorNode: NodeDefinition = {
  type: 'XNOR',
  label: 'XNOR Gate',
  numInputs: 2,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    const count = inputs.filter(i => i === 1).length;
    return [count % 2 === 1 ? 0 : 1];
  }
};

export const BufferNode: NodeDefinition = {
  type: 'BUFFER',
  label: 'Buffer',
  numInputs: 1,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs[0] === undefined) return [undefined];
    return [inputs[0] === 1 ? 1 : 0];
  }
};

export const SubInNode: NodeDefinition = {
  type: 'SUB_IN',
  label: 'Subcircuit Input',
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { value: 0 },
  evaluate: (_, props) => {
    return [props?._isFlattened ? undefined : (props?.value === 1 ? 1 : 0)];
  }
};

export const SubOutNode: NodeDefinition = {
  type: 'SUB_OUT',
  label: 'Subcircuit Output',
  numInputs: 1,
  numOutputs: 0,
  evaluate: (_, props) => [props?._isFlattened ? undefined : (props?.value === 1 ? 1 : 0)]
};

export const SubIoNode: NodeDefinition = {
  type: 'SUB_IO',
  label: 'Subcircuit I/O',
  numInputs: 0,
  numOutputs: 0,
  customPins: [
    { name: 'IO', type: 'bidir', schematicSide: 'right' }
  ],
  evaluate: (_, props) => [props?._isFlattened ? undefined : props?.value]
};

export const ClockNode: NodeDefinition = {
  type: 'CLOCK',
  label: '555 OSC',
  numInputs: 3,
  numOutputs: 1,
  renderAs: 'DIP',
  customPins: [
    { type: 'input', name: 'GND', pinNumber: 1 },
    { type: 'output', name: 'OUT', pinNumber: 3 }, // 555 OUT pin
    { type: 'input', name: 'EN', pinNumber: 4 }, // Acting like RESET on a 555
    { type: 'input', name: 'VCC', pinNumber: 8 },
  ],
  defaultProperties: { highTicks: 5, lowTicks: 5, label: '555 CLK' },
  evaluate: (inputs, props, tickCount) => {
    // Legacy nodes have 1 input (EN). New nodes have 3 (GND, EN, VCC).
    const isLegacy = inputs.length === 1;
    const en = isLegacy ? (inputs[0] ?? 1) : (inputs[1] ?? 1);
    
    if (en === 0) {
      return [0];
    }

    const highTicks = props?.highTicks ?? props?.interval ?? 5; // fallback to interval for backwards compatibility
    const lowTicks = props?.lowTicks ?? props?.interval ?? 5;
    
    const cycleLength = highTicks + lowTicks;
    if (cycleLength <= 0) return [0]; // safeguard

    const currentTick = (tickCount ?? 0) % cycleLength;
    const val = currentTick < highTicks ? 1 : 0;
    
    return [val];
  }
};

export const VccNode: NodeDefinition = {
  type: 'VCC',
  label: 'Power (VCC)',
  numInputs: 0,
  numOutputs: 1,
  evaluate: () => [1] // Always outputs 1
};

export const GndNode: NodeDefinition = {
  type: 'GND',
  label: 'Ground (GND)',
  numInputs: 0,
  numOutputs: 1,
  evaluate: () => [0] // Always outputs 0
};

export const JunctionNode: NodeDefinition = {
  type: 'JUNCTION',
  label: 'Junction',
  numInputs: 1,
  numOutputs: 1,
  evaluate: () => [undefined] // Evaluated purely via net union, should not drive on its own!
};

export const DipSwitchNode: NodeDefinition = {
  type: 'DIP_SWITCH',
  label: 'DIP Switch',
  numInputs: 0,
  numOutputs: 4,
  defaultProperties: { switches: [0, 0, 0, 0] },
  evaluate: (_, props) => {
    const numOutputs = props?.numOutputs || 4;
    const switches = props?.switches || Array(numOutputs).fill(0);
    return Array.from({ length: numOutputs }, (_, i) => (switches[i] === 1 ? 1 : 0));
  }
};

export const SevenSegNode: NodeDefinition = {
  type: '7_SEG_DISPLAY',
  label: '7-Segment Display',
  numInputs: 8,
  numOutputs: 0,
  customPins: [
    { type: 'input', name: 'A', pinNumber: 1 },
    { type: 'input', name: 'B', pinNumber: 2 },
    { type: 'input', name: 'C', pinNumber: 3 },
    { type: 'input', name: 'D', pinNumber: 4 },
    { type: 'input', name: 'E', pinNumber: 5 },
    { type: 'input', name: 'F', pinNumber: 6 },
    { type: 'input', name: 'G', pinNumber: 7 },
    { type: 'input', name: 'DP', pinNumber: 8 }
  ],
  evaluate: () => []
};

export const NetLabelNode: NodeDefinition = {
  type: 'NET_LABEL',
  label: 'Net Label',
  numInputs: 1, // Will be mapped to a bidir pin
  numOutputs: 1,
  customPins: [
    { name: 'NET', type: 'bidir', pinNumber: 1, schematicSide: 'right', schematicRow: 1 }
  ],
  evaluate: () => [undefined],
};

export const BusBreakoutNode: NodeDefinition = {
  type: 'BUS_BREAKOUT',
  label: 'Bus Breakout',
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'BUS',
  defaultProperties: { label: 'DB[7..0]', bits: 8 },
  generatePins: (props) => {
    let bits = props?.bits;
    if (typeof bits !== 'number' || bits < 1) bits = 8;
    
    // Check if label contains [7..0] or similar to extract bits dynamically if we want,
    // but the user wants to be able to change bits. We can let them change `bits` property.
    // Or we parse it from label. "DB[3..0]" -> bits = 4.
    const match = String(props?.label || '').match(/\[(\d+)\.\.(\d+)\]/);
    if (match) {
      const high = parseInt(match[1], 10);
      const low = parseInt(match[2], 10);
      bits = Math.abs(high - low) + 1;
    }

    const pins: any[] = [];
    for (let i = 0; i < bits; i++) {
      pins.push({ name: String(i), type: 'bidir', schematicSide: 'left', schematicRow: i + 1 });
    }
    pins.push({ name: 'BUS', type: 'bidir', schematicSide: 'right', schematicRow: Math.max(1, Math.round((bits + 1) / 2)) });
    return pins;
  },
  evaluate: (inputs) => inputs.map(() => undefined)
};


export const PushButtonNode: NodeDefinition = {
  type: 'BUTTON',
  label: 'Push Button',
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { pressed: false },
  evaluate: (_, props) => [props?.pressed ? 1 : 0]
};

export const LedBarNode: NodeDefinition = {
  type: 'LED_BAR',
  label: 'LED Bar (8-bit)',
  numInputs: 8,
  numOutputs: 0,
  evaluate: () => []
};
