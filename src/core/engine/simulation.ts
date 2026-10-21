import { LogicNode, Wire, Signal } from '../models/types';
import { getNodeDefinition } from './nodes';
import { NodeDefinition } from './nodes/NodeDefinition';

const MAX_SUBCIRCUIT_DEPTH = 16;

export const flattenCircuit = (
  rootNodes: LogicNode[],
  rootWires: Wire[],
  savedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }>,
  prefix: string = '',
  visitedSubIds: Set<string> = new Set(),
  depth: number = 0
): { nodes: LogicNode[]; wires: Wire[] } => {
  if (prefix === '' && !rootNodes.some((n) => n.type.startsWith('SUBCIRCUIT:'))) {
    return { nodes: rootNodes, wires: rootWires };
  }

  let flatNodes: LogicNode[] = [];
  let flatWires: Wire[] =
    prefix === ''
      ? [...rootWires]
      : rootWires.map((w) => ({
          ...w,
          id: `${prefix}${w.id}`,
          sourceNodeId: `${prefix}${w.sourceNodeId}`,
          sourcePinId: `${prefix}${w.sourcePinId}`,
          targetNodeId: `${prefix}${w.targetNodeId}`,
          targetPinId: `${prefix}${w.targetPinId}`,
        }));

  rootNodes.forEach((node) => {
    if (node.type.startsWith('SUBCIRCUIT:')) {
      const subId = node.type.split(':')[1];
      const sub = savedCircuits[subId];
      if (sub && !visitedSubIds.has(subId) && depth < MAX_SUBCIRCUIT_DEPTH) {
        const subPrefix = `${prefix}${node.id}_`;
        const nextVisited = new Set(visitedSubIds);
        nextVisited.add(subId);

        const flattened = flattenCircuit(
          sub.nodes,
          sub.wires,
          savedCircuits,
          subPrefix,
          nextVisited,
          depth + 1
        );
        flatNodes.push(...flattened.nodes);
        flatWires.push(...flattened.wires);

        const subNodeById = new Map<string, LogicNode>();
        for (let i = 0; i < sub.nodes.length; i++) {
          subNodeById.set(sub.nodes[i].id, sub.nodes[i]);
        }

        node.inputs.forEach((chipPin) => {
          const internalNode = chipPin.internalNodeId ? subNodeById.get(chipPin.internalNodeId) : undefined;
          if (internalNode) {
            const internalPin = internalNode.outputs[0] || internalNode.inputs[0];
            if (internalPin) {
              flatWires.push({
                id: `vw_subin_${prefix}${chipPin.id}`,
                sourceNodeId: `${prefix}${node.id}`,
                sourcePinId: `${prefix}${chipPin.id}`,
                targetNodeId: `${subPrefix}${internalNode.id}`,
                targetPinId: `${subPrefix}${internalPin.id}`,
              });
            }
          }
        });

        node.outputs.forEach((chipPin) => {
          const internalNode = chipPin.internalNodeId ? subNodeById.get(chipPin.internalNodeId) : undefined;
          if (internalNode && internalNode.inputs[0]) {
            flatWires.push({
              id: `vw_subout_${prefix}${chipPin.id}`,
              sourceNodeId: `${subPrefix}${internalNode.id}`,
              sourcePinId: `${subPrefix}${internalNode.inputs[0].id}`,
              targetNodeId: `${prefix}${node.id}`,
              targetPinId: `${prefix}${chipPin.id}`,
            });
          }
        });

        flatNodes.push(
          prefix === ''
            ? node
            : {
                ...node,
                id: `${prefix}${node.id}`,
                inputs: node.inputs.map((p) => ({ ...p, id: `${prefix}${p.id}` })),
                outputs: node.outputs.map((p) => ({ ...p, id: `${prefix}${p.id}` })),
              }
        );
      }
    } else if (prefix === '') {
      flatNodes.push(node);
    } else {
      flatNodes.push({
        ...node,
        id: `${prefix}${node.id}`,
        inputs: node.inputs.map((p) => ({ ...p, id: `${prefix}${p.id}` })),
        outputs: node.outputs.map((p) => ({ ...p, id: `${prefix}${p.id}` })),
        properties: { ...node.properties, _isFlattened: true },
      });
    }
  });

  return { nodes: flatNodes, wires: flatWires };
};

export interface SimulationState {
  tickCount: number;
  pinStates: Record<string, Signal>;
  wireStates: Record<string, Signal>;
  /** Internal state of sequential nodes (e.g. counters, flip-flops), keyed by node id. */
  nodeStates?: Record<string, Record<string, any>>;
  connectedPins?: Set<string>;
}

