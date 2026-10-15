# Logica - Architecture Overview

Logica is a high-performance, web-based digital logic simulator. It is designed around a strict separation of concerns, ensuring that the simulation engine remains completely decoupled from the UI rendering layer.

## Core Technologies
- **React**: Application shell, UI panels (`Topbar`, `Toolbox`, `PropertiesPanel`, `Bottombar`), and modal views.
- **Zustand**: Global state management with fine-grained selector subscriptions.
- **React-Konva**: HTML5 Canvas rendering for the interactive schematic workspace.
- **Vite & TypeScript**: Fast, strictly typed development and bundling.

## System Architecture

The application is split into three primary layers:

### 1. The Core Engine (`src/core/engine/`)
The engine is completely framework-agnostic (pure TypeScript) and handles the structural and electrical logic of the simulator:
*   **`circuit.ts`**: Manages the structural blueprint of the circuit. Handles adding/removing nodes and wires, dynamic pin resizing (`updateNodeInputCount`, `updateNodeOutputCount`), `JUNCTION` node splitting, and grid snapping.
*   **`simulation.ts`**: The electrical heart of the simulator. Runs a discrete-event tick loop (from 1Hz up to batched 1MHz execution), resolves multi-driver nets and tri-state (`High-Z` / `undefined`) buses, evaluates hierarchical subcircuits, and computes next pin states.
*   **`routing.ts`**: Computes orthogonal Manhattan wire paths with obstacle avoidance, port normal vectors (`nx`, `ny`), and topological hash caching (invalidated only when endpoint positions or node `rotation`/`flipX`/`flipY` transforms change).
*   **`nodes/`**: Declarative component definitions decoupled from React:
    *   `NodeDefinition.ts`: Defines the `NodeDefinition` interface, pin definitions, and declarative UI metadata (`category`, `variableInputs`, `variableOutputs`, `memorySize`, `disableTransform`).
    *   `basicNodes.ts`: Combinational gates (`AND`, `OR`, `NOT`, `NAND`, `NOR`, `XOR`, `XNOR`, `BUFFER`), I/O & displays (`INPUT`, `OUTPUT`, `CLOCK`, `BUTTON`, `DIP_SWITCH`, `7_SEG_DISPLAY`, `LED_BAR`, `VCC`, `GND`), and wiring helpers (`JUNCTION`, `NC`, `NET_LABEL`, `BUS_SPLITTER`, `SUB_IN`, `SUB_OUT`, `SUB_IO`).
    *   `ics/`: Modular IC definitions grouped by family:
        *   `gates.ts` (`74LS00`, `74LS02`, `74LS04`, `74LS08`, `74LS30`, `74LS32`, `74LS86`)
        *   `counters.ts` (`74LS161`, `74LS191`)
        *   `decoders.ts` (`74LS47`, `74LS138`, `74LS154`)
        *   `alu.ts` (`74LS283`, `74LS181`)
        *   `registers.ts` (`74LS173`, `74LS175`, `74LS241`, `74LS244`, `74LS245`, `74LS273`, `74LS373`, `74LS541`)
        *   `memory.ts` (`27C256`, `6116`, `62256`)
        *   `pld.ts` (`GAL22V10`)
    *   `subcircuitNode.ts`: Dynamically generates `NodeDefinition` instances for user-created subcircuits (`SUBCIRCUIT:<name>`).

### 2. State Management (`src/store/useSimulatorStore.ts`)
Zustand bridges the Core Engine and the UI. To maintain high performance, state is strictly divided into two categories:
*   **Structural State (`nodes`, `wires`, `subcircuits`)**: Represents the physical schematic layout and configuration. Mutations to this state push snapshots onto the **Undo/Redo History Stack** using `structuredClone()`.
*   **Simulation State (`simState`)**: Represents high-frequency electrical signals (`0`, `1`, `'X'`, or `undefined` for High-Z) and the global `tickCount`. It is intentionally *excluded* from the Undo/Redo stack. Transient chip state (flip-flop latches, counters, SRAM runtime contents) is stored inside `node.properties.internal` and mutated in-place during `evaluate()` to avoid React re-renders on every tick.

### 3. The Rendering & UI Layer (`src/ui/`)
Logica provides three workspace modes (`appMode`):
*   **Schematic Mode (`SchematicCanvas`)**: Main circuit design and live simulation canvas.
*   **Subcircuit Mode (`SubcircuitEditorView`)**: Dedicated workspace for designing and saving reusable custom IC blocks.
*   **Hex Editor Mode (`HexEditorView`)**: Live hexadecimal viewer and editor for ROM/RAM chips (`27C256`, `6116`, `62256`).

Key rendering optimizations in `src/ui/canvas/`:
*   **`<SchematicNodeWrapper>`**: Shared Konva `<Group>` wrapper used by all schematic node components (`SchematicGateNode`, `SchematicICNode`, `SchematicIONode`, `Schematic7SegNode`, `SchematicDipSwitchNode`, `SchematicButtonNode`, `SchematicLEDBarNode`, `SchematicBusNode`, `SchematicNetLabelNode`, `SchematicNCNode`). It centralizes 20px grid snapping, anchor offsets (`getSchematicAnchor`), rotation/flip transforms, placement opacity, selection, and history saving.
*   **Localized Subscriptions & Memoization**: `SchematicCanvas` only subscribes to the array of node IDs (`useShallow`). Each node component is wrapped in `React.memo` and subscribes only to the specific pin states it visually needs.
*   **Centralized `<WireRenderer>`**: Computes and caches Manhattan wire paths and crossover arcs once per structural change, while updating stroke colors reactively from `simState`.

## Event Flow Lifecycle
1. **Placement**: User selects a component in `Toolbox` → `startPlacingNode(type)` spawns a floating node that follows the cursor → clicking the canvas calls `finishPlacingNode()`.
2. **Wiring**: Clicking a `<Pin>` starts a `draftWire`. Clicking another pin or wire segment invokes `completeWire()` (automatically inserting a `JUNCTION` if landing on an existing wire).
3. **Simulation Tick**: The interval loop in `useSimulatorStore` calls `computeNextState()`, which resolves nets, propagates signals across wires and `NET_LABEL` tunnels, calls each node's `evaluate()` function, and updates `simState`.
4. **Visual Repaint**: Only components whose subscribed pin states changed re-render on the Konva stage.
