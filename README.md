# Logica Simulator

> **Version:** `v1.2.2`

Logica is a modern, high-performance digital logic and IC simulator built on a highly optimized React-Konva canvas. It features a compiled flat-array, event-driven simulation engine fully decoupled from the visual layer, allowing for multi-kilohertz execution, zero-lag zooming with Viewport Frustum Culling and Level-of-Detail (LOD), and a declarative, extensible architecture.

> [!NOTE]
> This project is developed with the assistance of AI.

## Features
- **Strict Separation of Concerns**: Core engine logic and simulation state are completely decoupled from UI components.
- **Compiled Event-Driven Simulation Engine**: Compiles circuits into flat typed arrays (`Uint8Array` / `Int32Array`) with event-driven dirty-net & dirty-node relaxation queues and zero-allocation intermediate batch ticks (`1 Hz` up to `1 MHz`).
- **Declarative Component Architecture**: Add new logic gates or 74LS/Memory/PLD chips in `src/core/engine/nodes/ics/` with declarative metadata (`category`, `variableInputs`, `variableOutputs`, `memorySize`, `disableTransform`) — the Toolbox, Properties Panel, and Hex Editor adapt automatically.
- **Advanced IC, Timer & PLD Simulation**:
  - **74LS Series**: Gates, Synchronous Counters (`74LS161`, `74LS191`), Decoders (`74LS47`, `74LS138`, `74LS139`, `74LS154`), Arithmetic/ALU (`74LS283`, `74LS181`), Registers & Bus Transceivers (`74LS173`, `74LS175`, `74LS241`, `74LS244`, `74LS245`, `74LS273`, `74LS373`, `74LS374`, `74LS541`).
  - **NE555 Precision Timer Lab**: Astable, Monostable, and Comparator modes with an interactive R/C oscilloscope workbench and inverse R/C solver.
  - **Memory ICs**: `27C256` EPROM, `6116` & `62256` SRAM with a live Hex Editor.
  - **GAL22V10 PLD & FSM Extractor**: Built-in CUPL-style boolean equation & truth-table compiler (`compilePldToJedec`), JEDEC fuse map inspector, and live Finite State Machine transition graph visualizer (`FsmDiagramView`).
- **Hierarchical Subcircuits & Multi-Tab Workspace**: Create reusable custom IC modules with `SUB_IN`, `SUB_OUT`, and bidirectional `SUB_IO` pins and edit them across tabs.
- **High-Performance Canvas**: Viewport Frustum Culling, Zoom-Out LOD, combined `<Path>` geometry, cached `CanvasPattern` dot grid, and incremental Manhattan wire routing with crossover jumpers.

## Documentation (`v1.2.2`)
- **[Complete Codebase Reference (`docs/code/`)](./docs/code/README.md)**: Detailed technical reference for every file, module, type, function, and component in `src/`:
  - [Core Models (`src/core/models/types.ts`)](./docs/code/core-models.md)
  - [Core Engine (`src/core/engine/*`)](./docs/code/core-engine.md)
  - [Declarative Nodes & ICs (`src/core/engine/nodes/*`)](./docs/code/core-nodes.md)
  - [Core Utilities (`src/core/utils/*`)](./docs/code/core-utils.md)
  - [Zustand Store (`src/store/useSimulatorStore.ts`)](./docs/code/store.md)
  - [Canvas & Specialized Views (`src/ui/canvas/*`)](./docs/code/ui-canvas.md)
  - [App Shell & UI Components (`src/ui/components/*`)](./docs/code/ui-components.md)
- [Architecture Overview](./docs/architecture.md): High-level overview of the UI vs. Engine separation of concerns, state management, and rendering pipeline.
- [Components & Properties](./docs/components.md): Guide to creating new components and configuring declarative metadata and internal memory.
- [Testing Guide](./docs/testing.md): How to run and write unit tests for combinational gates, stateful ICs, and schematic geometry.
- [AI Agent Instructions](./docs/AGENT_INSTRUCTIONS.md): Guidelines and conventions for AI coding assistants working on this repository.

## Getting Started

### Prerequisites
- Node.js (v18+)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Simulator
Start the local Vite development server:
```bash
npm run dev
```
*Tip: Load built-in example circuits (including the **07. MQC CPU Computer**) directly from the **Examples** dropdown in the top bar.*

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
```

## Tech Stack
- **Vite + React + TypeScript**
- **Zustand** (State Management)
- **React-Konva** (Canvas Rendering)
- **Vitest** (Unit Testing)
- **Tailwind CSS v4** (UI Styling)
- **Lucide React** (Icons)
