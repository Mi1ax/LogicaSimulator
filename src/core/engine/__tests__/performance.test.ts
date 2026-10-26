import { describe, it, expect } from 'vitest';
import {
  CircuitState,
  addNode,
  addWire,
  moveNode,
  updateNodeProperties,
} from '../circuit';
import { computeAllWirePaths } from '../routing';
import {
  getSchematicDimensions,
  getSchematicAnchor,
  getSchematicPinPosition,
} from '../../utils/schematicLayout';
import {
  AnalyzerRingBuffer,
  LA_VAL_0,
  LA_VAL_1,
} from '../logicAnalyzer';
import { flattenCircuit } from '../simulation';
import {
  useSimulatorStore,
  isIdSelected,
  isNodeBeingPlaced,
  getNodeByIdFast,
} from '../../../store/useSimulatorStore';

const createEmptyCircuit = (): CircuitState => ({ nodes: [], wires: [] });

describe('Frontend Engine & Canvas Performance Benchmarks', () => {
  it('benchmarks mass-drag of 500 selected nodes across 1,000-node circuit at 60 FPS', () => {
    let state = createEmptyCircuit();
    const nodeIds: string[] = [];

    for (let i = 0; i < 1000; i++) {
      const col = i % 40;
      const row = Math.floor(i / 40);
      const type = i % 5 === 0 ? '74LS181' : i % 3 === 0 ? '27C256' : 'NAND';
      state = addNode(state, type, col * 140, row * 120);
      nodeIds.push(state.nodes[state.nodes.length - 1].id);
    }

    for (let i = 0; i < 999; i++) {
      const src = state.nodes[i];
      const dst = state.nodes[i + 1];
      if (src.outputs.length > 0 && dst.inputs.length > 0) {
        state = addWire(state, src.id, src.outputs[0].id, dst.id, dst.inputs[0].id);
      }
    }

    // Select 500 nodes
    const selectedIds = nodeIds.slice(0, 500);
    useSimulatorStore.setState({
      nodes: state.nodes,
      wires: state.wires,
      selection: null,
      multiSelection: selectedIds,
      placingNodeId: null,
      pastingNodeIds: null,
    });

    const frames = 60;
    const t0 = performance.now();
    for (let frame = 1; frame <= frames; frame++) {
      useSimulatorStore.getState().updateNodePosition(selectedIds[0], frame * 20, frame * 20, false);
      const st = useSimulatorStore.getState();
      // Simulate per-node O(1) selector lookups for all 1,000 nodes
      for (let i = 0; i < st.nodes.length; i++) {
        const id = st.nodes[i].id;
        getNodeByIdFast(st, id);
        isIdSelected(st, id);
        isNodeBeingPlaced(st, id);
      }
    }
    const elapsedMs = performance.now() - t0;
    const avgFrameMs = elapsedMs / frames;

    console.log(
      `[Perf] 60 frames mass-drag (500/1000 nodes + 3000 selector queries/frame): ${elapsedMs.toFixed(2)} ms total (${avgFrameMs.toFixed(3)} ms/frame)`
    );

    // Must easily beat 16.6ms (60 FPS budget); expect < 8ms per frame
    expect(avgFrameMs).toBeLessThan(8);
  });

  it('benchmarks computeAllWirePaths on 1,000 wires (cold, stationary, single-node drag)', () => {
    let state = createEmptyCircuit();
    for (let i = 0; i < 1001; i++) {
      const col = i % 40;
      const row = Math.floor(i / 40);
      state = addNode(state, 'AND', col * 120, row * 80);
    }
    for (let i = 0; i < 1000; i++) {
      const src = state.nodes[i];
      const dst = state.nodes[i + 1];
      state = addWire(state, src.id, src.outputs[0].id, dst.id, dst.inputs[0].id);
    }

    // 1. Cold cache routing of 1,000 wires
    const tCold0 = performance.now();
    const resCold = computeAllWirePaths(state.wires, state.nodes);
    const coldMs = performance.now() - tCold0;
    expect(resCold.wirePaths.size).toBe(1000);

    // 2. Stationary fast-path (e.g., input property toggle where node x/y did not change)
    state = updateNodeProperties(state, state.nodes[0].id, { label: 'A0' });
    const tStat0 = performance.now();
    for (let i = 0; i < 100; i++) {
      computeAllWirePaths(state.wires, state.nodes);
    }
    const statAvgMs = (performance.now() - tStat0) / 100;

    // 3. Single-node drag (1 node moved out of 1,001, incremental update of only connected wires)
    const tDrag0 = performance.now();
    for (let step = 1; step <= 60; step++) {
      state = moveNode(state, state.nodes[500].id, 500 + step * 20, 400);
      computeAllWirePaths(state.wires, state.nodes);
    }
    const dragAvgMs = (performance.now() - tDrag0) / 60;

    console.log(
      `[Perf] computeAllWirePaths (1,000 wires): cold=${coldMs.toFixed(2)} ms, stationary=${statAvgMs.toFixed(3)} ms, 1-node-drag=${dragAvgMs.toFixed(3)} ms/frame`
    );

    expect(coldMs).toBeLessThan(50);
    expect(statAvgMs).toBeLessThan(2);
    expect(dragAvgMs).toBeLessThan(3);
  });

  it('benchmarks schematic DIP IC & gate layout geometry caches (50,000 queries)', () => {
    let state = createEmptyCircuit();
    state = addNode(state, '27C256', 100, 100);
    state = addNode(state, '62256', 300, 100);
    state = addNode(state, 'GAL22V10', 500, 100);
    state = addNode(state, '74LS181', 700, 100);
    state = addNode(state, 'NAND', 900, 100);

    const nodes = state.nodes;
    const t0 = performance.now();
    let checksum = 0;
    for (let iter = 0; iter < 10000; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const dims = getSchematicDimensions(n);
        const anchor = getSchematicAnchor(n);
        const pinPos = getSchematicPinPosition(n, n.outputs[0].id);
        checksum += dims.width + anchor.x + pinPos.x;
      }
    }
    const elapsedMs = performance.now() - t0;

    console.log(
      `[Perf] 50,000 DIP/Gate layout queries (dims + anchor + pinPos): ${elapsedMs.toFixed(2)} ms`
    );

    expect(checksum).not.toBe(0);
    expect(elapsedMs).toBeLessThan(60);
  });

  it('benchmarks Logic Analyzer ring buffer batch recording & 204,800 bus/bit reads', () => {
    const buffer = new AnalyzerRingBuffer();
    const pinIds: string[] = [];
    for (let b = 0; b < 16; b++) {
      pinIds.push(`pin_${b}`);
    }
    const busPinIds = pinIds.slice(0, 8);

    const sampleCount = 1024;
    const ticks: number[] = [];
    const flatSamples: number[] = [];
    for (let s = 0; s < sampleCount; s++) {
      ticks.push(s + 1);
      for (let b = 0; b < 16; b++) {
        flatSamples.push(((s >> (b & 7)) & 1) ? LA_VAL_1 : LA_VAL_0);
      }
    }

    const t0 = performance.now();
    buffer.recordBatchFromRust(ticks, flatSamples, pinIds);
    let sum = 0;
    for (let iter = 0; iter < 100; iter++) {
      for (let s = 0; s < sampleCount; s++) {
        const busVal = buffer.getBusSampleAt(busPinIds, s);
        const bitVal = buffer.getPinSampleAt(pinIds[8], s);
        if (busVal >= 0) sum += busVal;
        if (bitVal === LA_VAL_1) sum += 1;
      }
    }
    const elapsedMs = performance.now() - t0;

    console.log(
      `[Perf] AnalyzerRingBuffer (1,024 samples x 16 pins + 204,800 sample reads): ${elapsedMs.toFixed(2)} ms`
    );

    expect(sum).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(60);
  });

  it('benchmarks hierarchical subcircuit flattening & O(1) cache hits', () => {
    let subState = createEmptyCircuit();
    subState = addNode(subState, 'SUB_IN', 0, 0);
    const subInId = subState.nodes[0].id;
    const subInPin = subState.nodes[0].outputs[0].id;

    let prevNodeId = subInId;
    let prevPinId = subInPin;
    for (let i = 0; i < 16; i++) {
      subState = addNode(subState, 'NOT', (i + 1) * 60, 0);
      const gate = subState.nodes[subState.nodes.length - 1];
      subState = addWire(subState, prevNodeId, prevPinId, gate.id, gate.inputs[0].id);
      prevNodeId = gate.id;
      prevPinId = gate.outputs[0].id;
    }
    subState = addNode(subState, 'SUB_OUT', 18 * 60, 0);
    const subOut = subState.nodes[subState.nodes.length - 1];
    subState = addWire(subState, prevNodeId, prevPinId, subOut.id, subOut.inputs[0].id);

    const savedCircuits = {
      sub16: {
        name: 'INV16',
        nodes: subState.nodes,
        wires: subState.wires,
      },
    };

    let mainState = createEmptyCircuit();
    mainState = addNode(mainState, 'INPUT', 0, 0);
    for (let i = 0; i < 20; i++) {
      mainState = addNode(mainState, 'AND', (i + 1) * 100, 0);
    }

    const tCold0 = performance.now();
    const flat1 = flattenCircuit(mainState.nodes, mainState.wires, savedCircuits);
    const coldMs = performance.now() - tCold0;

    const tWarm0 = performance.now();
    for (let i = 0; i < 10000; i++) {
      flattenCircuit(mainState.nodes, mainState.wires, savedCircuits);
    }
    const warmTotalMs = performance.now() - tWarm0;

    console.log(
      `[Perf] flattenCircuit: cold=${coldMs.toFixed(3)} ms, 10,000 cached calls=${warmTotalMs.toFixed(3)} ms`
    );

    expect(flat1.nodes.length).toBe(21);
    expect(warmTotalMs).toBeLessThan(10);
  });
});
