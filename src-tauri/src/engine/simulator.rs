use std::collections::{HashMap, VecDeque};
use super::chips::evaluate_node;
use super::chips::pld::compile_jedec;
use super::types::{
    AnalyzerChannelDto, BreakpointRuleDto, CompiledNet, CompiledNode, MAX_LA_HISTORY, SIG_HIGH,
    SIG_LOW, SIG_X, SIG_Z,
};

#[derive(Default)]
pub struct RustSimulator {
    pub tick_count: u64,
    pub all_pin_ids: Vec<String>,
    pub pin_id_to_idx: HashMap<String, usize>,
    pub nodes: Vec<CompiledNode>,
    pub node_id_to_idx: HashMap<String, usize>,
    pub nets: Vec<CompiledNet>,
    pub pin_to_net: Vec<isize>,
    pub disconnected_input_indices: Vec<usize>,
    pub is_weak_pin: Vec<bool>,

    // Event-driven node classification indices
    pub initial_settled: bool,
    pub tick_root_nodes: Vec<usize>,
    pub prev_input_nodes: Vec<usize>,
    pub stateful_nodes: Vec<usize>,
    pub forced_dirty_nodes: Vec<usize>,

    // Flat simulation buffers (reused across ticks with 0 allocations)
    pub cur_buf: Vec<u8>,
    pub prev_buf: Vec<u8>,
    pub driver_buf: Vec<u8>,
    pub dirty_net_flags: Vec<u8>,
    pub dirty_node_flags: Vec<u8>,

    // Reusable scratch buffers for relaxation iterations
    pub all_nets_indices: Vec<usize>,
    pub active_nodes_buf: Vec<usize>,
    pub next_dirty_nodes_buf: Vec<usize>,
    pub dirty_nets_buf: Vec<usize>,
    pub in_vals_buf: Vec<u8>,
    pub out_vals_buf: Vec<u8>,
}

impl RustSimulator {
    pub fn update_node_input(&mut self, node_id: &str, props: &serde_json::Value) {
        if let Some(&idx) = self.node_id_to_idx.get(node_id) {
            let cn = &mut self.nodes[idx];
            if let Some(v) = props.get("value") {
                cn.value = v.as_i64().map(|x| if x == 1 { SIG_HIGH } else { SIG_LOW });
            }
            if let Some(p) = props.get("pressed").and_then(|v| v.as_bool()) {
                cn.pressed = p;
            }
            if let Some(al) = props.get("activeLow").and_then(|v| v.as_bool()) {
                cn.active_low = al;
            }
            if let Some(mv) = props.get("manualValue").and_then(|v| v.as_i64()) {
                cn.manual_value = if mv == 1 { SIG_HIGH } else { SIG_LOW };
            }
            if let Some(mode) = props.get("mode").and_then(|v| v.as_str()) {
                cn.clock_manual = mode == "manual";
            }
            if let Some(sw) = props.get("switches").and_then(|v| v.as_array()) {
                cn.switches = sw
                    .iter()
                    .map(|x| if x.as_i64() == Some(1) { SIG_HIGH } else { SIG_LOW })
                    .collect();
            }
            if let Some(data) = props.get("data").and_then(|v| v.as_array()) {
                let bytes: Vec<u8> = data
                    .iter()
                    .map(|x| (x.as_u64().unwrap_or(0) & 0xFF) as u8)
                    .collect();
                if !cn.sram.is_empty() {
                    cn.sram.fill(0);
                    let copy_len = bytes.len().min(cn.sram.len());
                    cn.sram[..copy_len].copy_from_slice(&bytes[..copy_len]);
                }
                cn.rom_data = bytes;
            }
            if let Some(jedec_str) = props.get("jedecString").and_then(|v| v.as_str()) {
                cn.compiled_jedec = Some(Box::new(compile_jedec(jedec_str)));
            }
            cn.last_inputs.fill(255);
            self.forced_dirty_nodes.push(idx);
        }
    }

