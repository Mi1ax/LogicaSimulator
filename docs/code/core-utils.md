# Core Utilities (`src/core/utils/`)

> **Documentation Version:** `v1.2.2`
> **Source Directory:** [`src/core/utils/`](../../src/core/utils/)

This directory contains pure TypeScript utility modules for unique ID generation, JEDEC fuse map parsing, CUPL-style PLD boolean equation compilation, Finite State Machine (FSM) extraction, 20px grid schematic geometry, and `.logica` v2 circuit serialization.

---

## 1. Unique ID Generator (`src/core/utils/id.ts`)

**Source:** [`src/core/utils/id.ts`](../../src/core/utils/id.ts)

### `generateId(prefix: string): string`
Generates a collision-resistant identifier formatted as `${prefix}-${uuid}` (e.g., `node-3f2b...`, `wire-9a1c...`):
- Uses `crypto.randomUUID()` when available.
- Falls back to a base-36 timestamp + double random suffix (`${Date.now().toString(36)}-${Math.random()...}`) when running in non-secure HTTP LAN contexts where `crypto.randomUUID` is unavailable.

---

## 2. JEDEC Fuse Map Parser (`src/core/utils/jedecParser.ts`)

**Source:** [`src/core/utils/jedecParser.ts`](../../src/core/utils/jedecParser.ts)

### `parseJedec(jedecString: string, maxFuses?: number): boolean[]`
Parses a standard JEDEC (`.jed`) fuse map file (default `maxFuses = 5828` for `GAL22V10`):
- Reads the default fuse state field (`F0*` or `F1*`).
- Scans all fuse address blocks (`L<address> <01-bits>*`) and populates the boolean fuse array.

---

## 3. PLD Boolean Equation Compiler (`src/core/utils/pldCompiler.ts`)

**Source:** [`src/core/utils/pldCompiler.ts`](../../src/core/utils/pldCompiler.ts)

Compiles high-level CUPL/ABEL-style boolean equations and `TABLE` blocks directly into a 5,828-fuse JEDEC map for the `GAL22V10` chip.

### Key Features & `v1.2.2` Optimizations
- **Pin Declarations:** `PIN 1 = CLK;`, `PIN 14..23 = [Q0..Q9];`
- **Intermediate Variable Macros:** Symbolic substitution with cycle detection.
- **Truth Tables (`TABLE`):** Supports binary, decimal (`'d'`), and hexadecimal (`'h'`) literals, plus `.X.` ("don't care") bits on inputs.
  - **Algebraic Product Term Factoring (`v1.2.2`):** Instead of exponentially expanding `2^k` rows when a `TABLE` row contains `k` `.X.` ("don't care") bits, `parseTableBlocks()` algebraically drops `.X.` input variables from the generated product term ($O(1)$ per row) and enforces a safety cap (`MAX_MACRO_EXPANSION_LEN = 120000`).
- **Equation Types:**
  - Combinational assignment (`Y = A & !B # C;`)
  - Registered D flip-flop assignment (`Q.d = ...;` or `Q := ...;`)
  - Tri-state Output Enable (`Y.oe = ...;`)
  - Global Asynchronous Reset (`AR = ...;`) and Synchronous Preset (`SP = ...;`)
  - XOR (`^` / `$`) and parenthesized sub-expressions expanded to Sum-of-Products (SOP) via algebraic AST distribution (`expandAstToSop`) with contradiction pruning (`A & !A`) and duplicate literal elimination.
- **LRU Compilation Cache:** Caches the most recent 64 compiled source strings (`compileCache`) for instant re-evaluation.

### Exported Types & Functions
- `PldCompileResult`:
  ```typescript
  export interface PldCompileResult {
    success: boolean;
    jedec?: string;
    errors: string[];
    pinLabels?: Record<number, string>;
    usedMacrocells?: number[];
  }
  ```
- `compilePldToJedec(source: string): PldCompileResult`
- `DEFAULT_PLD_TEMPLATE: string`: Starter CUPL template used when opening a fresh `GAL22V10` in the PLD Editor.

---

## 4. FSM State-Transition Extractor (`src/core/utils/fsmExtractor.ts`)

**Source:** [`src/core/utils/fsmExtractor.ts`](../../src/core/utils/fsmExtractor.ts)

Automatically extracts a Finite State Machine (Moore/Mealy state-transition graph and truth table) from a `GAL22V10` PLD source program.

