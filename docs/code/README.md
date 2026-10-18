# Logica Codebase Reference (`docs/code/`)

> **Documentation Version:** `v1.2.2`
> **Target Codebase Version:** `v1.2.2`

This directory contains the complete technical reference for every module, file, type, function, Zustand store action, and React/Konva component in the **Logica Simulator** codebase (`src/`).

---

## Documentation Index

| Document | Scope (`src/` Path) | Summary |
| :--- | :--- | :--- |
| **[core-models.md](./core-models.md)** | `src/core/models/types.ts` | Fundamental data structures: `Signal` (`0`, `1`, `undefined`, `'X'`), `BuiltinNodeType`, `NodeType`, `Pin`, `Wire`, `DraftWire`, and `LogicNode`. |
| **[core-engine.md](./core-engine.md)** | `src/core/engine/*` | Structural circuit mutators (`circuit.ts`), compiled flat-array event-driven simulation engine (`simulation.ts`), incremental Manhattan router (`routing.ts`), and hierarchical subcircuit registry (`subcircuitRegistry.ts`). |
| **[core-nodes.md](./core-nodes.md)** | `src/core/engine/nodes/*` | Declarative `NodeDefinition` contract, central `NodeRegistry`, built-in gates/I/O/annotations (`basicNodes.ts`), and 74LS / NE555 / Memory / GAL22V10 IC families (`ics/*`). |
| **[core-utils.md](./core-utils.md)** | `src/core/utils/*` | UUID generation (`id.ts`), JEDEC parser (`jedecParser.ts`), CUPL-style PLD compiler (`pldCompiler.ts`), FSM state-transition extractor (`fsmExtractor.ts`), 20px grid geometry (`schematicLayout.ts`), and `.logica` v2 JSON serialization (`serialization.ts`). |
| **[store.md](./store.md)** | `src/store/useSimulatorStore.ts` | Global Zustand state store, multi-tab circuit management, Undo/Redo history stack, clipboard, wire drawing, and high-frequency batch simulation loop. |
| **[ui-canvas.md](./ui-canvas.md)** | `src/ui/canvas/*` | Interactive Konva schematic canvas (`SchematicCanvas.tsx`), Viewport Frustum Culling, Zoom-Out LOD, cached `<Grid>`, `<WireRenderer>`, `<Pin>`, `<SchematicNodeWrapper>`, all node renderers, and specialized editors (`CodeEditorView`, `HexEditorView`, `Ne555LabView`). |
| **[ui-components.md](./ui-components.md)** | `src/App.tsx`, `src/ui/components/*` | Application shell, keyboard shortcuts, `Topbar`, `CircuitTabs`, `Toolbox`, `PropertiesPanel`, `Bottombar`, `FsmDiagramView`, `ConfirmModal`, `NumberInput`, and `ErrorBoundary`. |

---

## Complete Source Tree (`src/`)

