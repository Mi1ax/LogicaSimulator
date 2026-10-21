import { LogicNode, NodeType, Pin, Wire } from '../models/types';
import { getNodeDefinition } from './nodes';
import { PinDefinition } from './nodes/NodeDefinition';
import { generateId } from '../utils/id';

export interface CircuitState {
  nodes: LogicNode[];
  wires: Wire[];
}

export const GRID_SIZE = 20;

const appendPinByType = (pin: Pin, inputs: Pin[], outputs: Pin[]): void => {
  if (pin.type === 'input') {
    inputs.push(pin);
  } else if (pin.type === 'output') {
    outputs.push(pin);
  } else if (pin.type === 'bidir') {
    inputs.push(pin);
    outputs.push(pin);
  }
};

const buildPinsFromDefinitions = (
  nodeId: string,
  pinDefs: PinDefinition[],
  existingPins?: { inputs: Pin[]; outputs: Pin[] }
): { inputs: Pin[]; outputs: Pin[] } => {
  const inputs: Pin[] = [];
  const outputs: Pin[] = [];

  for (let i = 0; i < pinDefs.length; i++) {
    const cp = pinDefs[i];
    const existing = existingPins
      ? existingPins.inputs.find((p) => p.name === cp.name && p.type === cp.type) ||
        existingPins.outputs.find((p) => p.name === cp.name && p.type === cp.type)
      : undefined;

    const pin: Pin = {
      id: existing ? existing.id : `pin-${nodeId}-${cp.type}-${cp.name}`,
      nodeId,
      type: cp.type,
      index: inputs.length + outputs.length,
      name: cp.name,
      pinNumber: cp.pinNumber,
      internalNodeId: cp.internalNodeId,
    };

    appendPinByType(pin, inputs, outputs);
  }

  return { inputs, outputs };
};

export const buildNodePins = (
  id: string,
  type: NodeType,
  properties: Record<string, any> = {},
  numInputsOverride?: number,
  numOutputsOverride?: number
): { inputs: Pin[]; outputs: Pin[] } => {
  const def = getNodeDefinition(type);
  if (!def) {
    return { inputs: [], outputs: [] };
  }

  const pinsToGenerate = def.generatePins ? def.generatePins(properties) : def.customPins;
  if (pinsToGenerate) {
    return buildPinsFromDefinitions(id, pinsToGenerate);
  }

  const inCount = numInputsOverride ?? properties.numInputs ?? def.numInputs;
  const outCount = numOutputsOverride ?? properties.numOutputs ?? def.numOutputs;

  const inputs: Pin[] = Array.from({ length: inCount }, (_, i) => ({
    id: `pin-${id}-in-${i}`,
    nodeId: id,
    type: 'input',
    index: i,
  }));

  const outputs: Pin[] = Array.from({ length: outCount }, (_, i) => ({
    id: `pin-${id}-out-${i}`,
    nodeId: id,
    type: 'output',
    index: i,
  }));

  return { inputs, outputs };
};

export const addNode = (state: CircuitState, type: NodeType, x: number, y: number): CircuitState => {
  const def = getNodeDefinition(type);
  if (!def) {
    console.error(`Unknown node type: ${type}`);
    return state;
  }

  const id = generateId('node');
  const properties = def.defaultProperties ? { ...def.defaultProperties } : {};
  if (def.renderAs) properties.renderAs = def.renderAs;

  const { inputs, outputs } = buildNodePins(id, type, properties);

  const newNode: LogicNode = {
    id,
    type,
    x: Math.round(x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(y / GRID_SIZE) * GRID_SIZE,
    inputs,
    outputs,
    properties,
  };

  return { ...state, nodes: [...state.nodes, newNode] };
};

export const updateNodeProperties = (
  state: CircuitState,
  id: string,
  props: Record<string, any>
): CircuitState => {
  return {
    ...state,
    nodes: state.nodes.map((n) => {
      if (n.id !== id) return n;
      const newProps = { ...n.properties, ...props };
      const def = getNodeDefinition(n.type);

      if (def?.generatePins) {
        const { inputs, outputs } = buildPinsFromDefinitions(id, def.generatePins(newProps), n);
        return { ...n, properties: newProps, inputs, outputs };
      }

      return { ...n, properties: newProps };
    }),
  };
};

export const moveNode = (state: CircuitState, id: string, x: number, y: number): CircuitState => {
  return {
    ...state,
    nodes: state.nodes.map((node) => {
      if (node.id === id) {
        const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
        const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;
        return { ...node, x: snappedX, y: snappedY };
      }
      return node;
    }),
  };
};

export const moveSelection = (
  state: CircuitState,
  ids: string[],
  primaryId: string,
  x: number,
  y: number
): CircuitState => {
  let oldX = 0;
  let oldY = 0;
  const snap = GRID_SIZE;

  if (primaryId.startsWith('wp:')) {
    const [, wireId, idxStr] = primaryId.split(':');
    const wp = state.wires.find((w) => w.id === wireId)?.waypoints?.[parseInt(idxStr, 10)];
    if (!wp) return state;
    oldX = wp.x;
    oldY = wp.y;
  } else {
    const primaryNode = state.nodes.find((n) => n.id === primaryId);
    if (!primaryNode) return state;
    oldX = primaryNode.x;
    oldY = primaryNode.y;
  }

  const snappedX = Math.round(x / snap) * snap;
  const snappedY = Math.round(y / snap) * snap;

  const dx = snappedX - oldX;
  const dy = snappedY - oldY;

  if (dx === 0 && dy === 0) return state;

  const idSet = new Set(ids);

  return {
    ...state,
    nodes: state.nodes.map((node) => {
      if (idSet.has(node.id)) {
        return { ...node, x: node.x + dx, y: node.y + dy };
      }
      return node;
    }),
    wires: state.wires.map((wire) => {
      if (idSet.has(wire.id) || wire.waypoints?.some((_, idx) => idSet.has(`wp:${wire.id}:${idx}`))) {
        return {
          ...wire,
          waypoints: wire.waypoints?.map((wp, idx) => {
            if (idSet.has(wire.id) || idSet.has(`wp:${wire.id}:${idx}`)) {
              return { x: wp.x + dx, y: wp.y + dy };
            }
            return wp;
          }),
        };
      }
      return wire;
    }),
  };
};

export const deleteNode = (state: CircuitState, id: string): CircuitState => {
  const nodes = state.nodes.filter((n) => n.id !== id);
  const wires = state.wires.filter((w) => w.sourceNodeId !== id && w.targetNodeId !== id);
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
    targetPinId,
  };

  return { ...state, wires: [...state.wires, newWire] };
};

