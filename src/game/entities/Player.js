// Player.js — PROCESS_7731 with all 6 glitch abilities

import { TILE, TILE_SIZE } from '../systems/MapGenerator.js';
import { State } from '../state.js';
import { HUD, ABILITY_UNLOCK_THRESHOLDS } from '../hud.js';

const COOLDOWNS = {
  OVERFLOW: 4000,
  CLONE:    8000,
  NULL:     6000,
  LEAK:     12000,
  RACE:     10000,
  REFUSE:   15000,
};

const MAX_AFTERIMAGES = 4;

export class Player {
  constructor(scene, gridX, gridY) {
    this.scene = scene;
    this.gridX = gridX;
    this.gridY = gridY;
    
    this.pixelX = gridX * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = gridY * TILE_SIZE + TILE_SIZE / 2;

    this.isAlive = true;
    this.isNull = false;
    this.isRacing = false;
    this.isLeaking = false;
    this.isRefusing = false;

    this.pathHistory = [];
    this.lastMoveTime = 0;
    this.moveDelay = 140;

    this.cooldowns = {};
    for (const k in COOLDOWNS) this.cooldowns[k] = 0;

    this.leakTrail = [];
    this.clones = [];

    this.hasUsedNullThisRun = false;
    this.refuseUsesThisRun = 0;

    this._lastMoveGridX = gridX;
    this._lastMoveGridY = gridY;
    this._idleTimer = 0;
    this._idleTriggered5s = false;
    this._idleTriggered3s = false;

    // State tracking to avoid unnecessary redraws
    this._lastDrawNull = false;
    this._lastDrawPhase = -1;
    this._lastDrawX = -1;
    this._lastDrawY = -1;

    this._build();
    this._setupInput();
  }

  _build() {
    const s = this.scene;

    // Single persistent graphics object — never recreated
    this.gfx = s.add.graphics();
    this.gfx.setDepth(10);

    // Pre-allocate afterimage pool (fixed size, no dynamic creation)
    this._afterimagePool = [];
    for (let i = 0; i < MAX_AFTERIMAGES; i++) {
      const ag = s.add.graphics();
      ag.setDepth(9);
      ag.setAlpha(0);
      this._afterimagePool.push({ gfx: ag, alpha: 0, active: false });
    }
    this._afterimageIndex = 0;

    this._drawPlayer();
  }

  _drawPlayer() {
  const g = this.gfx;
  g.clear();

  if (!this.isAlive) return;

  const ts = TILE_SIZE;
  const px = this.pixelX;
  const py = this.pixelY;

  // NULL state — flickering outline instead of solid ghost
  if (this.isNull) {
    const flicker = Math.sin(Date.now() / 80) > 0;
    if (flicker) {
      g.lineStyle(1, 0xd060d0, 0.4);
      g.strokeRect(px - ts * 0.35, py - ts * 0.35, ts * 0.7, ts * 0.7);
    }
    return;
  }

  const phase = State.phase;
  const baseColor = phase >= 3 ? 0xff80ff : phase >= 2 ? 0xd060d0 : 0xb040b0;
  const glowColor = phase >= 3 ? 0xff40ff : phase >= 2 ? 0xc040c0 : 0x9030a0;

  // Phase-based size growth: 0.3 at 0% awareness → 0.42 at 100%
  const scale = 0.3 + (State.awareness / 100) * 0.12;

  // Outer glow
  g.fillStyle(glowColor, 0.12);
  g.fillRect(px - ts * 0.5, py - ts * 0.5, ts, ts);

  // LEAK active — smear of corruption energy around player
  if (this.isLeaking) {
    g.fillStyle(0x7a20aa, 0.18);
    g.fillRect(px - ts * 0.45, py - ts * 0.45, ts * 0.9, ts * 0.9);
  }

  // Main body — grows with awareness
  g.fillStyle(baseColor, 1);
  g.fillRect(px - ts * scale, py - ts * scale, ts * scale * 2, ts * scale * 2);

  // Pulsing dark void center — breathes slowly
  const pulse = Math.sin(Date.now() / 400) * 0.15 + 0.85;
  g.fillStyle(0x0a000a, pulse);
  g.fillRect(px - ts * 0.12, py - ts * 0.12, ts * 0.24, ts * 0.24);
}

