# Canvas & Specialized Views (`src/ui/canvas/`)

> **Documentation Version:** `v1.2.2`
> **Source Directory:** [`src/ui/canvas/`](../../src/ui/canvas/)

This directory contains the interactive `react-konva` schematic workspace, all schematic component renderers, wire/pin primitives, and the three specialized engineering views (`CodeEditorView`, `HexEditorView`, `Ne555LabView`).

---

## 1. Workspace Router & Stage

### `CanvasArea.tsx`
**Source:** [`src/ui/canvas/CanvasArea.tsx`](../../src/ui/canvas/CanvasArea.tsx)
- Measures the available flex container via `ResizeObserver` and switches between:
  - `<SchematicCanvas>` (`editorMode === 'schematic'`)
  - `<HexEditorView>` (`editorMode === 'rom'`, lazy-loaded via `React.lazy`)
  - `<CodeEditorView>` (`editorMode === 'pld'`, lazy-loaded via `React.lazy`)
  - `<Ne555LabView>` (`editorMode === 'ne555'`, lazy-loaded via `React.lazy`)

### `SchematicCanvas.tsx`
**Source:** [`src/ui/canvas/SchematicCanvas.tsx`](../../src/ui/canvas/SchematicCanvas.tsx)
The main interactive Konva `<Stage>` and `<Layer>`:
- **Pan & Zoom:** Middle-click/Alt-drag panning and cursor-centered wheel zooming (`0.15x` to `3.0x`).
- **Rubber-Band Box Selection:** Left-drag on empty canvas selects all intersecting nodes and wires.
- **Viewport Frustum Culling (`v1.2.2`):**
  - Computes `viewportBounds` (`minX`, `maxX`, `minY`, `maxY` in world coordinates with a `1000px / scale` screen-space margin).
  - When `nodes.length > 80`, filters `visibleNodeIds` so off-screen nodes are not mounted in the React-Konva tree (always keeping `selectedIds`, `placingNodeId`, and `REGION_BOX` background frames mounted).
  - Passes `viewportBounds` down to `<WireRenderer>` to cull off-screen wires.
- **Two-Pass Layer Ordering:** Renders `REGION_BOX` annotation frames in a background pass behind wires and logic components.

### `Grid.tsx`
**Source:** [`src/ui/canvas/Grid.tsx`](../../src/ui/canvas/Grid.tsx)
- Renders the infinite 20px dot grid using a single Konva `<Rect>` with `fillPatternImage` (`listening={false}`).
- **Cached CanvasPattern (`v1.2.2`):** Caches tiles by `dotColor:stride` and increases dot spacing (`stride = 20` → `40` → `80`) when zoomed out (`scale < 0.5` / `scale < 0.25`) so the GPU never tiles millions of sub-pixel dots.

### `theme.ts`
**Source:** [`src/ui/canvas/theme.ts`](../../src/ui/canvas/theme.ts)
- `getCanvasTheme(isDark: boolean): CanvasTheme`: Returns dark and light palette tokens for Konva shapes (`nodeBg`, `nodeStroke`, `wireHigh`, `wireLow`, `wireHiZ`, `wireError`, `pinFill`, etc.).

---

## 2. Primitives & Wires

### `primitives/Pin.tsx`
**Source:** [`src/ui/canvas/primitives/Pin.tsx`](../../src/ui/canvas/primitives/Pin.tsx)
Renders an interactive connection terminal (`<Circle>`):
- **Zoom-Out Level-of-Detail (`v1.2.2`):** When `schematicScale < 0.45 && !draftWire`, returns `null` and short-circuits its Zustand `pinState` selector to `undefined`, eliminating **100%** of pin Konva nodes and pin re-renders during zoomed-out simulation.
- **Bit-Packed `metaMask` Selector:** Packs `isDark` (bit 0), `isConnected` (bit 1), `isConnectedToNC` (bit 2), and `hiddenByLod` (bit 3) into a single primitive integer selector backed by a module-level cached `getPinConnectionSets(wires, nodes)`.
- Displays an amber warning ring around unconnected pins (unless attached to an `NC` marker).

