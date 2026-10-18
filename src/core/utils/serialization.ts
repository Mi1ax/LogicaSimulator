import { LogicNode, Pin, Wire } from '../models/types';
import { getNodeDefinition } from '../engine/nodes';
import { buildNodePins } from '../engine/circuit';
import { updateSubcircuitRegistry } from '../engine/subcircuitRegistry';

export interface SerializedCircuit {
  version?: number;
  simSpeed?: number;
  nodes: any[];
  wires: any[];
  subcircuits?: Record<string, { name: string; nodes: any[]; wires: any[] }>;
}

function serializeNodesAndWires(nodes: LogicNode[], wires: Wire[]) {
  const nodeIdMap = new Map<string, string>();
  const pinIdMap = new Map<string, string>();

  nodes.forEach((n, idx) => {
    nodeIdMap.set(n.id, `n${idx + 1}`);
  });

  const compactNodes = nodes.map((n) => {
    const newId = nodeIdMap.get(n.id)!;
    const def = getNodeDefinition(n.type);

    const props: Record<string, any> = { ...(n.properties || {}) };
    delete props.internal;
    delete props.renderAs;
    if (!props.rotation) delete props.rotation;
    if (!props.flipX) delete props.flipX;
    if (!props.flipY) delete props.flipY;
    if (props.pressed === false) delete props.pressed;

    const effectiveInputs =
      def && !def.customPins && !def.generatePins
        ? (n.inputs || []).filter(p => p.name !== 'VCC' && p.name !== 'GND')
        : n.inputs || [];
    const effectiveOutputs =
      def && !def.customPins && !def.generatePins
        ? (n.outputs || []).filter(p => p.name !== 'VCC' && p.name !== 'GND')
        : n.outputs || [];

    if (def && !def.customPins && !def.generatePins) {
      if (effectiveInputs.length !== def.numInputs) {
        props.numInputs = effectiveInputs.length;
      } else {
        delete props.numInputs;
      }
      if (effectiveOutputs.length !== def.numOutputs) {
        props.numOutputs = effectiveOutputs.length;
      } else {
        delete props.numOutputs;
      }
    }

    if (Array.isArray(props.data)) {
      let lastNonZero = props.data.length - 1;
      while (lastNonZero >= 0 && (props.data[lastNonZero] === 0 || props.data[lastNonZero] === null)) {
        lastNonZero--;
      }
      if (lastNonZero < 0) {
        delete props.data;
      } else {
        props.data = props.data.slice(0, lastNonZero + 1);
      }
    }

    // Build canonical pins for the new node ID and map old pin IDs -> new canonical pin IDs
    if (def) {
      const { inputs: newInputs, outputs: newOutputs } = buildNodePins(
        newId,
        n.type,
        props,
        effectiveInputs.length,
        effectiveOutputs.length
      );

      effectiveInputs.forEach((oldPin, i) => {
        const match = (oldPin.name && newInputs.find(p => p.name === oldPin.name)) || newInputs[i];
        if (match) {
          pinIdMap.set(oldPin.id, match.id);
        }
      });

      effectiveOutputs.forEach((oldPin, i) => {
        const match = (oldPin.name && newOutputs.find(p => p.name === oldPin.name)) || newOutputs[i];
        if (match) {
          pinIdMap.set(oldPin.id, match.id);
        }
      });
    }

    const outNode: Record<string, any> = {
      id: newId,
      type: n.type,
      x: n.x,
      y: n.y,
    };

    if (Object.keys(props).length > 0) {
      outNode.properties = props;
    }

    if (!def) {
      outNode.inputs = n.inputs;
      outNode.outputs = n.outputs;
    }

    return outNode;
  });

  const compactWires = wires.map((w, idx) => {
    const srcNodeId = nodeIdMap.get(w.sourceNodeId) || w.sourceNodeId;
    const tgtNodeId = w.targetNodeId ? (nodeIdMap.get(w.targetNodeId) || w.targetNodeId) : w.targetNodeId;
    const srcPinId =
      pinIdMap.get(w.sourcePinId) ||
      w.sourcePinId.replace(`pin-${w.sourceNodeId}-`, `pin-${srcNodeId}-`);
    const tgtPinId = w.targetPinId
      ? pinIdMap.get(w.targetPinId) ||
        w.targetPinId.replace(`pin-${w.targetNodeId}-`, `pin-${tgtNodeId}-`)
      : undefined;

    const outWire: Record<string, any> = {
      id: `w${idx + 1}`,
      sourceNodeId: srcNodeId,
      sourcePinId: srcPinId,
      targetNodeId: tgtNodeId,
      targetPinId: tgtPinId,
    };

    if (w.waypoints && w.waypoints.length > 0) {
      outWire.waypoints = w.waypoints;
    }

    return outWire;
  });

  return { nodes: compactNodes, wires: compactWires };
}

