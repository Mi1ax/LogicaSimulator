import { LogicNode } from '../models/types';

export const getGateDimensions = (node: LogicNode) => {
  if (node.properties?.renderAs === 'DIP') {
    const totalPins = node.inputs.length + node.outputs.length;
    const pinsPerSide = Math.ceil(totalPins / 2);
    // 20px per pin row + 40px padding top/bottom
    return { width: 120, height: pinsPerSide * 20 + 40 };
  }

  if (node.type === 'INPUT' || node.type === 'OUTPUT' || node.type === 'CLOCK') {
    return { width: 60, height: 60 };
  }
  return { 
    width: 80, 
    height: Math.max(60, (Math.max(node.inputs.length, node.outputs.length) + 1) * 20)
  };
};

export const getPinPosition = (node: LogicNode, pinId: string) => {
  const { width, height } = getGateDimensions(node);
  
  if (node.properties?.renderAs === 'DIP') {
    const allPins = [...node.inputs, ...node.outputs];
    const pin = allPins.find(p => p.id === pinId);
    if (pin && pin.pinNumber !== undefined) {
      const totalPins = allPins.length;
      const pinsPerSide = Math.ceil(totalPins / 2);
      const isLeft = pin.pinNumber <= pinsPerSide;
      const row = isLeft ? pin.pinNumber : (totalPins - pin.pinNumber + 1);
      
      const x = isLeft ? node.x : node.x + width;
      const y = node.y + 20 + ((row - 1) * 20) + 10;
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
