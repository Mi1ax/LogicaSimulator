import { LogicNode } from '../models/types';
import { getNodeDefinition } from '../engine/nodes';

export const getSchematicDimensions = (node: LogicNode) => {
  const def = getNodeDefinition(node.type);
  if (node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP') {
    const visibleInputs = node.inputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
    const visibleOutputs = node.outputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
    const pinsPerSide = Math.max(visibleInputs.length, visibleOutputs.length);
    return { width: 160, height: (pinsPerSide + 1) * 40 };
  }

  if (node.type === 'INPUT' || node.type === 'OUTPUT' || node.type === 'CLOCK') {
    return { width: 60, height: 60 };
  }
  return { 
    width: 80, 
    height: Math.max(60, (Math.max(node.inputs.length, node.outputs.length) + 1) * 20)
  };
};

export const getSchematicPinPosition = (node: LogicNode, pinId: string) => {
  const { width, height } = getSchematicDimensions(node);
  const def = getNodeDefinition(node.type);
  
  if (node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP') {
    const allPins = [...node.inputs, ...node.outputs];
    const pin = allPins.find(p => p.id === pinId);
    if (pin) {
      if (pin.name === 'VCC') {
        return { x: node.x + width / 2, y: node.y - 20, nx: 0, ny: -1 };
      }
      if (pin.name === 'GND') {
        return { x: node.x + width / 2, y: node.y + height + 20, nx: 0, ny: 1 };
      }

      const isLeft = pin.type === 'input';
      const visibleInputs = node.inputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
      const visibleOutputs = node.outputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
      const collection = isLeft ? visibleInputs : visibleOutputs;
      const index = collection.findIndex(p => p.id === pinId);
      const row = index + 1;

      const spacing = 40;
      const legLength = 20;
      const x = isLeft ? node.x - legLength : node.x + width + legLength;
      const yOffset = spacing + ((row - 1) * spacing);
      const y = node.y + yOffset;
      return { x, y, nx: isLeft ? -1 : 1, ny: 0 };
    }
  }

  const inIndex = node.inputs.findIndex(p => p.id === pinId);
  if (inIndex !== -1) {
    if (node.type === 'OUTPUT') {
      return { x: node.x, y: node.y + height / 2, nx: -1, ny: 0 };
    }
    return {
      x: node.x,
      y: node.y + (height / (node.inputs.length + 1)) * (inIndex + 1),
      nx: -1, ny: 0
    };
  }
  
  const outIndex = node.outputs.findIndex(p => p.id === pinId);
  if (outIndex !== -1) {
    if (node.type === 'INPUT' || node.type === 'CLOCK') {
      return { x: node.x + width, y: node.y + height / 2, nx: 1, ny: 0 };
    }
    return {
      x: node.x + width,
      y: node.y + (height / (node.outputs.length + 1)) * (outIndex + 1),
      nx: 1, ny: 0
    };
  }
  
  return { x: node.x, y: node.y, nx: 0, ny: 0 };
};
