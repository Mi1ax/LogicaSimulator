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

  const pinsToGenerate = def.generatePins ? def.generatePins(properties) : def.customPins;

  if (pinsToGenerate) {
    pinsToGenerate.forEach((cp) => {
      const pin: Pin = {
        id: `pin-${id}-${cp.type}-${cp.name}`,
        nodeId: id,
        type: cp.type,
        index: inputs.length + outputs.length, // Unique index
        name: cp.name,
        pinNumber: cp.pinNumber,
        internalNodeId: cp.internalNodeId,
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
    nodes: state.nodes.map(n => {
      if (n.id !== id) return n;
      const newProps = { ...n.properties, ...props };
      const def = getNodeDefinition(n.type);
      
      let newInputs = n.inputs;
      let newOutputs = n.outputs;

      if (def?.generatePins) {
        const pinsToGenerate = def.generatePins(newProps);
        const inputs: Pin[] = [];
        const outputs: Pin[] = [];
        pinsToGenerate.forEach((cp) => {
          // preserve ID if pin with same name/type already existed, otherwise create new
          const existing = n.inputs.find(p => p.name === cp.name && p.type === cp.type) || 
                           n.outputs.find(p => p.name === cp.name && p.type === cp.type);
          
          const pin: Pin = {
            id: existing ? existing.id : `pin-${id}-${cp.type}-${cp.name}`,
            nodeId: id,
            type: cp.type,
            index: inputs.length + outputs.length,
            name: cp.name,
            pinNumber: cp.pinNumber,
        internalNodeId: cp.internalNodeId,
          };
          
          if (cp.type === 'input') inputs.push(pin);
          else if (cp.type === 'output') outputs.push(pin);
          else if (cp.type === 'bidir') {
            inputs.push(pin);
            outputs.push(pin);
          }
        });
        newInputs = inputs;
        newOutputs = outputs;
      }
      
      return { ...n, properties: newProps, inputs: newInputs, outputs: newOutputs };
    })
  };
};

export const moveNode = (state: CircuitState, id: string, x: number, y: number): CircuitState => {
  return {
    ...state,
    nodes: state.nodes.map((node) => {
      if (node.id === id) {
        const snap = node.type === 'JUNCTION' ? 10 : GRID_SIZE;
        const snappedX = Math.round(x / snap) * snap;
        const snappedY = Math.round(y / snap) * snap;
        return { ...node, x: snappedX, y: snappedY };
      }
      return node;
    })
  };
};


export const moveNodes = (state: CircuitState, ids: string[], primaryId: string, x: number, y: number): CircuitState => {
  const primaryNode = state.nodes.find(n => n.id === primaryId);
  if (!primaryNode) return state;

  const snap = primaryNode.type === 'JUNCTION' ? 10 : GRID_SIZE;
  const snappedX = Math.round(x / snap) * snap;
  const snappedY = Math.round(y / snap) * snap;

  const oldX = primaryNode.x;
  const oldY = primaryNode.y;

  const dx = snappedX - oldX;
  const dy = snappedY - oldY;

  if (dx === 0 && dy === 0) return state;

  return {
    ...state,
    nodes: state.nodes.map(node => {
      if (ids.includes(node.id)) {
        return { ...node, x: node.x + dx, y: node.y + dy };
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
  targetPinId: string
): CircuitState => {
  const newWire: Wire = {
    id: generateId('wire'),
    sourceNodeId,
    sourcePinId,
    targetNodeId,
    targetPinId
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

export const syncSubcircuitInstances = (nodes: LogicNode[], wires: Wire[]): { nodes: LogicNode[], wires: Wire[] } => {
  let changed = false;
  const newNodes = nodes.map(node => {
    if (node.type.startsWith('SUBCIRCUIT:')) {
      const def = getNodeDefinition(node.type);
      if (def && def.customPins) {
        let nodeChanged = false;
        
        const newInputs: Pin[] = [];
        const newOutputs: Pin[] = [];

        def.customPins.forEach((cp, i) => {
          let existing = node.inputs.find(p => p.internalNodeId === cp.internalNodeId || p.name === cp.name)
                      || node.outputs.find(p => p.internalNodeId === cp.internalNodeId || p.name === cp.name);
          
          let pin: Pin;
          if (existing) {
            if (existing.name !== cp.name || existing.pinNumber !== cp.pinNumber) {
              nodeChanged = true;
              pin = { ...existing, name: cp.name, pinNumber: cp.pinNumber, type: cp.type as any };
            } else {
              pin = { ...existing }; // Create shallow copy so we can tweak index if needed
            }
          } else {
            nodeChanged = true;
            pin = {
              id: `pin-${node.id}-${cp.type}-${cp.name}-${Date.now()}-${i}`,
              nodeId: node.id,
              type: cp.type as any,
              index: 0,
              name: cp.name,
              pinNumber: cp.pinNumber,
              internalNodeId: cp.internalNodeId
            };
          }

          if (cp.type === 'input') newInputs.push(pin);
          else if (cp.type === 'output') newOutputs.push(pin);
          else if (cp.type === 'bidir') {
            newInputs.push(pin);
            newOutputs.push(pin);
          }
        });

        newInputs.forEach((p, idx) => {
          if (p.index !== idx) {
            p.index = idx;
            nodeChanged = true;
          }
        });
        
        newOutputs.forEach((p, idx) => {
          const expectedIdx = newInputs.length + idx;
          if (p.index !== expectedIdx && p.type !== 'bidir') { // bidir gets its index from newInputs
            p.index = expectedIdx;
            nodeChanged = true;
          }
        });

        if (nodeChanged || node.inputs.length !== newInputs.length || node.outputs.length !== newOutputs.length) {
          changed = true;
          return { ...node, inputs: newInputs, outputs: newOutputs };
        }
      }
    }
    return node;

  });

  // Remove any wires that connect to pins that no longer exist
  let newWires = wires;
  if (changed) {
    const validPinIds = new Set(newNodes.flatMap(n => [...n.inputs, ...n.outputs].map(p => p.id)));
    newWires = wires.filter(w => validPinIds.has(w.sourcePinId) && validPinIds.has(w.targetPinId));
  }

  return { nodes: newNodes, wires: newWires };
};
