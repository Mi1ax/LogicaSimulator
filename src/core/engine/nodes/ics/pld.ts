import { NodeDefinition } from '../NodeDefinition';
import { parseJedec } from '../../../utils/jedecParser';

const GAL22V10_COL_MAP = [
  { pin: 0, trueCol: 0 },   // Pin 1
  { pin: 22, trueCol: 2 },  // Pin 23
  { pin: 1, trueCol: 4 },   // Pin 2
  { pin: 21, trueCol: 6 },  // Pin 22
  { pin: 2, trueCol: 8 },   // Pin 3
  { pin: 20, trueCol: 10 }, // Pin 21
  { pin: 3, trueCol: 12 },  // Pin 4
  { pin: 19, trueCol: 14 }, // Pin 20
  { pin: 4, trueCol: 16 },  // Pin 5
  { pin: 18, trueCol: 18 }, // Pin 19
  { pin: 5, trueCol: 20 },  // Pin 6
  { pin: 17, trueCol: 22 }, // Pin 18
  { pin: 6, trueCol: 24 },  // Pin 7
  { pin: 16, trueCol: 26 }, // Pin 17
  { pin: 7, trueCol: 28 },  // Pin 8
  { pin: 15, trueCol: 30 }, // Pin 16
  { pin: 8, trueCol: 32 },  // Pin 9
  { pin: 14, trueCol: 34 }, // Pin 15
  { pin: 9, trueCol: 36 },  // Pin 10
  { pin: 13, trueCol: 38 }, // Pin 14
  { pin: 10, trueCol: 40 }, // Pin 11
  { pin: 12, trueCol: 42 }, // Pin 13
];

const GAL22V10_OLMC_MAP = [
  { pinIndex: 13, s0Fuse: 5826, s1Fuse: 5827, startRow: 122, size: 9 },  // Pin 14
  { pinIndex: 14, s0Fuse: 5824, s1Fuse: 5825, startRow: 111, size: 11 }, // Pin 15
  { pinIndex: 15, s0Fuse: 5822, s1Fuse: 5823, startRow: 98, size: 13 },  // Pin 16
  { pinIndex: 16, s0Fuse: 5820, s1Fuse: 5821, startRow: 83, size: 15 },  // Pin 17
  { pinIndex: 17, s0Fuse: 5818, s1Fuse: 5819, startRow: 66, size: 17 },  // Pin 18
  { pinIndex: 18, s0Fuse: 5816, s1Fuse: 5817, startRow: 49, size: 17 },  // Pin 19
  { pinIndex: 19, s0Fuse: 5814, s1Fuse: 5815, startRow: 34, size: 15 },  // Pin 20
  { pinIndex: 20, s0Fuse: 5812, s1Fuse: 5813, startRow: 21, size: 13 },  // Pin 21
  { pinIndex: 21, s0Fuse: 5810, s1Fuse: 5811, startRow: 10, size: 11 },  // Pin 22
  { pinIndex: 22, s0Fuse: 5808, s1Fuse: 5809, startRow: 1, size: 9 },    // Pin 23
];

