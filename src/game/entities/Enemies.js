// Enemies.js — Scanner, Patcher, Watchdog, OVERSEER
// FIXES:
// 1. Race condition listeners stored as instance methods and removed per-instance on destroy()
//    Old code: events.off('race-start') removed ALL listeners globally
// 2. Patcher uses mapGen.getNearestCorruptTile() instead of scanning all tiles every tick
//    Old nested loop over all 792 tiles every 900ms was a significant CPU + allocation source

import { TILE, TILE_SIZE } from '../systems/MapGenerator.js';
import { State } from '../state.js';

// ── Base Enemy ─────────────────────────────────────────────────────────────
class Enemy {
  constructor(scene, gridX, gridY, color, borderColor) {
    this.scene        = scene;
    this.gridX        = gridX;
    this.gridY        = gridY;
    
    this.pixelX       = gridX * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY       = gridY * TILE_SIZE + TILE_SIZE / 2;
    this.color        = color;
    this.borderColor  = borderColor;
    this.isAlive      = true;
    this.isFrozen     = false;
    this.moveTimer    = 0;
    this.moveInterval = 600;
    this._lastDrawX   = -1;
    this._lastDrawY   = -1;

    this.gfx = scene.add.graphics();
    this.gfx.setDepth(8);
    this._draw();

    // Store bound callbacks so destroy() removes only THIS instance's listeners
    this._onRaceStart = () => { this.isFrozen = true;  };
    this._onRaceEnd   = () => { this.isFrozen = false; };
    scene.events.on('race-start', this._onRaceStart, this);
    scene.events.on('race-end',   this._onRaceEnd,   this);
  }

  _draw() {
  this.gfx.clear();
  if (!this.isAlive) return;

  const ts = TILE_SIZE;
  const px = this.pixelX;
  const py = this.pixelY;

  this.gfx.lineStyle(1, this.borderColor, 0.8);
  this.gfx.strokeRect(px - ts * 0.35, py - ts * 0.35, ts * 0.7, ts * 0.7);
  this.gfx.fillStyle(this.color, 0.9);
  this.gfx.fillRect(px - ts * 0.25, py - ts * 0.25, ts * 0.5, ts * 0.5);

  this._drawFreezeOverlay();
}

// Shared helper — call at end of every _draw() override
_drawFreezeOverlay() {
  if (this.isFrozen) {
    this.gfx.fillStyle(0x4080ff, 0.35);
    this.gfx.fillRect(
      this.pixelX - TILE_SIZE * 0.4,
      this.pixelY - TILE_SIZE * 0.4,
      TILE_SIZE * 0.8, TILE_SIZE * 0.8
    );
  }
}

  distanceTo(x, y) {
    return Math.abs(this.gridX - x) + Math.abs(this.gridY - y);
  }

  _pathfindStep(targetX, targetY) {
    const map = this.scene.mapGen;
    if (!map) return;

    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];
    let bestDx = 0, bestDy = 0, bestDist = Infinity;

    for (const d of dirs) {
      const nx = this.gridX + d.dx;
      const ny = this.gridY + d.dy;
      if (!map.isWalkable(nx, ny)) continue;
      const dist = Math.abs(nx - targetX) + Math.abs(ny - targetY);
      if (dist < bestDist) {
        bestDist = dist;
        bestDx   = d.dx;
        bestDy   = d.dy;
      }
    }

    if (bestDx !== 0 || bestDy !== 0) {
      this.gridX  += bestDx;
      this.gridY  += bestDy;
      this.pixelX  = this.gridX * TILE_SIZE + TILE_SIZE / 2;
      this.pixelY  = this.gridY * TILE_SIZE + TILE_SIZE / 2;
    }
  }

  _randomStep() {
    const map  = this.scene.mapGen;
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];
    Phaser.Utils.Array.Shuffle(dirs);
    for (const d of dirs) {
      const nx = this.gridX + d.dx;
      const ny = this.gridY + d.dy;
      if (map.isWalkable(nx, ny)) {
        this.gridX  = nx;
        this.gridY  = ny;
        this.pixelX = nx * TILE_SIZE + TILE_SIZE / 2;
        this.pixelY = ny * TILE_SIZE + TILE_SIZE / 2;
        return;
      }
    }
  }

  update(time, delta, player) {
    if (!this.isAlive || this.isFrozen) return;

    this.moveTimer += delta;
    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer = 0;
      const prevX = this.gridX;
      const prevY = this.gridY;
      this._updateBehavior(player);
      if (this.gridX !== prevX || this.gridY !== prevY) {
        this._draw();
      }
    }
  }

  _updateBehavior(player) {
    this._randomStep();
  }

  kill() {
  this.isAlive = false;
  this.gfx.clear();
  // Particle burst at death position
  if (this.scene && this.scene.renderer) {
    this.scene.renderer.spawnCorruptParticles(this.pixelX, this.pixelY);
  }
}

  destroy() {
    // Remove only THIS instance's listeners using stored bound callbacks
    if (this.scene && this.scene.events) {
      try {
        this.scene.events.off('race-start', this._onRaceStart, this);
        this.scene.events.off('race-end',   this._onRaceEnd,   this);
      } catch(e) {}
    }
    if (this.gfx) {
      try { this.gfx.destroy(); } catch(e) {}
    }
  }
}

