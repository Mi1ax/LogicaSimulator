import re

with open('src/store/useSimulatorStore.ts', 'r') as f:
    content = f.read()

# Find: computeNextState(state.nodes, state.wires, state.simState)
# Replace: computeNextState(state.nodes, state.wires, state.simState, state.savedCircuits)
content = content.replace(
    "computeNextState(state.nodes, state.wires, state.simState)",
    "computeNextState(state.nodes, state.wires, state.simState, state.savedCircuits)"
)
content = content.replace(
    "computeNextState(state.nodes, state.wires, nextSimState)",
    "computeNextState(state.nodes, state.wires, nextSimState, state.savedCircuits)"
)

with open('src/store/useSimulatorStore.ts', 'w') as f:
    f.write(content)
