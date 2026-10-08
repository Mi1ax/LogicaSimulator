import { NodeDefinition } from './NodeDefinition';
import {
  AndNode, OrNode, NotNode, XorNode,
  NorNode, NandNode, XnorNode, BufferNode,
  InputNode, OutputNode, ClockNode,
  VccNode, GndNode, JunctionNode,
  DipSwitchNode, SevenSegNode, NetLabelNode
} from './basicNodes';
import { IC74LS08, IC74LS47, IC74LS138, IC74LS154, IC74LS241, IC74LS244, IC74LS161, IC74LS191, IC74LS273, ROM_27C256, SRAM_62256, IC_74LS283, IC_74LS245 } from './icNodes';

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
  [InputNode.type]: InputNode,
  [OutputNode.type]: OutputNode,
  [ClockNode.type]: ClockNode,
  [VccNode.type]: VccNode,
  [GndNode.type]: GndNode,
  [JunctionNode.type]: JunctionNode,
  [DipSwitchNode.type]: DipSwitchNode,
  [SevenSegNode.type]: SevenSegNode,
  [NetLabelNode.type]: NetLabelNode,
  [IC74LS08.type]: IC74LS08,
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
};

export const getNodeDefinition = (type: string): NodeDefinition | undefined => {
  return NodeRegistry[type];
};
