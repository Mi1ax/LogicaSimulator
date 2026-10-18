import { updateSubcircuitRegistry, removeSubcircuitFromRegistry } from '../core/engine/subcircuitRegistry';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LogicNode, NodeType, Wire, DraftWire } from '../core/models/types';
import * as circuit from '../core/engine/circuit';
import { syncSubcircuitInstances } from '../core/engine/circuit';
import { computeNextState, computeNextStateBatch } from '../core/engine/simulation';
import { getSchematicPinPosition } from '../core/utils/schematicLayout';
import { computeManhattanElbow } from '../core/engine/routing';
import { generateId } from '../core/utils/id';

export type Selection = { type: 'node' | 'wire' | 'waypoint', id: string } | null;

export interface PointerSettings {
  mouseWheelBehavior: 'zoom' | 'pan'; // 'zoom' = CAD style, 'pan' = Figma style
  panSpeed: number;
  zoomSensitivity: number;
  invertZoom: boolean;
}

interface SimulatorState {
  appMode: 'schematic' | 'hex' | 'code' | 'ne555';
  setAppMode: (mode: 'schematic' | 'hex' | 'code' | 'ne555') => void;

  savedCircuits: Record<string, { name: string, nodes: LogicNode[], wires: Wire[], history: any[], future: any[] }>;
  activeSubcircuitId: string;
  addSubcircuit: (name: string) => void;
  setActiveSubcircuit: (id: string) => void;
  deleteSubcircuit: (id: string) => void;

  theme: 'light' | 'dark';
  toggleTheme: () => void;

  isToolboxOpen: boolean;
  toggleToolbox: () => void;

  // Settings
  settings: PointerSettings;
  updateSettings: (newSettings: Partial<PointerSettings>) => void;

  // Global Interaction Mode (Cursor vs Wire drawing)

  // UI state for drawing wires
  draftWire: DraftWire | null;
  startWireFromWaypoint: (wireId: string, waypointIndex: number) => void;
  startWire: (nodeId: string, pinId: string, pinType: 'input' | 'output' | 'bidir', x: number, y: number, manhattan?: boolean) => void;
  updateDraftWire: (x: number, y: number, manhattan?: boolean) => void;
  setDraftWireManhattan: (manhattan: boolean) => void;
  addWaypoint: (x: number, y: number, manhattan?: boolean) => void;
  updateWireWaypoints: (wireId: string, waypoints: {x: number, y: number}[]) => void;
  completeWire: (nodeId: string, pinId: string, pinType: 'input' | 'output' | 'bidir', manhattan?: boolean) => void;
  completeWireOnWire: (wireId: string, dropX?: number, dropY?: number, wp1?: {x:number, y:number}[], wp2?: {x:number, y:number}[], manhattan?: boolean) => void;
  cancelWire: () => void;

