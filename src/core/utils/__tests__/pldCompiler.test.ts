import { describe, it, expect } from 'vitest';
import { compilePldToJedec } from '../pldCompiler';

describe('WinCUPL .pld to GAL22V10 JEDEC Compiler', () => {
  it('compiles combinatorial AND, OR, XOR, and active-low pins into valid JEDEC fuse map', () => {
    const pld = `
      Name     CombTest;
      Device   g22v10;

      PIN 2 = A;
      PIN 3 = B;
      PIN 4 = !CS;

      PIN 14 = Y_AND;
      PIN 15 = Y_OR;
      PIN 16 = Y_XOR;
      PIN 17 = !Y_NAND_LOW;

      Y_AND = A & B;
      Y_OR  = A # B;
      Y_XOR = A $ B;
      Y_NAND_LOW = CS & A & B;
    `;

    const res = compilePldToJedec(pld);
    expect(res.success).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.jedec).toContain('*QF5892');
    expect(res.jedec).toContain('*L05792');
  });

  it('compiles registered (.d) counter with asynchronous reset (.ar)', () => {
    const pld = `
      Name     Counter2Bit;
      Device   g22v10;

      PIN 1 = CLK;
      PIN 2 = RST;
      PIN 14 = Q0;
      PIN 15 = Q1;

      Q0.ar = RST;
      Q1.ar = RST;

      Q0.d = !Q0;
      Q1.d = Q1 $ Q0;
    `;

    const res = compilePldToJedec(pld);
    expect(res.success).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.jedec).toContain('L0000');
  });

  it('supports .oe tri-state output enable equations', () => {
    const pld = `
      Name     TriStateTest;
      Device   g22v10;

      PIN 2 = EN;
      PIN 3 = D0;
      PIN 14 = Y0;

      Y0 = D0;
      Y0.oe = EN;
    `;

    const res = compilePldToJedec(pld);
    expect(res.success).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('supports empty header fields (e.g. Location ;) and digit-leading pin names (16ms, 2Sec, 2Sec_Load)', () => {
    const pld = `
      Name     TimerFSM;
      PartNo   00;
      Date     15/10/2026;
      Revision 01;
      Designer Engineer;
      Company  University;
      Assembly None;
      Location ;
      Device   g22v10;

      PIN 6 = 16ms;
      PIN 7 = 2Sec;
      PIN 8 = S4;
      PIN 9 = S5;
      PIN 14 = 2Sec_Load;
      PIN 15 = 2Sec_Enable;

      !2Sec_Load = S4;
      2Sec_Enable = S4 # S5 # (16ms & 2Sec);
    `;

    const res = compilePldToJedec(pld);
    expect(res.errors).toEqual([]);
    expect(res.success).toBe(true);
  });

  it('rejects oversized PIN bracket ranges and excessive XOR expansions quickly without hanging', () => {
    const t0 = performance.now();
    const badRange = compilePldToJedec('Pin [1..9999999] = [A1..A9999999];');
    expect(badRange.success).toBe(false);
    expect(badRange.errors[0]?.message).toContain('too large');

    const bigXor = compilePldToJedec(`
      Name BigXor;
      Device g22v10;
      Pin [1..11] = [I0..I10];
      Pin 14 = Out1;
      Out1 = I0 $ I1 $ I2 $ I3 $ I4 $ I5 $ I6 $ I7 $ I8 $ I9 $ I10;
    `);
    expect(bigXor.success).toBe(false);
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
