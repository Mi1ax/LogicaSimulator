# Creating and Configuring Components

Logica's component system is declarative and modular. You can add new logic gates, basic I/O elements, or complex stateful Integrated Circuits (ICs) purely by defining a `NodeDefinition` in the Core Engine — the Toolbox, Properties Panel, and Hex Editor automatically adapt based on declarative metadata.

## Directory Structure

All built-in node definitions live in `src/core/engine/nodes/`:
- `NodeDefinition.ts`: TypeScript interfaces (`NodeDefinition`, `NodeCategory`, `CustomPinDef`).
- `basicNodes.ts`: Basic logic gates, I/O components, displays, and wiring helpers (`JUNCTION`, `NC`, `NET_LABEL`, `BUS_SPLITTER`).
- `ics/`: Modular IC families:
  - `gates.ts`: 74LS series logic gate chips (`74LS00`, `74LS02`, `74LS04`, `74LS08`, `74LS30`, `74LS32`, `74LS86`)
  - `counters.ts`: Synchronous counters (`74LS161`, `74LS191`)
  - `decoders.ts`: Decoders and demultiplexers (`74LS47`, `74LS138`, `74LS154`)
  - `alu.ts`: Arithmetic logic units and adders (`74LS283`, `74LS181`)
  - `registers.ts`: Flip-flops, latches, buffers, and bus transceivers (`74LS173`, `74LS175`, `74LS241`, `74LS244`, `74LS245`, `74LS273`, `74LS373`, `74LS541`)
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
  category: '74LS Series ICs', // Automatically places this chip into the Toolbox category

  numInputs: 0,
  numOutputs: 0,
  renderAs: 'DIP',

  // Optional declarative metadata for UI & Canvas:
  // variableInputs: { min: 2, max: 8 },
  // variableOutputs: { min: 1, max: 16 },
  // memorySize: 2048,
  // disableTransform: true,

  customPins: [
    { type: 'input', name: 'CLK', pinNumber: 1, schematicSide: 'left', schematicRow: 0 },
    { type: 'input', name: 'D',   pinNumber: 2, schematicSide: 'left', schematicRow: 1 },
    { type: 'input', name: 'GND', pinNumber: 3 },
    { type: 'output', name: 'Q',  pinNumber: 4, schematicSide: 'right', schematicRow: 0 },
    { type: 'input', name: 'VCC', pinNumber: 5 },
  ],

  defaultProperties: {
    label: 'U1',
  },

  evaluate: (inputs, props) => {
    const [CLK, D, GND, VCC] = inputs;

    // Require valid power and ground
    if (VCC !== 1 || GND !== 0) {
      return [undefined]; // High-Z when unpowered
    }

    if (props) {
      if (!props.internal) {
        props.internal = { latch: 0, lastClk: 0 };
      }
      // Rising-edge detection
      if (CLK === 1 && props.internal.lastClk === 0) {
        props.internal.latch = D === 1 ? 1 : 0;
      }
      props.internal.lastClk = CLK === 1 ? 1 : 0;
      return [props.internal.latch];
    }

    return [0];
  }
};
```

### 2. Export from the IC Barrel (`src/core/engine/nodes/ics/index.ts`)
Add your new definition to the exported array in its family file (or `src/core/engine/nodes/ics/index.ts`) and optionally add its type literal to `BuiltinNodeType` in `src/core/models/types.ts`.

Because `NodeRegistry`, `Toolbox`, `PropertiesPanel`, and `HexEditorView` read `ALL_BUILTIN_NODES` and declarative `NodeDefinition` fields directly, **no hardcoded UI lists need to be edited**.

---

## Declarative Metadata Reference

| Field | Type | Description |
| :--- | :--- | :--- |
| `category` | `NodeCategory` | Determines which sidebar section in `Toolbox.tsx` displays the component (`'Basic Gates'`, `'I/O & Displays'`, `'Wiring'`, `'74LS Series ICs'`, `'Memory & PLD'`). |
| `renderAs` | `'GATE' \| 'DIP' \| 'BUS'` | Controls how the node is rendered and sized on the schematic canvas. |
| `variableInputs` | `{ min: number; max: number }` | Automatically enables the "Number of Inputs" selector in `PropertiesPanel.tsx`. |
| `variableOutputs` | `{ min: number; max: number }` | Automatically enables the "Number of Switches/Outputs" selector in `PropertiesPanel.tsx`. |
| `memorySize` | `number` | Marks the chip as a memory device with the given byte capacity (e.g., `2048` for 6116, `32768` for 27C256/62256), enabling the Live Hex Editor and ROM/RAM binary upload/download. |
| `disableTransform` | `boolean` | Hides rotation/flip controls in `PropertiesPanel.tsx` and blocks `R`, `X`, `Y` transform hotkeys on the canvas (used for `JUNCTION` and `NC`). |

---

## Working with Properties (`node.properties` vs `props.internal`)

Properties serve two distinct purposes:

### 1. Persistent User Configuration (`node.properties`)
User-editable settings such as `label`, `rotation`, `flipX`, `flipY`, `romData` (for EPROM/SRAM), or `jedec` (for `GAL22V10`) live directly on `node.properties`. These are saved in project files (`.logica`) and preserved when the simulation is reset.

### 2. Transient Runtime State (`node.properties.internal`)
Because the simulation engine can run at high speeds (up to 1MHz in batched ticks), `evaluate()` mutates `props.internal` **in-place** rather than dispatching React state updates:
- Store flip-flop latches, counters, edge-detection flags (`lastClk`), and SRAM runtime memory (`props.internal.memory`) inside `props.internal`.
- When the user clicks **Reset Simulation**, `useSimulatorStore.resetSimulation()` deletes `node.properties.internal` across all nodes, cleanly resetting all flip-flops, counters, and volatile RAM without losing user labels or uploaded ROM data.

---

## Custom Canvas Renderers (`SchematicNodeWrapper`)

Most components use existing renderers (`SchematicGateNode`, `SchematicICNode`, `SchematicBusNode`). If you create a new visual widget in `src/ui/canvas/nodes/schematic/`, wrap its Konva elements in `<SchematicNodeWrapper node={node}>`. This automatically provides:
- 20px grid drag snapping and `anchorX`/`anchorY` offset handling
- `rotation`, `flipX`, and `flipY` transformations
- Placement/paste ghost opacity and click-to-place completion
- Undo/Redo history snapshots on drag start
- Node selection (including `Shift+Click` multi-selection)
