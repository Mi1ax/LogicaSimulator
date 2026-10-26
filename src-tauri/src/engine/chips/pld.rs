use super::inp;
use crate::engine::types::{CompiledNode, NodeInternalState, SIG_HIGH, SIG_LOW, SIG_Z};

#[derive(Debug, Clone, Default)]
pub struct CompiledJedec {
    pub rows: Vec<Option<Vec<usize>>>,
    pub olmc_active_rows: Vec<Vec<usize>>,
    pub s0: [u8; 10],
    pub s1: [u8; 10],
}

const GAL22V10_COL_MAP: [(usize, usize); 22] = [
    (0, 0),   // Pin 1
    (22, 2),  // Pin 23
    (1, 4),   // Pin 2
    (21, 6),  // Pin 22
    (2, 8),   // Pin 3
    (20, 10), // Pin 21
    (3, 12),  // Pin 4
    (19, 14), // Pin 20
    (4, 16),  // Pin 5
    (18, 18), // Pin 19
    (5, 20),  // Pin 6
    (17, 22), // Pin 18
    (6, 24),  // Pin 7
    (16, 26), // Pin 17
    (7, 28),  // Pin 8
    (15, 30), // Pin 16
    (8, 32),  // Pin 9
    (14, 34), // Pin 15
    (9, 36),  // Pin 10
    (13, 38), // Pin 14
    (10, 40), // Pin 11
    (12, 42), // Pin 13
];

struct OlmcInfo {
    s0_fuse: usize,
    s1_fuse: usize,
    start_row: usize,
    size: usize,
}

const GAL22V10_OLMC_MAP: [OlmcInfo; 10] = [
    OlmcInfo { s0_fuse: 5826, s1_fuse: 5827, start_row: 122, size: 9 },
    OlmcInfo { s0_fuse: 5824, s1_fuse: 5825, start_row: 111, size: 11 },
    OlmcInfo { s0_fuse: 5822, s1_fuse: 5823, start_row: 98, size: 13 },
    OlmcInfo { s0_fuse: 5820, s1_fuse: 5821, start_row: 83, size: 15 },
    OlmcInfo { s0_fuse: 5818, s1_fuse: 5819, start_row: 66, size: 17 },
    OlmcInfo { s0_fuse: 5816, s1_fuse: 5817, start_row: 49, size: 17 },
    OlmcInfo { s0_fuse: 5814, s1_fuse: 5815, start_row: 34, size: 15 },
    OlmcInfo { s0_fuse: 5812, s1_fuse: 5813, start_row: 21, size: 13 },
    OlmcInfo { s0_fuse: 5810, s1_fuse: 5811, start_row: 10, size: 11 },
    OlmcInfo { s0_fuse: 5808, s1_fuse: 5809, start_row: 1, size: 9 },
];

