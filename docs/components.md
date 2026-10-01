# Creating and Configuring Components

Logica's component system is designed to be highly modular. You can add new logic gates, basic IO elements, or complex stateful Integrated Circuits (ICs) purely by writing TypeScript logic, without touching the UI layer.

## How to Add a New Component

To add a new component, you must define it in the Core Engine and then expose it to the UI.

### 1. Define the Electrical Logic
Navigate to `src/core/engine/nodes/`. You will find definition files like `gates.ts` and `icNodes.ts`.

A node definition must conform to the `NodeDefinition` interface:
```typescript
import { NodeDefinition } from '../../models/types';

export const MyCustomChip: NodeDefinition = {
  type: 'MY_CHIP',
  name: 'My Custom Chip',
  description: 'Does something cool',
  
  // Choose how it looks in the UI ('GATE', 'DIP', or omitted for default)
  renderAs: 'DIP', 
  
  // Define custom pins (required for DIP ICs to specify top/bottom layout)
  customPins: [
    { type: 'input', name: 'A', pinNumber: 1 },
    { type: 'output', name: 'Q', pinNumber: 2 }
  ],
  
  // Default properties injected into the node upon creation
  defaultProperties: {
    label: 'CHIP1',
    internalMemory: 0
  },

  /**
   * The evaluation function. Runs on every simulation tick.
   * @param inputs Array of input values (0, 1, or undefined/High-Z)
   * @param props The node's current properties/state (you may mutate this for stateful logic)
   * @param tickCount The current global tick count
   * @returns An array of output signals ordered by pin index
   */
  evaluate: (inputs, props, tickCount) => {
    const A = inputs[0] ?? 0; // Read input A, default to 0 if floating
    
    // Read and mutate internal state via properties in-place
    if (A === 1) {
        props.internalMemory = (props.internalMemory || 0) + 1;
    }

    return [ props.internalMemory % 2 ]; // Output array
  }
};
```

### 2. Register the Component
Once defined, export it and add it to the central registry in `src/core/engine/nodes/index.ts`:

```typescript
import { MyCustomChip } from './icNodes';

const nodeDefinitions: Record<string, NodeDefinition> = {
  // ... existing nodes
  'MY_CHIP': MyCustomChip
};
```

### 3. Add to the Toolbox UI
To make the component draggable from the sidebar, add it to `src/ui/components/Toolbox.tsx`:

```tsx
const CATEGORIES = [
  // ...
  {
    name: 'Custom ICs',
    items: [
      { type: 'MY_CHIP', label: 'My Chip', description: 'Does something cool' }
    ]
  }
];
```

---

## Working with Properties (`node.properties`)

Properties act as both **User Configurations** (like labels or gate input counts) and **Internal Memory** for stateful components (like Flip-Flops and Counters).

### User Configuration Properties
You can expose properties to the user via the Properties Panel (`src/ui/components/PropertiesPanel.tsx`). 

For example, the user can dynamically change how many inputs an AND gate has. When they do, the store calls:
```typescript
useSimulatorStore.getState().setNodeInputCount(nodeId, newCount);
```
This strictly modifies the structural blueprint, triggering the UI to instantly redraw the gate with the new pin layout.

### Stateful Memory Properties
Because the simulator runs continuously at a high frequency (e.g. 60Hz), you cannot dispatch Zustand store updates on every tick without cratering UI performance.

Instead, the `evaluate` function intentionally mutates `props` **in-place**:
1. Define a default value in `defaultProperties: { lastClock: 0 }`.
2. In `evaluate(inputs, props, tickCount)`, read `props.lastClock`.
3. If the state changes, simply mutate the object: `props.lastClock = 1`.

Because the simulation engine passes `node.properties` by reference, this provides extremely fast internal memory that survives across ticks without triggering heavy React UI reconciliations.
