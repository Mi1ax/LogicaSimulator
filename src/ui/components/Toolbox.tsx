import React, { useState } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { NodeType } from '../../core/models/types';
import { BoxSelect, Cpu, ToggleLeft, Lightbulb, Zap, SlidersHorizontal, Tag, ChevronDown, ChevronRight, ChevronsUpDown, ChevronsDownUp , Trash2 } from 'lucide-react';
import { getNodeDefinition } from '../../core/engine/nodes';

interface ToolItem {
  type: NodeType;
  icon: React.ReactNode;
}

interface ToolCategory {
  name: string;
  items?: ToolItem[];
  subcategories?: ToolCategory[];
}

const CATEGORIES: ToolCategory[] = [
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
  },
  {
    name: 'Basic Logic',
    items: [
      { type: 'AND', icon: <Cpu size={18} /> },
      { type: 'NAND', icon: <Cpu size={18} /> },
      { type: 'OR', icon: <Cpu size={18} /> },
      { type: 'NOR', icon: <Cpu size={18} /> },
      { type: 'XOR', icon: <Cpu size={18} /> },
      { type: 'XNOR', icon: <Cpu size={18} /> },
      { type: 'NOT', icon: <BoxSelect size={18} /> },
      { type: 'BUFFER', icon: <BoxSelect size={18} /> },
    ]
  },
  {
    name: 'Integrated Circuits',
    subcategories: [
      {
        name: 'Logic Gates',
        items: [
          { type: '74LS00', icon: <Cpu size={18} /> },
          { type: '74LS02', icon: <Cpu size={18} /> },
          { type: '74LS04', icon: <Cpu size={18} /> },
          { type: '74LS08', icon: <Cpu size={18} /> },
          { type: '74LS32', icon: <Cpu size={18} /> },
          { type: '74LS86', icon: <Cpu size={18} /> },
        ]
      },
      {
        name: 'Decoders & Multiplexers',
        items: [
          { type: '74LS47', icon: <Cpu size={18} /> },
          { type: '74LS138', icon: <Cpu size={18} /> },
          { type: '74LS154', icon: <Cpu size={18} /> },
        ]
      },
      {
        name: 'Counters & Timers',
        items: [
          { type: '74LS161', icon: <Cpu size={18} /> },
          { type: '74LS191', icon: <Cpu size={18} /> },
        ]
      },
      {
        name: 'Arithmetic & ALU',
        items: [
          { type: '74LS283', icon: <Cpu size={18} /> },
          { type: '74LS181', icon: <Cpu size={18} /> },
        ]
      },
      {
        name: 'Registers & Buffers',
        items: [
          { type: '74LS173', icon: <Cpu size={18} /> },
          { type: '74LS241', icon: <Cpu size={18} /> },
          { type: '74LS244', icon: <Cpu size={18} /> },
          { type: '74LS245', icon: <Cpu size={18} /> },
          { type: '74LS273', icon: <Cpu size={18} /> },
        ]
      },
      {
        name: 'Memory',
        items: [
          { type: '27C256', icon: <Cpu size={18} /> },
          { type: '62256', icon: <Cpu size={18} /> },
        ]
      }
    ]
  }
];

