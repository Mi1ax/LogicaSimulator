import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnalyzerRingBuffer,
  discoverCircuitProbes,
  formatBusSample,
  LA_VAL_0,
  LA_VAL_1,
  LA_VAL_Z,
  MAX_LA_HISTORY,
} from '../logicAnalyzer';
import * as circuit from '../circuit';

describe('Logic Analyzer Ring Buffer & Probe Discovery', () => {
  let ring: AnalyzerRingBuffer;

  beforeEach(() => {
    ring = new AnalyzerRingBuffer();
  });

  it('records single-bit and multi-bit bus samples from Rust batch without allocation', () => {
    const pinIds = ['b3', 'b2', 'b1', 'b0'];
    const ticks: number[] = [];
    const samples: number[] = [];

    for (let t = 1; t <= 16; t++) {
      const val = (t - 1) & 0x0f;
      ticks.push(t);
      samples.push(
        (val >> 3) & 1 ? LA_VAL_1 : LA_VAL_0,
        (val >> 2) & 1 ? LA_VAL_1 : LA_VAL_0,
        (val >> 1) & 1 ? LA_VAL_1 : LA_VAL_0,
        val & 1 ? LA_VAL_1 : LA_VAL_0
      );
    }

    ring.recordBatchFromRust(ticks, samples, pinIds);

    expect(ring.count).toBe(16);
    expect(ring.getTickAt(0)).toBe(1);
    expect(ring.getTickAt(15)).toBe(16);
    expect(ring.getBusSampleAt(pinIds, 0)).toBe(0x0);
    expect(ring.getBusSampleAt(pinIds, 10)).toBe(0xa);
    expect(formatBusSample(ring.getBusSampleAt(pinIds, 10), 'HEX', 4)).toBe('0xA');
    expect(formatBusSample(ring.getBusSampleAt(pinIds, 10), 'BIN', 4)).toBe('1010');
    expect(formatBusSample(ring.getBusSampleAt(pinIds, 10), 'DEC', 4)).toBe('10');
  });

  it('wraps around MAX_LA_HISTORY circularly while preserving chronological logical indices', () => {
    const pinId = 'clk';
    const total = MAX_LA_HISTORY + 50;

    for (let t = 1; t <= total; t++) {
      ring.recordFromPinStates(t, [pinId], { [pinId]: t % 2 === 0 ? 1 : 0 });
    }

    expect(ring.count).toBe(MAX_LA_HISTORY);
    expect(ring.getTickAt(0)).toBe(51);
    expect(ring.getTickAt(MAX_LA_HISTORY - 1)).toBe(total);
    expect(ring.getPinSampleAt(pinId, 0)).toBe(51 % 2 === 0 ? LA_VAL_1 : LA_VAL_0);
    expect(ring.getPinSampleAt('untracked', 0)).toBe(LA_VAL_Z);
  });

  it('discovers 4-bit counter Q[3:0] bus probes from circuit topology', () => {
    let state: circuit.CircuitState = { nodes: [], wires: [] };
    state = circuit.addNode(state, '74LS161', 100, 100);
    const [counter] = state.nodes;
    const pin = (name: string) =>
      counter.inputs.find((p) => p.name === name) ||
      counter.outputs.find((p) => p.name === name)!;

    // Connect QA..QD so they are recognized as active signals
    state = circuit.addNode(state, 'LED_BAR', 250, 100);
    const ledBar = state.nodes[1];
    state = circuit.addWire(state, counter.id, pin('QA').id, ledBar.id, ledBar.inputs[0].id);
    state = circuit.addWire(state, counter.id, pin('QB').id, ledBar.id, ledBar.inputs[1].id);
    state = circuit.addWire(state, counter.id, pin('QC').id, ledBar.id, ledBar.inputs[2].id);
    state = circuit.addWire(state, counter.id, pin('QD').id, ledBar.id, ledBar.inputs[3].id);

    const probes = discoverCircuitProbes(state.nodes, state.wires);
    const qBusProbe = probes.find((p) => p.name.endsWith('.Q[3:0]'));
    expect(qBusProbe).toBeDefined();
    expect(qBusProbe!.pinIds).toHaveLength(4);
  });
});
