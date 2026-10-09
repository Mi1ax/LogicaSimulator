import React, { useState } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Plus, X } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export const CircuitTabs: React.FC = () => {
  const savedCircuits = useSimulatorStore(state => state.savedCircuits);
  const subcircuits = Object.entries(savedCircuits).map(([id, sc]) => ({id, name: sc.name}));
  const activeSubcircuitId = useSimulatorStore(state => state.activeSubcircuitId);
  const setActiveSubcircuit = useSimulatorStore(state => state.setActiveSubcircuit);
  const addSubcircuit = useSimulatorStore(state => state.addSubcircuit);
  const deleteSubcircuit = useSimulatorStore(state => state.deleteSubcircuit);
  const appMode = useSimulatorStore(state => state.appMode);

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (appMode !== 'schematic') return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      addSubcircuit(newName.trim());
      setIsAdding(false);
      setNewName('');
    }
  };

  return (
    <div className="flex items-center bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-2 h-10 overflow-x-auto select-none">
      {subcircuits.map(sc => (
        <div
          key={sc.id}
          onClick={() => setActiveSubcircuit(sc.id)}
          className={`flex items-center h-full px-4 text-sm font-medium cursor-pointer border-r border-l -ml-[1px] border-transparent transition-colors
            ${activeSubcircuitId === sc.id 
              ? 'bg-white dark:bg-slate-900 border-x-gray-200 dark:border-x-slate-700 text-blue-600 dark:text-blue-400' 
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700/50'
            }`}
        >
          {sc.name}
          {sc.id !== 'main' && (
            <div className="ml-2 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-full p-0.5" onClick={(e) => { e.stopPropagation(); setDeletingId(sc.id); }}>
              <X size={14} />
            </div>
          )}
        </div>
      ))}
      
      {isAdding ? (
        <form onSubmit={handleAdd} className="flex items-center h-full px-2">
          <input
            autoFocus
            className="bg-white dark:bg-slate-900 border border-blue-500 rounded px-2 py-1 text-sm text-gray-900 dark:text-white outline-none w-32"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => setIsAdding(false)}
            placeholder="Name..."
          />
        </form>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="ml-2 p-1.5 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md transition-colors"
          title="Create Subcircuit"
        >
          <Plus size={16} />
        </button>
      )}

      <ConfirmModal
        isOpen={deletingId !== null}
        title="Delete Subcircuit"
        message="Are you sure you want to delete this subcircuit? This action cannot be undone."
        onConfirm={() => {
          if (deletingId) {
            deleteSubcircuit(deletingId);
            setDeletingId(null);
          }
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
