import { invoke } from '@tauri-apps/api/core';
import { LogicNode, Signal, Wire } from '../models/types';
import { flattenCircuit, SimulationState } from './simulation';
import { AnalyzerChannel, BreakpointRule, globalAnalyzerBuffer } from './logicAnalyzer';

export interface RustStepResult {
  tickCount: number;
  pinStates: number[];
  elapsedUs: number;
  triggeredBreakpointId: string | null;
  triggeredTick: number;
  analyzerTicks: number[];
  analyzerSamples: number[];
  selectedMemory: number[] | null;
}

export interface RustBatchOutput {
  state: SimulationState;
  triggeredBreakpointId: string | null;
  triggeredTick: number;
}

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let cachedRustPinIds: string[] = [];
let lastCompiledNodesRef: LogicNode[] | null = null;
let lastCompiledWiresRef: Wire[] | null = null;
let lastCompiledSavedRef: Record<string, { nodes: LogicNode[]; wires: Wire[] }> | null = null;
let lastKeypadSig = '';
let preserveStateOnNextCompile = false;
let compilePromise: Promise<string[]> | null = null;
let lastStepElapsedUs = 0;

let lastRawPinStates: Uint8Array | null = null;
let lastWiresForStatesRef: Wire[] | null = null;
let wiresBySourcePinMap = new Map<string, string[]>();
const changedIdxScratch: number[] = [];

function getWiresBySourcePin(wires: Wire[]): Map<string, string[]> {
  if (wires !== lastWiresForStatesRef) {
    wiresBySourcePinMap = new Map<string, string[]>();
    for (let i = 0; i < wires.length; i++) {
      const w = wires[i];
      let list = wiresBySourcePinMap.get(w.sourcePinId);
      if (!list) {
        list = [w.id];
        wiresBySourcePinMap.set(w.sourcePinId, list);
      } else {
        list.push(w.id);
      }
    }
  }
  return wiresBySourcePinMap;
}

function decodeSignalCode(code: number): Signal {
  if (code === 0) return 0;
  if (code === 1) return 1;
  if (code === 3) return 'X';
  return undefined;
}

function getKeypadSig(nodes: LogicNode[]): string {
  let sig = '';
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].type === 'KEYPAD') {
      sig += `${nodes[i].id}:${nodes[i].properties?.pressedKey ?? ''};`;
    }
  }
  return sig;
}

function isSameRootNodeTopology(prevNodes: LogicNode[], nextNodes: LogicNode[]): boolean {
  if (prevNodes.length !== nextNodes.length) return false;
  for (let i = 0; i < prevNodes.length; i++) {
    const a = prevNodes[i];
    const b = nextNodes[i];
    if (a === b) continue;
    if (a.id !== b.id || a.type !== b.type) return false;
    if (a.inputs.length !== b.inputs.length || a.outputs.length !== b.outputs.length) return false;
    for (let p = 0; p < a.inputs.length; p++) {
      if (a.inputs[p].id !== b.inputs[p].id) return false;
    }
    for (let p = 0; p < a.outputs.length; p++) {
      if (a.outputs[p].id !== b.outputs[p].id) return false;
    }
    if (
      (a.type === 'NET_LABEL' || a.type === 'BUS_BREAKOUT') &&
      a.properties?.label !== b.properties?.label
    ) {
      return false;
    }
  }
  return true;
}

export function getLastRustStepElapsedUs(): number {
  return lastStepElapsedUs;
}

export function invalidateRustCircuitCache(preserveState: boolean = false): void {
  lastCompiledNodesRef = null;
  lastCompiledWiresRef = null;
  lastCompiledSavedRef = null;
  lastKeypadSig = '';
  lastRawPinStates = null;
  lastWiresForStatesRef = null;
  preserveStateOnNextCompile = preserveState;
}

export async function ensureRustCircuitCompiled(
  nodes: LogicNode[],
  wires: Wire[],
  savedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }> = {}
): Promise<string[]> {
  const keypadSig = getKeypadSig(nodes);
  if (
    lastCompiledNodesRef &&
    wires === lastCompiledWiresRef &&
    savedCircuits === lastCompiledSavedRef &&
    keypadSig === lastKeypadSig &&
    isSameRootNodeTopology(lastCompiledNodesRef, nodes) &&
    cachedRustPinIds.length > 0
  ) {
    lastCompiledNodesRef = nodes;
    return cachedRustPinIds;
  }

  const preserveState =
    preserveStateOnNextCompile ||
    (lastCompiledNodesRef !== null && keypadSig !== lastKeypadSig);
  preserveStateOnNextCompile = false;

  const flat = flattenCircuit(nodes, wires, savedCircuits);
  lastCompiledNodesRef = nodes;
  lastCompiledWiresRef = wires;
  lastCompiledSavedRef = savedCircuits;
  lastKeypadSig = keypadSig;

  compilePromise = invoke<string[]>('rust_compile_circuit', {
    nodes: flat.nodes,
    wires: flat.wires,
    preserveState,
  }).then((pinIds) => {
    cachedRustPinIds = pinIds;
    lastRawPinStates = null;
    compilePromise = null;
    return pinIds;
  });

  return compilePromise;
}

