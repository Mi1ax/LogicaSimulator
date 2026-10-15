import { NodeDefinition } from './NodeDefinition';

export const AndNode: NodeDefinition = {
  type: 'AND',
  label: 'AND Gate',
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    return [inputs.every(i => i === 1) ? 1 : 0];
  }
};

export const OrNode: NodeDefinition = {
  type: 'OR',
  label: 'OR Gate',
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    return [inputs.some(i => i === 1) ? 1 : 0];
  }
};

export const NorNode: NodeDefinition = {
  type: 'NOR',
  label: 'NOR Gate',
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    return [inputs.every(i => i === 0) ? 1 : 0];
  }
};

export const NotNode: NodeDefinition = {
  type: 'NOT',
  label: 'NOT Gate',
  category: 'Basic Logic',
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
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
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
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    return [inputs.every(i => i === 1) ? 0 : 1];
  }
};

export const XnorNode: NodeDefinition = {
  type: 'XNOR',
  label: 'XNOR Gate',
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    const count = inputs.filter(i => i === 1).length;
    return [count % 2 === 1 ? 0 : 1];
  }
};

export const BufferNode: NodeDefinition = {
  type: 'BUFFER',
  label: 'Buffer',
  category: 'Basic Logic',
  numInputs: 1,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs[0] === undefined) return [undefined];
    return [inputs[0] === 1 ? 1 : 0];
  }
};

export const NcNode: NodeDefinition = {
  type: 'NC',
  label: 'No Connect (X)',
  category: 'Power & I/O/Wiring & Labels',
  tags: ['nc', 'no connect', 'unused', 'pin'],
  numInputs: 1,
  numOutputs: 0,
  disableTransform: true,
  evaluate: () => []
};

export const InputNode: NodeDefinition = {
  type: 'INPUT',
  label: 'Input Switch',
  category: 'Power & I/O/Inputs & Switches',
  tags: ['input', 'switch', 'toggle', 'bit'],
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { value: 0 },
  evaluate: (_, props) => [props?.value === 1 ? 1 : 0]
};

export const OutputNode: NodeDefinition = {
  type: 'OUTPUT',
  label: 'Output LED',
  category: 'Power & I/O/Outputs & Displays',
  tags: ['output', 'led', 'light', 'indicator'],
  numInputs: 1,
  numOutputs: 0,
  evaluate: () => []
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
  label: 'Clock Generator',
  category: 'Power & I/O/Sources & Clock',
  tags: ['clock', 'oscillator', '555', 'timer', 'pulse', 'clk'],
  numInputs: 0,
  numOutputs: 1,
  customPins: [
    { type: 'output', name: 'OUT', pinNumber: 3 },
  ],
  defaultProperties: { highTicks: 5, lowTicks: 5, mode: 'auto', manualValue: 0, startHigh: true, label: 'CLK' },
  evaluate: (inputs, props, tickCount) => {
    // Support legacy saved nodes that had an EN input
    if (inputs.length > 0) {
      const en = inputs.length === 1 ? (inputs[0] ?? 1) : (inputs[1] ?? 1);
      if (en === 0) return [0];
    }

    if (props?.mode === 'manual') {
      return [props?.manualValue === 1 ? 1 : 0];
    }

    const highTicks = Math.max(1, props?.highTicks ?? props?.interval ?? 5);
    const lowTicks = Math.max(1, props?.lowTicks ?? props?.interval ?? 5);
    const cycleLength = highTicks + lowTicks;
    if (cycleLength <= 0) return [0];

    const currentTick = (tickCount ?? 0) % cycleLength;
    const startHigh = props?.startHigh !== false;
    const val = startHigh
      ? (currentTick < highTicks ? 1 : 0)
      : (currentTick < lowTicks ? 0 : 1);

    return [val];
  }
};

export const VccNode: NodeDefinition = {
  type: 'VCC',
  label: 'Power (VCC)',
  category: 'Power & I/O/Sources & Clock',
  tags: ['vcc', 'power', '5v', 'high', '1'],
  numInputs: 0,
  numOutputs: 1,
  evaluate: () => [1] // Always outputs 1
};

export const GndNode: NodeDefinition = {
  type: 'GND',
  label: 'Ground (GND)',
  category: 'Power & I/O/Sources & Clock',
  tags: ['gnd', 'ground', '0v', 'low', '0'],
  numInputs: 0,
  numOutputs: 1,
  evaluate: () => [0] // Always outputs 0
};

