import re

with open('src/core/engine/simulation.ts', 'r') as f:
    content = f.read()

# Add flattenCircuit
flatten_code = """
export const flattenCircuit = (
  rootNodes: LogicNode[],
  rootWires: Wire[],
  savedCircuits: Record<string, { nodes: LogicNode[], wires: Wire[] }>,
  prefix: string = ''
): { nodes: LogicNode[], wires: Wire[] } => {
  let flatNodes: LogicNode[] = [];
  let flatWires: Wire[] = [...rootWires.map(w => ({
    ...w,
    id: `${prefix}${w.id}`,
    sourceNodeId: `${prefix}${w.sourceNodeId}`,
    sourcePinId: `${prefix}${w.sourcePinId}`,
    targetNodeId: `${prefix}${w.targetNodeId}`,
    targetPinId: `${prefix}${w.targetPinId}`
  }))];

  rootNodes.forEach(node => {
    if (node.type.startsWith('SUBCIRCUIT:')) {
      const subId = node.type.split(':')[1];
      const sub = savedCircuits[subId];
      if (sub) {
        const subPrefix = `${prefix}${node.id}_`;
        
        const flattened = flattenCircuit(sub.nodes, sub.wires, savedCircuits, subPrefix);
        flatNodes.push(...flattened.nodes);
        flatWires.push(...flattened.wires);

        node.inputs.forEach((chipPin) => {
          const internalNodeId = chipPin.id.replace('in_', '');
          const internalNode = sub.nodes.find(n => n.id === internalNodeId);
          if (internalNode && internalNode.outputs[0]) {
            flatWires.push({
              id: `vw_subin_${prefix}${chipPin.id}`,
              sourceNodeId: `${prefix}${node.id}`,
              sourcePinId: `${prefix}${chipPin.id}`,
              targetNodeId: `${subPrefix}${internalNode.id}`,
              targetPinId: `${subPrefix}${internalNode.outputs[0].id}`
            });
          }
        });
        
        node.outputs.forEach((chipPin) => {
          const internalNodeId = chipPin.id.replace('out_', '');
          const internalNode = sub.nodes.find(n => n.id === internalNodeId);
          if (internalNode && internalNode.inputs[0]) {
            flatWires.push({
              id: `vw_subout_${prefix}${chipPin.id}`,
              sourceNodeId: `${subPrefix}${internalNode.id}`,
              sourcePinId: `${subPrefix}${internalNode.inputs[0].id}`,
              targetNodeId: `${prefix}${node.id}`,
              targetPinId: `${prefix}${chipPin.id}`
            });
          }
        });
        
        flatNodes.push({
          ...node,
          id: `${prefix}${node.id}`,
          inputs: node.inputs.map(p => ({ ...p, id: `${prefix}${p.id}` })),
          outputs: node.outputs.map(p => ({ ...p, id: `${prefix}${p.id}` }))
        });
      }
    } else {
      flatNodes.push({
        ...node,
        id: `${prefix}${node.id}`,
        inputs: node.inputs.map(p => ({ ...p, id: `${prefix}${p.id}` })),
        outputs: node.outputs.map(p => ({ ...p, id: `${prefix}${p.id}` }))
      });
    }
  });

  return { nodes: flatNodes, wires: flatWires };
};

"""

# Modify computeNextState signature and body
content = re.sub(
    r"export const computeNextState = \(\n  nodes: LogicNode\[\],\n  baseWires: Wire\[\],\n  prevState: SimulationState\n\): SimulationState => \{",
    "export const computeNextState = (\n  rootNodes: LogicNode[],\n  rootWires: Wire[],\n  prevState: SimulationState,\n  savedCircuits: Record<string, { nodes: LogicNode[], wires: Wire[] }> = {}\n): SimulationState => {\n  const { nodes, wires: baseWires } = flattenCircuit(rootNodes, rootWires, savedCircuits);\n",
    content
)

content = content.replace("import { getNodeDefinition } from './nodes';", "import { getNodeDefinition } from './nodes';\n" + flatten_code)

with open('src/core/engine/simulation.ts', 'w') as f:
    f.write(content)
