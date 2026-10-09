import * as fs from 'fs';

let content = fs.readFileSync('src/ui/canvas/HexEditorView.tsx', 'utf8');

const effectCode = `
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [memory, selectedNode]);

  const numPages = Math.ceil(MEM_SIZE / PAGE_SIZE);`;

content = content.replace(/const numPages = Math\.ceil\(MEM_SIZE \/ PAGE_SIZE\);/, effectCode);

content = content.replace(/<span>\{selectedNode\.properties\?\.label \|\| selectedNode\.type\}<\/span>/,
  `<span>{selectedNode.properties?.label || selectedNode.type}{isDirty ? <span className="text-blue-500 ml-1">*</span> : ''}</span>`);

const oldButton = `<button onClick={handleSave} className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                  Save Changes
                </button>`;
const newButton = `<button 
                  onClick={handleSave} 
                  disabled={!isDirty}
                  className={\`text-xs px-3 py-1 rounded transition-colors \${
                    isDirty 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                  }\`}
                >
                  {isDirty ? 'Save Changes *' : 'Saved'}
                </button>`;

content = content.replace(oldButton, newButton);

fs.writeFileSync('src/ui/canvas/HexEditorView.tsx', content);
console.log('done');