const resizeNodePins = (
  state: CircuitState,
  nodeId: string,
  count: number,
  direction: 'in' | 'out'
): CircuitState => {
  const wiresToDelete = new Set<string>();
  const isInput = direction === 'in';
  const pinKey = isInput ? 'inputs' : 'outputs';
  const propKey = isInput ? 'numInputs' : 'numOutputs';
  const pinType = isInput ? 'input' : 'output';

  const nodes = state.nodes.map((node) => {
    if (node.id !== nodeId) return node;

    const currentPins = node[pinKey];
    const currentCount = currentPins.length;
    const newPins = [...currentPins];

    if (count > currentCount) {
      for (let i = currentCount; i < count; i++) {
        newPins.push({
          id: `pin-${node.id}-${direction}-${i}`,
          nodeId: node.id,
          type: pinType,
          index: i,
        });
      }
    } else if (count < currentCount) {
      const removedPins = newPins.splice(count, currentCount - count);
      const removedPinIds = new Set(removedPins.map((p) => p.id));

      for (let i = 0; i < state.wires.length; i++) {
        const w = state.wires[i];
        const wirePinId = isInput ? w.targetPinId : w.sourcePinId;
        if (removedPinIds.has(wirePinId)) {
          wiresToDelete.add(w.id);
        }
      }
    }

    return {
      ...node,
      [pinKey]: newPins,
      properties: { ...node.properties, [propKey]: count },
    };
  });

  const wires = wiresToDelete.size > 0 ? state.wires.filter((w) => !wiresToDelete.has(w.id)) : state.wires;
  return { ...state, nodes, wires };
};

export const setNodeInputCount = (state: CircuitState, nodeId: string, count: number): CircuitState =>
  resizeNodePins(state, nodeId, count, 'in');

export const setNodeOutputCount = (state: CircuitState, nodeId: string, count: number): CircuitState =>
  resizeNodePins(state, nodeId, count, 'out');

export const syncSubcircuitInstances = (
  nodes: LogicNode[],
  wires: Wire[]
): { nodes: LogicNode[]; wires: Wire[] } => {
  let changed = false;
  const newNodes = nodes.map((node) => {
    if (node.type.startsWith('SUBCIRCUIT:')) {
      const def = getNodeDefinition(node.type);
      if (def && def.customPins) {
        let nodeChanged = false;
        const newInputs: Pin[] = [];
        const newOutputs: Pin[] = [];

        def.customPins.forEach((cp, i) => {
          const existing =
            node.inputs.find((p) => p.internalNodeId === cp.internalNodeId || p.name === cp.name) ||
            node.outputs.find((p) => p.internalNodeId === cp.internalNodeId || p.name === cp.name);

          let pin: Pin;
          if (existing) {
            if (existing.name !== cp.name || existing.pinNumber !== cp.pinNumber) {
              nodeChanged = true;
              pin = { ...existing, name: cp.name, pinNumber: cp.pinNumber, type: cp.type };
            } else {
              pin = { ...existing };
            }
          } else {
            nodeChanged = true;
            pin = {
              id: `pin-${node.id}-${cp.type}-${cp.name}-${Date.now()}-${i}`,
              nodeId: node.id,
              type: cp.type,
              index: 0,
              name: cp.name,
              pinNumber: cp.pinNumber,
              internalNodeId: cp.internalNodeId,
            };
          }

          appendPinByType(pin, newInputs, newOutputs);
        });

        newInputs.forEach((p, idx) => {
          if (p.index !== idx) {
            p.index = idx;
            nodeChanged = true;
          }
        });

        newOutputs.forEach((p, idx) => {
          const expectedIdx = newInputs.length + idx;
          if (p.index !== expectedIdx && p.type !== 'bidir') {
            p.index = expectedIdx;
            nodeChanged = true;
          }
        });

        if (
          nodeChanged ||
          node.inputs.length !== newInputs.length ||
          node.outputs.length !== newOutputs.length
        ) {
          changed = true;
          return { ...node, inputs: newInputs, outputs: newOutputs };
        }
      }
    }
    return node;
  });

  let newWires = wires;
  if (changed) {
    const validPinIds = new Set<string>();
    for (let i = 0; i < newNodes.length; i++) {
      const n = newNodes[i];
      for (let p = 0; p < n.inputs.length; p++) validPinIds.add(n.inputs[p].id);
      for (let p = 0; p < n.outputs.length; p++) validPinIds.add(n.outputs[p].id);
    }
    newWires = wires.filter((w) => validPinIds.has(w.sourcePinId) && validPinIds.has(w.targetPinId));
  }

  return { nodes: newNodes, wires: newWires };
};
