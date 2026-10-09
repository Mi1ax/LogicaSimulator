import { updateSubcircuitRegistry, removeSubcircuitFromRegistry } from '../core/engine/subcircuitRegistry';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LogicNode, NodeType, Wire, DraftWire } from '../core/models/types';
import * as circuit from '../core/engine/circuit';
import { syncSubcircuitInstances } from '../core/engine/circuit';
import { computeNextState } from '../core/engine/simulation';
import { getSchematicPinPosition } from '../core/utils/schematicLayout';
import { generateId } from '../core/utils/id';

export type Selection = { type: 'node' | 'wire', id: string } | null;

export interface PointerSettings {
  mouseWheelBehavior: 'zoom' | 'pan'; // 'zoom' = CAD style, 'pan' = Figma style
  panSpeed: number;
  zoomSensitivity: number;
  invertZoom: boolean;
}

interface SimulatorState {
  appMode: 'schematic' | 'hex' | 'code';
  setAppMode: (mode: 'schematic' | 'hex' | 'code') => void;

  savedCircuits: Record<string, { name: string, nodes: LogicNode[], wires: Wire[], history: any[], future: any[] }>;
  activeSubcircuitId: string;
  addSubcircuit: (name: string) => void;
  setActiveSubcircuit: (id: string) => void;
  deleteSubcircuit: (id: string) => void;

  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Settings
  settings: PointerSettings;
  updateSettings: (newSettings: Partial<PointerSettings>) => void;

  // Global Interaction Mode (Cursor vs Wire drawing)

  // UI state for drawing wires
  draftWire: DraftWire | null;
  startWireFromWaypoint: (wireId: string, waypointIndex: number) => void;
  startWire: (nodeId: string, pinId: string, pinType: 'input' | 'output' | 'bidir', x: number, y: number) => void;
  updateDraftWire: (x: number, y: number) => void;
  addWaypoint: (x: number, y: number) => void;
  updateWireWaypoints: (wireId: string, waypoints: {x: number, y: number}[]) => void;
  completeWire: (nodeId: string, pinId: string, pinType: 'input' | 'output' | 'bidir') => void;
  completeWireOnWire: (wireId: string, dropX?: number, dropY?: number, wp1?: {x:number, y:number}[], wp2?: {x:number, y:number}[]) => void;
  cancelWire: () => void;

  // UI state for selection
  selection: Selection;
  select: (selection: Selection, append?: boolean) => void;
  deleteSelection: () => void;
  multiSelection: string[];
  setMultiSelection: (ids: string[]) => void;
  selectedMemoryNodeId: string | null;
  setSelectedMemoryNodeId: (nodeId: string | null) => void;
  schematicPos: { x: number, y: number };
  setSchematicPos: (pos: { x: number, y: number }) => void;
  schematicScale: number;
  setSchematicScale: (scale: number) => void;
  canvasOffset: { x: number, y: number };
  setCanvasOffset: (offset: { x: number, y: number }) => void;

  // UI state for node placement
  placingNodeId: string | null;
  startPlacingNode: (type: NodeType) => void;
  updatePlacingNode: (x: number, y: number) => void;
  finishPlacingNode: () => void;

  cancelPlacingNode: () => void;

  // Core circuit state (delegated to pure logic)
  nodes: LogicNode[];
  wires: Wire[];
  // Simulation State
  simState: import('../core/engine/simulation').SimulationState;
  simRunning: boolean;
  simSpeed: number; // Hz (ticks per second)
  
  // View State

  addNode: (type: NodeType, x: number, y: number) => void;
  updateNodePosition: (id: string, x: number, y: number, finalize?: boolean) => void;
  updateNodeProperties: (id: string, props: Record<string, any>) => void;
  clearNodes: () => void;

  // Simulation Controls
  resetSimulation: () => void;
  stepSimulation: () => void;
  stepSimulationBatch: (ticks: number) => void;
  setSimRunning: (running: boolean) => void;
  setSimSpeed: (hz: number) => void;
  toggleInputNode: (nodeId: string) => void;
  setNodeInputCount: (nodeId: string, count: number) => void;
  setNodeOutputCount: (nodeId: string, count: number) => void;

  // Undo / Redo
  history: { nodes: LogicNode[], wires: Wire[] }[];
  future: { nodes: LogicNode[], wires: Wire[] }[];
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
}

