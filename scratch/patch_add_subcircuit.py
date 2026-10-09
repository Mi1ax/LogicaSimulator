import re

with open('src/store/useSimulatorStore.ts', 'r') as f:
    content = f.read()

old_logic = """  addSubcircuit: (name) => set((state) => ({ 
    savedCircuits: { ...state.savedCircuits, [generateId('circuit')]: { name, nodes: [], wires: [], boardTraces: [], history: [], future: [] } }
  })),"""
new_logic = """  addSubcircuit: (name) => set((state) => {
    const id = generateId('circuit');
    updateSubcircuitRegistry(id, name, []);
    return {
      savedCircuits: { ...state.savedCircuits, [id]: { name, nodes: [], wires: [], boardTraces: [], history: [], future: [] } }
    };
  }),"""

content = content.replace(old_logic, new_logic)

with open('src/store/useSimulatorStore.ts', 'w') as f:
    f.write(content)
