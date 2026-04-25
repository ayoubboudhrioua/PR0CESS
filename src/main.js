import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene.js';
import { TitleScene } from './game/scenes/TitleScene.js';
import { GameScene } from './game/scenes/GameScene.js';
import { DeathScene } from './game/scenes/DeathScene.js';
import { HUD } from './game/hud.js';

const config = {
  type: Phaser.AUTO,
  width: 1200,
  height: 700,
  backgroundColor: '#000000',
  parent: 'game-container',
  pixelArt: true,
  antialias: false,
  scene: [BootScene, TitleScene, GameScene, DeathScene],
};

// Show boot screen on startup
HUD.showBootScreen();

// Destroy any stale Phaser instance from a previous HMR cycle
if (window.__PROCESS_GAME__) {
  console.log('[HMR] Destroying previous Phaser instance...');
  window.__PROCESS_GAME__.destroy(true);
  window.__PROCESS_GAME__ = null;
}

console.log('[MAIN] Creating new Phaser.Game instance');
const game = new Phaser.Game(config);
window.__PROCESS_GAME__ = game;
console.log('[MAIN] Game created successfully');

// Tell Vite to destroy the game before hot-replacing this module
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[HMR] Dispose callback: destroying game');
    game.destroy(true);
    window.__PROCESS_GAME__ = null;
  });
}

export default game;