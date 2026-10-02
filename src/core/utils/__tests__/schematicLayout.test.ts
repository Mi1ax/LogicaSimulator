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

  describe('DIP layout (Schematic vs Physical)', () => {
    const createNode = (schematicView: boolean): LogicNode => ({
      id: 'n1', type: '74LS161', x: 100, y: 100,
      properties: { renderAs: 'DIP', schematicView },
      inputs: [
        { id: 'p1', nodeId: 'n1', type: 'input', index: 0, name: 'IN1', pinNumber: 1 },
        { id: 'p2', nodeId: 'n1', type: 'input', index: 1, name: 'IN2', pinNumber: 2 }
      ],
      outputs: [
        { id: 'p15', nodeId: 'n1', type: 'output', index: 0, name: 'OUT1', pinNumber: 15 },
        { id: 'p16', nodeId: 'n1', type: 'output', index: 1, name: 'OUT2', pinNumber: 16 }
      ]
    });

    it('calculates correct dimensions and coordinates for Schematic view', () => {
      const node = createNode(true);
      
      // Schematic: max(inputs, outputs) = 2. Height = 2 * 20 + 40 = 80
      const dims = getSchematicDimensions(node);
      expect(dims.height).toBe(80);
      expect(dims.width).toBe(120);
      
      // IN1 is first input -> row 1 left side
      const in1 = getSchematicPinPosition(node, 'p1');
      expect(in1.x).toBe(100);
      expect(in1.y).toBe(100 + 20 + 10); // 130
      
      // OUT1 is first output -> row 1 right side
      const out1 = getSchematicPinPosition(node, 'p15');
      expect(out1.x).toBe(220); // 100 + 120
      expect(out1.y).toBe(130);
    });

    it('calculates correct dimensions and coordinates for Physical view', () => {
      const node = createNode(false);
      
      // Physical: maxPin = 16, pinsPerSide = 8. Height = 8 * 20 + 40 = 200
      const dims = getSchematicDimensions(node);
      expect(dims.height).toBe(200);
      
      // IN1 is pin 1 -> row 1 left side
      const in1 = getSchematicPinPosition(node, 'p1');
      expect(in1.x).toBe(100);
      expect(in1.y).toBe(130);
      
      // OUT2 is pin 16 -> totalPins = 16. isLeft = false. row = 16 - 16 + 1 = 1. -> row 1 right side
      const out2 = getSchematicPinPosition(node, 'p16');
      expect(out2.x).toBe(220);
      expect(out2.y).toBe(130);
      
      // OUT1 is pin 15 -> row = 16 - 15 + 1 = 2 -> row 2 right side
      const out1 = getSchematicPinPosition(node, 'p15');
      expect(out1.x).toBe(220);
      expect(out1.y).toBe(150); // 100 + 20 + 20 + 10
    });
    
    it('works correctly for legacy saved nodes with missing pin numbers', () => {
      // Simulate old save where pinNumber was not preserved
      const node: LogicNode = {
        id: 'n1', type: '74LS161', x: 100, y: 100,
        properties: { renderAs: 'DIP', schematicView: false },
        inputs: [{ id: 'p1', nodeId: 'n1', type: 'input', index: 0, name: 'IN2' }], // Pin 2
        outputs: [{ id: 'p15', nodeId: 'n1', type: 'output', index: 0, name: 'OUT1' }] // Pin 15
      };
      
      const dims = getSchematicDimensions(node);
      expect(dims.height).toBe(200); // Because it looks up maxPin 16 from registry!
      
      // IN2 should be pin 2, row 2 on left side
      const in2 = getSchematicPinPosition(node, 'p1');
      expect(in2.x).toBe(100);
      expect(in2.y).toBe(150);
    });
  });
});
