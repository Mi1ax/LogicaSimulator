import re

with open('src/ui/canvas/nodes/schematic/SchematicButtonNode.tsx', 'r') as f:
    content = f.read()

# For onMouseDown
content = content.replace("""        onMouseDown={(e) => {
          e.cancelBubble = true;
          if (!isPlacing) {
            updateNodeProperties(node.id, { pressed: true });
          }
        }}""", """        onMouseDown={(e) => {
          if (!isPlacing) {
            e.cancelBubble = true;
            updateNodeProperties(node.id, { pressed: true });
          }
        }}""")

# For onMouseUp
content = content.replace("""        onMouseUp={(e) => {
          e.cancelBubble = true;
          if (!isPlacing) {
            updateNodeProperties(node.id, { pressed: false });
          }
        }}""", """        onMouseUp={(e) => {
          if (!isPlacing) {
            e.cancelBubble = true;
            updateNodeProperties(node.id, { pressed: false });
          }
        }}""")

# For onClick
content = content.replace("""        onClick={(e) => {
          e.cancelBubble = true;
        }}""", """        onClick={(e) => {
          if (!isPlacing) {
            e.cancelBubble = true;
          }
        }}""")

with open('src/ui/canvas/nodes/schematic/SchematicButtonNode.tsx', 'w') as f:
    f.write(content)
