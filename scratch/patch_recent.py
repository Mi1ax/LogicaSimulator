import re

with open('src/ui/components/Toolbox.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "from 'lucide-react';",
    ", Trash2 } from 'lucide-react';"
)

clear_logic = """
  const clearRecent = () => {
    setRecentNodes([]);
    localStorage.removeItem('logica-recent-nodes');
  };
"""

content = content.replace(
    "const handleAddNode = (type: NodeType) => {",
    clear_logic + "\n  const handleAddNode = (type: NodeType) => {"
)

ui_old = """
            <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">
              Recently Used
            </h3>
"""

ui_new = """
            <div className="flex justify-between items-center mb-1 ml-1">
              <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Recently Used
              </h3>
              <button 
                onClick={clearRecent}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700"
                title="Clear Recent"
              >
                <Trash2 size={14} />
              </button>
            </div>
"""

content = content.replace(ui_old, ui_new)

with open('src/ui/components/Toolbox.tsx', 'w') as f:
    f.write(content)