### How It Works
1. Identifies registered outputs (`.d` or `:=` assignments) as **state bits** (`stateBits`) and combinational outputs as **Mealy/Moore outputs** (`outputBits`).
2. Identifies external inputs referenced in registered/output equations (`inputBits`).
3. **Complexity Cap (`v1.2.2`):** Caps exhaustive truth-table enumeration at **`stateBits.length + inputBits.length <= 6`** (up to 64 transitions) to guarantee sub-millisecond extraction (`< 0.5 ms`) even when a `GAL22V10` has 10 registered macrocells (`1,024` states).
4. Merges parallel transitions between identical `(from, to)` state pairs using single-bit difference absorption (`combineLabels`, e.g., `0-` + `1-` → `--`) and formats human-readable boolean edge labels (`formatCube`).

### Exported Types & Function
- `FsmTransition`: `{ from: string; to: string; inputVal: string; outputVal: string }`
- `FsmMergedEdge`: `{ from: string; to: string; label: string; outputs: string[] }`
- `FsmGraphData`: `{ valid: boolean; error?: string; stateBits: string[]; inputBits: string[]; outputBits: string[]; states: string[]; transitions: FsmTransition[]; edges: FsmMergedEdge[] }`
- `extractFsmFromPld(source: string): FsmGraphData`

---

## 5. Schematic Geometry & 20px Grid Layout (`src/core/utils/schematicLayout.ts` & `layoutUtils.ts`)

**Sources:**
- [`src/core/utils/schematicLayout.ts`](../../src/core/utils/schematicLayout.ts)
- [`src/core/utils/layoutUtils.ts`](../../src/core/utils/layoutUtils.ts)

### Exported Functions
- `getSafePinNumber(nodeType, pin): number | undefined` (`layoutUtils.ts`): Returns `pin.pinNumber` or falls back to `def.customPins` lookup for backwards compatibility with older saved circuits.
- `getSchematicDimensions(node: LogicNode): { width: number; height: number }`:
  - Computes the exact bounding box dimensions for every node type (`DIP_SWITCH`, `7_SEG_DISPLAY`, `KEYPAD`, `BUTTON`, `NC`, `REGION_BOX`, `STICKY_NOTE`, `FSM_DIAGRAM`, `TEXT_LABEL`, `INPUT`/`OUTPUT`/`CLOCK`/`NET_LABEL`, `DIP` ICs, `BUS_BREAKOUT`, `VCC`/`GND`/`PULL_UP`/`PULL_DOWN`, `JUNCTION`, and basic logic gates).
- `getSchematicAnchor(node: LogicNode): { x: number; y: number }`:
  - Returns the node-local rotation/flip pivot point guaranteed to lie on a **20px grid intersection**, ensuring that rotating (`0°`, `90°`, `180°`, `270°`) or flipping (`flipX`, `flipY`) any component keeps all its pins strictly on 20px grid points.
- `getGridAlignedPinYs(count: number, height: number): number[]`:
  - Distributes `count` gate pins symmetrically around `height / 2` on 20px grid intervals.
- `getSchematicPinPosition(node: LogicNode, pinId: string): { x: number; y: number; nx: number; ny: number }`:
  - Computes the world-space `(x, y)` coordinates and outward unit normal vector `(nx, ny)` for any pin on any component after applying `flipX`, `flipY`, and `rotation` around `getSchematicAnchor(node)`.

---

## 6. Circuit Serialization (`src/core/utils/serialization.ts`)

**Source:** [`src/core/utils/serialization.ts`](../../src/core/utils/serialization.ts)

Implements the compact `.logica` (`version: 2`) JSON file format and backwards-compatible loader for both `v1` and `v2` circuit files.

### Compact v2 Format Optimizations
- Remaps verbose runtime UUIDs (`node-3f2b...`, `wire-9a1c...`) to sequential short IDs (`n1`, `n2`, ..., `w1`, `w2`, ...).
- Strips default/transient properties (`internal`, `renderAs`, `rotation: 0`, `flipX: false`, `flipY: false`, `pressed: false`, trailing zeros in ROM `data` arrays).
- Omits redundant `inputs`/`outputs` pin arrays on known built-in nodes and reconstructs canonical pins on load via `buildNodePins()`.
- Formats each node and wire as a single-line JSON object for clean Git diffs and small file sizes.

### Exported Functions
- `serializeCircuit(nodes, wires, savedCircuits?, simSpeed?): string`
- `deserializeCircuit(rawData): { nodes: LogicNode[]; wires: Wire[]; subcircuits?: Record<...>; simSpeed?: number }`
