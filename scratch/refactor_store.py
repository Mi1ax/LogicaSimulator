import re

with open('src/store/useSimulatorStore.ts', 'r') as f:
    content = f.read()

# 1. Update interface SimulatorState
# Find: subcircuits: { id: string; name: string }[];
# Replace with: savedCircuits: Record<string, { name: string, nodes: LogicNode[], wires: Wire[], boardTraces: import('../core/models/types').BoardTrace[], history: any[], future: any[] }>;
content = re.sub(
    r"subcircuits:\s*\{\s*id:\s*string;\s*name:\s*string\s*\}(\[\])?;?",
    "savedCircuits: Record<string, { name: string, nodes: LogicNode[], wires: Wire[], boardTraces: import('../core/models/types').BoardTrace[], history: any[], future: any[] }>;",
    content
)

# 2. Update initial state
# Find: subcircuits: [{ id: 'main', name: 'Main' }],
# Replace with: savedCircuits: { 'main': { name: 'Main', nodes: [], wires: [], boardTraces: [], history: [], future: [] } },
content = re.sub(
    r"subcircuits:\s*\[\{\s*id:\s*'main',\s*name:\s*'Main'\s*\}\],",
    "savedCircuits: { 'main': { name: 'Main', nodes: [], wires: [], boardTraces: [], history: [], future: [] } },",
    content
)

# 3. Update addSubcircuit
# Find: subcircuits: [...state.subcircuits, { id: generateId('circuit'), name }]
# Replace with: savedCircuits: { ...state.savedCircuits, [generateId('circuit')]: { name, nodes: [], wires: [], boardTraces: [], history: [], future: [] } }
content = re.sub(
    r"subcircuits:\s*\[\.\.\.state\.subcircuits,\s*\{\s*id:\s*generateId\('circuit'\),\s*name\s*\}\]",
    "savedCircuits: { ...state.savedCircuits, [generateId('circuit')]: { name, nodes: [], wires: [], boardTraces: [], history: [], future: [] } }",
    content
)

# 4. Update setActiveSubcircuit
# Find:
#   setActiveSubcircuit: (id) => set({ activeSubcircuitId: id }),
# Replace with:
"""
  setActiveSubcircuit: (id) => set((state) => {
    if (state.activeSubcircuitId === id) return {};
    
    // Save current to savedCircuits
    const newSaved = {
      ...state.savedCircuits,
      [state.activeSubcircuitId]: {
        name: state.savedCircuits[state.activeSubcircuitId]?.name || 'Unknown',
        nodes: state.nodes,
        wires: state.wires,
        boardTraces: state.boardTraces,
        history: state.history,
        future: state.future
      }
    };
    
    // Load new from savedCircuits
    const target = newSaved[id] || { name: 'Unknown', nodes: [], wires: [], boardTraces: [], history: [], future: [] };
    
    return {
      savedCircuits: newSaved,
      activeSubcircuitId: id,
      nodes: target.nodes,
      wires: target.wires,
      boardTraces: target.boardTraces,
      history: target.history,
      future: target.future,
      selection: null,
      multiSelection: [],
      placingNodeId: null,
      draftWire: null,
      draftBoardTrace: null
    };
  }),
"""
content = re.sub(
    r"setActiveSubcircuit:\s*\(id\)\s*=>\s*set\(\{\s*activeSubcircuitId:\s*id\s*\}\),",
    """setActiveSubcircuit: (id) => set((state) => {
    if (state.activeSubcircuitId === id) return {};
    
    // Save current to savedCircuits
    const newSaved = {
      ...state.savedCircuits,
      [state.activeSubcircuitId]: {
        name: state.savedCircuits[state.activeSubcircuitId]?.name || 'Unknown',
        nodes: state.nodes,
        wires: state.wires,
        boardTraces: state.boardTraces,
        history: state.history,
        future: state.future
      }
    };
    
    // Load new from savedCircuits
    const target = newSaved[id] || { name: 'Unknown', nodes: [], wires: [], boardTraces: [], history: [], future: [] };
    
    return {
      savedCircuits: newSaved,
      activeSubcircuitId: id,
      nodes: target.nodes,
      wires: target.wires,
      boardTraces: target.boardTraces,
      history: target.history,
      future: target.future,
      selection: null,
      multiSelection: [],
      placingNodeId: null,
      draftWire: null,
      draftBoardTrace: null
    };
  }),""",
    content
)

with open('src/store/useSimulatorStore.ts', 'w') as f:
    f.write(content)

