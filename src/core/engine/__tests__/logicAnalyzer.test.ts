import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnalyzerRingBuffer,
  discoverCircuitProbes,
  evaluateBreakpointsFast,
  formatBusSample,
  LA_VAL_0,
  LA_VAL_1,
  LA_VAL_Z,
  MAX_LA_HISTORY,
} from '../logicAnalyzer';
import * as circuit from '../circuit';
import { computeNextStateBatch, SimulationState } from '../simulation';

describe('Logic Analyzer & Breakpoints Engine', () => {
  let ring: AnalyzerRingBuffer;

  beforeEach(() => {
    ring = new AnalyzerRingBuffer();
  });

  it('records single-bit and multi-bit bus samples in a circular ring buffer without allocation', () => {
    const pinIds = ['b3', 'b2', 'b1', 'b0'];
    const pinIdToIdx = new Map<string, number>([
      ['b3', 0],
      ['b2', 1],
      ['b1', 2],
      ['b0', 3],
    ]);

    for (let t = 1; t <= 16; t++) {
      const val = (t - 1) & 0x0f;
      const curBuf = [
        (val >> 3) & 1 ? 1 : 0,
        (val >> 2) & 1 ? 1 : 0,
        (val >> 1) & 1 ? 1 : 0,
        val & 1 ? 1 : 0,
      ] as const;
      ring.recordFromCompiledBuf(t, pinIds, pinIdToIdx, [...curBuf]);
    }

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
    const pinIdToIdx = new Map([['clk', 0]]);
    const total = MAX_LA_HISTORY + 50;

    for (let t = 1; t <= total; t++) {
      ring.recordFromCompiledBuf(t, [pinId], pinIdToIdx, [t % 2 === 0 ? 1 : 0]);
    }

    expect(ring.count).toBe(MAX_LA_HISTORY);
    expect(ring.getTickAt(0)).toBe(51);
    expect(ring.getTickAt(MAX_LA_HISTORY - 1)).toBe(total);
    expect(ring.getPinSampleAt(pinId, 0)).toBe(51 % 2 === 0 ? LA_VAL_1 : LA_VAL_0);
    expect(ring.getPinSampleAt('untracked', 0)).toBe(LA_VAL_Z);
  });

  it('stops batch simulation at the exact tick when a bus equality breakpoint triggers', () => {
    let state: circuit.CircuitState = { nodes: [], wires: [] };
    state = circuit.addNode(state, '74LS161', 100, 100);
    state = circuit.addNode(state, 'CLOCK', 20, 100);
    state = circuit.addNode(state, 'VCC', 20, 40);
    state = circuit.addNode(state, 'GND', 20, 160);

    const [counter, clk, vcc, gnd] = state.nodes;
    state = circuit.updateNodeProperties(state, clk.id, { interval: 1 });

    const pin = (name: string) =>
      counter.inputs.find(p => p.name === name) ||
      counter.outputs.find(p => p.name === name)!;

    // Power & enable 74LS161
    state = circuit.addWire(state, vcc.id, vcc.outputs[0].id, counter.id, pin('VCC').id);
    state = circuit.addWire(state, gnd.id, gnd.outputs[0].id, counter.id, pin('GND').id);
    state = circuit.addWire(state, vcc.id, vcc.outputs[0].id, counter.id, pin('~CLR').id);
    state = circuit.addWire(state, vcc.id, vcc.outputs[0].id, counter.id, pin('~LOAD').id);
    state = circuit.addWire(state, vcc.id, vcc.outputs[0].id, counter.id, pin('ENP').id);
    state = circuit.addWire(state, vcc.id, vcc.outputs[0].id, counter.id, pin('ENT').id);
    state = circuit.addWire(state, clk.id, clk.outputs[0].id, counter.id, pin('CLK').id);

    const probes = discoverCircuitProbes(state.nodes, state.wires);
    const qBusProbe = probes.find(p => p.name.endsWith('.Q[3:0]'));
    expect(qBusProbe).toBeDefined();

    const channels = [
      {
        id: 'ch-q',
        name: 'Q[3:0]',
        type: 'bus' as const,
        pinIds: qBusProbe!.pinIds,
        radix: 'HEX' as const,
      },
    ];

    const breakpoints = [
      {
        id: 'bp-q5',
        enabled: true,
        targetChannelId: 'ch-q',
        targetLabel: 'Q[3:0]',
        conditionType: 'equals' as const,
        value: '0x5',
        hitCount: 0,
      },
    ];

    const simState: SimulationState = {
      tickCount: 0,
      pinStates: {},
      wireStates: {},
      nodeStates: {},
    };

    let hitBpId: string | null = null;
    const res = computeNextStateBatch(
      state.nodes,
      state.wires,
      simState,
      {},
      100, // Request 100 ticks, but breakpoint should stop early when Q[3:0] == 5!
      50,
      (compiled, tickCount) => {
        ring.recordFromCompiledBuf(
          tickCount,
          qBusProbe!.pinIds,
          compiled.pinIdToIdx,
          compiled.curBuf
        );
        const hit = evaluateBreakpointsFast(
          breakpoints,
          channels,
          false,
          compiled.pinIdToIdx,
          compiled.curBuf,
          compiled.prevBuf
        );
        if (hit) {
          hitBpId = hit;
          return true;
        }
        return false;
      }
    );

    expect(res.stoppedByHook).toBe(true);
    expect(hitBpId).toBe('bp-q5');
    expect(res.ticksExecuted).toBeLessThan(60);
    // Verify the last recorded bus sample in the ring buffer is indeed 5
    expect(ring.getBusSampleAt(qBusProbe!.pinIds, ring.count - 1)).toBe(5);
  });

  it('auto-detects buses when signals or net labels contain [#] in their name', () => {
    let state: circuit.CircuitState = { nodes: [], wires: [] };
    // Add 4 INPUTs named A[0]..A[3]
    for (let i = 0; i < 4; i++) {
      state = circuit.addNode(state, 'INPUT', 0, i * 40);
      const node = state.nodes[state.nodes.length - 1];
      state = circuit.updateNodeProperties(state, node.id, { label: `A[${i}]` });
    }
    // Add 2 NET_LABELs named DATA[0], DATA[1]
    for (let i = 0; i < 2; i++) {
      state = circuit.addNode(state, 'NET_LABEL', 100, i * 40);
      const node = state.nodes[state.nodes.length - 1];
      state = circuit.updateNodeProperties(state, node.id, { label: `DATA[${i}]` });
    }
    // Add 2 INPUTs without brackets (e.g. IN_1, IN_2) — should NOT be grouped as a bus
    for (let i = 1; i <= 2; i++) {
      state = circuit.addNode(state, 'INPUT', 200, i * 40);
      const node = state.nodes[state.nodes.length - 1];
      state = circuit.updateNodeProperties(state, node.id, { label: `PLAIN${i}` });
    }

    const probes = discoverCircuitProbes(state.nodes, state.wires, []);
    const buses = probes.filter(p => p.type === 'bus');

    const aBus = buses.find(b => b.name === 'A[3:0]');
    const dataBus = buses.find(b => b.name === 'DATA[1:0]');
    const plainBus = buses.find(b => b.name.startsWith('PLAIN'));

    expect(aBus).toBeDefined();
    expect(aBus?.pinIds.length).toBe(4);
    // Verify MSB-to-LSB order: A[3] is index 0, A[0] is index 3
    expect(aBus?.pinIds[0]).toBe(state.nodes[3].outputs[0].id);
    expect(aBus?.pinIds[3]).toBe(state.nodes[0].outputs[0].id);

    expect(dataBus).toBeDefined();
    expect(dataBus?.pinIds.length).toBe(2);
    expect(plainBus).toBeUndefined();
  });
});
