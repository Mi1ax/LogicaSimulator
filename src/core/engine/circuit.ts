import { LogicNode, NodeType, Pin, Wire } from '../models/types';
import { getNodeDefinition } from './nodes';
import { generateId } from '../utils/id';

export interface CircuitState {
  nodes: LogicNode[];
  wires: Wire[];
}

export const GRID_SIZE = 20;

export const addNode = (state: CircuitState, type: NodeType, x: number, y: number): CircuitState => {
  const def = getNodeDefinition(type);
  if (!def) {
    console.error(`Unknown node type: ${type}`);
    return state;
  }

  const id = generateId('node');
  
  const properties = def.defaultProperties ? { ...def.defaultProperties } : {};
  if (def.renderAs) properties.renderAs = def.renderAs;
  
  let inputs: Pin[] = [];
  let outputs: Pin[] = [];

  if (def.customPins) {
    def.customPins.forEach((cp) => {
      const pin: Pin = {
        id: `pin-${id}-${cp.type}-${cp.name}`,
        nodeId: id,
        type: cp.type,
        index: inputs.length + outputs.length, // Unique index
        name: cp.name,
        pinNumber: cp.pinNumber,
      };
      if (cp.type === 'input') inputs.push(pin);
      else if (cp.type === 'output') outputs.push(pin);
      else if (cp.type === 'bidir') {
        inputs.push(pin);
        outputs.push(pin);
      }
    });
  } else {
    inputs = Array.from({ length: def.numInputs }).map((_, i) => ({
      id: `pin-${id}-in-${i}`,
      nodeId: id,
      type: 'input',
      index: i,
    }));
    
    outputs = Array.from({ length: def.numOutputs }).map((_, i) => ({
      id: `pin-${id}-out-${i}`,
      nodeId: id,
      type: 'output',
      index: i,
    }));
  }
  
  const snap = type === 'JUNCTION' ? 10 : GRID_SIZE;
  const newNode: LogicNode = {
    id,
    type,
    x: Math.round(x / snap) * snap,
    y: Math.round(y / snap) * snap,
    inputs,
    outputs,
    properties,
  };
  
  return { ...state, nodes: [...state.nodes, newNode] };
};

export const updateNodeProperties = (state: CircuitState, id: string, props: Record<string, any>): CircuitState => {
  return {
    ...state,
    nodes: state.nodes.map(n => n.id === id ? { ...n, properties: { ...n.properties, ...props } } : n)
  };
};

export const moveNode = (state: CircuitState, id: string, x: number, y: number, isBoardCoords: boolean = false): CircuitState => {
  return {
    ...state,
    nodes: state.nodes.map((node) => {
      if (node.id === id) {
        // Junctions need 10px snapping to align with perfectly horizontal/vertical wires smoothly
        const snap = node.type === 'JUNCTION' ? 10 : GRID_SIZE;
        const snappedX = Math.round(x / snap) * snap;
        const snappedY = Math.round(y / snap) * snap;
        return isBoardCoords
          ? { ...node, boardX: snappedX, boardY: snappedY }
          : { ...node, x: snappedX, y: snappedY };
      }
      return node;
    })
  };
};


export const moveNodes = (state: CircuitState, ids: string[], primaryId: string, x: number, y: number, isBoardCoords: boolean = false): CircuitState => {
  const primaryNode = state.nodes.find(n => n.id === primaryId);
  if (!primaryNode) return state;

  const snap = primaryNode.type === 'JUNCTION' ? 10 : GRID_SIZE;
  const snappedX = Math.round(x / snap) * snap;
  const snappedY = Math.round(y / snap) * snap;

  const oldX = isBoardCoords ? (primaryNode.boardX ?? primaryNode.x) : primaryNode.x;
  const oldY = isBoardCoords ? (primaryNode.boardY ?? primaryNode.y) : primaryNode.y;

  const dx = snappedX - oldX;
  const dy = snappedY - oldY;

  if (dx === 0 && dy === 0) return state;

  return {
    ...state,
    nodes: state.nodes.map(node => {
      if (ids.includes(node.id)) {
        const nx = isBoardCoords ? (node.boardX ?? node.x) : node.x;
        const ny = isBoardCoords ? (node.boardY ?? node.y) : node.y;
        return isBoardCoords
          ? { ...node, boardX: nx + dx, boardY: ny + dy }
          : { ...node, x: nx + dx, y: ny + dy };
      }
      return node;
    })
  };
};

export const deleteNode = (state: CircuitState, id: string): CircuitState => {
  const nodes = state.nodes.filter(n => n.id !== id);
  // Also delete all wires connected to this node
  const wires = state.wires.filter(w => w.sourceNodeId !== id && w.targetNodeId !== id);
  return { nodes, wires };
};

export const addWire = (
  state: CircuitState, 
  sourceNodeId: string, 
  sourcePinId: string, 
  targetNodeId: string, 
  targetPinId: string,
  wireType?: 'solder' | 'jumper'
): CircuitState => {
  const newWire: Wire = {
    id: generateId('wire'),
    sourceNodeId,
    sourcePinId,
    targetNodeId,
    targetPinId,
    wireType
  };

  return { ...state, wires: [...state.wires, newWire] };
};

export const deleteWire = (state: CircuitState, id: string): CircuitState => {
  return { ...state, wires: state.wires.filter(w => w.id !== id) };
};





export const setNodeInputCount = (state: CircuitState, nodeId: string, count: number): CircuitState => {
  let wiresToDelete = new Set<string>();

  const nodes = state.nodes.map(node => {
    if (node.id !== nodeId) return node;
    
    const currentCount = node.inputs.length;
    let newInputs = [...node.inputs];
    
    if (count > currentCount) {
      for (let i = currentCount; i < count; i++) {
        newInputs.push({
          id: `pin-${node.id}-in-${i}`,
          nodeId: node.id,
          type: 'input',
          index: i
        });
      }
    } else if (count < currentCount) {
      const removedPins = newInputs.splice(count, currentCount - count);
      const removedPinIds = new Set(removedPins.map(p => p.id));
      
      state.wires.forEach(w => {
        if (removedPinIds.has(w.targetPinId)) {
          wiresToDelete.add(w.id);
        }
      });
    }
    
    return { ...node, inputs: newInputs };
  });

  const wires = state.wires.filter(w => !wiresToDelete.has(w.id));

  return { ...state, nodes, wires };
};

export const setNodeOutputCount = (state: CircuitState, nodeId: string, count: number): CircuitState => {
  let wiresToDelete = new Set<string>();

  const nodes = state.nodes.map(node => {
    if (node.id !== nodeId) return node;
    
    const currentCount = node.outputs.length;
    let newOutputs = [...node.outputs];
    
    if (count > currentCount) {
      for (let i = currentCount; i < count; i++) {
        newOutputs.push({
          id: `pin-${node.id}-out-${i}`,
          nodeId: node.id,
          type: 'output',
          index: i
        });
      }
    } else if (count < currentCount) {
      const removedPins = newOutputs.splice(count, currentCount - count);
      const removedPinIds = new Set(removedPins.map(p => p.id));
      
      state.wires.forEach(w => {
        if (removedPinIds.has(w.sourcePinId)) {
          wiresToDelete.add(w.id);
        }
      });
    }
    
    return { ...node, outputs: newOutputs, properties: { ...node.properties, numOutputs: count } };
  });

  const wires = state.wires.filter(w => !wiresToDelete.has(w.id));

  return { ...state, nodes, wires };
};
