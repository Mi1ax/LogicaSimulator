use serde::{Deserialize, Serialize};
use super::chips::pld::CompiledJedec;

pub const SIG_LOW: u8 = 0;
pub const SIG_HIGH: u8 = 1;
pub const SIG_Z: u8 = 2;
pub const SIG_X: u8 = 3;

pub const MAX_LA_HISTORY: usize = 1024;

#[derive(Debug, Clone, Deserialize)]
pub struct PinDto {
    pub id: String,
    #[serde(default)]
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WireDto {
    pub source_pin_id: String,
    pub target_pin_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeDto {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(default)]
    pub inputs: Vec<PinDto>,
    #[serde(default)]
    pub outputs: Vec<PinDto>,
    #[serde(default)]
    pub properties: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzerChannelDto {
    pub id: String,
    #[serde(default)]
    pub pin_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakpointRuleDto {
    pub id: String,
    pub enabled: bool,
    pub target_channel_id: String,
    pub condition_type: String,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepResultDto {
    pub tick_count: u64,
    pub pin_states: Vec<u8>,
    pub elapsed_us: u64,
    pub triggered_breakpoint_id: Option<String>,
    pub triggered_tick: u64,
    pub analyzer_ticks: Vec<u32>,
    pub analyzer_samples: Vec<u8>,
    pub selected_memory: Option<Vec<u8>>,
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Ne555Mode {
    #[default]
    Astable,
    Monostable,
    Bistable,
}

impl Ne555Mode {
    pub fn from_str(s: &str) -> Self {
        match s {
            "monostable" => Self::Monostable,
            "bistable" => Self::Bistable,
            _ => Self::Astable,
        }
    }
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeKind {
    // Sources & Basic I/O
    Input,
    SubIn,
    SubIo,
    Vcc,
    PullUp,
    Gnd,
    PullDown,
    Button,
    DipSwitch,
    Clock,

    // Basic Logic Gates
    Buffer,
    Not,
    And,
    Nand,
    Or,
    Nor,
    Xor,
    Xnor,

    // 74LS Logic Gates & Buffers
    Ic74LS00,
    Ic74LS02,
    Ic74LS04,
    Ic74LS08,
    Ic74LS30,
    Ic74LS32,
    Ic74LS86,
    Ic74LS125,
    Ic74LS241,
    Ic74LS244,
    Ic74LS245,
    Ic74LS541,

    // Decoders & ALU
    Ic74LS47,
    Ic74LS138,
    Ic74LS139,
    Ic74LS154,
    Ic74LS238,
    Ic74LS283,
    Ic74LS181,

    // Counters, Registers & Timers
    Ic74LS161,
    Ic74LS191,
    Ic74LS173,
    Ic74LS175,
    Ic74LS273,
    Ic74LS373,
    Ic74LS374,
    Ne555,

    // Memory & PLD
    Rom27C256,
    Sram62256,
    Sram6116,
    Gal22V10,

    // Fallback for non-driving container nodes
    Unknown,
}

impl NodeKind {
    pub fn is_passive_or_visual(node_type: &str) -> bool {
        matches!(
            node_type,
            "JUNCTION"
                | "NET_LABEL"
                | "SUB_OUT"
                | "BUS_BREAKOUT"
                | "KEYPAD"
                | "NC"
                | "REGION_BOX"
                | "TEXT_LABEL"
                | "STICKY_NOTE"
                | "FSM_DIAGRAM"
                | "OUTPUT"
                | "7_SEG_DISPLAY"
                | "LED_BAR"
        )
    }

    pub fn from_type_str(node_type: &str) -> Self {
        match node_type {
            "INPUT" => Self::Input,
            "SUB_IN" => Self::SubIn,
            "SUB_IO" => Self::SubIo,
            "VCC" => Self::Vcc,
            "PULL_UP" => Self::PullUp,
            "GND" => Self::Gnd,
            "PULL_DOWN" => Self::PullDown,
            "BUTTON" => Self::Button,
            "DIP_SWITCH" => Self::DipSwitch,
            "CLOCK" => Self::Clock,
            "BUFFER" => Self::Buffer,
            "NOT" => Self::Not,
            "AND" => Self::And,
            "NAND" => Self::Nand,
            "OR" => Self::Or,
            "NOR" => Self::Nor,
            "XOR" => Self::Xor,
            "XNOR" => Self::Xnor,
            "74LS00" => Self::Ic74LS00,
            "74LS02" => Self::Ic74LS02,
            "74LS04" => Self::Ic74LS04,
            "74LS08" => Self::Ic74LS08,
            "74LS30" => Self::Ic74LS30,
            "74LS32" => Self::Ic74LS32,
            "74LS86" => Self::Ic74LS86,
            "74LS47" => Self::Ic74LS47,
            "74LS138" => Self::Ic74LS138,
            "74LS139" => Self::Ic74LS139,
            "74LS154" => Self::Ic74LS154,
            "74LS238" => Self::Ic74LS238,
            "74LS283" => Self::Ic74LS283,
            "74LS181" => Self::Ic74LS181,
            "74LS161" => Self::Ic74LS161,
            "74LS191" => Self::Ic74LS191,
            "NE555" => Self::Ne555,
            "74LS125" => Self::Ic74LS125,
            "74LS173" => Self::Ic74LS173,
            "74LS175" => Self::Ic74LS175,
            "74LS241" => Self::Ic74LS241,
            "74LS244" => Self::Ic74LS244,
            "74LS245" => Self::Ic74LS245,
            "74LS273" => Self::Ic74LS273,
            "74LS373" => Self::Ic74LS373,
            "74LS374" => Self::Ic74LS374,
            "74LS541" => Self::Ic74LS541,
            "27C256" => Self::Rom27C256,
            "62256" => Self::Sram62256,
            "6116" => Self::Sram6116,
            "GAL22V10" => Self::Gal22V10,
            _ => Self::Unknown,
        }
    }

    #[inline]
    pub fn is_weak_pull(self) -> bool {
        matches!(self, Self::PullUp | Self::PullDown)
    }

    #[inline]
    pub fn is_button(self) -> bool {
        matches!(self, Self::Button)
    }

    #[inline]
    pub fn is_tick_driven(self) -> bool {
        matches!(
            self,
            Self::Clock | Self::Ne555 | Self::Ic74LS191 | Self::Sram6116
        )
    }

    #[inline]
    pub fn uses_prev_inputs(self) -> bool {
        matches!(
            self,
            Self::Ic74LS161
                | Self::Ic74LS191
                | Self::Ic74LS173
                | Self::Ic74LS175
                | Self::Ic74LS273
                | Self::Ic74LS374
                | Self::Sram6116
                | Self::Gal22V10
        )
    }

    #[inline]
    pub fn has_sequential_state(self) -> bool {
        matches!(
            self,
            Self::Ic74LS161
                | Self::Ic74LS191
                | Self::Ic74LS173
                | Self::Ic74LS175
                | Self::Ic74LS273
                | Self::Ic74LS373
                | Self::Ic74LS374
                | Self::Ne555
                | Self::Gal22V10
        )
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct NodeInternalState {
    pub counter: u8,
    pub counter_is_x: bool,
    pub reg8: u8,
    pub latch_q: u8,
    pub mono_remaining: i32,
    pub last_tick: u64,
    pub last_clk: u8,
    pub initialized: bool,
    pub olmc_reg: [u8; 10],
}

#[derive(Debug, Clone)]
pub struct CompiledNet {
    pub all_pin_indices: Vec<usize>,
    pub strong_driver_indices: Vec<usize>,
    pub weak_driver_indices: Vec<usize>,
    pub fanout_node_indices: Vec<usize>,
}

#[derive(Debug, Clone)]
pub struct CompiledNode {
    pub kind: NodeKind,
    pub input_pin_indices: Vec<usize>,
    pub output_pin_indices: Vec<usize>,
    pub vcc_input_idx: isize,
    pub gnd_input_idx: isize,
    pub has_self_feedback: bool,

    // Cached static properties from NodeDto
    pub value: Option<u8>,
    pub is_flattened: bool,
    pub pressed: bool,
    pub active_low: bool,
    pub num_outputs_prop: usize,
    pub switches: Vec<u8>,
    pub clock_manual: bool,
    pub manual_value: u8,
    pub high_ticks: u64,
    pub low_ticks: u64,
    pub pulse_ticks: i32,
    pub start_high: bool,
    pub ne555_mode: Ne555Mode,
    pub rom_data: Vec<u8>,
    pub compiled_jedec: Option<Box<CompiledJedec>>,

    // Runtime sequential state
    pub state: NodeInternalState,
    pub next_state: NodeInternalState,
    pub sram: Vec<u8>,
    pub prev_inputs: Vec<u8>,
    pub last_inputs: Vec<u8>,
}