interface CompiledNode {
  id: string;
  selfIndex: number;
  hasSelfFeedbackPin: boolean;
  isButton: boolean;
  sourceNode: LogicNode;
  isFlattened: boolean;
  def: NodeDefinition;
  inputPinIds: string[];
  outputPinIds: string[];
  inputPinIndices: Int32Array;
  outputPinIndices: Int32Array;
  inValsBuf: Signal[];
  prevInValsBuf: Signal[];
  lastInValsBuf: Signal[];
  lastInternal: Record<string, any> | undefined;
  lastHasInternal: boolean;
  vccInputIdx: number;
  gndInputIdx: number;
}

interface CompiledNet {
  allPinIndices: Int32Array;
  strongDriverIndices: Int32Array;
  weakDriverIndices: Int32Array;
  fanoutNodeIndices: Int32Array;
}

export interface CompiledCircuit {
  compiledNodes: CompiledNode[];
  wires: Wire[];
  activeNets: CompiledNet[];
  connectedPins: Set<string>;
  disconnectedInputPinIndices: Int32Array;
  pinToNetIdx: Int32Array;
  dirtyNetFlags: Uint8Array;
  dirtyNetsList: Int32Array;
  dirtyNodeFlags: Uint8Array;
  dirtyNodesA: Int32Array;
  dirtyNodesB: Int32Array;
  allPinIds: string[];
  pinIdToIdx: Map<string, number>;
  curBuf: Signal[];
  driverBuf: Signal[];
  isWeakBuf: Uint8Array;
  prevBuf: Signal[];
}

