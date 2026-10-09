import re

with open('src/core/engine/simulation.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "const internalNodeId = chipPin.id.replace('in_', '');",
    "const internalNodeId = chipPin.internalNodeId;"
)
content = content.replace(
    "const internalNodeId = chipPin.id.replace('out_', '');",
    "const internalNodeId = chipPin.internalNodeId;"
)

with open('src/core/engine/simulation.ts', 'w') as f:
    f.write(content)
