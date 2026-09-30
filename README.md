# Logica Simulator

Logica is a modern, high-performance digital logic and 74LS chip simulator built on a highly optimized React-Konva canvas. It features a pure discrete-event simulation engine fully decoupled from the visual layer, allowing for incredibly fast execution, zero-lag zooming, and an extensible architecture.

![Logica Simulator Preview](https://via.placeholder.com/800x450?text=Logica+Simulator)

## Features
- **Extensible Node Registry**: Easily add new logic gates or custom ICs without touching the core simulation loop.
- **High-Performance Canvas**: Utilizes targeted Zustand selectors, heavy SVG geometry memoization, and adaptive rendering to easily handle thousands of components at 60fps.
- **Manhattan Routing**: Wires automatically map orthogonal segments and generate visual U-bridge jumpers when crossing without intersecting.
- **Live Simulation Playback**: Real-time tick engine with adjustable execution speeds (1Hz to 50Hz) and step-by-step debugging.

## Documentation
- For a deep dive into the separation of concerns, the node registry, and the simulation loop, please read the [Architecture Documentation](./ARCHITECTURE.md).

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
