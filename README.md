# Logica Simulator

Logica is a modern, high-performance digital logic and IC simulator built on a highly optimized React-Konva canvas. It features a pure discrete-event simulation engine fully decoupled from the visual layer, allowing for incredibly fast execution, zero-lag zooming, and an extensible architecture.

> [!NOTE]
> This project is written with the help of AI Gemini.

## Features
- **Strict Separation of Concerns**: Core engine logic and simulation state are completely decoupled from UI components.
- **Advanced IC Simulation**: Accurate timing and hold-state emulation for clocked chips (e.g., 74LS series, 273 Octal D Flip-Flop) and Memory ICs (e.g., 6116 SRAM).
- **Live Hex Editor**: Monitor and manipulate memory contents (RAM/ROM) in real-time while the simulation is running.
- **High-Performance Canvas**: Utilizes targeted Zustand selectors, heavy SVG geometry memoization, and O(1) routing map optimizations to easily handle complex circuits at 60fps.
- **Manhattan Routing**: Wires automatically map orthogonal segments and generate visual U-bridge jumpers when crossing without intersecting.
- **Live Simulation Playback**: Real-time tick engine with adjustable execution speeds (1Hz to 50Hz), step-by-step debugging, and interactive components.

## Documentation
- [Architecture Overview](./docs/architecture.md): Deep dive into the UI vs Engine separation of concerns.
- [Components & Properties](./docs/components.md): How to build new components and configure their internal logic and memory properties.

## Getting Started

### Prerequisites
- Node.js (v18+)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Simulator
Start the local Vite development server:
```bash
npm run dev
```
*Tip: You can load the built-in Micro-Quantum Computer (MQC) example project via the file menu using `public/examples/mqc.logica`.*

### Building for Production
```bash
npm run build
```

## Tech Stack
- **Vite + React + TypeScript**
- **Zustand** (State Management)
- **React-Konva** (Canvas Rendering)
- **Tailwind CSS v4** (UI Styling)
- **Lucide React** (Icons)
