import { LogicNode } from '../models/types';

export const getGateDimensions = (node: LogicNode) => {
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
  
  const inIndex = node.inputs.findIndex(p => p.id === pinId);
  if (inIndex !== -1) {
    if (node.type === 'OUTPUT') {
      return { x: node.x, y: node.y + height / 2 };
    }
    return {
      x: node.x,
      y: node.y + (height / (node.inputs.length + 1)) * (inIndex + 1)
    };
  }
  
  const outIndex = node.outputs.findIndex(p => p.id === pinId);
  if (outIndex !== -1) {
    if (node.type === 'INPUT' || node.type === 'CLOCK') {
      return { x: node.x + width, y: node.y + height / 2 };
    }
    return {
      x: node.x + width,
      y: node.y + (height / (node.outputs.length + 1)) * (outIndex + 1)
    };
  }
  
  return { x: node.x, y: node.y }; // Fallback
};
