import { describe, it, expect, vi } from 'vitest';
import { computeNextState, SimulationState } from '../simulation';
import { LogicNode, Wire } from '../../models/types';

// Mock the node registry
vi.mock('../nodes', () => {
  return {
    getNodeDefinition: vi.fn((type: string) => {
      if (type === 'AND') {
        return {
          type: 'AND',
          numInputs: 2,
          numOutputs: 1,
          evaluate: (inputs: any[]) => {
            if (inputs[0] === 1 && inputs[1] === 1) return [1];
            if (inputs[0] === 0 || inputs[1] === 0) return [0];
            return [undefined];
          }
        };
      }
      if (type === 'SWITCH') {
        return {
          type: 'SWITCH',
          numInputs: 0,
          numOutputs: 1,
          evaluate: (_inputs: any[], props: any) => [props?.active ? 1 : 0]
        };
      }
      return null;
    })
  };
});

describe('Simulation Engine', () => {
  it('should propagate signals through a switch and an AND gate', () => {
    // Setup 2 switches connected to an AND gate
    const switch1: LogicNode = {
      id: 'sw1', type: 'SWITCH', x: 0, y: 0,
      inputs: [],
      outputs: [{ id: 'sw1-out', nodeId: 'sw1', type: 'output', index: 0 }],
      properties: { active: true } // ON
    };
    
    const switch2: LogicNode = {
      id: 'sw2', type: 'SWITCH', x: 0, y: 0,
      inputs: [],
      outputs: [{ id: 'sw2-out', nodeId: 'sw2', type: 'output', index: 0 }],
      properties: { active: false } // OFF
    };

    const andGate: LogicNode = {
      id: 'and1', type: 'AND', x: 0, y: 0,
      inputs: [
        { id: 'and1-in0', nodeId: 'and1', type: 'input', index: 0 },
        { id: 'and1-in1', nodeId: 'and1', type: 'input', index: 1 }
      ],
      outputs: [{ id: 'and1-out', nodeId: 'and1', type: 'output', index: 0 }],
      properties: {}
    };

    const wires: Wire[] = [
      { id: 'w1', sourceNodeId: 'sw1', sourcePinId: 'sw1-out', targetNodeId: 'and1', targetPinId: 'and1-in0' },
      { id: 'w2', sourceNodeId: 'sw2', sourcePinId: 'sw2-out', targetNodeId: 'and1', targetPinId: 'and1-in1' }
    ];

    const nodes = [switch1, switch2, andGate];

    const prevState: SimulationState = {
      tickCount: 0,
      pinStates: {},
      wireStates: {}
    };

    // TICK 1: Switches output their values, but wires propagate AFTER gates evaluate.
    // So AND gate still sees undefined inputs in tick 1, and outputs undefined.
    // However, the wires will be updated at the end of tick 1 to carry the switch values.
    const state1 = computeNextState(nodes, wires, prevState, 'schematic');
    
    expect(state1.tickCount).toBe(1);
    expect(state1.pinStates['sw1-out']).toBe(1);
    expect(state1.pinStates['sw2-out']).toBe(0);
    expect(state1.pinStates['and1-out']).toBeUndefined(); // Gate hasn't seen the inputs yet
    
    // Wires carry the value to the AND gate's input pins
    expect(state1.pinStates['and1-in0']).toBe(1);
    expect(state1.pinStates['and1-in1']).toBe(0);
    expect(state1.wireStates['w1']).toBe(1);
    expect(state1.wireStates['w2']).toBe(0);

    // TICK 2: AND gate sees inputs (1, 0) -> outputs 0
    const state2 = computeNextState(nodes, wires, state1, 'schematic');
    expect(state2.tickCount).toBe(2);
    expect(state2.pinStates['and1-out']).toBe(0);

    // Now turn ON switch 2
    switch2.properties = { active: true };

    // TICK 3: Switch 2 outputs 1. Wires propagate. AND gate still outputs 0 (using old inputs).
    const state3 = computeNextState(nodes, wires, state2, 'schematic');
    expect(state3.pinStates['sw2-out']).toBe(1);
    expect(state3.pinStates['and1-in1']).toBe(1); // Input receives new value
    expect(state3.pinStates['and1-out']).toBe(0); // Still 0

    // TICK 4: AND gate sees inputs (1, 1) -> outputs 1
    const state4 = computeNextState(nodes, wires, state3, 'schematic');
    expect(state4.pinStates['and1-out']).toBe(1);
  });

  it('should clear disconnected input pins', () => {
    const andGate: LogicNode = {
      id: 'and1', type: 'AND', x: 0, y: 0,
      inputs: [{ id: 'and1-in0', nodeId: 'and1', type: 'input', index: 0 }],
      outputs: [],
      properties: {}
    };

    const prevState: SimulationState = {
      tickCount: 0,
      pinStates: { 'and1-in0': 1 }, // Currently has a value from a deleted wire
      wireStates: {}
    };

    // No wires connected to and1-in0
    const state1 = computeNextState([andGate], [], prevState, 'schematic');
    
    expect(state1.pinStates['and1-in0']).toBeUndefined();
  });
});
