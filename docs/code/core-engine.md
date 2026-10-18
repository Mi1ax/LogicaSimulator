# Core Engine (`src/core/engine/`)

> **Documentation Version:** `v1.2.2`
> **Source Directory:** [`src/core/engine/`](../../src/core/engine/)

The Core Engine is a pure TypeScript, framework-agnostic subsystem that implements:
1. Immutable structural circuit mutations (`circuit.ts`)
2. Flat-array compiled, event-driven discrete-event simulation (`simulation.ts`)
3. Incremental Manhattan orthogonal wire routing with obstacle avoidance and AABB bounds (`routing.ts`)
4. Dynamic subcircuit definition generation (`subcircuitRegistry.ts`)

---

## 1. Structural Circuit Mutators (`src/core/engine/circuit.ts`)

**Source:** [`src/core/engine/circuit.ts`](../../src/core/engine/circuit.ts)

### Constants & Interfaces
- `GRID_SIZE = 20`: Base coordinate grid resolution in pixels. All node positions and waypoints snap to multiples of `20`.
- `CircuitState`: `{ nodes: LogicNode[]; wires: Wire[] }`.

### Exported Functions

| Function | Signature | Description |
| :--- | :--- | :--- |
| `buildNodePins` | `(id, type, properties?, numInputsOverride?, numOutputsOverride?) => { inputs: Pin[]; outputs: Pin[] }` | Constructs canonical `Pin` arrays for a node using `def.generatePins(properties)`, `def.customPins`, or `numInputs`/`numOutputs`. Bidirectional (`'bidir'`) pins are pushed into both `inputs` and `outputs` with the same `Pin` object. |
| `addNode` | `(state, type, x, y) => CircuitState` | Creates a new `LogicNode` with a UUID (`generateId('node')`), snaps `(x, y)` to `GRID_SIZE`, populates `defaultProperties` and `pins`, and appends it to `state.nodes`. |
| `updateNodeProperties` | `(state, id, props) => CircuitState` | Merges `props` into `node.properties`. If the node's `NodeDefinition` defines `generatePins` (e.g., `BUS_BREAKOUT`), regenerates pins while preserving existing `pin.id` values for matching pin names/types. |
| `moveNode` | `(state, id, x, y) => CircuitState` | Moves a single node to grid-snapped `(x, y)` coordinates. |
| `moveSelection` | `(state, ids, primaryId, x, y) => CircuitState` | Computes the grid-snapped delta `(dx, dy)` of `primaryId` (which can be a node ID or a waypoint ID `'wp:<wireId>:<idx>'`) and translates all selected nodes and wire waypoints by `(dx, dy)`. |
| `deleteNode` | `(state, id) => CircuitState` | Removes the node `id` and automatically deletes all `Wire`s whose `sourceNodeId` or `targetNodeId` equals `id`. |
| `addWire` | `(state, sourceNodeId, sourcePinId, targetNodeId, targetPinId) => CircuitState` | Creates a new `Wire` with a UUID (`generateId('wire')`) connecting two pins. |
| `deleteWire` | `(state, id) => CircuitState` | Removes a wire by `id`. |
| `setNodeInputCount` | `(state, nodeId, count) => CircuitState` | Dynamically grows or shrinks `node.inputs` (for variable-input gates like `AND`, `OR`, `NAND`, `NOR`, `XOR`, `XNOR` and `LED_BAR`). When shrinking, automatically deletes wires attached to removed input pins. |
| `setNodeOutputCount` | `(state, nodeId, count) => CircuitState` | Dynamically grows or shrinks `node.outputs` (for `DIP_SWITCH`). When shrinking, removes wires attached to removed output pins. |
| `syncSubcircuitInstances` | `(nodes, wires) => { nodes, wires }` | Synchronizes all placed `SUBCIRCUIT:<id>` instances on a canvas after the underlying subcircuit's ports (`SUB_IN`, `SUB_OUT`, `SUB_IO`) have been edited. Preserves existing pin IDs by matching `internalNodeId` or `name`, and prunes dangling wires. |

---

## 2. Compiled Event-Driven Simulation Engine (`src/core/engine/simulation.ts`)

**Source:** [`src/core/engine/simulation.ts`](../../src/core/engine/simulation.ts)

### Overview & `v1.2.2` Architecture
To achieve multi-kilohertz real-time simulation on circuits with hundreds of ICs and thousands of pins without garbage-collection pauses, `simulation.ts` compiles the structural graph (`nodes`, `wires`, `savedCircuits`) **once per structural edit** into a flat, index-addressed `CompiledCircuit`.

