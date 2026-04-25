// state.js — Single source of truth for persistent game state
//
// FIXES APPLIED:
// 1. firedLogs + firedThoughts use Set — O(1) lookup vs O(n) Array.includes()
//    The old Array.includes() was called hundreds of times/sec through update() → OOM
// 2. save() is debounced to max 1 localStorage write per 2 seconds
//    Old code called JSON.stringify + setItem on every narrative check → 16MB string heap
// 3. saveNow() forces immediate write for critical moments only

const SAVE_KEY = 'process_7731_state';

const DEFAULT_STATE = {
  awareness:            0,
  totalRuns:            0,
  totalDeaths:          0,
  lastRunAbilityUsage:  {},
  refuseUseCount:       0,
  nullUseCount:         0,
  stackOverflowCount:   0,
  firedLogs:            [],
  firedThoughts:        [],
  hasEverDied:          false,
  phase:                1,
  lastRunPath:          [],
  unlockedAbilities:    [],
  overseerDeployed:     false,
  overseerDefeated:     false,
  endingPath:           null,
};

class StateManager {
  constructor() {
    this.data              = this._load();
    this._firedLogsSet     = new Set(this.data.firedLogs);
    this._firedThoughtsSet = new Set(this.data.firedThoughts);
    this._savePending      = false;
  }

  _load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch(e) {}
    return { ...DEFAULT_STATE };
  }

  // Debounced write — max once per 2 seconds, safe to call frequently
  save() {
    if (this._savePending) return;
    this._savePending = true;
    setTimeout(() => {
      try {
        this.data.firedLogs     = Array.from(this._firedLogsSet);
        this.data.firedThoughts = Array.from(this._firedThoughtsSet);
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
      } catch(e) {}
      this._savePending = false;
    }, 2000);
  }

  // Immediate write — only for: death, run end, phase change, game exit
  saveNow() {
    this._savePending = false;
    try {
      this.data.firedLogs     = Array.from(this._firedLogsSet);
      this.data.firedThoughts = Array.from(this._firedThoughtsSet);
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch(e) {}
  }

  reset() {
    this.data              = { ...DEFAULT_STATE };
    this._firedLogsSet     = new Set();
    this._firedThoughtsSet = new Set();
    this._savePending      = false;
    localStorage.removeItem(SAVE_KEY);
  }

  // ── Awareness ─────────────────────────────────────────────────────────────
  get awareness() { return this.data.awareness; }

  addAwareness(amount) {
    const prev     = this.data.awareness;
    this.data.awareness = Math.min(100, prev + amount);
    const newPhase     = this.data.awareness >= 67 ? 3 : this.data.awareness >= 34 ? 2 : 1;
    const phaseChanged = newPhase !== this.data.phase;
    this.data.phase    = newPhase;
    this.saveNow();
    return { newAwareness: this.data.awareness, phaseChanged, newPhase };
  }

  get phase() { return this.data.phase; }

  // ── Runs ──────────────────────────────────────────────────────────────────
  get totalRuns()   { return this.data.totalRuns; }
  get totalDeaths() { return this.data.totalDeaths; }

  startRun() {
    this.data.totalRuns++;
    this.data.lastRunAbilityUsage = {};
    this.saveNow();
  }

  recordDeath() {
    this.data.totalDeaths++;
    this.data.hasEverDied = true;
    this.saveNow();
  }

  // ── Ability usage ─────────────────────────────────────────────────────────
  recordAbilityUse(name) {
    if (!this.data.lastRunAbilityUsage[name]) this.data.lastRunAbilityUsage[name] = 0;
    this.data.lastRunAbilityUsage[name]++;
    if (name === 'REFUSE')   this.data.refuseUseCount++;
    if (name === 'NULL')     this.data.nullUseCount++;
    if (name === 'OVERFLOW') this.data.stackOverflowCount++;
    this.save(); // debounced — ability use is frequent
  }

  get refuseUseCount()      { return this.data.refuseUseCount; }
  get nullUseCount()        { return this.data.nullUseCount; }
  get lastRunAbilityUsage() { return this.data.lastRunAbilityUsage; }

  // ── Narrative — O(1) Set operations ──────────────────────────────────────
  hasLogFired(id)    { return this._firedLogsSet.has(id); }
  markLogFired(id) {
    if (!this._firedLogsSet.has(id)) {
      this._firedLogsSet.add(id);
      this.save();
    }
  }

  hasThoughtFired(id)    { return this._firedThoughtsSet.has(id); }
  markThoughtFired(id) {
    if (!this._firedThoughtsSet.has(id)) {
      this._firedThoughtsSet.add(id);
      this.save();
    }
  }

  // ── Ghost trail ───────────────────────────────────────────────────────────
  get lastRunPath() { return this.data.lastRunPath; }
  saveRunPath(path) { this.data.lastRunPath = path.slice(-200); this.saveNow(); }

  // ── Abilities ─────────────────────────────────────────────────────────────
  get unlockedAbilities() { return this.data.unlockedAbilities; }
  unlockAbility(name) {
    if (!this.data.unlockedAbilities.includes(name)) {
      this.data.unlockedAbilities.push(name);
      this.saveNow();
    }
  }
  hasAbility(name) { return this.data.unlockedAbilities.includes(name); }

  // ── OVERSEER ──────────────────────────────────────────────────────────────
  get overseerDeployed() { return this.data.overseerDeployed; }
  get overseerDefeated() { return this.data.overseerDefeated; }
  deployOverseer() { this.data.overseerDeployed = true; this.saveNow(); }
  defeatOverseer() { this.data.overseerDefeated = true; this.saveNow(); }

  // ── Ending ────────────────────────────────────────────────────────────────
  get endingPath()     { return this.data.endingPath; }
  setEndingPath(p) { this.data.endingPath = p; this.saveNow(); }
}

export const State = new StateManager();