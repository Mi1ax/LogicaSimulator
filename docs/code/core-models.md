# Core Domain Models (`src/core/models/types.ts`)

> **Documentation Version:** `v1.2.2`
> **Source File:** [`src/core/models/types.ts`](../../src/core/models/types.ts)

This module defines the fundamental TypeScript types and interfaces shared across the Simulation Engine, Serialization Utilities, Zustand Store, and React/Konva UI layers. It has zero external dependencies.

---

## Signal Model

### `Signal`
```typescript
export type Signal = 0 | 1 | undefined | 'X';
```
Represents the 4-state digital logic level on any pin or wire net:
- `0`: Logic **LOW** (Driven ground / false).
- `1`: Logic **HIGH** (Driven VCC / true).
- `undefined`: **High-Z** (Floating / Tri-state / Unconnected / Open-collector release).
- `'X'`: **Error / Short-Circuit Conflict** (Occurs when a net is simultaneously driven by both strong `0` and strong `1`, or when an uncompiled/invalid PLD equation is evaluated).

> [!NOTE]
> Inside the compiled simulation engine (`src/core/engine/simulation.ts`), `Signal` values are packed into flat `Uint8Array` buffers using compact integer codes (`VAL_0 = 0`, `VAL_1 = 1`, `VAL_U = 2`, `VAL_X = 3`) for cache-friendly execution.

---

## Node Type Identifiers

### `BuiltinNodeType`
```typescript
export type BuiltinNodeType =
  | 'AND' | 'OR' | 'NOR' | 'NAND' | 'NOT' | 'XOR' | 'XNOR' | 'BUFFER'
  | 'INPUT' | 'OUTPUT' | 'CLOCK' | 'VCC' | 'GND' | 'JUNCTION' | 'NC'
  | 'SUB_IN' | 'SUB_OUT' | 'SUB_IO'
  | 'DIP_SWITCH' | 'BUTTON' | 'LED_BAR' | '7_SEG_DISPLAY'
  | 'NET_LABEL' | 'BUS_BREAKOUT'
  | 'REGION_BOX' | 'TEXT_LABEL' | 'STICKY_NOTE' | 'FSM_DIAGRAM';
```

### `NodeType`
```typescript
export type NodeType = BuiltinNodeType | (string & {});
```
Provides IDE autocomplete for core built-in node types while accepting arbitrary string identifiers for:
- Integrated Circuits (e.g., `'74LS00'`, `'74LS161'`, `'NE555'`, `'27C256'`, `'6116'`, `'62256'`, `'GAL22V10'`, `'KEYPAD'`, `'PULL_UP'`, `'PULL_DOWN'`).
- User-defined hierarchical subcircuits prefixed with `'SUBCIRCUIT:'` (e.g., `'SUBCIRCUIT:sub-1234'`).

---

## Structural Entities

### `Pin`
```typescript
export interface Pin {
  id: string;
  nodeId: string;
  type: 'input' | 'output' | 'bidir';
  index: number;
  name?: string;
  pinNumber?: number;
  internalNodeId?: string;
}
```
Represents an electrical terminal attached to a `LogicNode`:
- `id`: Globally unique pin identifier (canonical format: `pin-${nodeId}-${type}-${name}` or `pin-${nodeId}-in-${index}`).
- `nodeId`: ID of the parent `LogicNode`.
- `type`: Electrical direction (`'input'`, `'output'`, or bidirectional `'bidir'`). Note that `'bidir'` pins appear in **both** `node.inputs` and `node.outputs` with the same `pin.id` so they can both sample bus nets and drive bus nets.
- `index`: 0-based index of the pin within its node.
- `name`: Optional symbolic label rendered on the schematic (e.g., `'CLK'`, `'A0'`, `'~OE'`). Prefixing with `'~'` renders an active-low inversion bubble and overline on DIP ICs.
- `pinNumber`: Optional physical IC package pin number (`1..N`).
- `internalNodeId`: Used by `SUBCIRCUIT:<id>` pins to map external IC pins to internal `SUB_IN`, `SUB_OUT`, or `SUB_IO` nodes inside the subcircuit definition.

---

### `Wire`
```typescript
export interface Wire {
  id: string;
  sourceNodeId: string;
  sourcePinId: string;
  targetNodeId: string;
  targetPinId: string;
  waypoints?: { x: number; y: number }[];
}
```
Represents a point-to-point electrical connection between two pins:
- `id`: Unique wire identifier.
- `sourceNodeId` / `sourcePinId`: Starting node and pin IDs.
- `targetNodeId` / `targetPinId`: Ending node and pin IDs.
- `waypoints`: Optional array of manual `{ x, y }` grid coordinates that constrain the Manhattan router (`src/core/engine/routing.ts`) through user-defined bend points.

---

### `DraftWire`
```typescript
export interface DraftWire {
  sourceNodeId: string;
  sourcePinId: string;
  sourceType: 'input' | 'output' | 'bidir';
  endX: number;
  endY: number;
  waypoints?: { x: number; y: number }[];
  manhattan?: boolean;
}
```
Represents an in-progress wire currently being drawn by the user on the schematic canvas before the second endpoint is clicked.

---

### `LogicNode`
```typescript
export interface LogicNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  inputs: Pin[];
  outputs: Pin[];
  properties?: Record<string, any>;
}
```
Represents a component instance placed on the schematic canvas:
- `id`: Unique node identifier.
- `type`: Component type key resolved via `getNodeDefinition(node.type)`.
- `x`, `y`: Top-left world coordinates on the 20px schematic grid.
- `inputs`: Ordered list of input (and bidirectional) pins passed to `def.evaluate(inputs, ...)`.
- `outputs`: Ordered list of output (and bidirectional) pins driven by the return array of `def.evaluate(...)`.
- `properties`: Optional dictionary of persistent user configuration (`label`, `rotation`, `flipX`, `flipY`, `value`, `interval`, `data`, `jedec`, `pldSource`, `width`, `height`, `color`, etc.).
  - **Important (`v1.2.2`):** Mutable sequential simulation state (`registers`, `count`, `lastClk`, SRAM `memory`) is stored inside `SimulationState.nodeStates[node.id]` rather than `node.properties.internal`, keeping `LogicNode` strictly serializable and free of transient runtime state.