    pub fn step_batch(
        &mut self,
        ticks: u32,
        tracked_pin_ids: &[String],
        breakpoints: &[BreakpointRuleDto],
        channels: &[AnalyzerChannelDto],
        trap_short_circuit: bool,
        selected_memory_node_id: Option<&str>,
    ) -> (
        Option<String>,
        u64,
        Vec<u32>,
        Vec<u8>,
        Option<Vec<u8>>,
    ) {
        let count = ticks.max(1);
        let tracked_indices: Vec<Option<usize>> = tracked_pin_ids
            .iter()
            .map(|pid| self.pin_id_to_idx.get(pid).copied())
            .collect();

        let has_active_bp =
            trap_short_circuit || breakpoints.iter().any(|b| b.enabled);

        let mut channel_map: HashMap<&str, Vec<Option<usize>>> = HashMap::new();
        if has_active_bp {
            for ch in channels {
                let idxs = ch
                    .pin_ids
                    .iter()
                    .map(|pid| self.pin_id_to_idx.get(pid).copied())
                    .collect();
                channel_map.insert(ch.id.as_str(), idxs);
            }
        }
        let compiled_bps = if has_active_bp {
            Self::compile_breakpoints(breakpoints, &channel_map)
        } else {
            Vec::new()
        };

        let k = tracked_indices.len();
        let mut ring_ticks: VecDeque<u32> = VecDeque::new();
        let mut ring_samples: VecDeque<u8> = VecDeque::new();
        let mut direct_ticks: Vec<u32> = Vec::new();
        let mut direct_samples: Vec<u8> = Vec::new();
        let use_direct = (count as usize) <= MAX_LA_HISTORY;

        if k > 0 {
            let cap = (count as usize).min(MAX_LA_HISTORY);
            if use_direct {
                direct_ticks.reserve(cap);
                direct_samples.reserve(cap * k);
            } else {
                ring_ticks.reserve(cap);
                ring_samples.reserve(cap * k);
            }
        }

        let mut triggered_bp_id: Option<String> = None;
        let mut triggered_tick: u64 = 0;

        for _ in 0..count {
            self.step_single_tick();

            if k > 0 {
                if use_direct {
                    direct_ticks.push(self.tick_count as u32);
                    for &opt_idx in &tracked_indices {
                        let sig = opt_idx
                            .and_then(|idx| self.cur_buf.get(idx).copied())
                            .unwrap_or(SIG_Z);
                        direct_samples.push(sig);
                    }
                } else {
                    if ring_ticks.len() == MAX_LA_HISTORY {
                        ring_ticks.pop_front();
                        for _ in 0..k {
                            ring_samples.pop_front();
                        }
                    }
                    ring_ticks.push_back(self.tick_count as u32);
                    for &opt_idx in &tracked_indices {
                        let sig = opt_idx
                            .and_then(|idx| self.cur_buf.get(idx).copied())
                            .unwrap_or(SIG_Z);
                        ring_samples.push_back(sig);
                    }
                }
            }

            if has_active_bp {
                if let Some(hit_id) = self.evaluate_compiled_breakpoints(
                    &compiled_bps,
                    trap_short_circuit,
                ) {
                    triggered_bp_id = Some(hit_id);
                    triggered_tick = self.tick_count;
                    break;
                }
            }
        }

        let selected_memory = selected_memory_node_id
            .and_then(|nid| self.node_id_to_idx.get(nid))
            .and_then(|&idx| {
                let cn = &self.nodes[idx];
                if !cn.sram.is_empty() {
                    Some(cn.sram.clone())
                } else {
                    None
                }
            });

        let (final_ticks, final_samples) = if use_direct {
            (direct_ticks, direct_samples)
        } else {
            (
                ring_ticks.into_iter().collect(),
                ring_samples.into_iter().collect(),
            )
        };

        (
            triggered_bp_id,
            triggered_tick,
            final_ticks,
            final_samples,
            selected_memory,
        )
    }

