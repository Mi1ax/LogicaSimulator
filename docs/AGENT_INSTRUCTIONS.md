# Logica Simulator - AI Agent Instructions

Welcome to the Logica Simulator project! When assisting with this codebase, please adhere to the following architectural guidelines and principles.

## 1. Project Architecture & Separation of Concerns
This project strictly separates the **Simulation Engine** (mathematical logic) from the **UI Layer** (rendering).
- **Engine (`src/core/engine/`)**: Pure TypeScript. Handles the 60Hz tick loop, topological execution, and structural mutators (adding nodes/wires). It has absolutely no knowledge of React, Konva, or the DOM.
- **UI (`src/ui/`)**: Built with React and `react-konva`. Strictly consumes the state provided by the engine and renders it visually.

## 2. State Management (Zustand)
We use Zustand (`src/store/useSimulatorStore.ts`) to bridge the UI and the Engine.
- **Structural Changes**: Adding nodes, drawing wires, or changing component types are dispatched as standard immutable state updates.
- **High-Frequency Simulation State**: To prevent the React UI from cratering under 60Hz updates, the simulator mutates `node.properties` **in-place** for internal memory (e.g., flip-flop latches, counters). The UI does *not* re-render on every tick unless a visible wire's signal changes.

## 3. Node Definitions
Components (Gates, ICs, IO) are defined in `src/core/engine/nodes/`.
- Never hardcode node types in the UI. Always query the `NodeRegistry` via `getNodeDefinition(node.type)`.
- **DIP ICs**: Multi-pin ICs use `renderAs: 'DIP'`. They rely on `customPins` arrays defining their logical `name`, `type` (input/output), and physical `pinNumber`.
- Always respect the fallback `getSafePinNumber(node.type, pin)` to ensure backwards compatibility with older `localStorage` saves that may lack the `pinNumber` property.

## 4. Routing (Manhattan Pathfinding)
Wires use orthogonal Manhattan routing defined in `src/core/engine/routing.ts`.
- The router calculates U-shapes, L-shapes, and mid-point splits based on normal vectors (`nx`, `ny`).
- A normal vector of `-1` means pointing Left, `1` means Right. 
- A normal vector of `0` is used for **draft floating wires** attached to the user's cursor, ensuring they connect directly without hooking.

## 5. Testing
The project uses `Vitest` for pure Node.js environment testing.
- **Combinational Gates**: Test using the visual CLI Truth Table generator in `src/core/engine/__tests__/gates.test.ts`.
- **Stateful ICs**: Write sequential tick tests to simulate clock edges and memory latches.
- UI tests are generally avoided in favor of testing the pure underlying mathematical state.

## 6. Styling
- **HTML/DOM**: Use Tailwind CSS (configured in `tailwind.config.js`).
- **Canvas/Konva**: Do not hardcode colors in Konva components. Always use the central `getCanvasTheme(isDark)` utility in `src/ui/canvas/theme.ts` to ensure Light/Dark mode compatibility.

## 7. Performance Guidelines
- **Deep Cloning**: Always use the native `structuredClone()` for deep copies (especially in the Undo/Redo stack). Avoid `JSON.parse(JSON.stringify)`.
- **Render Optimization**: Ensure heavy Konva calculations (like wire path SVG string generation) are wrapped in `useMemo` and rely strictly on structural dependencies, NOT simulation tick dependencies.

## 8. Git Operations
- **Do not make git commits** unless the user explicitly asks you to. Provide the code and wait for their cue to version control it.