export const compileCircuit = (
  rootNodes: LogicNode[],
  rootWires: Wire[],
  savedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }> = {}
): CompiledCircuit => {
  const { nodes, wires: baseWires } = flattenCircuit(rootNodes, rootWires, savedCircuits);

  // Generate virtual wires for Net Labels & Bus Breakouts
  const virtualWires: Wire[] = [];
  const netPinGroups: Record<string, { nodeId: string; pinId: string }[]> = {};

  for (let idx = 0; idx < nodes.length; idx++) {
    const n = nodes[idx];
    if (n.type === 'NET_LABEL' && n.properties?.label) {
      const name = String(n.properties.label).trim();
      if (name) {
        if (!netPinGroups[name]) netPinGroups[name] = [];
        netPinGroups[name].push({ nodeId: n.id, pinId: n.inputs[0]?.id });
      }
    } else if (n.type === 'BUS_BREAKOUT' && n.properties?.label) {
      const prefix = String(n.properties.label).trim();
      if (prefix) {
        let baseName = prefix;
        const match = prefix.match(/^([^\[]+)\[/);
        if (match) baseName = match[1];

        for (let p = 0; p < n.inputs.length; p++) {
          const pin = n.inputs[p];
          if (pin.name && /^\d+$/.test(pin.name)) {
            const netName = `${baseName}[${pin.name}]`;
            if (!netPinGroups[netName]) netPinGroups[netName] = [];
            netPinGroups[netName].push({ nodeId: n.id, pinId: pin.id });
          }
        }
      }
    }
  }

  const groupList = Object.values(netPinGroups);
  for (let g = 0; g < groupList.length; g++) {
    const group = groupList[g];
    // Chain linear connections (0-1, 1-2, ...) for Union-Find instead of O(K^2) pairs
    for (let i = 1; i < group.length; i++) {
      if (group[0].pinId && group[i].pinId) {
        virtualWires.push({
          id: `vw_${group[0].nodeId}_${group[i].nodeId}_${group[0].pinId}_${group[i].pinId}`,
          sourceNodeId: group[0].nodeId,
          sourcePinId: group[0].pinId,
          targetNodeId: group[i].nodeId,
          targetPinId: group[i].pinId,
        });
      }
    }
  }

  const wires = [...baseWires, ...virtualWires];

  // --- BUILD NETS ---
  const pinToNet = new Map<string, number>();
  const nets: string[][] = [];

  const union = (pin1: string, pin2: string) => {
    const net1 = pinToNet.get(pin1);
    const net2 = pinToNet.get(pin2);
    if (net1 !== undefined && net2 !== undefined) {
      if (net1 === net2) return;
      nets[net1].push(...nets[net2]);
      for (const p of nets[net2]) {
        pinToNet.set(p, net1);
      }
      nets[net2] = [];
    } else if (net1 !== undefined) {
      nets[net1].push(pin2);
      pinToNet.set(pin2, net1);
    } else if (net2 !== undefined) {
      nets[net2].push(pin1);
      pinToNet.set(pin1, net2);
    } else {
      const newNetIdx = nets.length;
      nets.push([pin1, pin2]);
      pinToNet.set(pin1, newNetIdx);
      pinToNet.set(pin2, newNetIdx);
    }
  };

  for (let i = 0; i < wires.length; i++) {
    union(wires[i].sourcePinId, wires[i].targetPinId);
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'JUNCTION') {
      union(n.inputs[0].id, n.outputs[0].id);
    } else if (n.type === 'KEYPAD') {
      const pressedKey = n.properties?.pressedKey;
      if (typeof pressedKey === 'number' && pressedKey >= 0 && pressedKey < 12) {
        const rowIdx = Math.floor(pressedKey / 3);
        const colIdx = pressedKey % 3;
        const rowPin = n.inputs[rowIdx];
        const colPin = n.inputs[4 + colIdx];
        if (rowPin && colPin) {
          union(rowPin.id, colPin.id);
        }
      }
    }
  }

  // Connect bit pins (0..7) of BUS_BREAKOUT nodes whose BUS pins are in the same net
  const busBreakouts = nodes.filter((n) => n.type === 'BUS_BREAKOUT');
  for (let i = 0; i < busBreakouts.length; i++) {
    const busPinA = busBreakouts[i].inputs.find((p) => p.name === 'BUS');
    if (!busPinA) continue;
    const netA = pinToNet.get(busPinA.id);
    if (netA === undefined) continue;

    for (let j = i + 1; j < busBreakouts.length; j++) {
      const busPinB = busBreakouts[j].inputs.find((p) => p.name === 'BUS');
      if (!busPinB) continue;
      const netB = pinToNet.get(busPinB.id);
      if (netA === netB) {
        busBreakouts[i].inputs.forEach((pinA) => {
          if (pinA.name && /^\d+$/.test(pinA.name)) {
            const pinB = busBreakouts[j].inputs.find((p) => p.name === pinA.name);
            if (pinB) union(pinA.id, pinB.id);
          }
        });
      }
    }
  }

  const outputPins = new Set<string>();
  const weakOutputPins = new Set<string>();
  const dynamicWeakOutputPins = new Set<string>();
  const pinIndexMap = new Map<string, number>();
  const allPinIds: string[] = [];

  const getOrAssignPinIdx = (pid: string): number => {
    let idx = pinIndexMap.get(pid);
    if (idx === undefined) {
      idx = allPinIds.length;
      pinIndexMap.set(pid, idx);
      allPinIds.push(pid);
    }
    return idx;
  };

  const compiledNodes: CompiledNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'REGION_BOX' || n.type === 'TEXT_LABEL' || n.type === 'STICKY_NOTE' || n.type === 'FSM_DIAGRAM') {
      continue;
    }
    const isWeak = n.type === 'PULL_UP' || n.type === 'PULL_DOWN';
    const isButton = n.type === 'BUTTON';
    const inputPinIds: string[] = new Array(n.inputs.length);
    const outputPinIds: string[] = new Array(n.outputs.length);
    const inputPinIndices = new Int32Array(n.inputs.length);
    const outputPinIndices = new Int32Array(n.outputs.length);
    let vccInputIdx = -1;
    let gndInputIdx = -1;

    for (let p = 0; p < n.inputs.length; p++) {
      const pin = n.inputs[p];
      inputPinIds[p] = pin.id;
      inputPinIndices[p] = getOrAssignPinIdx(pin.id);
      if (pin.name === 'VCC') vccInputIdx = p;
      else if (pin.name === 'GND') gndInputIdx = p;
    }

    for (let p = 0; p < n.outputs.length; p++) {
      const pin = n.outputs[p];
      outputPinIds[p] = pin.id;
      outputPinIndices[p] = getOrAssignPinIdx(pin.id);
      outputPins.add(pin.id);
      if (isWeak) weakOutputPins.add(pin.id);
      if (isButton) dynamicWeakOutputPins.add(pin.id);
    }

    const def = getNodeDefinition(n.type);
    if (def) {
      if (def.renderAs !== 'DIP') {
        vccInputIdx = -1;
        gndInputIdx = -1;
      }
      let hasSelfFeedbackPin = false;
      for (let p = 0; p < outputPinIndices.length; p++) {
        for (let q = 0; q < inputPinIndices.length; q++) {
          if (outputPinIndices[p] === inputPinIndices[q]) {
            hasSelfFeedbackPin = true;
            break;
          }
        }
        if (hasSelfFeedbackPin) break;
      }

      compiledNodes.push({
        id: n.id,
        selfIndex: compiledNodes.length,
        hasSelfFeedbackPin,
        isButton,
        sourceNode: n,
        isFlattened: Boolean(n.properties?._isFlattened),
        def,
        inputPinIds,
        outputPinIds,
        inputPinIndices,
        outputPinIndices,
        inValsBuf: new Array(n.inputs.length),
        prevInValsBuf: new Array(n.inputs.length),
        lastInValsBuf: new Array(n.inputs.length),
        lastInternal: undefined,
        lastHasInternal: false,
        vccInputIdx,
        gndInputIdx,
      });
    }
  }

  const rawActiveNets = nets.filter((n) => n.length > 0);
  const connectedPins = new Set<string>();
  const activeNets: CompiledNet[] = new Array(rawActiveNets.length);

  for (let i = 0; i < rawActiveNets.length; i++) {
    const netPins = rawActiveNets[i];
    const strongDrivers: number[] = [];
    const weakDrivers: number[] = [];
    const allPinIndices = new Int32Array(netPins.length);
    for (let p = 0; p < netPins.length; p++) {
      const pid = netPins[p];
      const pinIdx = getOrAssignPinIdx(pid);
      allPinIndices[p] = pinIdx;
      connectedPins.add(pid);
      if (outputPins.has(pid)) {
        if (weakOutputPins.has(pid)) {
          weakDrivers.push(pinIdx);
        } else if (dynamicWeakOutputPins.has(pid)) {
          strongDrivers.push(pinIdx);
          weakDrivers.push(pinIdx);
        } else {
          strongDrivers.push(pinIdx);
        }
      }
    }
    activeNets[i] = {
      allPinIndices,
      strongDriverIndices: Int32Array.from(strongDrivers),
      weakDriverIndices: Int32Array.from(weakDrivers),
      fanoutNodeIndices: new Int32Array(0),
    };
  }

  const disconnectedIndicesList: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    for (let p = 0; p < n.inputs.length; p++) {
      const pid = n.inputs[p].id;
      if (!connectedPins.has(pid) && !outputPins.has(pid)) {
        disconnectedIndicesList.push(getOrAssignPinIdx(pid));
      }
    }
  }

  const totalPins = allPinIds.length;
  const pinToNetIdx = new Int32Array(totalPins).fill(-1);
  const netFanoutSets: Set<number>[] = new Array(activeNets.length);
  for (let i = 0; i < activeNets.length; i++) {
    netFanoutSets[i] = new Set<number>();
    const netPinIndices = activeNets[i].allPinIndices;
    for (let p = 0; p < netPinIndices.length; p++) {
      pinToNetIdx[netPinIndices[p]] = i;
    }
  }

  for (let nIdx = 0; nIdx < compiledNodes.length; nIdx++) {
    const inPinIndices = compiledNodes[nIdx].inputPinIndices;
    for (let p = 0; p < inPinIndices.length; p++) {
      const netIdx = pinToNetIdx[inPinIndices[p]];
      if (netIdx >= 0) {
        netFanoutSets[netIdx].add(nIdx);
      }
    }
  }

  for (let i = 0; i < activeNets.length; i++) {
    activeNets[i].fanoutNodeIndices = Int32Array.from(netFanoutSets[i]);
  }

  const isWeakBuf = new Uint8Array(totalPins);
  weakOutputPins.forEach((pid) => {
    const idx = pinIndexMap.get(pid);
    if (idx !== undefined) isWeakBuf[idx] = 1;
  });

  return {
    compiledNodes,
    wires,
    activeNets,
    connectedPins,
    disconnectedInputPinIndices: Int32Array.from(disconnectedIndicesList),
    pinToNetIdx,
    dirtyNetFlags: new Uint8Array(activeNets.length),
    dirtyNetsList: new Int32Array(activeNets.length),
    dirtyNodeFlags: new Uint8Array(compiledNodes.length),
    dirtyNodesA: new Int32Array(compiledNodes.length),
    dirtyNodesB: new Int32Array(compiledNodes.length),
    allPinIds,
    pinIdToIdx: pinIndexMap,
    curBuf: new Array(totalPins),
    driverBuf: new Array(totalPins),
    isWeakBuf,
    prevBuf: new Array(totalPins),
  };
};

