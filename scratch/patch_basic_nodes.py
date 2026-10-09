import re

with open('src/core/engine/nodes/basicNodes.ts', 'r') as f:
    content = f.read()

old_nodes = """export const InputNode: NodeDefinition = {
  type: 'INPUT',
  label: 'Input Switch',
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { value: 0 },
  evaluate: (_, props) => {
    return [props?.value === 1 ? 1 : 0];
  }
};

export const OutputNode: NodeDefinition = {
  type: 'OUTPUT',
  label: 'Output LED',
  numInputs: 1,
  numOutputs: 0,
  evaluate: () => [] // Passive receiver
};"""

new_nodes = """export const SubInNode: NodeDefinition = {
  type: 'SUB_IN',
  label: 'Subcircuit Input',
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { value: 0 },
  evaluate: (_, props) => {
    return [props?.value === 1 ? 1 : 0];
  }
};

export const SubOutNode: NodeDefinition = {
  type: 'SUB_OUT',
  label: 'Subcircuit Output',
  numInputs: 1,
  numOutputs: 0,
  evaluate: () => [] // Passive receiver
};

export const SubIoNode: NodeDefinition = {
  type: 'SUB_IO',
  label: 'Subcircuit I/O',
  numInputs: 0,
  numOutputs: 0,
  customPins: [
    { name: 'IO', type: 'bidir', schematicSide: 'right' }
  ],
  evaluate: () => [] // Passive receiver
};"""

content = content.replace(old_nodes, new_nodes)

with open('src/core/engine/nodes/basicNodes.ts', 'w') as f:
    f.write(content)
