import re

with open('src/ui/components/Toolbox.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const subcircuits = useSimulatorStore((state) => state.subcircuits);",
    "const savedCircuits = useSimulatorStore((state) => state.savedCircuits);\n  const subcircuits = Object.entries(savedCircuits).map(([id, sc]) => ({id, name: sc.name}));"
)

with open('src/ui/components/Toolbox.tsx', 'w') as f:
    f.write(content)