let scratchEmptyInternal: Record<string, any> = {};

const cloneInternalState = (raw?: Record<string, any>): Record<string, any> => {
  if (!raw) return {};
  const cloned: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) {
      cloned[k] = v.slice();
    } else if (v instanceof Uint8Array) {
      // Memory ICs (62256, 6116) perform copy-on-write when mutating bytes
      cloned[k] = v;
    } else if (v && typeof v === 'object') {
      cloned[k] = { ...v };
    } else {
      cloned[k] = v;
    }
  }
  return cloned;
};

function resolveNet(
  net: CompiledNet,
  driverBuf: Signal[],
  isWeakBuf: Uint8Array,
  curBuf: Signal[]
): boolean {
  const { allPinIndices, strongDriverIndices, weakDriverIndices } = net;
  let strongValue: Signal = undefined;
  let strongCollision = false;

  for (let s = 0; s < strongDriverIndices.length; s++) {
    const pinIdx = strongDriverIndices[s];
    if (isWeakBuf[pinIdx]) continue;
    const val = driverBuf[pinIdx];
    if (val !== undefined) {
      if (strongValue === undefined) {
        strongValue = val;
      } else if (strongValue !== val) {
        strongCollision = true;
        break;
      }
    }
  }

  let finalVal: Signal;
  if (strongCollision) {
    finalVal = 'X';
  } else if (strongValue !== undefined) {
    finalVal = strongValue;
  } else if (weakDriverIndices.length > 0) {
    let weakValue: Signal = undefined;
    let weakCollision = false;
    for (let w = 0; w < weakDriverIndices.length; w++) {
      const pinIdx = weakDriverIndices[w];
      if (!isWeakBuf[pinIdx]) continue;
      const val = driverBuf[pinIdx];
      if (val !== undefined) {
        if (weakValue === undefined) {
          weakValue = val;
        } else if (weakValue !== val) {
          weakCollision = true;
          break;
        }
      }
    }
    finalVal = weakCollision ? 'X' : weakValue;
  } else {
    finalVal = undefined;
  }

  let anyPinUpdated = false;
  for (let p = 0; p < allPinIndices.length; p++) {
    const pinIdx = allPinIndices[p];
    if (curBuf[pinIdx] !== finalVal) {
      curBuf[pinIdx] = finalVal;
      anyPinUpdated = true;
    }
  }
  return anyPinUpdated;
}