```text
src/
├── main.tsx                                    # React DOM entry point
├── App.tsx                                     # Main application shell, global keyboard shortcuts, simulation loop
├── index.css                                   # Tailwind CSS v4 & custom scrollbar styles
├── vite-env.d.ts                               # Vite client TypeScript declarations
├── core/
│   ├── models/
│   │   └── types.ts                            # Core domain types (Signal, Pin, Wire, DraftWire, LogicNode)
│   ├── engine/
│   │   ├── circuit.ts                          # Immutable structural mutators (add/move/delete nodes & wires)
│   │   ├── simulation.ts                       # Compiled flat-array event-driven discrete-tick simulation engine
│   │   ├── routing.ts                          # Incremental Manhattan orthogonal router with AABB & jumper detection
│   │   ├── subcircuitRegistry.ts               # Dynamic NodeDefinition generator for SUBCIRCUIT:<id> modules
│   │   ├── __tests__/                          # Vitest unit tests for gates, circuit mutations, and simulation
│   │   └── nodes/
│   │       ├── NodeDefinition.ts               # Declarative NodeDefinition & PinDefinition interfaces
│   │       ├── index.ts                        # ALL_BUILTIN_NODES list, NodeRegistry map, getNodeDefinition()
│   │       ├── basicNodes.ts                   # Gates, Sources, Switches, Displays, Wiring helpers, Annotations
│   │       └── ics/
│   │           ├── index.ts                    # Barrel export for all IC families
│   │           ├── gates.ts                    # 74LS00, 74LS02, 74LS04, 74LS08, 74LS30, 74LS32, 74LS86
│   │           ├── counters.ts                 # NE555 Timer, 74LS161, 74LS191
│   │           ├── decoders.ts                 # 74LS47, 74LS138, 74LS139, 74LS154
│   │           ├── alu.ts                      # 74LS283, 74LS181
│   │           ├── registers.ts                # 74LS173, 74LS175, 74LS241, 74LS244, 74LS245, 74LS273, 74LS373, 74LS374, 74LS541
│   │           ├── memory.ts                   # 27C256 EPROM, 6116 SRAM, 62256 SRAM
│   │           └── pld.ts                      # GAL22V10 Programmable Logic Device
│   └── utils/
│       ├── id.ts                               # Collision-resistant UUID generator (generateId)
│       ├── jedecParser.ts                      # JEDEC fuse map parser (parseJedec)
│       ├── pldCompiler.ts                      # Boolean equation compiler to GAL22V10 JEDEC (compilePldToJedec)
│       ├── fsmExtractor.ts                     # FSM transition graph extractor from PLD source (extractFsmFromPld)
│       ├── layoutUtils.ts                      # Backwards-compatible pin numbering helper (getSafePinNumber)
│       ├── schematicLayout.ts                  # 20px grid dimensions, rotation pivots, and pin positions
│       ├── serialization.ts                    # Compact .logica v2 serializer and backwards-compatible deserializer
│       └── __tests__/                          # Vitest unit tests for PLD compiler, layout, rotation, serialization
├── store/
│   └── useSimulatorStore.ts                    # Zustand store (structural state, simState, tabs, undo/redo, clipboard)
└── ui/
    ├── canvas/
    │   ├── CanvasArea.tsx                      # Mode router (SchematicCanvas, CodeEditorView, HexEditorView, Ne555LabView)
    │   ├── SchematicCanvas.tsx                 # Konva Stage, pan/zoom, Viewport Frustum Culling, box selection
    │   ├── Grid.tsx                            # Cached HTML5 CanvasPattern dot grid with zoom-adaptive stride
    │   ├── theme.ts                            # Light/Dark color tokens for Konva canvas shapes
    │   ├── CodeEditorView.tsx                  # Built-in PLD equation editor, JEDEC compiler, and live FSM preview
    │   ├── HexEditorView.tsx                   # Live ROM/RAM hexadecimal inspector & editor
    │   ├── Ne555LabView.tsx                    # Interactive NE555 Astable/Monostable oscillator lab & R/C solver
    │   ├── primitives/
    │   │   └── Pin.tsx                         # Interactive pin circle with Zoom-Out LOD and packed bitmask selector
    │   ├── wires/
    │   │   └── WireRenderer.tsx                # Viewport-culled Manhattan wire & waypoint renderer
    │   └── nodes/schematic/
    │       ├── SchematicNodeWrapper.tsx        # Shared Konva Group wrapper (grid snap, transforms, selection)
    │       ├── SchematicGateNode.tsx           # IEEE/ANSI distinctive-shape logic gates
    │       ├── SchematicICNode.tsx             # Dual-Inline Package (DIP) & Subcircuit renderer with Zoom-Out LOD
    │       ├── SchematicIONode.tsx             # INPUT, OUTPUT, CLOCK, VCC, GND, PULL_UP, PULL_DOWN, SUB_*
    │       ├── Schematic7SegNode.tsx           # 7-Segment hex/raw display with precomputed SVG segments
    │       ├── SchematicLEDBarNode.tsx         # 8-segment LED Bar indicator
    │       ├── SchematicDipSwitchNode.tsx      # N-way interactive DIP switch bank
    │       ├── SchematicButtonNode.tsx         # Momentary tactile push button
    │       ├── SchematicKeypadNode.tsx         # 4x4 Matrix hexadecimal keypad
    │       ├── SchematicBusNode.tsx            # BUS_BREAKOUT multi-bit fan-out bar
    │       ├── SchematicNetLabelNode.tsx       # Wireless net tunnel tag
    │       ├── SchematicJunctionNode.tsx       # Wire T-junction solder dot
    │       ├── SchematicNCNode.tsx             # Not-Connected X marker
    │       └── SchematicAnnotationNodes.tsx    # REGION_BOX, TEXT_LABEL, STICKY_NOTE, FSM_DIAGRAM canvas widgets
    └── components/
        ├── Topbar.tsx                          # Simulation controls, frequency selector, file I/O, Examples menu
        ├── CircuitTabs.tsx                     # Multi-tab bar for switching between Main Circuit and Subcircuits
        ├── Toolbox.tsx                         # Collapsible, searchable component palette with custom IC manager
        ├── PropertiesPanel.tsx                 # Context-sensitive inspector for selected nodes and wires
        ├── Bottombar.tsx                       # Status bar, active tool hints, tick counter, zoom controls
        ├── FsmDiagramView.tsx                  # Interactive SVG state-transition diagram & truth table viewer
        ├── ConfirmModal.tsx                    # Reusable modal dialog for destructive confirmations
        ├── NumberInput.tsx                     # Numeric input widget with free typing and blur/Enter clamping
        └── ErrorBoundary.tsx                   # React error boundary for graceful crash recovery
```
