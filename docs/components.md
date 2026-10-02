# Creating and Configuring Components

Logica's component system is designed to be highly modular. You can add new logic gates, basic IO elements, or complex stateful Integrated Circuits (ICs) purely by writing TypeScript logic, without touching the UI layer.

## How to Add a New Component

To add a new component, you must define it in the Core Engine and then expose it to the UI.

### 1. Define the Electrical Logic
Navigate to `src/core/engine/nodes/`. You will find definition files like `basicNodes.ts` and `icNodes.ts`.

A node definition must conform to the `NodeDefinition` interface:
```typescript
import { NodeDefinition } from './NodeDefinition';

export const MyCustomChip: NodeDefinition = {
  type: 'MY_CHIP',
  label: 'My Custom Chip',
  
  // Ignored if customPins is provided, but required by interface
  numInputs: 0,
  numOutputs: 0,
  
  // Choose how it looks in the UI ('GATE', 'DIP', or omitted for default)
  renderAs: 'DIP', 
  
  // Define custom pins (required for DIP ICs to specify standard counter-clockwise pin layout)
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
    if (props) {
      if (A === 1) {
          props.internalMemory = (props.internalMemory || 0) + 1;
      }
    }

    return [ props ? (props.internalMemory % 2) : 0 ]; // Output array matching output pins
  }
};
```

### 2. Register the Component
Once defined, export it and add it to the central registry in `src/core/engine/nodes/index.ts`:

```typescript
import { MyCustomChip } from './icNodes';

export const NodeRegistry: Record<string, NodeDefinition> = {
  // ... existing nodes
  [MyCustomChip.type]: MyCustomChip
};
```

### 3. Add to the Toolbox UI
To make the component draggable from the sidebar, add it to `src/ui/components/Toolbox.tsx`. The toolbox will automatically read your component's `label` from the registry:

```tsx
const CATEGORIES: ToolCategory[] = [
  // ...
  {
    name: 'Custom ICs',
    items: [
      { type: 'MY_CHIP' } // No label/description needed here, it infers from NodeDefinition
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
Because the simulator runs continuously at a high frequency (e.g. up to 50Hz), you cannot dispatch Zustand store updates on every tick without cratering UI performance.

Instead, the `evaluate` function intentionally mutates `props` **in-place**:
1. Define a default value in `defaultProperties: { lastClk: 0 }`.
2. In `evaluate(inputs, props, tickCount)`, read `props.lastClk`.
3. If the state changes, simply mutate the object: `props.lastClk = 1`.

Because the simulation engine passes `node.properties` by reference, this provides extremely fast internal memory that survives across ticks without triggering heavy React UI reconciliations.

When the user hits the "Stop & Reset" button on the Bottombar, the simulation store explicitly zeroes out these memory properties (like `counter` and `lastClk`) to reset the chip.
