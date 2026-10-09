import re

with open('src/store/useSimulatorStore.ts', 'r') as f:
    content = f.read()

# Remove the import from the bottom
content = content.replace("import { updateSubcircuitRegistry } from '../core/engine/subcircuitRegistry';", "")

# Add it to the top
content = "import { updateSubcircuitRegistry } from '../core/engine/subcircuitRegistry';\n" + content

with open('src/store/useSimulatorStore.ts', 'w') as f:
    f.write(content)