export function serializeCircuit(
  nodes: LogicNode[],
  wires: Wire[],
  savedCircuits?: Record<string, { name: string; nodes: LogicNode[]; wires: Wire[] }>,
  simSpeed?: number
): string {
  const main = serializeNodesAndWires(nodes, wires);

  const subcircuitsOut: Record<string, { name: string; nodes: any[]; wires: any[] }> = {};
  if (savedCircuits) {
    for (const [id, sub] of Object.entries(savedCircuits)) {
      if (id === 'main') continue;
      const serializedSub = serializeNodesAndWires(sub.nodes || [], sub.wires || []);
      subcircuitsOut[id] = {
        name: sub.name,
        nodes: serializedSub.nodes,
        wires: serializedSub.wires,
      };
    }
  }

  const lines: string[] = [];
  lines.push('{');
  lines.push('  "version": 2,');

  if (typeof simSpeed === 'number' && Number.isFinite(simSpeed) && simSpeed > 0) {
    lines.push(`  "simSpeed": ${simSpeed},`);
  }

  if (Object.keys(subcircuitsOut).length > 0) {
    lines.push(`  "subcircuits": ${JSON.stringify(subcircuitsOut)},`);
  }

  lines.push('  "nodes": [');
  main.nodes.forEach((n, i) => {
    const comma = i < main.nodes.length - 1 ? ',' : '';
    lines.push(`    ${JSON.stringify(n)}${comma}`);
  });
  lines.push('  ],');

  lines.push('  "wires": [');
  main.wires.forEach((w, i) => {
    const comma = i < main.wires.length - 1 ? ',' : '';
    lines.push(`    ${JSON.stringify(w)}${comma}`);
  });
  lines.push('  ]');
  lines.push('}');

  return lines.join('\n') + '\n';
}

function hydrateNodesAndWires(rawNodes: any[], rawWires: any[]): { nodes: LogicNode[]; wires: Wire[] } {
  const safeNodes = Array.isArray(rawNodes)
    ? rawNodes.filter((n) => n && typeof n === 'object' && typeof n.id === 'string' && typeof n.type === 'string')
    : [];

  const nodes: LogicNode[] = safeNodes.map((rawNode) => {
    const def = getNodeDefinition(rawNode.type);
    const properties: Record<string, any> = {
      ...(def?.defaultProperties ? structuredClone(def.defaultProperties) : {}),
      ...(rawNode.properties && typeof rawNode.properties === 'object' ? rawNode.properties : {}),
    };
    delete properties.internal;
    if (def?.renderAs) {
      properties.renderAs = def.renderAs;
    }

    let inputs: Pin[] = rawNode.inputs;
    let outputs: Pin[] = rawNode.outputs;

    if (!Array.isArray(inputs) || !Array.isArray(outputs)) {
      const built = buildNodePins(
        rawNode.id,
        rawNode.type,
        properties,
        properties.numInputs,
        properties.numOutputs
      );
      inputs = built.inputs;
      outputs = built.outputs;
    }

    return {
      id: rawNode.id,
      type: rawNode.type,
      x: typeof rawNode.x === 'number' && Number.isFinite(rawNode.x) ? rawNode.x : 0,
      y: typeof rawNode.y === 'number' && Number.isFinite(rawNode.y) ? rawNode.y : 0,
      inputs,
      outputs,
      properties,
    };
  });

  const safeWires = Array.isArray(rawWires)
    ? rawWires.filter(
        (w) =>
          w &&
          typeof w === 'object' &&
          typeof w.id === 'string' &&
          typeof w.sourceNodeId === 'string' &&
          typeof w.sourcePinId === 'string' &&
          typeof w.targetNodeId === 'string' &&
          typeof w.targetPinId === 'string'
      )
    : [];

  const wires: Wire[] = safeWires.map((rawWire) => ({
    id: rawWire.id,
    sourceNodeId: rawWire.sourceNodeId,
    sourcePinId: rawWire.sourcePinId,
    targetNodeId: rawWire.targetNodeId,
    targetPinId: rawWire.targetPinId,
    ...(Array.isArray(rawWire.waypoints) && rawWire.waypoints.length > 0 ? { waypoints: rawWire.waypoints } : {}),
  }));

  return { nodes, wires };
}

export function deserializeCircuit(rawData: any): {
  nodes: LogicNode[];
  wires: Wire[];
  subcircuits?: Record<string, { name: string; nodes: LogicNode[]; wires: Wire[]; history: any[]; future: any[] }>;
  simSpeed?: number;
} {
  let hydratedSubcircuits:
    | Record<string, { name: string; nodes: LogicNode[]; wires: Wire[]; history: any[]; future: any[] }>
    | undefined;

  if (rawData?.subcircuits && typeof rawData.subcircuits === 'object') {
    hydratedSubcircuits = {};
    for (const [id, sub] of Object.entries<any>(rawData.subcircuits)) {
      if (!sub || typeof sub !== 'object') continue;
      const hydrated = hydrateNodesAndWires(sub.nodes || [], sub.wires || []);
      updateSubcircuitRegistry(id, sub.name || 'Subcircuit', hydrated.nodes);
      hydratedSubcircuits[id] = {
        name: sub.name || 'Subcircuit',
        nodes: hydrated.nodes,
        wires: hydrated.wires,
        history: [],
        future: [],
      };
    }
  }

  const simSpeed =
    typeof rawData?.simSpeed === 'number' && Number.isFinite(rawData.simSpeed) && rawData.simSpeed > 0
      ? rawData.simSpeed
      : undefined;

  const { nodes, wires } = hydrateNodesAndWires(rawData?.nodes || [], rawData?.wires || []);
  return { nodes, wires, subcircuits: hydratedSubcircuits, simSpeed };
}
