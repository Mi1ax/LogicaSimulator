import * as fs from 'fs';

const file = 'src/core/engine/nodes/index.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{ IC74LS08,/, "import { IC74LS00, IC74LS02, IC74LS04, IC74LS32, IC74LS86, IC74LS173, IC74LS181, IC74LS08,");

content = content.replace(/\[IC74LS08\.type\]: IC74LS08,/, `[IC74LS00.type]: IC74LS00,
  [IC74LS02.type]: IC74LS02,
  [IC74LS04.type]: IC74LS04,
  [IC74LS08.type]: IC74LS08,
  [IC74LS32.type]: IC74LS32,
  [IC74LS86.type]: IC74LS86,
  [IC74LS173.type]: IC74LS173,
  [IC74LS181.type]: IC74LS181,`);

fs.writeFileSync(file, content);
console.log('done index');
