# Testing Logica Components

Logica uses [Vitest](https://vitest.dev/) for unit testing its core simulation engine, schematic layout geometry, and components. Because the simulation logic is isolated from the React UI layer, tests run in milliseconds in a pure Node.js environment.

## Running Tests

To run the full test suite in watch mode:
```bash
npm test
```

To run all tests once (CI mode):
```bash
npx vitest run
```

To run the visual truth table tests for basic logic gates:
```bash
npm run test:gates
```

---

## Existing Test Suite Overview

| Test File | What It Covers |
| :--- | :--- |
| `src/core/engine/__tests__/gates.test.ts` | Exhaustive truth table verification for combinational logic gates (`AND`, `OR`, `NOR`, `XOR`, `NOT`) with formatted CLI output. |
| `src/core/engine/__tests__/circuit.test.ts` | Structural mutations: adding/removing nodes, connecting wires, and cleaning up attached wires on node deletion. |
| `src/core/engine/__tests__/simulation.test.ts` | End-to-end signal propagation across nodes and wires across simulation ticks. |
| `src/core/utils/__tests__/schematicLayout.test.ts` | Schematic node dimensions and pin coordinate calculations. |
| `src/core/utils/__tests__/schematicRotation.test.ts` | Pin positions and normal vectors (`nx`, `ny`) under all combinations of `rotation` (`0°`, `90°`, `180°`, `270°`), `flipX`, and `flipY`. |

---

## Testing Logic Gates and Truth Tables

If you add or modify a combinational logic gate:
1. Open `src/core/engine/__tests__/gates.test.ts`.
2. Add your gate's type to `gatesToTest` or write a dedicated test block using `generateTruthTable()`.
3. Run `npm run test:gates` to inspect the generated truth table and verify assertions.

---

## Testing Stateful ICs (`src/core/engine/nodes/ics/`)

For stateful Integrated Circuits (counters, registers, flip-flops, memory, PLDs), write sequential tick tests that verify clock-edge triggering, asynchronous resets, and tri-state (`undefined` / High-Z) outputs:

```typescript
import { describe, it, expect } from 'vitest';
import { getNodeDefinition } from '../nodes';

describe('74LS161 Counter', () => {
  it('increments on rising clock edge when powered and enabled', () => {
    const def = getNodeDefinition('74LS161')!;
    const props: Record<string, any> = { ...def.defaultProperties };

    // Ensure VCC (pin 16) = 1 and GND (pin 8) = 0
    // Construct inputs matching def.customPins input order...
    // Simulate clock low -> clock high transition and assert outputs.
  });
});
```

## Testing Schematic Geometry & Transformations

Whenever you add a component with custom pin positions in `src/core/utils/schematicLayout.ts`:
- Ensure all pin coordinates in `getSchematicPinPosition()` align to the **20px grid** (`x % 20 === 0`, `y % 20 === 0`).
- Run `npx vitest run src/core/utils/__tests__/schematicRotation.test.ts` to verify that rotating (`R`) or flipping (`X`, `Y`) the node keeps all pins strictly aligned to the 20px grid.