export const PullUpNode: NodeDefinition = {
  type: 'PULL_UP',
  label: 'Pull-Up Resistor',
  category: 'Power & I/O/Sources & Clock',
  tags: ['pullup', 'pull-up', 'resistor', 'weak', 'vcc', 'high', '1'],
  numInputs: 0,
  numOutputs: 1,
  evaluate: () => [1] // Weak 1 (overridden by any strong 0/1 driver on the net)
};

export const PullDownNode: NodeDefinition = {
  type: 'PULL_DOWN',
  label: 'Pull-Down Resistor',
  category: 'Power & I/O/Sources & Clock',
  tags: ['pulldown', 'pull-down', 'resistor', 'weak', 'gnd', 'low', '0'],
  numInputs: 0,
  numOutputs: 1,
  evaluate: () => [0] // Weak 0 (overridden by any strong 0/1 driver on the net)
};

export const JunctionNode: NodeDefinition = {
  type: 'JUNCTION',
  label: 'Junction',
  numInputs: 1,
  numOutputs: 1,
  disableTransform: true,
  evaluate: () => [undefined] // Evaluated purely via net union, should not drive on its own!
};

export const DipSwitchNode: NodeDefinition = {
  type: 'DIP_SWITCH',
  label: 'DIP Switch',
  category: 'Power & I/O/Inputs & Switches',
  tags: ['dip', 'switch', 'input', 'multi'],
  numInputs: 0,
  numOutputs: 4,
  variableOutputs: { min: 1, max: 12, label: 'Number of Outputs (Switches)' },
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
  category: 'Power & I/O/Outputs & Displays',
  tags: ['7seg', 'display', 'seven segment', 'hex', 'digit'],
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
  category: 'Power & I/O/Wiring & Labels',
  tags: ['net', 'label', 'tunnel', 'wire', 'name'],
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
  category: 'Power & I/O/Wiring & Labels',
  tags: ['bus', 'breakout', 'splitter', 'bundle'],
  numInputs: 0,
  numOutputs: 0,
  renderAs: 'BUS',
  defaultProperties: { label: 'DB[7..0]', bits: 8 },
  generatePins: (props) => {
    let bits = props?.bits;
    if (typeof bits !== 'number' || bits < 1) bits = 8;
    
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
  category: 'Power & I/O/Inputs & Switches',
  tags: ['button', 'push', 'momentary', 'reset', 'input'],
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { pressed: false, activeLow: false },
  evaluate: (_, props) => {
    const isPressed = props?.pressed;
    const isActiveLow = props?.activeLow;
    return [isActiveLow ? (isPressed ? 0 : 1) : (isPressed ? 1 : 0)];
  }
};

export const LedBarNode: NodeDefinition = {
  type: 'LED_BAR',
  label: 'LED Bar (8-bit)',
  category: 'Power & I/O/Outputs & Displays',
  tags: ['led', 'bar', 'array', 'light', 'output'],
  numInputs: 8,
  numOutputs: 0,
  variableInputs: { min: 1, max: 32, label: 'Number of LEDs' },
  evaluate: () => []
};

export const KeypadNode: NodeDefinition = {
  type: 'KEYPAD',
  label: 'Matrix Keypad (4x3)',
  category: 'Power & I/O/Inputs & Switches',
  tags: ['keypad', 'matrix', 'keyboard', 'buttons', 'input', '4x3'],
  numInputs: 0,
  numOutputs: 0,
  customPins: [
    { name: 'R1', type: 'bidir', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { name: 'R2', type: 'bidir', pinNumber: 2, schematicSide: 'left', schematicRow: 2 },
    { name: 'R3', type: 'bidir', pinNumber: 3, schematicSide: 'left', schematicRow: 3 },
    { name: 'R4', type: 'bidir', pinNumber: 4, schematicSide: 'left', schematicRow: 4 },
    { name: 'C1', type: 'bidir', pinNumber: 5, schematicSide: 'top', schematicRow: 1 },
    { name: 'C2', type: 'bidir', pinNumber: 6, schematicSide: 'top', schematicRow: 2 },
    { name: 'C3', type: 'bidir', pinNumber: 7, schematicSide: 'top', schematicRow: 3 },
  ],
  defaultProperties: { pressedKey: null, latched: false },
  evaluate: () => Array(7).fill(undefined),
};