export const stepCompiledCircuit = (
  compiled: CompiledCircuit,
  prevState: SimulationState,
  computeWireStates: boolean = true,
  reuseCurBuf: boolean = false
): SimulationState => {
  const {
    compiledNodes,
    wires,
    activeNets,
    connectedPins,
    disconnectedInputPinIndices,
    pinToNetIdx,
    dirtyNetFlags,
    dirtyNetsList,
    dirtyNodeFlags,
    allPinIds,
  } = compiled;

  const totalPins = allPinIds.length;
  const curBuf = compiled.curBuf;
  const driverBuf = compiled.driverBuf;
  const isWeakBuf = compiled.isWeakBuf;
  const prevBuf = compiled.prevBuf;
  const prevPinStates = prevState.pinStates;
  let curDirtyNodes = compiled.dirtyNodesA;
  let nextDirtyNodes = compiled.dirtyNodesB;
  let curDirtyNodeCount = 0;
  let nextDirtyNodeCount = 0;

  if (!reuseCurBuf) {
    for (let i = 0; i < totalPins; i++) {
      const val = prevPinStates[allPinIds[i]];
      curBuf[i] = val;
      prevBuf[i] = val;
    }
  } else {
    for (let i = 0; i < totalPins; i++) {
      prevBuf[i] = curBuf[i];
    }
  }

  // Clear disconnected input pins once before iteration 0
  for (let i = 0; i < disconnectedInputPinIndices.length; i++) {
    curBuf[disconnectedInputPinIndices[i]] = undefined;
  }

  // Populate reusable prevInValsBuf once per tick
  for (let i = 0; i < compiledNodes.length; i++) {
    const { inputPinIndices, prevInValsBuf } = compiledNodes[i];
    for (let p = 0; p < inputPinIndices.length; p++) {
      prevInValsBuf[p] = prevBuf[inputPinIndices[p]];
    }
  }

  const MAX_ITERATIONS = 50;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;
    let dirtyNetCount = 0;
    const nodeLimit = iter === 0 ? compiledNodes.length : curDirtyNodeCount;

    // 1. Evaluate gates and sources
    for (let idx = 0; idx < nodeLimit; idx++) {
      const nodeIdx = iter === 0 ? idx : curDirtyNodes[idx];
      if (iter > 0) {
        dirtyNodeFlags[nodeIdx] = 0;
      }
      const cn = compiledNodes[nodeIdx];
      const {
        inputPinIndices,
        outputPinIndices,
        inValsBuf,
        prevInValsBuf,
        lastInValsBuf,
        vccInputIdx,
        gndInputIdx,
        def,
        sourceNode,
        id,
        hasSelfFeedbackPin,
      } = cn;

      const inLen = inputPinIndices.length;
      let inputsChanged = iter === 0;
      for (let p = 0; p < inLen; p++) {
        const val = curBuf[inputPinIndices[p]];
        inValsBuf[p] = val;
        if (val !== lastInValsBuf[p]) {
          lastInValsBuf[p] = val;
          inputsChanged = true;
        }
      }

      if (!inputsChanged) {
        continue;
      }

      const isPowered =
        (vccInputIdx === -1 || inValsBuf[vccInputIdx] !== 0) &&
        (gndInputIdx === -1 || inValsBuf[gndInputIdx] !== 1);

      if (!isPowered) {
        cn.lastHasInternal = false;
        cn.lastInternal = undefined;
        for (let p = 0; p < outputPinIndices.length; p++) {
          const pinIdx = outputPinIndices[p];
          if (iter === 0 || driverBuf[pinIdx] !== undefined) {
            driverBuf[pinIdx] = undefined;
            const netIdx = pinToNetIdx[pinIdx];
            if (netIdx >= 0) {
              if (iter > 0 && dirtyNetFlags[netIdx] === 0) {
                dirtyNetFlags[netIdx] = 1;
                dirtyNetsList[dirtyNetCount++] = netIdx;
              }
            } else if (curBuf[pinIdx] !== undefined) {
              curBuf[pinIdx] = undefined;
              changed = true;
              if (hasSelfFeedbackPin && dirtyNodeFlags[nodeIdx] === 0) {
                dirtyNodeFlags[nodeIdx] = 1;
                nextDirtyNodes[nextDirtyNodeCount++] = nodeIdx;
              }
            }
          }
        }
      } else {
        const prevNodeState = prevState.nodeStates?.[id];
        const internal = prevNodeState ? cloneInternalState(prevNodeState) : scratchEmptyInternal;
        const outVals = def.evaluate(
          inValsBuf,
          sourceNode.properties,
          prevState.tickCount,
          internal,
          prevInValsBuf
        );
        let hasInternal = false;
        for (const k in internal) {
          if (Object.prototype.hasOwnProperty.call(internal, k)) {
            hasInternal = true;
            break;
          }
        }
        if (hasInternal && internal === scratchEmptyInternal) {
          scratchEmptyInternal = {};
        }
        cn.lastHasInternal = hasInternal;
        cn.lastInternal = hasInternal ? internal : undefined;

        const isWeakOut = cn.isButton ? (sourceNode.properties?.pressed ? 0 : 1) : -1;
        for (let p = 0; p < outputPinIndices.length; p++) {
          const pinIdx = outputPinIndices[p];
          const newVal = outVals[p];
          if (isWeakOut >= 0) {
            isWeakBuf[pinIdx] = isWeakOut;
          }
          if (iter === 0 || driverBuf[pinIdx] !== newVal) {
            driverBuf[pinIdx] = newVal;
            const netIdx = pinToNetIdx[pinIdx];
            if (netIdx >= 0) {
              if (iter > 0 && dirtyNetFlags[netIdx] === 0) {
                dirtyNetFlags[netIdx] = 1;
                dirtyNetsList[dirtyNetCount++] = netIdx;
              }
            } else if (curBuf[pinIdx] !== newVal) {
              curBuf[pinIdx] = newVal;
              changed = true;
              if (hasSelfFeedbackPin && dirtyNodeFlags[nodeIdx] === 0) {
                dirtyNodeFlags[nodeIdx] = 1;
                nextDirtyNodes[nextDirtyNodeCount++] = nodeIdx;
              }
            }
          }
        }
      }
    }

    // 2. Propagate through wires (Net resolution: strong drivers override weak pull-up/pull-down)
    if (iter === 0) {
      for (let n = 0; n < activeNets.length; n++) {
        const net = activeNets[n];
        if (resolveNet(net, driverBuf, isWeakBuf, curBuf)) {
          changed = true;
          const fanout = net.fanoutNodeIndices;
          for (let f = 0; f < fanout.length; f++) {
            const fNodeIdx = fanout[f];
            if (dirtyNodeFlags[fNodeIdx] === 0) {
              dirtyNodeFlags[fNodeIdx] = 1;
              nextDirtyNodes[nextDirtyNodeCount++] = fNodeIdx;
            }
          }
        }
      }
    } else {
      for (let d = 0; d < dirtyNetCount; d++) {
        const n = dirtyNetsList[d];
        dirtyNetFlags[n] = 0;
        const net = activeNets[n];
        if (resolveNet(net, driverBuf, isWeakBuf, curBuf)) {
          changed = true;
          const fanout = net.fanoutNodeIndices;
          for (let f = 0; f < fanout.length; f++) {
            const fNodeIdx = fanout[f];
            if (dirtyNodeFlags[fNodeIdx] === 0) {
              dirtyNodeFlags[fNodeIdx] = 1;
              nextDirtyNodes[nextDirtyNodeCount++] = fNodeIdx;
            }
          }
        }
      }
    }

    if (!changed || nextDirtyNodeCount === 0) {
      for (let d = 0; d < nextDirtyNodeCount; d++) {
        dirtyNodeFlags[nextDirtyNodes[d]] = 0;
      }
      break;
    }

    const tmpNodes = curDirtyNodes;
    curDirtyNodes = nextDirtyNodes;
    nextDirtyNodes = tmpNodes;
    curDirtyNodeCount = nextDirtyNodeCount;
    nextDirtyNodeCount = 0;
  }

  const finalNodeStates: Record<string, Record<string, any>> = {};
  for (let i = 0; i < compiledNodes.length; i++) {
    const cn = compiledNodes[i];
    if (cn.lastHasInternal && cn.lastInternal) {
      finalNodeStates[cn.id] = cn.lastInternal;
    }
  }

  // On intermediate ticks of a batch (computeWireStates === false), keep curBuf in-place
  // and defer materializing pinStates/wireStates objects until the final tick of the batch.
  if (!computeWireStates) {
    return {
      tickCount: prevState.tickCount + 1,
      pinStates: prevPinStates,
      wireStates: prevState.wireStates,
      nodeStates: finalNodeStates,
      connectedPins,
    };
  }

  // Structural sharing: if no pin states changed compared to prevState.pinStates,
  // reuse prevState.pinStates and prevState.wireStates references to avoid triggering UI subscribers.
  let anyPinChangedFromPrev = prevState.tickCount === 0;
  if (!anyPinChangedFromPrev) {
    if (!reuseCurBuf) {
      for (let i = 0; i < totalPins; i++) {
        if (curBuf[i] !== prevBuf[i]) {
          anyPinChangedFromPrev = true;
          break;
        }
      }
    } else {
      for (let i = 0; i < totalPins; i++) {
        if (curBuf[i] !== prevPinStates[allPinIds[i]]) {
          anyPinChangedFromPrev = true;
          break;
        }
      }
    }
  }

  let resolvedPinStates: Record<string, Signal>;
  if (anyPinChangedFromPrev) {
    resolvedPinStates = { ...prevPinStates };
    for (let i = 0; i < totalPins; i++) {
      resolvedPinStates[allPinIds[i]] = curBuf[i];
    }
  } else {
    resolvedPinStates = prevPinStates;
  }

  let finalWireStates: Record<string, Signal>;
  if (
    !anyPinChangedFromPrev &&
    (wires.length === 0 || wires[0].id in prevState.wireStates)
  ) {
    finalWireStates = prevState.wireStates;
  } else {
    finalWireStates = {};
    for (let i = 0; i < wires.length; i++) {
      const wire = wires[i];
      finalWireStates[wire.id] = resolvedPinStates[wire.sourcePinId];
    }
  }

  return {
    tickCount: prevState.tickCount + 1,
    pinStates: resolvedPinStates,
    wireStates: finalWireStates,
    nodeStates: finalNodeStates,
    connectedPins,
  };
};

