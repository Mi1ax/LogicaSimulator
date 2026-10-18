# Declarative Node Definitions & IC Library (`src/core/engine/nodes/`)

> **Documentation Version:** `v1.2.2`
> **Source Directory:** [`src/core/engine/nodes/`](../../src/core/engine/nodes/)

Every component in Logica — from basic logic gates and interactive switches to 74LS TTL chips, EPROM/SRAM memories, and GAL22V10 PLDs — is defined via the declarative `NodeDefinition` contract.

---

## 1. Interfaces & Registry

### `NodeDefinition.ts`
**Source:** [`src/core/engine/nodes/NodeDefinition.ts`](../../src/core/engine/nodes/NodeDefinition.ts)

#### `PinDefinition`
```typescript
export interface PinDefinition {
  name: string;
  type: 'input' | 'output' | 'bidir';
  pinNumber?: number;
  schematicSide?: 'left' | 'right' | 'top' | 'bottom';
  schematicRow?: number;
  internalNodeId?: string;
}
```

#### `NodeDefinition`
```typescript
export interface NodeDefinition {
  type: string;
  label: string;
  category?: string;
  numInputs: number;
  numOutputs: number;
  defaultProperties?: Record<string, any>;
  tags?: string[];
  renderAs?: 'GATE' | 'DIP' | 'BUS';
  customPins?: PinDefinition[];
  generatePins?: (properties: Record<string, any>) => PinDefinition[];
  variableInputs?: { min: number; max: number; label?: string };
  variableOutputs?: { min: number; max: number; label?: string };
  memorySize?: number;
  disableTransform?: boolean;
  evaluate: (
    inputs: Signal[],
    properties?: Record<string, any>,
    tickCount?: number,
    internal?: Record<string, any>,
    prevInputs?: Signal[]
  ) => Signal[];
}
```

### `nodes/index.ts`
**Source:** [`src/core/engine/nodes/index.ts`](../../src/core/engine/nodes/index.ts)
- `ALL_BUILTIN_NODES: NodeDefinition[]`: Ordered master array of all built-in components. `Toolbox.tsx` groups components by `def.category` directly from this list.
- `NodeRegistry: Record<string, NodeDefinition>`: Hash map constructed from `ALL_BUILTIN_NODES`.
- `getNodeDefinition(type: string): NodeDefinition | undefined`: Looks up `SubcircuitRegistry[type]` if `type.startsWith('SUBCIRCUIT:')`, otherwise returns `NodeRegistry[type]`.

---

## 2. Basic Nodes, I/O, Wiring & Annotations (`src/core/engine/nodes/basicNodes.ts`)

**Source:** [`src/core/engine/nodes/basicNodes.ts`](../../src/core/engine/nodes/basicNodes.ts)

> **Zero-Allocation Optimization (`v1.2.2`):** Shared static output tuples (`OUT_0`, `OUT_1`, `OUT_U`, `OUT_EMPTY`, `OUT_U7`) are reused across `evaluate()` calls so combinational gates and I/O sources allocate zero arrays during simulation ticks.

### Power & I/O — Sources & Clock
| Export | `type` | Pins | Key Properties & Behavior |
| :--- | :--- | :--- | :--- |
| `VccNode` | `'VCC'` | 1 out | Always outputs `OUT_1` (`[1]`). |
| `GndNode` | `'GND'` | 1 out | Always outputs `OUT_0` (`[0]`). |
| `PullUpNode` | `'PULL_UP'` | 1 out | Weak pull-up resistor. Resolved at the net level (`simulation.ts`): pulls High-Z nets to `1`, yields to strong `0` drivers. |
| `PullDownNode` | `'PULL_DOWN'` | 1 out | Weak pull-down resistor. Pulls High-Z nets to `0`, yields to strong `1` drivers. |
| `ClockNode` | `'CLOCK'` | 1 out | Supports `mode: 'auto' \| 'manual'`. In `'auto'` mode, toggles output every `interval` ticks (`Math.floor(tickCount / interval) % 2`). In `'manual'` mode, outputs `manualValue` (`0` or `1`). |

