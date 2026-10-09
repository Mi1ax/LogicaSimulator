import re

with open('src/ui/canvas/SchematicCanvas.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { SchematicIONode } from './nodes/schematic/SchematicIONode';", "import { SchematicIONode } from './nodes/schematic/SchematicIONode';\nimport { SchematicNetLabelNode } from './nodes/schematic/SchematicNetLabelNode';")

content = content.replace(
    "case 'NET_LABEL':\n        return <SchematicNetLabelNode key={node.id} node={node} />;",
    "case 'NET_LABEL':\n      case 'SUB_IN':\n      case 'SUB_OUT':\n      case 'SUB_IO':\n        return <SchematicNetLabelNode key={node.id} node={node} />;"
)

with open('src/ui/canvas/SchematicCanvas.tsx', 'w') as f:
    f.write(content)
