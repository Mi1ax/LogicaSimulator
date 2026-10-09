import re

with open('src/core/engine/simulation.ts', 'r') as f:
    content = f.read()

# I need to add a pass that clears `evaluate` for SUB_IN and SUB_IO when flattening inside a subcircuit!
# Inside flattenCircuit:
#     if (node.type.startsWith('SUBCIRCUIT:')) {
#        ...
#        const flattened = flattenCircuit(sub.nodes, sub.wires, savedCircuits, subPrefix);
# Wait, `flattenCircuit` processes nodes and pushes to `flatNodes`.
# But wait! The virtual wire connects to `internalNode.outputs[0].id`.
# If the internal node is `SUB_IN`, it has `evaluate` returning `[props?.value]`.
# I should just modify `flatNodes.push` inside the `else` block (or generally for all nodes):

replacement = """    } else {
      let strippedEvaluate = undefined;
      // If we are inside a subcircuit (prefix !== ''), we must strip the evaluate of SUB_IN and SUB_IO 
      // so they don't generate their own signals and collide with the parent's signals!
      if (prefix !== '' && (node.type === 'SUB_IN' || node.type === 'SUB_IO')) {
        strippedEvaluate = true; // Flag to indicate we shouldn't evaluate this
      }
      
      flatNodes.push({
        ...node,
        id: `${prefix}${node.id}`,
        inputs: node.inputs.map(p => ({ ...p, id: `${prefix}${p.id}` })),
        outputs: node.outputs.map(p => ({ ...p, id: `${prefix}${p.id}` })),
        // A hack: we can store a property to disable evaluation
        properties: { ...node.properties, _isFlattened: prefix !== '' }
      });
    }"""

content = re.sub(
    r"    \} else \{\n      flatNodes\.push\(\{\n        \.\.\.node,\n        id: `\$\{prefix\}\$\{node\.id\}`,[\s\S]*?\n      \}\);\n    \}",
    replacement,
    content
)

with open('src/core/engine/simulation.ts', 'w') as f:
    f.write(content)

