import { SubcircuitRegistry } from '../subcircuitRegistry';
import { NodeDefinition } from './NodeDefinition';
import {
  AndNode, OrNode, NotNode, XorNode,
  NorNode, NandNode, XnorNode, BufferNode,
  SubInNode, SubOutNode, SubIoNode, ClockNode,
  VccNode, GndNode, JunctionNode,
  DipSwitchNode, SevenSegNode, NetLabelNode, BusBreakoutNode, PushButtonNode, LedBarNode
} from './basicNodes';
import { IC74LS00, IC74LS02, IC74LS04, IC74LS32, IC74LS86, IC74LS173, IC74LS181, IC74LS08, IC74LS47, IC74LS138, IC74LS154, IC74LS241, IC74LS244, IC74LS161, IC74LS191, IC74LS273, ROM_27C256, SRAM_62256, IC_74LS283, IC_74LS245, IC74LS541 } from './icNodes';

// The central registry for all available nodes in the simulator
export const NodeRegistry: Record<string, NodeDefinition> = {
  [AndNode.type]: AndNode,
  [OrNode.type]: OrNode,
  [NorNode.type]: NorNode,
  [NandNode.type]: NandNode,
  [NotNode.type]: NotNode,
  [XorNode.type]: XorNode,
  [XnorNode.type]: XnorNode,
  [BufferNode.type]: BufferNode,
  [SubInNode.type]: SubInNode,
  [SubOutNode.type]: SubOutNode,
  [SubIoNode.type]: SubIoNode,
  [ClockNode.type]: ClockNode,
  [VccNode.type]: VccNode,
  [GndNode.type]: GndNode,
  [JunctionNode.type]: JunctionNode,
  [DipSwitchNode.type]: DipSwitchNode,
  [PushButtonNode.type]: PushButtonNode,
  [LedBarNode.type]: LedBarNode,
  [SevenSegNode.type]: SevenSegNode,
  [NetLabelNode.type]: NetLabelNode,
  [BusBreakoutNode.type]: BusBreakoutNode,
  [IC74LS00.type]: IC74LS00,
  [IC74LS02.type]: IC74LS02,
  [IC74LS04.type]: IC74LS04,
  [IC74LS08.type]: IC74LS08,
  [IC74LS32.type]: IC74LS32,
  [IC74LS86.type]: IC74LS86,
  [IC74LS173.type]: IC74LS173,
  [IC74LS181.type]: IC74LS181,
  [IC74LS47.type]: IC74LS47,
  [IC74LS138.type]: IC74LS138,
  [IC74LS154.type]: IC74LS154,
  [IC74LS241.type]: IC74LS241, IC74LS244,
  [IC74LS244.type]: IC74LS244,
  [IC74LS161.type]: IC74LS161,
  [IC74LS191.type]: IC74LS191,
  [IC74LS273.type]: IC74LS273,
  [ROM_27C256.type]: ROM_27C256,
  [SRAM_62256.type]: SRAM_62256,
  [IC_74LS283.type]: IC_74LS283,
  [IC_74LS245.type]: IC_74LS245,
  [IC74LS541.type]: IC74LS541,
};

export const getNodeDefinition = (type: string): NodeDefinition | undefined => {
  if (type.startsWith('SUBCIRCUIT:')) return SubcircuitRegistry[type];
  return NodeRegistry[type];
};
