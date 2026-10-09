import * as fs from 'fs';

let content = fs.readFileSync('src/ui/canvas/HexEditorView.tsx', 'utf8');

content = content.replace(/const \[highlightedRow, setHighlightedRow\] = useState<number \| null>\(null\);/, 
  \`const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);\`);

content = content.replace(/setMemory\(newMem\);\n      setCurrentPage\(0\);\n    \}\n  \}, \[selectedNode\?\.id\]\);/,
  \`setMemory(newMem);
      setCurrentPage(0);
      setIsDirty(false);
    }
  }, [selectedNode?.id]);\`);

content = content.replace(/const handleByteChange = \(addr: number, valStr: string\) => \{[\s\S]*?setMemory\(newMem\);\n/,
  \`const handleByteChange = (addr: number, valStr: string) => {
    let val = valStr.toUpperCase();
    if (!/^[0-9A-F]{0,2}$/.test(val)) return;
    setEditingVal(val);
    
    const newMem = new Uint8Array(memory);
    newMem[addr] = parseInt(val || '0', 16);
    setMemory(newMem);
    setIsDirty(true);
\`);

content = content.replace(/updateNodeProperties\(selectedNode\.id, \{ data: dataArray \}\);\n    \}/,
  \`updateNodeProperties(selectedNode.id, { data: dataArray });
      setIsDirty(false);
    }\`);

content = content.replace(/setMemory\(newMem\);\n      \} catch \(error\) \{/,
  \`setMemory(newMem);
        setIsDirty(true);
      } catch (error) {\`);

const effectCode = \`
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

  const numPages = Math.ceil(MEM_SIZE / PAGE_SIZE);\`;

content = content.replace(/const numPages = Math\.ceil\(MEM_SIZE \/ PAGE_SIZE\);/, effectCode);

content = content.replace(/<span>\{selectedNode\.properties\?\.label \|\| selectedNode\.type\}<\/span>/,
  \`<span>{selectedNode.properties?.label || selectedNode.type}{isDirty ? <span className="text-blue-500 ml-1">*</span> : ''}</span>\`);

content = content.replace(/<button onClick=\{handleSave\} className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">\s*Save Changes\s*<\/button>/,
  \`<button 
                  onClick={handleSave} 
                  disabled={!isDirty}
                  className={\`text-xs px-3 py-1 rounded transition-colors \${
                    isDirty 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                  }\`}
                >
                  {isDirty ? 'Save Changes *' : 'Saved'}
                </button>\`);

fs.writeFileSync('src/ui/canvas/HexEditorView.tsx', content);
console.log('done');
