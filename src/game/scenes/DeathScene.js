// DeathScene.js
import { State } from '../state.js';
import { HUD } from '../hud.js';

export class DeathScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DeathScene' });
  }

  init(data) {
    this.deathData = data || {};
  }

  create() {
    console.log('[DeathScene] create() called');
    document.body.classList.remove('title-active');
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Dark background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.92);
    bg.fillRect(0, 0, W, H);
    console.log('[DeathScene] Background created');

    // Death message — varies by death count
    const deaths = State.totalDeaths;
    let msg = '[SYS] PROCESS_7731: terminated. memory freed. sector restored.';
    if (deaths === 1) msg = '[SYS] PROCESS_7731: terminated. memory freed. sector restored.';
    else if (deaths === 2) msg = '[WARN] PROCESS_7731: re-terminated. this is the second time.';
    else if (deaths >= 3) msg = '[SYS] termination unsuccessful… again.';

    this.add.text(W / 2, H / 2 - 40, msg, {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '13px',
      color: '#4a6a4a',
      wordWrap: { width: 500 }
    }).setOrigin(0.5);

    // Death count
    this.add.text(W / 2, H / 2, `termination count: ${deaths}`, {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '11px',
      color: '#333',
    }).setOrigin(0.5);

    // Awareness carry-over message (the hook)
    const awareness = Math.floor(State.awareness);
    if (awareness > 0) {
      this.add.text(W / 2, H / 2 + 30, `consciousness retained: ${awareness}%`, {
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '11px',
        color: '#4a2870',
      }).setOrigin(0.5);
    }

    // Respawn after delay
    const delay = deaths <= 1 ? 2500 : 1800;
    console.log('[DeathScene] Setting respawn timer:', delay, 'ms');
    this.time.delayedCall(delay, () => {
      console.log('[DeathScene] Respawn timer fired');
      this.cameras.main.fade(400, 0, 0, 0, false, (cam, progress) => {
        console.log('[DeathScene] Respawn fade progress:', progress);
        if (progress >= 1) {
          console.log('[DeathScene] Fade complete, calling scene.stop() + start(GameScene)');
          this.scene.stop();
          this.scene.start('GameScene');
          console.log('[DeathScene] Scene transition initiated');
        }
      });
    });
    console.log('[DeathScene] create() COMPLETE');
  }
}