    pub fn step_single_tick(&mut self) {
        self.prev_buf.copy_from_slice(&self.cur_buf);

        if !self.initial_settled {
            for &pin_idx in &self.disconnected_input_indices {
                self.cur_buf[pin_idx] = SIG_Z;
            }
        }

        for &node_idx in &self.prev_input_nodes {
            let cn = &mut self.nodes[node_idx];
            for (p, &pin_idx) in cn.input_pin_indices.iter().enumerate() {
                cn.prev_inputs[p] = self.prev_buf[pin_idx];
            }
        }

        let num_nodes = self.nodes.len();
        self.active_nodes_buf.clear();
        if !self.initial_settled {
            self.active_nodes_buf.extend(0..num_nodes);
            self.forced_dirty_nodes.clear();
        } else {
            for &n_idx in &self.tick_root_nodes {
                if self.dirty_node_flags[n_idx] == 0 {
                    self.dirty_node_flags[n_idx] = 1;
                    self.active_nodes_buf.push(n_idx);
                }
            }
            for &n_idx in &self.forced_dirty_nodes {
                if self.dirty_node_flags[n_idx] == 0 {
                    self.dirty_node_flags[n_idx] = 1;
                    self.active_nodes_buf.push(n_idx);
                }
            }
            for &n_idx in &self.active_nodes_buf {
                self.dirty_node_flags[n_idx] = 0;
            }
            self.forced_dirty_nodes.clear();
        }

        const MAX_ITERATIONS: usize = 50;
        for iter in 0..MAX_ITERATIONS {
            if self.active_nodes_buf.is_empty() {
                break;
            }
            let first_tick_iter0 = !self.initial_settled && iter == 0;
            let mut changed = false;
            self.dirty_nets_buf.clear();
            self.next_dirty_nodes_buf.clear();

            for i in 0..self.active_nodes_buf.len() {
                let node_idx = self.active_nodes_buf[i];
                let cn = &mut self.nodes[node_idx];
                self.in_vals_buf.clear();
                let mut inputs_changed = iter == 0;
                for (p, &pin_idx) in cn.input_pin_indices.iter().enumerate() {
                    let v = self.cur_buf[pin_idx];
                    self.in_vals_buf.push(v);
                    if v != cn.last_inputs[p] {
                        cn.last_inputs[p] = v;
                        inputs_changed = true;
                    }
                }

                if !inputs_changed {
                    continue;
                }

                let is_powered = (cn.vcc_input_idx == -1
                    || self.in_vals_buf[cn.vcc_input_idx as usize] != SIG_LOW)
                    && (cn.gnd_input_idx == -1
                        || self.in_vals_buf[cn.gnd_input_idx as usize] != SIG_HIGH);

                self.out_vals_buf.clear();
                let mut next_state = cn.state;
                if !is_powered {
                    self.out_vals_buf.resize(cn.output_pin_indices.len(), SIG_Z);
                } else {
                    evaluate_node(
                        cn,
                        &self.in_vals_buf,
                        self.tick_count,
                        &mut next_state,
                        &mut self.out_vals_buf,
                    );
                }
                cn.next_state = next_state;

                let is_weak_out = if cn.kind.is_button() {
                    Some(!cn.pressed)
                } else {
                    None
                };

                for (p, &pin_idx) in cn.output_pin_indices.iter().enumerate() {
                    let val = self.out_vals_buf.get(p).copied().unwrap_or(SIG_Z);
                    let mut driver_changed = false;
                    if let Some(weak_flag) = is_weak_out {
                        if self.is_weak_pin[pin_idx] != weak_flag {
                            self.is_weak_pin[pin_idx] = weak_flag;
                            driver_changed = true;
                        }
                    }
                    if first_tick_iter0 || self.driver_buf[pin_idx] != val || driver_changed {
                        self.driver_buf[pin_idx] = val;
                        let net_idx = self.pin_to_net[pin_idx];
                        if net_idx >= 0 {
                            let u_net = net_idx as usize;
                            if !first_tick_iter0 && self.dirty_net_flags[u_net] == 0 {
                                self.dirty_net_flags[u_net] = 1;
                                self.dirty_nets_buf.push(u_net);
                            }
                        } else if self.cur_buf[pin_idx] != val {
                            self.cur_buf[pin_idx] = val;
                            changed = true;
                            if cn.has_self_feedback && self.dirty_node_flags[node_idx] == 0 {
                                self.dirty_node_flags[node_idx] = 1;
                                self.next_dirty_nodes_buf.push(node_idx);
                            }
                        }
                    }
                }
            }

            let nets_to_resolve: &[usize] = if first_tick_iter0 {
                &self.all_nets_indices
            } else {
                &self.dirty_nets_buf
            };

            for &net_idx in nets_to_resolve {
                self.dirty_net_flags[net_idx] = 0;
                let net = &self.nets[net_idx];
                let mut strong_val: Option<u8> = None;
                let mut strong_collision = false;

                for &d_idx in &net.strong_driver_indices {
                    if self.is_weak_pin[d_idx] {
                        continue;
                    }
                    let val = self.driver_buf[d_idx];
                    if val != SIG_Z {
                        if let Some(sv) = strong_val {
                            if sv != val {
                                strong_collision = true;
                                break;
                            }
                        } else {
                            strong_val = Some(val);
                        }
                    }
                }

                let resolved = if strong_collision {
                    SIG_X
                } else if let Some(sv) = strong_val {
                    sv
                } else if !net.weak_driver_indices.is_empty() {
                    let mut weak_val: Option<u8> = None;
                    let mut weak_collision = false;
                    for &w_idx in &net.weak_driver_indices {
                        if !self.is_weak_pin[w_idx] {
                            continue;
                        }
                        let val = self.driver_buf[w_idx];
                        if val != SIG_Z {
                            if let Some(wv) = weak_val {
                                if wv != val {
                                    weak_collision = true;
                                    break;
                                }
                            } else {
                                weak_val = Some(val);
                            }
                        }
                    }
                    if weak_collision {
                        SIG_X
                    } else {
                        weak_val.unwrap_or(SIG_Z)
                    }
                } else {
                    SIG_Z
                };

                let mut net_pin_changed = false;
                for &pin_idx in &net.all_pin_indices {
                    if self.cur_buf[pin_idx] != resolved {
                        self.cur_buf[pin_idx] = resolved;
                        changed = true;
                        net_pin_changed = true;
                    }
                }

                if net_pin_changed {
                    for &f_node_idx in &net.fanout_node_indices {
                        if self.dirty_node_flags[f_node_idx] == 0 {
                            self.dirty_node_flags[f_node_idx] = 1;
                            self.next_dirty_nodes_buf.push(f_node_idx);
                        }
                    }
                }
            }

            for &n_idx in &self.next_dirty_nodes_buf {
                self.dirty_node_flags[n_idx] = 0;
            }

            if !changed || self.next_dirty_nodes_buf.is_empty() {
                break;
            }
            if iter == MAX_ITERATIONS - 1 {
                self.forced_dirty_nodes
                    .extend_from_slice(&self.next_dirty_nodes_buf);
            } else {
                self.active_nodes_buf.clear();
                self.active_nodes_buf
                    .extend_from_slice(&self.next_dirty_nodes_buf);
            }
        }

        // Commit sequential state at end of tick
        for &node_idx in &self.stateful_nodes {
            let cn = &mut self.nodes[node_idx];
            cn.state = cn.next_state;
        }

        self.initial_settled = true;
        self.tick_count += 1;
    }
}
