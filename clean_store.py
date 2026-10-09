import re

with open('src/store/useSimulatorStore.ts', 'r') as f:
    content = f.read()

# Selection
content = content.replace("'boardTrace'", "/* removed */")
content = content.replace(" | /* removed */", "")
# PointerSettings
content = re.sub(r'\s*boardWidthMm:\s*number;', '', content)
content = re.sub(r'\s*boardHeightMm:\s*number;', '', content)
# appMode
content = content.replace("'board' | ", "")
# boardTraces in savedCircuits
content = content.replace(", boardTraces: import('../core/models/types').BoardTrace[]", "")
content = content.replace(", boardTraces: structuredClone(state.boardTraces || [])", "")
content = content.replace(", boardTraces: structuredClone(state.boardTraces)", "")
content = content.replace("boardTraces: structuredClone(previous.boardTraces),", "")
content = content.replace("boardTraces: structuredClone(next.boardTraces),", "")
content = content.replace(", boardTraces: state.boardTraces", "")
content = content.replace("boardTraces: state.boardTraces,", "")
content = content.replace("boardTraces: state.boardTraces", "")
content = content.replace(", boardTraces: []", "")
content = content.replace("boardTraces: [],", "")
content = content.replace("boardTraces: target.boardTraces,", "")

# activeWireType
content = re.sub(r'\s*activeWireType:.*?;', '', content)
content = re.sub(r'\s*setActiveWireType:.*?;', '', content)
# startPlacingBoardNode
content = re.sub(r'\s*startPlacingBoardNode:.*?;', '', content)

# board drawing state
content = re.sub(r'\s*// Board drawing state.*?// Simulation State', '  // Simulation State', content, flags=re.DOTALL)
content = re.sub(r'\s*boardScale:.*?;', '', content)
content = re.sub(r'\s*setBoardScale:.*?;', '', content)

# history
content = content.replace("boardTraces: import('../core/models/types').BoardTrace[] ", "")

# deleteSelection
content = re.sub(r'if \(state\.appMode === \'board\'\) \{.*?} else \{(\s*let nextState = \{ \.\.\.state \};)', r'\1', content, flags=re.DOTALL)
content = content.replace('return { ...nextState, ...pushHistory(state), selection: null, multiSelection: [], selectedMemoryNodeId: nextSelectedMemoryNodeId };\n    }', 'return { ...nextState, ...pushHistory(state), selection: null, multiSelection: [], selectedMemoryNodeId: nextSelectedMemoryNodeId };')

# cancelPlacingNode
content = re.sub(r'if \(state\.appMode === \'schematic\'\) \{\s*(return \{ \.\.\.state, \.\.\.circuit\.deleteNode\(state, state\.placingNodeId\), placingNodeId: null \};)\s*\} else \{.*?\}', r'\1', content, flags=re.DOTALL)

# updateNodePosition
content = content.replace('state.appMode === \'board\'', 'false')

# addWire calls
content = content.replace("state.appMode === 'board' ? state.activeWireType : undefined", "undefined")

# partialize
content = content.replace("boardTraces: state.boardTraces,", "")

with open('src/store/useSimulatorStore.ts', 'w') as f:
    f.write(content)

