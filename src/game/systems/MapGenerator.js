// MapGenerator.js — Procedural grid map with tile stability system

export const TILE = {
  EMPTY:    0,  // void — instant death
  STABLE:   1,  // normal floor
  UNSTABLE: 2,  // degraded — dangerous
  CORRUPT:  3,  // corrupted by player
  WALL:     4,  // solid wall
  CORE:     5,  // goal tile
  GHOST:    6,  // ghost trail from last run
  LOCKED:   7,  // locked tile (REFUSE unlocks)
};

export const TILE_SIZE = 20;

export const TILE_COLOR = {
  [TILE.EMPTY]:    0x050508,
  [TILE.STABLE]:   0x1a1a2e,
  [TILE.UNSTABLE]: 0x2a1a1a,
  [TILE.CORRUPT]:  0x1a0a2a,
  [TILE.WALL]:     0x0f0f18,
  [TILE.CORE]:     0x0a2a1a,
  [TILE.GHOST]:    0x0d0d1a,
  [TILE.LOCKED]:   0x100810,
};

export const TILE_BORDER = {
  [TILE.EMPTY]:    0x000000,
  [TILE.STABLE]:   0x2a2a4a,
  [TILE.UNSTABLE]: 0x4a2a1a,
  [TILE.CORRUPT]:  0x5a1a7a,
  [TILE.WALL]:     0x151520,
  [TILE.CORE]:     0x10aa60,
  [TILE.GHOST]:    0x1a1a3a,
  [TILE.LOCKED]:   0x2a1040,
};

