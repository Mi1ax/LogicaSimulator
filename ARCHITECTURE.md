# Logica Simulator Architecture

Logica is built using a strict **Separation of Concerns** architecture. The codebase is deliberately split between pure mathematics/logic (`src/core`) and the visual browser implementation (`src/ui`). This ensures the simulator remains highly performant and the simulation engine could theoretically be run on a server or a separate worker thread.

Below is a breakdown of the project structure and the purpose of every file.

---

## 📁 Project Tree

```text
src/
├── App.tsx
├── main.tsx
├── index.css
├── store/
│   └── useSimulatorStore.ts
├── core/
│   ├── models/
│   │   └── types.ts
│   ├── utils/
│   │   └── nodeLayout.ts
│   └── engine/
│       ├── circuit.ts
│       ├── routing.ts
│       ├── simulation.ts
│       └── nodes/
│           ├── NodeDefinition.ts
│           ├── basicNodes.ts
│           └── index.ts
└── ui/
    ├── components/
    │   ├── Topbar.tsx
    │   └── Toolbox.tsx
    └── canvas/
        ├── CanvasArea.tsx
        ├── Grid.tsx
        ├── theme.ts
        ├── nodes/
        │   ├── GateNode.tsx
        │   └── IONode.tsx
        ├── primitives/
        │   └── Pin.tsx
        └── wires/
            └── WireRenderer.tsx
```

---

## 🧠 State Management (`src/store`)

* **`useSimulatorStore.ts`**: The single source of truth for the application using Zustand. It acts as the bridge between the UI and the pure Core Engine. It holds the layout state (where nodes are), the simulation state (live 1s and 0s), and the UI state (dark mode, draft wires). **Crucially**, components import targeted selectors from this store (e.g., `state => state.theme`) to prevent unnecessary 60fps re-renders when the simulation ticks.

---

## ⚙️ Core Engine (`src/core`)
This folder contains *zero* React or browser-specific code. It is entirely pure TypeScript.

### `core/models/`
* **`types.ts`**: Defines the foundational TypeScript interfaces. This includes `LogicNode`, `Wire`, `Pin`, and the `Signal` type (`0 | 1 | undefined`).

### `core/utils/`
* **`nodeLayout.ts`**: Contains math formulas that calculate a gate's width/height and the exact absolute `(X, Y)` coordinates of its pins. Keeping this separate prevents the UI components from having to do layout math.

### `core/engine/`
* **`circuit.ts`**: Pure functions for manipulating the circuit graph. Contains logic for `addNode`, `deleteNode` (which also safely deletes orphaned wires), and `addWire`.
* **`routing.ts`**: A computational geometry module. It calculates the orthogonal (Manhattan) paths for wires and uses an algorithm to detect where wires cross, generating SVG arc (`A`) commands to draw U-bridge jumpers.
* **`simulation.ts`**: The heartbeat of the app. It calculates discrete simulation "ticks". On every tick, it reads pin states, delegates evaluation to the nodes, toggles clocks, and propagates signals across wires.

### `core/engine/nodes/` (The Registry)
* **`NodeDefinition.ts`**: Defines the interface that all logic components must implement.
* **`basicNodes.ts`**: Contains the actual behavioral logic for `AND`, `OR`, `NOT`, `INPUT`, `OUTPUT`, and `CLOCK`. Each defines its inputs, outputs, and a pure `evaluate(inputs, properties)` function.
* **`index.ts`**: The Node Registry. It maps string types (like `'AND'`) to their definitions. This pattern allows you to easily add new complex chips in the future without ever modifying the core simulation loop.

---

## 🎨 User Interface (`src/ui`)
This folder contains all React components, Tailwind styling, and React-Konva canvas rendering.

### `ui/components/` (Standard HTML/DOM)
* **`Topbar.tsx`**: The top navigation bar. It houses the project title, theme toggle, board clear button, and the **Simulation Playback Controls** (Run/Pause, Step, Speed Slider).
* **`Toolbox.tsx`**: The left sidebar. It iterates through available tools and provides buttons to spawn new nodes into the center of the canvas.

### `ui/canvas/` (React-Konva Canvas)
* **`CanvasArea.tsx`**: The main wrapper for the Konva `<Stage>`. It handles infinite panning, zooming (mouse wheel), keyboard shortcuts (Delete/Backspace), and canvas resizing.
* **`Grid.tsx`**: Renders the dotted background. Highly optimized using a raw HTML5 Canvas `<Shape>` and adaptive step sizing so the app doesn't crash when zooming far out.
* **`theme.ts`**: Because Konva `<Rect>` and `<Circle>` elements cannot read Tailwind CSS classes, this file maps Tailwind colors (like `emerald-500`) to Hex codes based on the active light/dark theme.

#### `ui/canvas/nodes/`
* **`GateNode.tsx`**: Renders standard logic gates (AND, OR, NOT). Handles drag-and-drop snapping and selection highlighting.
* **`IONode.tsx`**: Renders interactive components (INPUT switches, OUTPUT LEDs, CLOCKs). It listens to the live `simState` to glow bright green when powered, and allows users to click the `INPUT` blocks to toggle them.

#### `ui/canvas/primitives/`
* **`Pin.tsx`**: Renders the small connection circles on the sides of nodes. Contains the critical logic for clicking and dragging to draw a `draftWire` between nodes.

#### `ui/canvas/wires/`
* **`WireRenderer.tsx`**: Renders all connections. It uses `routing.ts` to get SVG paths and caches them using `useMemo` for extreme performance. It also renders the invisible "drag handles" that let you manually adjust a wire's routing path, and updates stroke colors at 60fps based on live simulation signals.

---

## 🚀 Entry Points
* **`App.tsx`**: The master layout. It places the Topbar, Toolbox, and CanvasArea on the screen. It also contains the `useInterval` loop that triggers `stepSimulation` based on the user's chosen playback speed.
* **`main.tsx`**: Standard Vite React mount point.
* **`index.css`**: Configures Tailwind CSS and handles the global `.dark` class injection for dark mode.
