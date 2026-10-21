import { LogicNode, Signal, Wire } from '../models/types';
import { getNodeDefinition } from './nodes';

export type BusRadix = 'HEX' | 'DEC' | 'BIN';

export type BreakpointCondition =
  | 'equals'
  | 'rising'
  | 'falling'
  | 'high'
  | 'low'
  | 'short_circuit';

export interface AnalyzerChannel {
  id: string;
  name: string;
  type: 'wire' | 'bus';
  /**
   * For 'wire', pinIds has length 1.
   * For 'bus', pinIds is ordered from MSB to LSB (e.g. [D7, D6, ..., D0]).
   */
  pinIds: string[];
  radix?: BusRadix;
  expanded?: boolean;
}

export interface BreakpointRule {
  id: string;
  enabled: boolean;
  /** Channel ID or special '__ANY_NET__' for global short-circuit detection */
  targetChannelId: string;
  targetLabel: string;
  conditionType: BreakpointCondition;
  /** Target value string for 'equals', e.g. '0x010E', '0b1010', or '42' */
  value?: string;
  hitCount: number;
  lastHitTick?: number;
}

/**
 * Compact 1-byte encoding inside AnalyzerRingBuffer:
 * 0 = LOW (0)
 * 1 = HIGH (1)
 * 2 = High-Z (undefined)
 * 3 = Conflict ('X')
 */
export const LA_VAL_0 = 0;
export const LA_VAL_1 = 1;
export const LA_VAL_Z = 2;
export const LA_VAL_X = 3;

export const MAX_LA_HISTORY = 1024;

export function encodeSignalByte(sig: Signal): number {
  return sig === 0 ? LA_VAL_0 : sig === 1 ? LA_VAL_1 : sig === 'X' ? LA_VAL_X : LA_VAL_Z;
}

export class AnalyzerRingBuffer {
  /** Absolute tick number for each slot in the circular buffer */
  public ticks = new Int32Array(MAX_LA_HISTORY);
  /** Per-pin circular sample storage: pinId -> Uint8Array(MAX_LA_HISTORY) */
  public pinBuffers = new Map<string, Uint8Array>();
  /** Current write head (0 .. MAX_LA_HISTORY - 1) */
  public head = 0;
  /** Number of valid recorded ticks (0 .. MAX_LA_HISTORY) */
  public count = 0;
  /** Monotonic version counter incremented on changes for fast UI polling */
  public version = 0;

  public clear(): void {
    this.head = 0;
    this.count = 0;
    this.pinBuffers.clear();
    this.version++;
  }

  public ensurePinBuffer(pinId: string): Uint8Array {
    let buf = this.pinBuffers.get(pinId);
    if (!buf) {
      buf = new Uint8Array(MAX_LA_HISTORY);
      buf.fill(LA_VAL_Z);
      this.pinBuffers.set(pinId, buf);
    }
    return buf;
  }

  private advanceSlot(tickCount: number): number {
    let slot: number;
    if (this.count > 0) {
      const lastSlot = (this.head - 1 + MAX_LA_HISTORY) % MAX_LA_HISTORY;
      if (this.ticks[lastSlot] === tickCount) {
        slot = lastSlot;
      } else {
        slot = this.head;
        this.head = (this.head + 1) % MAX_LA_HISTORY;
        if (this.count < MAX_LA_HISTORY) this.count++;
      }
    } else {
      slot = this.head;
      this.head = (this.head + 1) % MAX_LA_HISTORY;
      this.count = 1;
    }
    this.ticks[slot] = tickCount;
    return slot;
  }

  /**
   * Zero-allocation tick recording directly from CompiledCircuit.curBuf (Signal[]).
   */
  public recordFromCompiledBuf(
    tickCount: number,
    trackedPinIds: string[],
    pinIdToIdx: Map<string, number>,
    curBuf: Signal[]
  ): void {
    if (trackedPinIds.length === 0) return;

    const slot = this.advanceSlot(tickCount);

    for (let i = 0; i < trackedPinIds.length; i++) {
      const pinId = trackedPinIds[i];
      const buf = this.ensurePinBuffer(pinId);
      const idx = pinIdToIdx.get(pinId);
      const sig = idx !== undefined ? curBuf[idx] : undefined;
      buf[slot] = encodeSignalByte(sig);
    }

    this.version++;
  }

