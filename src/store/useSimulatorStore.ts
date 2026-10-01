import { create } from 'zustand';
import { LogicNode, NodeType, Wire, DraftWire } from '../core/models/types';
import * as circuit from '../core/engine/circuit';
import { computeNextState } from '../core/engine/simulation';

export type Selection = { type: 'node' | 'wire', id: string } | null;

interface SimulatorState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // UI state for drawing wires
  draftWire: DraftWire | null;
  startWire: (nodeId: string, pinId: string, pinType: 'input' | 'output', x: number, y: number) => void;
  updateDraftWire: (x: number, y: number) => void;
  completeWire: (nodeId: string, pinId: string, pinType: 'input' | 'output') => void;
  cancelWire: () => void;

  // UI state for selection
  selection: Selection;
  select: (selection: Selection) => void;
  deleteSelection: () => void;

  // Core circuit state (delegated to pure logic)
  nodes: LogicNode[];
  wires: Wire[];
  
  // Simulation State
  simState: import('../core/engine/simulation').SimulationState;
  simRunning: boolean;
  simSpeed: number; // Hz (ticks per second)
  
  addNode: (type: NodeType, x: number, y: number) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeProperties: (id: string, props: Record<string, any>) => void;
  clearNodes: () => void;
  setWireMidX: (wireId: string, midX: number) => void;

  // Simulation Controls
  stepSimulation: () => void;
  setSimRunning: (running: boolean) => void;
  setSimSpeed: (hz: number) => void;
  toggleInputNode: (nodeId: string) => void;
  addWaypoint: (x: number, y: number) => void;
  updateWireWaypoints: (wireId: string, waypoints: {x: number, y: number}[]) => void;
  setNodeInputCount: (nodeId: string, count: number) => void;

  // Undo / Redo
  history: { nodes: LogicNode[], wires: Wire[] }[];
  future: { nodes: LogicNode[], wires: Wire[] }[];
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
}

const pushHistory = (state: SimulatorState) => ({
  history: [...state.history, { 
    nodes: JSON.parse(JSON.stringify(state.nodes)), 
    wires: JSON.parse(JSON.stringify(state.wires)) 
  }].slice(-50),
  future: []
});

export const useSimulatorStore = create<SimulatorState>((set) => ({
  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  nodes: [],
  wires: [],
  draftWire: null,
  selection: null,

  simState: { tickCount: 0, pinStates: {}, wireStates: {} },
  simRunning: false,
  simSpeed: 10,

  history: [],
  future: [],

  saveHistory: () => set((state) => pushHistory(state)),

  undo: () => set((state) => {
    if (state.history.length === 0) return state;
    const previous = state.history[state.history.length - 1];
    return {
      nodes: JSON.parse(JSON.stringify(previous.nodes)),
      wires: JSON.parse(JSON.stringify(previous.wires)),
      selection: null,
      history: state.history.slice(0, -1),
      future: [{ nodes: state.nodes, wires: state.wires }, ...state.future],
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      nodes: JSON.parse(JSON.stringify(next.nodes)),
      wires: JSON.parse(JSON.stringify(next.wires)),
      selection: null,
      history: [...state.history, { nodes: state.nodes, wires: state.wires }],
      future: state.future.slice(1),
    };
  }),

  select: (selection) => set({ selection }),

  deleteSelection: () => set((state) => {
    if (!state.selection) return state;
    if (state.selection.type === 'node') {
      const nextCircuit = circuit.deleteNode(state, state.selection.id);
      return { ...nextCircuit, ...pushHistory(state), selection: null };
    } else {
      const nextCircuit = circuit.deleteWire(state, state.selection.id);
      return { ...nextCircuit, ...pushHistory(state), selection: null };
    }
  }),
  
  addNode: (type, x, y) => set((state) => ({ ...circuit.addNode(state, type, x, y), ...pushHistory(state) })),
  updateNodePosition: (id, x, y) => set((state) => circuit.moveNode(state, id, x, y)), // History saved on drag start
  updateNodeProperties: (id, props) => set((state) => ({ ...circuit.updateNodeProperties(state, id, props), ...pushHistory(state) })),
  setNodeInputCount: (id, count) => set((state) => ({ ...circuit.setNodeInputCount(state, id, count), ...pushHistory(state) })),

  clearNodes: () => set({ 
    nodes: [], 
    wires: [], 
    draftWire: null, 
    selection: null,
    simState: { tickCount: 0, pinStates: {}, wireStates: {} },
    simRunning: false 
  }),

  stepSimulation: () => set((state) => ({ 
    simState: computeNextState(state.nodes, state.wires, state.simState) 
  })),

  setSimRunning: (running) => set({ simRunning: running }),
  setSimSpeed: (hz) => set({ simSpeed: hz }),

  toggleInputNode: (id) => set((state) => {
    const node = state.nodes.find(n => n.id === id);
    if (!node || node.type !== 'INPUT') return state;
    const currentVal = node.properties?.value === 1 ? 0 : 1;
    return circuit.updateNodeProperties(state, id, { value: currentVal });
  }),

  startWire: (nodeId, pinId, pinType, x, y) => set({
    draftWire: { sourceNodeId: nodeId, sourcePinId: pinId, sourceType: pinType, endX: x, endY: y, waypoints: [] },
    selection: null
  }),

  updateDraftWire: (x, y) => set((state) => {
    if (!state.draftWire) return state;
    return { draftWire: { ...state.draftWire, endX: x, endY: y } };
  }),

  addWaypoint: (x, y) => set((state) => {
    if (!state.draftWire) return state;
    return { draftWire: { ...state.draftWire, waypoints: [...(state.draftWire.waypoints || []), { x, y }] } };
  }),

  completeWire: (nodeId, pinId, pinType) => set((state) => {
    if (!state.draftWire) return state;
    
    const { sourceNodeId, sourcePinId, sourceType, waypoints } = state.draftWire;
    
    if (sourceNodeId === nodeId || sourceType === pinType) {
      return { draftWire: null };
    }

    const isSourceOutput = sourceType === 'output';
    const outputPinId = isSourceOutput ? sourcePinId : pinId;
    const outputNodeId = isSourceOutput ? sourceNodeId : nodeId;
    const inputPinId = isSourceOutput ? pinId : sourcePinId;
    const inputNodeId = isSourceOutput ? nodeId : sourceNodeId;

    let nextCircuit = circuit.addWire(state, outputNodeId, outputPinId, inputNodeId, inputPinId);
    
    // Reverse waypoints if we started drawing from an input to an output
    const finalWaypoints = isSourceOutput ? (waypoints || []) : (waypoints ? [...waypoints].reverse() : []);
    
    if (finalWaypoints.length > 0) {
      // Find the newly added wire (it's the last one)
      const newWire = nextCircuit.wires[nextCircuit.wires.length - 1];
      newWire.waypoints = finalWaypoints;
    }

    return { ...nextCircuit, ...pushHistory(state), draftWire: null };
  }),

  cancelWire: () => set({ draftWire: null }),

  setWireMidX: (wireId, midX) => set((state) => circuit.setWireMidX(state, wireId, midX)),
  
  updateWireWaypoints: (wireId, waypoints) => set((state) => circuit.updateWireWaypoints(state, wireId, waypoints)),
}));

// Provide grid size constant exported from core
export { GRID_SIZE } from '../core/engine/circuit';
