use std::collections::HashMap;
use super::simulator::RustSimulator;
use super::types::{BreakpointRuleDto, SIG_HIGH, SIG_LOW, SIG_X};

#[derive(Clone, Copy)]
pub(crate) enum BpCond {
    ShortCircuitAll,
    ShortCircuitPins,
    Rising,
    Falling,
    High,
    Low,
    Equals(u32),
}

pub(crate) struct CompiledBreakpoint<'a> {
    pub id: &'a str,
    pub pins: &'a [Option<usize>],
    pub cond: BpCond,
}

pub fn parse_target_number(raw: Option<&str>) -> Option<u32> {
    let s = raw?.trim().replace('_', "");
    if s.is_empty() {
        return None;
    }
    if let Some(hex) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
        u32::from_str_radix(hex, 16).ok()
    } else if let Some(bin) = s.strip_prefix("0b").or_else(|| s.strip_prefix("0B")) {
        u32::from_str_radix(bin, 2).ok()
    } else if s.chars().all(|c| c.is_ascii_digit()) {
        s.parse::<u32>().ok()
    } else if s.chars().all(|c| c.is_ascii_hexdigit()) {
        u32::from_str_radix(&s, 16).ok()
    } else {
        None
    }
}

impl RustSimulator {
    pub(crate) fn compile_breakpoints<'a>(
        breakpoints: &'a [BreakpointRuleDto],
        channel_map: &'a HashMap<&'a str, Vec<Option<usize>>>,
    ) -> Vec<CompiledBreakpoint<'a>> {
        let mut compiled = Vec::new();
        for bp in breakpoints {
            if !bp.enabled {
                continue;
            }
            if bp.condition_type == "short_circuit" {
                if bp.target_channel_id == "__ANY_NET__" {
                    compiled.push(CompiledBreakpoint {
                        id: &bp.id,
                        pins: &[],
                        cond: BpCond::ShortCircuitAll,
                    });
                } else if let Some(pins) = channel_map.get(bp.target_channel_id.as_str()) {
                    compiled.push(CompiledBreakpoint {
                        id: &bp.id,
                        pins,
                        cond: BpCond::ShortCircuitPins,
                    });
                }
                continue;
            }

            let Some(pins) = channel_map.get(bp.target_channel_id.as_str()) else {
                continue;
            };
            if pins.is_empty() {
                continue;
            }

            let cond = match bp.condition_type.as_str() {
                "rising" => BpCond::Rising,
                "falling" => BpCond::Falling,
                "high" => BpCond::High,
                "low" => BpCond::Low,
                "equals" => {
                    let Some(target_num) = parse_target_number(bp.value.as_deref()) else {
                        continue;
                    };
                    BpCond::Equals(target_num)
                }
                _ => continue,
            };

            compiled.push(CompiledBreakpoint {
                id: &bp.id,
                pins,
                cond,
            });
        }
        compiled
    }

    pub(crate) fn evaluate_compiled_breakpoints(
        &self,
        compiled_bps: &[CompiledBreakpoint<'_>],
        trap_short_circuit: bool,
    ) -> Option<String> {
        let total_pins = self.cur_buf.len();

        if trap_short_circuit {
            for i in 0..total_pins {
                if self.cur_buf[i] == SIG_X && self.prev_buf[i] != SIG_X {
                    return Some("__TRAP_SHORT__".to_string());
                }
            }
        }

        for bp in compiled_bps {
            match bp.cond {
                BpCond::ShortCircuitAll => {
                    for p in 0..total_pins {
                        if self.cur_buf[p] == SIG_X && self.prev_buf[p] != SIG_X {
                            return Some(bp.id.to_string());
                        }
                    }
                }
                BpCond::ShortCircuitPins => {
                    for &opt_idx in bp.pins {
                        if let Some(idx) = opt_idx {
                            if self.cur_buf[idx] == SIG_X && self.prev_buf[idx] != SIG_X {
                                return Some(bp.id.to_string());
                            }
                        }
                    }
                }
                BpCond::Rising => {
                    if let Some(&Some(idx)) = bp.pins.last() {
                        if self.prev_buf[idx] == SIG_LOW && self.cur_buf[idx] == SIG_HIGH {
                            return Some(bp.id.to_string());
                        }
                    }
                }
                BpCond::Falling => {
                    if let Some(&Some(idx)) = bp.pins.last() {
                        if self.prev_buf[idx] == SIG_HIGH && self.cur_buf[idx] == SIG_LOW {
                            return Some(bp.id.to_string());
                        }
                    }
                }
                BpCond::High => {
                    if let Some(&Some(idx)) = bp.pins.last() {
                        if self.cur_buf[idx] == SIG_HIGH && self.prev_buf[idx] != SIG_HIGH {
                            return Some(bp.id.to_string());
                        }
                    }
                }
                BpCond::Low => {
                    if let Some(&Some(idx)) = bp.pins.last() {
                        if self.cur_buf[idx] == SIG_LOW && self.prev_buf[idx] != SIG_LOW {
                            return Some(bp.id.to_string());
                        }
                    }
                }
                BpCond::Equals(target_num) => {
                    let mut cur_val: u32 = 0;
                    let mut prev_val: u32 = 0;
                    let mut valid_cur = true;
                    let mut valid_prev = true;

                    for &opt_idx in bp.pins {
                        let Some(idx) = opt_idx else {
                            valid_cur = false;
                            break;
                        };
                        let c_bit = self.cur_buf[idx];
                        let p_bit = self.prev_buf[idx];
                        if c_bit != SIG_LOW && c_bit != SIG_HIGH {
                            valid_cur = false;
                            break;
                        }
                        if p_bit != SIG_LOW && p_bit != SIG_HIGH {
                            valid_prev = false;
                        }
                        cur_val = (cur_val << 1) | (c_bit as u32);
                        prev_val = (prev_val << 1) | if p_bit == SIG_HIGH { 1 } else { 0 };
                    }

                    if valid_cur && cur_val == target_num && (!valid_prev || prev_val != target_num)
                    {
                        return Some(bp.id.to_string());
                    }
                }
            }
        }

        None
    }
}
