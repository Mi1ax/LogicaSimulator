import { LogicNode } from '../models/types';
import { getNodeDefinition } from '../engine/nodes';
import { getSafePinNumber } from './layoutUtils';

export const getBoardDimensions = (node: LogicNode) => {
  const def = getNodeDefinition(node.type);
  if (node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP') {
    const allPins = [...node.inputs, ...node.outputs];
    const maxPinNumber = allPins.reduce((max, p) => Math.max(max, getSafePinNumber(node.type, p) ?? 0), 0);
    const pinsPerSide = Math.max(Math.ceil(allPins.length / 2), Math.ceil(maxPinNumber / 2));
    return { width: 60, height: (pinsPerSide + 1) * 20 };
  }

  if (node.type === 'INPUT' || node.type === 'OUTPUT' || node.type === 'CLOCK') {
    return { width: 60, height: 60 };
  }
  return { 
    width: 80, 
    height: Math.max(60, (Math.max(node.inputs.length, node.outputs.length) + 1) * 20)
  };
};

export const getBoardPinPosition = (node: LogicNode, pinId: string) => {
  const { width, height } = getBoardDimensions(node);
  const def = getNodeDefinition(node.type);
  
  if (node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP') {
    const allPins = [...node.inputs, ...node.outputs];
    const pin = allPins.find(p => p.id === pinId);
    if (pin) {
      const safePinNum = getSafePinNumber(node.type, pin) ?? 1;
      const maxPinNumber = allPins.reduce((max, p) => Math.max(max, getSafePinNumber(node.type, p) ?? 0), 0);
      const pinsPerSide = Math.max(Math.ceil(allPins.length / 2), Math.ceil(maxPinNumber / 2));
      const totalPins = pinsPerSide * 2;
      const isLeft = safePinNum <= pinsPerSide;
      const row = isLeft ? safePinNum : (totalPins - safePinNum + 1);

      const spacing = 20;
      const x = isLeft ? node.x : node.x + width;
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
