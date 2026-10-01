import { LogicNode, Pin } from '../models/types';
import { getNodeDefinition } from '../engine/nodes';

export const getSafePinNumber = (nodeType: string, pin: Pick<Pin, 'name' | 'type' | 'pinNumber'>): number | undefined => {
  if (pin.pinNumber !== undefined) return pin.pinNumber;
  const def = getNodeDefinition(nodeType);
  if (def?.customPins) {
    const cp = def.customPins.find(c => c.name === pin.name && c.type === pin.type);
    return cp?.pinNumber;
  }
  return undefined;
};

export const getGateDimensions = (node: LogicNode, isSchematic: boolean = true) => {
  const def = getNodeDefinition(node.type);
  if (node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP') {
    const allPins = [...node.inputs, ...node.outputs];

    let pinsPerSide = 4;
    if (isSchematic) {
      const visibleInputs = node.inputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
      const visibleOutputs = node.outputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
      pinsPerSide = Math.max(visibleInputs.length, visibleOutputs.length);
      return { width: 120, height: (pinsPerSide + 1) * 20 };
    } else {
      const maxPinNumber = allPins.reduce((max, p) => Math.max(max, getSafePinNumber(node.type, p) ?? 0), 0);
      pinsPerSide = Math.max(Math.ceil(allPins.length / 2), Math.ceil(maxPinNumber / 2));
      // Standard narrow DIP is 0.3" (60px) wide. 
      // Pins start at y=20. So total height should be (pinsPerSide + 1) * 20 to be symmetrical.
      return { width: 60, height: (pinsPerSide + 1) * 20 };
    }
  }

  if (node.type === 'INPUT' || node.type === 'OUTPUT' || node.type === 'CLOCK') {
    return { width: 60, height: 60 };
  }
  return { 
    width: 80, 
    height: Math.max(60, (Math.max(node.inputs.length, node.outputs.length) + 1) * 20)
  };
};

export const getPinPosition = (node: LogicNode, pinId: string, isSchematic: boolean = true) => {
  const { width, height } = getGateDimensions(node, isSchematic);
  const def = getNodeDefinition(node.type);
  
  if (node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP') {
    const allPins = [...node.inputs, ...node.outputs];
    const pin = allPins.find(p => p.id === pinId);
    if (pin) {
      const safePinNum = getSafePinNumber(node.type, pin) ?? 1;
      
      let isLeft = true;
      let row = 1;

      if (isSchematic) {
        isLeft = pin.type === 'input';
        const visibleInputs = node.inputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
        const visibleOutputs = node.outputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
        const collection = isLeft ? visibleInputs : visibleOutputs;
        const index = collection.findIndex(p => p.id === pinId);
        row = index + 1;
      } else {
        const maxPinNumber = allPins.reduce((max, p) => Math.max(max, getSafePinNumber(node.type, p) ?? 0), 0);
        const pinsPerSide = Math.max(Math.ceil(allPins.length / 2), Math.ceil(maxPinNumber / 2));
        const totalPins = pinsPerSide * 2;
        isLeft = safePinNum <= pinsPerSide;
        row = isLeft ? safePinNum : (totalPins - safePinNum + 1);
      }
      
      const x = isLeft ? node.x : node.x + width;
      const yOffset = 20 + ((row - 1) * 20);
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