const pushHistory = (state: SimulatorState) => ({
  history: [...state.history, {
    nodes: structuredClone(state.nodes),
    wires: structuredClone(state.wires)
  }].slice(-50),
  future: []
});


const applyAutoConnect = (state: SimulatorState, movedNodeIds: string[]) => {
  const movedNodes = state.nodes.filter(n => movedNodeIds.includes(n.id));
  const otherNodes = state.nodes.filter(n => !movedNodeIds.includes(n.id));
  
  const movedPins = movedNodes.flatMap(n => 
    [...n.inputs, ...n.outputs].map(p => ({
      nodeId: n.id,
      pinId: p.id,
      type: p.type,
      pos: getSchematicPinPosition(n, p.id)
    }))
  );
  
  const otherPins = otherNodes.flatMap(n => 
    [...n.inputs, ...n.outputs].map(p => ({
      nodeId: n.id,
      pinId: p.id,
      type: p.type,
      pos: getSchematicPinPosition(n, p.id)
    }))
  );
  
  let newWires = [...state.wires];
  let changed = false;
  
  movedPins.forEach(mp => {
    otherPins.forEach(op => {
      const dx = mp.pos.x - op.pos.x;
      const dy = mp.pos.y - op.pos.y;
      if (dx * dx + dy * dy < 25) { // within 5 pixels
        const alreadyConnected = newWires.some(w => 
          (w.sourcePinId === mp.pinId && w.targetPinId === op.pinId) ||
          (w.sourcePinId === op.pinId && w.targetPinId === mp.pinId)
        );
        if (!alreadyConnected) {
          let source = mp;
          let target = op;
          if (op.type === 'output' && mp.type !== 'output') {
            source = op;
            target = mp;
          }
          newWires.push({
            id: generateId('wire'),
            sourceNodeId: source.nodeId,
            sourcePinId: source.pinId,
            targetNodeId: target.nodeId,
            targetPinId: target.pinId
          });
          changed = true;
        }
      }
    });
  });
  
  return changed ? { ...state, wires: newWires } : state;
};