  clipboard: { nodes: any[], wires: any[] } | null;
  copySelection: () => void;
  pasteClipboard: (x: number, y: number) => void;

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
  lastPlacedNodeType: NodeType | null;
  pastingNodeIds: string[] | null;
  pastingBasePoint: { x: number, y: number } | null;
  updatePastingNodes: (x: number, y: number) => void;
  finishPastingNodes: () => void;
  cancelPastingNodes: () => void;
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
  updateNodePosition: (id: string, x: number, y: number, finalize?: boolean, extraIds?: string[]) => void;
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

const cloneNodesForHistory = (nodes: LogicNode[]): LogicNode[] =>
  nodes.map((n) => ({
    ...n,
    inputs: n.inputs.map((p) => ({ ...p })),
    outputs: n.outputs.map((p) => ({ ...p })),
    properties: n.properties
      ? {
          ...n.properties,
          // Share large read-only ROM/EEPROM data arrays across undo snapshots (HexEditor replaces `data` immutably)
          ...(Array.isArray(n.properties.bits) ? { bits: n.properties.bits.slice() } : {}),
        }
      : n.properties,
  }));

const cloneWiresForHistory = (wires: Wire[]): Wire[] =>
  wires.map((w) => ({
    ...w,
    ...(w.waypoints ? { waypoints: w.waypoints.map((wp) => ({ ...wp })) } : {}),
  }));

const pushHistory = (state: SimulatorState) => ({
  history: [
    ...state.history,
    {
      nodes: cloneNodesForHistory(state.nodes),
      wires: cloneWiresForHistory(state.wires),
    },
  ].slice(-50),
  future: [],
});

const applyAutoConnect = (state: SimulatorState, movedNodeIds: string[]) => {
  const movedSet = new Set(movedNodeIds);
  const movedNodes = state.nodes.filter((n) => movedSet.has(n.id));
  const otherNodes = state.nodes.filter((n) => !movedSet.has(n.id));
  if (movedNodes.length === 0 || otherNodes.length === 0) return state;

  type PinEntry = { nodeId: string; pinId: string; type: 'input' | 'output' | 'bidir'; pos: { x: number; y: number } };

  const movedPins: PinEntry[] = movedNodes.flatMap((n) =>
    [...n.inputs, ...n.outputs].map((p) => ({
      nodeId: n.id,
      pinId: p.id,
      type: p.type,
      pos: getSchematicPinPosition(n, p.id),
    }))
  );

  // Build 10px spatial grid over static pins so lookup is O(1) per moved pin instead of O(P_moved * P_other)
  const CELL = 10;
  const spatialGrid = new Map<string, PinEntry[]>();

  for (let i = 0; i < otherNodes.length; i++) {
    const n = otherNodes[i];
    const allPins = [...n.inputs, ...n.outputs];
    for (let p = 0; p < allPins.length; p++) {
      const pin = allPins[p];
      const pos = getSchematicPinPosition(n, pin.id);
      const cx = Math.floor(pos.x / CELL);
      const cy = Math.floor(pos.y / CELL);
      const key = `${cx},${cy}`;
      let bucket = spatialGrid.get(key);
      if (!bucket) {
        bucket = [];
        spatialGrid.set(key, bucket);
      }
      bucket.push({ nodeId: n.id, pinId: pin.id, type: pin.type, pos });
    }
  }

  const connectedPairs = new Set<string>();
  for (let i = 0; i < state.wires.length; i++) {
    const w = state.wires[i];
    connectedPairs.add(`${w.sourcePinId}|${w.targetPinId}`);
    connectedPairs.add(`${w.targetPinId}|${w.sourcePinId}`);
  }

  const newWires = [...state.wires];
  let changed = false;

  for (let i = 0; i < movedPins.length; i++) {
    const mp = movedPins[i];
    const baseCx = Math.floor(mp.pos.x / CELL);
    const baseCy = Math.floor(mp.pos.y / CELL);

    for (let gx = baseCx - 1; gx <= baseCx + 1; gx++) {
      for (let gy = baseCy - 1; gy <= baseCy + 1; gy++) {
        const bucket = spatialGrid.get(`${gx},${gy}`);
        if (!bucket) continue;
        for (let b = 0; b < bucket.length; b++) {
          const op = bucket[b];
          const dx = mp.pos.x - op.pos.x;
          const dy = mp.pos.y - op.pos.y;
          if (dx * dx + dy * dy < 25) {
            const pairKey = `${mp.pinId}|${op.pinId}`;
            if (!connectedPairs.has(pairKey)) {
              let source: PinEntry = mp;
              let target: PinEntry = op;
              if (op.type === 'output' && mp.type !== 'output') {
                source = op;
                target = mp;
              }
              newWires.push({
                id: generateId('wire'),
                sourceNodeId: source.nodeId,
                sourcePinId: source.pinId,
                targetNodeId: target.nodeId,
                targetPinId: target.pinId,
              });
              connectedPairs.add(pairKey);
              connectedPairs.add(`${op.pinId}|${mp.pinId}`);
              changed = true;
            }
          }
        }
      }
    }
  }

  return changed ? { ...state, wires: newWires } : state;
};

export const useSimulatorStore = create<SimulatorState>()(
  persist(
    (set, get) => ({
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

  isToolboxOpen: true,
  toggleToolbox: () => set((state) => ({ isToolboxOpen: !state.isToolboxOpen })),

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
      ...state,
      ...previous,
      history: state.history.slice(0, -1),
      future: [
        {
          nodes: state.nodes,
          wires: state.wires
        },
        ...state.future
      ],
      placingNodeId: null,
      pastingNodeIds: null,
      pastingBasePoint: null,
      draftWire: null,
      selection: null,
      multiSelection: []
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      ...state,
      ...next,
      history: [...state.history, { nodes: state.nodes, wires: state.wires }],
      future: state.future.slice(1),
      placingNodeId: null,
      pastingNodeIds: null,
      pastingBasePoint: null,
      draftWire: null,
      selection: null,
      multiSelection: []
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

    const idSet = new Set(idsToDelete);
    const waypointsToRemove: Record<string, number[]> = {};
    for (let i = 0; i < idsToDelete.length; i++) {
      const id = idsToDelete[i];
      if (id.startsWith('wp:')) {
        const [, wireId, idxStr] = id.split(':');
        if (!waypointsToRemove[wireId]) waypointsToRemove[wireId] = [];
        waypointsToRemove[wireId].push(parseInt(idxStr, 10));
      }
    }

    const deletedNodeIds = new Set<string>();
    const nextNodes = state.nodes.filter((n) => {
      if (idSet.has(n.id)) {
        deletedNodeIds.add(n.id);
        return false;
      }
      return true;
    });

    let nextWires = state.wires.filter(
      (w) =>
        !idSet.has(w.id) &&
        !deletedNodeIds.has(w.sourceNodeId) &&
        (!w.targetNodeId || !deletedNodeIds.has(w.targetNodeId))
    );

    const wpWireIds = Object.keys(waypointsToRemove);
    if (wpWireIds.length > 0) {
      nextWires = nextWires.map((w) => {
        const indices = waypointsToRemove[w.id];
        if (indices && w.waypoints) {
          const newWaypoints = [...w.waypoints];
          indices
            .slice()
            .sort((a, b) => b - a)
            .forEach((idx) => newWaypoints.splice(idx, 1));
          return { ...w, waypoints: newWaypoints };
        }
        return w;
      });
    }

    const nextSelectedMemoryNodeId =
      state.selectedMemoryNodeId && deletedNodeIds.has(state.selectedMemoryNodeId)
        ? null
        : state.selectedMemoryNodeId;

    return {
      ...state,
      nodes: nextNodes,
      wires: nextWires,
      ...pushHistory(state),
      selection: null,
      multiSelection: [],
      selectedMemoryNodeId: nextSelectedMemoryNodeId,
    };
  }),

  placingNodeId: null,
  lastPlacedNodeType: null,
  pastingNodeIds: null,
  pastingBasePoint: null,
  clipboard: null,
  
  startPlacingNode: (type) => set((state) => {
    let baseState: SimulatorState = state;
    let historyToUse = pushHistory(state);
    if (state.placingNodeId) {
      baseState = { ...state, ...circuit.deleteNode(state, state.placingNodeId), placingNodeId: null };
      historyToUse = { history: state.history, future: [] };
    }
    const nextState = circuit.addNode(baseState, type, 0, 0);
    const newNode = nextState.nodes[nextState.nodes.length - 1];
    return { ...nextState, placingNodeId: newNode.id, lastPlacedNodeType: type, ...historyToUse };
  }),

  updatePlacingNode: (x, y) => set((state) => {
    if (!state.placingNodeId) return state;
    return circuit.moveNode(state, state.placingNodeId, x, y);
  }),

  finishPlacingNode: () => set((state) => {
    if (!state.placingNodeId) return state;
    const nextState = applyAutoConnect(state, [state.placingNodeId]);
    return { ...nextState, placingNodeId: null };
  }),

  cancelPlacingNode: () => set((state) => {
    if (!state.placingNodeId) return state;
    return { ...state, ...circuit.deleteNode(state, state.placingNodeId), placingNodeId: null, history: state.history.slice(0, -1) };
  }),

  copySelection: () => set((state) => {
    const ids = state.multiSelection && state.multiSelection.length > 0 
      ? state.multiSelection 
      : (state.selection ? [state.selection.id] : []);
    if (ids.length === 0) return state;

    const idSet = new Set(ids);
    const nodesToCopy = state.nodes.filter(n => idSet.has(n.id));
    if (nodesToCopy.length === 0) return state;

    const wiresToCopy = state.wires.filter(w => 
      idSet.has(w.sourceNodeId) && (w.targetNodeId && idSet.has(w.targetNodeId))
    );

    return {
      clipboard: {
        nodes: cloneNodesForHistory(nodesToCopy),
        wires: cloneWiresForHistory(wiresToCopy)
      }
    };
  }),

  pasteClipboard: (x: number, y: number) => set((state) => {
    if (!state.clipboard || state.clipboard.nodes.length === 0) return state;

    const idMap: Record<string, string> = {};
    const newNodes: any[] = [];
    const newWires: any[] = [];

    let minX = Infinity, minY = Infinity;
    state.clipboard.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
    });

    state.clipboard.nodes.forEach(n => {
      const newId = generateId('node');
      idMap[n.id] = newId;

      const newInputs = n.inputs ? n.inputs.map((p: any) => ({ ...p, id: p.id.replace(n.id, newId), nodeId: newId })) : [];
      const newOutputs = n.outputs ? n.outputs.map((p: any) => ({ ...p, id: p.id.replace(n.id, newId), nodeId: newId })) : [];

      newNodes.push({
        ...n,
        id: newId,
        x: x + (n.x - minX),
        y: y + (n.y - minY),
        inputs: newInputs,
        outputs: newOutputs,
      });
    });

    state.clipboard.wires.forEach(w => {
      const sourceId = idMap[w.sourceNodeId];
      const targetId = w.targetNodeId ? idMap[w.targetNodeId] : null;

      if (sourceId && targetId) {
        newWires.push({
          ...w,
          id: generateId('wire'),
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          sourcePinId: w.sourcePinId.replace(w.sourceNodeId, sourceId),
          targetPinId: w.targetPinId ? w.targetPinId.replace(w.targetNodeId, targetId) : undefined,
          waypoints: w.waypoints?.map((wp: any) => ({ x: x + (wp.x - minX), y: y + (wp.y - minY) })) || []
        });
      }
    });

    return {
      ...pushHistory(state),
      nodes: [...state.nodes, ...newNodes],
      wires: [...state.wires, ...newWires],
      pastingNodeIds: newNodes.map(n => n.id),
      pastingBasePoint: { x, y },
      selection: null,
      multiSelection: []
    };
  }),

