import { LogicNode, Wire, Signal } from '../models/types';
import { getNodeDefinition } from './nodes';

export interface SimulationState {
  tickCount: number;
  pinStates: Record<string, Signal>;
  wireStates: Record<string, Signal>;
  /** Internal state of sequential nodes (e.g. counters, flip-flops), keyed by node id. */
  nodeStates?: Record<string, Record<string, any>>;
}

export const computeNextState = (
  nodes: LogicNode[],
  baseWires: Wire[],
  prevState: SimulationState
): SimulationState => {
  // Generate virtual wires for Net Labels
  const virtualWires: Wire[] = [];
  const netGroups: Record<string, LogicNode[]> = {};
  
  nodes.forEach(n => {
    if (n.type === 'NET_LABEL' && n.properties?.label) {
      const name = String(n.properties.label).trim();
      if (name) {
        if (!netGroups[name]) netGroups[name] = [];
        netGroups[name].push(n);
      }
    }
  });

  Object.values(netGroups).forEach(group => {
    for (let i = 0; i < group.length; i++) {
      for (let j = 0; j < group.length; j++) {
        if (i !== j) {
          virtualWires.push({
            id: `vw_${group[i].id}_${group[j].id}`,
            sourceNodeId: group[i].id,
            sourcePinId: group[i].outputs[0]?.id,
            targetNodeId: group[j].id,
            targetPinId: group[j].inputs[0]?.id,
          });
        }
      }
    }
  });

  const wires = [...baseWires, ...virtualWires];

  let currentPinStates: Record<string, Signal> = { ...prevState.pinStates };
  let finalWireStates: Record<string, Signal> = {};
  let finalNodeStates: Record<string, Record<string, any>> = {};

  const MAX_ITERATIONS = 50;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const nextIterPinStates: Record<string, Signal> = { ...currentPinStates };
    finalNodeStates = {};
    finalWireStates = {};

    // 1. Evaluate gates and sources
    nodes.forEach(node => {
      const def = getNodeDefinition(node.type);
      if (!def) return;

      const inVals = node.inputs.map(p => currentPinStates[p.id]);
      
      let isPowered = true;
      if (def.renderAs === 'DIP') {
        node.inputs.forEach((pin, idx) => {
          if (pin.name === 'VCC' && inVals[idx] !== 1) isPowered = false;
          if (pin.name === 'GND' && inVals[idx] !== 0) isPowered = false;
        });
      }

      if (!isPowered) {
        // Unpowered IC outputs high-Z (undefined)
        node.outputs.forEach((pin) => {
          nextIterPinStates[pin.id] = undefined;
        });
      } else {
        // Always use the committed state from the PREVIOUS tick to avoid glitch increments
        const internal = { ...(prevState.nodeStates?.[node.id] ?? {}) };
        const outVals = def.evaluate(inVals, node.properties, prevState.tickCount, internal);
        if (Object.keys(internal).length > 0) finalNodeStates[node.id] = internal;
        
        node.outputs.forEach((pin, idx) => {
          nextIterPinStates[pin.id] = outVals[idx];
        });
      }
    });

    // 2. Propagate through wires
    const connectedInputPins = new Set(wires.map(w => w.targetPinId));
    connectedInputPins.forEach(pinId => {
      delete nextIterPinStates[pinId];
    });

    wires.forEach(wire => {
      let val = nextIterPinStates[wire.sourcePinId];
      if (val === undefined && !(wire.sourcePinId in nextIterPinStates)) {
        val = currentPinStates[wire.sourcePinId];
      }
      finalWireStates[wire.id] = val;
      
      if (nextIterPinStates.hasOwnProperty(wire.targetPinId) && nextIterPinStates[wire.targetPinId] !== val) {
        if (nextIterPinStates[wire.targetPinId] !== undefined && val !== undefined) {
          nextIterPinStates[wire.targetPinId] = 'X'; // Collision
        } else if (val !== undefined) {
          nextIterPinStates[wire.targetPinId] = val;
        }
      } else {
        nextIterPinStates[wire.targetPinId] = val;
      }
    });

    // 3. Clear disconnected input pins
    nodes.forEach(node => {
      node.inputs.forEach(pin => {
        if (!connectedInputPins.has(pin.id)) {
          nextIterPinStates[pin.id] = undefined;
        }
      });
    });

    // Check if state settled
    let changed = false;
    const nextKeys = Object.keys(nextIterPinStates);
    const currKeys = Object.keys(currentPinStates);
    
    if (nextKeys.length !== currKeys.length) {
      changed = true;
    } else {
      for (const key of nextKeys) {
        if (nextIterPinStates[key] !== currentPinStates[key]) {
          changed = true;
          break;
        }
      }
    }

    currentPinStates = nextIterPinStates;
    if (!changed) break;
  }

  return {
    tickCount: prevState.tickCount + 1,
    pinStates: currentPinStates,
    wireStates: finalWireStates,
    nodeStates: finalNodeStates
  };
};
