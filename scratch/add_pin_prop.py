import re

with open('src/core/engine/nodes/NodeDefinition.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "schematicRow?: number; // Logical index for schematic layout (1-indexed)",
    "schematicRow?: number; // Logical index for schematic layout (1-indexed)\n  internalNodeId?: string; // For SUBCIRCUIT pins to map to internal nodes"
)

with open('src/core/engine/nodes/NodeDefinition.ts', 'w') as f:
    f.write(content)