  updatePastingNodes: (x: number, y: number) => set((state) => {
    if (!state.pastingNodeIds || !state.pastingBasePoint) return state;
    const dx = x - state.pastingBasePoint.x;
    const dy = y - state.pastingBasePoint.y;
    if (dx === 0 && dy === 0) return state;

    const nextState = { ...state };
    const pastingSet = new Set(state.pastingNodeIds);
    nextState.nodes = nextState.nodes.map(n => {
      if (pastingSet.has(n.id)) {
        return { ...n, x: n.x + dx, y: n.y + dy };
      }
      return n;
    });
    nextState.wires = nextState.wires.map(w => {
      if (pastingSet.has(w.sourceNodeId) && w.targetNodeId && pastingSet.has(w.targetNodeId)) {
        return {
          ...w,
          waypoints: w.waypoints?.map(wp => ({ x: wp.x + dx, y: wp.y + dy })) || []
        };
      }
      return w;
    });

    nextState.pastingBasePoint = { x, y };
    return nextState;
  }),

  finishPastingNodes: () => set((state) => {
    if (!state.pastingNodeIds) return state;
    return { 
      ...state, 
      pastingNodeIds: null, 
      pastingBasePoint: null, 
      multiSelection: state.pastingNodeIds, 
      selection: null
    };
  }),

