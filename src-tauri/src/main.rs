#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine;

use engine::{
    AnalyzerChannelDto, BreakpointRuleDto, NodeDto, RustSimulator, StepResultDto, WireDto,
};
use std::sync::Mutex;
use std::time::Instant;
use tauri::State;

struct AppSimState {
    sim: Mutex<RustSimulator>,
}

#[tauri::command]
fn rust_compile_circuit(
    state: State<'_, AppSimState>,
    nodes: Vec<NodeDto>,
    wires: Vec<WireDto>,
    preserve_state: Option<bool>,
) -> Vec<String> {
    let mut sim = state.sim.lock().unwrap();
    sim.compile_with_options(nodes, wires, preserve_state.unwrap_or(false))
}

#[tauri::command]
fn rust_update_node_input(
    state: State<'_, AppSimState>,
    node_id: String,
    props: serde_json::Value,
) {
    let mut sim = state.sim.lock().unwrap();
    sim.update_node_input(&node_id, &props);
}

#[tauri::command]
fn rust_step_batch(
    state: State<'_, AppSimState>,
    ticks: u32,
    tracked_pin_ids: Option<Vec<String>>,
    breakpoints: Option<Vec<BreakpointRuleDto>>,
    channels: Option<Vec<AnalyzerChannelDto>>,
    trap_short_circuit: Option<bool>,
    selected_memory_node_id: Option<String>,
) -> StepResultDto {
    let start = Instant::now();
    let mut sim = state.sim.lock().unwrap();
    let tracked = tracked_pin_ids.unwrap_or_default();
    let bps = breakpoints.unwrap_or_default();
    let chs = channels.unwrap_or_default();
    let trap = trap_short_circuit.unwrap_or(false);

    let (
        triggered_breakpoint_id,
        triggered_tick,
        analyzer_ticks,
        analyzer_samples,
        selected_memory,
    ) = sim.step_batch(
        ticks,
        &tracked,
        &bps,
        &chs,
        trap,
        selected_memory_node_id.as_deref(),
    );
    let elapsed_us = start.elapsed().as_micros() as u64;
    StepResultDto {
        tick_count: sim.tick_count,
        pin_states: sim.cur_buf.clone(),
        elapsed_us,
        triggered_breakpoint_id,
        triggered_tick,
        analyzer_ticks,
        analyzer_samples,
        selected_memory,
    }
}

fn main() {
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("GIO_USE_VFS").is_none() {
            std::env::set_var("GIO_USE_VFS", "local");
        }
        if std::env::var_os("GIO_USE_VOLUME_MONITOR").is_none() {
            std::env::set_var("GIO_USE_VOLUME_MONITOR", "unix");
        }
    }

    tauri::Builder::default()
        .manage(AppSimState {
            sim: Mutex::new(RustSimulator::default()),
        })
        .invoke_handler(tauri::generate_handler![
            rust_compile_circuit,
            rust_update_node_input,
            rust_step_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