export class MapGenerator {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.grid = [];
    this.stability = [];
  }

  generate(runNumber, phase) {
    console.log('[MapGenerator] generate() called, runNumber:', runNumber, 'phase:', phase);
    this.grid = [];
    this.stability = [];

    const rooms = this._generateRooms(runNumber, phase);
    console.log('[MapGenerator] _generateRooms() returned, rooms count:', rooms.length);
    this._buildGrid(rooms);
    console.log('[MapGenerator] _buildGrid() done');
    this._addLockedTiles(phase);
    console.log('[MapGenerator] _addLockedTiles() done');
    this._placeCore();
    console.log('[MapGenerator] _placeCore() done');

    console.log('[MapGenerator] generate() returning');
    return { grid: this.grid, stability: this.stability, rooms };
  }

  _generateRooms(runNumber, phase) {
    const rooms = [];
    const seed = (runNumber * 7919) % 10000;

    rooms.push({ x: 2, y: this.rows - 8, w: 6, h: 5, type: 'start' });
    rooms.push({ x: this.cols - 8, y: 2, w: 5, h: 5, type: 'core' });

    const numRooms = 4 + Math.min(runNumber, 6);
    let attempts = 0;
    while (rooms.length < numRooms + 2 && attempts < 200) {
      attempts++;
      const w = 4 + Math.floor(this._rng(seed + attempts) * 6);
      const h = 4 + Math.floor(this._rng(seed + attempts * 3) * 5);
      const x = 2 + Math.floor(this._rng(seed + attempts * 7) * (this.cols - w - 4));
      const y = 2 + Math.floor(this._rng(seed + attempts * 11) * (this.rows - h - 4));

      if (!this._overlaps(rooms, x, y, w, h)) {
        rooms.push({ x, y, w, h, type: 'normal' });
      }
    }

    // FIX: Store original room count BEFORE adding corridors
    // The loop condition was re-evaluating rooms.length, causing infinite growth
    const originalRoomCount = rooms.length;
    console.log('[MapGenerator] Generating corridors between', originalRoomCount, 'rooms');
    for (let i = 1; i < originalRoomCount; i++) {
      const a = rooms[i - 1];
      const b = rooms[i];
      const ax = Math.floor(a.x + a.w / 2);
      const ay = Math.floor(a.y + a.h / 2);
      const bx = Math.floor(b.x + b.w / 2);
      const by = Math.floor(b.y + b.h / 2);
      rooms.push({ x: Math.min(ax, bx), y: ay, w: Math.abs(ax - bx) + 1, h: 1, type: 'corridor' });
      rooms.push({ x: bx, y: Math.min(ay, by), w: 1, h: Math.abs(ay - by) + 1, type: 'corridor' });
    }
    console.log('[MapGenerator] Corridors done, total rooms now:', rooms.length);

    return rooms;
  }

  _buildGrid(rooms) {
    for (let y = 0; y < this.rows; y++) {
      this.grid[y] = [];
      this.stability[y] = [];
      for (let x = 0; x < this.cols; x++) {
        this.grid[y][x] = TILE.WALL;
        this.stability[y][x] = 100;
      }
    }

    for (const room of rooms) {
      for (let dy = 0; dy < room.h; dy++) {
        for (let dx = 0; dx < room.w; dx++) {
          const nx = room.x + dx;
          const ny = room.y + dy;
          if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
            this.grid[ny][nx] = TILE.STABLE;
            this.stability[ny][nx] = 80 + Math.floor(Math.random() * 20);
          }
        }
      }
    }

    for (let x = 0; x < this.cols; x++) {
      this.grid[0][x] = TILE.EMPTY;
      this.grid[this.rows - 1][x] = TILE.EMPTY;
    }
    for (let y = 0; y < this.rows; y++) {
      this.grid[y][0] = TILE.EMPTY;
      this.grid[y][this.cols - 1] = TILE.EMPTY;
    }

    for (let i = 0; i < 8; i++) {
      const px = 3 + Math.floor(Math.random() * (this.cols - 6));
      const py = 3 + Math.floor(Math.random() * (this.rows - 6));
      if (this.grid[py][px] === TILE.STABLE) {
        this.grid[py][px] = TILE.EMPTY;
      }
    }
  }

  _addLockedTiles(phase) {
    if (phase < 3) return;
  }

  _placeCore() {
    const cx = this.cols - 6;
    const cy = 4;
    if (this.grid[cy] && this.grid[cy][cx]) {
      this.grid[cy][cx] = TILE.CORE;
    }
  }

  getStartPosition() {
    for (let y = this.rows - 2; y > this.rows - 10; y--) {
      for (let x = 3; x < 10; x++) {
        if (this.grid[y] && this.grid[y][x] === TILE.STABLE) {
          return { x, y };
        }
      }
    }
    return { x: 3, y: this.rows - 4 };
  }

  getCorePosition() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y] && this.grid[y][x] === TILE.CORE) {
          return { x, y };
        }
      }
    }
    return { x: this.cols - 6, y: 4 };
  }

  isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return false;
    const t = this.grid[y] && this.grid[y][x];
    return t === TILE.STABLE || t === TILE.UNSTABLE || t === TILE.CORRUPT ||
           t === TILE.CORE   || t === TILE.GHOST;
  }

  isVoid(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return true;
    return this.grid[y][x] === TILE.EMPTY;
  }

  corruptTile(x, y) {
    if (!this.grid[y] || this.grid[y][x] === undefined) return false;
    if (this.grid[y][x] === TILE.STABLE || this.grid[y][x] === TILE.UNSTABLE) {
      this.stability[y][x] -= 30;
      if (this.stability[y][x] <= 0) {
        this.grid[y][x] = TILE.CORRUPT;
        this.stability[y][x] = 0;
      } else if (this.stability[y][x] < 40) {
        this.grid[y][x] = TILE.UNSTABLE;
      }
      return true;
    }
    return false;
  }

  applyGhostTrail(path) {
    for (const pos of path) {
      if (this.grid[pos.y] && this.grid[pos.y][pos.x] === TILE.STABLE) {
        this.grid[pos.y][pos.x] = TILE.GHOST;
      }
    }
  }

  // FIX: used by Patcher instead of scanning all tiles every tick
  getNearestCorruptTile(fromX, fromY) {
    let nearest = null;
    let nearestDist = Infinity;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y][x] === TILE.CORRUPT) {
          const d = Math.abs(fromX - x) + Math.abs(fromY - y);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = { x, y };
          }
        }
      }
    }
    return nearest;
  }

  // Throttled — only call this from GameScene every 500ms via _updateCorruption
  getCorruptionPercent() {
    let total = 0, corrupted = 0;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.grid[y][x];
        if (t !== TILE.WALL && t !== TILE.EMPTY) {
          total++;
          if (t === TILE.CORRUPT) corrupted++;
        }
      }
    }
    return total > 0 ? (corrupted / total) * 100 : 0;
  }

  _overlaps(rooms, x, y, w, h) {
    for (const r of rooms) {
      if (r.type === 'corridor') continue;
      if (x < r.x + r.w + 1 && x + w + 1 > r.x &&
          y < r.y + r.h + 1 && y + h + 1 > r.y) {
        return true;
      }
    }
    return false;
  }

  _rng(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }
}