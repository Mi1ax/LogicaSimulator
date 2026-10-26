import { LogicNode, Wire, Signal } from '../models/types';

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

  const flatNodes: LogicNode[] = [];
  const flatWires: Wire[] =
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
  /** Live memory snapshots for SRAM nodes, keyed by node id. */
  nodeStates?: Record<string, Record<string, any>>;
}
