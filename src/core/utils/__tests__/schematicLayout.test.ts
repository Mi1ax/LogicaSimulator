import { describe, it, expect, vi } from 'vitest';
import { getSchematicDimensions, getSchematicPinPosition } from '../schematicLayout';
import { getSafePinNumber } from '../layoutUtils';
import { LogicNode } from '../../models/types';

vi.mock('../../engine/nodes', () => {
  return {
    getNodeDefinition: vi.fn((type: string) => {
      if (type === '74LS161') {
        return {
          type: '74LS161',
          renderAs: 'DIP',
          customPins: [
            { name: 'IN1', type: 'input', pinNumber: 1 },
            { name: 'IN2', type: 'input', pinNumber: 2 },
            { name: 'OUT1', type: 'output', pinNumber: 15 },
            { name: 'OUT2', type: 'output', pinNumber: 16 },
          ]
        };
      }
      return null;
    })
  };
});

describe('schematicLayout', () => {
  describe('getSafePinNumber', () => {
    it('returns pinNumber if it exists on the pin', () => {
      expect(getSafePinNumber('74LS161', { name: 'IN1', type: 'input', pinNumber: 42 })).toBe(42);
    });
    
    it('falls back to registry if pinNumber is missing', () => {
      expect(getSafePinNumber('74LS161', { name: 'IN1', type: 'input' })).toBe(1);
      expect(getSafePinNumber('74LS161', { name: 'OUT1', type: 'output' })).toBe(15);
    });
  });

  describe('DIP layout', () => {
    const createNode = (): LogicNode => ({
      id: 'n1', type: '74LS161', x: 100, y: 100,
      properties: { renderAs: 'DIP' },
      inputs: [
        { id: 'p1', nodeId: 'n1', type: 'input', index: 0, name: 'IN1' },
        { id: 'p2', nodeId: 'n1', type: 'input', index: 1, name: 'IN2' }
      ],
      outputs: [
        { id: 'p15', nodeId: 'n1', type: 'output', index: 0, name: 'OUT1' },
        { id: 'p16', nodeId: 'n1', type: 'output', index: 1, name: 'OUT2' }
      ]
    });

    it('calculates correct dimensions and coordinates for DIP layout', () => {
      const node = createNode();
      
      // visibleInputs = 2, visibleOutputs = 2. max = 2.
      // Height = (2 + 1) * 40 = 120
      // Width = 160
      const dims = getSchematicDimensions(node);
      expect(dims.height).toBe(120);
      expect(dims.width).toBe(160);
      
      // IN1 is first input -> row 1 left side
      // rawX = -legLength (-20)
      // rawY = spacing + (row - 1) * spacing = 40 + (1 - 1) * 40 = 40
      const in1 = getSchematicPinPosition(node, 'p1');
      expect(in1.x).toBe(100 - 20); // 80
      expect(in1.y).toBe(100 + 40); // 140
      
      // OUT1 is first output -> row 1 right side
      // rawX = width + legLength (160 + 20 = 180)
      // rawY = 40
      const out1 = getSchematicPinPosition(node, 'p15');
      expect(out1.x).toBe(100 + 180); // 280
      expect(out1.y).toBe(100 + 40); // 140
      
      // OUT2 is second output -> row 2 right side
      // rawY = 40 + 40 = 80
      const out2 = getSchematicPinPosition(node, 'p16');
      expect(out2.x).toBe(280);
      expect(out2.y).toBe(100 + 80); // 180
    });
  });
});
