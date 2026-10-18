# Logica - Architecture Overview

> **Documentation Version:** `v1.2.2`

Logica is a high-performance, web-based digital logic simulator. It is designed around a strict separation of concerns, ensuring that the simulation engine remains completely decoupled from the UI rendering layer.

For a file-by-file and symbol-by-symbol technical reference, see **[`docs/code/README.md`](./code/README.md)**.

## Core Technologies
- **React**: Application shell, UI panels (`Topbar`, `CircuitTabs`, `Toolbox`, `PropertiesPanel`, `Bottombar`), and engineering workbenches (`CodeEditorView`, `HexEditorView`, `Ne555LabView`, `FsmDiagramView`).
- **Zustand**: Global state management with fine-grained primitive and bitmask selector subscriptions.
- **React-Konva**: HTML5 Canvas rendering for the interactive schematic workspace with Viewport Frustum Culling and Zoom-Out Level-of-Detail (LOD).
- **Vite & TypeScript**: Fast, strictly typed development and bundling.

## System Architecture

The application is split into three primary layers:

### 1. The Core Engine (`src/core/engine/`)
The engine is completely framework-agnostic (pure TypeScript) and handles the structural and electrical logic of the simulator:
*   **`circuit.ts`**: Manages the structural blueprint of the circuit. Handles adding/removing nodes and wires, dynamic pin resizing (`setNodeInputCount`, `setNodeOutputCount`), `JUNCTION` node splitting, subcircuit port synchronization (`syncSubcircuitInstances`), and 20px grid snapping.
*   **`simulation.ts`**: The electrical heart of the simulator. Compiles the structural graph (`nodes`, `wires`, `savedCircuits`) once per structural edit into a flat `Uint8Array`/`Int32Array` `CompiledCircuit`. Runs an event-driven relaxation loop (`dirtyNetsList` & ping-pong `dirtyNodesA`/`dirtyNodesB` queues), resolves multi-driver nets, weak pull resistors (`PULL_UP`/`PULL_DOWN`), and tri-state (`High-Z` / `undefined`) buses, evaluates hierarchical subcircuits, and executes zero-allocation intermediate batch ticks (`stepSimulationBatch`).
*   **`routing.ts`**: Computes orthogonal Manhattan wire paths with obstacle avoidance, port normal vectors (`nx`, `ny`), crossover jumper arcs, Axis-Aligned Bounding Boxes (`minX`, `maxX`, `minY`, `maxY`), and incremental per-wire topological caching.
*   **`subcircuitRegistry.ts`**: Dynamically generates `NodeDefinition` instances for user-created hierarchical subcircuits (`SUBCIRCUIT:<id>`).
*   **`nodes/`**: Declarative component definitions decoupled from React:
    *   `NodeDefinition.ts`: Defines the `NodeDefinition` interface, pin definitions, and declarative UI metadata (`category`, `variableInputs`, `variableOutputs`, `memorySize`, `disableTransform`).
    *   `basicNodes.ts`: Combinational gates (`AND`, `OR`, `NOT`, `NAND`, `NOR`, `XOR`, `XNOR`, `BUFFER`), sources & switches (`VCC`, `GND`, `PULL_UP`, `PULL_DOWN`, `CLOCK`, `INPUT`, `BUTTON`, `DIP_SWITCH`, `KEYPAD`), displays (`OUTPUT`, `7_SEG_DISPLAY`, `LED_BAR`), wiring helpers (`JUNCTION`, `NC`, `NET_LABEL`, `BUS_BREAKOUT`, `SUB_IN`, `SUB_OUT`, `SUB_IO`), and canvas annotations (`REGION_BOX`, `TEXT_LABEL`, `STICKY_NOTE`, `FSM_DIAGRAM`).
    *   `ics/`: Modular IC definitions grouped by family:
        *   `gates.ts` (`74LS00`, `74LS02`, `74LS04`, `74LS08`, `74LS30`, `74LS32`, `74LS86`)
        *   `counters.ts` (`NE555`, `74LS161`, `74LS191`)
        *   `decoders.ts` (`74LS47`, `74LS138`, `74LS139`, `74LS154`)
        *   `alu.ts` (`74LS283`, `74LS181`)
        *   `registers.ts` (`74LS173`, `74LS175`, `74LS241`, `74LS244`, `74LS245`, `74LS273`, `74LS373`, `74LS374`, `74LS541`)
        *   `memory.ts` (`27C256`, `6116`, `62256`)
        *   `pld.ts` (`GAL22V10` with pre-compiled sparse product terms and zero-allocation scratch buffers)

### 2. State Management (`src/store/useSimulatorStore.ts`)
Zustand bridges the Core Engine and the UI. To maintain high performance, state is strictly divided into two categories:
*   **Structural State (`nodes`, `wires`, `savedCircuits`, `openTabs`, `activeTabId`)**: Represents the physical schematic layout and configuration. Mutations to this state push snapshots onto the per-tab **Undo/Redo History Stack** using `structuredClone()`.
*   **Simulation State (`simState`)**: Represents high-frequency electrical signals (`0`, `1`, `'X'`, or `undefined` for High-Z), sequential `nodeStates` (`registers`, `count`, `lastClk`, volatile SRAM `memory`), and the global `tickCount`. It is intentionally *excluded* from the Undo/Redo stack and uses structural sharing so unchanged `pinStates` and `wireStates` preserve object identity.

### 3. The Rendering & UI Layer (`src/ui/`)
Logica provides four workspace modes (`editorMode`):
*   **Schematic Mode (`SchematicCanvas`)**: Main circuit design and live simulation canvas with multi-tab support (`CircuitTabs`).
*   **PLD Editor Mode (`CodeEditorView`)**: CUPL-style boolean equation & truth-table compiler for `GAL22V10` with live FSM state-diagram extraction (`FsmDiagramView`).
*   **Hex Editor Mode (`HexEditorView`)**: Live hexadecimal viewer and editor for ROM/RAM chips (`27C256`, `6116`, `62256`).
*   **NE555 Timer Lab Mode (`Ne555LabView`)**: Interactive Astable/Monostable oscillator workbench, waveform scope, internal comparator diagram, and inverse R/C solver.

Key rendering optimizations in `src/ui/canvas/` (`v1.2.2`):
*   **Viewport Frustum Culling**: `SchematicCanvas` and `WireRenderer` cull off-screen nodes (`nodes.length > 80`) and wires (`wires.length > 100`) using world-space `viewportBounds` and cached wire AABBs.
*   **Zoom-Out Level-of-Detail (LOD)**: At `schematicScale < 0.45`, `<Pin>` components unmount and short-circuit their Zustand selectors, `<SchematicICNode>` hides sub-pixel pin labels/numbers, and `<Grid>` steps up its cached `CanvasPattern` stride (`20px` → `40px` → `80px`).
*   **Combined `<Path>` Geometry**: Multi-pin components (`SchematicICNode`, `SchematicGateNode`, `Schematic7SegNode`, `SchematicLEDBarNode`, `SchematicDipSwitchNode`, `SchematicBusNode`) combine all pin legs into a single SVG `<Path>` primitive.
*   **`<SchematicNodeWrapper>`**: Shared Konva `<Group>` wrapper centralizing 20px grid snapping, anchor offsets (`getSchematicAnchor`), rotation/flip transforms, placement opacity, selection, and history saving.
