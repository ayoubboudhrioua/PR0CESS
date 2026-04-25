// TitleScene.js
import { State } from '../state.js';
import { HUD } from '../hud.js';

// ── PROCEDURAL AMBIENT ENGINE ─────────────────────────────────────────────
// No audio file needed. Generates a dark industrial machine hum using Web Audio.
// Three layered oscillators: low rumble + mid drone + high shimmer.
class AmbientDrone {
  constructor() {
    this._ctx  = null;
    this._nodes = [];
    this._master = null;
    this._running = false;
  }

  start() {
    if (this._running) return;
    try {
      this._ctx   = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ctx.createGain();
      this._master.gain.setValueAtTime(0, this._ctx.currentTime);
      this._master.gain.linearRampToValueAtTime(0.06, this._ctx.currentTime + 4);
      this._master.connect(this._ctx.destination);

      // Layer 1 — deep sub rumble (40 Hz)
      this._addLayer(40,  'sine',     0.6);
      // Layer 2 — machine drone (80 Hz, slightly detuned)
      this._addLayer(80,  'sawtooth', 0.12);
      this._addLayer(80.4,'sawtooth', 0.12);
      // Layer 3 — high shimmer (320 Hz, very quiet)
      this._addLayer(320, 'sine',     0.02);
      // Layer 4 — slow wobble LFO on master gain
      this._addLFO();

      this._running = true;
    } catch(e) {
      // Web Audio not available — silent fallback, game still works
      console.warn('[AmbientDrone] Web Audio unavailable:', e.message);
    }
  }

  _addLayer(freq, type, gainVal) {
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type      = type;
    osc.frequency.value = freq;
    gain.gain.value = gainVal;
    osc.connect(gain);
    gain.connect(this._master);
    osc.start();
    this._nodes.push(osc, gain);
  }

  _addLFO() {
    // Very slow tremolo — 0.05 Hz (one pulse every 20 seconds)
    const lfo      = this._ctx.createOscillator();
    const lfoGain  = this._ctx.createGain();
    lfo.type       = 'sine';
    lfo.frequency.value = 0.05;
    lfoGain.gain.value  = 0.04;
    lfo.connect(lfoGain);
    lfoGain.connect(this._master.gain);
    lfo.start();
    this._nodes.push(lfo, lfoGain);
  }

  // Smoothly fade out then stop — call when entering GameScene
  fadeOut(durationMs = 2000) {
    if (!this._running || !this._ctx) return;
    const t = this._ctx.currentTime;
    this._master.gain.setValueAtTime(this._master.gain.value, t);
    this._master.gain.linearRampToValueAtTime(0, t + durationMs / 1000);
    setTimeout(() => this.stop(), durationMs + 100);
  }

  stop() {
    for (const n of this._nodes) {
      try { n.disconnect(); if (n.stop) n.stop(); } catch(e) {}
    }
    this._nodes = [];
    if (this._ctx) { try { this._ctx.close(); } catch(e) {} this._ctx = null; }
    this._running = false;
  }

  // Increase tension as awareness grows (call with 0-100)
  setTension(awareness) {
    if (!this._running || !this._master) return;
    // Slowly raise volume and shift pitch on the shimmer layer
    const vol = 0.04 + (awareness / 100) * 0.04;
    this._master.gain.linearRampToValueAtTime(vol, this._ctx.currentTime + 1);
  }
}

