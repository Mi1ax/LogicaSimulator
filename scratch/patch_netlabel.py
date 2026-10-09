import re

with open('src/ui/canvas/nodes/schematic/SchematicNetLabelNode.tsx', 'r') as f:
    content = f.read()

# Add logic for left/right pin
logic_old = """  const pin = node.inputs[0] || node.outputs[0];
  const name = String(node.properties?.label || 'NET');"""

logic_new = """  const pin = node.inputs[0] || node.outputs[0];
  const isInputSide = node.type === 'SUB_OUT' || (node.type === 'SUB_IO' && node.properties?.flipX);
  const name = String(node.properties?.label || (node.type === 'SUB_IN' ? 'IN' : node.type === 'SUB_OUT' ? 'OUT' : node.type === 'SUB_IO' ? 'I/O' : 'NET'));"""

content = content.replace(logic_old, logic_new)

# Modify rendering
render_old = """      <Rect x={0} y={0} width={width} height={height} fill="transparent" />
      <Line points={[width - 10, height / 2, width, height / 2]} stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder} strokeWidth={2} />
      <Group x={(width - 12) / 2} y={height / 2} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1}>
        <Text 
          x={0}
          y={0}
          rotation={-(node.properties?.rotation || 0)}
          offsetX={(width - 12) / 2}
          offsetY={height / 2}
          width={width - 12} 
          height={height}
          text={name} 
          verticalAlign="middle"
          align={(node.properties?.rotation || 0) === 180 ? 'left' : ((node.properties?.rotation || 0) === 90 || (node.properties?.rotation || 0) === 270) ? 'center' : 'right'}
          fontSize={12} 
          fontFamily="monospace"
          fill={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.textColor}
        />
      </Group>
      {isSelected && <Rect x={0} y={0} width={width} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={1} dash={[2,2]} />}
      {pin && (
        <Pin
          id={pin.id}
          nodeId={node.id}
          x={width}
          y={height / 2}
          type={pin.type}
        />
      )}"""

render_new = """      <Rect x={0} y={0} width={width} height={height} fill="transparent" />
      <Line points={isInputSide ? [0, height / 2, 10, height / 2] : [width - 10, height / 2, width, height / 2]} stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder} strokeWidth={2} />
      
      {/* Box to make it look like a port */}
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
      )}
      
      <Group x={isInputSide ? (width + 12) / 2 : (width - 12) / 2} y={height / 2} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1}>
        <Text 
          x={0}
          y={0}
          rotation={-(node.properties?.rotation || 0)}
          offsetX={(width - 12) / 2}
          offsetY={height / 2}
          width={width - 12} 
          height={height}
          text={name} 
          verticalAlign="middle"
          align={isInputSide ? 'left' : 'right'}
          fontSize={10}
          fontFamily="sans-serif"
          fontStyle={node.type.startsWith('SUB_') ? 'bold' : 'normal'}
          fill={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.textColor}
        />
      </Group>
      {isSelected && <Rect x={0} y={0} width={width} height={height} stroke={canvasTheme.selectedNodeColor} strokeWidth={1} dash={[2,2]} />}
      {pin && (
        <Pin
          id={pin.id}
          nodeId={node.id}
          x={isInputSide ? 0 : width}
          y={height / 2}
          type={pin.type}
        />
      )}"""

content = content.replace(render_old, render_new)

with open('src/ui/canvas/nodes/schematic/SchematicNetLabelNode.tsx', 'w') as f:
    f.write(content)