  cancelPastingNodes: () => set((state) => {
    if (!state.pastingNodeIds) return state;
    const pastingSet = new Set(state.pastingNodeIds);
    return {
      ...state,
      nodes: state.nodes.filter(n => !pastingSet.has(n.id)),
      wires: state.wires.filter(w => !(pastingSet.has(w.sourceNodeId) && w.targetNodeId && pastingSet.has(w.targetNodeId))),
      pastingNodeIds: null,
      pastingBasePoint: null,
      history: state.history.slice(0, -1)
    };
  }),

  addNode: (type, x, y) => set((state) => ({ ...circuit.addNode(state, type, x, y), ...pushHistory(state) })),
  updateNodePosition: (id, x, y, finalize, extraIds) => set((state) => {
    const isMulti = state.multiSelection.includes(id);
    const baseIds = isMulti ? state.multiSelection : [id];
    const ids = extraIds && extraIds.length > 0
      ? Array.from(new Set([...baseIds, ...extraIds]))
      : baseIds;
    let nextState = { ...state, ...circuit.moveSelection(state, ids, id, x, y) };
    
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
  resetSimulation: () => {
    set({ simState: { tickCount: 0, pinStates: {}, wireStates: {}, nodeStates: {} } });
    notifyTickListeners(0);
  },

  stepSimulation: () => set((state) => {
    const nextSimState = computeNextState(state.nodes, state.wires, state.simState, state.savedCircuits);
    notifyTickListeners(nextSimState.tickCount);
    return { simState: nextSimState };
  }),

  stepSimulationBatch: (ticks) => {
    const state = get();
    const prevSim = state.simState;
    const { state: nextSimState } = computeNextStateBatch(
      state.nodes,
      state.wires,
      prevSim,
      state.savedCircuits,
      ticks
    );

    const firstTickTransition = prevSim.tickCount === 0 && nextSimState.tickCount > 0;
    const pinsChanged = nextSimState.pinStates !== prevSim.pinStates;

    let memoryChanged = false;
    if (!pinsChanged && nextSimState.nodeStates && prevSim.nodeStates) {
      for (const nodeId in nextSimState.nodeStates) {
        if (nextSimState.nodeStates[nodeId]?.memory !== prevSim.nodeStates[nodeId]?.memory) {
          memoryChanged = true;
          break;
        }
      }
    }

    if (!firstTickTransition && !pinsChanged && !memoryChanged) {
      // Fast path: no logic signals or SRAM bytes changed during these ticks.
      // Mutate tickCount and internal sequential counters in-place without waking 1,000+ Zustand UI subscribers.
      prevSim.tickCount = nextSimState.tickCount;
      prevSim.nodeStates = nextSimState.nodeStates;
      prevSim.connectedPins = nextSimState.connectedPins;
      notifyTickListeners(nextSimState.tickCount);
      return;
    }

    set({ simState: nextSimState });
    notifyTickListeners(nextSimState.tickCount);
  },

  setSimRunning: (running) => set({ simRunning: running }),
  setSimSpeed: (hz) => set({ simSpeed: hz }),

  toggleInputNode: (id) => set((state) => {
    const node = state.nodes.find(n => n.id === id);
    if (!node) return state;
    if (node.type === 'INPUT') {
      const currentVal = node.properties?.value === 1 ? 0 : 1;
      return circuit.updateNodeProperties(state, id, { value: currentVal });
    }
    if (node.type === 'CLOCK') {
      if (!state.simRunning || node.properties?.mode !== 'manual') return state;
      const currentVal = node.properties?.manualValue === 1 ? 0 : 1;
      return circuit.updateNodeProperties(state, id, { manualValue: currentVal });
    }
    return state;
  }),

  startWire: (nodeId, pinId, pinType, x, y, manhattan = false) => set({
    draftWire: { sourceNodeId: nodeId, sourcePinId: pinId, sourceType: pinType, endX: x, endY: y, waypoints: [], manhattan },
    selection: null
  }),

  updateDraftWire: (x, y, manhattan) => set((state) => {
    if (!state.draftWire) return state;
    return {
      draftWire: {
        ...state.draftWire,
        endX: x,
        endY: y,
        manhattan: manhattan ?? state.draftWire.manhattan,
      }
    };
  }),

  setDraftWireManhattan: (manhattan) => set((state) => {
    if (!state.draftWire || state.draftWire.manhattan === manhattan) return state;
    return { draftWire: { ...state.draftWire, manhattan } };
  }),

  addWaypoint: (x, y, manhattan) => set((state) => {
    if (!state.draftWire) return state;
    const isManhattan = manhattan ?? state.draftWire.manhattan;
    const currentWaypoints = [...(state.draftWire.waypoints || [])];

    if (isManhattan) {
      let lastPt: { x: number; y: number; nx?: number; ny?: number } | undefined =
        currentWaypoints[currentWaypoints.length - 1];
      if (!lastPt) {
        const srcNode = state.nodes.find(n => n.id === state.draftWire!.sourceNodeId);
        if (srcNode) {
          lastPt = getSchematicPinPosition(srcNode, state.draftWire.sourcePinId);
        }
      }
      if (lastPt) {
        const elbow = computeManhattanElbow(lastPt, { x, y });
        if (elbow) {
          currentWaypoints.push(elbow);
        }
      }
    }

    currentWaypoints.push({ x, y });
    return { draftWire: { ...state.draftWire, waypoints: currentWaypoints } };
  }),

  updateWireWaypoints: (wireId, waypoints) => set((state) => {
    return {
      ...state,
      wires: state.wires.map(w => w.id === wireId ? { ...w, waypoints } : w)
    };
  }),

  
  completeWire: (nodeId, pinId, pinType, manhattan) => set((state) => {
    if (!state.draftWire) return state;

    const { sourceNodeId, sourcePinId, sourceType } = state.draftWire;

    if (sourcePinId === pinId) {
      return { draftWire: null };
    }

    // Prevent duplicate wires between the same two pins
    const alreadyConnected = state.wires.some(
      w =>
        (w.sourcePinId === sourcePinId && w.targetPinId === pinId) ||
        (w.sourcePinId === pinId && w.targetPinId === sourcePinId)
    );
    if (alreadyConnected) {
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

    const waypoints = [...(state.draftWire.waypoints || [])];
    const isManhattan = manhattan ?? state.draftWire.manhattan;
    if (isManhattan) {
      let lastPt: { x: number; y: number; nx?: number; ny?: number } | undefined =
        waypoints[waypoints.length - 1];
      if (!lastPt) {
        const srcNode = state.nodes.find(n => n.id === sourceNodeId);
        if (srcNode) {
          lastPt = getSchematicPinPosition(srcNode, sourcePinId);
        }
      }
      const tgtNode = state.nodes.find(n => n.id === nodeId);
      if (lastPt && tgtNode) {
        const tgtPos = getSchematicPinPosition(tgtNode, pinId);
        const elbow = computeManhattanElbow(lastPt, tgtPos);
        if (elbow) {
          waypoints.push(elbow);
        }
      }
    }

    const finalWaypoints = isSourceOutput ? waypoints : [...waypoints].reverse();
    if (finalWaypoints.length > 0) {
      const newWire = nextCircuit.wires[nextCircuit.wires.length - 1];
      newWire.waypoints = finalWaypoints;
    }

    return { ...nextCircuit, ...pushHistory(state), draftWire: null };
  }),

  completeWireOnWire: (targetWireId: string, dropX?: number, dropY?: number, splitWp1?: {x:number, y:number}[], splitWp2?: {x:number, y:number}[], manhattan?: boolean) => set((state) => {
    if (!state.draftWire) return state;

    const targetWire = state.wires.find(w => w.id === targetWireId);
    if (!targetWire) return { draftWire: null };

    const { sourceNodeId, sourcePinId, sourceType, endX, endY } = state.draftWire;
    const finalX = Math.round((dropX ?? endX) / 20) * 20;
    const finalY = Math.round((dropY ?? endY) / 20) * 20;

    const waypoints = [...(state.draftWire.waypoints || [])];
    const isManhattan = manhattan ?? state.draftWire.manhattan;
    if (isManhattan) {
      let lastPt: { x: number; y: number; nx?: number; ny?: number } | undefined =
        waypoints[waypoints.length - 1];
      if (!lastPt) {
        const srcNode = state.nodes.find(n => n.id === sourceNodeId);
        if (srcNode) {
          lastPt = getSchematicPinPosition(srcNode, sourcePinId);
        }
      }
      if (lastPt) {
        const elbow = computeManhattanElbow(lastPt, { x: finalX, y: finalY });
        if (elbow) {
          waypoints.push(elbow);
        }
      }
    }

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

      if (waypoints.length > 0) {
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

      if (waypoints.length > 0) {
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
      storage: (() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let pendingKey: string | null = null;
        let pendingValue: any = null;
        let lastStateSnapshot: Record<string, any> | null = null;

        const isSameSnapshot = (a: Record<string, any> | null, b: Record<string, any> | null) => {
          if (!a || !b) return false;
          const keys = Object.keys(b);
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (a[k] !== b[k]) return false;
          }
          return true;
        };

        const flush = () => {
          if (pendingKey !== null && pendingValue !== null) {
            try {
              localStorage.setItem(pendingKey, JSON.stringify(pendingValue));
            } catch {
              // Ignore quota or storage errors
            }
            pendingKey = null;
            pendingValue = null;
          }
        };

        if (typeof window !== 'undefined') {
          window.addEventListener('beforeunload', flush);
        }

        return {
          getItem: (name: string) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            try {
              const parsed = JSON.parse(str);
              if (parsed?.state) lastStateSnapshot = { ...parsed.state };
              return parsed;
            } catch {
              return null;
            }
          },
          setItem: (name: string, value: any) => {
            if (value?.state && isSameSnapshot(lastStateSnapshot, value.state)) {
              return;
            }
            if (value?.state) {
              lastStateSnapshot = { ...value.state };
            }
            pendingKey = name;
            pendingValue = value;
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(flush, 500);
          },
          removeItem: (name: string) => {
            if (timeoutId) clearTimeout(timeoutId);
            pendingKey = null;
            pendingValue = null;
            lastStateSnapshot = null;
            localStorage.removeItem(name);
          },
        };
      })(),
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Future migration from unversioned (0) to 1
        }
        return persistedState as any;
      },
      partialize: (() => {
        let cachedPartial: Record<string, any> | null = null;
        return (state: SimulatorState) => {
          if (
            cachedPartial &&
            cachedPartial.nodes === state.nodes &&
            cachedPartial.wires === state.wires &&
            cachedPartial.simSpeed === state.simSpeed &&
            cachedPartial.settings === state.settings &&
            cachedPartial.theme === state.theme &&
            cachedPartial.appMode === state.appMode &&
            cachedPartial.savedCircuits === state.savedCircuits &&
            cachedPartial.activeSubcircuitId === state.activeSubcircuitId &&
            cachedPartial.schematicPos === state.schematicPos &&
            cachedPartial.schematicScale === state.schematicScale &&
            cachedPartial.canvasOffset === state.canvasOffset
          ) {
            return cachedPartial;
          }
          cachedPartial = {
            nodes: state.nodes,
            wires: state.wires,
            simSpeed: state.simSpeed,
            settings: state.settings,
            theme: state.theme,
            appMode: state.appMode,
            savedCircuits: state.savedCircuits,
            activeSubcircuitId: state.activeSubcircuitId,
            schematicPos: state.schematicPos,
            schematicScale: state.schematicScale,
            canvasOffset: state.canvasOffset,
          };
          return cachedPartial;
        };
      })()
    }
  )
);

const tickListeners = new Set<(tickCount: number) => void>();

function notifyTickListeners(tickCount: number) {
  if (tickListeners.size === 0) return;
  for (const listener of tickListeners) {
    listener(tickCount);
  }
}

export function subscribeTickCount(listener: (tickCount: number) => void): () => void {
  tickListeners.add(listener);
  return () => {
    tickListeners.delete(listener);
  };
}

// Provide grid size constant exported from core
export { GRID_SIZE } from '../core/engine/circuit';



useSimulatorStore.subscribe((state, prevState) => {
  if (state.simState.tickCount !== prevState.simState.tickCount) {
    notifyTickListeners(state.simState.tickCount);
  }

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