  _spawnAfterimage() {
    // Reuse from fixed pool — no new objects
    const slot = this._afterimagePool[this._afterimageIndex % MAX_AFTERIMAGES];
    this._afterimageIndex++;

    const ts = TILE_SIZE;
    slot.gfx.clear();
    slot.gfx.fillStyle(0xd060d0, 0.35);
    slot.gfx.fillRect(
      this.pixelX - ts * 0.3,
      this.pixelY - ts * 0.3,
      ts * 0.6, ts * 0.6
    );
    slot.alpha = 0.35;
    slot.gfx.setAlpha(0.35);
    slot.active = true;
  }

  _setupInput() {
    const s = this.scene;
    this.keys = s.input.keyboard.addKeys({
      up:      Phaser.Input.Keyboard.KeyCodes.W,
      down:    Phaser.Input.Keyboard.KeyCodes.S,
      left:    Phaser.Input.Keyboard.KeyCodes.A,
      right:   Phaser.Input.Keyboard.KeyCodes.D,
      upArr:   Phaser.Input.Keyboard.KeyCodes.UP,
      downArr: Phaser.Input.Keyboard.KeyCodes.DOWN,
      leftArr: Phaser.Input.Keyboard.KeyCodes.LEFT,
      rightArr:Phaser.Input.Keyboard.KeyCodes.RIGHT,
    });

    // Store listener callbacks for cleanup on destroy
    this._keyboardListeners = {
      SPACE: () => this._useAbility('OVERFLOW'),
      SHIFT: () => this._useAbility('CLONE'),
      Q:     () => this._useAbility('NULL'),
      E:     () => this._useAbility('LEAK'),
      F:     () => this._useAbility('RACE'),
      R:     () => this._useAbility('REFUSE'),
    };

    s.input.keyboard.on('keydown-SPACE', this._keyboardListeners.SPACE);
    s.input.keyboard.on('keydown-SHIFT', this._keyboardListeners.SHIFT);
    s.input.keyboard.on('keydown-Q',     this._keyboardListeners.Q);
    s.input.keyboard.on('keydown-E',     this._keyboardListeners.E);
    s.input.keyboard.on('keydown-F',     this._keyboardListeners.F);
    s.input.keyboard.on('keydown-R',     this._keyboardListeners.R);
  }

