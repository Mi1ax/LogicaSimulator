---
name: Architecture, Canvas Performance & Responsive UI
description: Enforces Tauri+Rust simulation architecture, Konva schematic performance invariants, and half-screen responsive UI layout rules
trigger: always_on
---

# Architecture, Canvas Performance & Responsive UI Guidelines

## 1. Tauri + Rust Simulation Architecture
- **Rust-Only Runtime Engine**: The circuit simulation engine runs natively in Rust (`src-tauri/src/main.rs` and modular `src-tauri/src/engine/`) via Tauri IPC (`src/core/engine/tauriBridge.ts`). Do not reintroduce JS simulation logic into `src/core/engine/simulation.ts`.
- **Modular Rust Engine Layout**: Keep `src-tauri/src/engine/` split into focused modules (`types.rs`, `compiler.rs`, `simulator.rs`, `analyzer.rs`, and `chips/{basic,ttl_gates,decoders_alu,sequential,memory,pld}.rs`) rather than placing large implementations in a single file.
- **Adding / Modifying Components**: When adding or changing a component's simulation behavior, register its `NodeKind` variant in `src-tauri/src/engine/types.rs`, implement its logic in the corresponding `src-tauri/src/engine/chips/*.rs` submodule, and update pin/UI metadata in `src/core/engine/nodes/`.
- **Environment & GPU Acceleration**:
  - `cargo` and `rustc` live in `~/.cargo/bin` (`export PATH="$HOME/.cargo/bin:$PATH"`).
  - Use `./run` in the project root to start `tauri:dev`.
  - Do **not** set `WEBKIT_DISABLE_DMABUF_RENDERER=1` by default — it forces software CPU rendering in WebKitGTK and causes severe schematic canvas lag.

## 2. Schematic Canvas (Konva) Performance Invariants
- **No Hit-Canvas Readbacks During Pan/Zoom/Drag**: Never call `layer.drawHit()` or `stage.getIntersection()` while panning the Stage, wheel-zooming, or while `Konva.isDragging()` is true. Calling `getIntersection()` triggers a synchronous GPU-to-CPU `getImageData` readback that stalls 60+ FPS rendering.
- **O(1) Selection Lookups**: Always use `isIdSelected(state, id)` (backed by a cached `Set<string>`) instead of `state.multiSelection.includes(id)` inside node and wire components.
- **Preserve Konva Bitmap Caches**: Keep selection highlights (`<Rect>`) outside cached `<Group>` refs (`staticGroupRef` in `SchematicICNode.tsx`) so selecting/deselecting all components (`Ctrl+A` or marquee) never invalidates 2x HiDPI bitmap caches.
- **Fast Mass-Drag**: Keep `NodeVisual` memoized (`React.memo`) and subscribe to `(posX, posY)` directly inside `SchematicNodeWrapper.tsx` so dragging 500+ selected nodes updates Group coordinates without re-rendering node interiors.
- **DOM Selection Prevention**: Keep `user-select: none` on the app shell and handle `Ctrl+A` inside `SchematicCanvas.tsx` so keyboard shortcuts select circuit elements rather than browser DOM nodes.

## 3. Responsive UI & Half-Screen / Tiling WM Support
- **Window Minimum Size**: Keep `"minWidth": 480` and `"minHeight": 360` in `src-tauri/tauri.conf.json` so tiling window managers (Hyprland, Sway, i3) and half-screen splits do not squash or clip the WebKitGTK viewport.
- **No Overlapping Absolute Toolbars**: Never use `absolute left-*` / `absolute right-*` for toolbar groups (`Topbar`, `Bottombar`) that will collide with centered controls on half-screen widths (`640px–960px`). Always use flex containers (`justify-between gap-2`, `whitespace-nowrap`, `shrink-0`, `flex-wrap`).
- **Adaptive Sidebar Widths**: Use responsive widths (`w-52 lg:w-60 xl:w-64 shrink-0` for `Toolbox` / `PropertiesPanel`, `w-64 lg:w-72 xl:w-80 shrink-0` for `CodeEditorView` / `Ne555LabView` panels) so sidebars do not crowd the main workspace on half-screen windows.
