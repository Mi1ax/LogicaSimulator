import { describe, it, expect } from 'vitest';
import { getSchematicAnchor, getSchematicPinPosition } from '../schematicLayout';
import { NodeRegistry } from '../../engine/nodes';
import { addNode, setNodeInputCount } from '../../engine/circuit';
import { LogicNode } from '../../models/types';

const GRID = 20;
const ROTATIONS = [0, 90, 180, 270];

const makeNode = (type: string, inputCount?: number): LogicNode => {
  let state = addNode({ nodes: [], wires: [] }, type, 100, 100);
  const id = state.nodes[0].id;
  if (inputCount !== undefined) state = setNodeInputCount(state, id, inputCount);
  return state.nodes[0];
};

const allPins = (node: LogicNode) => [...node.inputs, ...node.outputs];

const expectOnGrid = (value: number, label: string) => {
  // `+ 0` normalizes -0 so toBe(0) doesn't fail on it
  expect(((value % GRID) + GRID) % GRID + 0, label).toBe(0);
};

describe('schematic rotation stays on the grid', () => {
  const types = Object.keys(NodeRegistry).filter(t => t !== 'JUNCTION');

  for (const type of types) {
    it(`${type}: anchor and every pin are grid-aligned at all rotations`, () => {
      const base = makeNode(type);
      const anchor = getSchematicAnchor(base);
      expectOnGrid(anchor.x, `${type} anchor.x=${anchor.x}`);
      expectOnGrid(anchor.y, `${type} anchor.y=${anchor.y}`);

      for (const rotation of ROTATIONS) {
        const node = { ...base, properties: { ...base.properties, rotation } };
        for (const pin of allPins(node)) {
          const pos = getSchematicPinPosition(node, pin.id);
          expectOnGrid(pos.x, `${type} @${rotation}° pin ${pin.name ?? pin.id} x=${pos.x}`);
          expectOnGrid(pos.y, `${type} @${rotation}° pin ${pin.name ?? pin.id} y=${pos.y}`);
        }
      }
    });
  }

  for (const gate of ['AND', 'OR', 'XOR', 'NOR']) {
    it(`${gate}: grid-aligned for 2..8 inputs at all rotations`, () => {
      for (let n = 2; n <= 8; n++) {
        const base = makeNode(gate, n);
        for (const rotation of ROTATIONS) {
          const node = { ...base, properties: { ...base.properties, rotation } };
          for (const pin of allPins(node)) {
            const pos = getSchematicPinPosition(node, pin.id);
            expectOnGrid(pos.x, `${gate}(${n}) @${rotation}° x=${pos.x}`);
            expectOnGrid(pos.y, `${gate}(${n}) @${rotation}° y=${pos.y}`);
          }
        }
      }
    });
  }

  it('rotating 90° four times returns every pin to its original position', () => {
    for (const type of types) {
      const base = makeNode(type);
      for (const pin of allPins(base)) {
        const p0 = getSchematicPinPosition({ ...base, properties: { ...base.properties, rotation: 0 } }, pin.id);
        const p360 = getSchematicPinPosition({ ...base, properties: { ...base.properties, rotation: 360 } }, pin.id);
        expect({ x: p360.x, y: p360.y }).toEqual({ x: p0.x, y: p0.y });
      }
    }
  });
});