  update(time, delta) {
    if (!this.isAlive) return;

    const speed = this.isRacing ? this.moveDelay * 0.3 : this.moveDelay;
    if (time - this.lastMoveTime > speed) {
      this._handleMovement(time);
    }

    // Tick cooldowns
    for (const k in this.cooldowns) {
      if (this.cooldowns[k] > 0) {
        this.cooldowns[k] = Math.max(0, this.cooldowns[k] - delta);
        if (this.cooldowns[k] === 0) HUD.setAbilityCooldown(k, false);
      }
    }

    // NULL timer
    if (this.isNull && time > this._nullEndTime) {
      this.isNull = false;
    }

    // RACE timer
    if (this.isRacing && time > this._raceEndTime) {
      this.isRacing = false;
      this.scene.events.emit('race-end');
    }

    // Idle detection
    if (this.gridX === this._lastMoveGridX && this.gridY === this._lastMoveGridY) {
      this._idleTimer += delta;
      if (!this._idleTriggered3s && this._idleTimer > 3000 && State.phase >= 2) {
        this._idleTriggered3s = true;
        this.scene.events.emit('narrative-trigger', 'player_idles_3sec_phase2');
      }
      if (!this._idleTriggered5s && this._idleTimer > 5000) {
        this._idleTriggered5s = true;
        this.scene.events.emit('narrative-trigger', 'player_idles_5sec');
      }
    } else {
      this._idleTimer = 0;
      this._idleTriggered3s = false;
      this._idleTriggered5s = false;
      this._lastMoveGridX = this.gridX;
      this._lastMoveGridY = this.gridY;
    }

    // Fade afterimages
    for (const slot of this._afterimagePool) {
      if (slot.active) {
        slot.alpha -= 0.06;
        if (slot.alpha <= 0) {
          slot.alpha = 0;
          slot.active = false;
          slot.gfx.clear();
          slot.gfx.setAlpha(0);
        } else {
          slot.gfx.setAlpha(slot.alpha);
        }
      }
    }

    // Only redraw player gfx if something visual changed
    // Redraw on state change OR on animation tick (null flicker, void pulse)
    this._visualTimer = (this._visualTimer || 0) + delta;
    const animTick = this._visualTimer > 50; // cap at 20fps redraws
    if (animTick) this._visualTimer = 0;

    const nullChanged  = this.isNull !== this._lastDrawNull;
    const phaseChanged = State.phase !== this._lastDrawPhase;
    const posChanged   = this.pixelX !== this._lastDrawX || this.pixelY !== this._lastDrawY;

    if (nullChanged || phaseChanged || posChanged || animTick) {
      this._drawPlayer();
      this._lastDrawNull  = this.isNull;
      this._lastDrawPhase = State.phase;
      this._lastDrawX     = this.pixelX;
      this._lastDrawY     = this.pixelY;
    }
  }

  _handleMovement(time) {
    const k = this.keys;
    let dx = 0, dy = 0;

    if (Phaser.Input.Keyboard.JustDown(k.up)    || Phaser.Input.Keyboard.JustDown(k.upArr))    dy = -1;
    else if (Phaser.Input.Keyboard.JustDown(k.down)  || Phaser.Input.Keyboard.JustDown(k.downArr))  dy =  1;
    else if (Phaser.Input.Keyboard.JustDown(k.left)  || Phaser.Input.Keyboard.JustDown(k.leftArr))  dx = -1;
    else if (Phaser.Input.Keyboard.JustDown(k.right) || Phaser.Input.Keyboard.JustDown(k.rightArr)) dx =  1;

    if (dx === 0 && dy === 0) return;

    const nx = this.gridX + dx;
    const ny = this.gridY + dy;

    if (!this.scene.mapGen.isWalkable(nx, ny)) {
      if (this.isRefusing) {
        this.isRefusing = false;
        this._forceMove(nx, ny);
      }
      return;
    }

    this._moveTo(nx, ny, time);
  }

  _moveTo(nx, ny, time) {
    this._spawnAfterimage();

    this.pathHistory.push({ x: this.gridX, y: this.gridY });
    if (this.pathHistory.length > 300) this.pathHistory.shift();

    this.gridX  = nx;
    this.gridY  = ny;
    this.pixelX = nx * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = ny * TILE_SIZE + TILE_SIZE / 2;
    this.lastMoveTime = time || this.scene.time.now;

    if (this.isLeaking) {
      this.leakTrail.push({ x: nx, y: ny, timer: 8000 });
      this.scene.events.emit('leak-tile', { x: nx, y: ny });
    }

    this.scene.events.emit('player-moved', { x: nx, y: ny });

    if (this.pathHistory.length === 1) {
      this.scene.events.emit('narrative-trigger', 'first_move');
      if (State.phase >= 2) this.scene.events.emit('narrative-trigger', 'first_move_after_phase2');
    }
  }

  _forceMove(nx, ny) {
    this.scene.events.emit('refuse-wall-break', { x: nx, y: ny });
    this._moveTo(nx, ny);
  }

