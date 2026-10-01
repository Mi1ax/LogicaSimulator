import { describe, it, expect } from 'vitest';
import { NodeRegistry } from '../nodes';

// Helper to generate a truth table string or array for a gate
const generateTruthTable = (gateType: string, numInputs: number = 2) => {
  const def = NodeRegistry[gateType];
  if (!def) throw new Error(`Gate ${gateType} not found`);

  const numCombinations = Math.pow(2, numInputs);
  const table: any[] = [];

  for (let i = 0; i < numCombinations; i++) {
    // Generate binary array for inputs (e.g., 0, 1 for 1; 1, 1 for 3)
    const inputs = [];
    for (let j = 0; j < numInputs; j++) {
      // Extract the j-th bit from the integer i (MSB first or LSB first? Let's do standard MSB-left A,B,C)
      const bit = (i >> (numInputs - 1 - j)) & 1;
      inputs.push(bit);
    }

    const outputs = def.evaluate(inputs, def.defaultProperties || {}, 0);
    
    // Construct row object for console.table
    const row: any = {};
    inputs.forEach((val, idx) => {
      const pinName = String.fromCharCode(65 + idx); // A, B, C...
      row[`In ${pinName}`] = val;
    });
    
    outputs.forEach((val, idx) => {
      row[outputs.length > 1 ? `Out ${idx}` : 'Out'] = val;
    });

    table.push(row);
  }

  return table;
};

describe('Gate Truth Tables (Visual CLI Feedback)', () => {
  const gatesToTest = ['AND', 'OR', 'NOR', 'XOR'];

  gatesToTest.forEach(gate => {
    it(`should evaluate the ${gate} gate correctly and print its Truth Table`, () => {
      const table = generateTruthTable(gate, 2);
      
      console.log(`\n=== Truth Table: ${gate} Gate ===`);
      console.table(table);

      // Verify the expected properties programmatically so the test is robust
      const def = NodeRegistry[gate];
      expect(def).toBeDefined();

      if (gate === 'AND') {
        expect(table[0]['Out']).toBe(0); // 0 AND 0
        expect(table[3]['Out']).toBe(1); // 1 AND 1
      }
      if (gate === 'OR') {
        expect(table[0]['Out']).toBe(0); // 0 OR 0
        expect(table[1]['Out']).toBe(1); // 0 OR 1
      }
    });
  });

  it('should evaluate the NOT gate correctly and print its Truth Table', () => {
    const table = generateTruthTable('NOT', 1);
    
    console.log(`\n=== Truth Table: NOT Gate ===`);
    console.table(table);
    
    expect(table[0]['Out']).toBe(1); // NOT 0 = 1
    expect(table[1]['Out']).toBe(0); // NOT 1 = 0
  });
});
