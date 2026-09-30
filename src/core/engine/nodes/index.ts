import { NodeDefinition } from './NodeDefinition';
import { AndNode, OrNode, NotNode, InputNode, OutputNode, ClockNode } from './basicNodes';

// The central registry for all available nodes in the simulator
export const NodeRegistry: Record<string, NodeDefinition> = {
  [AndNode.type]: AndNode,
  [OrNode.type]: OrNode,
  [NotNode.type]: NotNode,
  [InputNode.type]: InputNode,
  [OutputNode.type]: OutputNode,
  [ClockNode.type]: ClockNode,
};

export const getNodeDefinition = (type: string): NodeDefinition | undefined => {
  return NodeRegistry[type];
};
