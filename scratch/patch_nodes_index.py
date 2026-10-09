import re

with open('src/core/engine/nodes/index.ts', 'r') as f:
    content = f.read()

# Add import
import_str = "import { SubcircuitRegistry } from '../subcircuitRegistry';\n"
content = import_str + content

# Modify getNodeDefinition
content = re.sub(
    r"export const getNodeDefinition = \(type: string\): NodeDefinition \| undefined => \{\n  return NodeRegistry\[type\];\n\};",
    "export const getNodeDefinition = (type: string): NodeDefinition | undefined => {\n  if (type.startsWith('SUBCIRCUIT:')) return SubcircuitRegistry[type];\n  return NodeRegistry[type];\n};",
    content
)

with open('src/core/engine/nodes/index.ts', 'w') as f:
    f.write(content)