```mermaid
flowchart LR
  A["Circuit Graph (nodes, wires)"] -->|compileCircuit() cached by WeakMap/refs| B["CompiledCircuit (Flat TypedArrays)"]
  B -->|Iter 0: Full Node & Net Pass| C["dirtyNetsList & dirtyNodes Queue"]
  C -->|Iter 1..49: Event-Driven Relaxation| D["Only Changed Nets & Fanout Nodes"]
  D -->|Final Batch Tick| E["Structural-Shared pinStates & wireStates"]
```

### Signal Encoding (`Uint8Array`)
Signals are encoded as 1-byte unsigned integers inside typed arrays:
- `VAL_0 = 0` (`0`)
- `VAL_1 = 1` (`1`)
- `VAL_U = 2` (`undefined` / High-Z)
- `VAL_X = 3` (`'X'` / Short-circuit conflict)

### Key Interfaces

#### `SimulationState`
```typescript
export interface SimulationState {
  pinStates: Record<string, Signal>;
  wireStates: Record<string, Signal>;
  nodeStates: Record<string, Record<string, any>>;
  tickCount: number;
}
```
- `pinStates`: Maps every `pin.id` in the top-level circuit to its resolved `Signal`.
- `wireStates`: Maps every `wire.id` in the top-level circuit to its resolved net `Signal`.
- `nodeStates`: Maps stateful `node.id`s (and hierarchical subcircuit paths like `subNodeId/innerNodeId`) to their mutable internal state object (`registers`, `count`, `lastClk`, `memory`, etc.).
- `tickCount`: Monotonically increasing discrete simulation clock counter.

#### `CompiledCircuit` (Internal Engine Representation)
- `totalPins`: Total flattened pins across the root circuit and all nested subcircuits.
- `pinIds` / `pinIdToIndex`: Bi-directional mapping between top-level `pin.id` strings and integer indices `0 .. topPinCount - 1`.
- `nets`: Array of `CompiledNet` objects (`allPins`, `strongDrivers`, `weakUpCount`, `weakDownCount`, `fanoutNodeIndices`).
  - Built using an optimized `Int32Array` Disjoint-Set (Union-Find) over wires, `JUNCTION` pass-throughs, `NET_LABEL` wireless tunnels (scoped per hierarchy level), and `SUBCIRCUIT` port bridges (`SUB_IN`, `SUB_OUT`, `SUB_IO`).
- `nodes`: Array of `CompiledNode` objects (`def`, `node`, `stateKey`, `inPinIndices`, `outPinIndices`, `inVals`, `prevInVals`, `lastInValsBuf`, `lastOutVals`, `lastInternal`).
- **Pre-allocated Scratch Buffers & Event Queues (`v1.2.2`):**
  - `curBuf`, `prevBuf`, `driverBuf`: `Uint8Array(totalPins)` storing current net values, previous-tick net values (for edge detection), and active output driver values.
  - `pinToNetIdx`: `Int32Array(totalPins)` mapping any pin index directly to its `CompiledNet` index in $O(1)$.
  - `dirtyNetFlags` (`Uint8Array`) & `dirtyNetsList` (`Int32Array`): Tracks nets whose driving pin changed during a relaxation iteration.
  - `dirtyNodeFlags` (`Uint8Array`) & `dirtyNodesA` / `dirtyNodesB` (`Int32Array`): Ping-pong queues of nodes whose input nets changed in the previous relaxation iteration.

### Relaxation Algorithm (`stepCompiledCircuit`)
Each discrete tick executes up to `MAX_ITERATIONS = 50` relaxation iterations:
1. **Iteration `0` (Full Tick Evaluation):**
   - Evaluates all `CompiledNode`s (passing `tickCount`, `internal`, and `prevInVals`).
   - Records each node's output into `driverBuf`. If a driving pin's output differs from the current net state or its previous driver value, marks its net in `dirtyNetsList`.
   - Resolves all nets on `iter === 0`:
     - Strong drivers (`0` or `1`) override weak pull resistors (`PULL_UP` / `PULL_DOWN`).
     - Opposing strong drivers (`0` and `1` simultaneously) resolve to `VAL_X` (`'X'`).
     - If no strong driver is active (`High-Z`), `PULL_UP` resolves the net to `1`, `PULL_DOWN` resolves to `0`, and opposing pull-ups/pull-downs resolve to `'X'`.
   - Any net whose resolved value changes enqueues its `fanoutNodeIndices` into `nextDirtyNodes`.
2. **Iterations `1 .. 49` (Event-Driven Dirty Queue):**
   - **Only** nodes in `curDirtyNodes` are inspected.
   - If a node's inputs match `lastInValsBuf` and its `internal` reference is unchanged, `evaluate()` is skipped and `lastOutVals` is reused.
   - **Only** nets in `dirtyNetsList` are re-resolved, enqueuing downstream `fanoutNodeIndices` if their resolved net value flips.
   - Terminates immediately (`break`) as soon as `dirtyNetCount === 0` or `nextDirtyNodeCount === 0`.
