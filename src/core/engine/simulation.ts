import { LogicNode, Wire, Signal } from '../models/types';
import { getNodeDefinition } from './nodes';
import { NodeDefinition } from './nodes/NodeDefinition';

export const flattenCircuit = (
  rootNodes: LogicNode[],
  rootWires: Wire[],
  savedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }>,
  prefix: string = ''
): { nodes: LogicNode[]; wires: Wire[] } => {
  let flatNodes: LogicNode[] = [];
  let flatWires: Wire[] = [
    ...rootWires.map((w) => ({
      ...w,
      id: `${prefix}${w.id}`,
      sourceNodeId: `${prefix}${w.sourceNodeId}`,
      sourcePinId: `${prefix}${w.sourcePinId}`,
      targetNodeId: `${prefix}${w.targetNodeId}`,
      targetPinId: `${prefix}${w.targetPinId}`,
    })),
  ];

  rootNodes.forEach((node) => {
    if (node.type.startsWith('SUBCIRCUIT:')) {
      const subId = node.type.split(':')[1];
      const sub = savedCircuits[subId];
      if (sub) {
        const subPrefix = `${prefix}${node.id}_`;

        const flattened = flattenCircuit(sub.nodes, sub.wires, savedCircuits, subPrefix);
        flatNodes.push(...flattened.nodes);
        flatWires.push(...flattened.wires);

        node.inputs.forEach((chipPin) => {
          const internalNode = sub.nodes.find((n) => n.id === chipPin.internalNodeId);
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
          const internalNode = sub.nodes.find((n) => n.id === chipPin.internalNodeId);
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

        flatNodes.push({
          ...node,
          id: `${prefix}${node.id}`,
          inputs: node.inputs.map((p) => ({ ...p, id: `${prefix}${p.id}` })),
          outputs: node.outputs.map((p) => ({ ...p, id: `${prefix}${p.id}` })),
        });
      }
    } else {
      flatNodes.push({
        ...node,
        id: `${prefix}${node.id}`,
        inputs: node.inputs.map((p) => ({ ...p, id: `${prefix}${p.id}` })),
        outputs: node.outputs.map((p) => ({ ...p, id: `${prefix}${p.id}` })),
        properties: prefix !== '' ? { ...node.properties, _isFlattened: true } : node.properties,
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
  sourceNode: LogicNode;
  isFlattened: boolean;
  def: NodeDefinition;
  inputPinIds: string[];
  outputPinIds: string[];
  vccInputIdx: number;
  gndInputIdx: number;
}

interface CompiledNet {
  allPins: string[];
  strongDrivers: string[];
  weakDrivers: string[];
}

export interface CompiledCircuit {
  compiledNodes: CompiledNode[];
  wires: Wire[];
  activeNets: CompiledNet[];
  connectedPins: Set<string>;
  disconnectedInputPinIds: string[];
  allPinIds: string[];
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
  const allPinIdsSet = new Set<string>();
  const compiledNodes: CompiledNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'REGION_BOX' || n.type === 'TEXT_LABEL' || n.type === 'STICKY_NOTE') {
      continue;
    }
    const isWeak = n.type === 'PULL_UP' || n.type === 'PULL_DOWN';
    const inputPinIds: string[] = new Array(n.inputs.length);
    const outputPinIds: string[] = new Array(n.outputs.length);
    let vccInputIdx = -1;
    let gndInputIdx = -1;

    for (let p = 0; p < n.inputs.length; p++) {
      const pin = n.inputs[p];
      inputPinIds[p] = pin.id;
      allPinIdsSet.add(pin.id);
      if (pin.name === 'VCC') vccInputIdx = p;
      else if (pin.name === 'GND') gndInputIdx = p;
    }

    for (let p = 0; p < n.outputs.length; p++) {
      const pin = n.outputs[p];
      outputPinIds[p] = pin.id;
      allPinIdsSet.add(pin.id);
      outputPins.add(pin.id);
      if (isWeak) weakOutputPins.add(pin.id);
    }

    const def = getNodeDefinition(n.type);
    if (def) {
      if (def.renderAs !== 'DIP') {
        vccInputIdx = -1;
        gndInputIdx = -1;
      }
      compiledNodes.push({
        id: n.id,
        sourceNode: n,
        isFlattened: Boolean(n.properties?._isFlattened),
        def,
        inputPinIds,
        outputPinIds,
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
    const strongDrivers: string[] = [];
    const weakDrivers: string[] = [];
    for (let p = 0; p < netPins.length; p++) {
      const pid = netPins[p];
      connectedPins.add(pid);
      if (outputPins.has(pid)) {
        if (weakOutputPins.has(pid)) {
          weakDrivers.push(pid);
        } else {
          strongDrivers.push(pid);
        }
      }
    }
    activeNets[i] = { allPins: netPins, strongDrivers, weakDrivers };
  }

  const disconnectedInputPinIds: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    for (let p = 0; p < n.inputs.length; p++) {
      const pid = n.inputs[p].id;
      if (!connectedPins.has(pid) && !outputPins.has(pid)) {
        disconnectedInputPinIds.push(pid);
      }
    }
  }

  return {
    compiledNodes,
    wires,
    activeNets,
    connectedPins,
    disconnectedInputPinIds,
    allPinIds: Array.from(allPinIdsSet),
  };
};

const cloneInternalState = (raw?: Record<string, any>): Record<string, any> => {
  if (!raw) return {};
  const cloned: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) {
      cloned[k] = v.slice();
    } else if (v instanceof Uint8Array) {
      cloned[k] = new Uint8Array(v);
    } else if (v && typeof v === 'object') {
      cloned[k] = { ...v };
    } else {
      cloned[k] = v;
    }
  }
  return cloned;
};

export const stepCompiledCircuit = (
  compiled: CompiledCircuit,
  prevState: SimulationState,
  computeWireStates: boolean = true
): SimulationState => {
  const {
    compiledNodes,
    wires,
    activeNets,
    connectedPins,
    disconnectedInputPinIds,
    allPinIds,
  } = compiled;

  let currentPinStates: Record<string, Signal> = { ...prevState.pinStates };

  // Clear disconnected input pins immediately so gates see undefined on iteration 0
  for (let i = 0; i < disconnectedInputPinIds.length; i++) {
    currentPinStates[disconnectedInputPinIds[i]] = undefined;
  }

  // Pre-compute prevInVals once per tick (since prevState.pinStates does not change across iterations)
  const nodePrevInVals: Signal[][] = new Array(compiledNodes.length);
  for (let i = 0; i < compiledNodes.length; i++) {
    const inputPinIds = compiledNodes[i].inputPinIds;
    const prevIn: Signal[] = new Array(inputPinIds.length);
    for (let p = 0; p < inputPinIds.length; p++) {
      prevIn[p] = prevState.pinStates[inputPinIds[p]];
    }
    nodePrevInVals[i] = prevIn;
  }

  let finalNodeStates: Record<string, Record<string, any>> = {};
  const MAX_ITERATIONS = 50;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const nextIterPinStates: Record<string, Signal> = { ...currentPinStates };
    finalNodeStates = {};

    // 1. Evaluate gates and sources
    for (let i = 0; i < compiledNodes.length; i++) {
      const cn = compiledNodes[i];
      const { inputPinIds, outputPinIds, vccInputIdx, gndInputIdx, def, sourceNode, id } = cn;

      const inLen = inputPinIds.length;
      const inVals: Signal[] = new Array(inLen);
      for (let p = 0; p < inLen; p++) {
        inVals[p] = currentPinStates[inputPinIds[p]];
      }

      const isPowered =
        (vccInputIdx === -1 || inVals[vccInputIdx] !== 0) &&
        (gndInputIdx === -1 || inVals[gndInputIdx] !== 1);

      if (!isPowered) {
        for (let p = 0; p < outputPinIds.length; p++) {
          nextIterPinStates[outputPinIds[p]] = undefined;
        }
      } else {
        const prevNodeState = prevState.nodeStates?.[id];
        const internal = prevNodeState ? cloneInternalState(prevNodeState) : {};
        const outVals = def.evaluate(
          inVals,
          sourceNode.properties,
          prevState.tickCount,
          internal,
          nodePrevInVals[i]
        );
        for (const k in internal) {
          if (Object.prototype.hasOwnProperty.call(internal, k)) {
            finalNodeStates[id] = internal;
            break;
          }
        }

        for (let p = 0; p < outputPinIds.length; p++) {
          nextIterPinStates[outputPinIds[p]] = outVals[p];
        }
      }
    }

    // 2. Propagate through wires (Net resolution: strong drivers override weak pull-up/pull-down)
    for (let n = 0; n < activeNets.length; n++) {
      const { allPins, strongDrivers, weakDrivers } = activeNets[n];
      let strongValue: Signal = undefined;
      let strongCollision = false;

      for (let s = 0; s < strongDrivers.length; s++) {
        const pinId = strongDrivers[s];
        let val = nextIterPinStates[pinId];
        if (val === undefined && !(pinId in nextIterPinStates)) {
          val = currentPinStates[pinId];
        }
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
      } else if (weakDrivers.length > 0) {
        let weakValue: Signal = undefined;
        let weakCollision = false;
        for (let w = 0; w < weakDrivers.length; w++) {
          const pinId = weakDrivers[w];
          const val = nextIterPinStates[pinId];
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

      for (let p = 0; p < allPins.length; p++) {
        nextIterPinStates[allPins[p]] = finalVal;
      }
    }

    // 3. Ensure disconnected input pins remain undefined
    for (let i = 0; i < disconnectedInputPinIds.length; i++) {
      nextIterPinStates[disconnectedInputPinIds[i]] = undefined;
    }

    // 4. Check if state settled without allocating Object.keys arrays
    let changed = false;
    for (let i = 0; i < allPinIds.length; i++) {
      const pid = allPinIds[i];
      if (nextIterPinStates[pid] !== currentPinStates[pid]) {
        changed = true;
        break;
      }
    }

    currentPinStates = nextIterPinStates;
    if (!changed) break;
  }

  const finalWireStates: Record<string, Signal> = {};
  if (computeWireStates) {
    for (let i = 0; i < wires.length; i++) {
      const wire = wires[i];
      finalWireStates[wire.id] = currentPinStates[wire.sourcePinId];
    }
  }

  return {
    tickCount: prevState.tickCount + 1,
    pinStates: currentPinStates,
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

export const getOrCompileCircuit = (
  rootNodes: LogicNode[],
  rootWires: Wire[],
  savedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }> = {}
): CompiledCircuit => {
  const kpSig = getKeypadSig(rootNodes);
  if (
    cachedCompiledCircuit &&
    cachedRootNodes === rootNodes &&
    cachedRootWires === rootWires &&
    cachedSavedCircuits === savedCircuits &&
    cachedKeypadKeySig === kpSig
  ) {
    return cachedCompiledCircuit;
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
  savedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }> = {}
): SimulationState => {
  const compiled = compileCircuit(rootNodes, rootWires, savedCircuits);
  return stepCompiledCircuit(compiled, prevState, true);
};

export const computeNextStateBatch = (
  rootNodes: LogicNode[],
  rootWires: Wire[],
  prevState: SimulationState,
  savedCircuits: Record<string, { nodes: LogicNode[]; wires: Wire[] }> = {},
  ticks: number,
  maxBudgetMs: number = 12
): { state: SimulationState; ticksExecuted: number } => {
  if (ticks <= 0) return { state: prevState, ticksExecuted: 0 };
  const compiled = getOrCompileCircuit(rootNodes, rootWires, savedCircuits);
  let nextState = prevState;
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let executed = 0;

  for (let i = 0; i < ticks; i++) {
    const isLast = i === ticks - 1;
    // Check frame budget every 16 ticks so we never freeze the UI thread
    const hitBudget =
      !isLast &&
      i > 0 &&
      (i & 15) === 0 &&
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime >= maxBudgetMs;

    nextState = stepCompiledCircuit(compiled, nextState, isLast || hitBudget);
    executed++;
    if (hitBudget) break;
  }

  return { state: nextState, ticksExecuted: executed };
};
