import { NodeDefinition, PinDefinition } from './NodeDefinition';
import { getBusBreakoutBitCount } from '../../utils/schematicLayout';

export const AndNode: NodeDefinition = {
  type: 'AND',
  label: 'AND Gate',
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
};

export const OrNode: NodeDefinition = {
  type: 'OR',
  label: 'OR Gate',
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
};

export const NorNode: NodeDefinition = {
  type: 'NOR',
  label: 'NOR Gate',
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
};

export const NotNode: NodeDefinition = {
  type: 'NOT',
  label: 'NOT Gate',
  category: 'Basic Logic',
  numInputs: 1,
  numOutputs: 1,
};

export const XorNode: NodeDefinition = {
  type: 'XOR',
  label: 'XOR Gate',
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
};

export const NandNode: NodeDefinition = {
  type: 'NAND',
  label: 'NAND Gate',
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
};

export const XnorNode: NodeDefinition = {
  type: 'XNOR',
  label: 'XNOR Gate',
  category: 'Basic Logic',
  numInputs: 2,
  numOutputs: 1,
  variableInputs: { min: 2, max: 8 },
};

export const BufferNode: NodeDefinition = {
  type: 'BUFFER',
  label: 'Buffer',
  category: 'Basic Logic',
  numInputs: 1,
  numOutputs: 1,
};

export const NcNode: NodeDefinition = {
  type: 'NC',
  label: 'No Connect (X)',
  category: 'Power & I/O/Wiring & Labels',
  tags: ['nc', 'no connect', 'unused', 'pin'],
  numInputs: 1,
  numOutputs: 0,
  disableTransform: true,
};

export const InputNode: NodeDefinition = {
  type: 'INPUT',
  label: 'Input Switch',
  category: 'Power & I/O/Inputs & Switches',
  tags: ['input', 'switch', 'toggle', 'bit'],
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { value: 0 },
};

export const OutputNode: NodeDefinition = {
  type: 'OUTPUT',
  label: 'Output LED',
  category: 'Power & I/O/Outputs & Displays',
  tags: ['output', 'led', 'light', 'indicator'],
  numInputs: 1,
  numOutputs: 0,
};

export const SubInNode: NodeDefinition = {
  type: 'SUB_IN',
  label: 'Subcircuit Input',
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { value: 0 },
};

export const SubOutNode: NodeDefinition = {
  type: 'SUB_OUT',
  label: 'Subcircuit Output',
  numInputs: 1,
  numOutputs: 0,
};

export const SubIoNode: NodeDefinition = {
  type: 'SUB_IO',
  label: 'Subcircuit I/O',
  numInputs: 0,
  numOutputs: 0,
  customPins: [
    { name: 'IO', type: 'bidir', schematicSide: 'right' }
  ],
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
};

export const VccNode: NodeDefinition = {
  type: 'VCC',
  label: 'Power (VCC)',
  category: 'Power & I/O/Sources & Clock',
  tags: ['vcc', 'power', '5v', 'high', '1'],
  numInputs: 0,
  numOutputs: 1,
};

export const GndNode: NodeDefinition = {
  type: 'GND',
  label: 'Ground (GND)',
  category: 'Power & I/O/Sources & Clock',
  tags: ['gnd', 'ground', '0v', 'low', '0'],
  numInputs: 0,
  numOutputs: 1,
};

export const PullUpNode: NodeDefinition = {
  type: 'PULL_UP',
  label: 'Pull-Up Resistor',
  category: 'Power & I/O/Sources & Clock',
  tags: ['pullup', 'pull-up', 'resistor', 'weak', 'vcc', 'high', '1'],
  numInputs: 0,
  numOutputs: 1,
};

export const PullDownNode: NodeDefinition = {
  type: 'PULL_DOWN',
  label: 'Pull-Down Resistor',
  category: 'Power & I/O/Sources & Clock',
  tags: ['pulldown', 'pull-down', 'resistor', 'weak', 'gnd', 'low', '0'],
  numInputs: 0,
  numOutputs: 1,
};

export const JunctionNode: NodeDefinition = {
  type: 'JUNCTION',
  label: 'Junction',
  numInputs: 1,
  numOutputs: 1,
  disableTransform: true,
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
};

export const NetLabelNode: NodeDefinition = {
  type: 'NET_LABEL',
  label: 'Net Label',
  category: 'Power & I/O/Wiring & Labels',
  tags: ['net', 'label', 'tunnel', 'wire', 'name'],
  numInputs: 1,
  numOutputs: 1,
  customPins: [
    { name: 'NET', type: 'bidir', pinNumber: 1, schematicSide: 'right', schematicRow: 1 }
  ],
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
    const bits = getBusBreakoutBitCount(props);
    const pins: PinDefinition[] = new Array(bits + 1);
    for (let i = 0; i < bits; i++) {
      pins[i] = { name: String(i), type: 'bidir', schematicSide: 'left', schematicRow: i + 1 };
    }
    pins[bits] = {
      name: 'BUS',
      type: 'bidir',
      schematicSide: 'right',
      schematicRow: Math.max(1, Math.round((bits + 1) / 2)),
    };
    return pins;
  },
};

export const PushButtonNode: NodeDefinition = {
  type: 'BUTTON',
  label: 'Push Button',
  category: 'Power & I/O/Inputs & Switches',
  tags: ['button', 'push', 'momentary', 'reset', 'input'],
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { pressed: false, activeLow: false },
};

export const LedBarNode: NodeDefinition = {
  type: 'LED_BAR',
  label: 'LED Bar (8-bit)',
  category: 'Power & I/O/Outputs & Displays',
  tags: ['led', 'bar', 'array', 'light', 'output'],
  numInputs: 8,
  numOutputs: 0,
  variableInputs: { min: 1, max: 32, label: 'Number of LEDs' },
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
};

export const FsmDiagramNode: NodeDefinition = {
  type: 'FSM_DIAGRAM',
  label: 'FSM State Machine',
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
};