### `wires/WireRenderer.tsx`
**Source:** [`src/ui/canvas/wires/WireRenderer.tsx`](../../src/ui/canvas/wires/WireRenderer.tsx)
- Calls `computeAllWirePaths(wires, nodes)` once per structural update.
- **Viewport Frustum Culling (`v1.2.2`):** When `wires.length > 100`, skips rendering `<SingleWire>` components whose precomputed AABB (`minX`, `maxX`, `minY`, `maxY`) falls outside `viewportBounds`.
- **`<SingleWire>`:** Memoized wire component subscribing only to its own `simState.wireStates[wire.id]` and selection state. Supports double-click to insert a manual waypoint or split with a `JUNCTION` while drawing a `draftWire`.

---

## 3. Schematic Node Renderers (`src/ui/canvas/nodes/schematic/`)

### `SchematicNodeWrapper.tsx`
**Source:** [`src/ui/canvas/nodes/schematic/SchematicNodeWrapper.tsx`](../../src/ui/canvas/nodes/schematic/SchematicNodeWrapper.tsx)
Shared Konva `<Group>` wrapper used by all schematic components (except `SchematicJunctionNode`). Centralizes:
- 20px grid drag snapping and multi-node `moveSelection`
- Pivot offset (`getSchematicAnchor`) and `rotation` / `flipX` / `flipY` transforms
- Placement/paste ghost opacity (`0.6`) and click-to-place completion
- Undo history snapshots on `onDragStart`

### Individual Node Renderers
| File | Component | Rendered Node Types & Optimizations |
| :--- | :--- | :--- |
| [`SchematicGateNode.tsx`](../../src/ui/canvas/nodes/schematic/SchematicGateNode.tsx) | `SchematicGateNode` | IEEE/ANSI distinctive shapes for `AND`, `NAND`, `OR`, `NOR`, `XOR`, `XNOR`, `NOT`, `BUFFER` with dynamic multi-input wings and combined single-`<Path>` pin legs. |
| [`SchematicICNode.tsx`](../../src/ui/canvas/nodes/schematic/SchematicICNode.tsx) | `SchematicICNode` | Renders all `DIP` ICs (`74LSxx`, `NE555`, `27C256`, `6116`, `62256`, `GAL22V10`) and `SUBCIRCUIT:<id>` blocks. Combines all pin legs into one `<Path>`, supports active-low `~` bubbles/overlines, and hides pin labels/numbers at `scale < 0.45` (Zoom-Out LOD). Double-clicking opens the Hex Editor, PLD Editor, NE555 Lab, or Subcircuit tab. |
| [`SchematicIONode.tsx`](../../src/ui/canvas/nodes/schematic/SchematicIONode.tsx) | `SchematicIONode` | Renders `INPUT`, `OUTPUT`, `CLOCK`, `VCC`, `GND`, `PULL_UP`, `PULL_DOWN`, `SUB_IN`, `SUB_OUT`, `SUB_IO`. |
| [`Schematic7SegNode.tsx`](../../src/ui/canvas/nodes/schematic/Schematic7SegNode.tsx) | `Schematic7SegNode` | 7-Segment LED display (`raw` and `hex` modes). Uses module-level precomputed SVG path strings (`SEG_PATHS`) and a single bitmask Zustand selector (`inputMask`). |
| [`SchematicLEDBarNode.tsx`](../../src/ui/canvas/nodes/schematic/SchematicLEDBarNode.tsx) | `SchematicLEDBarNode` | Multi-segment LED bar graph with combined single-`<Path>` pin legs and bitmask Zustand selector. |
| [`SchematicDipSwitchNode.tsx`](../../src/ui/canvas/nodes/schematic/SchematicDipSwitchNode.tsx) | `SchematicDipSwitchNode` | Interactive N-way DIP switch bank with combined single-`<Path>` output legs. |
| [`SchematicButtonNode.tsx`](../../src/ui/canvas/nodes/schematic/SchematicButtonNode.tsx) | `SchematicButtonNode` | Momentary push button (`onMouseDown` / `onMouseUp` / `onMouseLeave`). |
| [`SchematicKeypadNode.tsx`](../../src/ui/canvas/nodes/schematic/SchematicKeypadNode.tsx) | `SchematicKeypadNode` | Interactive 4×4 matrix hexadecimal keypad (`0..F`). |
| [`SchematicBusNode.tsx`](../../src/ui/canvas/nodes/schematic/SchematicBusNode.tsx) | `SchematicBusNode` | `BUS_BREAKOUT` multi-bit fan-out bar with combined single-`<Path>` diagonal taps. |
| [`SchematicNetLabelNode.tsx`](../../src/ui/canvas/nodes/schematic/SchematicNetLabelNode.tsx) | `SchematicNetLabelNode` | Pentagon wireless net tag with cached label width measurement. |
| [`SchematicJunctionNode.tsx`](../../src/ui/canvas/nodes/schematic/SchematicJunctionNode.tsx) | `SchematicJunctionNode` | 20×20 wire solder dot colored by live signal state. |
| [`SchematicNCNode.tsx`](../../src/ui/canvas/nodes/schematic/SchematicNCNode.tsx) | `SchematicNCNode` | Cyan `×` marker for intentionally unconnected pins. |
| [`SchematicAnnotationNodes.tsx`](../../src/ui/canvas/nodes/schematic/SchematicAnnotationNodes.tsx) | `SchematicRegionBoxNode`, `SchematicTextLabelNode`, `SchematicStickyNoteNode`, `SchematicFsmDiagramNode` | Resizable canvas documentation & visualization widgets. `SchematicFsmDiagramNode` renders a live Konva FSM state-transition diagram on the canvas and uses a string `liveStateSig` selector so it only re-renders when the active state bit vector actually changes. |

