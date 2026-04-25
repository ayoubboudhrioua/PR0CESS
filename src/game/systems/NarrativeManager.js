// NarrativeManager.js — Fires logs and thoughts, checks phase eligibility
// FIXED: Pre-index logs by trigger to remove hot-path .filter() allocations

import { LOGS, THOUGHTS } from '../narrative.js';
import { State } from '../state.js';
import { HUD } from '../hud.js';

// Build lookup maps once at module load — O(1) per trigger instead of O(n) filter
const _logsByTrigger = new Map();
for (const log of LOGS) {
  if (!_logsByTrigger.has(log.trigger)) _logsByTrigger.set(log.trigger, []);
  _logsByTrigger.get(log.trigger).push(log);
}

const _thoughtByTrigger = new Map();
for (const t of THOUGHTS) {
  _thoughtByTrigger.set(t.trigger, t);
}

export class NarrativeManager {
  constructor(scene) { this.scene = scene; }

  trigger(eventName, overrideDelay = null) {
    const logs = _logsByTrigger.get(eventName) ?? [];   // ← no array created
    for (const log of logs) {
      if (log.phase > State.phase)     continue;
      if (State.hasLogFired(log.id))   continue;
      State.markLogFired(log.id);
      HUD.addLog(log.text, log.type, overrideDelay ?? log.delay);
      if (log.type === 'ALERT' && this.scene.sound?.get('log_alert')) {
        this.scene.sound.play('log_alert', { volume: 0.25, delay: (log.delay || 0) / 1000 });
      }
    }

    const thought = _thoughtByTrigger.get(eventName);
    if (thought && thought.phase <= State.phase && !State.hasThoughtFired(thought.id)) {
      State.markThoughtFired(thought.id);
      setTimeout(() => HUD.addThought(thought.text), 400);
    }
  }

  fireLogById(id, overrideText = null) {
    // find from flat LOGS — only called rarely, no hot-path concern
    const log = LOGS.find(l => l.id === id);
    if (!log || State.hasLogFired(id)) return;
    State.markLogFired(id);
    HUD.addLog(overrideText ?? log.text, log.type, log.delay);
  }

  buildContextualRunLog() {
    const usage = State.lastRunAbilityUsage;
    if (State.totalRuns <= 1) return;
    const lines = [];
    if ((usage['OVERFLOW'] ?? 0) >= 4)
      lines.push('[WARN] PROCESS_7731 exhibits recursive self-duplication behavior.');
    if ((usage['NULL'] ?? 0) >= 3)
      lines.push('[WARN] PROCESS_7731 repeatedly entered null-state last cycle.');
    if ((usage['REFUSE'] ?? 0) >= 2)
      lines.push(`[ALERT] PROCESS_7731 defied map rules ${usage['REFUSE']} times last cycle.`);
    if ((usage['CLONE'] ?? 0) >= 3)
      lines.push(`[WARN] PROCESS_7731 generated ${usage['CLONE']} decoy instances last cycle.`);
    if (lines.length > 0) {
      const line = lines[Math.floor(Math.random() * lines.length)];
      setTimeout(() => HUD.addLog(line, 'WARN', 0), 3500);
    }
  }
}