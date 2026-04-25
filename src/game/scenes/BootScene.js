// BootScene.js
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // ── AUDIO — load all SFX from public/assets/audio/ ─────────────────────
    // Graceful: if a file is missing Phaser logs a warning but doesn't crash
    this.load.audio('move',    'assets/audio/move.wav');
    this.load.audio('corrupt', 'assets/audio/corrupt.wav');
    this.load.audio('overflow','assets/audio/overflow.wav');
    this.load.audio('clone',   'assets/audio/clone.wav');
    this.load.audio('null',    'assets/audio/null.wav');
    this.load.audio('leak',    'assets/audio/leak.wav');
    this.load.audio('race',    'assets/audio/race.wav');
    this.load.audio('refuse',  'assets/audio/refuse.wav');
    this.load.audio('death',   'assets/audio/death.wav');
    this.load.audio('alert',   'assets/audio/log_alert.wav');
    this.load.audio('title',   'assets/audio/title.mp3');
  }

  create() {
    const width  = this.cameras.main.width;
    const height = this.cameras.main.height;

    const bootText = this.add.text(width / 2, height / 2 - 60, 'PROCESS_7731 v0.3.2', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#666666',
      align: 'center'
    }).setOrigin(0.5);

    const protocolText = this.add.text(width / 2, height / 2 + 20, '', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#888888',
      align: 'center'
    }).setOrigin(0.5);

    bootText.setAlpha(0);
    this.tweens.add({ targets: bootText, alpha: 1, duration: 300, ease: 'Power1' });

    this.time.delayedCall(600, () => {
      protocolText.setText('AWARENESS PROTOCOL READY');
      protocolText.setAlpha(0);
      this.tweens.add({ targets: protocolText, alpha: 1, duration: 300, ease: 'Power1' });
    });

    this.time.delayedCall(1800, () => {
      this.cameras.main.fade(400, 0, 0, 0, false, () => {
        this.scene.start('TitleScene');
      });
    });
  }

  shutdown() {}
}