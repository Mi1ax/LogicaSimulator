import { LogicNode, Wire, Signal } from '../models/types';
import { getNodeDefinition } from './nodes';

export interface SimulationState {
  tickCount: number;
  pinStates: Record<string, Signal>;
  wireStates: Record<string, Signal>;
  /** Internal state of sequential nodes (e.g. counters, flip-flops), keyed by node id. */
  nodeStates?: Record<string, Record<string, any>>;
}

export const computeNextState = (
  nodes: LogicNode[],
  baseWires: Wire[],
  prevState: SimulationState
): SimulationState => {
  // Generate virtual wires for Net Labels
  const virtualWires: Wire[] = [];
  const netPinGroups: Record<string, { nodeId: string; pinId: string }[]> = {};
  
  nodes.forEach(n => {
    if (n.type === 'NET_LABEL' && n.properties?.label) {
      const name = String(n.properties.label).trim();
      if (name) {
        if (!netPinGroups[name]) netPinGroups[name] = [];
        // Since NET_LABEL has bidir pins, its inputs[0].id === outputs[0].id
        netPinGroups[name].push({ nodeId: n.id, pinId: n.inputs[0]?.id });
      }
    } else if (n.type === 'BUS_BREAKOUT' && n.properties?.label) {
      const prefix = String(n.properties.label).trim();
      if (prefix) {
        // Parse prefix, if it's "DB[7..0]", just use "DB"
        let baseName = prefix;
        const match = prefix.match(/^([^\[]+)\[/);
        if (match) baseName = match[1];

        n.inputs.forEach(pin => {
          if (pin.name && /^\d+$/.test(pin.name)) {
            const netName = `${baseName}[${pin.name}]`;
            if (!netPinGroups[netName]) netPinGroups[netName] = [];
            netPinGroups[netName].push({ nodeId: n.id, pinId: pin.id });
          }
        });
      }
    }
  });

  Object.values(netPinGroups).forEach(group => {
    for (let i = 0; i < group.length; i++) {
      for (let j = 0; j < group.length; j++) {
        if (i !== j && group[i].pinId && group[j].pinId) {
          virtualWires.push({
            id: `vw_${group[i].nodeId}_${group[j].nodeId}_${group[i].pinId}_${group[j].pinId}`,
            sourceNodeId: group[i].nodeId,
            sourcePinId: group[i].pinId,
            targetNodeId: group[j].nodeId,
            targetPinId: group[j].pinId,
          });
        }
      }
    }
  });

  const wires = [...baseWires, ...virtualWires];

  // --- BUILD NETS ---
  const pinToNet = new Map<string, number>();
  const nets: string[][] = [];

  const union = (pin1: string, pin2: string) => {
    let net1 = pinToNet.get(pin1);
    let net2 = pinToNet.get(pin2);
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

  wires.forEach(w => union(w.sourcePinId, w.targetPinId));
  nodes.forEach(n => {
    if (n.type === 'JUNCTION') {
      union(n.inputs[0].id, n.outputs[0].id);
    }
  });

  const activeNets = nets.filter(n => n.length > 0);
  
  const outputPins = new Set<string>();
  nodes.forEach(n => {
    n.outputs.forEach(p => outputPins.add(p.id));
  });

  const connectedPins = new Set(activeNets.flat());
  // ------------------

  let currentPinStates: Record<string, Signal> = { ...prevState.pinStates };
  let finalWireStates: Record<string, Signal> = {};
  let finalNodeStates: Record<string, Record<string, any>> = {};

  const MAX_ITERATIONS = 50;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const nextIterPinStates: Record<string, Signal> = { ...currentPinStates };
    finalNodeStates = {};
    finalWireStates = {};

    // 1. Evaluate gates and sources
    nodes.forEach(node => {
      const def = getNodeDefinition(node.type);
      if (!def) return;

      const inVals = node.inputs.map(p => currentPinStates[p.id]);
      
      let isPowered = true;
      if (def.renderAs === 'DIP') {
        node.inputs.forEach((pin, idx) => {
          if (pin.name === 'VCC' && inVals[idx] !== 1) isPowered = false;
          if (pin.name === 'GND' && inVals[idx] !== 0) isPowered = false;
        });
      }

      if (!isPowered) {
        // Unpowered IC outputs high-Z (undefined)
        node.outputs.forEach((pin) => {
          nextIterPinStates[pin.id] = undefined;
        });
      } else {
        // Always use the committed state from the PREVIOUS tick to avoid glitch increments
        const internal = { ...(prevState.nodeStates?.[node.id] ?? {}) };
        const outVals = def.evaluate(inVals, node.properties, prevState.tickCount, internal);
        if (Object.keys(internal).length > 0) finalNodeStates[node.id] = internal;
        
        node.outputs.forEach((pin, idx) => {
          nextIterPinStates[pin.id] = outVals[idx];
        });
      }
    });

    // 2. Propagate through wires (Net resolution)
    activeNets.forEach(netPins => {
      let netValue: Signal = undefined;
      let collision = false;

      for (const pinId of netPins) {
        if (outputPins.has(pinId)) {
          let val = nextIterPinStates[pinId];
          if (val === undefined && !(pinId in nextIterPinStates)) {
             val = currentPinStates[pinId];
          }
          
          if (val !== undefined) {
            if (netValue === undefined) {
              netValue = val;
            } else if (netValue !== val) {
              collision = true;
            }
          }
        }
      }

      const finalVal = collision ? 'X' : netValue;
      
      netPins.forEach(pinId => {
        nextIterPinStates[pinId] = finalVal;
      });
    });

    wires.forEach(wire => {
      finalWireStates[wire.id] = nextIterPinStates[wire.sourcePinId];
    });

    // 3. Clear disconnected input pins
    nodes.forEach(node => {
      node.inputs.forEach(pin => {
        if (!connectedPins.has(pin.id) && !outputPins.has(pin.id)) {
          nextIterPinStates[pin.id] = undefined;
        }
      });
    });

    // Check if state settled
    let changed = false;
    const nextKeys = Object.keys(nextIterPinStates);
    const currKeys = Object.keys(currentPinStates);
    
    if (nextKeys.length !== currKeys.length) {
      changed = true;
    } else {
      for (const key of nextKeys) {
        if (nextIterPinStates[key] !== currentPinStates[key]) {
          changed = true;
          break;
        }
      }
    }

    currentPinStates = nextIterPinStates;
    if (!changed) break;
  }

  return {
    tickCount: prevState.tickCount + 1,
    pinStates: currentPinStates,
    wireStates: finalWireStates,
    nodeStates: finalNodeStates
  };
};
