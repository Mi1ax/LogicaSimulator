import re

with open('src/core/engine/subcircuitRegistry.ts', 'r') as f:
    content = f.read()

new_content = """import { NodeDefinition, PinDefinition } from './nodes/NodeDefinition';
import { LogicNode } from '../models/types';

export const SubcircuitRegistry: Record<string, NodeDefinition> = {};

export const generateSubcircuitDefinition = (id: string, name: string, nodes: LogicNode[]): NodeDefinition => {
  const inputs = nodes.filter(n => n.type === 'INPUT');
  const outputs = nodes.filter(n => n.type === 'OUTPUT');

  const customPins: PinDefinition[] = [];
  
  inputs.forEach((n, i) => {
    customPins.push({
      name: n.properties?.label || `IN${i}`,
      type: 'input',
      schematicSide: 'left',
      schematicRow: i + 1,
      pinNumber: i + 1
    });
  });

  outputs.forEach((n, i) => {
    customPins.push({
      name: n.properties?.label || `OUT${i}`,
      type: 'output',
      schematicSide: 'right',
      schematicRow: i + 1,
      pinNumber: inputs.length + i + 1
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
"""

with open('src/core/engine/subcircuitRegistry.ts', 'w') as f:
    f.write(new_content)