export async function syncRustNodeInput(
  nodeId: string,
  props: Record<string, any>
): Promise<void> {
  if (!isTauriEnvironment()) return;
  if ('pressedKey' in props || 'label' in props) {
    invalidateRustCircuitCache(true);
    return;
  }
  try {
    await invoke('rust_update_node_input', { nodeId, props });
  } catch {
    // Ignore if circuit not yet compiled
  }
}

export async function stepRustSimulationBatch(
  nodes: LogicNode[],
  wires: Wire[],
  savedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }>,
  ticks: number,
  prevSimState: SimulationState,
  trackedPinIds: string[] = [],
  breakpoints: BreakpointRule[] = [],
  channels: AnalyzerChannel[] = [],
  trapShortCircuit: boolean = false,
  selectedMemoryNodeId: string | null = null
): Promise<RustBatchOutput> {
  if (compilePromise) {
    await compilePromise;
  } else {
    await ensureRustCircuitCompiled(nodes, wires, savedCircuits);
  }

  const res = await invoke<RustStepResult>('rust_step_batch', {
    ticks: Math.max(1, Math.floor(ticks)),
    trackedPinIds,
    breakpoints,
    channels,
    trapShortCircuit,
    selectedMemoryNodeId,
  });

  lastStepElapsedUs = res.elapsedUs;

  const rawStates = res.pinStates;
  const len = Math.min(cachedRustPinIds.length, rawStates.length);
  const canDiff =
    lastRawPinStates !== null &&
    lastRawPinStates.length === len &&
    prevSimState.tickCount > 0;

  let pinStates: Record<string, Signal>;
  let wireStates: Record<string, Signal>;

  if (canDiff && lastRawPinStates) {
    changedIdxScratch.length = 0;
    for (let i = 0; i < len; i++) {
      const code = rawStates[i];
      if (code !== lastRawPinStates[i]) {
        lastRawPinStates[i] = code;
        changedIdxScratch.push(i);
      }
    }

    const changedCount = changedIdxScratch.length;
    if (changedCount === 0 && wires === lastWiresForStatesRef) {
      pinStates = prevSimState.pinStates;
      wireStates = prevSimState.wireStates;
    } else if (changedCount <= (len >> 2) && wires === lastWiresForStatesRef) {
      const sourcePinMap = getWiresBySourcePin(wires);
      pinStates = { ...prevSimState.pinStates };
      let wireStatesCloned = false;
      wireStates = prevSimState.wireStates;

      for (let c = 0; c < changedCount; c++) {
        const idx = changedIdxScratch[c];
        const pid = cachedRustPinIds[idx];
        const sig = decodeSignalCode(rawStates[idx]);
        pinStates[pid] = sig;

        const wIds = sourcePinMap.get(pid);
        if (wIds) {
          if (!wireStatesCloned) {
            wireStates = { ...prevSimState.wireStates };
            wireStatesCloned = true;
          }
          for (let w = 0; w < wIds.length; w++) {
            wireStates[wIds[w]] = sig;
          }
        }
      }
    } else {
      pinStates = {};
      for (let i = 0; i < len; i++) {
        pinStates[cachedRustPinIds[i]] = decodeSignalCode(rawStates[i]);
      }
      getWiresBySourcePin(wires);
      lastWiresForStatesRef = wires;
      wireStates = {};
      for (let i = 0; i < wires.length; i++) {
        const w = wires[i];
        wireStates[w.id] = pinStates[w.sourcePinId];
      }
    }
  } else {
    lastRawPinStates = new Uint8Array(len);
    pinStates = {};
    for (let i = 0; i < len; i++) {
      const code = rawStates[i];
      lastRawPinStates[i] = code;
      pinStates[cachedRustPinIds[i]] = decodeSignalCode(code);
    }
    getWiresBySourcePin(wires);
    lastWiresForStatesRef = wires;
    wireStates = {};
    for (let i = 0; i < wires.length; i++) {
      const w = wires[i];
      wireStates[w.id] = pinStates[w.sourcePinId];
    }
  }

  let nodeStates = prevSimState.nodeStates;
  if (selectedMemoryNodeId && res.selectedMemory) {
    const prevMem: Uint8Array | undefined = prevSimState.nodeStates?.[selectedMemoryNodeId]?.memory;
    const rawMem = res.selectedMemory;
    let memChanged = !prevMem || prevMem.length !== rawMem.length;
    if (!memChanged && prevMem) {
      for (let i = 0; i < rawMem.length; i++) {
        if (prevMem[i] !== rawMem[i]) {
          memChanged = true;
          break;
        }
      }
    }
    if (memChanged) {
      nodeStates = {
        ...(prevSimState.nodeStates || {}),
        [selectedMemoryNodeId]: {
          ...(prevSimState.nodeStates?.[selectedMemoryNodeId] || {}),
          memory: new Uint8Array(rawMem),
        },
      };
    }
  }

  if (trackedPinIds.length > 0 && res.analyzerTicks.length > 0) {
    globalAnalyzerBuffer.recordBatchFromRust(
      res.analyzerTicks,
      res.analyzerSamples,
      trackedPinIds
    );
  }

  return {
    state: {
      tickCount: res.tickCount,
      pinStates,
      wireStates,
      nodeStates,
    },
    triggeredBreakpointId: res.triggeredBreakpointId,
    triggeredTick: res.triggeredTick,
  };
}