// Topology cache for high-frequency batch simulation
let cachedRootNodes: LogicNode[] | null = null;
let cachedRootWires: Wire[] | null = null;
let cachedSavedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }> | null = null;
let cachedKeypadKeySig: string = '';
let cachedCompiledCircuit: CompiledCircuit | null = null;

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

const EMPTY_SAVED_CIRCUITS: Record<string, { nodes: LogicNode[]; wires: Wire[] }> = {};

function isSameSavedCircuits(
  a: Record<string, { nodes: LogicNode[]; wires: Wire[] }> | null,
  b: Record<string, { nodes: LogicNode[]; wires: Wire[] }>
): boolean {
  if (a === b) return true;
  if (!a) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i];
    if (k === 'main') continue;
    const subA = a[k];
    const subB = b[k];
    if (!subB || subA.nodes !== subB.nodes || subA.wires !== subB.wires) return false;
  }
  return true;
}

export const getOrCompileCircuit = (
  rootNodes: LogicNode[],
  rootWires: Wire[],
  savedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }> = EMPTY_SAVED_CIRCUITS
): CompiledCircuit => {
  const kpSig = getKeypadSig(rootNodes);
  if (
    cachedCompiledCircuit &&
    cachedRootWires === rootWires &&
    isSameSavedCircuits(cachedSavedCircuits, savedCircuits) &&
    cachedKeypadKeySig === kpSig
  ) {
    if (cachedRootNodes === rootNodes) {
      return cachedCompiledCircuit;
    }
    if (cachedRootNodes && isSameRootNodeTopology(cachedRootNodes, rootNodes)) {
      const rootById = new Map<string, LogicNode>();
      for (let i = 0; i < rootNodes.length; i++) {
        rootById.set(rootNodes[i].id, rootNodes[i]);
      }
      const cNodes = cachedCompiledCircuit.compiledNodes;
      for (let i = 0; i < cNodes.length; i++) {
        const cn = cNodes[i];
        if (!cn.isFlattened) {
          const updated = rootById.get(cn.id);
          if (updated) cn.sourceNode = updated;
        }
      }
      cachedRootNodes = rootNodes;
      cachedSavedCircuits = savedCircuits;
      return cachedCompiledCircuit;
    }
  }
  const compiled = compileCircuit(rootNodes, rootWires, savedCircuits);
  cachedRootNodes = rootNodes;
  cachedRootWires = rootWires;
  cachedSavedCircuits = savedCircuits;
  cachedKeypadKeySig = kpSig;
  cachedCompiledCircuit = compiled;
  return compiled;
};

