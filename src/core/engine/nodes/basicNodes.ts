import { NodeDefinition } from './NodeDefinition';
import { Signal } from '../../models/types';

const OUT_0: Signal[] = [0];
const OUT_1: Signal[] = [1];
const OUT_U: Signal[] = [undefined];
const OUT_EMPTY: Signal[] = [];

export const AndNode: NodeDefinition = {
  type: 'AND',
  label: 'AND Gate',
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
  evaluate: (inputs) => {
    let allOne = true;
    for (let i = 0; i < inputs.length; i++) {
      const v = inputs[i];
      if (v === undefined) return OUT_U;
      if (v !== 1) allOne = false;
    }
    return allOne ? OUT_1 : OUT_0;
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
    let hasOne = false;
    for (let i = 0; i < inputs.length; i++) {
      const v = inputs[i];
      if (v === undefined) return OUT_U;
      if (v === 1) hasOne = true;
    }
    return hasOne ? OUT_1 : OUT_0;
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
    let allZero = true;
    for (let i = 0; i < inputs.length; i++) {
      const v = inputs[i];
      if (v === undefined) return OUT_U;
      if (v !== 0) allZero = false;
    }
    return allZero ? OUT_1 : OUT_0;
  }
};

export const NotNode: NodeDefinition = {
  type: 'NOT',
  label: 'NOT Gate',
  category: 'Basic Logic',
  numInputs: 1,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs[0] === undefined) return OUT_U;
    return inputs[0] === 1 ? OUT_0 : OUT_1;
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
    let count = 0;
    for (let i = 0; i < inputs.length; i++) {
      const v = inputs[i];
      if (v === undefined) return OUT_U;
      if (v === 1) count++;
    }
    return (count & 1) === 1 ? OUT_1 : OUT_0;
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
    let allOne = true;
    for (let i = 0; i < inputs.length; i++) {
      const v = inputs[i];
      if (v === undefined) return OUT_U;
      if (v !== 1) allOne = false;
    }
    return allOne ? OUT_0 : OUT_1;
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
    let count = 0;
    for (let i = 0; i < inputs.length; i++) {
      const v = inputs[i];
      if (v === undefined) return OUT_U;
      if (v === 1) count++;
    }
    return (count & 1) === 1 ? OUT_0 : OUT_1;
  }
};

export const BufferNode: NodeDefinition = {
  type: 'BUFFER',
  label: 'Buffer',
  category: 'Basic Logic',
  numInputs: 1,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs[0] === undefined) return OUT_U;
    return inputs[0] === 1 ? OUT_1 : OUT_0;
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
  evaluate: () => OUT_EMPTY
};

export const InputNode: NodeDefinition = {
  type: 'INPUT',
  label: 'Input Switch',
  category: 'Power & I/O/Inputs & Switches',
  tags: ['input', 'switch', 'toggle', 'bit'],
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { value: 0 },
  evaluate: (_, props) => (props?.value === 1 ? OUT_1 : OUT_0)
};

export const OutputNode: NodeDefinition = {
  type: 'OUTPUT',
  label: 'Output LED',
  category: 'Power & I/O/Outputs & Displays',
  tags: ['output', 'led', 'light', 'indicator'],
  numInputs: 1,
  numOutputs: 0,
  evaluate: () => OUT_EMPTY
};

export const SubInNode: NodeDefinition = {
  type: 'SUB_IN',
  label: 'Subcircuit Input',
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { value: 0 },
  evaluate: (_, props) => {
    return props?._isFlattened ? OUT_U : (props?.value === 1 ? OUT_1 : OUT_0);
  }
};

export const SubOutNode: NodeDefinition = {
  type: 'SUB_OUT',
  label: 'Subcircuit Output',
  numInputs: 1,
  numOutputs: 0,
  evaluate: (_, props) => (props?._isFlattened ? OUT_U : (props?.value === 1 ? OUT_1 : OUT_0))
};

export const SubIoNode: NodeDefinition = {
  type: 'SUB_IO',
  label: 'Subcircuit I/O',
  numInputs: 0,
  numOutputs: 0,
  customPins: [
    { name: 'IO', type: 'bidir', schematicSide: 'right' }
  ],
  evaluate: (_, props) => (props?._isFlattened ? OUT_U : [props?.value])
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
      if (en === 0) return OUT_0;
    }

    if (props?.mode === 'manual') {
      return props?.manualValue === 1 ? OUT_1 : OUT_0;
    }

    const highTicks = Math.max(1, props?.highTicks ?? props?.interval ?? 5);
    const lowTicks = Math.max(1, props?.lowTicks ?? props?.interval ?? 5);
    const cycleLength = highTicks + lowTicks;
    if (cycleLength <= 0) return OUT_0;

    const currentTick = (tickCount ?? 0) % cycleLength;
    const startHigh = props?.startHigh !== false;
    const val = startHigh
      ? (currentTick < highTicks ? 1 : 0)
      : (currentTick < lowTicks ? 0 : 1);

    return val === 1 ? OUT_1 : OUT_0;
  }
};