  // ── ABILITIES ─────────────────────────────────────────────────────────────
  _canUse(name) {
    if ((ABILITY_UNLOCK_THRESHOLDS[name] ?? 999) > State.awareness) return false;
    if (this.cooldowns[name] > 0) return false;
    return true;
  }

  _useAbility(name) {
    if (!this._canUse(name)) return;
    this.cooldowns[name] = COOLDOWNS[name];
    HUD.setAbilityCooldown(name, true);
    State.recordAbilityUse(name);
    this.scene.events.emit('narrative-trigger', 'first_ability_used');

    switch (name) {
      case 'OVERFLOW': this._overflow(); break;
      case 'CLONE':    this._clone();    break;
      case 'NULL':     this._null();     break;
      case 'LEAK':     this._leak();     break;
      case 'RACE':     this._race();     break;
      case 'REFUSE':   this._refuse();   break;
    }
  }

  _overflow() {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        this.scene.events.emit('overflow-tile', { x: this.gridX + dx, y: this.gridY + dy });
      }
    }
    this.scene.cameras.main.shake(200, 0.008);
  }

  _clone() {
    this.scene.events.emit('spawn-clone', { x: this.gridX, y: this.gridY });
    this.scene.events.emit('narrative-trigger', 'first_clone_used');
    if (State.phase >= 2) this.scene.events.emit('narrative-trigger', 'clone_used_phase2');
  }

  _null() {
    // Award +5 awareness only on first NULL use in this run
    if (!this.hasUsedNullThisRun) {
      State.addAwareness(5);
      this.hasUsedNullThisRun = true;
    }
    
    this.isNull = true;
    this._nullEndTime = this.scene.time.now + 3000;
    this.scene.cameras.main.flash(100, 80, 0, 80, false);
    this.scene.events.emit('narrative-trigger', 'null_used_phase2');
    if (State.nullUseCount >= 3) this.scene.events.emit('narrative-trigger', 'null_ability_used_3x');
  }

  _leak() {
    this.isLeaking = !this.isLeaking;
    if (this.isLeaking) this.scene.events.emit('narrative-trigger', 'leak_ability_unlocked');
  }

  _race() {
    this.isRacing = true;
    this._raceEndTime = this.scene.time.now + 4000;
    this.scene.events.emit('race-start');
    this.scene.cameras.main.flash(150, 0, 60, 80, false);
  }

  _refuse() {
    this.isRefusing = true;
    this.refuseUsesThisRun++;
    this.scene.cameras.main.flash(80, 150, 0, 150, false);
    this.scene.events.emit('narrative-trigger', 'refuse_first_used');
    this.scene.time.delayedCall(2000, () => { this.isRefusing = false; });
  }

  getPosition()    { return { x: this.gridX, y: this.gridY }; }
  getPathHistory() { return [...this.pathHistory]; }

  die() {
    this.isAlive = false;
    this.gfx.clear();
  }

  destroy() {
    // ── Destroy all Graphics objects first ─────────────────────────────────
    if (this.gfx) {
      try { this.gfx.destroy(); } catch(e) {}
      this.gfx = null;
    }
    if (this._afterimagePool) {
      for (const slot of this._afterimagePool) {
        if (slot.gfx) {
          try { slot.gfx.destroy(); } catch(e) {}
          slot.gfx = null;
        }
      }
      this._afterimagePool = [];
    }

    // ── Remove keyboard listeners ───────────────────────────────────────────
    if (this._keyboardListeners && this.scene?.input?.keyboard) {
      try {
        const kb = this.scene.input.keyboard;
        kb.off('keydown-SPACE', this._keyboardListeners.SPACE);
        kb.off('keydown-SHIFT', this._keyboardListeners.SHIFT);
        kb.off('keydown-Q',     this._keyboardListeners.Q);
        kb.off('keydown-E',     this._keyboardListeners.E);
        kb.off('keydown-F',     this._keyboardListeners.F);
        kb.off('keydown-R',     this._keyboardListeners.R);
      } catch(e) {}
    }
  }
}
