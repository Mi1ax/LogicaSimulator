# Testing Logica Components

Logica relies on [Vitest](https://vitest.dev/) for unit testing its core simulation engine and components. Because the simulation logic is completely isolated from the React UI layer, tests run incredibly fast in a pure Node.js environment.

## Running Tests

To run the full test suite:
```bash
npm run test
```

To run tests in watch mode (ideal during active development):
```bash
npm run test:watch
```

## Testing Logic Gates and Truth Tables

Basic combinational logic gates should be exhaustively tested using Truth Tables.

We have a dedicated script that programmatically tests standard gates against all possible binary input combinations and prints beautifully formatted ASCII truth tables directly to your terminal.

To run the visual truth table tests:
```bash
npm run test:gates
```

### Adding a new Gate to the Truth Table Tests

If you add a new basic logic gate (e.g., `NAND`, `XNOR`), you can easily add it to the visual CLI tests:

1. Open `src/core/engine/__tests__/gates.test.ts`.
2. Add your new gate's type to the `gatesToTest` array:
   ```typescript
   const gatesToTest = ['AND', 'OR', 'NOR', 'XOR', 'NAND']; // Added NAND
   ```
3. Optionally, add specific programmable assertions inside the loop to strictly verify the output mathematically:
   ```typescript
   if (gate === 'NAND') {
     expect(table[0]['Out']).toBe(1); // 0 NAND 0
     expect(table[3]['Out']).toBe(0); // 1 NAND 1
   }
   ```

## Testing Stateful ICs

For stateful Integrated Circuits (like counters or flip-flops), exhaustive truth tables often aren't sufficient because the output depends on previous states (memory/clocks). 

To test these, you should write sequential simulation tests.

1. **Create a Test File:** Create a new file in `src/core/engine/__tests__/` (e.g., `ic.test.ts`).
2. **Mock/Setup:** Construct a dummy `LogicNode` object representing your IC.
3. **Simulate Ticks:** Manually construct input arrays and call your IC's `evaluate` function, inspecting the mutated `properties` and output arrays across simulated ticks.

Example for a Flip-Flop:
```typescript
import { describe, it, expect } from 'vitest';
import { NodeRegistry } from '../nodes';

describe('D Flip-Flop', () => {
  it('should latch data on the rising edge of the clock', () => {
    const flipFlop = NodeRegistry['D_FF'];
    const props = { ...flipFlop.defaultProperties };
    
    // Inputs: [Data, Clock]
    
    // Tick 1: Data=1, Clock=0. Output should be 0 (unlatched)
    let out = flipFlop.evaluate([1, 0], props, 1);
    expect(out[0]).toBe(0);

    // Tick 2: Data=1, Clock=1 (Rising Edge!). Output should be 1
    out = flipFlop.evaluate([1, 1], props, 2);
    expect(out[0]).toBe(1);
    
    // Tick 3: Data=0, Clock=1 (No edge). Output should stay 1
    out = flipFlop.evaluate([0, 1], props, 3);
    expect(out[0]).toBe(1);
  });
});
```

## Testing Core Circuit Mutations

If you modify structural engine functions (like routing logic, or how `circuit.ts` handles connections), add tests to:
- `src/core/engine/__tests__/circuit.test.ts` (State mutators)
- `src/core/engine/__tests__/routing.test.ts` (Wire pathfinding)
- `src/core/utils/__tests__/nodeLayout.test.ts` (Pin coordinate math)

These tests ensure that the foundational data structures are robustly managed before they ever reach the UI rendering cycle.