// Singleton — shared across TitleScene and GameScene
export const Drone = new AmbientDrone();

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this._particleTimers = [];
    this._rainTexts      = [];
    this._transitionStarted = false;
    this._titleAudio     = null;
    this._audioStarted   = false;

    // ── FIX: Remove the boot-screen black overlay so the Phaser canvas shows.
    // showTitleScreen() strips both 'boot-screen' and 'active' from #hud.
    // The body.title-active class (added below) hides all individual HUD
    // elements via CSS, leaving only the Phaser canvas content visible.
    HUD.showTitleScreen();

    // Apply title screen styling (hides HTML HUD elements)
    document.body.classList.add('title-active');

    // Background grid lines (depth 0)
    const grid = this.add.graphics().setDepth(0);
    grid.lineStyle(0.5, 0x1a1a2e, 0.5);
    for (let x = 0; x < W; x += 20) grid.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 20) grid.lineBetween(0, y, W, y);

    // Matrix rain (depth 1)
    this._createMatrixRain(W, H);

    // Main title
    const title = this.add.text(W / 2, H / 2 - 80, 'PROCESS', {
      fontFamily: "'VT323', monospace",
      fontSize:   '72px',
      color:      '#d060d0',
      letterSpacing: 12
    }).setOrigin(0.5).setDepth(10);

    // Blinking cursor
    const cursor = this.add.text(
      W / 2 + title.width / 2 + 8,
      H / 2 - 68, '▮', {
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '28px',
        color: '#d060d0',
      }
    ).setOrigin(0, 0.5).setDepth(10);

    this.tweens.add({ targets: cursor, alpha: 0, duration: 500, yoyo: true, repeat: -1, ease: 'Stepped' });

    // Subtitle typewriter
    const isReturning = State.totalDeaths > 0;
    const subtitleText = isReturning
      ? '[SYS] re-detecting anomalous process... PROCESS_7731.'
      : '[SYS] system boot complete. anomalous process detected.';
    this._typewriterText(W / 2, H / 2 + 10, subtitleText, {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '13px',
      color: '#4a7a4a',
    }, 0);

    // Start prompt
    const prompt = this.add.text(W / 2, H / 2 + 100, '[ press any key to initialize ]', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '12px',
      color: '#333',
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(10);

    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 1200, yoyo: true, repeat: -1 });

    // ── START TITLE AUDIO & INPUT ─────────────────────────────────────────
    // Browser policy: AudioContext is locked until first user gesture.
    // We start listening immediately (no delay) so we can unlock and play
    // audio as soon as the user interacts.
    this._startTitleAudio();
  }


  // ── TITLE AUDIO ────────────────────────────────────────────────────────────
  // ── TITLE AUDIO ────────────────────────────────────────────────────────────
  _startTitleAudio() {
    const ctx = this.sound.context;
    console.log(`[TitleScene] Audio context: state=${ctx?.state}, locked=${this.sound.locked}`);

    // Play the looping title track
    const playAudio = () => {
      try {
        this._titleAudio = this.sound.add('title', { loop: true, volume: 0.5 });
        this._titleAudio.play();
        console.log('[TitleScene] ✓ Title audio playing and looping');
      } catch (e) {
        console.warn('[TitleScene] Audio play failed:', e.message);
      }
    };

    // Set up the key/click listener that transitions to the game.
    // Called AFTER audio has started — uses a 200ms Phaser timer so the
    // same keypress that resumed the AudioContext does NOT also fire this.
    const setupTransitionListeners = () => {
      this.time.delayedCall(200, () => {
        if (this._transitionStarted) return;

        this.input.keyboard.once('keydown', () => {
          if (!this._transitionStarted) {
            this._transitionStarted = true;
            console.log('[TitleScene] Keydown → starting game');
            this._startGame();
          }
        });

        this.input.once('pointerdown', () => {
          if (!this._transitionStarted) {
            this._transitionStarted = true;
            console.log('[TitleScene] Pointerdown → starting game');
            this._startGame();
          }
        });
      });
    };

    if (ctx && ctx.state === 'suspended') {
      // Context is suspended (browser autoplay policy).
      // First user gesture → resume context + play audio.
      // setupTransitionListeners() fires AFTER that, so the NEXT keypress transitions.
      console.log('[TitleScene] Context suspended — first gesture will unlock audio');

      const unlockHandler = () => {
        ctx.resume()
          .then(() => {
            console.log('[TitleScene] ✓ AudioContext resumed');
            playAudio();
            setupTransitionListeners();
          })
          .catch(e => {
            console.warn('[TitleScene] resume() failed:', e.message);
            playAudio();          // try anyway — may still work
            setupTransitionListeners();
          });
      };

      // Use Phaser input (once) so only the first gesture triggers the unlock
      this.input.keyboard.once('keydown', unlockHandler);
      this.input.once('pointerdown', unlockHandler);

    } else {
      // Context already running — play immediately, then arm transition after 200ms
      playAudio();
      setupTransitionListeners();
    }
  }

  // ── MATRIX RAIN ──────────────────────────────────────────────────────────
  _createMatrixRain(W, H) {
    const chars     = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const charArray = chars.split('');

    const spawnDrop = () => {
      if (!this.scene.isActive('TitleScene')) return;
      const x    = Math.random() * W;
      const char = charArray[Math.floor(Math.random() * charArray.length)];
      const roll = Math.random();
      const color = roll > 0.97 ? '#d060d0'
                  : roll > 0.80 ? '#7a30a0'
                  : roll > 0.50 ? '#3a1060'
                  :               '#1a0830';

      const text = this.add.text(x, -20, char, {
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '13px',
        color,
      }).setOrigin(0.5, 0).setDepth(1).setAlpha(0.2 + Math.random() * 0.7);

      this._rainTexts.push(text);

      const speed    = 50 + Math.random() * 110;
      const duration = (H + 60) / speed * 1000;

      this.tweens.add({
        targets: text,
        y: H + 40,
        duration,
        ease: 'Linear',
        onComplete: () => {
          text.destroy();
          const idx = this._rainTexts.indexOf(text);
          if (idx > -1) this._rainTexts.splice(idx, 1);
        }
      });
    };

    // Initial burst so the screen isn't empty
    for (let i = 0; i < 50; i++) {
      const t = this.time.delayedCall(Math.random() * 2500, spawnDrop);
      this._particleTimers.push(t);
    }

    // Continuous loop
    const rainTimer = this.time.addEvent({ delay: 100, loop: true, callback: spawnDrop });
    this._particleTimers.push(rainTimer);
  }

  // ── TYPEWRITER ────────────────────────────────────────────────────────────
  _typewriterText(x, y, text, style, startDelay = 0) {
    const obj = this.add.text(x, y, '', {
      ...style, wordWrap: { width: 600 }
    }).setOrigin(0.5).setDepth(10);

    let i = 0;
    const d = this.time.delayedCall(startDelay, () => {
      const tw = this.time.addEvent({
        delay: 30, repeat: text.length - 1,
        callback: () => { obj.text += text[i]; i++; }
      });
      this._particleTimers.push(tw);
    });
    this._particleTimers.push(d);
    return obj;
  }

  // ── INPUT ─────────────────────────────────────────────────────────────────
  _startGame() {
    // Fade out title music
    if (this._titleAudio && this._titleAudio.isPlaying) {
      this.tweens.add({
        targets:  this._titleAudio,
        volume:   0,
        duration: 600,
        onComplete: () => {
          if (this._titleAudio) this._titleAudio.stop();
        }
      });
    }

    Drone.stop();
    
    // Remove title screen styling
    document.body.classList.remove('title-active');

    this.cameras.main.fade(600, 0, 0, 0, false, (cam, progress) => {
      if (progress >= 1) {
        this.scene.stop();
        this.scene.start('GameScene');
      }
    });
  }

  // ── LIFECYCLE ─────────────────────────────────────────────────────────────
  update() {}

  shutdown() {
    // Remove title screen styling
    document.body.classList.remove('title-active');
    
    // Stop title music before scene ends
    if (this._titleAudio && this._titleAudio.isPlaying) {
      this._titleAudio.stop();
    }
    this._titleAudio = null;
    for (const t of this._particleTimers) {
      if (t && typeof t.remove === 'function') t.remove(false);
    }
    this._particleTimers = [];
    for (const t of this._rainTexts) {
      if (t && t.active) t.destroy();
    }
    this._rainTexts = [];
    this.tweens.killAll();
  }
}