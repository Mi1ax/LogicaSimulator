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

  if (node.type === 'KEYPAD') {
    return { width: 120, height: 160 };
  }

  if (node.type === 'BUTTON') {
    return { width: 40, height: 40 };
  }
  
  if (node.type === 'NC') {
    return { width: 0, height: 0 };
  }

  if (node.type === 'REGION_BOX') {
    return {
      width: Math.max(60, Number(node.properties?.width) || 240),
      height: Math.max(60, Number(node.properties?.height) || 160),
    };
  }

  if (node.type === 'STICKY_NOTE') {
    return {
      width: Math.max(80, Number(node.properties?.width) || 220),
      height: Math.max(60, Number(node.properties?.height) || 140),
    };
  }

  if (node.type === 'FSM_DIAGRAM') {
    return {
      width: Math.max(260, Number(node.properties?.width) || 640),
      height: Math.max(200, Number(node.properties?.height) || 440),
    };
  }

  if (node.type === 'TEXT_LABEL') {
    const fontSize = Math.max(10, Number(node.properties?.fontSize) || 20);
    const text = String(node.properties?.label || 'Text');
    const lines = text.split('\n');
    const bold = node.properties?.bold !== false;
    const italic = !!node.properties?.italic;
    const fontFamily = node.properties?.fontFamily === 'mono' ? 'monospace' : 'sans-serif';
    const fontStyle = bold && italic ? 'bold italic' : bold ? 'bold' : italic ? 'italic' : 'normal';

    let maxLineWidth = 0;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
        for (const l of lines) {
          maxLineWidth = Math.max(maxLineWidth, ctx.measureText(l || ' ').width);
        }
      }
    }
    if (maxLineWidth === 0) {
      const maxLen = Math.max(1, ...lines.map(l => l.length));
      maxLineWidth = maxLen * fontSize * 0.68;
    }

    return {
      width: Math.max(40, Math.ceil((maxLineWidth + 8) / 20) * 20),
      height: Math.max(20, Math.ceil((lines.length * fontSize * 1.35) / 20) * 20),
    };
  }

  if (node.type === 'INPUT' || node.type === 'OUTPUT' || node.type === 'CLOCK' || node.type === 'NET_LABEL') {
    return { width: 60, height: 40 };
  }

  if (node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP') {
    const visiblePins = [...node.inputs, ...node.outputs].filter(p => p.name !== 'VCC' && p.name !== 'GND');
    let maxRow = 0;
    let maxTopBottomRow = 0;
    
    visiblePins.forEach(pin => {
      const pinDef = def?.customPins?.find(cp => cp.name === pin.name);
      if (pinDef?.schematicSide === 'top' || pinDef?.schematicSide === 'bottom') {
        if (pinDef?.schematicRow !== undefined) {
          maxTopBottomRow = Math.max(maxTopBottomRow, pinDef.schematicRow);
        }
      } else {
        if (pinDef?.schematicRow !== undefined) {
          maxRow = Math.max(maxRow, pinDef.schematicRow);
        }
      }
    });

    if (maxRow === 0) {
      const visibleInputs = node.inputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
      const visibleOutputs = node.outputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
      maxRow = Math.max(visibleInputs.length, visibleOutputs.length);
    }
    
    let width = 120;
    if (maxTopBottomRow > 0) {
      // Ensure VCC/GND at width/2 don't collide with the furthest top/bottom pin
      // The furthest pin is at x = maxTopBottomRow * 20.
      // So width/2 should be at least (maxTopBottomRow + 1) * 20.
      // Thus width >= (maxTopBottomRow + 1) * 40
      width = Math.max(120, (maxTopBottomRow + 1) * 40);
    }
    
    // Standard chip dimensions with 2 grid dots padding top and bottom
    return { width, height: (maxRow + 3) * 20 };
  }

  if (node.properties?.renderAs === 'BUS' || def?.renderAs === 'BUS') {
    let maxRow = 0;
    if (def?.generatePins) {
      const generated = def.generatePins(node.properties || {});
      generated.forEach(cp => {
        if (cp.schematicRow !== undefined) maxRow = Math.max(maxRow, cp.schematicRow);
      });
    }
    if (maxRow === 0) maxRow = Math.max(node.inputs.length, node.outputs.length);
    return { width: 40, height: (maxRow + 1) * 20 };
  }

  if (node.type === "VCC" || node.type === "GND" || node.type === "PULL_UP" || node.type === "PULL_DOWN") {
    return { width: 40, height: 40 };
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

/**
 * Rotation pivot (in node-local coordinates) for a schematic node.
 *
 * This is the single source of truth used both by the pin-position math below
 * and by every schematic renderer (Konva Group offsetX/offsetY). The pivot must
 * sit on the 20px grid so that rotated pins stay grid-aligned.
 */
export const getSchematicAnchor = (node: LogicNode): { x: number; y: number } => {
  const def = getNodeDefinition(node.type);
  const { width, height } = getSchematicDimensions(node);

  if (node.type === 'REGION_BOX' || node.type === 'STICKY_NOTE' || node.type === 'TEXT_LABEL') {
    return { x: 0, y: 0 };
  }
  if (node.type === 'JUNCTION') return { x: 10, y: 10 };
  if (['INPUT', 'OUTPUT', 'CLOCK', 'VCC', 'GND', 'PULL_UP', 'PULL_DOWN', 'NET_LABEL'].includes(node.type)) {
    // IO nodes have always pivoted around (20,20); keep it so saved layouts don't shift.
    return { x: 20, y: 20 };
  }
  if (node.type === 'DIP_SWITCH' || node.type === '7_SEG_DISPLAY') {
    return { x: Math.round(width / 40) * 20, y: Math.round(height / 40) * 20 };
  }
  if (node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP') {
    return { x: Math.round(width / 40) * 20, y: Math.round(height / 40) * 20 };
  }
  if (node.properties?.renderAs === 'BUS' || def?.renderAs === 'BUS') {
    return { x: Math.round(width / 40) * 20, y: Math.round(height / 40) * 20 };
  }
  // Basic gates: width is 80 and height is a multiple of 40, so the center is grid-aligned.
  return { x: width / 2, y: height / 2 };
};

const applyTransform = (x: number, y: number, nx: number, ny: number, anchorX: number, anchorY: number, rotation: number, flipX: boolean, flipY: boolean) => {
  let dx = x - anchorX;
  let dy = y - anchorY;

  if (flipX) {
    dx = -dx;
    nx = -nx;
  }
  if (flipY) {
    dy = -dy;
    ny = -ny;
  }

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));

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
  const { x: anchorX, y: anchorY } = getSchematicAnchor(node);

  if (node.type === 'DIP_SWITCH') {
    const outIndex = node.outputs.findIndex(p => p.id === pinId);
    if (outIndex !== -1) {
      const spacing = 20;
      const rawX = width + 20;
      const rawY = spacing + outIndex * spacing;
      const flipX = !!node.properties?.flipX;
      const flipY = !!node.properties?.flipY;
      const rotated = applyTransform(rawX, rawY, 1, 0, anchorX, anchorY, rotation, flipX, flipY);
      return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
    }
  }

  if (node.type === '7_SEG_DISPLAY') {
    const inIndex = node.inputs.findIndex(p => p.id === pinId);
    if (inIndex !== -1) {
      const isTop = inIndex < 4;
      const col = isTop ? inIndex : inIndex - 4;
      const rawX = 20 + col * 20;
      const rawY = isTop ? 0 : height;
      const rawNx = 0;
      const rawNy = isTop ? -1 : 1;
      const flipX = !!node.properties?.flipX;
      const flipY = !!node.properties?.flipY;
      const rotated = applyTransform(rawX, rawY, rawNx, rawNy, anchorX, anchorY, rotation, flipX, flipY);
      return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
    }
  }

  if (node.type === 'KEYPAD') {
    const pinIndex = node.inputs.findIndex(p => p.id === pinId);
    if (pinIndex !== -1) {
      let rawX = 0, rawY = 0, rawNx = 0, rawNy = 0;
      if (pinIndex < 4) {
        // Row pins R1..R4 on left
        rawX = -20;
        rawY = 20 + pinIndex * 40;
        rawNx = -1;
        rawNy = 0;
      } else {
        // Column pins C1..C3 on top
        const colIdx = pinIndex - 4;
        rawX = 20 + colIdx * 40;
        rawY = -20;
        rawNx = 0;
        rawNy = -1;
      }
      const flipX = !!node.properties?.flipX;
      const flipY = !!node.properties?.flipY;
      const rotated = applyTransform(rawX, rawY, rawNx, rawNy, anchorX, anchorY, rotation, flipX, flipY);
      return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
    }
  }
  
  if (node.type !== 'CLOCK' && (node.properties?.renderAs === 'DIP' || def?.renderAs === 'DIP')) {
    const allPins = Array.from(new Map([...node.inputs, ...node.outputs].map(p => [p.id, p])).values());
    const pin = allPins.find(p => p.id === pinId);
    if (pin) {
      let rawX = 0, rawY = 0, rawNx = 0, rawNy = 0;
      if (pin.name === 'VCC') {
        rawX = width / 2; rawY = -20; rawNx = 0; rawNy = -1;
      } else if (pin.name === 'GND') {
        rawX = width / 2; rawY = height + 20; rawNx = 0; rawNy = 1;
      } else {
        const pinDef = def?.customPins?.find(cp => cp.name === pin.name);
        
        let side = pinDef?.schematicSide;
        if (!side) {
           side = pin.type === 'input' ? 'left' : 'right';
        }
        
        let row = pinDef?.schematicRow;
        if (row === undefined) {
           const collection = side === 'left' 
              ? node.inputs.filter(p => p.name !== 'VCC' && p.name !== 'GND') 
              : node.outputs.filter(p => p.name !== 'VCC' && p.name !== 'GND');
           const index = collection.findIndex(p => p.id === pinId);
           row = index + 1;
        }

        const spacing = 20;
        const legLength = 20;

        if (side === 'left') {
          rawX = -legLength;
          rawY = (row + 1) * spacing;
          rawNx = -1; rawNy = 0;
        } else if (side === 'right') {
          rawX = width + legLength;
          rawY = (row + 1) * spacing;
          rawNx = 1; rawNy = 0;
        } else if (side === 'top') {
          rawX = row * spacing;
          rawY = -legLength;
          rawNx = 0; rawNy = -1;
        } else if (side === 'bottom') {
          rawX = row * spacing;
          rawY = height + legLength;
          rawNx = 0; rawNy = 1;
        }
      }
      const flipX = !!node.properties?.flipX;
      const flipY = !!node.properties?.flipY;
      const rotated = applyTransform(rawX, rawY, rawNx, rawNy, anchorX, anchorY, rotation, flipX, flipY);
      return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
    }
  }

  if (node.properties?.renderAs === 'BUS' || def?.renderAs === 'BUS') {
    const allPins = Array.from(new Map([...node.inputs, ...node.outputs].map(p => [p.id, p])).values());
    const pin = allPins.find(p => p.id === pinId);
    if (pin) {
      const generated = def?.generatePins ? def.generatePins(node.properties || {}) : [];
      const pinDef = generated.find(cp => cp.name === pin.name);

      let side = pinDef?.schematicSide || 'left';
      let row = pinDef?.schematicRow || 1;

      const spacing = 20;
      const legLength = 20;

      let rawX = 0, rawY = 0, rawNx = 0, rawNy = 0;
      if (side === 'left') {
        rawX = -legLength;
        rawY = row * spacing;
        rawNx = -1; rawNy = 0;
      } else if (side === 'right') {
        rawX = width + legLength;
        rawY = row * spacing;
        rawNx = 1; rawNy = 0;
      }

      const flipX = !!node.properties?.flipX;
      const flipY = !!node.properties?.flipY;
      const rotated = applyTransform(rawX, rawY, rawNx, rawNy, anchorX, anchorY, rotation, flipX, flipY);
      return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
    }
  }

  if (node.type === 'JUNCTION') {
    return { x: node.x, y: node.y, nx: 0, ny: 0 };
  }

  const inIndex = node.inputs.findIndex(p => p.id === pinId);
  if (inIndex !== -1) {
    let rawX, rawY, rawNx, rawNy;
    if (node.type === 'OUTPUT') {
      rawX = 0; rawY = height / 2; rawNx = -1; rawNy = 0;
    } else if (node.type === 'NET_LABEL') {
      rawX = width; rawY = height / 2; rawNx = 1; rawNy = 0;
    } else if (node.type === 'LED_BAR') {
      const ys = getGridAlignedPinYs(node.inputs.length, height);
      rawX = -20; rawY = ys[inIndex]; rawNx = -1; rawNy = 0;
    } else {
      const ys = getGridAlignedPinYs(node.inputs.length, height);
      rawX = 0; rawY = ys[inIndex]; rawNx = -1; rawNy = 0;
    }
    const flipX = !!node.properties?.flipX;
    const flipY = !!node.properties?.flipY;
    const rotated = applyTransform(rawX, rawY, rawNx, rawNy, anchorX, anchorY, rotation, flipX, flipY);
    return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
  }
  
  const outIndex = node.outputs.findIndex(p => p.id === pinId);
  if (outIndex !== -1) {
    let rawX, rawY, rawNx, rawNy;
    if (node.type === 'VCC' || node.type === 'PULL_UP') {
      rawX = 20; rawY = height; rawNx = 0; rawNy = 1;
    } else if (node.type === 'GND' || node.type === 'PULL_DOWN') {
      rawX = 20; rawY = 0; rawNx = 0; rawNy = -1;
    } else if (node.type === 'INPUT' || node.type === 'CLOCK') {
      rawX = width; rawY = height / 2; rawNx = 1; rawNy = 0;
    } else if (node.type === 'BUTTON') {
      rawX = width + 20; rawY = height / 2; rawNx = 1; rawNy = 0;
    } else {
      const ys = getGridAlignedPinYs(node.outputs.length, height);
      rawX = width; rawY = ys[outIndex]; rawNx = 1; rawNy = 0;
    }
    const flipX = !!node.properties?.flipX;
      const flipY = !!node.properties?.flipY;
      const rotated = applyTransform(rawX, rawY, rawNx, rawNy, anchorX, anchorY, rotation, flipX, flipY);
    return { x: node.x + rotated.x, y: node.y + rotated.y, nx: rotated.nx, ny: rotated.ny };
  }
  
  return { x: node.x, y: node.y, nx: 0, ny: 0 };
};
