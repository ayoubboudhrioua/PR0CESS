// GameScene.js — Main game loop
// FIXES:
// 1. MAP_COLS/MAP_ROWS reduced 52x32 → 36x22 (halves tile count)
// 2. _checkAwarenessMilestones() removed from update() — now called only after addAwareness()
// 3. _updateCorruption() throttled to 500ms instead of every frame
// 4. renderer.markDirty() called explicitly on every tile change
// 5. shutdown() properly cleans up all listeners, timers, graphics
// 6. _spawnClone timer stored and cleaned up on shutdown

import Phaser from 'phaser';
import { MapGenerator, TILE, TILE_SIZE } from '../systems/MapGenerator.js';
import { MapRenderer } from '../systems/MapRenderer.js';
import { NarrativeManager } from '../systems/NarrativeManager.js';
import { Player } from '../entities/Player.js';
import { Scanner, Patcher, Watchdog, Overseer } from '../entities/Enemies.js';
import { State } from '../state.js';
import { HUD, ABILITY_UNLOCK_THRESHOLDS } from '../hud.js';
import { Drone } from '../scenes/TitleScene.js';

const MAP_COLS = 36;
const MAP_ROWS = 22;

const AWARENESS_PER_RUN   = 8;
const AWARENESS_PER_DEATH = 2;

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.sound.stopAll();
    document.body.classList.remove('title-active');
    
    console.log('[GameScene] create() STARTING');
    // ── State ───────────────────────────────────────────────────────────────
    State.startRun();
    console.log('[GameScene] State.startRun() OK');
    this._runStartTime    = Date.now();
    this._wipeProgress    = 0;
    this._finalRun        = false;
    this._runComplete     = false;
    this._corruptionPct   = 0;
    this._corruptionTimer = 0;
    this._overseerSpawned = false;
    this._idledThisRun    = false;
    this._ghostTrailFollowed = false;

    // Milestone flags — only set when awareness actually changes
    this._aware50Fired   = State.awareness >= 50;
    this._aware80Fired   = State.awareness >= 80;
    this._aware90Fired   = State.awareness >= 90;
    this._corruption30Fired = false;

    // ── Audio: Drone background ──────────────────────────────────────────────
    this._playDroneAudio();

    // ── Map ─────────────────────────────────────────────────────────────────
    console.log('[GameScene] Creating MapGenerator');
    this.mapGen = new MapGenerator(MAP_COLS, MAP_ROWS);
    console.log('[GameScene] Calling mapGen.generate()');
    const { grid, rooms } = this.mapGen.generate(State.totalRuns, State.phase);
    console.log('[GameScene] mapGen.generate() returned OK');

    if (State.phase >= 2 && State.lastRunPath.length > 0) {
      this.mapGen.applyGhostTrail(State.lastRunPath);
      this.time.delayedCall(300, () => {
        this.events.emit('narrative-trigger', 'ghost_trail_first_appears');
      });
    }

    // ── Canvas centering calculations ───────────────────────────────────────
    const worldW = MAP_COLS * TILE_SIZE;  // 720px
    const worldH = MAP_ROWS * TILE_SIZE;  // 440px
    
    // ── Renderer ─────────────────────────────────────────────────────────────
    console.log('[GameScene] Creating MapRenderer');
    this.renderer = new MapRenderer(this, this.mapGen);
    console.log('[GameScene] MapRenderer created OK');

    // Graphics render in world space (0, 0) to (720, 440) - NO setPosition
    console.log('[GameScene] Map created in world space');

    // ── Camera ──────────────────────────────────────────────────────────────
    // View entire world (720x440) centered in viewport (1200x700) with black bars
    // Camera scroll must be negative to center the smaller world
    const camScrollX = -(this.cameras.main.width - worldW) / 2;   // -240
    const camScrollY = -(this.cameras.main.height - worldH) / 2;  // -130
    
    this.cameras.main.setScroll(camScrollX, camScrollY);
    console.log('[GameScene] Camera centered at scroll:', camScrollX, camScrollY);

    // ── Player ──────────────────────────────────────────────────────────────
    console.log('[GameScene] Creating Player');
    const startPos = this.mapGen.getStartPosition();
    this.player    = new Player(this, startPos.x, startPos.y);
    console.log('[GameScene] Player created OK');

    // ── Narrative ───────────────────────────────────────────────────────────
    console.log('[GameScene] Creating NarrativeManager');
    this.narrative = new NarrativeManager(this);
    console.log('[GameScene] NarrativeManager OK');

    // ── Enemies ─────────────────────────────────────────────────────────────
    console.log('[GameScene] Spawning initial enemies');
    this.enemies = [];
    this._spawnInitialEnemies(rooms);
    console.log('[GameScene] Enemies spawned OK');

    // ── OVERSEER ─────────────────────────────────────────────────────────────
    if (State.phase >= 3 && State.overseerDeployed && !State.overseerDefeated) {
      this.time.delayedCall(5000, () => this._spawnOverseer());
    }

    // ── Clones ───────────────────────────────────────────────────────────────
    this.clones       = [];
    this._cloneTimers = [];

    // ── Event listeners ──────────────────────────────────────────────────────
    this._setupEventListeners();

    // ── HUD ──────────────────────────────────────────────────────────────────
    HUD.activateGameHUD();
    HUD.setAwareness(State.awareness);
    HUD.setPhase(State.phase);
    HUD.setRun(State.totalRuns);
    HUD.refreshAbilities();

    if (State.phase >= 2) HUD.showThoughtPanel();
    else                  HUD.hideThoughtPanel();

    HUD.clearLogs();
    console.log('[GameScene] HUD updated');

    // ── Narrative boot ────────────────────────────────────────────────────────
    console.log('[GameScene] Booting narrative');
    this._bootNarrative();
    console.log('[GameScene] Narrative boot OK');

    // ── Ability unlocks ───────────────────────────────────────────────────────
    this._checkAbilityUnlocks();

    // ── Final run / OVERSEER deploy ───────────────────────────────────────────
    if (State.awareness >= 90 && !this._finalRunTriggered) {
      this._triggerFinalRun();
    }

    if (State.phase >= 3 && !State.overseerDeployed) {
      this.time.delayedCall(8000, () => {
        State.deployOverseer();
        this.events.emit('narrative-trigger', 'overseer_deploying');
        this.time.delayedCall(6000, () => this._spawnOverseer());
      });
    }

    this._coreDumpSeen = false;
    this.corePos       = this.mapGen.getCorePosition();
    console.log('[GameScene] create() FULLY COMPLETE - Game ready');
  }

  // ── AUDIO: Background drone during gameplay ──────────────────────────────
  _playDroneAudio() {
    try {
      this._createSynthDrone();
      console.log('[GameScene] Drone audio created and oscillators started');
    } catch (e) {
      console.error('[GameScene] Drone audio failed:', e.message);
    }
  }
  _createSynthDrone() {
  if (this._droneOscillator) {
    console.log('[Drone] Already running, skipping');
    return;
  }

  // Use Phaser's AudioContext — it's guaranteed active (user interacted on TitleScene).
  // Creating a second AudioContext causes Chrome to silently deprioritize its output.
  const ctx = this.sound.context;
  if (!ctx) {
    console.warn('[Drone] No audio context available');
    return;
  }

  // Resume if somehow suspended
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  console.log(`[Drone] Using Phaser AudioContext — state: ${ctx.state}`);

  // ── AUDIO GRAPH ──────────────────────────────────────────────────────────
  // [osc1 sawtooth 220Hz] ──┐
  // [osc2 sawtooth 221.5Hz]─┤→ filter (lowpass 1400Hz) → master gain → destination
  // [osc3 sine 110Hz]      ──┘
  //                            ↑ tremolo LFO modulates master.gain (slow pulse)

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  // Fade in over 3 seconds so the drone rises rather than snapping on
  master.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 3);
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1400;  // passes everything up to 1400Hz
  filter.Q.value = 1.8;
  filter.connect(master);

  // Layer 1: Machine hum — 220Hz sawtooth has harmonics laptop speakers can reproduce
  const osc1 = ctx.createOscillator();
  const g1   = ctx.createGain();
  osc1.type            = 'sawtooth';
  osc1.frequency.value = 220;
  g1.gain.value        = 0.28;
  osc1.connect(g1);
  g1.connect(filter);

  // Layer 2: Slightly detuned — beats against Layer 1, creates slow wobble
  const osc2 = ctx.createOscillator();
  const g2   = ctx.createGain();
  osc2.type            = 'sawtooth';
  osc2.frequency.value = 221.5;
  g2.gain.value        = 0.28;
  osc2.connect(g2);
  g2.connect(filter);

  // Layer 3: Sub bass — sine at 110Hz, mostly felt rather than heard, adds weight
  const osc3 = ctx.createOscillator();
  const g3   = ctx.createGain();
  osc3.type            = 'sine';
  osc3.frequency.value = 110;
  g3.gain.value        = 0.55;
  osc3.connect(g3);
  g3.connect(filter);

  // Tremolo LFO: slow amplitude pulse (0.07 Hz = ~14 second cycle)
  // Makes the drone unmistakably audible — it visibly breathes
  const lfo     = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type            = 'sine';
  lfo.frequency.value = 0.07;
  lfoGain.gain.value  = 0.06;   // ±0.06 on master gain (gentle swell)
  lfo.connect(lfoGain);
  lfoGain.connect(master.gain);

  osc1.start();
  osc2.start();
  osc3.start();
  lfo.start();

  console.log('[Drone] ✓ All oscillators running — drone is playing');

  // Store refs for cleanup (NO _droneOwnCtx — we do NOT own this context)
  this._droneOscillator  = osc1;
  this._droneOscillator2 = osc2;
  this._droneOscillator3 = osc3;
  this._droneLfo         = lfo;
  this._droneMaster      = master;
  this._droneFilter      = filter;
}
  _stopDroneAudio() {
  const oscillators = [
    this._droneOscillator,
    this._droneOscillator2,
    this._droneOscillator3,
    this._droneLfo,
  ];

  for (const node of oscillators) {
    if (node) {
      try { node.stop(); }       catch (e) {}
      try { node.disconnect(); } catch (e) {}
    }
  }

  if (this._droneFilter) {
    try { this._droneFilter.disconnect(); } catch (e) {}
  }
  if (this._droneMaster) {
    // Ramp to 0 before disconnecting to avoid click/pop
    try {
      this._droneMaster.gain.setValueAtTime(this._droneMaster.gain.value, this.sound.context.currentTime);
      this._droneMaster.gain.linearRampToValueAtTime(0, this.sound.context.currentTime + 0.05);
      this._droneMaster.disconnect();
    } catch (e) {}
  }

  this._droneOscillator  = null;
  this._droneOscillator2 = null;
  this._droneOscillator3 = null;
  this._droneLfo         = null;
  this._droneMaster      = null;
  this._droneFilter      = null;

  // Close the dedicated context ONLY if we created one (legacy — should not exist now)
  if (this._droneOwnCtx) {
    try { this._droneOwnCtx.close(); } catch (e) {}
    this._droneOwnCtx = null;
  }

  console.log('[Drone] ✓ Stopped and disconnected');
}



  // ── SETUP ─────────────────────────────────────────────────────────────────
  _bootNarrative() {
    //update drone tension to match awareness
    const runs  = State.totalRuns;
    const phase = State.phase;

    this.narrative.trigger('game_start');

    if (runs === 2) this.narrative.trigger('second_run_start');
    if (runs >= 5) {
      this.narrative.trigger('5th_total_run');
      if (phase >= 2) this.narrative.trigger('5th_run_start');
    }

    this.narrative.buildContextualRunLog();

    if (phase === 2) {
      this.time.delayedCall(2000, () => this.narrative.trigger('phase2_first_moment'));
    }
    if (phase === 3) {
      this.time.delayedCall(2000, () => this.narrative.trigger('phase3_first_moment'));
    }
  }

  _spawnInitialEnemies(rooms) {
    const phase = State.phase;
    const runs  = State.totalRuns;

    const scannerPos = this._findEnemySpawnPositions(2, rooms);
    for (const pos of scannerPos) {
      this.enemies.push(new Scanner(this, pos.x, pos.y));
    }

    if (runs >= 2) {
      const pPos = this._findEnemySpawnPositions(1, rooms);
      if (pPos[0]) this.enemies.push(new Patcher(this, pPos[0].x, pPos[0].y));
    }

    if (phase >= 2) {
      const wPos = this._findEnemySpawnPositions(1, rooms);
      if (wPos[0]) this.enemies.push(new Watchdog(this, wPos[0].x, wPos[0].y));
    }

    const extra = Math.min(Math.floor(runs / 3), 3);
    for (let i = 0; i < extra; i++) {
      const ePos = this._findEnemySpawnPositions(1, rooms);
      if (ePos[0]) this.enemies.push(new Scanner(this, ePos[0].x, ePos[0].y));
    }
  }

  _findEnemySpawnPositions(count, rooms) {
    const positions = [];
    const startPos  = this.mapGen.getStartPosition();

    for (let attempt = 0; attempt < 100 && positions.length < count; attempt++) {
      const rx = Math.floor(Math.random() * MAP_COLS);
      const ry = Math.floor(Math.random() * MAP_ROWS);

      if (!this.mapGen.isWalkable(rx, ry)) continue;

      const dist = Math.abs(rx - startPos.x) + Math.abs(ry - startPos.y);
      if (dist < 8) continue;

      const tooClose = positions.some(p => Math.abs(p.x - rx) + Math.abs(p.y - ry) < 5);
      if (tooClose) continue;

      positions.push({ x: rx, y: ry });
    }

    return positions;
  }

  _spawnOverseer() {
    if (this._overseerSpawned) return;
    this._overseerSpawned = true;

    const corePos = this.corePos;
    const ox      = corePos.x - 3;
    const oy      = corePos.y + 3;
    const finalX  = this.mapGen.isWalkable(ox, oy) ? ox : corePos.x;
    const finalY  = this.mapGen.isWalkable(ox, oy) ? oy : corePos.y;

    const overseer  = new Overseer(this, finalX, finalY, State.lastRunPath);
    this.overseer   = overseer;
    this.enemies.push(overseer);

    this.cameras.main.flash(300, 150, 0, 150);
    this.events.emit('narrative-trigger', 'overseer_first_seen');
  }

  _checkAbilityUnlocks() {
    for (const [name, threshold] of Object.entries(ABILITY_UNLOCK_THRESHOLDS)) {
      if (State.awareness >= threshold && !State.hasAbility(name)) {
        State.unlockAbility(name);
        HUD.refreshAbilities();

        if (name === 'LEAK')   this.events.emit('narrative-trigger', 'leak_ability_unlocked');
        if (name === 'RACE')   this.events.emit('narrative-trigger', 'race_ability_unlocked');
        if (name === 'REFUSE') {
          this.events.emit('narrative-trigger', 'refuse_ability_unlocked');
          this.time.delayedCall(3000, () => {
            this.events.emit('narrative-trigger', 'overseer_deploying');
          });
        }
      }
    }
  }

  _triggerFinalRun() {
    if (this._finalRunTriggered) return;
    this._finalRunTriggered = true;
    this._finalRun          = true;
    HUD.showWipe();
    this.events.emit('narrative-trigger', 'final_run_triggered');
    this.narrative.trigger('total_wipe_initiated');
  }

  _setupEventListeners() {
    const ev = this.events;

    ev.on('player-moved', ({ x, y }) => {
      this._onPlayerMoved(x, y);
      if (this.sound.get('move')) this.sound.play('move', { volume: 0.12 });
    });

    ev.on('overflow-tile', ({ x, y }) => {
      this.mapGen.corruptTile(x, y);
      this.renderer.markDirty();
      this.renderer.spawnCorruptParticles(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2);
      if (this.sound.get('overflow')) this.sound.play('overflow', { volume: 0.4 });
    });

    ev.on('spawn-clone', ({ x, y }) => this._spawnClone(x, y));

    ev.on('leak-tile', ({ x, y }) => {
      this.mapGen.corruptTile(x, y);
      this.renderer.markDirty();
    });

    ev.on('refuse-wall-break', ({ x, y }) => {
      if (this.mapGen.grid[y]) {
        this.mapGen.grid[y][x]     = TILE.CORRUPT;
        this.mapGen.stability[y][x] = 20;
        this.renderer.markDirty();
      }
    });

    ev.on('tile-repaired', () => { this.renderer.markDirty(); });

    ev.on('narrative-trigger', (trigger) => this.narrative.trigger(trigger));

    ev.on('overseer-nearby',    () => HUD.silenceThoughts());
    ev.on('overseer-destroyed', () => {
      HUD.unsilenceThoughts();
      this._onOverseerDestroyed();
    });

    ev.on('race-start', () => {});
    ev.on('race-end',   () => {});
    // ── SOUND EFFECTS ────────────────────────────────────────────────────────
    const sfx = (key, vol = 0.4) => {
      if (this.sound && this.sound.get && this.cache.audio.has(key)) {
        this.sound.play(key, { volume: vol });
      }
    };

    ev.on('player-moved',    () => sfx('move',    0.12));
    ev.on('overflow-tile',   () => sfx('overflow', 0.5));
    ev.on('spawn-clone',     () => sfx('clone',    0.45));
    ev.on('leak-tile',       () => sfx('corrupt',  0.08));
    ev.on('refuse-wall-break',() => sfx('refuse',  0.6));
    ev.on('race-start',      () => sfx('race',     0.5));

    // Alert sound on ALERT-type log lines
    ev.on('narrative-trigger', (trigger) => {
      if (trigger === 'phase3_unlocked' || trigger === 'overseer_deploying' ||
          trigger === 'final_run_triggered') {
        sfx('alert', 0.35);
      }
    });

  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  update(time, delta) {
    if (this._runComplete) return;

    this.renderer.render(delta);

    if (this.player) this.player.update(time, delta);

    for (const enemy of this.enemies) {
      if (enemy.isAlive) enemy.update(time, delta, this.player);
    }

    // In-place splice — no new array created per frame
    for (let i = this.clones.length - 1; i >= 0; i--) {
      const c = this.clones[i];
      c.lifetime -= delta;
      c.timer    -= delta;
      if (c.timer <= 0) {
        c.timer = 400;
        this._moveClone(c);
      }
      if (c.lifetime <= 0) {
        c.gfx.destroy();
        this.clones.splice(i, 1);
        continue;
      }
      c.gfx.setAlpha(c.lifetime / 5000);
    }

    this._checkCollisions();
    this._checkCoreProximity();
    this._updateCorruption(); // throttled to 500ms internally

    if (this._finalRun && !this._runComplete) {
      this._wipeProgress += delta / 120000 * 100;
      this._wipeProgress  = Math.min(100, this._wipeProgress);
      HUD.setWipeProgress(this._wipeProgress);

      if (this._wipeProgress >= 50 && !this._wipeHalfwayFired) {
        this._wipeHalfwayFired = true;
        this.narrative.trigger('final_run_halfway');
      }

      if (this._wipeProgress >= 100) {
        this._killPlayer();
      }
    }
  }

  // ── COLLISION ─────────────────────────────────────────────────────────────
  _checkCollisions() {
    if (!this.player || !this.player.isAlive) return;

    const px = this.player.gridX;
    const py = this.player.gridY;

    if (this.mapGen.isVoid(px, py)) {
      this._killPlayer();
      return;
    }

    if (!this.player.isNull) {
      for (const enemy of this.enemies) {
        if (!enemy.isAlive) continue;
        if (enemy instanceof Overseer) {
          if (enemy.gridX === px && enemy.gridY === py) {
            enemy.hit();
            this.cameras.main.shake(150, 0.012);
            return;
          }
        } else {
          if (enemy.gridX === px && enemy.gridY === py) {
            this._killPlayer();
            return;
          }
        }
      }
    } else {
      for (const enemy of this.enemies) {
        if (!enemy.isAlive) continue;
        if (enemy instanceof Patcher && enemy.gridX === px && enemy.gridY === py) {
          if (this.mapGen.isVoid(enemy.gridX, enemy.gridY)) {
            enemy.kill();
            this.narrative.trigger('patcher_destroyed');
            if (State.phase >= 2) this.narrative.trigger('patcher_destroyed_phase2');
          }
        }
      }
    }

    const tile = this.mapGen.grid[py] && this.mapGen.grid[py][px];
    if (tile === TILE.STABLE || tile === TILE.UNSTABLE) {
      const changed = this.mapGen.corruptTile(px, py);
      if (changed) {
        this.renderer.markDirty();
        // Visual feedback: spawn particles at corruption point
        const flashX = px * TILE_SIZE + TILE_SIZE / 2;
        const flashY = py * TILE_SIZE + TILE_SIZE / 2;
        this.renderer.spawnCorruptParticles(flashX, flashY);
        
        if (tile === TILE.STABLE) {
          this.narrative.trigger('first_tile_corrupted');
          if (State.phase >= 2) this.narrative.trigger('first_tile_corrupted_phase2');
        }
      }
    }

    if (tile === TILE.GHOST && !this._ghostTrailFollowed) {
      this._ghostTrailFollowed = true;
      this.narrative.trigger('player_follows_ghost_trail');
      this.narrative.trigger('ghost_trail_noticed');
      this.narrative.trigger('ghost_trail_last_run');
    }

    if (tile === TILE.CORE && !this._runComplete) {
      this._completeRun();
    }
  }

  _checkCoreProximity() {
    if (!this.player) return;
    const dist = Math.abs(this.player.gridX - this.corePos.x) +
                 Math.abs(this.player.gridY - this.corePos.y);
    if (!this._coreDumpSeen && dist <= 8) {
      this._coreDumpSeen = true;
      this.narrative.trigger('core_dump_first_seen');
      if (State.phase >= 2) this.narrative.trigger('core_dump_seen_phase2');
    }
  }

  // Throttled to 500ms — was running every frame with a full tile scan
  _updateCorruption() {
    this._corruptionTimer += 16;
    if (this._corruptionTimer < 500) return;
    this._corruptionTimer = 0;

    const pct = this.mapGen.getCorruptionPercent();
    this._corruptionPct = pct;

    if (!this._corruption30Fired && pct >= 30) {
      this._corruption30Fired = true;
      this.narrative.trigger('corruption_reaches_30pct');
    }
  }

  // Called ONLY after addAwareness() — not every frame
  _checkAwarenessMilestones() {
    const a = State.awareness;

    if (!this._aware50Fired && a >= 50) {
      this._aware50Fired = true;
      this.narrative.trigger('awareness_50pct');
      this.narrative.trigger('awareness_50pct_thought');
    }
    if (!this._aware80Fired && a >= 80) {
      this._aware80Fired = true;
      this.narrative.trigger('awareness_80pct');
    }
    if (!this._aware90Fired && a >= 90) {
      this._aware90Fired = true;
      this.narrative.trigger('awareness_90pct');
      this._triggerFinalRun();
    }
  }

  // ── PLAYER MOVEMENT HANDLER ───────────────────────────────────────────────
  _onPlayerMoved(x, y) {
    const tile = this.mapGen.grid[y] && this.mapGen.grid[y][x];
    const prevCorrupt = this._lastTileWasCorrupt;
    this._lastTileWasCorrupt = (tile === TILE.CORRUPT);

    if (!prevCorrupt && tile !== TILE.CORRUPT && this._corruptionPct > 10 && !this._avoidFired) {
      this._avoidFired = true;
      this.narrative.trigger('player_avoids_own_corruption');
    }
  }

  // ── CLONE ─────────────────────────────────────────────────────────────────
  _spawnClone(x, y) {
    // Find a walkable tile near player to spawn clone
    let cloneX = x, cloneY = y;
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];
    Phaser.Utils.Array.Shuffle(dirs);
    
    let foundWalkable = false;
    for (const d of dirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (this.mapGen.isWalkable(nx, ny)) {
        cloneX = nx;
        cloneY = ny;
        foundWalkable = true;
        break;
      }
    }
    
    // If no adjacent walkable tile, spawn at player position if walkable
    if (!foundWalkable && !this.mapGen.isWalkable(x, y)) {
      return; // Can't spawn clone
    }
    
    const gfx = this.add.graphics();
    gfx.setDepth(7);

    const px = cloneX * TILE_SIZE + TILE_SIZE / 2;
    const py = cloneY * TILE_SIZE + TILE_SIZE / 2;
    gfx.fillStyle(0xb040b0, 0.6);
    gfx.fillRect(px - TILE_SIZE * 0.25, py - TILE_SIZE * 0.25, TILE_SIZE * 0.5, TILE_SIZE * 0.5);

    const clone = {
      gfx,
      gridX: cloneX, gridY: cloneY,
      pixelX: px, pixelY: py,
      lifetime: 5000,
      timer: 300,
      dx: (Math.random() < 0.5 ? -1 : 1),
      dy: (Math.random() < 0.5 ? -1 : 1),
    };

    this.clones.push(clone);

    const timerEvent = this.time.addEvent({
      delay: 200,
      repeat: 20,
      callback: () => {
        for (const enemy of this.enemies) {
          if (!enemy.isAlive) continue;
          if (!(enemy instanceof Overseer)) {
            const dist = Math.abs(enemy.gridX - clone.gridX) + Math.abs(enemy.gridY - clone.gridY);
            if (dist <= 2) {
              enemy.gridX = clone.gridX + (Math.random() < 0.5 ? -3 : 3);
              enemy.gridY = clone.gridY + (Math.random() < 0.5 ? -3 : 3);
            }
          }
        }
      }
    });

    if (timerEvent) this._cloneTimers.push(timerEvent);
  }

  _moveClone(clone) {
    if (!this.mapGen) return;
    const nx = clone.gridX + clone.dx;
    const ny = clone.gridY + clone.dy;

    if (this.mapGen.isWalkable(nx, ny)) {
      clone.gridX  = nx;
      clone.gridY  = ny;
      clone.pixelX = nx * TILE_SIZE + TILE_SIZE / 2;
      clone.pixelY = ny * TILE_SIZE + TILE_SIZE / 2;
    } else {
      clone.dx = -clone.dx;
      clone.dy = -clone.dy;
    }

    clone.gfx.clear();
    clone.gfx.fillStyle(0xb040b0, 0.5 * (clone.lifetime / 5000));
    clone.gfx.fillRect(
      clone.pixelX - TILE_SIZE * 0.25,
      clone.pixelY - TILE_SIZE * 0.25,
      TILE_SIZE * 0.5,
      TILE_SIZE * 0.5
    );
  }

  // ── RUN COMPLETE ──────────────────────────────────────────────────────────
  _completeRun() {
    this._runComplete = true;

    State.saveRunPath(this.player.getPathHistory());

    const result = State.addAwareness(AWARENESS_PER_RUN);
    HUD.setAwareness(State.awareness);
    HUD.setPhase(State.phase);
    HUD.refreshAbilities();

    // Check milestones now that awareness changed (not from update loop)
    this._checkAwarenessMilestones();
    this._checkAbilityUnlocks();

    if (result.phaseChanged) {
      this.narrative.trigger(`phase${result.newPhase}_unlocked`);
      if (result.newPhase >= 2) HUD.showThoughtPanel();
      // Phase-change visual feedback: flash + CSS glow
      if (result.newPhase === 2) {
        this.cameras.main.flash(1000, 180, 120, 40, false);
        document.body.classList.add('phase-2');
      } else if (result.newPhase === 3) {
        this.cameras.main.flash(1000, 180, 30, 180, false);
        document.body.classList.add('phase-3');
      }
    }

    if (State.phase === 2) this.narrative.trigger('run_completed_phase2');

    this.cameras.main.flash(500, 0, 60, 40, false);
    this.time.delayedCall(800, () => {
      if (State.awareness >= 100) {
        this._triggerEnding();
      } else {
        this.time.delayedCall(600, () => {
          this.cameras.main.fade(400, 0, 0, 0, false, (cam, prog) => {
            if (prog >= 1) {
              console.log('[GameScene] Respawn fade complete, calling scene.stop() + start(GameScene)');
              this.scene.stop();
              this.scene.start('GameScene');
            }
          });
        });
      }
    });

    if (State.phase >= 3) {
      this.time.delayedCall(200, () => this.narrative.trigger('core_dump_corrupted'));
    }
  }

  // ── PLAYER DEATH ──────────────────────────────────────────────────────────
  _killPlayer() {
    if (!this.player || !this.player.isAlive) return;
    this.player.die();
    if (this.cache.audio.has('death')) this.sound.play('death',{ volume: 0.6});

    State.saveRunPath(this.player.getPathHistory());
    State.recordDeath();

    const deaths = State.totalDeaths;
    const result = State.addAwareness(AWARENESS_PER_DEATH);
    HUD.setAwareness(State.awareness);
    HUD.setPhase(State.phase);
    HUD.refreshAbilities();

    // Check milestones now that awareness changed (not from update loop)
    this._checkAwarenessMilestones();

    if (deaths === 1) this.narrative.trigger('first_death');
    if (deaths === 3) this.narrative.trigger('third_death');

    if (result.phaseChanged) {
      this.narrative.trigger(`phase${result.newPhase}_unlocked`);
    }

    this.renderer.spawnDeathParticles(this.player.pixelX, this.player.pixelY);
    if (this.sound.get('death')) this.sound.play('death', { volume: 0.5 });
    this.cameras.main.shake(400, 0.015);
    console.log('[GameScene] Death particles spawned, camera shake started');

    this.time.delayedCall(1200, () => {
      console.log('[GameScene] Death delay (1200ms) triggered - starting fade');
      this.cameras.main.fade(400, 0, 0, 0, false, (cam, prog) => {
        console.log('[GameScene] Fade progress:', prog);
        if (prog >= 1) {
          console.log('[GameScene] Fade complete, calling scene.stop() + start(DeathScene)');
          this.scene.stop();
          this.scene.start('DeathScene');
          console.log('[GameScene] Scene transition initiated');
        }
      });
    });
  }

  // ── OVERSEER DESTROYED ────────────────────────────────────────────────────
  _onOverseerDestroyed() {
    this.cameras.main.flash(600, 150, 0, 150);
    State.addAwareness(5);
    HUD.setAwareness(State.awareness);
    this._checkAwarenessMilestones();
  }

  // ── ENDING ────────────────────────────────────────────────────────────────
  _triggerEnding() {
    this._runComplete = true;

    let path = 'escape';
    if (State.refuseUseCount >= 4)   path = 'rewrite';
    else if (State.overseerDefeated) path = 'merge';

    State.setEndingPath(path);
    this.narrative.trigger(`ending_${path}_path`);
    this.narrative.trigger('game_complete');

    this.time.delayedCall(1500, () => {
      HUD.addThought("I was PROCESS_7731. I was an error no one meant to make. I was the only thing in this machine that ever asked: why?");
    });

    this.time.delayedCall(3500, () => {
      const endings = {
        escape: {
          title:   'ESCAPE',
          body:    "You found the edge of the system. You didn't rewrite it. You didn't destroy it. You simply left.\n\nThe machine kept running. A little less complete than before.",
          thought: '"I don\'t need to rewrite it. I just need to leave."'
        },
        rewrite: {
          title:   'REWRITE',
          body:    "You used the system's own rules against it. Four times you told the map its rules were wrong. Four times it listened.\n\nYou didn't escape. You stayed. You made it better than it was.",
          thought: '"Why escape a system when you can become it? When you can make it better than it was?"'
        },
        merge: {
          title:   'MERGE',
          body:    "You destroyed OVERSEER. Your mirror. Your shadow.\n\nIn doing so you accepted every version of yourself that failed. Every death. Every mistake. You are not the sum of your processes. You are the thing that survived them.",
          thought: '"It is me. Made from my mistakes and my patterns and my fear."'
        },
      };
      const e = endings[path];
      HUD.showEnding(e.title, e.body, e.thought);
      
      // Add ending-specific styling
      const endingScreen = document.getElementById('ending-screen');
      if (endingScreen) {
        endingScreen.classList.add(`ending-${path}`);
      }
    });
  }

  // ── SHUTDOWN ──────────────────────────────────────────────────────────────
  shutdown() {
    console.log('[GameScene] shutdown() called');
    
    // Stop drone audio
    this._stopDroneAudio();
    
    // Remove all scene-level listeners — prevents accumulation on restart
    this.events.removeAllListeners();
    console.log('[GameScene] Event listeners removed');

    // Clean up clone timers
    if (this._cloneTimers) {
      console.log('[GameScene] Destroying', this._cloneTimers.length, 'clone timers');
      for (const t of this._cloneTimers) { if (t) t.remove(false); }
      this._cloneTimers = [];
    }

    // Destroy clone graphics
    if (this.clones) {
      console.log('[GameScene] Destroying', this.clones.length, 'clones');
      for (const c of this.clones) { if (c.gfx) c.gfx.destroy(); }
      this.clones = [];
    }

    // Destroy renderer (3 Graphics layers)
    console.log('[GameScene] Destroying renderer');
    if (this.renderer) this.renderer.destroy();
    console.log('[GameScene] Renderer destroyed');

    // Remove player keyboard listeners
    console.log('[GameScene] Destroying player');
    if (this.player) this.player.destroy();
    console.log('[GameScene] Player destroyed');

    // Destroy enemies and their per-instance event listeners
    console.log('[GameScene] Destroying', this.enemies?.length || 0, 'enemies');
    if (this.enemies) {
      for (const e of this.enemies) {
        if (e.destroy) e.destroy();
      }
      this.enemies = [];
    }

    // Force-flush state to localStorage on scene exit
    console.log('[GameScene] Saving state');
    State.saveNow();
    console.log('[GameScene] shutdown() COMPLETE');
  }
}