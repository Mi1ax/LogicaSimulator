import { NodeDefinition, PinDefinition } from './nodes/NodeDefinition';
import { LogicNode } from '../models/types';

export const SubcircuitRegistry: Record<string, NodeDefinition> = {};

export const generateSubcircuitDefinition = (id: string, name: string, nodes: LogicNode[]): NodeDefinition => {
  const inputs = nodes.filter(n => n.type === 'SUB_IN');
  const outputs = nodes.filter(n => n.type === 'SUB_OUT');
  const ios = nodes.filter(n => n.type === 'SUB_IO');

  const customPins: PinDefinition[] = [];
  
  let currentPin = 1;
  inputs.forEach((n, i) => {
    customPins.push({
      name: n.properties?.label || `IN${i}`,
      type: 'input',
      schematicSide: 'left',
      schematicRow: i + 1,
      pinNumber: currentPin++,
      internalNodeId: n.id
    });
  });

  ios.forEach((n, i) => {
    customPins.push({
      name: n.properties?.label || `IO${i}`,
      type: 'bidir',
      schematicSide: 'left',
      schematicRow: inputs.length + i + 1,
      pinNumber: currentPin++,
      internalNodeId: n.id
    });
  });

  outputs.forEach((n, i) => {
    customPins.push({
      name: n.properties?.label || `OUT${i}`,
      type: 'output',
      schematicSide: 'right',
      schematicRow: i + 1,
      pinNumber: currentPin++,
      internalNodeId: n.id
    });
  });

  return {
    type: `SUBCIRCUIT:${id}`,
    label: name,
    numInputs: inputs.length,
    numOutputs: outputs.length,

    renderAs: 'DIP',
    customPins,
    evaluate: () => []
  };
};

export const updateSubcircuitRegistry = (id: string, name: string, nodes: LogicNode[]) => {
  SubcircuitRegistry[`SUBCIRCUIT:${id}`] = generateSubcircuitDefinition(id, name, nodes);
};

export const removeSubcircuitFromRegistry = (id: string) => {
  delete SubcircuitRegistry[`SUBCIRCUIT:${id}`];
};

