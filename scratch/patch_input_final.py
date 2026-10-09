import re

with open('src/ui/canvas/nodes/schematic/SchematicIONode.tsx', 'r') as f:
    content = f.read()

old_part = re.search(r"      \) : \(\n        <>\n          <Rect[\s\S]*?\n      \)}", content).group(0)

new_part = """      ) : (
        <>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={canvasTheme.nodeBg}
            stroke={isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder}
            strokeWidth={isSelected ? 3 : 2}
            cornerRadius={4}
          />
          {isInput && (
            <Group
              x={4}
              y={4}
              onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container && !useSimulatorStore.getState().placingNodeId) container.style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container && !useSimulatorStore.getState().placingNodeId) container.style.cursor = 'grab';
              }}
              onClick={(e) => {
                e.cancelBubble = true;
                if (!useSimulatorStore.getState().placingNodeId) toggleInputNode(node.id);
              }}
            >
              <Rect
                x={0}
                y={0}
                width={width - 8}
                height={height - 8}
                fill={val === 1 ? '#3b82f6' : canvasTheme.nodeBg}
                stroke={canvasTheme.nodeBorder}
                strokeWidth={1}
                cornerRadius={2}
              />
              <Text
                text={val === 1 ? '1' : '0'}
                x={0}
                y={0}
                width={width - 8}
                height={height - 8}
                align="center"
                verticalAlign="middle"
                fontSize={20}
                fontFamily="monospace"
                fontStyle="bold"
                fill={val === 1 ? '#ffffff' : canvasTheme.textColor}
              />
            </Group>
          )}
          {isClock && (
            <Group x={width / 2} y={height / 2}>
              <Text
                text="CLK"
                x={-width / 2}
                y={-height / 2}
                width={width}
                height={height}
                align="center"
                verticalAlign="middle"
                fontSize={14}
                fontFamily="monospace"
                fontStyle="bold"
                fill={canvasTheme.textColor}
              />
            </Group>
          )}
        </>
      )}"""

content = content.replace(old_part, new_part)

group_onclick_old = """      onClick={(e) => {
        e.cancelBubble = true;
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          store.finishPlacingNode();
          return;
        }
        select({ type: 'node', id: node.id }, e.evt.shiftKey);
        
        if (isInput) {
          toggleInputNode(node.id);
        }
      }}"""

group_onclick_new = """      onClick={(e) => {
        const store = useSimulatorStore.getState();
        if (store.placingNodeId === node.id) {
          e.cancelBubble = true;
          store.finishPlacingNode();
          return;
        }
        select({ type: 'node', id: node.id }, e.evt.shiftKey);
      }}"""

content = content.replace(group_onclick_old, group_onclick_new)

with open('src/ui/canvas/nodes/schematic/SchematicIONode.tsx', 'w') as f:
    f.write(content)

