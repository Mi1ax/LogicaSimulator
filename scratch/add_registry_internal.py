import re

with open('src/core/engine/subcircuitRegistry.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "pinNumber: i + 1",
    "pinNumber: i + 1,\n      internalNodeId: n.id"
)
content = content.replace(
    "pinNumber: inputs.length + i + 1",
    "pinNumber: inputs.length + i + 1,\n      internalNodeId: n.id"
)

with open('src/core/engine/subcircuitRegistry.ts', 'w') as f:
    f.write(content)
