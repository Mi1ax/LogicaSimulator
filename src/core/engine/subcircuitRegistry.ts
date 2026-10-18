import { NodeDefinition, PinDefinition } from './nodes/NodeDefinition';
import { LogicNode } from '../models/types';

export const SubcircuitRegistry: Record<string, NodeDefinition> = {};

export const generateSubcircuitDefinition = (id: string, name: string, nodes: LogicNode[]): NodeDefinition => {
  const inputs = nodes.filter(n => n.type === 'SUB_IN');
  const outputs = nodes.filter(n => n.type === 'SUB_OUT');
  const ios = nodes.filter(n => n.type === 'SUB_IO');

  const customPins: PinDefinition[] = [];
  const usedNamesByType: Record<string, Set<string>> = {
    input: new Set(),
    bidir: new Set(),
    output: new Set(),
  };

  const getUniquePinName = (rawName: string, type: 'input' | 'bidir' | 'output'): string => {
    const base = String(rawName || '').trim() || 'PIN';
    const set = usedNamesByType[type];
    if (!set.has(base)) {
      set.add(base);
      return base;
    }
    let suffix = 2;
    while (set.has(`${base}_${suffix}`)) {
      suffix++;
    }
    const unique = `${base}_${suffix}`;
    set.add(unique);
    return unique;
  };
  
  let currentPin = 1;
  inputs.forEach((n, i) => {
    customPins.push({
      name: getUniquePinName(n.properties?.label || `IN${i}`, 'input'),
      type: 'input',
      schematicSide: 'left',
      schematicRow: i + 1,
      pinNumber: currentPin++,
      internalNodeId: n.id
    });
  });

  ios.forEach((n, i) => {
    customPins.push({
      name: getUniquePinName(n.properties?.label || `IO${i}`, 'bidir'),
      type: 'bidir',
      schematicSide: 'left',
      schematicRow: inputs.length + i + 1,
      pinNumber: currentPin++,
      internalNodeId: n.id
    });
  });

  outputs.forEach((n, i) => {
    customPins.push({
      name: getUniquePinName(n.properties?.label || `OUT${i}`, 'output'),
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

