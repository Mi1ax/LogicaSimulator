import { NodeDefinition } from './NodeDefinition';
import {
  AndNode, OrNode, NotNode, XorNode,
  NorNode, NandNode, XnorNode, BufferNode,
  InputNode, OutputNode, ClockNode,
  VccNode, GndNode, JunctionNode,
  DipSwitchNode, SevenSegNode
} from './basicNodes';
import { IC74LS08, IC74LS161, IC74LS273 } from './icNodes';

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
  [IC74LS08.type]: IC74LS08,
  [IC74LS161.type]: IC74LS161,
  [IC74LS273.type]: IC74LS273,
};

export const getNodeDefinition = (type: string): NodeDefinition | undefined => {
  return NodeRegistry[type];
};
