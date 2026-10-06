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
  wires: Wire[],
  prevState: SimulationState
): SimulationState => {
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
      const val = nextIterPinStates[wire.sourcePinId];
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