export const useSimulatorStore = create<SimulatorState>()(
  persist(
    (set) => ({
  appMode: 'schematic',
  setAppMode: (mode) => set({ appMode: mode, selection: null }),

  savedCircuits: { 'main': { name: 'Main', nodes: [], wires: [], history: [], future: [] } },
  activeSubcircuitId: 'main',
  addSubcircuit: (name) => set((state) => {
    const id = generateId('circuit');
    updateSubcircuitRegistry(id, name, []);
    return {
      savedCircuits: { ...state.savedCircuits, [id]: { name, nodes: [], wires: [], history: [], future: [] } }
    };
  }),
  setActiveSubcircuit: (id) => set((state) => {
    if (state.activeSubcircuitId === id) return {};
    
    // Save current to savedCircuits
    const newSaved = {
      ...state.savedCircuits,
      [state.activeSubcircuitId]: {
        name: state.savedCircuits[state.activeSubcircuitId]?.name || 'Unknown',
        nodes: state.nodes,
        wires: state.wires,
        
        history: state.history,
        future: state.future
      }
    };
    
    // Load new from savedCircuits
    let target = newSaved[id] || { name: 'Unknown', nodes: [], wires: [], history: [], future: [] };
    
    // Sync instantiated subcircuits
    const synced = syncSubcircuitInstances(target.nodes, target.wires);
    target = { ...target, nodes: synced.nodes, wires: synced.wires };
    
    return {
      savedCircuits: newSaved,
      activeSubcircuitId: id,
      nodes: target.nodes,
      wires: target.wires,
      
      history: target.history,
      future: target.future,
      selection: null,
      multiSelection: [],
      placingNodeId: null,
      draftWire: null
    };
  }),

  
  deleteSubcircuit: (id) => set((state) => {
    if (id === 'main') return state; // Cannot delete main
    
    const newSaved = { ...state.savedCircuits };
    delete newSaved[id];
    removeSubcircuitFromRegistry(id);
    
    if (state.activeSubcircuitId === id) {
      const target = newSaved['main'];
      const synced = syncSubcircuitInstances(target.nodes, target.wires);
      
      return {
        savedCircuits: newSaved,
        activeSubcircuitId: 'main',
        nodes: synced.nodes,
        wires: synced.wires,
        
        history: target.history,
        future: target.future,
        selection: null,
        multiSelection: [],
        placingNodeId: null,
        draftWire: null,
      };
    }
    
    return { savedCircuits: newSaved };
  }),

  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

  settings: {
    mouseWheelBehavior: 'zoom',
    panSpeed: 1.0,
    zoomSensitivity: 1.0,
    invertZoom: false,
  },
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),

  nodes: [],
  wires: [],
  
  draftWire: null,
  selection: null,
  multiSelection: [],
  setMultiSelection: (ids) => set({ multiSelection: ids, selection: ids.length > 0 ? { type: 'node', id: ids[0] } : null }),
  selectedMemoryNodeId: null,
  setSelectedMemoryNodeId: (id) => set({ selectedMemoryNodeId: id }),
  schematicPos: { x: 0, y: 0 },
  setSchematicPos: (pos) => set({ schematicPos: pos }),
  schematicScale: 1,
  setSchematicScale: (scale) => set({ schematicScale: scale }),
  canvasOffset: { x: 0, y: 0 },
  setCanvasOffset: (offset) => set({ canvasOffset: offset }),
  

  simState: { tickCount: 0, pinStates: {}, wireStates: {}, nodeStates: {} },
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
      
      selection: null,
      history: state.history.slice(0, -1),
      future: [{ nodes: state.nodes, wires: state.wires }, ...state.future],
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      nodes: structuredClone(next.nodes),
      wires: structuredClone(next.wires),
      
      selection: null,
      history: [...state.history, { nodes: state.nodes, wires: state.wires }],
      future: state.future.slice(1),
    };
  }),

  select: (selection, append = false) => set((state) => {
    if (!selection) return { selection: null, multiSelection: [] };
    const currentMulti = state.multiSelection || [];
    if (append) {
      const isSelected = currentMulti.includes(selection.id);
      let nextMulti = [...currentMulti];
      if (isSelected) {
        nextMulti = nextMulti.filter(id => id !== selection.id);
      } else {
        nextMulti.push(selection.id);
      }
      return { 
        selection: nextMulti.length > 0 ? { type: selection.type as any, id: nextMulti[0] } : null,
        multiSelection: nextMulti
      };
    } else {
      return { selection, multiSelection: [selection.id] };
    }
  }),

  deleteSelection: () => set((state) => {
    const currentMulti = state.multiSelection || [];
    const idsToDelete = currentMulti.length > 0 ? currentMulti : (state.selection ? [state.selection.id] : []);
    
    if (idsToDelete.length === 0) return state;

    
      let nextState = { ...state };
      let nextSelectedMemoryNodeId = state.selectedMemoryNodeId;
      
      idsToDelete.forEach(id => {
        if (nextState.wires.some(w => w.id === id)) {
          Object.assign(nextState, circuit.deleteWire(nextState, id));
        } else if (nextState.nodes.some(n => n.id === id)) {
          Object.assign(nextState, circuit.deleteNode(nextState, id));
          if (nextSelectedMemoryNodeId === id) {
            nextSelectedMemoryNodeId = null;
          }
        }
      });
      
      return { ...nextState, ...pushHistory(state), selection: null, multiSelection: [], selectedMemoryNodeId: nextSelectedMemoryNodeId };
  }),

  placingNodeId: null,
  
  startPlacingNode: (type) => set((state) => {
    const nextState = circuit.addNode(state, type, 0, 0);
    const newNode = nextState.nodes[nextState.nodes.length - 1];
    return { ...nextState, placingNodeId: newNode.id };
  }),

  updatePlacingNode: (x, y) => set((state) => {
    if (!state.placingNodeId) return state;
    return circuit.moveNode(state, state.placingNodeId, x, y);
  }),

  finishPlacingNode: () => set((state) => {
    if (!state.placingNodeId) return state;
    const nextState = applyAutoConnect(state, [state.placingNodeId]);
    return { ...nextState, placingNodeId: null, ...pushHistory(nextState) };
  }),

  cancelPlacingNode: () => set((state) => {
    if (!state.placingNodeId) return state;
    return { ...state, ...circuit.deleteNode(state, state.placingNodeId), placingNodeId: null };
  }),

  addNode: (type, x, y) => set((state) => ({ ...circuit.addNode(state, type, x, y), ...pushHistory(state) })),
  updateNodePosition: (id, x, y, finalize) => set((state) => {
    const isMulti = state.multiSelection.includes(id);
    const ids = isMulti ? state.multiSelection : [id];
    let nextState = { ...state, ...circuit.moveNodes(state, ids, id, x, y) };
    
    if (finalize) {
      nextState = applyAutoConnect(nextState, ids);
    }
    
    return nextState;
  }), // History saved on drag start
  updateNodeProperties: (id, props) => set((state) => {
    if (state.placingNodeId === id) {
      return circuit.updateNodeProperties(state, id, props);
    }
    return { ...circuit.updateNodeProperties(state, id, props), ...pushHistory(state) };
  }),
  setNodeInputCount: (id, count) => set((state) => ({ ...circuit.setNodeInputCount(state, id, count), ...pushHistory(state) })),
  setNodeOutputCount: (id, count) => set((state) => ({ ...circuit.setNodeOutputCount(state, id, count), ...pushHistory(state) })),

  // Undoable: the cleared circuit is pushed onto the history stack first.
  clearNodes: () => set((state) => ({
    ...pushHistory(state),
    nodes: [],
    wires: [],
    
    draftWire: null,
    placingNodeId: null,
    selection: null,
    simState: { tickCount: 0, pinStates: {}, wireStates: {}, nodeStates: {} },
    simRunning: false
  })),

  // Sequential IC state (counters, registers) lives in simState.nodeStates,
  // so resetting the simulation state resets every IC as well.
  resetSimulation: () => set({ simState: { tickCount: 0, pinStates: {}, wireStates: {}, nodeStates: {} } }),

  stepSimulation: () => set((state) => ({
    simState: computeNextState(state.nodes, state.wires, state.simState, state.savedCircuits)
  })),

  stepSimulationBatch: (ticks) => set((state) => {
    let nextSimState = state.simState;
    for (let i = 0; i < ticks; i++) {
      nextSimState = computeNextState(state.nodes, state.wires, nextSimState, state.savedCircuits);
    }
    return { simState: nextSimState };
  }),

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
    if (sourceType === 'input' && pinType !== 'input') isSourceOutput = false;
    else if (pinType === 'output' && sourceType !== 'output') isSourceOutput = false;

    const outputPinId = isSourceOutput ? sourcePinId : pinId;
    const outputNodeId = isSourceOutput ? sourceNodeId : nodeId;
    const inputPinId = isSourceOutput ? pinId : sourcePinId;
    const inputNodeId = isSourceOutput ? nodeId : sourceNodeId;

    let nextCircuit = circuit.addWire(
      state, 
      outputNodeId, 
      outputPinId, 
      inputNodeId, 
      inputPinId
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
        jInPin.id
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
        sourcePinId
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
        jInPin.id
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
        jInPin.id
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
      jInPin.id
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


  
    }),
    {
      name: 'logica-project-storage',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Future migration from unversioned (0) to 1
        }
        return persistedState as any;
      },
      partialize: (state) => ({
        nodes: state.nodes,
        wires: state.wires,
        
        settings: state.settings,
        theme: state.theme,
        appMode: state.appMode,
        savedCircuits: state.savedCircuits,
        activeSubcircuitId: state.activeSubcircuitId,
        schematicPos: state.schematicPos,
        schematicScale: state.schematicScale,
        canvasOffset: state.canvasOffset
      })
    }
  )
);

// Provide grid size constant exported from core
export { GRID_SIZE } from '../core/engine/circuit';



useSimulatorStore.subscribe((state, prevState) => {
  // If active subcircuit nodes change, update its registry entry
  if (state.nodes !== prevState.nodes) {
    if (state.activeSubcircuitId !== 'main') {
      const name = state.savedCircuits[state.activeSubcircuitId]?.name || 'Unknown';
      updateSubcircuitRegistry(state.activeSubcircuitId, name, state.nodes);
    }
  }
  
  // If saved circuits map changes (e.g., on load, add, delete), sync registry
  if (state.savedCircuits !== prevState.savedCircuits) {
    Object.entries(state.savedCircuits).forEach(([id, sc]) => {
      if (id !== 'main') {
        updateSubcircuitRegistry(id, sc.name, sc.nodes);
      }
    });
  }
});

// Initialize on load (in case synchronous)
Object.entries(useSimulatorStore.getState().savedCircuits).forEach(([id, sc]) => {
  if (id !== 'main') {
    updateSubcircuitRegistry(id, sc.name, sc.nodes);
  }
});