export const Toolbox: React.FC = () => {
  const startPlacingNode = useSimulatorStore((state) => state.startPlacingNode);
  const appMode = useSimulatorStore((state) => state.appMode);
  const savedCircuits = useSimulatorStore((state) => state.savedCircuits);
  const subcircuits = Object.entries(savedCircuits).map(([id, sc]) => ({id, name: sc.name}));

  const activeSubcircuitId = useSimulatorStore(state => state.activeSubcircuitId);
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
  }

  const [search, setSearch] = useState('');
  const [recentNodes, setRecentNodes] = useState<NodeType[]>(() => {
    try {
      const stored = localStorage.getItem('logica-recent-nodes');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  // Track expanded state for categories and subcategories
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    'Power & I/O': true,
    'Basic Logic': true,
    'Integrated Circuits': true,
    'Integrated Circuits/Logic Gates': false,
    'Integrated Circuits/Decoders & Multiplexers': true,
    'Integrated Circuits/Counters & Timers': true,
    'Integrated Circuits/Arithmetic & ALU': true,
    'Integrated Circuits/Registers & Buffers': true,
    'Integrated Circuits/Memory': true,
  });

  const toggleCategory = (key: string) => {
    setExpandedCats(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllExpanded = (expanded: boolean) => {
    const getAllPaths = (cats: ToolCategory[], parent = ''): string[] => {
      let res: string[] = [];
      cats.forEach(c => {
        const p = parent ? `${parent}/${c.name}` : c.name;
        res.push(p);
        if (c.subcategories) res.push(...getAllPaths(c.subcategories, p));
      });
      return res;
    };
    const paths = getAllPaths(displayCategories);
    const newState: Record<string, boolean> = {};
    paths.forEach(p => newState[p] = expanded);
    setExpandedCats(newState);
  };

  
  const clearRecent = () => {
    setRecentNodes([]);
    localStorage.removeItem('logica-recent-nodes');
  };

  const handleAddNode = (type: NodeType) => {
    startPlacingNode(type);
    setRecentNodes(prev => {
      const filtered = prev.filter(t => t !== type);
      const next = [type, ...filtered].slice(0, 5);
      localStorage.setItem('logica-recent-nodes', JSON.stringify(next));
      return next;
    });
  };

  // Helper to filter items based on search and tags
  const filterItems = (items: ToolItem[] | undefined): ToolItem[] => {
    if (!items) return [];
    if (!search) return items;
    const s = search.toLowerCase();
    
    return items.filter(tool => {
      const def = getNodeDefinition(tool.type);
      const label = def?.label ?? tool.type;
      const tags = def?.tags || [];
      
      return (
        label.toLowerCase().includes(s) || 
        tool.type.toLowerCase().includes(s) ||
        tags.some(tag => tag.toLowerCase().includes(s))
      );
    });
  };

  const renderItems = (items: ToolItem[]) => {
    return items.map((tool) => (
      <button
        key={tool.type}
        onClick={() => handleAddNode(tool.type)}
        className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md hover:bg-blue-50 dark:hover:bg-slate-700 hover:border-blue-300 dark:hover:border-slate-600 transition-colors text-left text-sm font-medium text-gray-700 dark:text-slate-200 shadow-sm"
        title={getNodeDefinition(tool.type)?.tags?.join(', ')}
      >
        <span className="text-blue-600 dark:text-blue-400">{tool.icon}</span>
        {getNodeDefinition(tool.type)?.label ?? tool.type}
      </button>
    ));
  };

  const renderCategory = (category: ToolCategory, parentPath = '') => {
    const path = parentPath ? `${parentPath}/${category.name}` : category.name;
    const isExpanded = search !== '' || expandedCats[path];

    let filteredItems = filterItems(category.items);
    let renderedSubcategories: React.ReactNode[] = [];
    
    if (category.subcategories) {
      renderedSubcategories = category.subcategories
        .map(sub => renderCategory(sub, path))
        .filter(sub => sub !== null);
    }
    
    const hasVisibleContent = filteredItems.length > 0 || renderedSubcategories.length > 0;
    
    if (!hasVisibleContent) {
      return null;
    }

    return (
      <div key={path} className="flex flex-col gap-1">
        <button 
          onClick={() => toggleCategory(path)}
          className="flex items-center gap-1 w-full text-left py-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors"
        >
          {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
          <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            {category.name}
          </span>
        </button>
        
        {isExpanded && (
          <div className="flex flex-col gap-1 pl-3">
            {filteredItems.length > 0 && <div className="flex flex-col gap-2 mb-2">{renderItems(filteredItems)}</div>}
            {renderedSubcategories.length > 0 && <div className="flex flex-col gap-2">{renderedSubcategories}</div>}
          </div>
        )}
      </div>
    );
  };

  if (appMode === 'hex' || appMode === 'code') {
    return null;
  }


  const renderedContent = displayCategories.map(cat => renderCategory(cat)).filter(Boolean);

  return (
    <div className="w-64 bg-gray-100 dark:bg-slate-800 border-r border-gray-300 dark:border-slate-700 h-full flex flex-col shadow-sm z-10 relative transition-colors overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">Components</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setAllExpanded(true)} 
              className="text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              title="Expand All"
            >
              <ChevronsUpDown size={16} />
            </button>
            <button 
              onClick={() => setAllExpanded(false)} 
              className="text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              title="Collapse All"
            >
              <ChevronsDownUp size={16} />
            </button>
          </div>
        </div>
        <input
          type="text"
          placeholder="Search (e.g. decoder, ram)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
        />
      </div>

      <div className="flex flex-col p-4 gap-4 overflow-y-auto flex-1">
        {!search && recentNodes.length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
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
            <div className="flex flex-col gap-2">
              {renderItems(recentNodes.map(type => {
                let icon: React.ReactNode = <Cpu size={16} />;
                const findIcon = (cats: ToolCategory[]) => {
                  for (const cat of cats) {
                    if (cat.items) {
                      const item = cat.items.find(i => i.type === type);
                      if (item) icon = item.icon;
                    }
                    if (cat.subcategories) findIcon(cat.subcategories);
                  }
                };
                findIcon(displayCategories);
                return { type, icon };
              }))}
            </div>
          </div>
        )}
        {renderedContent.length > 0 ? (
          renderedContent
        ) : (
          <div className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
            No components found.
          </div>
        )}
      </div>
    </div>
  );
};
