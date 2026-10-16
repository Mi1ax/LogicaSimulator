import { SubcircuitRegistry } from '../subcircuitRegistry';
import { NodeDefinition } from './NodeDefinition';
import {
  AndNode, OrNode, NotNode, XorNode,
  NorNode, NandNode, XnorNode, BufferNode, NcNode,
  InputNode, OutputNode,
  SubInNode, SubOutNode, SubIoNode, ClockNode,
  VccNode, GndNode, PullUpNode, PullDownNode, JunctionNode,
  DipSwitchNode, SevenSegNode, NetLabelNode, BusBreakoutNode, PushButtonNode, LedBarNode, KeypadNode,
  RegionBoxNode, TextLabelNode, StickyNoteNode
} from './basicNodes';
import {
  IC74LS00, IC74LS02, IC74LS04, IC74LS08, IC74LS30, IC74LS32, IC74LS86,
  IC74LS47, IC74LS138, IC74LS139, IC74LS154,
  IC_NE555, IC74LS161, IC74LS191,
  IC_74LS283, IC74LS181,
  IC74LS173, IC74LS175, IC74LS241, IC74LS244, IC_74LS245, IC74LS273, IC74LS373, IC74LS374, IC74LS541,
  ROM_27C256, IC6116, SRAM_62256,
  IC_GAL22V10
} from './ics';

export const ALL_BUILTIN_NODES: NodeDefinition[] = [
  // Power & I/O: Sources & Clock
  VccNode,
  GndNode,
  PullUpNode,
  PullDownNode,
  ClockNode,

  // Power & I/O: Inputs & Switches
  InputNode,
  PushButtonNode,
  DipSwitchNode,
  KeypadNode,

  // Power & I/O: Outputs & Displays
  OutputNode,
  LedBarNode,
  SevenSegNode,

  // Power & I/O: Wiring & Labels
  NetLabelNode,
  BusBreakoutNode,
  NcNode,

  // Annotations
  RegionBoxNode,
  TextLabelNode,
  StickyNoteNode,

  // Basic Logic
  AndNode,
  NandNode,
  OrNode,
  NorNode,
  XorNode,
  XnorNode,
  NotNode,
  BufferNode,

  // Internal / Subcircuit
  SubInNode,
  SubOutNode,
  SubIoNode,
  JunctionNode,

  // Integrated Circuits: Logic Gates
  IC74LS00,
  IC74LS02,
  IC74LS04,
  IC74LS08,
  IC74LS30,
  IC74LS32,
  IC74LS86,

  // Integrated Circuits: Decoders & Multiplexers
  IC74LS47,
  IC74LS138,
  IC74LS139,
  IC74LS154,

  // Integrated Circuits: Counters & Timers
  IC_NE555,
  IC74LS161,
  IC74LS191,

  // Integrated Circuits: Arithmetic & ALU
  IC_74LS283,
  IC74LS181,

  // Integrated Circuits: Registers & Buffers
  IC74LS173,
  IC74LS175,
  IC74LS241,
  IC74LS244,
  IC_74LS245,
  IC74LS273,
  IC74LS373,
  IC74LS374,
  IC74LS541,

  // Integrated Circuits: Memory
  ROM_27C256,
  IC6116,
  SRAM_62256,

  // Integrated Circuits: Programmable Logic
  IC_GAL22V10,
];

// The central registry for all available nodes in the simulator
export const NodeRegistry: Record<string, NodeDefinition> = Object.fromEntries(
  ALL_BUILTIN_NODES.map(def => [def.type, def])
);

export const getNodeDefinition = (type: string): NodeDefinition | undefined => {
  if (type.startsWith('SUBCIRCUIT:')) return SubcircuitRegistry[type];
  return NodeRegistry[type];
};
