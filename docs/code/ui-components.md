# Application Shell & UI Components (`src/App.tsx`, `src/ui/components/`)

> **Documentation Version:** `v1.2.2`
> **Source Directory:** [`src/ui/components/`](../../src/ui/components/) & [`src/App.tsx`](../../src/App.tsx)

This document covers the React application entry point, the global simulation scheduler and hotkey controller (`App.tsx`), and all surrounding panels and modal dialogs in `src/ui/components/`.

---

## 1. Entry Point & Application Shell

### `src/main.tsx`
**Source:** [`src/main.tsx`](../../src/main.tsx)
- Mounts `<App />` inside `<React.StrictMode>` and `<ErrorBoundary>` into `#root`.

### `src/App.tsx`
**Source:** [`src/App.tsx`](../../src/App.tsx)
Top-level layout shell and controller:
- **Adaptive Simulation Loop:**
  - When `simSpeed <= 60` Hz, runs a `setInterval` at `1000 / simSpeed` ms calling `stepSimulationBatch(1)`.
  - When `simSpeed > 60` Hz (up to `1,000,000` Hz), runs at 60 FPS (`16ms` interval) with `ticksPerFrame = Math.min(Math.round(simSpeed / 60), 2500)` and a time-budget guard (`elapsed > 14ms`) so the browser UI thread always stays responsive.
- **Global Keyboard Shortcuts:**
  - `Delete` / `Backspace`: Delete selected nodes, wires, and waypoints (`deleteSelection()`).
  - `Escape`: Cancel node placement, paste mode, or active wire draft; or clear selection.
  - `Ctrl+Z`: Undo (`undo()`).
  - `Ctrl+Y` / `Ctrl+Shift+Z`: Redo (`redo()`).
  - `Ctrl+C` / `Ctrl+V`: Copy and paste selection (`copySelection()`, `pasteClipboard()`).
  - `R` / `Shift+R`: Rotate selected components 90° CW / CCW (`rotateSelection()`).
  - `X` / `Y`: Flip selected components horizontally / vertically (`flipSelection()`).

---

## 2. UI Panels & Modals (`src/ui/components/`)

### `Topbar.tsx`
**Source:** [`src/ui/components/Topbar.tsx`](../../src/ui/components/Topbar.tsx)
Main application toolbar:
- **Simulation Controls:** Run/Pause toggle, Single-Step (`stepSimulation`), Reset (`resetSimulation`), and frequency preset selector (`1 Hz` to `1 MHz` + custom Hz input).
- **Built-in Examples Loader:** Dynamically discovers all `.logica` files in `public/examples/` via `fetch` and loads them into the workspace.
- **File Operations:** Save Project (`.logica` v2 JSON download), Load Project (`.logica` file upload), Create Subcircuit modal, Clear Canvas confirmation, and Light/Dark theme toggle.

---

### `CircuitTabs.tsx`
**Source:** [`src/ui/components/CircuitTabs.tsx`](../../src/ui/components/CircuitTabs.tsx)
Multi-tab bar located below `Topbar`:
- Always displays the pinned **Main Circuit** (`'main'`) tab alongside any open custom subcircuit tabs (`openTabs`).
- Supports switching tabs (`switchTab`), inline double-click renaming (`renameSubcircuit`), and closing tabs (`closeTab`).

---

### `Toolbox.tsx`
**Source:** [`src/ui/components/Toolbox.tsx`](../../src/ui/components/Toolbox.tsx)
Left sidebar component library:
- **Declarative Category Grouping:** Automatically builds collapsible category trees (`Power & I/O`, `Basic Logic`, `Integrated Circuits/...`, `Annotations`) from `ALL_BUILTIN_NODES` (`def.category`).
- **Search & Filter:** Real-time filtering across component labels, types, and `def.tags`.
- **Custom ICs Section:** Lists all user-defined subcircuits (`savedCircuits`), with buttons to place, edit in a new tab, rename, or delete custom modules.

