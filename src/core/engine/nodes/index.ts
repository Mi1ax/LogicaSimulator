import { NodeDefinition } from './NodeDefinition';
import {
  AndNode, OrNode, NotNode, XorNode,
  NorNode,
  InputNode, OutputNode, ClockNode
} from './basicNodes';

// The central registry for all available nodes in the simulator
export const NodeRegistry: Record<string, NodeDefinition> = {
  [AndNode.type]: AndNode,
  [OrNode.type]: OrNode,
  [NorNode.type]: NorNode,
  [NotNode.type]: NotNode,
  [XorNode.type]: XorNode,
  [InputNode.type]: InputNode,
  [OutputNode.type]: OutputNode,
  [ClockNode.type]: ClockNode,
};

export const getNodeDefinition = (type: string): NodeDefinition | undefined => {
  return NodeRegistry[type];
};
