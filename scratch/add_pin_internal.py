import re

with open('src/core/engine/circuit.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "pinNumber: cp.pinNumber,",
    "pinNumber: cp.pinNumber,\n        internalNodeId: cp.internalNodeId,"
)

with open('src/core/engine/circuit.ts', 'w') as f:
    f.write(content)

with open('src/core/models/types.ts', 'r') as f:
    types = f.read()
    
types = types.replace(
    "pinNumber?: number;",
    "pinNumber?: number;\n  internalNodeId?: string;"
)

with open('src/core/models/types.ts', 'w') as f:
    f.write(types)