3. **Zero-Allocation Batch Execution (`computeNextStateBatch`):**
   - When running multiple ticks per animation frame (`ticks > 1`), intermediate ticks (`0 .. ticks - 2`) set `computeWireStates = false` and `reuseCurBuf = true`.
   - The engine advances `prevBuf` and `curBuf` in-place in typed arrays **without allocating or cloning `pinStates` or `wireStates` dictionaries** until the final tick (`i === ticks - 1`).
   - On the final tick, structural sharing returns the exact previous `currentState.pinStates` and `currentState.wireStates` object references if no top-level signals changed (`anyPinChanged === false`), preventing unnecessary React/Zustand selector invalidations.

### Exported Functions
- `createInitialSimulationState(): SimulationState`: Returns a blank initial state (`tickCount: 0`).
- `computeNextState(nodes, wires, currentState, savedCircuits?, computeWireStates?): SimulationState`: Advances the simulation by 1 tick.
- `computeNextStateBatch(nodes, wires, currentState, ticks, savedCircuits?): SimulationState`: Advances the simulation by `ticks` steps in a tight zero-allocation loop.

---

## 3. Incremental Manhattan Wire Router (`src/core/engine/routing.ts`)

**Source:** [`src/core/engine/routing.ts`](../../src/core/engine/routing.ts)

### Overview
Computes orthogonal (horizontal/vertical) wire paths on the schematic canvas with:
- Port normal exit stubs (`nx`, `ny`) so wires cleanly exit pins before turning.
- Obstacle avoidance around component bounding boxes (`ObstacleBox`).
- Semicircular crossover jumper arcs (`GAP_RADIUS = 5`) where horizontal wires cross vertical wires of a different net.
- **Incremental Per-Wire Caching (`v1.2.2`):** When dragging a component, only wires whose endpoint coordinates, endpoint node transforms (`rotation`/`flipX`/`flipY`), or waypoints changed are re-routed. Unchanged wires reuse their cached Manhattan points and AABB bounding boxes.

### Key Types & Functions

#### `WirePathEntry`
```typescript
export interface WirePathEntry {
  rawPoints: { x: number; y: number }[];
  jumperPoints: number[];
  hasJumpers: boolean;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
```
Stores both the Konva-ready path coordinates (`jumperPoints`) and the precomputed Axis-Aligned Bounding Box (`minX`, `maxX`, `minY`, `maxY`) used by `<WireRenderer>` for **Viewport Frustum Culling**.

#### Exported Functions
- `getManhattanPoints(startX, startY, endX, endY, startNx?, startNy?, endNx?, endNy?, obstacles?): { x: number; y: number }[]`
  - Calculates an orthogonal path between two points, routing around `obstacles` when mid-segments intersect a node's padded bounding box.
- `getMultiPointManhattan(pts, startNx?, startNy?, endNx?, endNy?, obstacles?): { x: number; y: number }[]`
  - Chains `getManhattanPoints` across user-placed wire `waypoints` and deduplicates collinear vertices.
- `computeAllWirePaths(wires, nodes): Map<string, WirePathEntry>`
  - Top-level router invoked by `<WireRenderer>`. Checks `lastTopologyHash`; if only a subset of nodes moved, incrementally updates affected wires, recalculates horizontal crossover jumpers where needed, and computes AABB bounds (`minX`, `maxX`, `minY`, `maxY`) for each wire.

---

## 4. Subcircuit Registry (`src/core/engine/subcircuitRegistry.ts`)

**Source:** [`src/core/engine/subcircuitRegistry.ts`](../../src/core/engine/subcircuitRegistry.ts)

Maintains the runtime `SubcircuitRegistry: Record<string, NodeDefinition>` for custom hierarchical blocks (`SUBCIRCUIT:<id>`).

### Exported Functions
- `generateSubcircuitDefinition(id, name, nodes): NodeDefinition`
  - Scans a subcircuit's internal `nodes` for `SUB_IN`, `SUB_IO`, and `SUB_OUT` ports.
  - Deduplicates pin names per direction (`getUniquePinName`), assigns sequential pin numbers (`1..N`), places inputs/bidirs on the `'left'` side and outputs on the `'right'` side, and binds each `PinDefinition.internalNodeId` to its internal port node ID.
- `updateSubcircuitRegistry(id, name, nodes): void`
  - Updates `SubcircuitRegistry['SUBCIRCUIT:' + id]`.
- `removeSubcircuitFromRegistry(id): void`
  - Removes `'SUBCIRCUIT:' + id` from `SubcircuitRegistry`.
