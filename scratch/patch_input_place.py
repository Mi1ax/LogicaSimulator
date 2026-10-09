import re

with open('src/ui/canvas/nodes/schematic/SchematicIONode.tsx', 'r') as f:
    content = f.read()

old_onClick = """              onClick={(e) => {
                const store = useSimulatorStore.getState();
                if (!store.placingNodeId) {
                  e.cancelBubble = true;
                  toggleInputNode(node.id);
                }
              }}"""

new_onClick = """              onClick={(e) => {
                if (!isPlacing) {
                  e.cancelBubble = true;
                  toggleInputNode(node.id);
                }
              }}"""

content = content.replace(old_onClick, new_onClick)

with open('src/ui/canvas/nodes/schematic/SchematicIONode.tsx', 'w') as f:
    f.write(content)