export const IC_GAL22V10: NodeDefinition = {
  type: 'GAL22V10',
  label: 'GAL22V10 (Programmable Logic Device)',
  category: 'Integrated Circuits/Programmable Logic',
  tags: ["pld", "gal", "programmable", "logic"],
  renderAs: 'DIP',
  numInputs: 0,
  numOutputs: 0,
  customPins: [
    { name: 'I/CLK', type: 'input', pinNumber: 1, schematicSide: 'left', schematicRow: 1 },
    { name: 'I2', type: 'input', pinNumber: 2, schematicSide: 'left', schematicRow: 2 },
    { name: 'I3', type: 'input', pinNumber: 3, schematicSide: 'left', schematicRow: 3 },
    { name: 'I4', type: 'input', pinNumber: 4, schematicSide: 'left', schematicRow: 4 },
    { name: 'I5', type: 'input', pinNumber: 5, schematicSide: 'left', schematicRow: 5 },
    { name: 'I6', type: 'input', pinNumber: 6, schematicSide: 'left', schematicRow: 6 },
    { name: 'I7', type: 'input', pinNumber: 7, schematicSide: 'left', schematicRow: 7 },
    { name: 'I8', type: 'input', pinNumber: 8, schematicSide: 'left', schematicRow: 8 },
    { name: 'I9', type: 'input', pinNumber: 9, schematicSide: 'left', schematicRow: 9 },
    { name: 'I10', type: 'input', pinNumber: 10, schematicSide: 'left', schematicRow: 10 },
    { name: 'I11', type: 'input', pinNumber: 11, schematicSide: 'left', schematicRow: 11 },
    { name: 'GND', type: 'input', pinNumber: 12 },
    { name: 'I13', type: 'input', pinNumber: 13, schematicSide: 'left', schematicRow: 12 },
    
    { name: 'IO14', type: 'bidir', pinNumber: 14, schematicSide: 'right', schematicRow: 12 },
    { name: 'IO15', type: 'bidir', pinNumber: 15, schematicSide: 'right', schematicRow: 11 },
    { name: 'IO16', type: 'bidir', pinNumber: 16, schematicSide: 'right', schematicRow: 10 },
    { name: 'IO17', type: 'bidir', pinNumber: 17, schematicSide: 'right', schematicRow: 9 },
    { name: 'IO18', type: 'bidir', pinNumber: 18, schematicSide: 'right', schematicRow: 8 },
    { name: 'IO19', type: 'bidir', pinNumber: 19, schematicSide: 'right', schematicRow: 7 },
    { name: 'IO20', type: 'bidir', pinNumber: 20, schematicSide: 'right', schematicRow: 6 },
    { name: 'IO21', type: 'bidir', pinNumber: 21, schematicSide: 'right', schematicRow: 5 },
    { name: 'IO22', type: 'bidir', pinNumber: 22, schematicSide: 'right', schematicRow: 4 },
    { name: 'IO23', type: 'bidir', pinNumber: 23, schematicSide: 'right', schematicRow: 3 },
    { name: 'VCC', type: 'input', pinNumber: 24 }
  ],
  evaluate: (inputs, properties, _, internal, prevInputs) => {
    if (!internal!.registers) internal!.registers = Array(10).fill(0);
    const clk = inputs[0] === 1 ? 1 : 0;
    if (internal!.lastClk === undefined) internal!.lastClk = clk;
    const isRisingEdge = clk === 1 && internal!.lastClk === 0;
    internal!.lastClk = clk;
    
    let fuses;
    if (properties?.jedecString) {
      if (!internal!.fuses || internal!.lastJedec !== properties.jedecString) {
        internal!.fuses = parseJedec(properties.jedecString, 5828);
        internal!.lastJedec = properties.jedecString;
      }
      fuses = internal!.fuses;
    } else {
      if (!internal!.fuses || internal!.lastJedec !== '') {
        internal!.fuses = Array(5828).fill(false);
        internal!.lastJedec = '';
      }
      fuses = internal!.fuses;
    }
    const buildColStates = (sourceInputs: any[]) => {
      const colStates = Array(44).fill(0);
      for (const mapping of GAL22V10_COL_MAP) {
        let val = 0;
        if (mapping.pin >= 13 && mapping.pin <= 22) {
          const olmcIndex = mapping.pin - 13;
          const olmcMap = GAL22V10_OLMC_MAP[olmcIndex];
          const s1 = fuses[olmcMap.s1Fuse] ? 1 : 0;
          
          if (s1 === 0) {
             val = internal!.registers[olmcIndex] === 1 ? 0 : 1;
          } else {
             val = sourceInputs[mapping.pin] === 1 ? 1 : 0;
          }
        } else {
          val = sourceInputs[mapping.pin] === 1 ? 1 : 0;
        }
        
        colStates[mapping.trueCol] = val;
        colStates[mapping.trueCol + 1] = val === 1 ? 0 : 1;
      }
      return colStates;
    };

    const colStates = buildColStates(inputs);
    const prevColStates = isRisingEdge && prevInputs ? buildColStates(prevInputs) : colStates;

    const evaluateRow = (rowIdx: number, states = colStates) => {
      let result = 1;
      const rowStart = rowIdx * 44;
      for (let c = 0; c < 44; c++) {
        if (!fuses[rowStart + c]) {
          if (states[c] === 0) {
            result = 0;
            break;
          }
        }
      }
      return result;
    };

    const ar = evaluateRow(0);
    const arPrev = isRisingEdge && prevInputs ? evaluateRow(0, prevColStates) : ar;
    const spPrev = isRisingEdge && prevInputs ? evaluateRow(131, prevColStates) : evaluateRow(131);

    let dInputsPrev = Array(10).fill(0);
    let returnOutputs = Array(10).fill(undefined);

    for (let i = 0; i < 10; i++) {
       const olmc = GAL22V10_OLMC_MAP[i];
       const oe = evaluateRow(olmc.startRow);
       
       let orResult = 0;
       let orResultPrev = 0;
       for (let r = 1; r < olmc.size; r++) {
         if (evaluateRow(olmc.startRow + r) === 1) {
           orResult = 1;
         }
         if (isRisingEdge && prevInputs && evaluateRow(olmc.startRow + r, prevColStates) === 1) {
           orResultPrev = 1;
         }
       }
       if (!isRisingEdge || !prevInputs) orResultPrev = orResult;
       
       dInputsPrev[i] = orResultPrev;
       
       const s0 = fuses[olmc.s0Fuse] ? 1 : 0;
       const s1 = fuses[olmc.s1Fuse] ? 1 : 0;
       
       let pinOutputValue;
       if (s1 === 0) {
         pinOutputValue = internal!.registers[i];
       } else {
         pinOutputValue = orResult;
       }
       
       if (s0 === 0) {
         pinOutputValue = pinOutputValue === 1 ? 0 : 1;
       }
       
       if (oe === 1) {
         returnOutputs[i] = pinOutputValue;
       } else {
         returnOutputs[i] = undefined;
       }
    }

    if (arPrev === 1) {
      internal!.registers.fill(0);
    } else if (isRisingEdge) {
      if (spPrev === 1) {
        internal!.registers.fill(1);
      } else {
        for (let i = 0; i < 10; i++) {
          internal!.registers[i] = dInputsPrev[i];
        }
      }
    }

    return returnOutputs as any;
  }
};
