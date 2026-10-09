import re

with open('src/ui/components/CircuitTabs.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const addSubcircuit = useSimulatorStore(state => state.addSubcircuit);",
    "const addSubcircuit = useSimulatorStore(state => state.addSubcircuit);\n  const deleteSubcircuit = useSimulatorStore(state => state.deleteSubcircuit);"
)

content = content.replace(
    "onClick={(e) => { e.stopPropagation(); /* TODO: close */ }}",
    "onClick={(e) => { e.stopPropagation(); if (confirm('Delete subcircuit?')) deleteSubcircuit(sc.id); }}"
)

with open('src/ui/components/CircuitTabs.tsx', 'w') as f:
    f.write(content)
