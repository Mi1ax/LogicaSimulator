import re

with open('src/core/engine/nodes/index.ts', 'r') as f:
    content = f.read()

content = content.replace("InputNode, OutputNode, ClockNode,", "SubInNode, SubOutNode, SubIoNode, ClockNode,")

content = content.replace("  [InputNode.type]: InputNode,\n  [OutputNode.type]: OutputNode,", "  [SubInNode.type]: SubInNode,\n  [SubOutNode.type]: SubOutNode,\n  [SubIoNode.type]: SubIoNode,")

with open('src/core/engine/nodes/index.ts', 'w') as f:
    f.write(content)
