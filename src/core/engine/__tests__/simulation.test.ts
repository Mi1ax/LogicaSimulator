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
      if (type === 'PULL_UP') {
        return {
          type: 'PULL_UP',
          numInputs: 0,
          numOutputs: 1,
          evaluate: () => [1]
        };
      }
      if (type === 'PULL_DOWN') {
        return {
          type: 'PULL_DOWN',
          numInputs: 0,
          numOutputs: 1,
          evaluate: () => [0]
        };
      }
      if (type === 'KEYPAD') {
        return {
          type: 'KEYPAD',
          numInputs: 7,
          numOutputs: 0,
          evaluate: () => []
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

    // TICK 1: Switches output their values, and wires propagate instantly.
    // So AND gate sees inputs and outputs immediately.
    const state1 = computeNextState(nodes, wires, prevState);
    
    expect(state1.tickCount).toBe(1);
    expect(state1.pinStates['sw1-out']).toBe(1);
    expect(state1.pinStates['sw2-out']).toBe(0);
    expect(state1.pinStates['and1-in0']).toBe(1);
    expect(state1.pinStates['and1-in1']).toBe(0);
    expect(state1.wireStates['w1']).toBe(1);
    expect(state1.wireStates['w2']).toBe(0);
    expect(state1.pinStates['and1-out']).toBe(0); // Instantly evaluated to 0

    // TICK 2: No changes
    const state2 = computeNextState(nodes, wires, state1);
    expect(state2.tickCount).toBe(2);
    expect(state2.pinStates['and1-out']).toBe(0);

    // Now turn ON switch 2
    switch2.properties = { active: true };

    // TICK 3: Switch 2 outputs 1. Wires propagate instantly. AND gate outputs 1 instantly.
    const state3 = computeNextState(nodes, wires, state2);
    expect(state3.pinStates['sw2-out']).toBe(1);
    expect(state3.pinStates['and1-in1']).toBe(1); 
    expect(state3.pinStates['and1-out']).toBe(1); 
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
    const state1 = computeNextState([andGate], [], prevState);
    
    expect(state1.pinStates['and1-in0']).toBeUndefined();
  });

  it('should propagate signals between BUS_BREAKOUT nodes connected by a BUS wire', () => {
    const switch1: LogicNode = {
      id: 'sw1', type: 'SWITCH', x: 0, y: 0,
      inputs: [],
      outputs: [{ id: 'sw1-out', nodeId: 'sw1', type: 'output', index: 0 }],
      properties: { active: true }
    };

    const busA: LogicNode = {
      id: 'busA', type: 'BUS_BREAKOUT', x: 40, y: 0,
      inputs: [
        { id: 'busA-0', nodeId: 'busA', type: 'bidir', index: 0, name: '0' },
        { id: 'busA-bus', nodeId: 'busA', type: 'bidir', index: 8, name: 'BUS' }
      ],
      outputs: [
        { id: 'busA-0', nodeId: 'busA', type: 'bidir', index: 0, name: '0' },
        { id: 'busA-bus', nodeId: 'busA', type: 'bidir', index: 8, name: 'BUS' }
      ],
      properties: {}
    };

    const busB: LogicNode = {
      id: 'busB', type: 'BUS_BREAKOUT', x: 100, y: 0,
      inputs: [
        { id: 'busB-0', nodeId: 'busB', type: 'bidir', index: 0, name: '0' },
        { id: 'busB-bus', nodeId: 'busB', type: 'bidir', index: 8, name: 'BUS' }
      ],
      outputs: [
        { id: 'busB-0', nodeId: 'busB', type: 'bidir', index: 0, name: '0' },
        { id: 'busB-bus', nodeId: 'busB', type: 'bidir', index: 8, name: 'BUS' }
      ],
      properties: {}
    };

    const wires: Wire[] = [
      { id: 'w-sw-busA', sourceNodeId: 'sw1', sourcePinId: 'sw1-out', targetNodeId: 'busA', targetPinId: 'busA-0' },
      { id: 'w-bus-bus', sourceNodeId: 'busA', sourcePinId: 'busA-bus', targetNodeId: 'busB', targetPinId: 'busB-bus' }
    ];

    const state = computeNextState([switch1, busA, busB], wires, {
      tickCount: 0,
      pinStates: {},
      wireStates: {}
    });

    expect(state.pinStates['busB-0']).toBe(1);
  });

  it('should resolve weak PULL_UP/PULL_DOWN signals and connect KEYPAD rows and columns on key press', () => {
    const colDriver: LogicNode = {
      id: 'col1', type: 'SWITCH', x: 0, y: 0,
      inputs: [],
      outputs: [{ id: 'col1-out', nodeId: 'col1', type: 'output', index: 0 }],
      properties: { active: false } // Drives active-low 0 onto C1
    };

    const rowPullUp: LogicNode = {
      id: 'pu1', type: 'PULL_UP', x: 0, y: 0,
      inputs: [],
      outputs: [{ id: 'pu1-out', nodeId: 'pu1', type: 'output', index: 0 }],
      properties: {}
    };

    const keypad: LogicNode = {
      id: 'kp1', type: 'KEYPAD', x: 0, y: 0,
      inputs: [
        { id: 'kp-r1', nodeId: 'kp1', type: 'bidir', index: 0, name: 'R1' },
        { id: 'kp-r2', nodeId: 'kp1', type: 'bidir', index: 1, name: 'R2' },
        { id: 'kp-r3', nodeId: 'kp1', type: 'bidir', index: 2, name: 'R3' },
        { id: 'kp-r4', nodeId: 'kp1', type: 'bidir', index: 3, name: 'R4' },
        { id: 'kp-c1', nodeId: 'kp1', type: 'bidir', index: 4, name: 'C1' },
        { id: 'kp-c2', nodeId: 'kp1', type: 'bidir', index: 5, name: 'C2' },
        { id: 'kp-c3', nodeId: 'kp1', type: 'bidir', index: 6, name: 'C3' },
      ],
      outputs: [],
      properties: { pressedKeys: [] }
    };

    const wires: Wire[] = [
      { id: 'w-r1', sourceNodeId: 'pu1', sourcePinId: 'pu1-out', targetNodeId: 'kp1', targetPinId: 'kp-r1' },
      { id: 'w-c1', sourceNodeId: 'col1', sourcePinId: 'col1-out', targetNodeId: 'kp1', targetPinId: 'kp-c1' },
    ];

    // Unpressed: R1 is weakly pulled HIGH (1), C1 is strongly driven LOW (0)
    const stateUnpressed = computeNextState([colDriver, rowPullUp, keypad], wires, {
      tickCount: 0,
      pinStates: {},
      wireStates: {}
    });
    expect(stateUnpressed.pinStates['kp-r1']).toBe(1);
    expect(stateUnpressed.pinStates['kp-c1']).toBe(0);

    // Press key '1' (index 0: Row 0, Col 0 -> R1 shorted to C1): strong 0 overrides weak PULL_UP without 'X' collision
    keypad.properties = { pressedKey: 0 };
    const statePressed = computeNextState([colDriver, rowPullUp, keypad], wires, stateUnpressed);
    expect(statePressed.pinStates['kp-r1']).toBe(0);
    expect(statePressed.pinStates['kp-c1']).toBe(0);
  });
});
