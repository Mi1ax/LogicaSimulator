import { create } from 'zustand';
import { LogicNode, NodeType, Wire, DraftWire } from '../core/models/types';
import * as circuit from '../core/engine/circuit';
import { computeNextState } from '../core/engine/simulation';

export type Selection = { type: 'node' | 'wire', id: string } | null;

export interface PointerSettings {
  mouseWheelBehavior: 'zoom' | 'pan'; // 'zoom' = CAD style, 'pan' = Figma style
  panSpeed: number;
  zoomSensitivity: number;
  invertZoom: boolean;
  boardWidthMm: number;
  boardHeightMm: number;
}

interface SimulatorState {
  appMode: 'schematic' | 'board';
  setAppMode: (mode: 'schematic' | 'board') => void;

  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Settings
  settings: PointerSettings;
  updateSettings: (newSettings: Partial<PointerSettings>) => void;

  // Global Interaction Mode (Cursor vs Wire drawing)

  // UI state for drawing wires
  activeWireType: 'solder' | 'jumper';
  setActiveWireType: (type: 'solder' | 'jumper') => void;
  draftWire: DraftWire | null;
  startWireFromWaypoint: (wireId: string, waypointIndex: number) => void;
  startWire: (nodeId: string, pinId: string, pinType: 'input' | 'output', x: number, y: number) => void;
  updateDraftWire: (x: number, y: number) => void;
  addWaypoint: (x: number, y: number) => void;
  updateWireWaypoints: (wireId: string, waypoints: {x: number, y: number}[]) => void;
  completeWire: (nodeId: string, pinId: string, pinType: 'input' | 'output') => void;
  completeWireOnWire: (wireId: string, dropX?: number, dropY?: number, wp1?: {x:number, y:number}[], wp2?: {x:number, y:number}[]) => void;
  cancelWire: () => void;

  // UI state for selection
  selection: Selection;
  select: (selection: Selection) => void;
  deleteSelection: () => void;

  // UI state for node placement
  placingNodeId: string | null;
  startPlacingNode: (type: NodeType) => void;
  startPlacingBoardNode: (id: string) => void;
  updatePlacingNode: (x: number, y: number) => void;
  finishPlacingNode: () => void;
  cancelPlacingNode: () => void;

  // Core circuit state (delegated to pure logic)
  nodes: LogicNode[];
  wires: Wire[];
  boardTraces: import('../core/models/types').BoardTrace[];

  // Board drawing state
  draftBoardTrace: import('../core/models/types').BoardTrace | null;
  startBoardTrace: (x: number, y: number) => void;
  updateDraftBoardTrace: (x: number, y: number) => void;
  addBoardTraceWaypoint: () => void;
  completeBoardTrace: () => void;
  cancelBoardTrace: () => void;

  // Simulation State
  simState: import('../core/engine/simulation').SimulationState;
  simRunning: boolean;
  simSpeed: number; // Hz (ticks per second)
  
  // View State
  boardScale: number;
  setBoardScale: (scale: number) => void;

  addNode: (type: NodeType, x: number, y: number) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeProperties: (id: string, props: Record<string, any>) => void;
  clearNodes: () => void;

  // Simulation Controls
  resetSimulation: () => void;
  stepSimulation: () => void;
  setSimRunning: (running: boolean) => void;
  setSimSpeed: (hz: number) => void;
  toggleInputNode: (nodeId: string) => void;
  setNodeInputCount: (nodeId: string, count: number) => void;

  // Undo / Redo
  history: { nodes: LogicNode[], wires: Wire[], boardTraces: import('../core/models/types').BoardTrace[] }[];
  future: { nodes: LogicNode[], wires: Wire[], boardTraces: import('../core/models/types').BoardTrace[] }[];
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
}

const pushHistory = (state: SimulatorState) => ({
  history: [...state.history, {
    nodes: structuredClone(state.nodes),
    wires: structuredClone(state.wires),
    boardTraces: structuredClone(state.boardTraces || [])
  }].slice(-50),
  future: []
});

