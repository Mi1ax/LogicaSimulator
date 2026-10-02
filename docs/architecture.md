# Logica - Architecture Overview

Logica is a high-performance, web-based digital logic simulator. It is designed around a strict separation of concerns, ensuring that the simulation engine remains completely decoupled from the UI rendering layer.

## Core Technologies
- **React**: For the application shell, UI panels (Toolbox, Properties, Bottombar), and managing the component tree.
- **Zustand**: For global, immutable state management.
- **React-Konva**: For HTML5 Canvas-based rendering of the interactive circuit board.
- **Vite & TypeScript**: For fast, type-safe development.

## System Architecture

The application is split into three primary layers:

### 1. The Core Engine (`src/core/engine/`)
The engine is completely framework-agnostic (pure TypeScript) and handles the physical and electrical logic of the simulator.
*   **`circuit.ts`**: Manages the structural blueprint of the board. Handles adding/removing nodes, explicitly managing `JUNCTION` node routing, and 10px vs 20px grid snapping algorithms.
*   **`simulation.ts`**: The electrical heart of the app. It runs a rapid discrete-event tick loop (up to 50Hz), reading pin states, processing unpowered high-Z logic, and calculating the next state.
*   **`routing.ts`**: Responsible for calculating Manhattan (orthogonal) wire paths that prevent looping and respect port normal vectors.
*   **`nodes/`**: The component definitions. Every logic gate, IO switch, or complex integrated circuit (e.g., 74LS161 Counter) is defined purely by its electrical properties and memory state, totally separated from React.

### 2. State Management (`src/store/useSimulatorStore.ts`)
Zustand acts as the bridge between the Core Engine and the UI. To maintain high performance, the state is strictly divided into two categories:
*   **Structural State (`nodes`, `wires`)**: Represents the physical layout of the board. Changes to this state (e.g., dragging a chip, drawing a wire) trigger the **Undo/Redo History Stack**.
*   **Simulation State (`simState`)**: Represents the high-frequency electrical signals (`0`, `1`, `High-Z`) and the global `tickCount`. This updates continuously. It is intentionally *excluded* from the Undo/Redo stack to prevent memory bloat.

### 3. The Rendering Layer (`src/ui/canvas/`)
Logica features a **Dual-Mode Canvas** architecture to represent abstract logic and physical realities:
*   **Schematic Mode (`SchematicCanvas`)**: Renders IEEE standard gate symbols, abstract logic boxes, and explicit routing junctions. Wires are orthogonally snapped.
*   **Board Mode (`BoardCanvas`)**: Renders photorealistic traces, through-hole PCB pads, and standard physical DIP packages (like a real 74LS chip).

Because the simulation ticks at 50Hz, the rendering layer is heavily optimized using memoization and localized subscriptions:
*   **Memoization**: The canvas root only subscribes to node IDs (`useShallow`). Individual components (`<SchematicICNode>`, `<BoardGateNode>`) pull their own data and are wrapped in `React.memo` to prevent re-rendering unless physically moved.
*   **Granular Wire Subscriptions**: Wires are aggregated through a central `<WireRenderer>`. Paths are strictly memoized and re-calculated only when endpoints move, while their fast SVG `stroke` changes efficiently read from `simState`.

## Event Flow Lifecycle
1. User drops a component from the Toolbox → Zustand `addNode()` mutates the structural state.
2. User clicks a pin and drags → Zustand `updateDraftWire()` draws a dashed preview line.
3. User drops the wire on a pin or another wire (spawning a junction) → Zustand `completeWire()` connects them structurally.
4. Simulation Tick (via `Bottombar`) → `computeNextState()` reads all outputs, propagates signals across wires, feeds inputs into node `evaluate()` functions, and mutates internal `node.properties` (memory).
5. UI Update → Memoized `WireRenderer` and `IONode` components observe changes in `simState` and repaint (e.g., Wire turns red, LED turns on).
