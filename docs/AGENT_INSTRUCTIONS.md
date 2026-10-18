# Logica Simulator - AI Agent Instructions

> **Documentation Version:** `v1.2.2`

Welcome to the Logica Simulator project! When assisting with this codebase, please adhere to the following architectural guidelines and principles. For a complete reference of every file and module, see **[`docs/code/README.md`](./code/README.md)**.

## 1. Project Architecture & Separation of Concerns
This project strictly separates the **Simulation Engine** (mathematical logic) from the **UI Layer** (rendering):
- **Engine (`src/core/engine/`)**: Pure TypeScript. Handles compiled flat-array discrete-event tick simulation (`simulation.ts`), event-driven dirty-net/dirty-node relaxation queues, multi-driver net resolution, incremental Manhattan wire routing (`routing.ts`), and structural mutators (`circuit.ts`). It has zero knowledge of React, Konva, or the DOM.
- **UI (`src/ui/`)**: Built with React and `react-konva`. Consumes engine state via Zustand (`src/store/useSimulatorStore.ts`) and renders it visually with Viewport Frustum Culling and Zoom-Out Level-of-Detail (LOD).

## 2. State Management (Zustand)
- **Structural Changes**: Adding/moving nodes, drawing wires, or changing pin counts are dispatched as immutable state updates and recorded in the per-tab Undo/Redo history stack via `structuredClone()`.
- **High-Frequency Simulation State**: Sequential components store runtime state (`registers`, `count`, `lastClk`, volatile SRAM `memory`) inside `SimulationState.nodeStates[node.id]` (passed via the `internal` parameter of `evaluate()`). `resetSimulation()` clears `simState` while preserving user properties (`label`, `data`, `jedec`, `pldSource`).

## 3. Declarative Node Definitions & Modular ICs
Components are defined in `src/core/engine/nodes/`:
- `basicNodes.ts` for gates, I/O, displays, wiring helpers (`JUNCTION`, `NC`, `NET_LABEL`, `BUS_BREAKOUT`), and annotations (`REGION_BOX`, `TEXT_LABEL`, `STICKY_NOTE`, `FSM_DIAGRAM`).
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

## 5. Routing (Manhattan Pathfinding) & Culling
Wires use orthogonal Manhattan routing defined in `src/core/engine/routing.ts`:
- The router calculates paths based on pin coordinates, port normal vectors (`nx`, `ny`), and obstacle bounding boxes.
- Wire routing is incrementally cached per wire (`WirePathEntry`) including AABB bounds (`minX`, `maxX`, `minY`, `maxY`) used for Viewport Frustum Culling in `WireRenderer.tsx`.

## 6. Testing & Verification
The project uses `Vitest` for unit testing:
- Always run `npx tsc --noEmit && npm test -- --run` after making changes to verify zero TypeScript errors and ensure all 90 gate, circuit, simulation, PLD compiler, serialization, and rotation/grid-alignment tests pass.

## 7. Styling
- **HTML/DOM**: Use Tailwind CSS v4.
- **Canvas/Konva**: Use `getCanvasTheme(isDark)` in `src/ui/canvas/theme.ts` for Light/Dark mode compatibility.

## 8. Git Operations
- **NEVER run `git commit`** unless the user's message explicitly contains the phrase `"Делай commit"`.
- When asked to commit, follow the commit message prefix convention in `.agents/rules/commits.md` (`[Feature]`, `[Fix]`, `[UI]`, `[Core]`, `[Refactor]`, `[Chore]`, `[Docs]`).