export const useSimulatorStore = create<SimulatorState>((set) => ({
  appMode: 'schematic',
  setAppMode: (mode) => set({ appMode: mode, selection: null }),

  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  settings: {
    mouseWheelBehavior: 'zoom',
    panSpeed: 1.0,
    zoomSensitivity: 1.0,
    invertZoom: false,
    boardWidthMm: 50,
    boardHeightMm: 70,
  },
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),

  activeWireType: 'solder',
  setActiveWireType: (type) => set({ activeWireType: type }),


  nodes: [],
  wires: [],
  boardTraces: [],
  draftWire: null,
  draftBoardTrace: null,
  selection: null,
  
  boardScale: 1,
  setBoardScale: (scale) => set({ boardScale: scale }),

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
      nodes: structuredClone(previous.nodes),
      wires: structuredClone(previous.wires),
      boardTraces: structuredClone(previous.boardTraces),
      selection: null,
      history: state.history.slice(0, -1),
      future: [{ nodes: state.nodes, wires: state.wires, boardTraces: state.boardTraces }, ...state.future],
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      nodes: structuredClone(next.nodes),
      wires: structuredClone(next.wires),
      boardTraces: structuredClone(next.boardTraces),
      selection: null,
      history: [...state.history, { nodes: state.nodes, wires: state.wires, boardTraces: state.boardTraces }],
      future: state.future.slice(1),
    };
  }),

  select: (selection) => set({ selection }),

  deleteSelection: () => set((state) => {
    if (!state.selection) return state;
    if (state.selection.type === 'node') {
      if (state.appMode === 'board') {
        const nodes = state.nodes.map(n => n.id === state.selection!.id ? { ...n, boardX: undefined, boardY: undefined } : n);
        return { ...state, nodes, ...pushHistory(state), selection: null };
      } else {
        const nextCircuit = circuit.deleteNode(state, state.selection.id);
        return { ...state, ...nextCircuit, ...pushHistory(state), selection: null };
      }
    } else {
      const nextCircuit = circuit.deleteWire(state, state.selection.id);
      return { ...state, ...nextCircuit, ...pushHistory(state), selection: null };
    }
  }),

  placingNodeId: null,
  
  startPlacingNode: (type) => set((state) => {
    const nextState = circuit.addNode(state, type, 0, 0);
    const newNode = nextState.nodes[nextState.nodes.length - 1];
    return { ...nextState, placingNodeId: newNode.id };
  }),

  startPlacingBoardNode: (id) => set((state) => {
    const nextState = circuit.moveNode(state, id, 0, 0, true);
    return { ...nextState, placingNodeId: id };
  }),

  updatePlacingNode: (x, y) => set((state) => {
    if (!state.placingNodeId) return state;
    return circuit.moveNode(state, state.placingNodeId, x, y, state.appMode === 'board');
  }),

  finishPlacingNode: () => set((state) => {
    if (!state.placingNodeId) return state;
    return { placingNodeId: null, ...pushHistory(state) };
  }),

  cancelPlacingNode: () => set((state) => {
    if (!state.placingNodeId) return state;
    if (state.appMode === 'schematic') {
      return { ...state, ...circuit.deleteNode(state, state.placingNodeId), placingNodeId: null };
    } else {
      return {
        ...state,
        nodes: state.nodes.map(n => n.id === state.placingNodeId ? { ...n, boardX: undefined, boardY: undefined } : n),
        placingNodeId: null
      };
    }
  }),

  addNode: (type, x, y) => set((state) => ({ ...circuit.addNode(state, type, x, y), ...pushHistory(state) })),
  updateNodePosition: (id, x, y) => set((state) => circuit.moveNode(state, id, x, y, state.appMode === 'board')), // History saved on drag start
  updateNodeProperties: (id, props) => set((state) => {
    if (state.placingNodeId === id) {
      return circuit.updateNodeProperties(state, id, props);
    }
    return { ...circuit.updateNodeProperties(state, id, props), ...pushHistory(state) };
  }),
  setNodeInputCount: (id, count) => set((state) => ({ ...circuit.setNodeInputCount(state, id, count), ...pushHistory(state) })),

  clearNodes: () => set({
    nodes: [],
    wires: [],
    draftWire: null,
    selection: null,
    simState: { tickCount: 0, pinStates: {}, wireStates: {} },
    simRunning: false
  }),

  resetSimulation: () => set((state) => {
    const resetNodes = state.nodes.map(n => {
      if (n.properties) {
        const newProps = { ...n.properties };
        if (newProps.counter !== undefined) newProps.counter = 0;
        if (newProps.lastClk !== undefined) newProps.lastClk = 0;
        return { ...n, properties: newProps };
      }
      return n;
    });
    return { nodes: resetNodes, simState: { tickCount: 0, pinStates: {}, wireStates: {} } };
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

  updateWireWaypoints: (wireId, waypoints) => set((state) => {
    return {
      ...state,
      wires: state.wires.map(w => w.id === wireId ? { ...w, waypoints } : w)
    };
  }),

  
  completeWire: (nodeId, pinId, pinType) => set((state) => {
    if (!state.draftWire) return state;

    const { sourceNodeId, sourcePinId, sourceType } = state.draftWire;

    if (sourceNodeId === nodeId) {
      return { draftWire: null };
    }

    // Allow any-to-any connections.
    // If the types differ, standard logic: source is output, target is input.
    // Otherwise, just use the drag direction (start is source, drop is target).
    let isSourceOutput = true;
    if (sourceType !== pinType) {
      isSourceOutput = sourceType === 'output';
    }

    const outputPinId = isSourceOutput ? sourcePinId : pinId;
    const outputNodeId = isSourceOutput ? sourceNodeId : nodeId;
    const inputPinId = isSourceOutput ? pinId : sourcePinId;
    const inputNodeId = isSourceOutput ? nodeId : sourceNodeId;

    let nextCircuit = circuit.addWire(
      state, 
      outputNodeId, 
      outputPinId, 
      inputNodeId, 
      inputPinId, 
      state.appMode === 'board' ? state.activeWireType : undefined
    );

    const waypoints = state.draftWire.waypoints;
    const finalWaypoints = isSourceOutput ? (waypoints || []) : (waypoints ? [...waypoints].reverse() : []);
    if (finalWaypoints.length > 0) {
      const newWire = nextCircuit.wires[nextCircuit.wires.length - 1];
      newWire.waypoints = finalWaypoints;
    }

    return { ...nextCircuit, ...pushHistory(state), draftWire: null };
  }),

  completeWireOnWire: (targetWireId: string, dropX?: number, dropY?: number, splitWp1?: {x:number, y:number}[], splitWp2?: {x:number, y:number}[]) => set((state) => {
    if (!state.draftWire) return state;

    const targetWire = state.wires.find(w => w.id === targetWireId);
    if (!targetWire) return { draftWire: null };

    const { sourceNodeId, sourcePinId, sourceType, endX, endY } = state.draftWire;
    const finalX = dropX ?? endX;
    const finalY = dropY ?? endY;

    if (sourceType === 'input') {
      let nextState = circuit.addNode(state, 'JUNCTION', finalX, finalY);
      const junctionNode = nextState.nodes[nextState.nodes.length - 1];
      junctionNode.x = finalX;
      junctionNode.y = finalY;
      
      const jInPin = junctionNode.inputs[0];
      const jOutPin = junctionNode.outputs[0];

      nextState = circuit.addWire(
        nextState,
        targetWire.sourceNodeId,
        targetWire.sourcePinId,
        junctionNode.id,
        jInPin.id,
        state.appMode === 'board' ? state.activeWireType : undefined
      );

      if (splitWp1 && splitWp1.length > 0) {
        nextState.wires[nextState.wires.length - 1].waypoints = splitWp1;
      }

      nextState.wires = nextState.wires.map(w => {
        if (w.id === targetWire.id) {
          return { ...w, sourceNodeId: junctionNode.id, sourcePinId: jOutPin.id, waypoints: splitWp2 };
        }
        return w;
      });

      nextState = circuit.addWire(
        nextState,
        junctionNode.id,
        jOutPin.id,
        sourceNodeId,
        sourcePinId,
        state.appMode === 'board' ? state.activeWireType : undefined
      );

      const waypoints = state.draftWire.waypoints;
      if (waypoints && waypoints.length > 0) {
        nextState.wires[nextState.wires.length - 1].waypoints = [...waypoints].reverse();
      }

      return { ...nextState, ...pushHistory(state), draftWire: null };
    } else {
      let nextState = circuit.addNode(state, 'JUNCTION', finalX, finalY);
      const junctionNode = nextState.nodes[nextState.nodes.length - 1];
      junctionNode.x = finalX;
      junctionNode.y = finalY;
      
      const jInPin = junctionNode.inputs[0];
      const jOutPin = junctionNode.outputs[0];

      nextState = circuit.addWire(
        nextState,
        targetWire.sourceNodeId,
        targetWire.sourcePinId,
        junctionNode.id,
        jInPin.id,
        state.appMode === 'board' ? state.activeWireType : undefined
      );

      if (splitWp1 && splitWp1.length > 0) {
        nextState.wires[nextState.wires.length - 1].waypoints = splitWp1;
      }

      nextState.wires = nextState.wires.map(w => {
        if (w.id === targetWire.id) {
          return { ...w, sourceNodeId: junctionNode.id, sourcePinId: jOutPin.id, waypoints: splitWp2 };
        }
        return w;
      });

      nextState = circuit.addWire(
        nextState,
        sourceNodeId,
        sourcePinId,
        junctionNode.id,
        jInPin.id,
        state.appMode === 'board' ? state.activeWireType : undefined
      );

      const waypoints = state.draftWire.waypoints;
      if (waypoints && waypoints.length > 0) {
        nextState.wires[nextState.wires.length - 1].waypoints = waypoints;
      }

      return { ...nextState, ...pushHistory(state), draftWire: null };
    }
  }),

  startWireFromWaypoint: (wireId: string, waypointIndex: number) => set((state) => {
    const targetWire = state.wires.find(w => w.id === wireId);
    if (!targetWire || !targetWire.waypoints || waypointIndex >= targetWire.waypoints.length) return state;

    const wp = targetWire.waypoints[waypointIndex];
    const finalX = wp.x;
    const finalY = wp.y;

    const splitWp1 = targetWire.waypoints.slice(0, waypointIndex);
    const splitWp2 = targetWire.waypoints.slice(waypointIndex + 1);

    let nextState = circuit.addNode(state, 'JUNCTION', finalX, finalY);
    const junctionNode = nextState.nodes[nextState.nodes.length - 1];
    junctionNode.x = finalX;
    junctionNode.y = finalY;
    
    const jInPin = junctionNode.inputs[0];
    const jOutPin = junctionNode.outputs[0];

    nextState = circuit.addWire(
      nextState,
      targetWire.sourceNodeId,
      targetWire.sourcePinId,
      junctionNode.id,
      jInPin.id,
      state.appMode === 'board' ? state.activeWireType : undefined
    );

    if (splitWp1.length > 0) {
      nextState.wires[nextState.wires.length - 1].waypoints = splitWp1;
    }

    nextState.wires = nextState.wires.map(w => {
      if (w.id === targetWire.id) {
        return { ...w, sourceNodeId: junctionNode.id, sourcePinId: jOutPin.id, waypoints: splitWp2 };
      }
      return w;
    });

    return {
      ...nextState,
      ...pushHistory(state),
      draftWire: {
        sourceNodeId: junctionNode.id,
        sourcePinId: jOutPin.id,
        sourceType: 'output',
        endX: finalX,
        endY: finalY,
        waypoints: []
      },
      selection: null
    };
  }),

  cancelWire: () => set({ draftWire: null }),


  
  startBoardTrace: (x, y) => set((state) => {
    // Provide TWO points so updateDraftBoardTrace can replace the second one as the floating preview!
    return { draftBoardTrace: { id: 'draft', type: state.activeWireType, points: [{ x, y }, { x, y }] } };
  }),

  updateDraftBoardTrace: (x, y) => set((state) => {
    if (!state.draftBoardTrace) return state;
    
    // We keep points as the fixed waypoints, and the UI can append the floating cursor point
    // Let's store the floating cursor directly in the store to make it easy.
    return { 
      draftBoardTrace: { 
        ...state.draftBoardTrace, 
        // We'll treat the last point as the floating point, or let's add a separate property `previewPoint: {x,y}`
        // For simplicity, let's just make points include the floating point at the end!
        points: [...state.draftBoardTrace.points.slice(0, -1), { x, y }] 
      } 
    };
  }),

  addBoardTraceWaypoint: () => set((state) => {
    if (!state.draftBoardTrace) return state;
    const points = state.draftBoardTrace.points;
    const last = points[points.length - 1];
    return {
      draftBoardTrace: {
        ...state.draftBoardTrace,
        points: [...points, { ...last }] // Duplicate the last point so updateDraft modifies the new tail
      }
    };
  }),

  completeBoardTrace: () => set((state) => {
    if (!state.draftBoardTrace || state.draftBoardTrace.points.length < 2) return { draftBoardTrace: null };
    const newTrace: import('../core/models/types').BoardTrace = {
      id: `trace-${Date.now()}`,
      type: state.draftBoardTrace.type,
      points: [...state.draftBoardTrace.points]
    };
    return { boardTraces: [...state.boardTraces, newTrace], ...pushHistory(state), draftBoardTrace: null };
  }),

  cancelBoardTrace: () => set({ draftBoardTrace: null }),
}));

// Provide grid size constant exported from core
export { GRID_SIZE } from '../core/engine/circuit';