  public recordFromPinStates(
    tickCount: number,
    trackedPinIds: string[],
    pinStates: Record<string, Signal>
  ): void {
    if (trackedPinIds.length === 0) return;

    const slot = this.advanceSlot(tickCount);

    for (let i = 0; i < trackedPinIds.length; i++) {
      const pinId = trackedPinIds[i];
      const buf = this.ensurePinBuffer(pinId);
      buf[slot] = encodeSignalByte(pinStates[pinId]);
    }

    this.version++;
  }

  /**
   * Converts logical index (0 = oldest sample, count - 1 = newest sample) to physical ring slot.
   */
  public getPhysicalSlot(logicalIndex: number): number {
    if (this.count < MAX_LA_HISTORY) {
      return logicalIndex;
    }
    return (this.head + logicalIndex) % MAX_LA_HISTORY;
  }

  public getTickAt(logicalIndex: number): number {
    if (logicalIndex < 0 || logicalIndex >= this.count) return 0;
    return this.ticks[this.getPhysicalSlot(logicalIndex)];
  }

  public getPinSampleAt(pinId: string, logicalIndex: number): number {
    if (logicalIndex < 0 || logicalIndex >= this.count) return LA_VAL_Z;
    const buf = this.pinBuffers.get(pinId);
    if (!buf) return LA_VAL_Z;
    return buf[this.getPhysicalSlot(logicalIndex)];
  }

  /**
   * Computes a multi-bit bus sample at `logicalIndex`.
   * Returns:
   *  - >= 0: unsigned integer value
   *  - -1: High-Z (all bits floating or any bit floating)
   *  - -2: Conflict ('X' on at least one bit)
   */
  public getBusSampleAt(pinIds: string[], logicalIndex: number): number {
    if (logicalIndex < 0 || logicalIndex >= this.count || pinIds.length === 0) return -1;
    const slot = this.getPhysicalSlot(logicalIndex);
    let val = 0;
    let anyZ = false;

    for (let i = 0; i < pinIds.length; i++) {
      const buf = this.pinBuffers.get(pinIds[i]);
      const bit = buf ? buf[slot] : LA_VAL_Z;
      if (bit === LA_VAL_X) return -2;
      if (bit === LA_VAL_Z) anyZ = true;
      val = (val << 1) | (bit === LA_VAL_1 ? 1 : 0);
    }

    return anyZ ? -1 : val >>> 0;
  }
}

export const globalAnalyzerBuffer = new AnalyzerRingBuffer();

const targetNumCache = new Map<string, number | null>();

export function parseTargetNumber(raw?: string): number | null {
  if (!raw) return null;
  const cached = targetNumCache.get(raw);
  if (cached !== undefined) return cached;

  const s = raw.trim().replace(/_/g, '');
  let res: number | null = null;
  if (s) {
    if (/^0x[0-9a-f]+$/i.test(s)) res = parseInt(s.slice(2), 16);
    else if (/^0b[01]+$/i.test(s)) res = parseInt(s.slice(2), 2);
    else if (/^\d+$/.test(s)) res = parseInt(s, 10);
    else if (/^[0-9a-f]+$/i.test(s)) res = parseInt(s, 16);
  }
  if (targetNumCache.size > 128) targetNumCache.clear();
  targetNumCache.set(raw, res);
  return res;
}

let cachedChannelsRef: AnalyzerChannel[] | null = null;
let cachedChannelById = new Map<string, AnalyzerChannel>();

function getChannelById(channels: AnalyzerChannel[], id: string): AnalyzerChannel | undefined {
  if (channels !== cachedChannelsRef) {
    cachedChannelsRef = channels;
    cachedChannelById = new Map();
    for (let i = 0; i < channels.length; i++) {
      cachedChannelById.set(channels[i].id, channels[i]);
    }
  }
  return cachedChannelById.get(id);
}

