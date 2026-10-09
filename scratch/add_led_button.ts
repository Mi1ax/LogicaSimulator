import * as fs from 'fs';

const file = 'src/core/engine/nodes/basicNodes.ts';
let content = fs.readFileSync(file, 'utf8');

const additions = `
export const PushButtonNode: NodeDefinition = {
  type: 'BUTTON',
  label: 'Push Button',
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { pressed: false },
  evaluate: (_, props) => [props?.pressed ? 1 : 0]
};

export const LedBarNode: NodeDefinition = {
  type: 'LED_BAR',
  label: 'LED Bar (8-bit)',
  numInputs: 8,
  numOutputs: 0,
  evaluate: () => []
};
`;

content = content + '\n' + additions;
fs.writeFileSync(file, content);
console.log('done basic');