### Power & I/O — Inputs & Switches
| Export | `type` | Pins | Key Properties & Behavior |
| :--- | :--- | :--- | :--- |
| `InputNode` | `'INPUT'` | 1 out | Interactive toggle switch (`properties.value`: `0`, `1`, or `'Z'` for High-Z). |
| `PushButtonNode` | `'BUTTON'` | 1 in, 1 out | Momentary tactile switch. When `properties.pressed === true`, passes input signal to output; otherwise outputs `undefined` (High-Z). |
| `DipSwitchNode` | `'DIP_SWITCH'` | `N` out (`variableOutputs: 1..16`, default `4`) | Bank of slide switches. Outputs `0` or `1` per switch from `properties.values[]`. |
| `KeypadNode` | `'KEYPAD'` | 4 row inputs (`R0..R3`), 4 col outputs (`C0..C3`) | 4×4 matrix hexadecimal keypad (`0..9`, `A..F`). When a key is held (`properties.pressedKey: 0..15`), bridges its row input `R[row]` to column output `C[col]`; otherwise `C0..C3` stay High-Z (`undefined`). |

### Power & I/O — Outputs & Displays
| Export | `type` | Pins | Key Properties & Behavior |
| :--- | :--- | :--- | :--- |
| `OutputNode` | `'OUTPUT'` | 1 in | Single LED probe. |
| `LedBarNode` | `'LED_BAR'` | `N` in (`variableInputs: 1..16`, default `8`) | Multi-segment bar graph display (`properties.color`). |
| `SevenSegNode` | `'7_SEG_DISPLAY'` | 8 in (`A..G`, `DP` in Raw mode; `D0..D3`, `DP` in Hex mode) | Supports `properties.mode: 'raw' \| 'hex'` and `commonPin: 'cathode' \| 'anode'`. |

### Power & I/O — Wiring & Subcircuit Ports
| Export | `type` | Pins | Key Properties & Behavior |
| :--- | :--- | :--- | :--- |
| `NetLabelNode` | `'NET_LABEL'` | 1 bidir (`PORT`) | Wireless net tunnel. All `NET_LABEL` nodes sharing the same `properties.label` within the same hierarchy level are merged into one electrical net. |
| `BusBreakoutNode` | `'BUS_BREAKOUT'` | Dynamic (`generatePins` for `bits: 4 \| 8 \| 16`, `dir: 'left' \| 'right'`) | Visual fan-out bus bar (`renderAs: 'BUS'`). Electrically forwards `IN{i}` ↔ `OUT{i}`. |
| `NcNode` | `'NC'` | 1 in | "Not Connected" marker (`disableTransform: true`). Suppresses unconnected-pin visual rings. |
| `JunctionNode` | `'JUNCTION'` | 1 in, 3 out | Wire T-junction solder dot (`disableTransform: true`). Merged into the parent net during circuit compilation. |
| `SubInNode` | `'SUB_IN'` | 1 out | Input port inside a custom subcircuit. |
| `SubOutNode` | `'SUB_OUT'` | 1 in | Output port inside a custom subcircuit. |
| `SubIoNode` | `'SUB_IO'` | 1 bidir (`IO`) | Bidirectional tri-state port inside a custom subcircuit. |

### Canvas Annotations
| Export | `type` | Pins | Key Properties & Behavior |
| :--- | :--- | :--- | :--- |
| `RegionBoxNode` | `'REGION_BOX'` | None | Dashed grouping frame with `label`, `width`, `height`, `color`. |
| `TextLabelNode` | `'TEXT_LABEL'` | None | Free-floating typography (`label`, `fontSize`, `bold`, `italic`, `fontFamily`, `color`). |
| `StickyNoteNode` | `'STICKY_NOTE'` | None | Sticky note card with `title`, `text`, `color`, `width`, `height`. |
| `FsmDiagramNode` | `'FSM_DIAGRAM'` | None | On-canvas live Finite State Machine state-transition graph linked to a `GAL22V10` chip via `properties.targetNodeId`. |

### Basic Combinational Logic Gates
All multi-input gates support `variableInputs: { min: 2, max: 8 }`:
- `AndNode` (`'AND'`), `NandNode` (`'NAND'`), `OrNode` (`'OR'`), `NorNode` (`'NOR'`), `XorNode` (`'XOR'`), `XnorNode` (`'XNOR'`)
- Single-input gates: `NotNode` (`'NOT'`), `BufferNode` (`'BUFFER'`).

