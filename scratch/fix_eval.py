import re

with open('src/core/engine/subcircuitRegistry.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "evaluate: () => {}",
    "evaluate: () => []"
)

with open('src/core/engine/subcircuitRegistry.ts', 'w') as f:
    f.write(content)
