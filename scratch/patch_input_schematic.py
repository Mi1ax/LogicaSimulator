import re

with open('src/ui/canvas/nodes/schematic/SchematicIONode.tsx', 'r') as f:
    content = f.read()

# Replace the new_rendering block with a simple schematic block
old_rendering = """      ) : isInput ? (
        <Group>
          {/* Wire connection line */}
          <Line points={[width - 10, height / 2, width, height / 2]} stroke={borderStroke} strokeWidth={2} />
          
          {/* Switch Base */}
          <Rect
            x={4}
            y={2}
            width={32}
            height={36}
            fill={theme === 'dark' ? '#1e293b' : '#f1f5f9'}
            stroke={isSelected ? canvasTheme.selectedNodeColor : borderStroke}
            strokeWidth={isSelected ? 2 : 1}
            cornerRadius={4}
            shadowColor="black"
            shadowBlur={4}
            shadowOpacity={0.2}
            shadowOffsetY={2}
          />
          
          {/* Metal Faceplate */}
          <Rect
            x={8}
            y={6}
            width={24}
            height={28}
            fill={theme === 'dark' ? '#334155' : '#cbd5e1'}
            cornerRadius={2}
            stroke={theme === 'dark' ? '#0f172a' : '#94a3b8'}
            strokeWidth={1}
          />
          
          {/* Screws */}
          <Circle x={11} y={9} radius={1.5} fill="#64748b" />
          <Circle x={29} y={9} radius={1.5} fill="#64748b" />
          <Circle x={11} y={31} radius={1.5} fill="#64748b" />
          <Circle x={29} y={31} radius={1.5} fill="#64748b" />

          {/* Text Labels */}
          <Text text="ON" x={8} y={7} width={24} align="center" fontSize={5} fontFamily="sans-serif" fontStyle="bold" fill={theme === 'dark' ? '#94a3b8' : '#475569'} />
          <Text text="OFF" x={8} y={28} width={24} align="center" fontSize={5} fontFamily="sans-serif" fontStyle="bold" fill={theme === 'dark' ? '#94a3b8' : '#475569'} />

          {/* Switch Slot */}
          <Rect
            x={17}
            y={12}
            width={6}
            height={16}
            fill="#000"
            cornerRadius={3}
            shadowColor="black"
            shadowBlur={2}
            shadowOpacity={0.5}
          />

          {/* Lever */}
          {val === 1 ? (
            <Group x={20} y={12}>
              {/* Lever Base */}
              <Rect x={-4} y={0} width={8} height={10} fill="#94a3b8" cornerRadius={3} />
              <Rect x={-3} y={1} width={6} height={9} fill="#cbd5e1" cornerRadius={2} />
              {/* Lever Head */}
              <Circle x={0} y={0} radius={6} fill="#f8fafc" shadowColor="black" shadowBlur={4} shadowOffsetY={2} shadowOpacity={0.4} />
              <Circle x={-1} y={-1} radius={2} fill="#ffffff" opacity={0.8} />
            </Group>
          ) : (
            <Group x={20} y={28}>
              {/* Lever Base */}
              <Rect x={-4} y={-10} width={8} height={10} fill="#94a3b8" cornerRadius={3} />
              <Rect x={-3} y={-10} width={6} height={9} fill="#cbd5e1" cornerRadius={2} />
              {/* Lever Head */}
              <Circle x={0} y={0} radius={6} fill="#f8fafc" shadowColor="black" shadowBlur={4} shadowOffsetY={2} shadowOpacity={0.4} />
              <Circle x={-1} y={-1} radius={2} fill="#ffffff" opacity={0.8} />
            </Group>
          )}
        </Group>
      ) : (
        <>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={bgFill}
            stroke={isSelected ? canvasTheme.selectedNodeColor : borderStroke}
            strokeWidth={isSelected ? 3 : 2}
            cornerRadius={8}
          />
          {isClock && (
            <Group x={width / 2} y={height / 2}>
              <Circle x={0} y={0} radius={12} stroke={canvasTheme.nodeBorder} strokeWidth={2} />
              <Line points={[0, 0, 0, -6]} stroke={canvasTheme.nodeBorder} strokeWidth={2} />
              <Line points={[0, 0, 6, 0]} stroke={canvasTheme.nodeBorder} strokeWidth={2} />
            </Group>
          )}
          {!isClock && (
            <Group x={width / 2} y={height / 2} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1}>
              <Text
                text={'?'}
                x={-width / 2}
                y={-height / 2}
                width={width}
                height={height}
                align="center"
                verticalAlign="middle"
                fontSize={20}
                fontFamily="monospace"
                fontStyle="bold"
                fill={canvasTheme.textColor}
              />
            </Group>
          )}
        </>
      )}"""

new_rendering = """      ) : (
        <>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={val === 1 ? indicatorFill : bgFill}
            stroke={isSelected ? canvasTheme.selectedNodeColor : borderStroke}
            strokeWidth={isSelected ? 3 : 2}
            cornerRadius={4}
          />
          {/* Inner border to look like a schematic block */}
          <Rect
            x={4}
            y={4}
            width={width - 8}
            height={height - 8}
            fill="transparent"
            stroke={borderStroke}
            strokeWidth={1}
            opacity={0.3}
          />
          <Group x={width / 2} y={height / 2} scaleX={node.properties?.flipX ? -1 : 1} scaleY={node.properties?.flipY ? -1 : 1}>
            <Text
              text={isClock ? 'CLK' : (val === 1 ? '1' : '0')}
              x={-width / 2}
              y={-height / 2}
              width={width}
              height={height}
              align="center"
              verticalAlign="middle"
              fontSize={isClock ? 14 : 20}
              fontFamily="monospace"
              fontStyle="bold"
              fill={val === 1 ? '#ffffff' : canvasTheme.textColor}
            />
          </Group>
        </>
      )}"""

content = content.replace(old_rendering, new_rendering)

with open('src/ui/canvas/nodes/schematic/SchematicIONode.tsx', 'w') as f:
    f.write(content)

