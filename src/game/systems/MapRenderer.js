// MapRenderer.js
// Layer 0: staticGfx  — walls, drawn ONCE on create, never touched again
// Layer 1: dynamicGfx — floor/corrupt/ghost tiles, redrawn ONLY when markDirty() is called
// Layer 2: coreGfx    — single core tile only, redrawn every 150ms for glow animation
//
// ROOT CAUSE FIX: Previously, the core glow timer set dirty=true which triggered
// a full redraw of all 792 tiles at 6x/sec. Now the core has its own isolated
// Graphics object. The 150ms timer redraws exactly 1 tile (6 draw calls).
// The dynamic layer only redraws when GameScene calls renderer.markDirty()
// after a tile actually changes.

import { TILE, TILE_SIZE } from './MapGenerator.js';
import { State } from '../state.js';

export class MapRenderer {
  constructor(scene, mapGen) {
    this.scene  = scene;
    this.mapGen = mapGen;

    this.staticGfx = scene.add.graphics();
    this.staticGfx.setDepth(0);

    this.dynamicGfx = scene.add.graphics();
    this.dynamicGfx.setDepth(1);

    // Core tile ONLY — isolated so its 150ms animation never dirty-flags all tiles
    this.coreGfx = scene.add.graphics();
    this.coreGfx.setDepth(2);

    if (!scene.textures.exists('pixel')) {
      const pg = scene.add.graphics();
      pg.fillStyle(0xffffff);
      pg.fillRect(0, 0, 2, 2);
      pg.generateTexture('pixel', 2, 2);
      pg.destroy();
    }

    this._coreGlowPhase = 0;
    this._corePos       = mapGen.getCorePosition();
    this._animTimer     = 0;
    this._animInterval  = 150;
    this._dynamicDirty  = true;

    this._drawStaticLayer();
    this._drawDynamicLayer();
    this._drawCoreGlow();
  }

  markDirty() {
    this._dynamicDirty = true;
  }

  _drawStaticLayer() {
    const g  = this.staticGfx;
    const ts = TILE_SIZE;
    const { cols, rows, grid } = this.mapGen;

    g.clear();
    g.fillStyle(0x030305, 1);
    g.fillRect(0, 0, cols * ts, rows * ts);

    g.fillStyle(0x0c0c16, 1);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === TILE.WALL) {
          g.fillRect(x * ts, y * ts, ts, ts);
        }
      }
    }

    g.lineStyle(0.5, 0x141420, 0.4);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === TILE.WALL) {
          g.strokeRect(x * ts + 0.5, y * ts + 0.5, ts - 1, ts - 1);
        }
      }
    }
  }

  _drawDynamicLayer() {
    const g  = this.dynamicGfx;
    const ts = TILE_SIZE;
    const { cols, rows, grid } = this.mapGen;

    g.clear();

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const t  = grid[y][x];
        const px = x * ts;
        const py = y * ts;

        if (t === TILE.WALL || t === TILE.EMPTY || t === TILE.CORE) continue;

        if (t === TILE.STABLE) {
          g.fillStyle(0x1a1a2e, 1);
          g.fillRect(px, py, ts, ts);
          g.lineStyle(0.5, 0x2a2a4a, 0.7);
          g.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);

        } else if (t === TILE.UNSTABLE) {
          g.fillStyle(0x2a1a1a, 1);
          g.fillRect(px, py, ts, ts);
          g.fillStyle(0x4a1010, 0.28);
          g.fillRect(px + 1, py + 1, ts - 2, ts - 2);
          g.lineStyle(0.5, 0x4a2a1a, 0.7);
          g.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);

        } else if (t === TILE.CORRUPT) {
          g.fillStyle(0x150a25, 1);
          g.fillRect(px, py, ts, ts);
          g.fillStyle(0x7a20aa, 0.22);
          g.fillRect(px + 2, py + 2, ts - 4, ts - 4);
          g.lineStyle(0.5, 0x5a1a7a, 0.8);
          g.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);

        } else if (t === TILE.GHOST) {
          g.fillStyle(0x0d0d20, 1);
          g.fillRect(px, py, ts, ts);
          g.fillStyle(0x3030a0, 0.15);
          g.fillRect(px + 3, py + 3, ts - 6, ts - 6);
          g.lineStyle(0.5, 0x1a1a3a, 0.5);
          g.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);

        } else if (t === TILE.LOCKED) {
          g.fillStyle(0x100810, 1);
          g.fillRect(px, py, ts, ts);
          g.lineStyle(0.5, 0x2a1040, 0.5);
          g.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
        }
      }
    }

    this._dynamicDirty = false;
  }

  _drawCoreGlow() {
    const g     = this.coreGfx;
    const ts    = TILE_SIZE;
    const cx    = this._corePos.x;
    const cy    = this._corePos.y;
    const px    = cx * ts;
    const py    = cy * ts;
    const pulse = Math.sin(this._coreGlowPhase) * 0.35 + 0.65;

    g.clear();
    g.fillStyle(0x0a2a1a, 1);
    g.fillRect(px, py, ts, ts);
    g.fillStyle(0x10aa60, pulse * 0.28);
    g.fillRect(px + 1, py + 1, ts - 2, ts - 2);
    g.lineStyle(1, 0x20ff80, pulse * 0.9);
    g.strokeRect(px + 4, py + 4, ts - 8, ts - 8);
    g.lineStyle(0.5, 0x10aa60, 0.9);
    g.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
  }

  render(delta) {
    if (this._dynamicDirty) {
      this._drawDynamicLayer();
    }

    this._animTimer += delta;
    if (this._animTimer >= this._animInterval) {
      this._animTimer      = 0;
      this._coreGlowPhase += 0.12;
      this._drawCoreGlow();
    }

    // Phase 3: Tile breathing animation — gentle sine wave on opacity
    if (State.phase >= 3) {
      const breathe = Math.sin(Date.now() / 800) * 0.03 + 0.97;
      this.dynamicGfx.setAlpha(breathe);
    }
  }

  spawnDeathParticles(px, py) {
    const emitter = this.scene.add.particles(px, py, 'pixel', {
      speed:    { min: 40, max: 120 },
      angle:    { min: 0,  max: 360 },
      lifespan: 600,
      alpha:    { start: 1, end: 0 },
      scale:    { start: 2, end: 0.5 },
      tint:     [0xd060d0, 0xff40ff, 0x6030a0, 0xff8080],
      quantity: 20,
    });
    emitter.setDepth(20);
    emitter.explode(20, px, py);
    this.scene.time.delayedCall(700, () => {
      if (emitter && emitter.active) emitter.destroy();
    });
  }

  spawnCorruptParticles(px, py) {
    // Create particle emitter DIRECTLY at the world position (px, py)
    const emitter = this.scene.add.particles(px, py, 'pixel', {
      speed:    { min: 10, max: 40 },
      angle:    { min: 0,  max: 360 },
      lifespan: 300,
      alpha:    { start: 0.8, end: 0 },
      tint:     [0x7a20aa, 0xd060d0],
      quantity: 5,
    });
    
    emitter.setDepth(5);
    
    // Emit particles once from the emitter location
    emitter.explode(5);
    
    // Clean up after particles finish
    this.scene.time.delayedCall(400, () => {
      if (emitter && emitter.active) emitter.destroy();
    });
  }

  destroy() {
    if (this.staticGfx)  this.staticGfx.destroy();
    if (this.dynamicGfx) this.dynamicGfx.destroy();
    if (this.coreGfx)    this.coreGfx.destroy();
  }
}