---

## 4. Specialized Engineering Views

### `CodeEditorView.tsx` (PLD Equation Editor)
**Source:** [`src/ui/canvas/CodeEditorView.tsx`](../../src/ui/canvas/CodeEditorView.tsx)
- Split-pane IDE for programming `GAL22V10` chips using CUPL-style boolean equations and `TABLE` blocks.
- Compiles source code via `compilePldToJedec()`, automatically updates custom pin names on the chip, displays compilation diagnostics or generated JEDEC fuse maps, and includes a built-in live `<FsmDiagramView>` tab and template gallery.

### `HexEditorView.tsx` (Live Memory Inspector)
**Source:** [`src/ui/canvas/HexEditorView.tsx`](../../src/ui/canvas/HexEditorView.tsx)
- Virtualized hexadecimal & ASCII inspector/editor for `27C256` (32KB EPROM), `6116` (2KB SRAM), and `62256` (32KB SRAM).
- Highlights the currently addressed byte in real time from `A0..A14` pin states, supports inline hex editing, `.bin` file import/export, and zero-fill clearing.

### `Ne555LabView.tsx` (Interactive NE555 Timer Lab)
**Source:** [`src/ui/canvas/Ne555LabView.tsx`](../../src/ui/canvas/Ne555LabView.tsx)
- Dedicated engineering workbench for `NE555` timer chips with two views:
  1. **Simple View:** Preset frequency selector, E12/E24 standard resistor & capacitor sliders, live oscilloscope waveform (`V_OUT` and `V_C`), and **Inverse R/C Solver** (calculates optimal standard `R1`, `R2`, `C` values for any target frequency and duty cycle in Astable mode, or target pulse width in Monostable mode).
  2. **Detailed View:** Internal block diagram showing the $5\text{ k}\Omega$–$5\text{ k}\Omega$–$5\text{ k}\Omega$ voltage divider ($\frac{1}{3}V_{CC}$, $\frac{2}{3}V_{CC}$), upper/lower comparators, SR flip-flop, and discharge transistor `Q1`.
