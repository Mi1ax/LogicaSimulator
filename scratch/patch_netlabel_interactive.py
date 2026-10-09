import re

with open('src/ui/canvas/nodes/schematic/SchematicNetLabelNode.tsx', 'r') as f:
    content = f.read()

# Add simState usage
sim_state_logic = """  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);
  const simState = useSimulatorStore(state => state.simState);
  
  // Use the unique bidir pin which appears in both inputs and outputs
  const pin = node.inputs[0] || node.outputs[0];
  const val = pin ? simState.pinStates[pin.id] : undefined;"""

content = content.replace(
    "  const isPlacing = useSimulatorStore(state => state.placingNodeId === node.id);\n\n  // Use the unique bidir pin",
    sim_state_logic + "\n\n  // Use the unique bidir pin"
)

# Update the port box color
box_old = """      {/* Box to make it look like a port */}
      {(node.type === 'SUB_IN' || node.type === 'SUB_OUT' || node.type === 'SUB_IO') && (
        <Rect
          x={isInputSide ? 10 : 0}
          y={height / 4}
          width={width - 10}
          height={height / 2}
          fill={canvasTheme.nodeBg}
          stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
          strokeWidth={1}
          cornerRadius={2}
        />
      )}"""

box_new = """      {/* Box to make it look like a port */}
      {(node.type === 'SUB_IN' || node.type === 'SUB_OUT' || node.type === 'SUB_IO') && (
        <Rect
          x={isInputSide ? 10 : 0}
          y={height / 4}
          width={width - 10}
          height={height / 2}
          fill={val === 1 ? '#3b82f6' : canvasTheme.nodeBg}
          stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
          strokeWidth={1}
          cornerRadius={2}
        />
      )}"""
content = content.replace(box_old, box_new)

# Add onClick toggle logic
click_old = """      onClick={(e) => {
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          store.finishPlacingNode();
          return;
        }
        select({ type: 'node', id: node.id }, e.evt.shiftKey);
      }}"""

click_new = """      onClick={(e) => {
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          e.cancelBubble = true;
          store.finishPlacingNode();
          return;
        }
        select({ type: 'node', id: node.id }, e.evt.shiftKey);
        
        if (node.type === 'SUB_IN' || node.type === 'SUB_IO') {
          e.cancelBubble = true;
          const currentValue = node.properties?.value || 0;
          store.updateNodeProperties(node.id, { value: currentValue === 1 ? 0 : 1 });
        }
      }}"""

content = content.replace(click_old, click_new)

with open('src/ui/canvas/nodes/schematic/SchematicNetLabelNode.tsx', 'w') as f:
    f.write(content)
