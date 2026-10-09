import { LogicNode, Wire } from '../src/core/models/types';

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
        
        // Recursively flatten the subcircuit
        const flattened = flattenCircuit(sub.nodes, sub.wires, savedCircuits, subPrefix);
        flatNodes.push(...flattened.nodes);
        flatWires.push(...flattened.wires);

        // Map the parent's chip pins to the internal INPUT/OUTPUT nodes
        // A subcircuit chip has inputs (which map to the internal INPUT nodes' outputs)
        // and outputs (which map to the internal OUTPUT nodes' inputs)
        
        // To do this, we need to know the IDs of the internal pins.
        // Wait! The chip node in the parent has its own pin IDs (e.g., node.inputs[0].id).
        // The internal INPUT node has its own output pin ID (e.g., subInputNode.outputs[0].id).
        // We need to create a virtual wire between the chip's input pin and the internal INPUT node's output pin!
        // Actually, no. The parent wire connects to the chip's input pin.
        // Inside the subcircuit, the INPUT node provides a signal to internal wires.
        // So the signal on the chip's input pin should be directly passed to the internal INPUT node's output pin?
        // Or we can just create a virtual wire: chip.inputPin -> internalInputNode.outputPin.
        
        // Let's look at how SubcircuitRegistry defines pins:
        // chip.inputs is mapped from internal INPUT nodes.
        // chip.inputs[i].id = `in_${internalInputNode.id}`.
        // Wait, if we know this, we can easily find the corresponding internal node!
        
        node.inputs.forEach((chipPin) => {
          // chipPin.id is something like `in_${internalNodeId}`
          const internalNodeId = chipPin.id.replace('in_', '');
          const internalNode = sub.nodes.find(n => n.id === internalNodeId);
          if (internalNode && internalNode.outputs[0]) {
            flatWires.push({
              id: `vw_subin_${prefix}${chipPin.id}`,
              sourceNodeId: `${prefix}${node.id}`,
              sourcePinId: `${prefix}${chipPin.id}`, // Parent's chip input pin (where the parent wire connects)
              targetNodeId: `${subPrefix}${internalNode.id}`,
              targetPinId: `${subPrefix}${internalNode.outputs[0].id}` // Internal INPUT node's output pin
            });
            
            // Wait, virtual wires normally go from output to input.
            // The parent wire connects to `targetPinId: chipPin.id`. So `chipPin.id` is an INPUT pin (target).
            // We need the signal to propagate from `chipPin.id` to `internalNode.outputs[0].id`.
            // So virtual wire: source = chipPin.id, target = internalNode.outputs[0].id.
            // But both are mathematically just pins. The simulation engine propagates from source to target.
            // Is chipPin.id acting as a source?
            // Actually, in tick-based engine, wires copy signal from sourcePin to targetPin.
            // Parent wire: nodeA.out -> chipPin.in. So chipPin.in gets the signal.
            // Virtual wire: chipPin.in -> internalNode.out. So internalNode.out gets the signal.
            // Internal wire: internalNode.out -> internalNodeB.in. So internalNodeB.in gets the signal.
            // This works PERFECTLY!
          }
        });
        
        node.outputs.forEach((chipPin) => {
          const internalNodeId = chipPin.id.replace('out_', '');
          const internalNode = sub.nodes.find(n => n.id === internalNodeId);
          if (internalNode && internalNode.inputs[0]) {
            // Signal propagates from internal OUTPUT node's input pin to the chip's output pin
            flatWires.push({
              id: `vw_subout_${prefix}${chipPin.id}`,
              sourceNodeId: `${subPrefix}${internalNode.id}`,
              sourcePinId: `${subPrefix}${internalNode.inputs[0].id}`, // Internal OUTPUT node's input pin
              targetNodeId: `${prefix}${node.id}`,
              targetPinId: `${prefix}${chipPin.id}` // Parent's chip output pin
            });
          }
        });
        
        // We ALSO need to include the chip node itself, but strip its evaluate function so it acts as a dummy pass-through
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