export function formatBusSample(
  sample: number,
  radix: BusRadix = 'HEX',
  bitWidth: number = 8
): string {
  if (sample === -1) return 'Z';
  if (sample === -2) return 'X';
  if (radix === 'DEC') return sample.toString(10);
  if (radix === 'BIN') return sample.toString(2).padStart(Math.min(bitWidth, 8), '0');
  const hexDigits = Math.max(1, Math.ceil(bitWidth / 4));
  return '0x' + sample.toString(16).toUpperCase().padStart(hexDigits, '0');
}

/**
 * Evaluates active breakpoints on a single tick directly against CompiledCircuit.curBuf and prevBuf.
 * Returns the ID of the first triggered breakpoint, or '__TRAP_SHORT__' if trapShortCircuit fired, or null.
 */
export function evaluateBreakpointsFast(
  breakpoints: BreakpointRule[],
  channels: AnalyzerChannel[],
  trapShortCircuit: boolean,
  pinIdToIdx: Map<string, number>,
  curBuf: Signal[],
  prevBuf: Signal[]
): string | null {
  const totalPins = curBuf.length;

  if (trapShortCircuit) {
    for (let i = 0; i < totalPins; i++) {
      if (curBuf[i] === 'X' && prevBuf[i] !== 'X') {
        return '__TRAP_SHORT__';
      }
    }
  }

  for (let i = 0; i < breakpoints.length; i++) {
    const bp = breakpoints[i];
    if (!bp.enabled) continue;

    if (bp.conditionType === 'short_circuit') {
      if (bp.targetChannelId === '__ANY_NET__') {
        for (let p = 0; p < totalPins; p++) {
          if (curBuf[p] === 'X' && prevBuf[p] !== 'X') {
            return bp.id;
          }
        }
      } else {
        const ch = getChannelById(channels, bp.targetChannelId);
        if (ch) {
          for (let k = 0; k < ch.pinIds.length; k++) {
            const idx = pinIdToIdx.get(ch.pinIds[k]);
            if (idx !== undefined && curBuf[idx] === 'X' && prevBuf[idx] !== 'X') {
              return bp.id;
            }
          }
        }
      }
      continue;
    }

    const ch = getChannelById(channels, bp.targetChannelId);
    if (!ch || ch.pinIds.length === 0) continue;

    if (bp.conditionType === 'rising') {
      const idx = pinIdToIdx.get(ch.pinIds[ch.pinIds.length - 1]);
      if (idx !== undefined && prevBuf[idx] === 0 && curBuf[idx] === 1) {
        return bp.id;
      }
    } else if (bp.conditionType === 'falling') {
      const idx = pinIdToIdx.get(ch.pinIds[ch.pinIds.length - 1]);
      if (idx !== undefined && prevBuf[idx] === 1 && curBuf[idx] === 0) {
        return bp.id;
      }
    } else if (bp.conditionType === 'high') {
      const idx = pinIdToIdx.get(ch.pinIds[ch.pinIds.length - 1]);
      if (idx !== undefined && curBuf[idx] === 1 && prevBuf[idx] !== 1) {
        return bp.id;
      }
    } else if (bp.conditionType === 'low') {
      const idx = pinIdToIdx.get(ch.pinIds[ch.pinIds.length - 1]);
      if (idx !== undefined && curBuf[idx] === 0 && prevBuf[idx] !== 0) {
        return bp.id;
      }
    } else if (bp.conditionType === 'equals') {
      const targetNum = parseTargetNumber(bp.value);
      if (targetNum === null) continue;

      let curVal = 0;
      let prevVal = 0;
      let validCur = true;
      let validPrev = true;

      for (let k = 0; k < ch.pinIds.length; k++) {
        const idx = pinIdToIdx.get(ch.pinIds[k]);
        if (idx === undefined) {
          validCur = false;
          break;
        }
        const cBit = curBuf[idx];
        const pBit = prevBuf[idx];
        if (cBit !== 0 && cBit !== 1) {
          validCur = false;
          break;
        }
        if (pBit !== 0 && pBit !== 1) {
          validPrev = false;
        }
        curVal = (curVal << 1) | cBit;
        prevVal = (prevVal << 1) | (pBit === 1 ? 1 : 0);
      }

      if (validCur && (curVal >>> 0) === (targetNum >>> 0)) {
        if (!validPrev || (prevVal >>> 0) !== (targetNum >>> 0)) {
          return bp.id;
        }
      }
    }
  }

  return null;
}

