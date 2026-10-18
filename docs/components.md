# Creating and Configuring Components

> **Documentation Version:** `v1.2.2`

Logica's component system is declarative and modular. You can add new logic gates, basic I/O elements, or complex stateful Integrated Circuits (ICs) purely by defining a `NodeDefinition` in the Core Engine — the Toolbox, Properties Panel, and specialized editors automatically adapt based on declarative metadata.

For detailed specs of all existing built-in components and ICs, see **[`docs/code/core-nodes.md`](./code/core-nodes.md)**.

## Directory Structure

All built-in node definitions live in `src/core/engine/nodes/`:
- `NodeDefinition.ts`: TypeScript interfaces (`NodeDefinition`, `PinDefinition`).
- `basicNodes.ts`: Basic logic gates, I/O components, displays, wiring helpers (`JUNCTION`, `NC`, `NET_LABEL`, `BUS_BREAKOUT`), and annotations (`REGION_BOX`, `TEXT_LABEL`, `STICKY_NOTE`, `FSM_DIAGRAM`).
- `ics/`: Modular IC families:
  - `gates.ts`: 74LS series logic gate chips (`74LS00`, `74LS02`, `74LS04`, `74LS08`, `74LS30`, `74LS32`, `74LS86`)
  - `counters.ts`: Timers and synchronous counters (`NE555`, `74LS161`, `74LS191`)
  - `decoders.ts`: Decoders and demultiplexers (`74LS47`, `74LS138`, `74LS139`, `74LS154`)
  - `alu.ts`: Arithmetic logic units and adders (`74LS283`, `74LS181`)
  - `registers.ts`: Flip-flops, latches, buffers, and bus transceivers (`74LS173`, `74LS175`, `74LS241`, `74LS244`, `74LS245`, `74LS273`, `74LS373`, `74LS374`, `74LS541`)
  - `memory.ts`: EPROM and SRAM chips (`27C256`, `6116`, `62256`)
  - `pld.ts`: Programmable Logic Devices (`GAL22V10`)
- `index.ts`: Central `NodeRegistry` automatically built from `ALL_BUILTIN_NODES`.

---

## How to Add a New Component

### 1. Define the `NodeDefinition`
Choose the appropriate file in `src/core/engine/nodes/ics/` (or `basicNodes.ts`) and create your `NodeDefinition`:

```typescript
import { NodeDefinition } from '../NodeDefinition';

export const IC_74LS999Node: NodeDefinition = {
  type: '74LS999',
  label: '74LS999 Custom Chip',
  category: 'Integrated Circuits/Registers & Buffers',

  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',

  customPins: [
    { type: 'input', name: 'CLK', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'D',   pinNumber: 2, schematicSide: 'left', schematicRow: 2 },
    { type: 'input', name: 'GND', pinNumber: 3, schematicSide: 'bottom', schematicRow: 1 },
    { type: 'output', name: 'Q',  pinNumber: 4, schematicSide: 'right', schematicRow: 1 },
    { type: 'input', name: 'VCC', pinNumber: 5, schematicSide: 'top', schematicRow: 1 },
  ],

  defaultProperties: {
    label: '74LS999',
  },

  evaluate: (inputs, _props, _tick, internal, prevInputs) => {
    const [CLK, D, GND, VCC] = inputs;

    // Require valid power and ground
    if (VCC !== 1 || GND !== 0) {
      return [undefined]; // High-Z when unpowered
    }

    if (internal) {
      if (internal.latch === undefined) {
        internal.latch = 0;
      }
      const prevClk = prevInputs ? prevInputs[0] : internal.lastClk;
      // Rising-edge detection using prevInputs
      if (CLK === 1 && prevClk === 0) {
        internal.latch = D === 1 ? 1 : 0;
      }
      internal.lastClk = CLK === 1 ? 1 : 0;
      return [internal.latch];
    }

    return [0];
  }
};
```

### 2. Register in `src/core/engine/nodes/index.ts`
Export your new definition from `src/core/engine/nodes/ics/index.ts` and add it to `ALL_BUILTIN_NODES` in `src/core/engine/nodes/index.ts`.

Because `NodeRegistry`, `Toolbox`, `PropertiesPanel`, and `HexEditorView` read `ALL_BUILTIN_NODES` and declarative `NodeDefinition` fields directly, **no hardcoded UI lists need to be edited**.

---

## Declarative Metadata Reference

| Field | Type | Description |
| :--- | :--- | :--- |
| `category` | `string` | Determines which sidebar section in `Toolbox.tsx` displays the component (e.g., `'Basic Logic'`, `'Power & I/O/Inputs & Switches'`, `'Integrated Circuits/Counters & Timers'`, `'Annotations'`). |
| `renderAs` | `'GATE' \| 'DIP' \| 'BUS'` | Controls how the node is rendered and sized on the schematic canvas. |
| `variableInputs` | `{ min: number; max: number; label?: string }` | Automatically enables the dynamic input count selector in `PropertiesPanel.tsx`. |
| `variableOutputs` | `{ min: number; max: number; label?: string }` | Automatically enables the dynamic output count selector in `PropertiesPanel.tsx`. |
| `memorySize` | `number` | Marks the chip as a memory device with the given byte capacity (e.g., `2048` for `6116`, `32768` for `27C256`/`62256`), enabling the Live Hex Editor and ROM/RAM binary upload/download. |
| `disableTransform` | `boolean` | Hides rotation/flip controls in `PropertiesPanel.tsx` and blocks `R`, `X`, `Y` transform hotkeys on the canvas (used for `JUNCTION` and `NC`). |

---

## Working with Properties (`node.properties` vs `internal`)

### 1. Persistent User Configuration (`node.properties`)
User-editable settings such as `label`, `rotation`, `flipX`, `flipY`, `data` (for EPROM/SRAM), or `jedec`/`pldSource` (for `GAL22V10`) live directly on `node.properties`. These are saved in project files (`.logica`) and preserved when the simulation is reset.

### 2. Transient Runtime State (`internal` parameter in `evaluate()`)
Sequential state (flip-flop latches, counters, edge-detection flags, and SRAM runtime `memory`) is passed via the 4th parameter `internal` of `evaluate(inputs, properties, tickCount, internal, prevInputs)` and stored inside `SimulationState.nodeStates[node.id]`:
- When the user clicks **Reset Simulation**, `useSimulatorStore.resetSimulation()` resets `SimulationState.nodeStates`, cleanly resetting all flip-flops, counters, and volatile RAM without mutating `node.properties`.