---

## 3. Integrated Circuits Library (`src/core/engine/nodes/ics/`)

All TTL/CMOS ICs require valid power rails (`VCC === 1 && GND === 0`); when unpowered, all outputs return `undefined` (High-Z).

### 3.1 Logic Gate ICs (`ics/gates.ts`)
**Source:** [`src/core/engine/nodes/ics/gates.ts`](../../src/core/engine/nodes/ics/gates.ts)
- `IC74LS00` (`'74LS00'`): Quad 2-Input NAND Gate (14-pin DIP).
- `IC74LS02` (`'74LS02'`): Quad 2-Input NOR Gate (14-pin DIP).
- `IC74LS04` (`'74LS04'`): Hex Inverter (14-pin DIP).
- `IC74LS08` (`'74LS08'`): Quad 2-Input AND Gate (14-pin DIP).
- `IC74LS30` (`'74LS30'`): 8-Input NAND Gate (14-pin DIP).
- `IC74LS32` (`'74LS32'`): Quad 2-Input OR Gate (14-pin DIP).
- `IC74LS86` (`'74LS86'`): Quad 2-Input XOR Gate (14-pin DIP).

### 3.2 Counters & Timers (`ics/counters.ts`)
**Source:** [`src/core/engine/nodes/ics/counters.ts`](../../src/core/engine/nodes/ics/counters.ts)
- `IC_NE555` (`'NE555'`): Precision Timer IC (8-pin DIP: `GND`, `~TRIG`, `OUT`, `~RESET`, `CTRL`, `THRES`, `DISCH`, `VCC`).
  - Supports 3 operating modes via `properties.mode`:
    1. `'astable'` (default): Autonomous oscillator calculated from `r1Ohms`, `r2Ohms`, `cFarads`, and `ticksPerSecond` (`T_high = ln(2)·(R1+R2)·C`, `T_low = ln(2)·R2·C`).
    2. `'monostable'`: One-shot pulse triggered by `~TRIG === 0` (`T_pulse = 1.1·R1·C`).
    3. `'comparator'`: Pure pin-level RS flip-flop comparator driven by external `~TRIG` and `THRES` logic levels.
- `IC74LS161` (`'74LS161'`): 4-Bit Synchronous Binary Counter with Asynchronous Clear (`~CLR`), Synchronous Load (`~LOAD`), Enable (`ENP`, `ENT`), and Ripple Carry Output (`RCO = Q0 & Q1 & Q2 & Q3 & ENT`). Uses `prevInputs` for deterministic rising-edge `CLK` detection across relaxation iterations.
- `IC74LS191` (`'74LS191'`): 4-Bit Synchronous Up/Down Binary Counter (`~CTEN`, `D/~U`, `~LOAD`, `CLK`, outputs `Q0..Q3`, `MAX/~MIN`, `~RCO`).

### 3.3 Decoders & Multiplexers (`ics/decoders.ts`)
**Source:** [`src/core/engine/nodes/ics/decoders.ts`](../../src/core/engine/nodes/ics/decoders.ts)
- `IC74LS47` (`'74LS47'`): BCD to 7-Segment Decoder/Driver (`A0..A3`, `~LT`, `~RBI`, `~BI/~RBO` → `a..g`).
- `IC74LS138` (`'74LS138'`): 3-to-8 Line Decoder/Demultiplexer (`A..C`, `G1`, `~G2A`, `~G2B` → active-low `~Y0..~Y7`).
- `IC74LS139` (`'74LS139'`): Dual 2-to-4 Line Decoder/Demultiplexer.
- `IC74LS154` (`'74LS154'`): 4-to-16 Line Decoder/Demultiplexer (24-pin DIP).

### 3.4 Arithmetic & ALU (`ics/alu.ts`)
**Source:** [`src/core/engine/nodes/ics/alu.ts`](../../src/core/engine/nodes/ics/alu.ts)
- `IC_74LS283` (`'74LS283'`): 4-Bit Binary Full Adder with Fast Carry (`A1..A4`, `B1..B4`, `C0` → `Σ1..Σ4`, `C4`).
- `IC74LS181` (`'74LS181'`): 4-Bit Arithmetic Logic Unit / Function Generator (24-pin DIP supporting 16 logic and 16 arithmetic operations via `S0..S3`, `M`, `~Cn`).

