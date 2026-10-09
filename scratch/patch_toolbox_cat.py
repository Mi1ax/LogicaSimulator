import re

with open('src/ui/components/Toolbox.tsx', 'r') as f:
    content = f.read()

# Replace CATEGORIES
old_cats = """const CATEGORIES: ToolCategory[] = [
  {
    name: 'Power & I/O',
    items: [
      { type: 'VCC', icon: <Zap size={18} /> },
      { type: 'GND', icon: <Zap size={18} /> },
      { type: 'INPUT', icon: <ToggleLeft size={18} /> },
      { type: 'BUTTON', icon: <ToggleLeft size={18} /> },
      { type: 'DIP_SWITCH', icon: <SlidersHorizontal size={18} /> },
      { type: 'OUTPUT', icon: <Lightbulb size={18} /> },
      { type: '7_SEG_DISPLAY', icon: <Lightbulb size={18} /> },
      { type: 'LED_BAR', icon: <Lightbulb size={18} /> },
      { type: 'CLOCK', icon: <Timer size={18} /> },
      { type: 'NET_LABEL', icon: <Tag size={18} /> },
      { type: 'BUS_BREAKOUT', icon: <Tag size={18} /> },
    ]
  },"""

new_cats = """const CATEGORIES: ToolCategory[] = [
  {
    name: 'Power & I/O',
    items: [
      { type: 'VCC', icon: <Zap size={18} /> },
      { type: 'GND', icon: <Zap size={18} /> },
      { type: 'BUTTON', icon: <ToggleLeft size={18} /> },
      { type: 'DIP_SWITCH', icon: <SlidersHorizontal size={18} /> },
      { type: 'LED_BAR', icon: <Lightbulb size={18} /> },
      { type: '7_SEG_DISPLAY', icon: <Lightbulb size={18} /> },
      { type: 'NET_LABEL', icon: <Tag size={18} /> },
      { type: 'BUS_BREAKOUT', icon: <Tag size={18} /> },
    ]
  },"""

content = content.replace(old_cats, new_cats)

# Dynamically add Subcircuit Pins if activeSubcircuitId !== 'main'
display_logic_old = """  const customCircuits = subcircuits.filter(sc => sc.id !== 'main');
  const displayCategories = [...CATEGORIES];
  if (customCircuits.length > 0) {
    displayCategories.unshift({
      name: 'Custom Components',
      items: customCircuits.map(sc => ({
        type: `SUBCIRCUIT:${sc.id}` as NodeType,
        icon: <Cpu size={18} />
      }))
    });
  }"""

display_logic_new = """  const activeSubcircuitId = useSimulatorStore(state => state.activeSubcircuitId);
  const customCircuits = subcircuits.filter(sc => sc.id !== 'main');
  const displayCategories = [...CATEGORIES];
  
  if (activeSubcircuitId !== 'main') {
    displayCategories.unshift({
      name: 'Subcircuit Pins',
      items: [
        { type: 'SUB_IN' as NodeType, icon: <ToggleLeft size={18} /> },
        { type: 'SUB_OUT' as NodeType, icon: <Lightbulb size={18} /> },
        { type: 'SUB_IO' as NodeType, icon: <Tag size={18} /> },
      ]
    });
  }
  
  if (customCircuits.length > 0) {
    displayCategories.unshift({
      name: 'Custom Components',
      items: customCircuits.map(sc => ({
        type: `SUBCIRCUIT:${sc.id}` as NodeType,
        icon: <Cpu size={18} />
      }))
    });
  }"""

content = content.replace(display_logic_old, display_logic_new)

with open('src/ui/components/Toolbox.tsx', 'w') as f:
    f.write(content)

