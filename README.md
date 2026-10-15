# Logica Simulator

Logica is a modern, high-performance digital logic and IC simulator built on a highly optimized React-Konva canvas. It features a pure discrete-event simulation engine fully decoupled from the visual layer, allowing for fast execution, zero-lag zooming, and a declarative, extensible architecture.

> [!NOTE]
> This project is developed with the assistance of AI.

## Features
- **Strict Separation of Concerns**: Core engine logic and simulation state are completely decoupled from UI components.
- **Declarative Component Architecture**: Add new logic gates or 74LS/Memory/PLD chips in `src/core/engine/nodes/ics/` with declarative metadata (`category`, `variableInputs`, `variableOutputs`, `memorySize`, `disableTransform`) — the Toolbox, Properties Panel, and Hex Editor adapt automatically.
- **Advanced IC & PLD Simulation**: Accurate timing and state emulation for 74LS series chips (gates, counters, decoders, ALU, registers/transceivers), Memory ICs (`27C256` EPROM, `6116` & `62256` SRAM), and `GAL22V10` PLDs with JEDEC fuse map support.
- **Hierarchical Subcircuits**: Create reusable custom IC modules with `SUB_IN`, `SUB_OUT`, and bidirectional `SUB_IO` pins.
- **Live Hex Editor**: Inspect, edit, upload, and download ROM/RAM memory contents in real-time while the simulation is running.
- **High-Performance Canvas**: Utilizes targeted Zustand selectors, `<SchematicNodeWrapper>`, SVG geometry memoization, and cached Manhattan wire routing to handle complex circuits smoothly.
- **Manhattan Routing & Buses**: Automatic orthogonal wire routing with visual crossover jumpers, 8-bit `BUS_SPLITTER` nodes, `NET_LABEL` wireless tunnels, and `NC` (Not Connected) pin markers.
- **Flexible Simulation Clock**: Real-time tick engine with adjustable clock speeds from 1Hz up to 1MHz, step-by-step debugging, and interactive inputs (Buttons, DIP Switches, 7-Segment Displays, LED Bars).

## Documentation
- [Architecture Overview](./docs/architecture.md): Deep dive into the UI vs. Engine separation of concerns, state management, and rendering pipeline.
- [Components & Properties](./docs/components.md): How to create new components and configure their declarative metadata and internal memory.
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