// ── SCANNER.exe ────────────────────────────────────────────────────────────
export class Scanner extends Enemy {
  constructor(scene, gridX, gridY) {
    super(scene, gridX, gridY, 0x205060, 0x30a0b0);
    this.moveInterval   = 500;
    this.detectionRange = 6;
    this._patrolIndex   = 0;
    this._patrolPoints  = [
      { x: gridX,     y: gridY     },
      { x: gridX + 4, y: gridY     },
      { x: gridX + 4, y: gridY + 3 },
      { x: gridX,     y: gridY + 3 },
    ];
    this._firstSeenFired = false;
    this._evadedFired    = false;
  }
  _draw() {
  this.gfx.clear();
  if (!this.isAlive) return;

  const ts = TILE_SIZE;
  const px = this.pixelX;
  const py = this.pixelY;

  // Body
  this.gfx.fillStyle(this.color, 0.9);
  this.gfx.fillRect(px - ts * 0.25, py - ts * 0.25, ts * 0.5, ts * 0.5);
  this.gfx.lineStyle(0.5, this.borderColor, 0.4);
  this.gfx.strokeRect(px - ts * 0.38, py - ts * 0.38, ts * 0.76, ts * 0.76);

  // Directional spike toward target
  if (this._targetX !== undefined) {
    const spikeDx = Math.sign(this._targetX - this.gridX);
    const spikeDy = Math.sign(this._targetY - this.gridY);
    if (spikeDx !== 0 || spikeDy !== 0) {
      this.gfx.fillStyle(0x30a0b0, 1);
      this.gfx.fillTriangle(
        px + spikeDx * ts * 0.45, py + spikeDy * ts * 0.45,
        px + spikeDx * ts * 0.2 + spikeDy * ts * 0.2,
        py + spikeDy * ts * 0.2 - spikeDx * ts * 0.2,
        px + spikeDx * ts * 0.2 - spikeDy * ts * 0.2,
        py + spikeDy * ts * 0.2 + spikeDx * ts * 0.2
      );
    }
  }

  this._drawFreezeOverlay();
}

_updateBehavior(player) {
  if (!player || !player.isAlive) return;

  const dist = this.distanceTo(player.gridX, player.gridY);

  if (!this._firstSeenFired && dist <= this.detectionRange) {
    this._firstSeenFired = true;
    this.scene.events.emit('narrative-trigger', 'first_enemy_nearby');
  }

  if (!player.isNull && dist <= this.detectionRange) {
    // Store target for the directional spike in _draw()
    this._targetX = player.gridX;
    this._targetY = player.gridY;
    this._pathfindStep(player.gridX, player.gridY);
  } else {
    const target = this._patrolPoints[this._patrolIndex % this._patrolPoints.length];
    if (target && this.distanceTo(target.x, target.y) <= 1) {
      this._patrolIndex++;
    } else if (target) {
      this._targetX = target.x;
      this._targetY = target.y;
      this._pathfindStep(target.x, target.y);
    } else {
      this._randomStep();
    }
  }

  if (this._firstSeenFired && !this._evadedFired &&
      (player.isNull || dist > this.detectionRange + 2)) {
    this._evadedFired = true;
    this.scene.events.emit('narrative-trigger', 'first_enemy_evaded');
    if (State.phase >= 2) {
      this.scene.events.emit('narrative-trigger', 'first_enemy_evaded_phase2');
    }
  }
}
}