export interface DiscoverableProbe {
  name: string;
  category: 'Selected' | 'Signals & Clocks' | 'Net Labels' | 'Buses & ICs';
  type: 'wire' | 'bus';
  pinIds: string[];
  radix?: BusRadix;
}

/**
 * Discovers meaningful signals, net labels, and multi-bit buses from the current circuit
 * so the user can add them to the Logic Analyzer in 1 click.
 */
export function discoverCircuitProbes(
  nodes: LogicNode[],
  _wires: Wire[],
  selectedIds: string[] = []
): DiscoverableProbe[] {
  const result: DiscoverableProbe[] = [];
  const selectedSet = new Set(selectedIds);
  const bracketBitRegex = /^(.+?)\[(\d+)\](.*)$/;

  // Helper to group bracket-indexed signals (e.g. A[0], A[1], D[7]) into buses
  const buildBracketBuses = (
    items: { label: string; pinId: string }[],
    category: DiscoverableProbe['category'],
    seenBusNames: Set<string>
  ) => {
    const groups = new Map<string, { prefix: string; suffix: string; bits: Map<number, string> }>();
    for (const item of items) {
      const m = item.label.trim().match(bracketBitRegex);
      if (!m) continue;
      const prefix = m[1].trim();
      const bit = parseInt(m[2], 10);
      const suffix = m[3].trim();
      const key = `${prefix}__${suffix}`;
      let grp = groups.get(key);
      if (!grp) {
        grp = { prefix, suffix, bits: new Map() };
        groups.set(key, grp);
      }
      if (!grp.bits.has(bit)) {
        grp.bits.set(bit, item.pinId);
      }
    }

    for (const grp of groups.values()) {
      if (grp.bits.size >= 2) {
        const sorted = Array.from(grp.bits.entries()).sort((a, b) => b[0] - a[0]); // MSB to LSB
        const maxBit = sorted[0][0];
        const minBit = sorted[sorted.length - 1][0];
        const busName = `${grp.prefix}[${maxBit}:${minBit}]${grp.suffix}`;
        if (!seenBusNames.has(busName)) {
          seenBusNames.add(busName);
          result.push({
            name: busName,
            category,
            type: 'bus',
            pinIds: sorted.map(e => e[1]),
            radix: 'HEX',
          });
        }
      }
    }
  };

  // 1. Selected nodes on the canvas (highest priority)
  const selectedBracketItems: { label: string; pinId: string }[] = [];
  const seenSelectedBuses = new Set<string>();

  for (const node of nodes) {
    if (!selectedSet.has(node.id)) continue;
    const lbl = String(node.properties?.label || '').trim();
    if (lbl) {
      const pinId =
        node.type === 'OUTPUT' || node.type === 'NET_LABEL'
          ? node.inputs[0]?.id
          : node.outputs[0]?.id;
      if (pinId) {
        selectedBracketItems.push({ label: lbl, pinId });
      }
    }
  }
  buildBracketBuses(selectedBracketItems, 'Selected', seenSelectedBuses);

  for (const node of nodes) {
    if (!selectedSet.has(node.id)) continue;
    const def = getNodeDefinition(node.type);
    const baseName = node.properties?.label || def?.label || node.type;

    if (node.type === 'DIP_SWITCH' && node.outputs.length > 1) {
      const cleanName = baseName.replace(/\[.*$/, '').trim() || 'SW';
      result.push({
        name: `${cleanName}[${node.outputs.length - 1}:0]`,
        category: 'Selected',
        type: 'bus',
        pinIds: [...node.outputs].reverse().map(p => p.id),
        radix: 'HEX',
      });
    } else if (node.type === 'LED_BAR' && node.inputs.length > 1) {
      const cleanName = baseName.replace(/\[.*$/, '').trim() || 'LED';
      result.push({
        name: `${cleanName}[${node.inputs.length - 1}:0]`,
        category: 'Selected',
        type: 'bus',
        pinIds: [...node.inputs].reverse().map(p => p.id),
        radix: 'HEX',
      });
    } else if (node.type === 'BUS_BREAKOUT' && node.inputs.length > 1) {
      const bitPins = node.inputs.filter(p => /^\d+$/.test(p.name || ''));
      if (bitPins.length > 1) {
        const cleanName = baseName.replace(/\[.*$/, '').trim() || 'BUS';
        result.push({
          name: `${cleanName}[${bitPins.length - 1}:0]`,
          category: 'Selected',
          type: 'bus',
          pinIds: [...bitPins].reverse().map(p => p.id),
          radix: 'HEX',
        });
      }
    }

    const allPins = [...node.inputs, ...node.outputs];
    const seenPinIds = new Set<string>();
    for (const p of allPins) {
      if (
        seenPinIds.has(p.id) ||
        p.name === 'VCC' ||
        p.name === 'GND' ||
        (node.type === 'BUS_BREAKOUT' && p.name === 'BUS')
      ) {
        continue;
      }
      seenPinIds.add(p.id);
      const pinLabel =
        node.type === 'NET_LABEL' || node.type === 'INPUT' || node.type === 'OUTPUT' || node.type === 'CLOCK'
          ? baseName
          : p.name
          ? `${baseName}.${p.name}`
          : baseName;
      result.push({
        name: pinLabel,
        category: 'Selected',
        type: 'wire',
        pinIds: [p.id],
      });
    }
  }

  // 2. Collect Clocks, Inputs, Outputs, and Net Labels
  const signalProbes: DiscoverableProbe[] = [];
  const netLabelProbes: DiscoverableProbe[] = [];
  const bracketCandidates: { label: string; pinId: string }[] = [];

  let clkCount = 0;
  let inCount = 0;
  let outCount = 0;
  for (const node of nodes) {
    if (node.type === 'CLOCK' && node.outputs[0]) {
      clkCount++;
      const name = String(node.properties?.label || (clkCount === 1 ? 'CLK' : `CLK_${clkCount}`)).trim();
      signalProbes.push({
        name,
        category: 'Signals & Clocks',
        type: 'wire',
        pinIds: [node.outputs[0].id],
      });
      bracketCandidates.push({ label: name, pinId: node.outputs[0].id });
    } else if (node.type === 'INPUT' && node.outputs[0]) {
      inCount++;
      const name = String(node.properties?.label || `IN_${inCount}`).trim();
      signalProbes.push({
        name,
        category: 'Signals & Clocks',
        type: 'wire',
        pinIds: [node.outputs[0].id],
      });
      bracketCandidates.push({ label: name, pinId: node.outputs[0].id });
    } else if (node.type === 'OUTPUT' && node.inputs[0]) {
      outCount++;
      const name = String(node.properties?.label || `OUT_${outCount}`).trim();
      signalProbes.push({
        name,
        category: 'Signals & Clocks',
        type: 'wire',
        pinIds: [node.inputs[0].id],
      });
      bracketCandidates.push({ label: name, pinId: node.inputs[0].id });
    }
  }

  const netLabelMap = new Map<string, string>();
  for (const node of nodes) {
    if (node.type === 'NET_LABEL' && node.inputs[0]) {
      const lbl = String(node.properties?.label || 'NET').trim();
      if (lbl && !netLabelMap.has(lbl)) {
        netLabelMap.set(lbl, node.inputs[0].id);
        bracketCandidates.push({ label: lbl, pinId: node.inputs[0].id });
      }
    }
  }

  for (const [lbl, pinId] of netLabelMap.entries()) {
    netLabelProbes.push({
      name: lbl,
      category: 'Net Labels',
      type: 'wire',
      pinIds: [pinId],
    });
  }

  // 3. Auto-detect Buses from signals with [#] in their name (e.g. A[0]..A[7], D[0]..D[3])
  const seenBusNames = new Set<string>();
  buildBracketBuses(bracketCandidates, 'Buses & ICs', seenBusNames);

  // 4. Multi-bit Buses & ICs (Counters, Registers, Memory, DIP Switches, LED Bars, Bus Breakouts)
  for (const node of nodes) {
    const def = getNodeDefinition(node.type);
    const label = String(node.properties?.label || node.type).trim();

    if (node.type === 'DIP_SWITCH' && node.outputs.length > 1) {
      const cleanName = label.replace(/\[.*$/, '').trim() || 'SW';
      const busName = `${cleanName}[${node.outputs.length - 1}:0]`;
      if (!seenBusNames.has(busName)) {
        seenBusNames.add(busName);
        result.push({
          name: busName,
          category: 'Buses & ICs',
          type: 'bus',
          pinIds: [...node.outputs].reverse().map(p => p.id),
          radix: 'HEX',
        });
      }
    } else if (node.type === 'LED_BAR' && node.inputs.length > 1) {
      const cleanName = label.replace(/\[.*$/, '').trim() || 'LED';
      const busName = `${cleanName}[${node.inputs.length - 1}:0]`;
      if (!seenBusNames.has(busName)) {
        seenBusNames.add(busName);
        result.push({
          name: busName,
          category: 'Buses & ICs',
          type: 'bus',
          pinIds: [...node.inputs].reverse().map(p => p.id),
          radix: 'HEX',
        });
      }
    } else if (node.type === 'BUS_BREAKOUT' && node.inputs.length > 1) {
      const bitPins = node.inputs.filter(p => /^\d+$/.test(p.name || ''));
      if (bitPins.length > 1) {
        const cleanName = label.replace(/\[.*$/, '').trim() || 'BUS';
        const busName = `${cleanName}[${bitPins.length - 1}:0]`;
        if (!seenBusNames.has(busName)) {
          seenBusNames.add(busName);
          result.push({
            name: busName,
            category: 'Buses & ICs',
            type: 'bus',
            pinIds: [...bitPins].reverse().map(p => p.id),
            radix: 'HEX',
          });
        }
      }
    } else if (node.type === '74LS161' || node.type === '74LS191' || node.type === '74LS173' || node.type === '74LS175') {
      const qPins = (
        ['QD', 'QC', 'QB', 'QA'].every(name => node.outputs.some(p => p.name === name))
          ? ['QD', 'QC', 'QB', 'QA']
          : ['Q3', 'Q2', 'Q1', 'Q0']
      )
        .map(name => node.outputs.find(p => p.name === name)?.id)
        .filter((id): id is string => !!id);
      if (qPins.length === 4) {
        result.push({
          name: `${label}.Q[3:0]`,
          category: 'Buses & ICs',
          type: 'bus',
          pinIds: qPins,
          radix: 'HEX',
        });
      }
    } else if (node.type === '74LS273' || node.type === '74LS373' || node.type === '74LS374') {
      const qPins = (
        ['8Q', '7Q', '6Q', '5Q', '4Q', '3Q', '2Q', '1Q'].every(name =>
          node.outputs.some(p => p.name === name)
        )
          ? ['8Q', '7Q', '6Q', '5Q', '4Q', '3Q', '2Q', '1Q']
          : ['Q7', 'Q6', 'Q5', 'Q4', 'Q3', 'Q2', 'Q1', 'Q0']
      )
        .map(name => node.outputs.find(p => p.name === name)?.id)
        .filter((id): id is string => !!id);
      if (qPins.length === 8) {
        result.push({
          name: `${label}.Q[7:0]`,
          category: 'Buses & ICs',
          type: 'bus',
          pinIds: qPins,
          radix: 'HEX',
        });
      }
    } else if (def?.memorySize) {
      const dataPins = ['IO7', 'IO6', 'IO5', 'IO4', 'IO3', 'IO2', 'IO1', 'IO0', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0']
        .map(name => node.outputs.find(p => p.name === name)?.id)
        .filter((id): id is string => !!id)
        .slice(0, 8);
      if (dataPins.length === 8) {
        result.push({
          name: `${label}.DATA[7:0]`,
          category: 'Buses & ICs',
          type: 'bus',
          pinIds: dataPins,
          radix: 'HEX',
        });
      }
    }
  }

  // Append individual Signals & Clocks and Net Labels
  result.push(...signalProbes, ...netLabelProbes);

  return result;
}
