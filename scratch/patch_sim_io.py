import re

with open('src/core/engine/simulation.ts', 'r') as f:
    content = f.read()

# I need to update the part where virtual wires are created for SUB_IN and SUB_OUT, and now SUB_IO
# Let's completely rewrite the flattened pin mapping part.

new_mapping = """        node.inputs.forEach((chipPin) => {
          const internalNode = sub.nodes.find(n => n.id === chipPin.internalNodeId);
          if (internalNode) {
            // For SUB_IN, the internal node has an output pin. 
            // For SUB_IO, the internal node has a bidir pin.
            // chipPin gets signal from parent, so virtual wire goes from chipPin (source) to internal node's pin (target).
            const internalPin = internalNode.outputs[0] || internalNode.inputs[0];
            if (internalPin) {
              flatWires.push({
                id: `vw_subin_${prefix}${chipPin.id}`,
                sourceNodeId: `${prefix}${node.id}`,
                sourcePinId: `${prefix}${chipPin.id}`,
                targetNodeId: `${subPrefix}${internalNode.id}`,
                targetPinId: `${subPrefix}${internalPin.id}`
              });
            }
          }
        });
        
        node.outputs.forEach((chipPin) => {
          const internalNode = sub.nodes.find(n => n.id === chipPin.internalNodeId);
          if (internalNode && internalNode.inputs[0]) {
            // Signal propagates from internal OUTPUT node's input pin to the chip's output pin
            flatWires.push({
              id: `vw_subout_${prefix}${chipPin.id}`,
              sourceNodeId: `${subPrefix}${internalNode.id}`,
              sourcePinId: `${subPrefix}${internalNode.inputs[0].id}`,
              targetNodeId: `${prefix}${node.id}`,
              targetPinId: `${prefix}${chipPin.id}`
            });
          }
        });"""

old_mapping = re.search(r"        node\.inputs\.forEach\(\(chipPin\) => \{[\s\S]*?        \}\);", content).group(0)

content = content.replace(old_mapping, new_mapping)

with open('src/core/engine/simulation.ts', 'w') as f:
    f.write(content)

