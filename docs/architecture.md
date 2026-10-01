# Logica - Architecture Overview

Logica is a high-performance, web-based digital logic simulator. It is designed around a strict separation of concerns, ensuring that the simulation engine remains completely decoupled from the UI rendering layer.

## Core Technologies
- **React**: For the application shell, UI panels (Toolbox, Properties), and managing the component tree.
- **Zustand**: For global, immutable state management.
- **React-Konva**: For HTML5 Canvas-based rendering of the interactive circuit board.
- **Vite & TypeScript**: For fast, type-safe development.

## System Architecture

The application is split into three primary layers:

### 1. The Core Engine (`src/core/engine/`)
The engine is completely framework-agnostic (pure TypeScript) and handles the physical and electrical logic of the simulator.
*   **`circuit.ts`**: Manages the structural blueprint of the board. Handles adding/removing nodes, routing wires, and managing coordinates.
*   **`simulation.ts`**: The electrical heart of the app. It runs a rapid evaluation loop (typically 10-100Hz), reading the current state of all node pins and calculating the next state.
*   **`routing.ts`**: Responsible for calculating Manhattan (orthogonal) wire paths and jump-bridges when wires cross.
*   **`nodes/`**: The component definitions. Every logic gate, switch, or integrated circuit (IC) is defined purely by its electrical properties and evaluation function.

### 2. State Management (`src/store/useSimulatorStore.ts`)
Zustand acts as the bridge between the Core Engine and the UI. To maintain high performance, the state is strictly divided into two categories:
*   **Structural State (`nodes`, `wires`)**: Represents the physical layout of the board. Changes to this state (e.g., dragging a chip, drawing a wire) trigger the **Undo/Redo History Stack**.
*   **Simulation State (`simState`)**: Represents the high-frequency electrical signals (`0`, `1`, `High-Z`). This updates up to 60 times a second. It is intentionally *excluded* from the Undo/Redo stack to prevent memory bloat.

### 3. The Rendering Layer (`src/ui/canvas/`)
The canvas is rendered using React-Konva. Because the simulation ticks at 60Hz, the rendering layer is heavily optimized using memoization and localized subscriptions:
*   **Memoization**: The canvas root only subscribes to node IDs (`useShallow`). Individual components (`<GateNode>`, `<ICNode>`) pull their own data and are wrapped in `React.memo` to prevent re-rendering unless physically moved.
*   **Granular Wire Subscriptions**: Wires are split into `<SingleWire>` components. Instead of re-rendering the whole board when a clock ticks, only the individual wire's SVG path checks the `simState` and updates its color.

## Event Flow Lifecycle
1. User drops a component → Zustand `addNode()` mutates the structural state.
2. User clicks a pin → Zustand `startWire()` initiates wiring.
3. Simulation Tick → `computeNextState()` reads all outputs, propagates signals across wires, and feeds inputs into node `evaluate()` functions.
4. UI Update → Memoized `<SingleWire>` and `<IONode>` components observe changes in `simState` and repaint (e.g., Wire turns red, LED turns on).