export const VccNode: NodeDefinition = {
  type: 'VCC',
  label: 'Power (VCC)',
  category: 'Power & I/O/Sources & Clock',
  tags: ['vcc', 'power', '5v', 'high', '1'],
  numInputs: 0,
  numOutputs: 1,
  evaluate: () => OUT_1 // Always outputs 1
};

export const GndNode: NodeDefinition = {
  type: 'GND',
  label: 'Ground (GND)',
  category: 'Power & I/O/Sources & Clock',
  tags: ['gnd', 'ground', '0v', 'low', '0'],
  numInputs: 0,
  numOutputs: 1,
  evaluate: () => OUT_0 // Always outputs 0
};

export const PullUpNode: NodeDefinition = {
  type: 'PULL_UP',
  label: 'Pull-Up Resistor',
  category: 'Power & I/O/Sources & Clock',
  tags: ['pullup', 'pull-up', 'resistor', 'weak', 'vcc', 'high', '1'],
  numInputs: 0,
  numOutputs: 1,
  evaluate: () => OUT_1 // Weak 1 (overridden by any strong 0/1 driver on the net)
};

export const PullDownNode: NodeDefinition = {
  type: 'PULL_DOWN',
  label: 'Pull-Down Resistor',
  category: 'Power & I/O/Sources & Clock',
  tags: ['pulldown', 'pull-down', 'resistor', 'weak', 'gnd', 'low', '0'],
  numInputs: 0,
  numOutputs: 1,
  evaluate: () => OUT_0 // Weak 0 (overridden by any strong 0/1 driver on the net)
};

export const JunctionNode: NodeDefinition = {
  type: 'JUNCTION',
  label: 'Junction',
  numInputs: 1,
  numOutputs: 1,
  disableTransform: true,
  evaluate: () => OUT_U // Evaluated purely via net union, should not drive on its own!
};

const OUT_U7: Signal[] = [undefined, undefined, undefined, undefined, undefined, undefined, undefined];

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
    const switches = props?.switches;
    const out = new Array<Signal>(numOutputs);
    for (let i = 0; i < numOutputs; i++) {
      out[i] = switches?.[i] === 1 ? 1 : 0;
    }
    return out;
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
  evaluate: () => OUT_EMPTY
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
  evaluate: () => OUT_U,
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
  evaluate: (inputs) => new Array(inputs.length)
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
    return isActiveLow ? (isPressed ? OUT_0 : OUT_1) : (isPressed ? OUT_1 : OUT_0);
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
  evaluate: () => OUT_EMPTY
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
  evaluate: () => OUT_U7,
};

export const RegionBoxNode: NodeDefinition = {
  type: 'REGION_BOX',
  label: 'Region / Group Box',
  category: 'Annotations',
  tags: ['region', 'box', 'frame', 'group', 'area', 'border', 'highlight', 'annotation'],
  numInputs: 0,
  numOutputs: 0,
  disableTransform: true,
  defaultProperties: {
    label: 'Block Title',
    width: 240,
    height: 160,
    color: 'blue',
    borderStyle: 'dashed',
    fillOpacity: 0.08,
  },
  evaluate: () => OUT_EMPTY,
};

export const TextLabelNode: NodeDefinition = {
  type: 'TEXT_LABEL',
  label: 'Text / Heading',
  category: 'Annotations',
  tags: ['text', 'heading', 'title', 'label', 'comment', 'annotation'],
  numInputs: 0,
  numOutputs: 0,
  disableTransform: false,
  defaultProperties: {
    label: 'Heading Text',
    fontSize: 20,
    color: 'default',
    bold: true,
    italic: false,
    fontFamily: 'sans',
    align: 'left',
  },
  evaluate: () => OUT_EMPTY,
};

export const StickyNoteNode: NodeDefinition = {
  type: 'STICKY_NOTE',
  label: 'Sticky Note / Card',
  category: 'Annotations',
  tags: ['note', 'sticky', 'card', 'comment', 'documentation', 'table', 'annotation'],
  numInputs: 0,
  numOutputs: 0,
  disableTransform: true,
  defaultProperties: {
    label: 'Note',
    text: 'Write notes, truth tables, or pin descriptions here...',
    width: 220,
    height: 140,
    color: 'amber',
    fontSize: 12,
    fontFamily: 'sans',
  },
  evaluate: () => OUT_EMPTY,
};

export const FsmDiagramNode: NodeDefinition = {
  type: 'FSM_DIAGRAM',
  label: 'FSM State Diagram',
  category: 'Annotations',
  tags: ['fsm', 'state', 'machine', 'diagram', 'uml', 'chart', 'gal', 'pld', 'annotation'],
  numInputs: 0,
  numOutputs: 0,
  disableTransform: true,
  defaultProperties: {
    label: 'FSM State Machine',
    width: 640,
    height: 440,
    color: 'slate',
    targetNodeId: '',
  },
  evaluate: () => OUT_EMPTY,
};