pub fn compile_jedec(jedec_str: &str) -> CompiledJedec {
    let max_fuses = 5828;
    let mut fuses = vec![false; max_fuses];

    if !jedec_str.is_empty() {
        for chunk in jedec_str.split('*') {
            let token = chunk.trim();
            if token.starts_with("F1") {
                fuses.fill(true);
                break;
            } else if token.starts_with("F0") {
                fuses.fill(false);
                break;
            }
        }

        for chunk in jedec_str.split('*') {
            let token = chunk.trim();
            if let Some(rest) = token.strip_prefix('L') {
                let rest = rest.trim_start();
                let digits_end = rest
                    .find(|c: char| !c.is_ascii_digit())
                    .unwrap_or(rest.len());
                if digits_end > 0 {
                    if let Ok(mut addr) = rest[..digits_end].parse::<usize>() {
                        for ch in rest[digits_end..].chars() {
                            if ch == '0' || ch == '1' {
                                if addr < max_fuses {
                                    fuses[addr] = ch == '1';
                                }
                                addr += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    let mut rows = Vec::with_capacity(132);
    for r in 0..132 {
        let row_start = r * 44;
        let mut contradiction = false;
        let mut c = 0;
        while c < 44 {
            if !fuses[row_start + c] && !fuses[row_start + c + 1] {
                contradiction = true;
                break;
            }
            c += 2;
        }
        if contradiction {
            rows.push(None);
        } else {
            let mut active_cols = Vec::new();
            for col in 0..44 {
                if !fuses[row_start + col] {
                    active_cols.push(col);
                }
            }
            rows.push(Some(active_cols));
        }
    }

    let mut olmc_active_rows = Vec::with_capacity(10);
    let mut s0 = [0u8; 10];
    let mut s1 = [0u8; 10];

    for (i, olmc) in GAL22V10_OLMC_MAP.iter().enumerate() {
        s0[i] = if fuses[olmc.s0_fuse] { 1 } else { 0 };
        s1[i] = if fuses[olmc.s1_fuse] { 1 } else { 0 };
        let mut active = Vec::new();
        for r in 1..olmc.size {
            let row_idx = olmc.start_row + r;
            if rows[row_idx].is_some() {
                active.push(row_idx);
            }
        }
        olmc_active_rows.push(active);
    }

    CompiledJedec {
        rows,
        olmc_active_rows,
        s0,
        s1,
    }
}

fn fill_gal_col_states(
    source_inputs: &[u8],
    s1: &[u8; 10],
    regs: &[u8; 10],
    out_col_states: &mut [u8; 44],
) {
    for &(pin, true_col) in &GAL22V10_COL_MAP {
        let val = if (13..=22).contains(&pin) {
            let olmc_index = pin - 13;
            if s1[olmc_index] == 0 {
                if regs[olmc_index] == 1 {
                    0
                } else {
                    1
                }
            } else if inp(source_inputs, pin) == SIG_HIGH {
                1
            } else {
                0
            }
        } else if inp(source_inputs, pin) == SIG_HIGH {
            1
        } else {
            0
        };
        out_col_states[true_col] = val;
        out_col_states[true_col + 1] = if val == 1 { 0 } else { 1 };
    }
}

#[inline]
fn eval_jedec_row(rows: &[Option<Vec<usize>>], row_idx: usize, states: &[u8; 44]) -> u8 {
    let Some(Some(active_cols)) = rows.get(row_idx) else {
        return 0;
    };
    for &col in active_cols {
        if states[col] == 0 {
            return 0;
        }
    }
    1
}

pub fn eval_gal22v10(
    cn: &CompiledNode,
    inputs: &[u8],
    st: &mut NodeInternalState,
    out: &mut Vec<u8>,
) {
    let Some(jedec) = cn.compiled_jedec.as_deref() else {
        out.resize(10, SIG_Z);
        return;
    };
    if jedec.rows.len() < 132 {
        out.resize(10, SIG_Z);
        return;
    }

    let clk = if inp(inputs, 0) == SIG_HIGH { 1 } else { 0 };
    if !st.initialized {
        st.last_clk = clk;
        st.initialized = true;
    }
    let is_rising_edge = clk == 1 && st.last_clk == 0;
    st.last_clk = clk;

    let rows = &jedec.rows;
    let olmc_active_rows = &jedec.olmc_active_rows;
    let s0 = &jedec.s0;
    let s1 = &jedec.s1;

    let mut col_states = [0u8; 44];
    let mut prev_col_states = [0u8; 44];
    fill_gal_col_states(inputs, s1, &st.olmc_reg, &mut col_states);

    let has_prev = is_rising_edge && !cn.prev_inputs.is_empty();
    if has_prev {
        fill_gal_col_states(&cn.prev_inputs, s1, &st.olmc_reg, &mut prev_col_states);
    } else {
        prev_col_states = col_states;
    }

    let ar = eval_jedec_row(rows, 0, &col_states);
    let ar_prev = if has_prev {
        eval_jedec_row(rows, 0, &prev_col_states)
    } else {
        ar
    };
    let sp_prev = if is_rising_edge {
        eval_jedec_row(rows, 131, &prev_col_states)
    } else {
        0
    };

    let mut or_results = [0u8; 10];
    let mut d_inputs_prev = [0u8; 10];
    let mut oes = [0u8; 10];

    for i in 0..10 {
        let olmc = &GAL22V10_OLMC_MAP[i];
        oes[i] = eval_jedec_row(rows, olmc.start_row, &col_states);

        let mut or_res = 0u8;
        let mut or_res_prev = 0u8;
        for &row_idx in &olmc_active_rows[i] {
            if or_res == 0 && eval_jedec_row(rows, row_idx, &col_states) == 1 {
                or_res = 1;
            }
            if has_prev
                && or_res_prev == 0
                && eval_jedec_row(rows, row_idx, &prev_col_states) == 1
            {
                or_res_prev = 1;
            }
        }
        if !has_prev {
            or_res_prev = or_res;
        }
        or_results[i] = or_res;
        d_inputs_prev[i] = or_res_prev;
    }

    if ar == 1 || ar_prev == 1 {
        st.olmc_reg = [0; 10];
    } else if is_rising_edge {
        if sp_prev == 1 {
            st.olmc_reg = [1; 10];
        } else {
            st.olmc_reg = d_inputs_prev;
        }
    }

    for i in 0..10 {
        let mut pin_out = if s1[i] == 0 {
            if st.olmc_reg[i] != 0 {
                SIG_HIGH
            } else {
                SIG_LOW
            }
        } else if or_results[i] != 0 {
            SIG_HIGH
        } else {
            SIG_LOW
        };
        if s0[i] == 0 {
            pin_out = if pin_out == SIG_HIGH {
                SIG_LOW
            } else {
                SIG_HIGH
            };
        }
        out.push(if oes[i] == 1 { pin_out } else { SIG_Z });
    }
}
