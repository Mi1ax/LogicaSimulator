import { LogicNode } from '../models/types';
import { getNodeDefinition } from '../engine/nodes';

export const getSchematicDimensions = (node: LogicNode) => {
  const def = getNodeDefinition(node.type);
  
  if (node.type === 'DIP_SWITCH') {
    const pins = node.outputs.length || 4;
    return { width: 80, height: (pins + 1) * 20 };
  }

  if (node.type === '7_SEG_DISPLAY') {
    return { width: 100, height: 120 };
  }

  if (node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP') {
    const visibleInputs = node.inputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
    const visibleOutputs = node.outputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
    const pinsPerSide = Math.max(visibleInputs.length, visibleOutputs.length);
    return { width: 160, height: (pinsPerSide + 1) * 40 };
  }

  if (node.type === "VCC" || node.type === "GND") return { width: 40, height: 40 };

  if (node.type === 'INPUT' || node.type === 'OUTPUT' || node.type === 'CLOCK') {
    return { width: 60, height: 40 };
  }
  
  if (node.type === 'JUNCTION') {
    return { width: 20, height: 20 };
  }

  const maxPins = Math.max(node.inputs.length, node.outputs.length);
  // Force height to be a multiple of 40 so the center (height/2) is a multiple of 20
  let h = (maxPins + 1) * 20;
  if (h % 40 !== 0) h += 20;
  return { 
    width: 80, 
    height: Math.max(80, h)
  };
};

const applyRotation = (x: number, y: number, nx: number, ny: number, anchorX: number, anchorY: number, rotation: number) => {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));

  const dx = x - anchorX;
  const dy = y - anchorY;

  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;

  const rnx = nx * cos - ny * sin;
  const rny = nx * sin + ny * cos;

  return { x: anchorX + rx, y: anchorY + ry, nx: rnx, ny: rny };
};

export const getGridAlignedPinYs = (count: number, height: number): number[] => {
  const center = height / 2;
  const ys: number[] = [];
  if (count % 2 === 1) {
    const half = Math.floor(count / 2);
    for (let i = -half; i <= half; i++) ys.push(center + i * 20);
  } else {
    const half = count / 2;
    for (let i = -half; i <= half; i++) {
      if (i === 0) continue;
      ys.push(center + i * 20); 
    }
  }
  return ys.sort((a, b) => a - b);
};

export const getSchematicPinPosition = (node: LogicNode, pinId: string) => {
  const { width, height } = getSchematicDimensions(node);
  const def = getNodeDefinition(node.type);
  const rotation = node.properties?.rotation || 0;

  if (node.type === 'DIP_SWITCH') {
    const outIndex = node.outputs.findIndex(p => p.id === pinId);
    if (outIndex !== -1) {
      const spacing = 20;
      const rawX = width + 20;
      const rawY = spacing + outIndex * spacing;
      const rotated = applyRotation(rawX, rawY, 1, 0, Math.round(width / 40) * 20, Math.round(height / 40) * 20, rotation);
      return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
    }
  }

  if (node.type === '7_SEG_DISPLAY') {
    const inIndex = node.inputs.findIndex(p => p.id === pinId);
    if (inIndex !== -1) {
      const isTop = inIndex < 4;
      const col = isTop ? inIndex : inIndex - 4;
      const rawX = 20 + col * 20;
      const rawY = isTop ? 0 : 120;
      const rawNx = 0;
      const rawNy = isTop ? -1 : 1;
      const rotated = applyRotation(rawX, rawY, rawNx, rawNy, 50, 60, rotation);
      return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
    }
  }
  
  if (node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP') {
    const allPins = [...node.inputs, ...node.outputs];
    const pin = allPins.find(p => p.id === pinId);
    if (pin) {
      let rawX, rawY, rawNx, rawNy;
      if (pin.name === 'VCC') {
        rawX = width / 2; rawY = -20; rawNx = 0; rawNy = -1;
      } else if (pin.name === 'GND') {
        rawX = width / 2; rawY = height + 20; rawNx = 0; rawNy = 1;
      } else {
        const isLeft = pin.type === 'input';
        const visibleInputs = node.inputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
        const visibleOutputs = node.outputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
        const collection = isLeft ? visibleInputs : visibleOutputs;
        const index = collection.findIndex(p => p.id === pinId);
        const row = index + 1;

        const spacing = 40;
        const legLength = 20;
        rawX = isLeft ? -legLength : width + legLength;
        rawY = spacing + ((row - 1) * spacing);
        rawNx = isLeft ? -1 : 1; rawNy = 0;
      }
      const rotated = applyRotation(rawX, rawY, rawNx, rawNy, width / 2, height / 2, rotation);
      return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
    }
  }

  if (node.type === 'JUNCTION') {
    return { x: node.x, y: node.y, nx: 0, ny: 0 };
  }

  const anchorX = width / 2;
  const anchorY = height / 2;

  const inIndex = node.inputs.findIndex(p => p.id === pinId);
  if (inIndex !== -1) {
    let rawX, rawY, rawNx, rawNy;
    if (node.type === 'OUTPUT') {
      rawX = 0; rawY = height / 2; rawNx = -1; rawNy = 0;
    } else {
      const ys = getGridAlignedPinYs(node.inputs.length, height);
      rawX = 0; rawY = ys[inIndex]; rawNx = -1; rawNy = 0;
    }
    const rotated = applyRotation(rawX, rawY, rawNx, rawNy, anchorX, anchorY, rotation);
    return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
  }
  
  const outIndex = node.outputs.findIndex(p => p.id === pinId);
  if (outIndex !== -1) {
    let rawX, rawY, rawNx, rawNy;
    if (node.type === 'VCC') {
      rawX = width / 2; rawY = height; rawNx = 0; rawNy = 1;
    } else if (node.type === 'GND') {
      rawX = width / 2; rawY = 0; rawNx = 0; rawNy = -1;
    } else if (node.type === 'INPUT' || node.type === 'CLOCK') {
      rawX = width; rawY = height / 2; rawNx = 1; rawNy = 0;
    } else {
      const ys = getGridAlignedPinYs(node.outputs.length, height);
      rawX = width; rawY = ys[outIndex]; rawNx = 1; rawNy = 0;
    }
    const rotated = applyRotation(rawX, rawY, rawNx, rawNy, anchorX, anchorY, rotation);
    return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
  }
  
  return { x: node.x, y: node.y, nx: 0, ny: 0 };
};
