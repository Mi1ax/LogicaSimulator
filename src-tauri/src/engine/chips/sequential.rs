use super::{bit, inp, inp_or};
use crate::engine::types::{
    CompiledNode, Ne555Mode, NodeInternalState, NodeKind, SIG_HIGH, SIG_LOW, SIG_X, SIG_Z,
};

pub fn eval_sequential(
    cn: &CompiledNode,
    inputs: &[u8],
    tick_count: u64,
    st: &mut NodeInternalState,
    out: &mut Vec<u8>,
) {
    match cn.kind {
        NodeKind::Ic74LS161 => {
            let p_inputs: &[u8] = if cn.prev_inputs.is_empty() {
                inputs
            } else {
                &cn.prev_inputs
            };
            let clr_n = inp_or(inputs, 0, SIG_HIGH);
            let clk = if inp(inputs, 1) == SIG_HIGH { 1 } else { 0 };
            if !st.initialized {
                st.last_clk = clk;
                st.initialized = true;
            }
            let load_n = inp_or(p_inputs, 8, SIG_HIGH);
            let enp = inp_or(p_inputs, 6, SIG_HIGH);
            let ent = inp_or(p_inputs, 9, SIG_HIGH);

            if clr_n == SIG_LOW {
                st.counter = 0;
            } else if clk == 1 && st.last_clk == 0 {
                if load_n == SIG_LOW {
                    let a = bit(p_inputs, 2) as u8;
                    let b = bit(p_inputs, 3) as u8;
                    let c = bit(p_inputs, 4) as u8;
                    let d = bit(p_inputs, 5) as u8;
                    st.counter = (d << 3) | (c << 2) | (b << 1) | a;
                } else if enp == SIG_HIGH && ent == SIG_HIGH {
                    st.counter = (st.counter + 1) & 15;
                }
            }
            st.last_clk = clk;

            let qa = if (st.counter & 1) != 0 { SIG_HIGH } else { SIG_LOW };
            let qb = if (st.counter & 2) != 0 { SIG_HIGH } else { SIG_LOW };
            let qc = if (st.counter & 4) != 0 { SIG_HIGH } else { SIG_LOW };
            let qd = if (st.counter & 8) != 0 { SIG_HIGH } else { SIG_LOW };
            let cur_ent = inp_or(inputs, 9, SIG_HIGH);
            let rco = if st.counter == 15 && cur_ent == SIG_HIGH {
                SIG_HIGH
            } else {
                SIG_LOW
            };
            out.extend_from_slice(&[qd, qc, qb, qa, rco]);
        }
        NodeKind::Ic74LS191 => {
            let p_inputs: &[u8] = if cn.prev_inputs.is_empty() {
                inputs
            } else {
                &cn.prev_inputs
            };
            let b = inp(inputs, 0);
            let cten_n = inp_or(p_inputs, 1, SIG_LOW);
            let du = inp_or(p_inputs, 2, SIG_LOW);
            let d = inp(inputs, 4);
            let c = inp(inputs, 5);
            let load_n = inp_or(inputs, 6, SIG_HIGH);
            let clk = inp(inputs, 7);
            let a = inp(inputs, 8);

            if !st.initialized {
                st.last_clk = if clk == SIG_HIGH { 1 } else { 0 };
                st.initialized = true;
            }

            if load_n == SIG_LOW {
                if a == SIG_X
                    || b == SIG_X
                    || c == SIG_X
                    || d == SIG_X
                    || a == SIG_Z
                    || b == SIG_Z
                    || c == SIG_Z
                    || d == SIG_Z
                {
                    st.counter_is_x = true;
                } else {
                    st.counter_is_x = false;
                    st.counter = (if a == SIG_HIGH { 1 } else { 0 })
                        | (if b == SIG_HIGH { 2 } else { 0 })
                        | (if c == SIG_HIGH { 4 } else { 0 })
                        | (if d == SIG_HIGH { 8 } else { 0 });
                }
            } else {
                let rising_edge = st.last_clk == 0 && clk == SIG_HIGH;
                if rising_edge && cten_n == SIG_LOW && !st.counter_is_x {
                    if du == SIG_LOW {
                        st.counter = (st.counter + 1) & 15;
                    } else if du == SIG_HIGH {
                        st.counter = st.counter.wrapping_sub(1) & 15;
                    }
                }
            }

            if clk == SIG_LOW || clk == SIG_HIGH {
                st.last_clk = if clk == SIG_HIGH { 1 } else { 0 };
            }

            if st.counter_is_x {
                out.resize(6, SIG_X);
                return;
            }

            let val = st.counter;
            let qa = if (val & 1) != 0 { SIG_HIGH } else { SIG_LOW };
            let qb = if (val & 2) != 0 { SIG_HIGH } else { SIG_LOW };
            let qc = if (val & 4) != 0 { SIG_HIGH } else { SIG_LOW };
            let qd = if (val & 8) != 0 { SIG_HIGH } else { SIG_LOW };
            let max_min = if (du == SIG_LOW && val == 15) || (du == SIG_HIGH && val == 0) {
                SIG_HIGH
            } else {
                SIG_LOW
            };
            let rco_n = if max_min == SIG_HIGH && cten_n == SIG_LOW && clk == SIG_LOW {
                SIG_LOW
            } else {
                SIG_HIGH
            };
            out.extend_from_slice(&[qb, qa, qc, qd, max_min, rco_n]);
        }
        NodeKind::Ne555 => {
            // inputs: 0 = GND, 1 = TRIG', 2 = RST', 3 = VCC; outputs: [OUT]
            let trig_n = inp_or(inputs, 1, SIG_HIGH);
            let rst_n = inp_or(inputs, 2, SIG_HIGH);

            if rst_n == SIG_LOW {
                st.latch_q = 0;
                st.mono_remaining = 0;
                out.push(SIG_LOW);
            } else if cn.ne555_mode == Ne555Mode::Bistable {
                if trig_n == SIG_LOW {
                    st.latch_q = 1;
                }
                out.push(if st.latch_q != 0 { SIG_HIGH } else { SIG_LOW });
            } else if cn.ne555_mode == Ne555Mode::Monostable {
                if !st.initialized {
                    st.last_tick = tick_count;
                    st.initialized = true;
                }
                let tick_advanced = tick_count != st.last_tick;
                st.last_tick = tick_count;

                if trig_n == SIG_LOW {
                    st.mono_remaining = cn.pulse_ticks;
                    out.push(SIG_HIGH);
                } else if st.mono_remaining > 0 {
                    if tick_advanced {
                        st.mono_remaining = (st.mono_remaining - 1).max(0);
                    }
                    out.push(if st.mono_remaining > 0 {
                        SIG_HIGH
                    } else {
                        SIG_LOW
                    });
                } else {
                    out.push(SIG_LOW);
                }
            } else {
                if trig_n == SIG_LOW {
                    out.push(SIG_HIGH);
                    return;
                }
                let cycle = cn.high_ticks + cn.low_ticks;
                if cycle == 0 {
                    out.push(SIG_LOW);
                } else {
                    let cur = tick_count % cycle;
                    let is_high = if cn.start_high {
                        cur < cn.high_ticks
                    } else {
                        cur >= cn.low_ticks
                    };
                    out.push(if is_high { SIG_HIGH } else { SIG_LOW });
                }
            }
        }
        NodeKind::Ic74LS173 => {
            let p_inputs: &[u8] = if cn.prev_inputs.is_empty() {
                inputs
            } else {
                &cn.prev_inputs
            };
            let m1 = inp_or(inputs, 0, SIG_LOW);
            let m2 = inp_or(inputs, 1, SIG_LOW);
            let clk = if inp(inputs, 6) == SIG_HIGH { 1 } else { 0 };
            if !st.initialized {
                st.last_clk = clk;
                st.initialized = true;
            }
            let g1 = inp_or(p_inputs, 8, SIG_LOW);
            let g2 = inp_or(p_inputs, 9, SIG_LOW);
            let clr = inp_or(inputs, 10, SIG_LOW);

            if clr == SIG_HIGH {
                st.reg8 = 0;
            } else if clk == 1 && st.last_clk == 0 && g1 == SIG_LOW && g2 == SIG_LOW {
                st.reg8 = (bit(p_inputs, 2) as u8)
                    | ((bit(p_inputs, 3) as u8) << 1)
                    | ((bit(p_inputs, 4) as u8) << 2)
                    | ((bit(p_inputs, 5) as u8) << 3);
            }
            st.last_clk = clk;

            if m1 == SIG_LOW && m2 == SIG_LOW {
                // Outputs: [4Q, 3Q, 2Q, 1Q]
                out.push(if (st.reg8 & 8) != 0 { SIG_HIGH } else { SIG_LOW });
                out.push(if (st.reg8 & 4) != 0 { SIG_HIGH } else { SIG_LOW });
                out.push(if (st.reg8 & 2) != 0 { SIG_HIGH } else { SIG_LOW });
                out.push(if (st.reg8 & 1) != 0 { SIG_HIGH } else { SIG_LOW });
            } else {
                out.resize(4, SIG_Z);
            }
        }
        NodeKind::Ic74LS175 => {
            let p_inputs: &[u8] = if cn.prev_inputs.is_empty() {
                inputs
            } else {
                &cn.prev_inputs
            };
            let clr_val = inp_or(inputs, 0, SIG_HIGH);
            let clk_val = if inp(inputs, 4) == SIG_HIGH { 1 } else { 0 };
            if !st.initialized {
                st.last_clk = clk_val;
                st.initialized = true;
            }

            if clr_val == SIG_LOW {
                st.reg8 = 0;
            } else if clk_val == 1 && st.last_clk == 0 {
                st.reg8 = (bit(p_inputs, 1) as u8)
                    | ((bit(p_inputs, 2) as u8) << 1)
                    | ((bit(p_inputs, 5) as u8) << 2)
                    | ((bit(p_inputs, 6) as u8) << 3);
            }
            st.last_clk = clk_val;

            let q1 = (st.reg8 & 1) != 0;
            let q2 = (st.reg8 & 2) != 0;
            let q3 = (st.reg8 & 4) != 0;
            let q4 = (st.reg8 & 8) != 0;
            out.extend_from_slice(&[
                if q1 { SIG_HIGH } else { SIG_LOW },
                if q1 { SIG_LOW } else { SIG_HIGH },
                if q2 { SIG_LOW } else { SIG_HIGH },
                if q2 { SIG_HIGH } else { SIG_LOW },
                if q3 { SIG_HIGH } else { SIG_LOW },
                if q3 { SIG_LOW } else { SIG_HIGH },
                if q4 { SIG_LOW } else { SIG_HIGH },
                if q4 { SIG_HIGH } else { SIG_LOW },
            ]);
        }
        NodeKind::Ic74LS273 => {
            let p_inputs: &[u8] = if cn.prev_inputs.is_empty() {
                inputs
            } else {
                &cn.prev_inputs
            };
            let mr_n = inp_or(inputs, 0, SIG_HIGH);
            let cp = if inp(inputs, 6) == SIG_HIGH { 1 } else { 0 };
            if !st.initialized {
                st.last_clk = cp;
                st.initialized = true;
            }

            if mr_n == SIG_LOW {
                st.reg8 = 0;
            } else if cp == 1 && st.last_clk == 0 {
                st.reg8 = ((bit(p_inputs, 10) as u8) << 7)
                    | ((bit(p_inputs, 9) as u8) << 6)
                    | ((bit(p_inputs, 8) as u8) << 5)
                    | ((bit(p_inputs, 7) as u8) << 4)
                    | ((bit(p_inputs, 4) as u8) << 3)
                    | ((bit(p_inputs, 3) as u8) << 2)
                    | ((bit(p_inputs, 2) as u8) << 1)
                    | (bit(p_inputs, 1) as u8);
            }
            st.last_clk = cp;

            for i in 0..8 {
                out.push(if (st.reg8 & (1 << i)) != 0 {
                    SIG_HIGH
                } else {
                    SIG_LOW
                });
            }
        }
        NodeKind::Ic74LS373 => {
            let oe_n = inp_or(inputs, 0, SIG_HIGH);
            let le = inp_or(inputs, 9, SIG_LOW);
            if le == SIG_HIGH {
                let mut v = 0u8;
                for i in 0..8 {
                    if bit(inputs, 1 + i) == 1 {
                        v |= 1 << i;
                    }
                }
                st.reg8 = v;
            }
            if oe_n == SIG_HIGH {
                out.resize(8, SIG_Z);
            } else {
                for i in 0..8 {
                    out.push(if (st.reg8 & (1 << i)) != 0 {
                        SIG_HIGH
                    } else {
                        SIG_LOW
                    });
                }
            }
        }
        NodeKind::Ic74LS374 => {
            let p_inputs: &[u8] = if cn.prev_inputs.is_empty() {
                inputs
            } else {
                &cn.prev_inputs
            };
            let oe_n = inp_or(inputs, 0, SIG_HIGH);
            let clk = if inp(inputs, 9) == SIG_HIGH { 1 } else { 0 };
            if !st.initialized {
                st.last_clk = clk;
                st.initialized = true;
            }
            if clk == 1 && st.last_clk == 0 {
                let mut v = 0u8;
                for i in 0..8 {
                    if bit(p_inputs, 1 + i) == 1 {
                        v |= 1 << i;
                    }
                }
                st.reg8 = v;
            }
            st.last_clk = clk;

            if oe_n == SIG_HIGH {
                out.resize(8, SIG_Z);
            } else {
                for i in 0..8 {
                    out.push(if (st.reg8 & (1 << i)) != 0 {
                        SIG_HIGH
                    } else {
                        SIG_LOW
                    });
                }
            }
        }
        _ => {}
    }
}
