import React, { useState, useMemo } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { NodeType } from '../../core/models/types';
import { BoxSelect, Cpu, ToggleLeft, Lightbulb, Zap, SlidersHorizontal, Tag, ChevronDown, ChevronRight, ChevronsUpDown, ChevronsDownUp, Trash2, X, Grid3X3, Type, StickyNote } from 'lucide-react';
import { ALL_BUILTIN_NODES, getNodeDefinition } from '../../core/engine/nodes';

interface ToolItem {
  type: NodeType;
  icon: React.ReactNode;
}

interface ToolCategory {
  name: string;
  items?: ToolItem[];
  subcategories?: ToolCategory[];
}

const getToolIcon = (type: NodeType, size = 18): React.ReactNode => {
  switch (type) {
    case 'VCC':
    case 'GND':
    case 'PULL_UP':
    case 'PULL_DOWN':
    case 'CLOCK':
      return <Zap size={size} />;
    case 'INPUT':
    case 'BUTTON':
    case 'SUB_IN':
      return <ToggleLeft size={size} />;
    case 'DIP_SWITCH':
      return <SlidersHorizontal size={size} />;
    case 'KEYPAD':
      return <Grid3X3 size={size} />;
    case 'OUTPUT':
    case 'LED_BAR':
    case '7_SEG_DISPLAY':
    case 'SUB_OUT':
      return <Lightbulb size={size} />;
    case 'NET_LABEL':
    case 'BUS_BREAKOUT':
    case 'SUB_IO':
      return <Tag size={size} />;
    case 'NC':
      return <X size={size} />;
    case 'REGION_BOX':
      return <BoxSelect size={size} />;
    case 'TEXT_LABEL':
      return <Type size={size} />;
    case 'STICKY_NOTE':
      return <StickyNote size={size} />;
    case 'NOT':
    case 'BUFFER':
      return <BoxSelect size={size} />;
    default:
      return <Cpu size={size} />;
  }
};

function splitCategoryPath(category: string): string[] {
  return category
    .replace(/I\/O/g, 'I__SLASH__O')
    .split('/')
    .map(part => part.replace(/I__SLASH__O/g, 'I/O'));
}

function buildBaseCategories(): ToolCategory[] {
  const rootMap = new Map<string, ToolCategory>();

  ALL_BUILTIN_NODES.forEach(def => {
    if (!def.category) return;
    const parts = splitCategoryPath(def.category);
    const rootName = parts[0];

    let rootCat = rootMap.get(rootName);
    if (!rootCat) {
      rootCat = { name: rootName };
      rootMap.set(rootName, rootCat);
    }

    if (parts.length === 1) {
      if (!rootCat.items) rootCat.items = [];
      rootCat.items.push({ type: def.type, icon: getToolIcon(def.type) });
    } else {
      const subName = parts[1];
      if (!rootCat.subcategories) rootCat.subcategories = [];
      let subCat = rootCat.subcategories.find(s => s.name === subName);
      if (!subCat) {
        subCat = { name: subName, items: [] };
        rootCat.subcategories.push(subCat);
      }
      subCat.items!.push({ type: def.type, icon: getToolIcon(def.type) });
    }
  });

  return Array.from(rootMap.values());
}

export const Toolbox: React.FC = () => {
  const startPlacingNode = useSimulatorStore((state) => state.startPlacingNode);
  const appMode = useSimulatorStore((state) => state.appMode);
  const savedCircuits = useSimulatorStore((state) => state.savedCircuits);
  const subcircuits = Object.entries(savedCircuits).map(([id, sc]) => ({ id, name: sc.name }));

  const activeSubcircuitId = useSimulatorStore(state => state.activeSubcircuitId);
  const customCircuits = subcircuits.filter(sc => sc.id !== 'main');

  const baseCategories = useMemo(() => buildBaseCategories(), [ALL_BUILTIN_NODES.length]);
  const displayCategories = [...baseCategories];
  
  const extraCategories: ToolCategory[] = [];
  if (activeSubcircuitId !== 'main') {
    extraCategories.push({
      name: 'Subcircuit Pins',
      items: [
        { type: 'SUB_IN', icon: getToolIcon('SUB_IN') },
        { type: 'SUB_OUT', icon: getToolIcon('SUB_OUT') },
        { type: 'SUB_IO', icon: getToolIcon('SUB_IO') },
      ]
    });
  }
  
  if (customCircuits.length > 0) {
    extraCategories.push({
      name: 'Custom Components',
      items: customCircuits.map(sc => ({
        type: `SUBCIRCUIT:${sc.id}` as NodeType,
        icon: getToolIcon(`SUBCIRCUIT:${sc.id}`)
      }))
    });
  }

  if (extraCategories.length > 0) {
    // Always keep 'Power & I/O' as the very first category right under Recently Used
    const powerIdx = displayCategories.findIndex(c => c.name === 'Power & I/O');
    const insertIdx = powerIdx >= 0 ? powerIdx + 1 : 0;
    displayCategories.splice(insertIdx, 0, ...extraCategories);
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
    'Power & I/O/Sources & Clock': true,
    'Power & I/O/Inputs & Switches': true,
    'Power & I/O/Outputs & Displays': true,
    'Power & I/O/Wiring & Labels': true,
    'Annotations': true,
    'Subcircuit Pins': true,
    'Custom Components': true,
    'Basic Logic': true,
    'Integrated Circuits': true,
    'Integrated Circuits/Logic Gates': false,
    'Integrated Circuits/Decoders & Multiplexers': true,
    'Integrated Circuits/Counters & Timers': true,
    'Integrated Circuits/Arithmetic & ALU': true,
    'Integrated Circuits/Registers & Buffers': true,
    'Integrated Circuits/Memory': true,
    'Integrated Circuits/Programmable Logic': true,
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
    const isExpanded = search !== '' || (expandedCats[path] ?? true);

    const filteredItems = filterItems(category.items);
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
              {renderItems(recentNodes.map(type => ({ type, icon: getToolIcon(type, 16) })))}
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
