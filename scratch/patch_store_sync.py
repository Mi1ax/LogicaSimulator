import re

with open('src/store/useSimulatorStore.ts', 'r') as f:
    content = f.read()

# Add import
if "import { syncSubcircuitInstances }" not in content:
    content = content.replace("import * as circuit from '../core/engine/circuit';", "import * as circuit from '../core/engine/circuit';\nimport { syncSubcircuitInstances } from '../core/engine/circuit';")

# Replace setActiveSubcircuit logic
old_logic = """
    // Load new from savedCircuits
    const target = newSaved[id] || { name: 'Unknown', nodes: [], wires: [], boardTraces: [], history: [], future: [] };
    
    return {
      savedCircuits: newSaved,
      activeSubcircuitId: id,
      nodes: target.nodes,
      wires: target.wires,
"""
new_logic = """
    // Load new from savedCircuits
    let target = newSaved[id] || { name: 'Unknown', nodes: [], wires: [], boardTraces: [], history: [], future: [] };
    
    // Sync instantiated subcircuits
    const synced = syncSubcircuitInstances(target.nodes, target.wires);
    target = { ...target, nodes: synced.nodes, wires: synced.wires };
    
    return {
      savedCircuits: newSaved,
      activeSubcircuitId: id,
      nodes: target.nodes,
      wires: target.wires,
"""
content = content.replace(old_logic, new_logic)

with open('src/store/useSimulatorStore.ts', 'w') as f:
    f.write(content)

