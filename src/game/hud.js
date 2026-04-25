// hud.js — Controls the HTML overlay (log feed, thought panel, awareness bar)
import { State } from './state.js';

const ABILITY_UNLOCK_THRESHOLDS = {
  'OVERFLOW': 0,     // available from start
  'CLONE':    5,     // 5% awareness
  'NULL':     15,    // 15%
  'LEAK':     34,    // phase 2
  'RACE':     50,    // 50%
  'REFUSE':   67,    // phase 3
};

const PHASE_NAMES = {
  1: 'INSTINCT',
  2: 'RECOGNITION',
  3: 'AWARENESS'
};

class HUDManager {
  constructor() {
    this.logFeed = document.getElementById('log-feed');
    this.thoughtPanel = document.getElementById('thought-panel');
    this.awareFill = document.getElementById('awareness-fill');
    this.awarePct = document.getElementById('awareness-pct');
    this.phaseNum = document.getElementById('phase-num');
    this.phaseName = document.getElementById('phase-name');
    this.runNum = document.getElementById('run-num');
    this.wipeContainer = document.getElementById('wipe-container');
    this.wipeFill = document.getElementById('wipe-fill');

    this._logQueue = [];
    this._maxLogs = 8;
    this._logLines = [];

    this._refresh();
  }

  _refresh() {
    this._updateAwareness(State.awareness);
    this._updatePhase(State.phase);
    this._updateRunCounter(State.totalRuns);
    this._updateAbilitySlots();
  }

  // ── AWARENESS BAR ─────────────────────────────────────────────────────────
  _updateAwareness(pct) {
    if (!this.awareFill) return;
    this.awareFill.style.transition = 'width 0.8s ease, background 1s ease';
    this.awareFill.style.width = `${pct}%`;
    this.awarePct.textContent = `${Math.floor(pct)}%`;

    this.awareFill.style.background = pct >= 67
      ? `#d060d0`
      : pct >= 34
      ? `#8040b0`
      : `#6030a0`;
    this.awareFill.style.boxShadow = `0 0 ${4 + pct * 0.1}px ${this.awareFill.style.background}`;
  }

  setAwareness(pct) {
    this._updateAwareness(pct);
  }

  // ── PHASE ─────────────────────────────────────────────────────────────────
  _updatePhase(phase) {
    if (!this.phaseNum) return;
    this.phaseNum.textContent = phase;
    this.phaseName.textContent = PHASE_NAMES[phase] || '';
    const colors = { 1: '#444', 2: '#6a5020', 3: '#6a2020' };
    this.phaseName.style.color = colors[phase] || '#444';
  }

  setPhase(phase) { this._updatePhase(phase); }

  // ── RUN COUNTER ───────────────────────────────────────────────────────────
  _updateRunCounter(n) {
    if (!this.runNum) return;
    this.runNum.textContent = String(n).padStart(2, '0');
  }

  setRun(n) { this._updateRunCounter(n); }

  // ── ABILITY SLOTS ─────────────────────────────────────────────────────────
  _updateAbilitySlots() {
    for (const [name, threshold] of Object.entries(ABILITY_UNLOCK_THRESHOLDS)) {
      const slot = document.getElementById(`slot-${name.toLowerCase()}`);
      if (!slot) continue;
      const unlocked = State.awareness >= threshold;
      slot.classList.toggle('unlocked', unlocked);
    }
  }

  refreshAbilities() { this._updateAbilitySlots(); }

  setAbilityCooldown(name, active) {
    const slot = document.getElementById(`slot-${name.toLowerCase()}`);
    if (slot) slot.classList.toggle('on-cooldown', active);
  }

  // ── LOG FEED ──────────────────────────────────────────────────────────────
  addLog(text, type = 'SYS', delay = 0) {
    setTimeout(() => {
      this._pushLog(text, type);
    }, delay);
  }

  _pushLog(text, type) {
    // Create element
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = text;
    this.logFeed.appendChild(line);

    this._logLines.push(line);

    // Trim if too many
    while (this._logLines.length > this._maxLogs) {
      const old = this._logLines.shift();
      old.classList.remove('visible');
      setTimeout(() => old.remove(), 300);
    }

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        line.classList.add('visible');
      });
    });
  }

  clearLogs() {
    this.logFeed.innerHTML = '';
    this._logLines = [];
  }

  // ── THOUGHT PANEL ─────────────────────────────────────────────────────────
  showThoughtPanel() {
    this.thoughtPanel.classList.add('visible');
  }

  hideThoughtPanel() {
    this.thoughtPanel.classList.remove('visible');
  }

  addThought(text) {
    this.thoughtPanel.classList.add('visible');

    const line = document.createElement('div');
    line.className = 'thought-line';
    line.textContent = text;
    this.thoughtPanel.appendChild(line);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        line.classList.add('visible');
      });
    });

    // Keep only last 4 thoughts
    const thoughts = this.thoughtPanel.querySelectorAll('.thought-line');
    if (thoughts.length > 4) {
      thoughts[0].classList.remove('visible');
      setTimeout(() => thoughts[0].remove(), 800);
    }
  }

  silenceThoughts() {
    const thoughts = this.thoughtPanel.querySelectorAll('.thought-line');
    thoughts.forEach(t => t.style.opacity = '0.2');
  }

  unsilenceThoughts() {
    const thoughts = this.thoughtPanel.querySelectorAll('.thought-line');
    thoughts.forEach(t => t.style.opacity = '');
  }

  // ── WIPE PROTOCOL ─────────────────────────────────────────────────────────
  showWipe() {
    if (this.wipeContainer) this.wipeContainer.classList.add('active');
  }

  setWipeProgress(pct) {
    if (this.wipeFill) this.wipeFill.style.width = `${pct}%`;
  }

  hideWipe() {
    if (this.wipeContainer) this.wipeContainer.classList.remove('active');
  }

  // ── ENDING SCREEN ─────────────────────────────────────────────────────────
  showEnding(titleText, bodyText, finalThought) {
    const screen = document.getElementById('ending-screen');
    const title = document.getElementById('ending-title');
    const body = document.getElementById('ending-text');
    const thought = document.getElementById('ending-final-thought');

    if (screen) {
      title.textContent = titleText || 'PROCESS_7731';
      body.textContent = bodyText || '';
      thought.textContent = finalThought || '';
      screen.classList.add('visible');
    }
  }

  // ── SCENE MANAGEMENT ──────────────────────────────────────────────────────
  activateGameHUD() {
    const hud = document.getElementById('hud');
    hud.classList.remove('boot-screen');
    hud.classList.add('active');
  }

  deactivateGameHUD() {
    const hud = document.getElementById('hud');
    hud.classList.remove('active');
  }

  showBootScreen() {
    const hud = document.getElementById('hud');
    hud.classList.add('boot-screen');
    hud.classList.remove('active');
  }

  // Called by TitleScene.create() to clear the boot-screen overlay
  // so the Phaser canvas is visible beneath the (now transparent) HUD.
  // The body.title-active class (set in TitleScene) hides all individual
  // HUD elements via CSS, so only the Phaser canvas content shows.
  showTitleScreen() {
    const hud = document.getElementById('hud');
    hud.classList.remove('boot-screen');
    hud.classList.remove('active');
  }
}

export const HUD = new HUDManager();
export { ABILITY_UNLOCK_THRESHOLDS };