### 3.5 Registers, Latches & Bus Transceivers (`ics/registers.ts`)
**Source:** [`src/core/engine/nodes/ics/registers.ts`](../../src/core/engine/nodes/ics/registers.ts)
- `IC74LS173` (`'74LS173'`): 4-Bit D-Type Register with 3-State Outputs (`~G1`, `~G2`, `M`, `N`, `CLK`, `CLR`).
- `IC74LS175` (`'74LS175'`): Quad D-Type Edge-Triggered Flip-Flop with Complementary Outputs (`Q`, `~Q`) and Asynchronous Clear (`~CLR`).
- `IC74LS241` (`'74LS241'`), `IC74LS244` (`'74LS244'`), `IC74LS541` (`'74LS541'`): Octal 3-State Buffers / Line Drivers.
- `IC_74LS245` (`'74LS245'`): Octal Bus Transceiver with Bidirectional 3-State Ports (`A1..A8` ↔ `B1..B8` controlled by `DIR` and `~OE`).
- `IC74LS273` (`'74LS273'`): Octal D-Type Flip-Flop with Clear (`~CLR`, `CLK`).
- `IC74LS373` (`'74LS373'`): Octal D-Type Transparent Latch with 3-State Outputs (`LE`, `~OE`).
- `IC74LS374` (`'74LS374'`): Octal D-Type Edge-Triggered Flip-Flop with 3-State Outputs (`CLK`, `~OE`).

### 3.6 Memory ICs (`ics/memory.ts`)
**Source:** [`src/core/engine/nodes/ics/memory.ts`](../../src/core/engine/nodes/ics/memory.ts)
- `ROM_27C256` (`'27C256'`): 32K × 8-Bit UV EPROM (`memorySize: 32768`, 28-pin DIP, `A0..A14`, `~CE`, `~OE` → `D0..D7`). Reads from `properties.data`.
- `IC6116` (`'6116'`): 2K × 8-Bit Static RAM (`memorySize: 2048`, 24-pin DIP, `A0..A10`, `~CS`, `~OE`, `~WE`, bidirectional `IO0..IO7`).
- `SRAM_62256` (`'62256'`): 32K × 8-Bit Static RAM (`memorySize: 32768`, 28-pin DIP, `A0..A14`, `~CE`, `~OE`, `~WE`, bidirectional `IO0..IO7`).
  - Both SRAM chips initialize `internal.memory` lazily from `properties.data` and mutate `internal.memory[address]` in-place during write cycles (`~CS === 0 && ~WE === 0`).

### 3.7 Programmable Logic Device (`ics/pld.ts`)
**Source:** [`src/core/engine/nodes/ics/pld.ts`](../../src/core/engine/nodes/ics/pld.ts)
- `IC_GAL22V10` (`'GAL22V10'`): 24-pin DIP Programmable AND-Array / Output Logic Macrocell (OLMC) PLD (`I1/CLK`, `I2..I11`, `GND`, `I12`, bidirectional `IO14..IO23`, `VCC`).
  - **Pre-Compiled Active Fuse Representation (`CompiledGal`, `v1.2.2`):**
    - Instead of parsing the JEDEC string or iterating across all 5,828 fuses on every tick, `getCompiledGal()` caches a sparse `CompiledTerm` structure per macrocell (`activeCols: Uint8Array` and `conflict: boolean`) along with `syn` (combinational vs. registered mode) and `ac0` (active-low vs. active-high polarity).
    - Uses pre-allocated module-level `Uint8Array(44)` scratch buffers (`scratchColStates`, `scratchPrevColStates`, `scratchMcOut`, `scratchFeedback`) so `IC_GAL22V10.evaluate()` performs **zero heap allocations per tick**.
    - Supports asynchronous reset (`AR`, product row 0), synchronous preset (`SP`, product row 131), per-macrocell tri-state output enable (`OE`), combinational feedback, and rising-edge registered D flip-flop feedback (`IO23..IO14`).
