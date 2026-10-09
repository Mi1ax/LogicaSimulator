import * as fs from 'fs';

let content = fs.readFileSync('src/ui/canvas/HexEditorView.tsx', 'utf8');

const focusCellCode = `
  const focusCell = (targetAddr: number) => {
    if (targetAddr < 0 || targetAddr >= MEM_SIZE) return;
    const targetPage = Math.floor(targetAddr / PAGE_SIZE);
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
      setTimeout(() => {
        const el = document.getElementById(\`hex-cell-\${targetAddr}\`);
        if (el) (el as HTMLInputElement).focus();
      }, 50);
    } else {
      const el = document.getElementById(\`hex-cell-\${targetAddr}\`);
      if (el) (el as HTMLInputElement).focus();
    }
  };

  const handleByteChange = (addr: number, valStr: string) => {`;

content = content.replace(/const handleByteChange = \(addr: number, valStr: string\) => \{/, focusCellCode);

const valLengthCode = `
    const newMem = new Uint8Array(memory);
    newMem[addr] = parseInt(val || '0', 16);
    setMemory(newMem);

    if (val.length === 2) {
      focusCell(addr + 1);
    }
  };`;

content = content.replace(/const newMem = new Uint8Array\(memory\);\n    newMem\[addr\] = parseInt\(val \|\| '0', 16\);\n    setMemory\(newMem\);\n  \};/, valLengthCode);

const inputRegex = /<input\s+key=\{colIndex\}\s+id=\{`hex-cell-\$\{addr\}`\}\s+className=\{`w-\[1\.2rem\] bg-transparent text-center focus:bg-blue-100 dark:focus:bg-blue-900\/50 outline-none rounded \$\{colIndex === 8 \? 'ml-2' : ''\}`\}\s+value=\{editingAddr === addr \? editingVal : hexStr\}\s+maxLength=\{2\}\s+onChange=\{\(e\) => handleByteChange\(addr, e\.target\.value\)\}\s+onFocus=\{\(e\) => \{\s+setEditingAddr\(addr\);\s+setEditingVal\(hexStr\);\s+e\.target\.select\(\);\s+\}\}\s+onBlur=\{\(\) => setEditingAddr\(null\)\}\s+\/>/;

const inputReplacement = `<input
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
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowRight') { e.preventDefault(); focusCell(addr + 1); }
                              else if (e.key === 'ArrowLeft') { e.preventDefault(); focusCell(addr - 1); }
                              else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(addr - 16); }
                              else if (e.key === 'ArrowDown') { e.preventDefault(); focusCell(addr + 16); }
                            }}
                          />`;

content = content.replace(inputRegex, inputReplacement);

fs.writeFileSync('src/ui/canvas/HexEditorView.tsx', content);
console.log('done');