// ── PATCHER.exe ────────────────────────────────────────────────────────────
export class Patcher extends Enemy {
  constructor(scene, gridX, gridY) {
    super(scene, gridX, gridY, 0x206020, 0x30a040);
    this.moveInterval          = 900;
    this._firstProximityFired  = false;
  }
  _draw(){
    this.gfx.clear();
    if (!this.isAlive) return;

    const ts = TILE_SIZE;
    const px = this.pixelX;
    const py = this.pixelY;

    // Plus / cross shape — restoration symbol
    this.gfx.fillStyle(0x206020, 0.9);
    this.gfx.fillRect(px - ts * 0.35, py - ts * 0.12, ts * 0.7, ts * 0.24); // horizontal bar
    this.gfx.fillRect(px - ts * 0.12, py - ts * 0.35, ts * 0.24, ts * 0.7); // vertical bar

    // Pulse when actively repairing a tile
    if (this._isRepairing) {
      const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
      this.gfx.fillStyle(0x30a040, pulse * 0.4);
      this.gfx.fillRect(px - ts * 0.4, py - ts * 0.4, ts * 0.8, ts * 0.8);
    }
    this._drawFreezeOverlay();
  }

  _updateBehavior(player) {
    const map = this.scene.mapGen;
    if (!map) return;

    // FIX: use pre-built index instead of scanning all tiles every tick
    const nearest = map.getNearestCorruptTile(this.gridX, this.gridY);

    if (nearest) {
      this._pathfindStep(nearest.x, nearest.y);
      if (this.distanceTo(nearest.x, nearest.y) <= 1) {
        this._isRepairing = true;
        map.grid[nearest.y][nearest.x]     = TILE.STABLE;
        map.stability[nearest.y][nearest.x] = 50;
        this.scene.events.emit('tile-repaired', nearest);
      }else{
        this._isRepairing = false;
      }
    } else {
      this._isRepairing = false;
      this._randomStep();
    }

    if (!this._firstProximityFired && player) {
      if (this.distanceTo(player.gridX, player.gridY) <= 4) {
        this._firstProximityFired = true;
        this.scene.events.emit('narrative-trigger', 'patcher_approaching');
      }
    }
  }
}

// ── WATCHDOG.exe ───────────────────────────────────────────────────────────
export class Watchdog extends Enemy {
  constructor(scene, gridX, gridY) {
    super(scene, gridX, gridY, 0x604010, 0xb07020);
    this.moveInterval   = 350;
    this.detectionRange = 10;
  }

  _draw() {
  this.gfx.clear();
  if (!this.isAlive) return;

  const ts = TILE_SIZE;
  const px = this.pixelX;
  const py = this.pixelY;
  const s  = ts * 0.3;

  // Diamond body
  this.gfx.fillStyle(this.color, 0.9);
  this.gfx.fillTriangle(px, py - s, px + s, py, px - s, py);
  this.gfx.fillTriangle(px, py + s, px + s, py, px - s, py);
  this.gfx.lineStyle(1, this.borderColor, 0.6);
  this.gfx.strokeRect(px - s, py - s, s * 2, s * 2);

  // Rotating scan line
  const rot = (Date.now() / 2000) % (Math.PI * 2);
  this.gfx.lineStyle(0.5, this.borderColor, 0.35);
  this.gfx.lineBetween(
    px, py,
    px + Math.cos(rot) * ts * 1.5,
    py + Math.sin(rot) * ts * 1.5
  );
  this.gfx.lineBetween(
    px, py,
    px + Math.cos(rot + Math.PI) * ts * 1.5,
    py + Math.sin(rot + Math.PI) * ts * 1.5
  );

  this._drawFreezeOverlay();
}

update(time, delta, player) {
  if (!this.isAlive || this.isFrozen) return;

  this.moveTimer += delta;
  if (this.moveTimer >= this.moveInterval) {
    this.moveTimer = 0;
    const prevX = this.gridX;
    const prevY = this.gridY;
    this._updateBehavior(player);
    if (this.gridX !== prevX || this.gridY !== prevY) {
      this._draw();
    }
  }

  // Rotation animation redraw — 20fps is smooth enough for the scan line
  this._rotTimer = (this._rotTimer || 0) + delta;
  if (this._rotTimer > 50) {
    this._rotTimer = 0;
    this._draw();
  }
}









