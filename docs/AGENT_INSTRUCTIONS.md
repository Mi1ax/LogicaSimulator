# Logica Simulator - AI Agent Instructions

Welcome to the Logica Simulator project! When assisting with this codebase, please adhere to the following architectural guidelines and principles.

## 1. Project Architecture & Separation of Concerns
This project strictly separates the **Simulation Engine** (mathematical logic) from the **UI Layer** (rendering):
- **Engine (`src/core/engine/`)**: Pure TypeScript. Handles discrete-event tick simulation, multi-driver net resolution, Manhattan wire routing, and structural mutators. It has zero knowledge of React, Konva, or the DOM.
- **UI (`src/ui/`)**: Built with React and `react-konva`. Consumes engine state via Zustand (`src/store/useSimulatorStore.ts`) and renders it visually.

## 2. State Management (Zustand)
- **Structural Changes**: Adding/moving nodes, drawing wires, or changing pin counts are dispatched as immutable state updates and recorded in the Undo/Redo history stack via `structuredClone()`.
- **High-Frequency Simulation State**: To avoid React re-render overhead during high-speed simulation (up to 1MHz batched ticks), stateful components mutate `node.properties.internal` **in-place** (e.g., flip-flop latches, counters, volatile SRAM memory). `resetSimulation()` clears `node.properties.internal` while preserving user properties (`label`, `romData`, `jedec`).

## 3. Declarative Node Definitions & Modular ICs
Components are defined in `src/core/engine/nodes/`:
- `basicNodes.ts` for gates, I/O, displays, and wiring helpers (`JUNCTION`, `NC`, `NET_LABEL`, `BUS_SPLITTER`).
- `ics/` for integrated circuits, split by family (`gates.ts`, `counters.ts`, `decoders.ts`, `alu.ts`, `registers.ts`, `memory.ts`, `pld.ts`).
- **Never hardcode node type lists in UI components.** Always query `getNodeDefinition(node.type)` and use declarative metadata on `NodeDefinition`:
  - `category`: Organizes the component in `Toolbox.tsx`.
  - `variableInputs` / `variableOutputs`: Enables dynamic pin count controls in `PropertiesPanel.tsx`.
  - `memorySize`: Enables ROM/RAM binary management and `HexEditorView.tsx`.
  - `disableTransform`: Disables rotation/flipping for non-directional markers (`JUNCTION`, `NC`).
- Always respect `getSafePinNumber(node.type, pin)` for backwards compatibility with older saved circuits.

## 4. Schematic Canvas & `<SchematicNodeWrapper>`
- All schematic node components in `src/ui/canvas/nodes/schematic/` (except `SchematicJunctionNode`) must wrap their Konva shapes in `<SchematicNodeWrapper node={node}>` (`SchematicNodeWrapper.tsx`). Do not duplicate `<Group>` drag/snap/transform/selection boilerplate.
- All schematic pins and node anchors (`getSchematicAnchor`, `getSchematicPinPosition` in `src/core/utils/schematicLayout.ts`) must align to the **20px grid** so that rotations (`R`) and flips (`X`, `Y`) keep pins on grid intersections.

## 5. Routing (Manhattan Pathfinding)
Wires use orthogonal Manhattan routing defined in `src/core/engine/routing.ts`:
- The router calculates paths based on pin coordinates, port normal vectors (`nx`, `ny`), and obstacle bounding boxes.
- Wire routing is cached by a structural hash (`lastTopologyHash`) that includes endpoint coordinates and node transforms (`rotation`, `flipX`, `flipY`).

## 6. Testing & Verification
The project uses `Vitest` for unit testing:
- Always run `npx tsc --noEmit && npm test -- --run` after making changes to verify zero TypeScript errors and ensure all gate, circuit, simulation, and rotation/grid-alignment tests pass.

## 7. Styling
- **HTML/DOM**: Use Tailwind CSS v4.
- **Canvas/Konva**: Use `getCanvasTheme(isDark)` in `src/ui/canvas/theme.ts` for Light/Dark mode compatibility.

## 8. Git Operations
- **NEVER run `git commit`** unless the user's message explicitly contains the phrase `"Делай commit"`.
- When asked to commit, follow the commit message prefix convention in `.agents/rules/commits.md` (`[Feature]`, `[Fix]`, `[UI]`, `[Core]`, `[Refactor]`, `[Chore]`, `[Docs]`).
