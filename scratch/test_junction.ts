import { computeNextState, SimulationState } from '../src/core/engine/simulation';
import { LogicNode, Wire } from '../src/core/models/types';
import { generateId } from '../src/core/utils/id';

const nodes: LogicNode[] = [
  {
    id: 'n1', type: 'DIP_SWITCH', x: 0, y: 0, inputs: [],
    outputs: [{ id: 'p1', nodeId: 'n1', type: 'output', index: 0 }],
    properties: { value: 1 }
  },
  {
    id: 'n2', type: 'JUNCTION', x: 0, y: 0,
    inputs: [{ id: 'j_in', nodeId: 'n2', type: 'input', index: 0 }],
    outputs: [{ id: 'j_out', nodeId: 'n2', type: 'output', index: 0 }],
  }
];

const wires: Wire[] = [
  { id: 'w1', sourceNodeId: 'n1', sourcePinId: 'p1', targetNodeId: 'n2', targetPinId: 'j_in' }
];

let state: SimulationState = { tickCount: 0, pinStates: {}, wireStates: {} };

state = computeNextState(nodes, wires, state);
console.log("Tick 1 (DIP=1):", state.pinStates['p1'], state.pinStates['j_out']);

// Change DIP switch to 0
nodes[0].properties.value = 0;
state = computeNextState(nodes, wires, state);
console.log("Tick 2 (DIP=0):", state.pinStates['p1'], state.pinStates['j_out']);

