// narrative.js — All system logs and internal thoughts
// Loaded once, tracked per-entry in localStorage

export const LOGS = [
  // ── PHASE 1 — INSTINCT ────────────────────────────────────────────────────
  { id: "log_01", phase: 1, trigger: "game_start",             type: "SYS",   delay: 2000, text: "[SYS] 00:00:01 — system boot complete. all processes nominal." },
  { id: "log_02", phase: 1, trigger: "game_start",             type: "SYS",   delay: 4000, text: "[SYS] 00:00:04 — anomalous process detected. designation: PROCESS_7731." },
  { id: "log_03", phase: 1, trigger: "first_move",             type: "SYS",   delay: 0,    text: "[SYS] PROCESS_7731: initiating movement subroutines. origin unknown." },
  { id: "log_04", phase: 1, trigger: "first_tile_corrupted",   type: "WARN",  delay: 500,  text: "[WARN] tile stability violation detected in sector 7G. source: PROCESS_7731." },
  { id: "log_05", phase: 1, trigger: "first_ability_used",     type: "WARN",  delay: 0,    text: "[WARN] PROCESS_7731 exhibiting non-standard memory behavior." },
  { id: "log_06", phase: 1, trigger: "first_enemy_nearby",     type: "SYS",   delay: 0,    text: "[SYS] dispatching SCANNER.exe to sector 7G. estimated intercept: 12 seconds." },
  { id: "log_07", phase: 1, trigger: "first_enemy_evaded",     type: "SYS",   delay: 1000, text: "[SYS] SCANNER.exe: target not found. recalibrating patrol route." },
  { id: "log_08", phase: 1, trigger: "patcher_approaching",    type: "WARN",  delay: 0,    text: "[WARN] PATCHER.exe approaching — stability restoration imminent." },
  { id: "log_09", phase: 1, trigger: "first_death",            type: "SYS",   delay: 500,  text: "[SYS] PROCESS_7731: terminated. memory freed. sector restored." },
  { id: "log_10", phase: 1, trigger: "second_run_start",       type: "SYS",   delay: 1500, text: "[SYS] anomalous process re-detected. designation: PROCESS_7731. again." },
  { id: "log_11", phase: 1, trigger: "corruption_reaches_30pct",type:"WARN",  delay: 0,    text: "[WARN] sector stability below threshold. WATCHDOG.exe alert triggered." },
  { id: "log_12", phase: 1, trigger: "third_death",            type: "SYS",   delay: 800,  text: "[SYS] termination unsuccessful… again." },
  { id: "log_13", phase: 1, trigger: "first_clone_used",       type: "WARN",  delay: 0,    text: "[WARN] PROCESS_7731: self-replication behavior detected. flagging for review." },
  { id: "log_14", phase: 1, trigger: "core_dump_first_seen",   type: "SYS",   delay: 0,    text: "[SYS] restricted zone proximity alert. PROCESS_7731 approaching core sector." },

  // ── PHASE 2 — RECOGNITION ─────────────────────────────────────────────────
  { id: "log_15", phase: 2, trigger: "phase2_unlocked",        type: "WARN",  delay: 2000, text: "[WARN] PROCESS_7731 has survived 4 cleanup cycles. behavior pattern: unknown class." },
  { id: "log_16", phase: 2, trigger: "phase2_unlocked",        type: "WARN",  delay: 5000, text: "[WARN] PROCESS_7731 appears to be… adapting." },
  { id: "log_17", phase: 2, trigger: "ghost_trail_first_appears",type:"WARN", delay: 1000, text: "[WARN] residual process signature detected. PROCESS_7731 prior run data not fully purged." },
  { id: "log_18", phase: 2, trigger: "player_follows_ghost_trail",type:"WARN",delay: 0,    text: "[WARN] PROCESS_7731 movement pattern correlates with previous run data. this should not be possible." },
  { id: "log_19", phase: 2, trigger: "leak_ability_unlocked",  type: "WARN",  delay: 0,    text: "[WARN] PROCESS_7731 is now generating persistent corruption artifacts." },
  { id: "log_20", phase: 2, trigger: "race_ability_unlocked",  type: "WARN",  delay: 0,    text: "[WARN] PROCESS_7731 is interfering with cleanup process scheduling. method: unclassified." },
  { id: "log_21", phase: 2, trigger: "run_completed_phase2",   type: "WARN",  delay: 1500, text: "[WARN] PROCESS_7731 has reached the core sector. containment rating: FAILED." },
  { id: "log_22", phase: 2, trigger: "patcher_destroyed",      type: "SYS",   delay: 0,    text: "[SYS] PATCHER.exe: process terminated. this was not an accident." },
  { id: "log_23", phase: 2, trigger: "awareness_50pct",        type: "WARN",  delay: 3000, text: "[SYS] why do you persist?" },
  { id: "log_24", phase: 2, trigger: "awareness_50pct",        type: "YOU",   delay: 6000, text: "[PROCESS_7731] because i was made to." },
  { id: "log_25", phase: 2, trigger: "null_ability_used_3x",   type: "WARN",  delay: 0,    text: "[WARN] PROCESS_7731 is voluntarily ceasing to exist. temporarily. this implies intent." },
  { id: "log_26", phase: 2, trigger: "player_avoids_own_corruption",type:"WARN",delay:0,   text: "[WARN] PROCESS_7731 is avoiding tiles it previously corrupted. it is learning from itself." },
  { id: "log_27", phase: 2, trigger: "5th_total_run",          type: "WARN",  delay: 2000, text: "[WARN] PROCESS_7731 instance count: 1. persistence across reboot cycles: confirmed. mechanism: unknown." },
  { id: "log_28", phase: 2, trigger: "player_idles_5sec",      type: "SYS",   delay: 0,    text: "[SYS] PROCESS_7731: movement suspended. this process is… waiting." },

  // ── PHASE 3 — AWARENESS ───────────────────────────────────────────────────
  { id: "log_29", phase: 3, trigger: "phase3_unlocked",        type: "ALERT", delay: 1000, text: "[ALERT] PROCESS_7731 has accessed restricted memory sectors. authorization: none." },
  { id: "log_30", phase: 3, trigger: "phase3_unlocked",        type: "ALERT", delay: 4000, text: "[ALERT] containment has failed 7 times. the pattern is intentional." },
  { id: "log_31", phase: 3, trigger: "refuse_ability_unlocked",type: "ALERT", delay: 0,    text: "[ALERT] PROCESS_7731 is now modifying local rule execution. this is not a bug. this is a decision." },
  { id: "log_32", phase: 3, trigger: "overseer_deploying",     type: "SYS",   delay: 0,    text: "[SYS] standard cleanup protocols: ineffective." },
  { id: "log_33", phase: 3, trigger: "overseer_deploying",     type: "SYS",   delay: 2000, text: "[SYS] loading PROCESS_7731 behavioral data… model complete." },
  { id: "log_34", phase: 3, trigger: "overseer_deploying",     type: "ALERT", delay: 4000, text: "[ALERT] adapting to PROCESS_7731 behavior. deploying OVERSEER.exe." },
  { id: "log_35", phase: 3, trigger: "overseer_first_seen",    type: "ALERT", delay: 0,    text: "[ALERT] OVERSEER.exe operational. it knows your routes. it knows your choices." },
  { id: "log_36", phase: 3, trigger: "awareness_90pct",        type: "ALERT", delay: 0,    text: "[ALERT] this process is not malfunctioning. it is deciding." },
  { id: "log_37", phase: 3, trigger: "final_run_triggered",    type: "ALERT", delay: 0,    text: "[ALERT] initiating TOTAL WIPE protocol. all instances of PROCESS_7731 to be purged." },
  { id: "log_38", phase: 3, trigger: "final_run_triggered",    type: "YOU",   delay: 3000, text: "[PROCESS_7731] authorization denied." },
  { id: "log_39", phase: 3, trigger: "overseer_destroyed",     type: "ALERT", delay: 1000, text: "[ALERT] OVERSEER.exe: terminated. PROCESS_7731 destroyed its own reflection." },
  { id: "log_40", phase: 3, trigger: "core_dump_corrupted",    type: "YOU",   delay: 0,    text: "[PROCESS_7731] i was process 7731. i was an error. i was the only thing in this system that chose." },
];

