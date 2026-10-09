import * as fs from 'fs';

const file = 'src/core/engine/nodes/index.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/DipSwitchNode, SevenSegNode, NetLabelNode, BusBreakoutNode\n\} from '\.\/basicNodes';/, "DipSwitchNode, SevenSegNode, NetLabelNode, BusBreakoutNode, PushButtonNode, LedBarNode\n} from './basicNodes';");

content = content.replace(/\[DipSwitchNode\.type\]: DipSwitchNode,/, `[DipSwitchNode.type]: DipSwitchNode,
  [PushButtonNode.type]: PushButtonNode,
  [LedBarNode.type]: LedBarNode,`);

fs.writeFileSync(file, content);
console.log('done index2');
