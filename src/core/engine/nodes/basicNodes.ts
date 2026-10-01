import { NodeDefinition } from './NodeDefinition';

export const AndNode: NodeDefinition = {
  type: 'AND',
  label: 'AND Gate',
  numInputs: 2,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    return [inputs.every(i => i === 1) ? 1 : 0];
  }
};

export const OrNode: NodeDefinition = {
  type: 'OR',
  label: 'OR Gate',
  numInputs: 2,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    return [inputs.some(i => i === 1) ? 1 : 0];
  }
};

export const NorNode: NodeDefinition = {
  type: 'NOR',
  label: 'NOR Gate',
  numInputs: 2,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    return [inputs.every(i => i === 0) ? 1 : 0];
  }
};

export const NotNode: NodeDefinition = {
  type: 'NOT',
  label: 'NOT Gate',
  numInputs: 1,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs[0] === undefined) return [undefined];
    return [inputs[0] === 1 ? 0 : 1];
  }
};

export const XorNode: NodeDefinition = {
  type: 'XOR',
  label: 'XOR Gate',
  numInputs: 2,
  numOutputs: 1,
  evaluate: (inputs) => {
    if (inputs.includes(undefined)) return [undefined];
    // XOR is true if the inputs are different (or if an odd number of inputs are 1)
    const count = inputs.filter(i => i === 1).length;
    return [count % 2 === 1 ? 1 : 0];
  }
};

export const InputNode: NodeDefinition = {
  type: 'INPUT',
  label: 'Input Switch',
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { value: 0 },
  evaluate: (_, props) => {
    return [props?.value === 1 ? 1 : 0];
  }
};

export const OutputNode: NodeDefinition = {
  type: 'OUTPUT',
  label: 'Output LED',
  numInputs: 1,
  numOutputs: 0,
  evaluate: () => [] // Passive receiver
};

export const ClockNode: NodeDefinition = {
  type: 'CLOCK',
  label: 'Clock',
  numInputs: 0,
  numOutputs: 1,
  defaultProperties: { interval: 10 },
  evaluate: (_, props, tickCount) => {
    const interval = props?.interval ?? 10;
    const val = Math.floor((tickCount ?? 0) / interval) % 2 === 0 ? 0 : 1;
    return [val];
  }
};
