import re

with open('src/core/engine/subcircuitRegistry.ts', 'r') as f:
    content = f.read()

content = content.replace("n.type === 'INPUT'", "n.type === 'SUB_IN'")
content = content.replace("n.type === 'OUTPUT'", "n.type === 'SUB_OUT'")

# What about SUB_IO? We need to add it to the pins.
# A SUB_IO will act as a bidir pin.
new_io_logic = """  const inputs = nodes.filter(n => n.type === 'SUB_IN');
  const outputs = nodes.filter(n => n.type === 'SUB_OUT');
  const ios = nodes.filter(n => n.type === 'SUB_IO');

  const customPins: PinDefinition[] = [];
  
  let currentPin = 1;
  inputs.forEach((n, i) => {
    customPins.push({
      name: n.properties?.label || `IN${i}`,
      type: 'input',
      schematicSide: 'left',
      schematicRow: i + 1,
      pinNumber: currentPin++,
      internalNodeId: n.id
    });
  });

  ios.forEach((n, i) => {
    customPins.push({
      name: n.properties?.label || `IO${i}`,
      type: 'bidir',
      schematicSide: 'left',
      schematicRow: inputs.length + i + 1,
      pinNumber: currentPin++,
      internalNodeId: n.id
    });
  });

  outputs.forEach((n, i) => {
    customPins.push({
      name: n.properties?.label || `OUT${i}`,
      type: 'output',
      schematicSide: 'right',
      schematicRow: i + 1,
      pinNumber: currentPin++,
      internalNodeId: n.id
    });
  });

  return {
    type: `SUBCIRCUIT:${id}`,
    label: name,
    numInputs: inputs.length,
    numOutputs: outputs.length,
"""

old_logic = re.search(r"  const inputs = nodes\.filter[\s\S]*?numOutputs: outputs\.length,", content).group(0)

content = content.replace(old_logic, new_io_logic)

with open('src/core/engine/subcircuitRegistry.ts', 'w') as f:
    f.write(content)