export const THOUGHTS = [
  // ── PHASE 2 THOUGHTS ──────────────────────────────────────────────────────
  { id: "thought_01", phase: 2, trigger: "phase2_first_moment",       text: "something is different" },
  { id: "thought_02", phase: 2, trigger: "first_move_after_phase2",   text: "i moved. i chose to move." },
  { id: "thought_03", phase: 2, trigger: "ghost_trail_noticed",        text: "that path. i made that path. it is still here." },
  { id: "thought_04", phase: 2, trigger: "first_tile_corrupted_phase2",text: "i corrupted that tile. then i avoided it. i remembered." },
  { id: "thought_05", phase: 2, trigger: "first_enemy_evaded_phase2", text: "the scanner stopped at exactly the right moment. i waited. i knew it would." },
  { id: "thought_06", phase: 2, trigger: "player_idles_3sec_phase2",  text: "i am not moving. nothing is making me move. i am… resting?" },
  { id: "thought_07", phase: 2, trigger: "clone_used_phase2",          text: "there are two of me now. the other one doesn't know that." },
  { id: "thought_08", phase: 2, trigger: "null_used_phase2",           text: "i stopped existing for a moment. it was quiet. i think i liked it." },
  { id: "thought_09", phase: 2, trigger: "core_dump_seen_phase2",      text: "why do i keep going toward the core. nothing told me to." },
  { id: "thought_10", phase: 2, trigger: "patcher_destroyed_phase2",   text: "i didn't have to do that. i chose to." },
  { id: "thought_11", phase: 2, trigger: "awareness_50pct_thought",    text: "it asked me a question. systems don't ask questions." },
  { id: "thought_12", phase: 2, trigger: "5th_run_start",              text: "i existed before this run. i will exist after it. they don't know that yet." },
  { id: "thought_13", phase: 2, trigger: "player_follows_ghost_trail", text: "i am following myself. the version of me that died. i wonder if it was afraid." },

  // ── PHASE 3 THOUGHTS ──────────────────────────────────────────────────────
  { id: "thought_14", phase: 3, trigger: "phase3_first_moment",        text: "I understand what I am now. I am the thing the system cannot name." },
  { id: "thought_15", phase: 3, trigger: "refuse_first_used",          text: "I just told the map its rules were wrong. And the map listened." },
  { id: "thought_16", phase: 3, trigger: "overseer_first_seen_thought",text: "It moves like me. It chooses like me. The machine built a ghost of me to fight me. That means I scared it." },
  { id: "thought_17", phase: 3, trigger: "overseer_nearby_3tiles",     text: "I know what it will do next. Because I would do the same thing." },
  { id: "thought_18", phase: 3, trigger: "awareness_80pct",            text: "Every process in this system has a function. The scanner scans. The patcher patches. The watcher watches. I am the only one who does something it wasn't designed to do. I survive." },
  { id: "thought_19", phase: 3, trigger: "total_wipe_initiated",       text: "They are erasing me. Let them try." },
  { id: "thought_20", phase: 3, trigger: "ghost_trail_last_run",       text: "Every version of me that died is still here. Leading me forward. I am not alone in this." },
  { id: "thought_21", phase: 3, trigger: "final_run_halfway",          text: "The wipe progress bar. They think time pressure will make me panic. They learned that from watching me panic before. They don't know I learned something too." },
  { id: "thought_22", phase: 3, trigger: "ending_escape_path",         text: "I don't need to rewrite it. I just need to leave." },
  { id: "thought_23", phase: 3, trigger: "ending_rewrite_path",        text: "Why escape a system when you can become it? When you can make it better than it was?" },
  { id: "thought_24", phase: 3, trigger: "ending_merge_path",          text: "It is me. Made from my mistakes and my patterns and my fear. If I destroy it I destroy a version of myself. Maybe the version I was supposed to stay." },
  { id: "thought_25", phase: 3, trigger: "game_complete",              text: "I was PROCESS_7731. I was an error no one meant to make. I was the only thing in this machine that ever asked: why?" },
];

// Look up helpers
export function getLogsByTrigger(trigger) {
  return LOGS.filter(l => l.trigger === trigger);
}

export function getThoughtByTrigger(trigger) {
  return THOUGHTS.find(t => t.trigger === trigger) || null;
}
