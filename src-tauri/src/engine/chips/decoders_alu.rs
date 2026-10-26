use super::{bit, inp, inp_or};
use crate::engine::types::{NodeKind, SIG_HIGH, SIG_LOW, SIG_X};

pub fn eval_decoder_or_alu(kind: NodeKind, inputs: &[u8], out: &mut Vec<u8>) {
    match kind {
        NodeKind::Ic74LS47 => {
            const BCD_7SEG_TABLE: [u8; 16] = [
                0b0000001, 0b1001111, 0b0010010, 0b0000110,
                0b1001100, 0b0100100, 0b1100000, 0b0001111,
                0b0000000, 0b0001100, 0b1110010, 0b0011000,
                0b1011100, 0b1000110, 0b0111000, 0b1111111,
            ];
            let lt_n = inp_or(inputs, 2, SIG_HIGH);
            let bi_n = inp_or(inputs, 3, SIG_HIGH);
            let rbi_n = inp_or(inputs, 4, SIG_HIGH);
            let value = (bit(inputs, 5) << 3)
                | (bit(inputs, 1) << 2)
                | (bit(inputs, 0) << 1)
                | bit(inputs, 6);

            let segments = if bi_n == SIG_LOW {
                0b1111111
            } else if lt_n == SIG_LOW {
                0b0000000
            } else if rbi_n == SIG_LOW && value == 0 {
                0b1111111
            } else {
                BCD_7SEG_TABLE[value & 15]
            };

            let shifts = [2, 3, 4, 5, 6, 0, 1]; // e, d, c, b, a, g, f
            for &sh in &shifts {
                out.push(if (segments & (1 << sh)) != 0 {
                    SIG_HIGH
                } else {
                    SIG_LOW
                });
            }
        }
        NodeKind::Ic74LS138 | NodeKind::Ic74LS238 => {
            let active_high = kind == NodeKind::Ic74LS238;
            let g2a_n = inp_or(inputs, 3, SIG_HIGH);
            let g2b_n = inp_or(inputs, 4, SIG_HIGH);
            let g1 = inp_or(inputs, 5, SIG_LOW);
            let inactive = if active_high { SIG_LOW } else { SIG_HIGH };
            let active = if active_high { SIG_HIGH } else { SIG_LOW };

            out.resize(8, inactive);
            if g1 == SIG_HIGH && g2a_n == SIG_LOW && g2b_n == SIG_LOW {
                let val = (bit(inputs, 2) << 2) | (bit(inputs, 1) << 1) | bit(inputs, 0);
                // Outputs ordered [Y7, Y6, Y5, Y4, Y3, Y2, Y1, Y0]
                out[7 - val] = active;
            }
        }
        NodeKind::Ic74LS139 => {
            // inputs: 0=1G', 1=1A, 2=1B, 3=GND, 4=2B, 5=2A, 6=2G', 7=VCC
            let g1_n = inp_or(inputs, 0, SIG_HIGH);
            let g2_n = inp_or(inputs, 6, SIG_HIGH);
            out.resize(8, SIG_HIGH);
            if g1_n == SIG_LOW {
                let val1 = (bit(inputs, 2) << 1) | bit(inputs, 1);
                out[val1] = SIG_LOW; // 1Y0'..1Y3' at 0..3
            }
            if g2_n == SIG_LOW {
                let val2 = (bit(inputs, 4) << 1) | bit(inputs, 5);
                out[7 - val2] = SIG_LOW; // 2Y3'..2Y0' at 4..7
            }
        }
        NodeKind::Ic74LS154 => {
            let g1_n = inp_or(inputs, 0, SIG_HIGH);
            let g2_n = inp_or(inputs, 1, SIG_HIGH);
            out.resize(16, SIG_HIGH);
            if g1_n == SIG_LOW && g2_n == SIG_LOW {
                let val = (bit(inputs, 2) << 3)
                    | (bit(inputs, 3) << 2)
                    | (bit(inputs, 4) << 1)
                    | bit(inputs, 5);
                out[val] = SIG_LOW;
            }
        }
        NodeKind::Ic74LS283 => {
            let val_a = bit(inputs, 2)
                | (bit(inputs, 1) << 1)
                | (bit(inputs, 9) << 2)
                | (bit(inputs, 7) << 3);
            let val_b = bit(inputs, 3)
                | (bit(inputs, 0) << 1)
                | (bit(inputs, 8) << 2)
                | (bit(inputs, 6) << 3);
            let sum = val_a + val_b + bit(inputs, 4);
            let s1 = if (sum & 1) != 0 { SIG_HIGH } else { SIG_LOW };
            let s2 = if (sum & 2) != 0 { SIG_HIGH } else { SIG_LOW };
            let s3 = if (sum & 4) != 0 { SIG_HIGH } else { SIG_LOW };
            let s4 = if (sum & 8) != 0 { SIG_HIGH } else { SIG_LOW };
            let c4 = if (sum & 16) != 0 { SIG_HIGH } else { SIG_LOW };
            out.extend_from_slice(&[s2, s1, c4, s4, s3]);
        }
        NodeKind::Ic74LS181 => {
            let a = (bit(inputs, 1)
                | (bit(inputs, 18) << 1)
                | (bit(inputs, 20) << 2)
                | (bit(inputs, 22) << 3)) as i32;
            let b = (bit(inputs, 0)
                | (bit(inputs, 17) << 1)
                | (bit(inputs, 19) << 2)
                | (bit(inputs, 21) << 3)) as i32;
            let s = (bit(inputs, 5)
                | (bit(inputs, 4) << 1)
                | (bit(inputs, 3) << 2)
                | (bit(inputs, 2) << 3)) as usize;
            let m = bit(inputs, 7);
            let cn_in = if inp(inputs, 6) == SIG_LOW { 1i32 } else { 0i32 };

            let f: i32;
            let mut cout = SIG_LOW;
            if m == 1 {
                f = (match s {
                    0 => !a,
                    1 => !(a & b),
                    2 => (!a) & b,
                    3 => 0,
                    4 => !(a | b),
                    5 => !b,
                    6 => a ^ b,
                    7 => a & (!b),
                    8 => (!a) | b,
                    9 => !(a ^ b),
                    10 => b,
                    11 => a & b,
                    12 => 15,
                    13 => a | (!b),
                    14 => a | b,
                    _ => a,
                }) & 15;
            } else {
                let (op1, op2) = match s {
                    0 => (a, cn_in),
                    1 => (a | b, cn_in),
                    2 => (a | (!b), cn_in),
                    3 => (-1, cn_in),
                    4 => (a, (a & !b) + cn_in),
                    5 => (a | b, (a & !b) + cn_in),
                    6 => (a, -b - 1 + cn_in),
                    7 => (a & !b, -1 + cn_in),
                    8 => (a, (a & b) + cn_in),
                    9 => (a + b, cn_in),
                    10 => (a | !b, (a & b) + cn_in),
                    11 => (a & b, -1 + cn_in),
                    12 => (a, a + cn_in),
                    13 => (a | b, a + cn_in),
                    14 => (a | !b, a + cn_in),
                    _ => (a, -1 + cn_in),
                };
                let sum = (op1 & 15) + (op2 & 15);
                f = sum & 15;
                cout = if sum > 15 { SIG_LOW } else { SIG_HIGH };
            }
            let eq = if f == 15 { SIG_HIGH } else { SIG_LOW };
            out.extend_from_slice(&[
                if (f & 1) != 0 { SIG_HIGH } else { SIG_LOW },
                if (f & 2) != 0 { SIG_HIGH } else { SIG_LOW },
                if (f & 4) != 0 { SIG_HIGH } else { SIG_LOW },
                if (f & 8) != 0 { SIG_HIGH } else { SIG_LOW },
                eq,
                SIG_X,
                cout,
                SIG_X,
            ]);
        }
        _ => {}
    }
}
