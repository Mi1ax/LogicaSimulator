# Global State Store (`src/store/useSimulatorStore.ts`)

> **Documentation Version:** `v1.2.2`
> **Source File:** [`src/store/useSimulatorStore.ts`](../../src/store/useSimulatorStore.ts)

`useSimulatorStore` is the single Zustand state store bridging the pure TypeScript Core Engine (`src/core/engine/`) and the React/Konva UI (`src/ui/`).

---

## 1. Architectural Separation of State

To sustain high-frequency simulation without UI lag or memory bloat, the store separates state into three categories:
1. **Structural & Multi-Tab State (`nodes`, `wires`, `savedCircuits`, `openTabs`, `activeTabId`)**:
   - Represents the physical schematic and custom subcircuits.
   - Structural mutations call `saveHistory()`, which pushes a `structuredClone` snapshot (`{ nodes, wires }`) onto the active circuit's `history` stack (capped at `MAX_HISTORY = 50`).
   - Automatically persisted to `localStorage` (`logica_saved_circuits_v1`, `logica_open_tabs_v1`, `logica_active_tab_v1`).
2. **High-Frequency Simulation State (`simState`, `isRunning`, `simSpeed`)**:
   - Contains `pinStates`, `wireStates`, `nodeStates`, and `tickCount`.
   - **Never** pushed to Undo/Redo history.
   - Updated via `stepSimulation()` or `stepSimulationBatch(ticks)` using structural sharing from `simulation.ts`.
3. **Interactive Canvas & Editor UI State**:
   - Viewport transform (`schematicPos`, `schematicScale`), selection (`selectedIds`), active tool modes (`placingNodeId`, `draftWire`, `editorMode`), and modal views (`selectedMemoryNodeId`, `selectedPldNodeId`, `selectedNe555NodeId`, `fsmModalNodeId`).

---

## 2. Store State Interface (`SimulatorStoreState`)

| Property | Type | Description |
| :--- | :--- | :--- |
| `nodes` | `LogicNode[]` | Nodes in the currently active tab. |
| `wires` | `Wire[]` | Wires in the currently active tab. |
| `simState` | `SimulationState` | Live electrical signals (`pinStates`, `wireStates`, `nodeStates`, `tickCount`). |
| `isRunning` | `boolean` | Whether the simulation clock loop is running. |
| `simSpeed` | `number` | Target simulation frequency in Hz (`1` to `1,000,000` Hz, default `60`). |
| `theme` | `'dark' \| 'light'` | Active UI and canvas theme (persisted in `localStorage`). |
| `editorMode` | `'schematic' \| 'rom' \| 'pld' \| 'ne555'` | Active workspace view inside `<CanvasArea>`. |
| `selectedMemoryNodeId` | `string \| null` | Target EPROM/SRAM node ID for `<HexEditorView>`. |
| `selectedPldNodeId` | `string \| null` | Target `GAL22V10` node ID for `<CodeEditorView>`. |
| `selectedNe555NodeId` | `string \| null` | Target `NE555` node ID for `<Ne555LabView>`. |
| `fsmModalNodeId` | `string \| null` | Target `GAL22V10` node ID for the modal `<FsmDiagramView>` window. |
| `draftWire` | `DraftWire \| null` | Active wire being drawn on the canvas. |
| `selectedIds` | `string[]` | Currently selected node, wire, and waypoint (`wp:<wireId>:<idx>`) IDs. |
| `placingNodeId` | `string \| null` | ID of a newly spawned floating node following the mouse cursor. |
| `isPasting` | `boolean` | Whether the current `selectedIds` are floating from a `Ctrl+V` paste operation. |
| `clipboard` | `{ nodes: LogicNode[]; wires: Wire[] } \| null` | Copied subgraph for `Ctrl+C` / `Ctrl+V`. |
| `savedCircuits` | `Record<string, SubcircuitData>` | Dictionary of `'main'` and all user-created subcircuits (`name`, `nodes`, `wires`, `history`, `future`). |
| `openTabs` | `string[]` | Ordered list of open circuit tab IDs (always starts with `'main'`). |
| `activeTabId` | `string` | Currently active tab ID (`'main'` or a subcircuit ID). |
| `history` / `future` | `{ nodes: LogicNode[]; wires: Wire[] }[]` | Undo and Redo stacks for the active tab. |
| `schematicPos` | `{ x: number; y: number }` | Konva stage pan offset. |
| `schematicScale` | `number` | Konva stage zoom scale (`0.15` to `3.0`). |

---

## 3. Store Actions Reference

### Node & Property Mutations
- `addNode(type, x, y)` / `startPlacingNode(type, x, y)` / `finishPlacingNode()`
- `moveNode(id, x, y)` / `moveSelection(primaryId, x, y)`
- `deleteSelection()`: Deletes all selected nodes, wires, and waypoints (`wp:<wireId>:<idx>`), and clears any active placement/paste state.
- `updateNodeProperties(id, props, skipHistory?)`: Updates `node.properties` and triggers an immediate combinational re-evaluation if the simulation is paused.
- `setNodeInputCount(id, count)` / `setNodeOutputCount(id, count)`
- `rotateSelection(direction: 'cw' \| 'ccw')`: Rotates selected nodes by ±90° around their `getSchematicAnchor` pivot and rotates internal waypoints when multiple nodes are rotated together.
- `flipSelection(axis: 'x' \| 'y')`: Mirrors selected nodes horizontally or vertically.
- `toggleInputNode(id)` / `toggleDipSwitch(id, index)` / `setButtonState(id, pressed)` / `setKeypadKey(id, keyIndex)`

### Wire & Waypoint Drawing
- `startWire(nodeId, pinId, pinType, x, y)`
- `updateDraftWire(x, y, manhattan?)`
- `addDraftWaypoint(x, y)`
- `completeWire(targetNodeId, targetPinId, targetType)`: Validates source/target directions (supporting `'bidir'` pins), prevents duplicate wires, and commits the new `Wire`.
- `splitWireAndConnect(targetWireId, x, y)`: Splits an existing wire at `(x, y)` by inserting a `JUNCTION` node (`nJunc`) and connecting the active `draftWire` (if present) to the new junction.
- `addWireWaypoint(wireId, index, x, y)` / `moveWireWaypoint(wireId, index, x, y)` / `deleteWireWaypoint(wireId, index)`

### Simulation Execution
- `toggleSimulation()`: Starts or pauses the clock loop.
- `stepSimulation()`: Advances simulation by 1 tick (`computeNextState`).
- `stepSimulationBatch(ticks)`: Advances simulation by `ticks` steps (`computeNextStateBatch`).
  - **O(1) Memory Sync (`v1.2.2`):** Only synchronizes volatile SRAM `memory` back to `node.properties.data` when `selectedMemoryNodeId` is open in `<HexEditorView>`, avoiding an $O(N)$ scan over `nodeStates` on every animation frame.
- `resetSimulation()`: Resets `simState` to `createInitialSimulationState()`, clearing all sequential latches, counters, and volatile RAM.
- `setSimSpeed(speed)`: Clamps speed to `[1, 1_000_000]` Hz.

### History, Clipboard & Persistence
- `saveHistory()` / `undo()` / `redo()`
- `copySelection()` / `pasteClipboard(cursorX?, cursorY?)`
- `clearCanvas()` / `loadCircuit(nodes, wires, subcircuits?, simSpeed?)`

### Multi-Tab & Subcircuit Management
- `createNewSubcircuit(name)`
- `switchTab(id)` / `closeTab(id)`
- `renameSubcircuit(id, newName)` / `deleteSubcircuit(id)`
