import { LogicNode, Wire, Signal } from '../models/types';
import { getNodeDefinition } from './nodes';

export interface SimulationState {
  tickCount: number;
  pinStates: Record<string, Signal>;
  wireStates: Record<string, Signal>;
}

export const computeNextState = (
  nodes: LogicNode[],
  wires: Wire[],
  prevState: SimulationState
): SimulationState => {
  const nextPinStates: Record<string, Signal> = { ...prevState.pinStates };
  const nextWireStates: Record<string, Signal> = {};

  // 1. Evaluate gates and sources
  nodes.forEach(node => {
    const def = getNodeDefinition(node.type);
    if (!def) return;

    const inVals = node.inputs.map(p => prevState.pinStates[p.id]);
    
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
        nextPinStates[pin.id] = undefined;
      });
    } else {
      const outVals = def.evaluate(inVals, node.properties, prevState.tickCount);
      // Apply outputs
      node.outputs.forEach((pin, idx) => {
        if (outVals[idx] !== undefined) {
          nextPinStates[pin.id] = outVals[idx];
        }
      });
    }
  });

  // 2. Propagate through wires (1-tick delay for wire travel, or instant)
  // Here we copy output pins to target input pins with collision detection.
  // First, clear the state for connected input pins so we don't falsely collide with the previous tick's value.
  const connectedInputPins = new Set(wires.map(w => w.targetPinId));
  connectedInputPins.forEach(pinId => {
    delete nextPinStates[pinId];
  });

  wires.forEach(wire => {
    const val = nextPinStates[wire.sourcePinId];
    nextWireStates[wire.id] = val;
    
    if (nextPinStates.hasOwnProperty(wire.targetPinId) && nextPinStates[wire.targetPinId] !== val) {
      if (nextPinStates[wire.targetPinId] !== undefined && val !== undefined) {
        nextPinStates[wire.targetPinId] = 'X'; // Collision
      } else if (val !== undefined) {
        nextPinStates[wire.targetPinId] = val;
      }
    } else {
      nextPinStates[wire.targetPinId] = val;
    }
  });

  // 3. Clear disconnected input pins
  nodes.forEach(node => {
    node.inputs.forEach(pin => {
      if (!connectedInputPins.has(pin.id)) {
        nextPinStates[pin.id] = undefined;
      }
    });
  });

  return {
    tickCount: prevState.tickCount + 1,
    pinStates: nextPinStates,
    wireStates: nextWireStates
  };
};
