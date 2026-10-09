import re

with open('src/ui/canvas/nodes/schematic/SchematicICNode.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "text={def?.type || 'IC'}",
    "text={def?.type?.startsWith('SUBCIRCUIT:') ? def.label : (def?.type || 'IC')}"
)

with open('src/ui/canvas/nodes/schematic/SchematicICNode.tsx', 'w') as f:
    f.write(content)