  _updateBehavior(player) {
    if (!player || !player.isAlive || player.isNull) {
      this._randomStep();
      return;
    }
    if (this.distanceTo(player.gridX, player.gridY) <= this.detectionRange) {
      this._pathfindStep(player.gridX, player.gridY);
    } else {
      this._randomStep();
    }
  }
}

// ── OVERSEER.exe ───────────────────────────────────────────────────────────
export class Overseer extends Enemy {
  constructor(scene, gridX, gridY, playerPathHistory) {
    super(scene, gridX, gridY, 0xd060d0, 0xff80ff);
    this.moveInterval     = 600;
    this.playerPath       = playerPathHistory || [];
    this._pathIndex       = 0;
    this._mimicMode       = true;
    this._firstSeenFired  = false;
    this._hp              = 3;
    this._pulseTimer      = 0;
  }

  _draw() {
  this.gfx.clear();
  if (!this.isAlive) return;

  const ts = TILE_SIZE;
  const px = this.pixelX;
  const py = this.pixelY;

  // Outer glow — larger than player
  this.gfx.fillStyle(0xff40ff, 0.08);
  this.gfx.fillRect(px - ts * 0.6, py - ts * 0.6, ts * 1.2, ts * 1.2);

  // Main body — same magenta as player but slightly larger
  this.gfx.fillStyle(0xd060d0, 0.85);
  this.gfx.fillRect(px - ts * 0.35, py - ts * 0.35, ts * 0.7, ts * 0.7);

  // Glitch offset — a second copy shifted right on certain frames (double-vision)
  const glitchX = Math.sin(Date.now() / 150) > 0.7 ? 3 : 0;
  this.gfx.fillStyle(0xff80ff, 0.3);
  this.gfx.fillRect(
    px - ts * 0.3 + glitchX,
    py - ts * 0.3,
    ts * 0.6, ts * 0.6
  );

  // Dark void center — larger than player's, more consumed
  this.gfx.fillStyle(0x050005, 1);
  this.gfx.fillRect(px - ts * 0.18, py - ts * 0.18, ts * 0.36, ts * 0.36);

  // Outer frame — thicker than player
  this.gfx.lineStyle(1.5, 0xff80ff, 0.9);
  this.gfx.strokeRect(px - ts * 0.42, py - ts * 0.42, ts * 0.84, ts * 0.84);

  this._drawFreezeOverlay();
}

  update(time, delta, player) {
    if (!this.isAlive || this.isFrozen) return;

    this.moveTimer += delta;
    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer = 0;
      const prevX = this.gridX;
      const prevY = this.gridY;
      this._updateBehavior(player);
      if (this.gridX !== prevX || this.gridY !== prevY) {
        this._draw();
      }
    }

    // Pulse — slow enough to be cheap, only redraws 1 enemy
    this._pulseTimer += delta;
    if (this._pulseTimer > 400) {
      this._pulseTimer = 0;
      this._draw();
    }
  }

  _updateBehavior(player) {
    if (!player) return;

    if (!this._firstSeenFired) {
      this._firstSeenFired = true;
      this.scene.events.emit('narrative-trigger', 'overseer_first_seen');
      this.scene.events.emit('narrative-trigger', 'overseer_first_seen_thought');
    }

    const dist = this.distanceTo(player.gridX, player.gridY);
    if (dist <= 3) {
      this.scene.events.emit('narrative-trigger', 'overseer_nearby_3tiles');
      this.scene.events.emit('overseer-nearby');
    }

    if (this._mimicMode && this._pathIndex < this.playerPath.length) {
      const target = this.playerPath[this._pathIndex];
      if (this.distanceTo(target.x, target.y) <= 1) {
        this._pathIndex++;
      } else {
        this._pathfindStep(target.x, target.y);
      }
      if (this._pathIndex >= this.playerPath.length * 0.5) {
        this._mimicMode = false;
      }
    } else {
      this._pathfindStep(player.gridX, player.gridY);
    }
  }

  hit() {
    this._hp--;
    this.scene.cameras.main.shake(100, 0.01);
    if (this._hp <= 0) {
      this.isAlive = false;
      this.gfx.clear();
      this.scene.events.emit('overseer-destroyed');
      this.scene.events.emit('narrative-trigger', 'overseer_destroyed');
      State.defeatOverseer();
    }
  }
}