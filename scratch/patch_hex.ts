import * as fs from 'fs';

let content = fs.readFileSync('src/ui/canvas/HexEditorView.tsx', 'utf8');

const importRegex = /const \[memory, setMemory\] = useState<Uint8Array>\(new Uint8Array\(MEM_SIZE\)\);/;
content = content.replace(importRegex, `const [memory, setMemory] = useState<Uint8Array>(new Uint8Array(MEM_SIZE));
  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [editingVal, setEditingVal] = useState<string>('');`);

const handleByteRegex = /const handleByteChange = \(addr: number, valStr: string\) => \{[\s\S]*?setMemory\(newMem\);\n  \};/;
content = content.replace(handleByteRegex, `const handleByteChange = (addr: number, valStr: string) => {
    let val = valStr.toUpperCase();
    if (!/^[0-9A-F]{0,2}$/.test(val)) return;
    setEditingVal(val);
    
    const newMem = new Uint8Array(memory);
    newMem[addr] = parseInt(val || '0', 16);
    setMemory(newMem);
  };`);

const inputRegex = /<input\s+key=\{colIndex\}\s+id=\{`hex-cell-\$\{addr\}`\}\s+className=\{`w-\[1\.2rem\] bg-transparent text-center focus:bg-blue-100 dark:focus:bg-blue-900\/50 outline-none rounded \$\{colIndex === 8 \? 'ml-2' : ''\}`\}\s+value=\{hexStr\}\s+maxLength=\{2\}\s+onChange=\{\(e\) => handleByteChange\(addr, e\.target\.value\)\}\s+onFocus=\{\(e\) => e\.target\.select\(\)\}\s+\/>/;

content = content.replace(inputRegex, `<input
                            key={colIndex}
                            id={\`hex-cell-\${addr}\`}
                            className={\`w-[1.2rem] bg-transparent text-center focus:bg-blue-100 dark:focus:bg-blue-900/50 outline-none rounded \${colIndex === 8 ? 'ml-2' : ''}\`}
                            value={editingAddr === addr ? editingVal : hexStr}
                            maxLength={2}
                            onChange={(e) => handleByteChange(addr, e.target.value)}
                            onFocus={(e) => {
                              setEditingAddr(addr);
                              setEditingVal(hexStr);
                              e.target.select();
                            }}
                            onBlur={() => setEditingAddr(null)}
                          />`);

fs.writeFileSync('src/ui/canvas/HexEditorView.tsx', content);
