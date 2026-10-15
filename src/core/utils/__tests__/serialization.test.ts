import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { serializeCircuit, deserializeCircuit } from '../serialization';
import { addNode, addWire, setNodeInputCount, CircuitState } from '../../engine/circuit';
import { computeNextState } from '../../engine/simulation';

describe('Circuit Serialization & Deserialization', () => {
  it('round-trips nodes, variable pin counts, memory data, and wires compactly', () => {
    let state: CircuitState = { nodes: [], wires: [] };
    state = addNode(state, 'INPUT', 0, 0);
    state = addNode(state, 'AND', 100, 0);
    state = addNode(state, '27C256', 200, 0);

    const inputId = state.nodes[0].id;
    const andId = state.nodes[1].id;

    state = setNodeInputCount(state, andId, 4);
    state.nodes[2].properties = {
      ...state.nodes[2].properties,
      data: [0x12, 0x34, 0, 0, 0, 0],
      internal: { dummy: 123 },
    };

    state = addWire(
      state,
      inputId,
      state.nodes[0].outputs[0].id,
      andId,
      state.nodes[1].inputs[3].id
    );

    const json = serializeCircuit(state.nodes, state.wires);
    const parsed = JSON.parse(json);

    // Pins and internal runtime state must be omitted in serialized JSON
    expect(parsed.nodes[0].inputs).toBeUndefined();
    expect(parsed.nodes[0].outputs).toBeUndefined();
    expect(parsed.nodes[2].properties.internal).toBeUndefined();
    // Trailing zeros in ROM data must be trimmed
    expect(parsed.nodes[2].properties.data).toEqual([0x12, 0x34]);

    const restored = deserializeCircuit(parsed);
    expect(restored.nodes.length).toBe(3);
    expect(restored.nodes[1].inputs.length).toBe(4);
    expect(restored.wires.length).toBe(1);
    expect(restored.wires[0].sourceNodeId).toBe('n1');
    expect(restored.wires[0].targetNodeId).toBe('n2');
    expect(restored.wires[0].targetPinId).toBe(restored.nodes[1].inputs[3].id);
  });

  it('validates and round-trips all public/examples/*.logica files without losing pin connections', () => {
    const examplesDir = path.resolve(__dirname, '../../../../public/examples');
    const files = fs.readdirSync(examplesDir).filter(f => f.endsWith('.logica'));

    for (const file of files) {
      const rawText = fs.readFileSync(path.join(examplesDir, file), 'utf8');
      const rawJson = JSON.parse(rawText);

      // 1. Hydrate original
      const firstPass = deserializeCircuit(rawJson);
      expect(firstPass.nodes.length).toBe(rawJson.nodes.length);
      expect(firstPass.wires.length).toBe(rawJson.wires.length);

      // 2. Serialize to compact format and deserialize again
      const compactText = serializeCircuit(firstPass.nodes, firstPass.wires, firstPass.subcircuits);
      const secondPass = deserializeCircuit(JSON.parse(compactText));

      expect(secondPass.nodes.length).toBe(firstPass.nodes.length);
      expect(secondPass.wires.length).toBe(firstPass.wires.length);

      // Verify every wire connects to valid hydrated pins
      const nodeMap = new Map(secondPass.nodes.map(n => [n.id, n]));
      for (const w of secondPass.wires) {
        const srcNode = nodeMap.get(w.sourceNodeId);
        const tgtNode = nodeMap.get(w.targetNodeId);
        expect(srcNode, `${file}: missing source node ${w.sourceNodeId}`).toBeDefined();
        expect(tgtNode, `${file}: missing target node ${w.targetNodeId}`).toBeDefined();

        const srcPins = [...(srcNode?.inputs || []), ...(srcNode?.outputs || [])];
        const tgtPins = [...(tgtNode?.inputs || []), ...(tgtNode?.outputs || [])];

        expect(
          srcPins.some(p => p.id === w.sourcePinId),
          `${file}: wire ${w.id} sourcePinId ${w.sourcePinId} not found on ${srcNode?.type} (${srcNode?.id})`
        ).toBe(true);
        expect(
          tgtPins.some(p => p.id === w.targetPinId),
          `${file}: wire ${w.id} targetPinId ${w.targetPinId} not found on ${tgtNode?.type} (${tgtNode?.id})`
        ).toBe(true);
      }

      // Run a simulation tick to ensure no runtime errors
      const simState = computeNextState(secondPass.nodes, secondPass.wires, {
        tickCount: 0,
        pinStates: {},
        wireStates: {},
        nodeStates: {},
      });
      expect(simState.tickCount).toBe(1);
    }
  });
});
