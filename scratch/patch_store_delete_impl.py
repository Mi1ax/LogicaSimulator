import re

with open('src/store/useSimulatorStore.ts', 'r') as f:
    content = f.read()

delete_logic = """
  deleteSubcircuit: (id) => set((state) => {
    if (id === 'main') return state; // Cannot delete main
    
    const newSaved = { ...state.savedCircuits };
    delete newSaved[id];
    
    if (state.activeSubcircuitId === id) {
      const target = newSaved['main'];
      const synced = syncSubcircuitInstances(target.nodes, target.wires);
      
      return {
        savedCircuits: newSaved,
        activeSubcircuitId: 'main',
        nodes: synced.nodes,
        wires: synced.wires,
        boardTraces: target.boardTraces,
        history: target.history,
        future: target.future,
        selection: null,
        multiSelection: [],
        placingNodeId: null,
        draftWire: null,
        draftBoardTrace: null
      };
    }
    
    return { savedCircuits: newSaved };
  }),
"""

content = content.replace(
    "theme: 'dark',",
    delete_logic + "\n  theme: 'dark',"
)

with open('src/store/useSimulatorStore.ts', 'w') as f:
    f.write(content)

