import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addNode, moveNode, deleteNode, addWire, deleteWire, CircuitState, setNodeInputCount } from '../circuit';
import { NodeType } from '../../models/types';

// Mock the node registry
vi.mock('../nodes', () => {
  return {
    getNodeDefinition: vi.fn((type: string) => {
      if (type === 'AND') {
        return {
          type: 'AND',
          numInputs: 2,
          numOutputs: 1,
          defaultProperties: { label: 'AndGate' }
        };
      }
      if (type === '74LS161') {
        return {
          type: '74LS161',
          renderAs: 'DIP',
          customPins: [
            { name: '~CLR', type: 'input', pinNumber: 1 },
            { name: 'QD', type: 'output', pinNumber: 11 }
          ]
        };
      }
      return null;
    })
  };
});

describe('Circuit Store Core Mutators', () => {
  let initialState: CircuitState;

  beforeEach(() => {
    initialState = {
      nodes: [],
      wires: []
    };
  });

  it('should add a basic node and snap to grid', () => {
    // 25 / 20 = 1 (round) * 20 = 20
    const state = addNode(initialState, 'AND', 25, 30);
    
    expect(state.nodes.length).toBe(1);
    const node = state.nodes[0];
    expect(node.type).toBe('AND');
    expect(node.x).toBe(20);
    expect(node.y).toBe(40); // 30 / 20 = 2 * 20 = 40 (wait 30 / 20 = 1.5 -> Math.round is 2 * 20 = 40)
    expect(node.inputs.length).toBe(2);
    expect(node.outputs.length).toBe(1);
    expect(node.properties.label).toBe('AndGate');
  });

  it('should add a node with customPins correctly mapped', () => {
    const state = addNode(initialState, '74LS161', 0, 0);
    
    expect(state.nodes.length).toBe(1);
    const node = state.nodes[0];
    expect(node.inputs.length).toBe(1);
    expect(node.outputs.length).toBe(1);
    expect(node.inputs[0].name).toBe('~CLR');
    expect(node.inputs[0].pinNumber).toBe(1);
    expect(node.outputs[0].name).toBe('QD');
    expect(node.outputs[0].pinNumber).toBe(11);
    expect(node.properties.renderAs).toBe('DIP');
  });

  it('should delete a node and its connected wires', () => {
    let state = addNode(initialState, 'AND', 0, 0);
    state = addNode(state, 'AND', 100, 0);
    
    const node1 = state.nodes[0].id;
    const node2 = state.nodes[1].id;
    const pin1 = state.nodes[0].outputs[0].id;
    const pin2 = state.nodes[1].inputs[0].id;
    
    state = addWire(state, node1, pin1, node2, pin2);
    expect(state.wires.length).toBe(1);
    
    state = deleteNode(state, node1);
    expect(state.nodes.length).toBe(1); // Node 2 remains
    expect(state.wires.length).toBe(0); // Wire deleted
  });

  it('should modify node inputs and clean up wires', () => {
    let state = addNode(initialState, 'AND', 0, 0);
    const node1 = state.nodes[0].id;
    
    // Add third input
    state = setNodeInputCount(state, node1, 3);
    expect(state.nodes[0].inputs.length).toBe(3);
    
    // Wire to third input
    const pin3 = state.nodes[0].inputs[2].id;
    state = addNode(state, 'AND', 100, 0);
    const node2 = state.nodes[1].id;
    const outPin = state.nodes[1].outputs[0].id;
    
    state = addWire(state, node2, outPin, node1, pin3);
    expect(state.wires.length).toBe(1);
    
    // Reduce inputs back to 2, this should delete the wire connected to input 3
    state = setNodeInputCount(state, node1, 2);
    expect(state.nodes[0].inputs.length).toBe(2);
    expect(state.wires.length).toBe(0);
  });
});