export const computeNextState = (
  rootNodes: LogicNode[],
  rootWires: Wire[],
  prevState: SimulationState,
  savedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }> = EMPTY_SAVED_CIRCUITS
): SimulationState => {
  const compiled = getOrCompileCircuit(rootNodes, rootWires, savedCircuits);
  return stepCompiledCircuit(compiled, prevState, true, false);
};

export const computeNextStateBatch = (
  rootNodes: LogicNode[],
  rootWires: Wire[],
  prevState: SimulationState,
  savedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }> = EMPTY_SAVED_CIRCUITS,
  ticks: number,
  maxBudgetMs: number = 12,
  onTick?: (compiled: CompiledCircuit, tickCount: number) => boolean
): { state: SimulationState; ticksExecuted: number; stoppedByHook?: boolean } => {
  if (ticks <= 0) return { state: prevState, ticksExecuted: 0 };
  const compiled = getOrCompileCircuit(rootNodes, rootWires, savedCircuits);
  let nextState = prevState;
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let executed = 0;
  let stoppedByHook = false;

  for (let i = 0; i < ticks; i++) {
    const isLast = i === ticks - 1;
    // Check frame budget every 16 ticks so we never freeze the UI thread
    const hitBudget =
      !isLast &&
      i > 0 &&
      (i & 15) === 0 &&
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime >= maxBudgetMs;

    const shouldUnpack = isLast || hitBudget;
    nextState = stepCompiledCircuit(compiled, nextState, shouldUnpack, i > 0);
    executed++;

    if (onTick && onTick(compiled, nextState.tickCount)) {
      stoppedByHook = true;
      if (!shouldUnpack) {
        const { allPinIds, curBuf, wires } = compiled;
        const resolvedPinStates: Record<string, Signal> = { ...prevState.pinStates };
        for (let p = 0; p < allPinIds.length; p++) {
          resolvedPinStates[allPinIds[p]] = curBuf[p];
        }
        const finalWireStates: Record<string, Signal> = {};
        for (let w = 0; w < wires.length; w++) {
          finalWireStates[wires[w].id] = resolvedPinStates[wires[w].sourcePinId];
        }
        nextState = {
          ...nextState,
          pinStates: resolvedPinStates,
          wireStates: finalWireStates,
        };
      }
      break;
    }

    if (hitBudget) break;
  }

  return { state: nextState, ticksExecuted: executed, stoppedByHook };
};