---

### `PropertiesPanel.tsx`
**Source:** [`src/ui/components/PropertiesPanel.tsx`](../../src/ui/components/PropertiesPanel.tsx)
Right-hand context-sensitive inspector:
- **Declarative Controls:**
  - Label editor (`properties.label`)
  - Orientation controls (`0°`, `90°`, `180°`, `270°`, `Flip X`, `Flip Y`) when `!def.disableTransform`
  - Dynamic input/output count controls driven by `def.variableInputs` and `def.variableOutputs`
  - Memory size & **Open Hex Editor** / `.bin` upload-download controls when `def.memorySize` is present
- **Component-Specific Sections:**
  - `CLOCK`: Auto/Manual mode toggle, manual `0`/`1` pulse button, and tick interval input.
  - `INPUT`: Logic level selector (`0`, `1`, `High-Z`).
  - `7_SEG_DISPLAY`: Mode (`Raw Segments` vs `Hex Decoder`), Common Cathode/Anode, and LED color picker.
  - `LED_BAR`: LED color picker.
  - `BUS_BREAKOUT`: Bus bit-width (`4`, `8`, `16`) and breakout direction (`Left`, `Right`).
  - `NE555`: Mode selector (`Astable`, `Monostable`, `Comparator`), `R1`, `R2`, `C` inputs, live calculated frequency/duty-cycle summary, and **Open NE555 Lab** button.
  - `GAL22V10`: **Open PLD Code Editor**, **Open FSM State Diagram**, and `.jed` import/export buttons.
  - Annotations (`REGION_BOX`, `TEXT_LABEL`, `STICKY_NOTE`, `FSM_DIAGRAM`): Width/height, color palette, typography controls, and target `GAL22V10` selector.

---

### `Bottombar.tsx`
**Source:** [`src/ui/components/Bottombar.tsx`](../../src/ui/components/Bottombar.tsx)
Status bar at the bottom of the window:
- Displays contextual keyboard/mouse hints when placing a component, pasting, or routing a wire (`draftWire`).
- Displays live simulation status (`RUNNING` / `PAUSED`), `tickCount`, node/wire counts, and interactive zoom controls (`-`, `%` reset to `100%`, `+`).

---

### `FsmDiagramView.tsx`
**Source:** [`src/ui/components/FsmDiagramView.tsx`](../../src/ui/components/FsmDiagramView.tsx)
Interactive Finite State Machine visualizer (used both inside `CodeEditorView` and as a standalone modal from `App.tsx`):
- Calls `extractFsmFromPld(pldSource)` and renders a circular state-transition SVG graph with self-loops, curved bi-directional bezier edges, and transition condition labels.
- **Live Simulation Highlighting (`v1.2.2`):** Uses a primitive string `liveStateSig` Zustand selector (`"010"`) so the diagram highlights the currently active hardware state in real time with zero unnecessary re-renders when `CLK` toggles without changing state.
- Includes a toggleable **State Transition Truth Table** view and a button to pin the FSM diagram directly onto the schematic canvas as an `FSM_DIAGRAM` node.

---

### Supporting UI Utilities
- **`ConfirmModal.tsx`** ([`src/ui/components/ConfirmModal.tsx`](../../src/ui/components/ConfirmModal.tsx)): Accessible modal dialog for confirming destructive actions (Clear Canvas, Delete Subcircuit, Overwrite Template).
- **`NumberInput.tsx`** ([`src/ui/components/NumberInput.tsx`](../../src/ui/components/NumberInput.tsx)): Controlled numeric `<input>` that allows free intermediate typing (including empty string or scientific notation) and clamps/commits on `Blur` or `Enter`.
- **`ErrorBoundary.tsx`** ([`src/ui/components/ErrorBoundary.tsx`](../../src/ui/components/ErrorBoundary.tsx)): Top-level React error boundary that catches unexpected rendering errors and offers a one-click workspace recovery reset.
