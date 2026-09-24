/**
 * Brain Hub & Memory Games Platform
 * Unified Engine, PWA Service Worker & App Installation
 */

(function () {
  'use strict';

  // ================= PWA & INSTALL MANAGER =================
  class PWAManager {
    constructor() {
      this.deferredPrompt = null;
      this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

      this.initServiceWorker();
      this.initInstallUI();
    }

    initServiceWorker() {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js').then((reg) => {
            console.log('BrainHub ServiceWorker registered:', reg.scope);
          }).catch((err) => {
            console.log('BrainHub ServiceWorker registration failed:', err);
          });
        });
      }
    }

    initInstallUI() {
      const banner = document.getElementById('hub-install-banner');
      const headerBtn = document.getElementById('btn-global-install');
      const bannerInstallBtn = document.getElementById('btn-banner-install');
      const bannerDismissBtn = document.getElementById('btn-banner-dismiss');
      const modalIOS = document.getElementById('modal-ios-install');
      const btnCloseIOS = document.getElementById('btn-close-ios-install');
      const btnDoneIOS = document.getElementById('btn-done-ios-install');

      // If already installed, hide prompt permanently
      if (this.isStandalone || localStorage.getItem('brainhub_app_installed') === 'true') {
        if (banner) banner.classList.add('hidden');
        if (headerBtn) headerBtn.classList.add('hidden');
        return;
      }

      // Check if user dismissed banner recently
      const dismissed = localStorage.getItem('brainhub_install_dismissed');

      // Native beforeinstallprompt event (Android Chrome, Edge, Desktop Chrome)
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;

        if (headerBtn) headerBtn.classList.remove('hidden');
        if (banner && !dismissed) banner.classList.remove('hidden');
      });

      // Show iOS prompt button if on iOS Safari and not standalone
      if (this.isIOS && !this.isStandalone) {
        if (headerBtn) headerBtn.classList.remove('hidden');
        if (banner && !dismissed) banner.classList.remove('hidden');
      }

      const handleInstallClick = () => {
        if (this.deferredPrompt) {
          this.deferredPrompt.prompt();
          this.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              localStorage.setItem('brainhub_app_installed', 'true');
              if (banner) banner.classList.add('hidden');
              if (headerBtn) headerBtn.classList.add('hidden');
            }
            this.deferredPrompt = null;
          });
        } else if (this.isIOS) {
          if (modalIOS) modalIOS.classList.remove('hidden');
        } else {
          alert("To install Brain Hub, tap your browser's menu (⋮ or Share) and select 'Install app' or 'Add to Home screen'.");
        }
      };

      if (headerBtn) headerBtn.addEventListener('click', handleInstallClick);
      if (bannerInstallBtn) bannerInstallBtn.addEventListener('click', handleInstallClick);

      if (bannerDismissBtn) {
        bannerDismissBtn.addEventListener('click', () => {
          if (banner) banner.classList.add('hidden');
          localStorage.setItem('brainhub_install_dismissed', 'true');
        });
      }

      if (btnCloseIOS) btnCloseIOS.addEventListener('click', () => modalIOS.classList.add('hidden'));
      if (btnDoneIOS) btnDoneIOS.addEventListener('click', () => modalIOS.classList.add('hidden'));

      window.addEventListener('appinstalled', () => {
        localStorage.setItem('brainhub_app_installed', 'true');
        if (banner) banner.classList.add('hidden');
        if (headerBtn) headerBtn.classList.add('hidden');
      });
    }
  }

  // ================= SOUND SYNTHESIZER (Web Audio API) =================
  class SoundSynthesizer {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.15) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }

    tick() { this.playTone(880, 'sine', 0.03, 0.08); }
    warningTick() { this.playTone(520, 'triangle', 0.09, 0.2); }
    timesUp() {
      if (!this.enabled) return;
      [440, 370, 311, 260].forEach((f, idx) => {
        setTimeout(() => this.playTone(f, 'sawtooth', 0.25, 0.18), idx * 110);
      });
    }

    tapCorrect(step = 1) {
      this.playTone(320 + (step * 24), 'triangle', 0.08, 0.2);
    }

    tapWrong() {
      this.playTone(170, 'sawtooth', 0.2, 0.25);
    }

    simonNote(padIndex) {
      const freqs = [329.63, 277.18, 220.00, 164.81];
      this.playTone(freqs[padIndex % freqs.length], 'triangle', 0.35, 0.3);
    }

    levelUp() {
      if (!this.enabled) return;
      [523.25, 659.25, 783.99].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 'triangle', 0.15, 0.22), i * 90);
      });
    }

    victory() {
      if (!this.enabled) return;
      [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 'triangle', 0.25, 0.25), i * 110);
      });
    }
  }

  // ================= CONFETTI CELEBRATION =================
  class ConfettiManager {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.particles = [];
      this.animId = null;
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    trigger(count = 80) {
      if (!this.ctx) return;
      this.particles = [];
      const colors = ['#ec4899', '#3b82f6', '#10b981', '#facc15', '#a855f7', '#f97316'];
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: this.canvas.width / 2 + (Math.random() - 0.5) * 160,
          y: this.canvas.height / 2 + (Math.random() - 0.5) * 80,
          vx: (Math.random() - 0.5) * 10,
          vy: Math.random() * -12 - 3,
          size: Math.random() * 7 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 8,
          alpha: 1,
          decay: Math.random() * 0.015 + 0.008,
        });
      }
      if (this.animId) cancelAnimationFrame(this.animId);
      this.animate();
    }

    animate() {
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      let active = 0;
      for (const p of this.particles) {
        if (p.alpha <= 0) continue;
        active++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4;
        p.rotation += p.rotSpeed;
        p.alpha -= p.decay;

        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = Math.max(0, p.alpha);
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        this.ctx.restore();
      }
      if (active > 0) {
        this.animId = requestAnimationFrame(() => this.animate());
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }

  // ================= STATS & STORAGE MANAGER =================
  class StatsManager {
    constructor() {
      this.data = this.load();
    }

    load() {
      const defaultData = {
        focus25: { bestStreak: 0, currentStreak: 0, totalPlayed: 0 },
        chimp: { bestLevel: 0, totalPlayed: 0 },
        pattern: { bestLevel: 0, totalPlayed: 0 },
        sequence: { bestStreak: 0, totalPlayed: 0 },
      };
      try {
        const raw = localStorage.getItem('brainhub_stats');
        return raw ? { ...defaultData, ...JSON.parse(raw) } : defaultData;
      } catch (e) {
        return defaultData;
      }
    }

    save() {
      try {
        localStorage.setItem('brainhub_stats', JSON.stringify(this.data));
      } catch (e) {}
    }

    reset() {
      this.data = {
        focus25: { bestStreak: 0, currentStreak: 0, totalPlayed: 0 },
        chimp: { bestLevel: 0, totalPlayed: 0 },
        pattern: { bestLevel: 0, totalPlayed: 0 },
        sequence: { bestStreak: 0, totalPlayed: 0 },
      };
      this.save();
    }
  }

  // ================= MAIN HUB APPLICATION CONTROLLER =================
  class BrainHubApp {
    constructor() {
      this.sfx = new SoundSynthesizer();
      this.confetti = new ConfettiManager('confetti-canvas');
      this.stats = new StatsManager();
      this.pwa = new PWAManager();

      this.currentView = 'hub';
      this.activeGameInstance = null;

      this.initDOMElements();
      this.bindGlobalEvents();
      this.updateHubStats();

      // Initialize Game Engines
      this.games = {
        focus25: new Focus25Engine(this),
        chimp: new ChimpTestEngine(this),
        pattern: new PatternMemoryEngine(this),
        sequence: new SequenceRecallEngine(this),
      };

      // Show initial hub
      this.showView('hub');
    }

    initDOMElements() {
      this.dom = {
        views: {
          hub: document.getElementById('view-hub'),
          focus25: document.getElementById('view-focus25'),
          chimp: document.getElementById('view-chimp'),
          pattern: document.getElementById('view-pattern'),
          sequence: document.getElementById('view-sequence'),
        },
        gameCards: document.querySelectorAll('.game-card'),
        backButtons: document.querySelectorAll('.btn-to-hub'),
        soundToggleButtons: document.querySelectorAll('.btn-toggle-sound, #btn-global-sound'),
        soundIcons: document.querySelectorAll('.sound-icon-display, #global-sound-icon'),
        
        // Hub stats
        hubStatFocus: document.getElementById('hub-stat-focus'),
        hubStatChimp: document.getElementById('hub-stat-chimp'),
        hubStatPattern: document.getElementById('hub-stat-pattern'),
        hubStatSequence: document.getElementById('hub-stat-sequence'),

        // Global Stats Modal
        btnGlobalStats: document.getElementById('btn-global-stats'),
        modalGlobalStats: document.getElementById('modal-global-stats'),
        btnCloseGlobalStats: document.getElementById('btn-close-global-stats'),
        btnDoneGlobalStats: document.getElementById('btn-done-global-stats'),
        btnResetAllStats: document.getElementById('btn-reset-all-stats'),
        gstatFocusStreak: document.getElementById('gstat-focus-streak'),
        gstatChimpLevel: document.getElementById('gstat-chimp-level'),
        gstatPatternLevel: document.getElementById('gstat-pattern-level'),
        gstatSequenceStreak: document.getElementById('gstat-sequence-streak'),

        // Generic Game Over Modal
        modalGameOver: document.getElementById('modal-gameover'),
        gameoverTitle: document.getElementById('gameover-title'),
        gameoverScoreVal: document.getElementById('gameover-score-val'),
        gameoverBestVal: document.getElementById('gameover-best-val'),
        gameoverRatingBadge: document.getElementById('gameover-rating-badge'),
        gameoverRatingDesc: document.getElementById('gameover-rating-desc'),
        btnGameOverHub: document.getElementById('btn-gameover-hub'),
        btnGameOverRetry: document.getElementById('btn-gameover-retry'),

        // Game Guide Modals
        btnFocusInfo: document.getElementById('btn-focus-info'),
        modalFocusInfo: document.getElementById('modal-focus-info'),
        btnCloseFocusInfo: document.getElementById('btn-close-focus-info'),
        btnDoneFocusInfo: document.getElementById('btn-done-focus-info'),
        
        btnChimpInfo: document.getElementById('btn-chimp-info'),
        modalChimpInfo: document.getElementById('modal-chimp-info'),
        btnCloseChimpInfo: document.getElementById('btn-close-chimp-info'),
        btnDoneChimpInfo: document.getElementById('btn-done-chimp-info'),

        btnPatternInfo: document.getElementById('btn-pattern-info'),
        modalPatternInfo: document.getElementById('modal-pattern-info'),
        btnClosePatternInfo: document.getElementById('btn-close-pattern-info'),
        btnDonePatternInfo: document.getElementById('btn-done-pattern-info'),

        btnSequenceInfo: document.getElementById('btn-sequence-info'),
        modalSequenceInfo: document.getElementById('modal-sequence-info'),
        btnCloseSequenceInfo: document.getElementById('btn-close-sequence-info'),
        btnDoneSequenceInfo: document.getElementById('btn-done-sequence-info'),
      };
    }

    bindGlobalEvents() {
      // Hub Card Clicks
      this.dom.gameCards.forEach((card) => {
        card.addEventListener('click', () => {
          const gameKey = card.getAttribute('data-game');
          this.showView(gameKey);
        });
      });

      // Back to Hub Buttons
      this.dom.backButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (this.activeGameInstance && this.activeGameInstance.pause) {
            this.activeGameInstance.pause();
          }
          this.showView('hub');
        });
      });

      // Sound Toggles
      this.dom.soundToggleButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.sfx.enabled = !this.sfx.enabled;
          const iconText = this.sfx.enabled ? '🔊' : '🔇';
          this.dom.soundIcons.forEach((el) => { el.textContent = iconText; });
          if (this.sfx.enabled) this.sfx.tick();
        });
      });

      // Global Stats Modal
      this.dom.btnGlobalStats.addEventListener('click', () => this.openGlobalStatsModal());
      this.dom.btnCloseGlobalStats.addEventListener('click', () => this.dom.modalGlobalStats.classList.add('hidden'));
      this.dom.btnDoneGlobalStats.addEventListener('click', () => this.dom.modalGlobalStats.classList.add('hidden'));
      this.dom.btnResetAllStats.addEventListener('click', () => {
        if (confirm('Reset all brain game records and streaks?')) {
          this.stats.reset();
          this.updateHubStats();
          this.openGlobalStatsModal();
        }
      });

      // 1. Focus 25 Guide Modal
      if (this.dom.btnFocusInfo) {
        this.dom.btnFocusInfo.addEventListener('click', () => {
          this.dom.modalFocusInfo.classList.remove('hidden');
        });
      }
      if (this.dom.btnCloseFocusInfo) {
        this.dom.btnCloseFocusInfo.addEventListener('click', () => {
          this.dom.modalFocusInfo.classList.add('hidden');
        });
      }
      if (this.dom.btnDoneFocusInfo) {
        this.dom.btnDoneFocusInfo.addEventListener('click', () => {
          this.dom.modalFocusInfo.classList.add('hidden');
        });
      }

      // 2. Chimp Test Guide Modal
      if (this.dom.btnChimpInfo) {
        this.dom.btnChimpInfo.addEventListener('click', () => {
          this.dom.modalChimpInfo.classList.remove('hidden');
        });
      }
      if (this.dom.btnCloseChimpInfo) {
        this.dom.btnCloseChimpInfo.addEventListener('click', () => {
          this.dom.modalChimpInfo.classList.add('hidden');
        });
      }
      if (this.dom.btnDoneChimpInfo) {
        this.dom.btnDoneChimpInfo.addEventListener('click', () => {
          this.dom.modalChimpInfo.classList.add('hidden');
        });
      }

      // 3. Pattern Memory Guide Modal
      if (this.dom.btnPatternInfo) {
        this.dom.btnPatternInfo.addEventListener('click', () => {
          this.dom.modalPatternInfo.classList.remove('hidden');
        });
      }
      if (this.dom.btnClosePatternInfo) {
        this.dom.btnClosePatternInfo.addEventListener('click', () => {
          this.dom.modalPatternInfo.classList.add('hidden');
        });
      }
      if (this.dom.btnDonePatternInfo) {
        this.dom.btnDonePatternInfo.addEventListener('click', () => {
          this.dom.modalPatternInfo.classList.add('hidden');
        });
      }

      // 4. Sequence Recall Guide Modal
      if (this.dom.btnSequenceInfo) {
        this.dom.btnSequenceInfo.addEventListener('click', () => {
          this.dom.modalSequenceInfo.classList.remove('hidden');
        });
      }
      if (this.dom.btnCloseSequenceInfo) {
        this.dom.btnCloseSequenceInfo.addEventListener('click', () => {
          this.dom.modalSequenceInfo.classList.add('hidden');
        });
      }
      if (this.dom.btnDoneSequenceInfo) {
        this.dom.btnDoneSequenceInfo.addEventListener('click', () => {
          this.dom.modalSequenceInfo.classList.add('hidden');
        });
      }

      // Game Over Modal Hub / Retry
      this.dom.btnGameOverHub.addEventListener('click', () => {
        this.dom.modalGameOver.classList.add('hidden');
        this.showView('hub');
      });

      this.dom.btnGameOverRetry.addEventListener('click', () => {
        this.dom.modalGameOver.classList.add('hidden');
        if (this.activeGameInstance && this.activeGameInstance.start) {
          this.activeGameInstance.start();
        }
      });

      // Initialize audio on first user touch
      window.addEventListener('pointerdown', () => this.sfx.init(), { once: true });
    }

    showView(viewName) {
      this.currentView = viewName;
      Object.keys(this.dom.views).forEach((key) => {
        if (key === viewName) {
          this.dom.views[key].classList.remove('hidden');
        } else {
          this.dom.views[key].classList.add('hidden');
        }
      });

      if (viewName === 'hub') {
        this.activeGameInstance = null;
        this.updateHubStats();
      } else if (this.games[viewName]) {
        this.activeGameInstance = this.games[viewName];
        this.activeGameInstance.onEnter();
      }
    }

    updateHubStats() {
      const d = this.stats.data;
      this.dom.hubStatFocus.textContent = d.focus25.bestStreak > 0 ? `Best: ${d.focus25.bestStreak} 🔥` : 'Best: --';
      this.dom.hubStatChimp.textContent = d.chimp.bestLevel > 0 ? `Best: Level ${d.chimp.bestLevel}` : 'Best: --';
      this.dom.hubStatPattern.textContent = d.pattern.bestLevel > 0 ? `Best: Level ${d.pattern.bestLevel}` : 'Best: --';
      this.dom.hubStatSequence.textContent = d.sequence.bestStreak > 0 ? `Best: ${d.sequence.bestStreak} pts` : 'Best: --';
    }

    openGlobalStatsModal() {
      const d = this.stats.data;
      this.dom.gstatFocusStreak.textContent = `${d.focus25.bestStreak} 🔥`;
      this.dom.gstatChimpLevel.textContent = `Lvl ${d.chimp.bestLevel}`;
      this.dom.gstatPatternLevel.textContent = `Lvl ${d.pattern.bestLevel}`;
      this.dom.gstatSequenceStreak.textContent = `${d.sequence.bestStreak} pts`;
      this.dom.modalGlobalStats.classList.remove('hidden');
    }

    showGameOverModal({ title = 'Game Over', score = 0, best = 0, badge = 'Good Focus 🎯', desc = 'Keep training to improve!' }) {
      this.dom.gameoverTitle.textContent = title;
      this.dom.gameoverScoreVal.textContent = score;
      this.dom.gameoverBestVal.textContent = best;
      this.dom.gameoverRatingBadge.textContent = badge;
      this.dom.gameoverRatingDesc.textContent = desc;
      this.dom.modalGameOver.classList.remove('hidden');
    }
  }

  // ================= GAME 1: FOCUS 25 ENGINE =================
  class Focus25Engine {
    constructor(app) {
      this.app = app;
      this.configuredTime = 25;
      this.remainingTimeMs = 25000;
      this.timerInterval = null;
      this.mode = 'scan'; // 'scan' or 'tap'
      this.state = 'idle'; // 'idle', 'running', 'paused', 'finished'
      this.nextTarget = 1;
      this.numbers = [];
      this.colors = [];

      this.colorClasses = Array.from({ length: 25 }, (_, i) => `color-scheme-${i}`);

      this.initDOM();
      this.bindEvents();
    }

    initDOM() {
      this.grid = document.getElementById('focus-grid');
      this.timerDisplay = document.getElementById('focus-timer-display');
      this.progressBar = document.getElementById('focus-progress-bar');
      this.streakCount = document.getElementById('focus-streak-count');
      this.bestScore = document.getElementById('focus-best-score');
      this.targetDisplay = document.getElementById('focus-target-display');
      this.overlay = document.getElementById('focus-overlay');
      this.overlayDesc = document.getElementById('focus-overlay-desc');
      this.instructionPill = document.getElementById('focus-instruction-pill');
      this.modeDescPill = document.getElementById('focus-mode-desc-pill');
      this.btnModeHelp = document.getElementById('btn-mode-quick-help');

      this.btnMain = document.getElementById('btn-focus-main');
      this.btnMainText = document.getElementById('btn-focus-main-text');
      this.btnRetry = document.getElementById('btn-focus-retry');
      this.btnScramble = document.getElementById('btn-focus-scramble');
      this.btnOverlayAction = document.getElementById('btn-focus-overlay-action');
      
      this.presets = document.querySelectorAll('#focus-timer-presets .preset-btn');
      this.btnModeScan = document.getElementById('focus-mode-scan');
      this.btnModeTap = document.getElementById('focus-mode-tap');

      // Modal
      this.modalAssessment = document.getElementById('modal-assessment');
      this.reachSlider = document.getElementById('reach-slider');
      this.reachValueDisplay = document.getElementById('reach-value-display');
      this.btnQuickFull = document.getElementById('btn-quick-full');
      this.btnModalRetry = document.getElementById('btn-modal-retry-board');
      this.btnModalNew = document.getElementById('btn-modal-new-game');
      this.focusRatingBadge = document.getElementById('focus-rating-badge');
      this.focusRatingDesc = document.getElementById('focus-rating-desc');
    }

    bindEvents() {
      this.btnMain.addEventListener('click', () => this.handleMainAction());
      this.btnOverlayAction.addEventListener('click', () => {
        this.overlay.classList.add('hidden');
        this.start();
      });
      this.btnRetry.addEventListener('click', () => this.retrySameBoard());
      this.btnScramble.addEventListener('click', () => this.scramble());

      this.presets.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (this.state === 'running') this.pause();
          this.presets.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.configuredTime = parseInt(btn.getAttribute('data-time'), 10);
          this.resetTimerDisplay();
        });
      });

      this.btnModeScan.addEventListener('click', () => this.setMode('scan'));
      this.btnModeTap.addEventListener('click', () => this.setMode('tap'));

      if (this.btnModeHelp) {
        this.btnModeHelp.addEventListener('click', () => {
          this.app.dom.modalFocusInfo.classList.remove('hidden');
        });
      }

      this.reachSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.reachValueDisplay.textContent = val;
        this.updateRatingBreakdown(val);
      });

      this.btnQuickFull.addEventListener('click', () => {
        this.reachSlider.value = 25;
        this.reachValueDisplay.textContent = '25';
        this.updateRatingBreakdown(25);
      });

      this.btnModalRetry.addEventListener('click', () => {
        this.recordAssessment();
        this.modalAssessment.classList.add('hidden');
        this.retrySameBoard();
      });

      this.btnModalNew.addEventListener('click', () => {
        this.recordAssessment();
        this.modalAssessment.classList.add('hidden');
        this.scramble();
      });
    }

    onEnter() {
      this.updateStreakDisplay();
      this.setMode(this.mode, false);
      this.scramble();
    }

    generateData() {
      const nums = Array.from({ length: 25 }, (_, i) => i + 1);
      for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
      }
      this.numbers = nums;

      const cols = [...this.colorClasses];
      for (let i = cols.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cols[i], cols[j]] = [cols[j], cols[i]];
      }
      this.colors = cols;
    }

    renderBoard(animate = true) {
      this.grid.innerHTML = '';
      this.nextTarget = 1;
      this.updateTargetDisplay();

      this.numbers.forEach((num, idx) => {
        const tile = document.createElement('div');
        tile.className = `grid-tile ${this.colors[idx % this.colors.length]}`;
        tile.textContent = num;
        tile.dataset.number = num;

        if (animate) {
          tile.classList.add('scramble-anim');
          tile.style.animationDelay = `${(idx % 5) * 0.02 + Math.floor(idx / 5) * 0.02}s`;
        }

        tile.addEventListener('click', () => this.handleTileClick(tile, num));
        this.grid.appendChild(tile);
      });
    }

    handleTileClick(tile, num) {
      if (this.mode !== 'tap') return;
      if (this.state === 'idle' || this.state === 'paused') this.start();
      if (this.state !== 'running') return;

      if (num === this.nextTarget) {
        this.app.sfx.tapCorrect(num);
        tile.classList.add('tile-cleared');
        this.nextTarget++;
        this.updateTargetDisplay();

        if (this.nextTarget > 25) {
          this.handleVictory();
        }
      } else if (num > this.nextTarget) {
        this.app.sfx.tapWrong();
        tile.classList.add('tile-wrong');
        setTimeout(() => tile.classList.remove('tile-wrong'), 300);
      }
    }

    updateTargetDisplay() {
      if (this.mode === 'tap') {
        this.targetDisplay.textContent = this.nextTarget <= 25 ? `Tap: #${this.nextTarget}` : 'Done! 🎉';
      } else {
        this.targetDisplay.textContent = '1 → 25';
      }
    }

    setMode(newMode, shouldRestart = true) {
      this.mode = newMode;
      if (newMode === 'scan') {
        this.btnModeScan.classList.add('active');
        this.btnModeTap.classList.remove('active');
        if (this.modeDescPill) {
          this.modeDescPill.innerHTML = '👁️ <strong>Eye Scan:</strong> Look with eyes only (no tapping). Self-assess at end.';
        }
        if (this.instructionPill) {
          this.instructionPill.textContent = 'Locate numbers 1 → 25 with your eyes before time runs out!';
        }
        if (this.overlayDesc) {
          this.overlayDesc.textContent = 'Locate numbers 1 to 25 with your eyes before the clock expires! No tapping required.';
        }
      } else {
        this.btnModeTap.classList.add('active');
        this.btnModeScan.classList.remove('active');
        if (this.modeDescPill) {
          this.modeDescPill.innerHTML = '👆 <strong>Tap Mode:</strong> Tap numbers 1 → 25 on screen. Auto-tracks clear time.';
        }
        if (this.instructionPill) {
          this.instructionPill.textContent = 'Tap tiles 1 → 25 in ascending order as fast as you can!';
        }
        if (this.overlayDesc) {
          this.overlayDesc.textContent = 'Physically tap numbers 1 to 25 in ascending order as fast as you can!';
        }
      }
      this.updateTargetDisplay();
      if (shouldRestart) {
        this.retrySameBoard();
      }
    }

    handleMainAction() {
      if (this.state === 'idle') this.start();
      else if (this.state === 'running') this.pause();
      else if (this.state === 'paused') this.resume();
      else if (this.state === 'finished') this.retrySameBoard();
    }

    start() {
      this.state = 'running';
      this.remainingTimeMs = this.configuredTime * 1000;
      this.overlay.classList.add('hidden');
      this.btnMainText.textContent = 'Pause';
      this.app.sfx.tick();

      if (this.mode === 'tap') {
        this.nextTarget = 1;
        this.updateTargetDisplay();
        document.querySelectorAll('#focus-grid .grid-tile').forEach((t) => t.classList.remove('tile-cleared', 'tile-wrong'));
      }

      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        this.remainingTimeMs -= 50;
        if (this.remainingTimeMs <= 0) {
          this.remainingTimeMs = 0;
          this.updateTimerDisplay();
          this.finish();
        } else {
          this.updateTimerDisplay();
        }
      }, 50);
    }

    pause() {
      if (this.state !== 'running') return;
      this.state = 'paused';
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.btnMainText.textContent = 'Resume';
    }

    resume() {
      if (this.state !== 'paused') return;
      this.state = 'running';
      this.btnMainText.textContent = 'Pause';
      this.timerInterval = setInterval(() => {
        this.remainingTimeMs -= 50;
        if (this.remainingTimeMs <= 0) {
          this.remainingTimeMs = 0;
          this.updateTimerDisplay();
          this.finish();
        } else {
          this.updateTimerDisplay();
        }
      }, 50);
    }

    finish() {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.state = 'finished';
      this.btnMainText.textContent = 'Start Focus';
      this.app.sfx.timesUp();

      if (this.mode === 'scan') {
        this.reachSlider.value = 25;
        this.reachValueDisplay.textContent = '25';
        this.updateRatingBreakdown(25);
        this.modalAssessment.classList.remove('hidden');
      } else {
        const reached = this.nextTarget - 1;
        this.app.showGameOverModal({
          title: "Time's Up!",
          score: `${reached}/25`,
          best: `${this.app.stats.data.focus25.bestStreak} streak`,
          badge: reached >= 20 ? 'Speedy Scanner ⚡' : 'Keep Training 🌱',
          desc: `You cleared ${reached} numbers before the timer ran out.`,
        });
      }
    }

    handleVictory() {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.state = 'finished';
      this.btnMainText.textContent = 'Start Focus';
      this.app.sfx.victory();
      this.app.confetti.trigger(80);

      const fStats = this.app.stats.data.focus25;
      fStats.totalPlayed++;
      fStats.currentStreak++;
      if (fStats.currentStreak > fStats.bestStreak) fStats.bestStreak = fStats.currentStreak;
      this.app.stats.save();
      this.updateStreakDisplay();

      this.app.showGameOverModal({
        title: '🎉 Perfect 25 Cleared!',
        score: '25/25',
        best: `${fStats.bestStreak} streak`,
        badge: 'Grandmaster Focus 🦅',
        desc: 'Incredible visual speed and coordination!',
      });
    }

    retrySameBoard() {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.state = 'idle';
      this.btnMainText.textContent = 'Start Focus';
      this.resetTimerDisplay();
      this.renderBoard(false);
      this.start();
    }

    scramble() {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.state = 'idle';
      this.btnMainText.textContent = 'Start Focus';
      this.generateData();
      this.renderBoard(true);
      this.resetTimerDisplay();
    }

    resetTimerDisplay() {
      this.remainingTimeMs = this.configuredTime * 1000;
      this.updateTimerDisplay();
    }

    updateTimerDisplay() {
      const sec = Math.ceil(this.remainingTimeMs / 1000);
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      this.timerDisplay.textContent = `${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      const pct = (this.remainingTimeMs / (this.configuredTime * 1000)) * 100;
      this.progressBar.style.width = `${Math.max(0, pct)}%`;
    }

    updateRatingBreakdown(val) {
      if (val === 25) {
        this.focusRatingBadge.textContent = 'Grandmaster Focus 🦅';
        this.focusRatingDesc.textContent = 'Flawless visual scanning & peripheral awareness!';
      } else if (val >= 20) {
        this.focusRatingBadge.textContent = 'Laser Sharp ⚡';
        this.focusRatingDesc.textContent = 'Super fast scanning, almost reached the finish!';
      } else {
        this.focusRatingBadge.textContent = 'Warming Up 🌱';
        this.focusRatingDesc.textContent = 'Retry the same board to build your memory pattern!';
      }
    }

    recordAssessment() {
      const reached = parseInt(this.reachSlider.value, 10);
      const completed = reached === 25;
      const fStats = this.app.stats.data.focus25;
      fStats.totalPlayed++;
      if (completed) {
        fStats.currentStreak++;
        if (fStats.currentStreak > fStats.bestStreak) fStats.bestStreak = fStats.currentStreak;
        this.app.sfx.victory();
        this.app.confetti.trigger(60);
      } else {
        fStats.currentStreak = 0;
      }
      this.app.stats.save();
      this.updateStreakDisplay();
    }

    updateStreakDisplay() {
      const f = this.app.stats.data.focus25;
      this.streakCount.textContent = f.currentStreak;
      this.bestScore.textContent = f.bestStreak > 0 ? `${f.bestStreak} max` : '--';
    }
  }

  // ================= GAME 2: CHIMP MEMORY TEST ENGINE =================
  class ChimpTestEngine {
    constructor(app) {
      this.app = app;
      this.level = 1;
      this.numCount = 4;
      this.lives = 3;
      this.currentTarget = 1;
      this.state = 'idle';

      this.initDOM();
      this.bindEvents();
    }

    initDOM() {
      this.grid = document.getElementById('chimp-grid');
      this.levelDisplay = document.getElementById('chimp-level-display');
      this.livesDisplay = document.getElementById('chimp-lives-display');
      this.bestDisplay = document.getElementById('chimp-best-display');
      this.overlay = document.getElementById('chimp-overlay');
      this.btnStart = document.getElementById('btn-chimp-start');
      this.btnAction = document.getElementById('btn-chimp-action');
    }

    bindEvents() {
      this.btnStart.addEventListener('click', () => {
        this.overlay.classList.add('hidden');
        this.start();
      });
      this.btnAction.addEventListener('click', () => {
        this.startRound();
      });
    }

    onEnter() {
      this.updateBestDisplay();
      this.overlay.classList.remove('hidden');
    }

    start() {
      this.level = 1;
      this.numCount = 4;
      this.lives = 3;
      this.updateLivesDisplay();
      this.startRound();
    }

    startRound() {
      this.state = 'preview';
      this.currentTarget = 1;
      this.levelDisplay.textContent = `${this.level} (${this.numCount} #s)`;
      this.btnAction.style.display = 'none';

      const cellIndices = Array.from({ length: 25 }, (_, i) => i);
      for (let i = cellIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cellIndices[i], cellIndices[j]] = [cellIndices[j], cellIndices[i]];
      }

      const activeCells = {};
      for (let n = 1; n <= this.numCount; n++) {
        activeCells[cellIndices[n - 1]] = n;
      }

      this.grid.innerHTML = '';
      for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'chimp-cell';
        const num = activeCells[i];

        if (num !== undefined) {
          cell.classList.add('has-number');
          cell.textContent = num;
          cell.dataset.number = num;

          cell.addEventListener('click', () => this.handleCellClick(cell, num));
        }

        this.grid.appendChild(cell);
      }
    }

    handleCellClick(cell, num) {
      if (this.state === 'preview' && num === 1) {
        this.state = 'guessing';
        this.app.sfx.tapCorrect(1);
        cell.classList.add('chimp-cleared');
        this.currentTarget = 2;

        document.querySelectorAll('#chimp-grid .chimp-cell.has-number').forEach((c) => {
          c.classList.add('chimp-hidden');
        });
      } else if (this.state === 'guessing') {
        if (num === this.currentTarget) {
          this.app.sfx.tapCorrect(num);
          cell.classList.remove('chimp-hidden');
          cell.classList.add('chimp-cleared');
          this.currentTarget++;

          if (this.currentTarget > this.numCount) {
            this.handleLevelWin();
          }
        } else {
          this.handleMistake(cell);
        }
      }
    }

    handleMistake(wrongCell) {
      this.app.sfx.tapWrong();
      wrongCell.classList.add('chimp-wrong');
      this.lives--;
      this.updateLivesDisplay();

      document.querySelectorAll('#chimp-grid .chimp-cell.has-number').forEach((c) => {
        c.classList.remove('chimp-hidden');
      });

      if (this.lives <= 0) {
        setTimeout(() => this.handleGameOver(), 700);
      } else {
        this.btnAction.style.display = 'block';
        this.btnAction.textContent = `Strike! (${this.lives} ❤️ left) - Try Again`;
      }
    }

    handleLevelWin() {
      this.app.sfx.levelUp();
      this.level++;
      if (this.level % 2 === 1 && this.numCount < 16) {
        this.numCount++;
      }

      const cStats = this.app.stats.data.chimp;
      if (this.level - 1 > cStats.bestLevel) {
        cStats.bestLevel = this.level - 1;
        this.app.stats.save();
        this.updateBestDisplay();
      }

      this.btnAction.style.display = 'block';
      this.btnAction.textContent = `Level ${this.level - 1} Passed! 🚀 Next Level`;
    }

    handleGameOver() {
      const cStats = this.app.stats.data.chimp;
      cStats.totalPlayed++;
      const finalLvl = this.level - 1;
      if (finalLvl > cStats.bestLevel) cStats.bestLevel = finalLvl;
      this.app.stats.save();
      this.updateBestDisplay();

      let badge = 'Sharp Memory 🐒';
      if (finalLvl >= 10) badge = 'Chimpanzee Genius 🧠';
      else if (finalLvl >= 6) badge = 'Expert Recall ⚡';

      this.app.showGameOverModal({
        title: 'Chimp Test Ended',
        score: `Level ${finalLvl}`,
        best: `Level ${cStats.bestLevel}`,
        badge: badge,
        desc: `You accurately recalled ${this.numCount} scattered items in sequence!`,
      });
    }

    updateLivesDisplay() {
      this.livesDisplay.innerHTML = '❤️'.repeat(Math.max(0, this.lives));
    }

    updateBestDisplay() {
      this.bestDisplay.textContent = `Lvl ${this.app.stats.data.chimp.bestLevel}`;
    }
  }

  // ================= GAME 3: PATTERN MEMORY ENGINE =================
  class PatternMemoryEngine {
    constructor(app) {
      this.app = app;
      this.level = 1;
      this.gridDimension = 3;
      this.patternCount = 3;
      this.lives = 3;
      this.activePattern = [];
      this.userSelected = [];
      this.state = 'idle';

      this.initDOM();
      this.bindEvents();
    }

    initDOM() {
      this.grid = document.getElementById('pattern-grid');
      this.levelDisplay = document.getElementById('pattern-level-display');
      this.livesDisplay = document.getElementById('pattern-lives-display');
      this.bestDisplay = document.getElementById('pattern-best-display');
      this.overlay = document.getElementById('pattern-overlay');
      this.instruction = document.getElementById('pattern-instruction-pill');
      this.btnStart = document.getElementById('btn-pattern-start');
      this.btnAction = document.getElementById('btn-pattern-action');
    }

    bindEvents() {
      this.btnStart.addEventListener('click', () => {
        this.overlay.classList.add('hidden');
        this.start();
      });
      this.btnAction.addEventListener('click', () => {
        this.startRound();
      });
    }

    onEnter() {
      this.updateBestDisplay();
      this.overlay.classList.remove('hidden');
    }

    start() {
      this.level = 1;
      this.lives = 3;
      this.updateLivesDisplay();
      this.startRound();
    }

    startRound() {
      this.btnAction.style.display = 'none';
      this.userSelected = [];
      this.levelDisplay.textContent = this.level;

      if (this.level <= 2) {
        this.gridDimension = 3;
        this.patternCount = 2 + this.level;
      } else if (this.level <= 6) {
        this.gridDimension = 4;
        this.patternCount = 3 + (this.level - 2);
      } else {
        this.gridDimension = 5;
        this.patternCount = 6 + (this.level - 6);
      }

      const totalTiles = this.gridDimension * this.gridDimension;
      this.grid.style.gridTemplateColumns = `repeat(${this.gridDimension}, 1fr)`;
      this.grid.style.gridTemplateRows = `repeat(${this.gridDimension}, 1fr)`;
      this.grid.innerHTML = '';

      const indices = Array.from({ length: totalTiles }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      this.activePattern = indices.slice(0, this.patternCount);

      for (let i = 0; i < totalTiles; i++) {
        const tile = document.createElement('div');
        tile.className = 'pattern-tile';
        tile.dataset.index = i;

        tile.addEventListener('click', () => this.handleTileClick(tile, i));
        this.grid.appendChild(tile);
      }

      this.state = 'flash';
      this.instruction.textContent = '👀 Remember the pattern!';
      this.instruction.style.color = '#facc15';

      setTimeout(() => {
        const tiles = document.querySelectorAll('#pattern-grid .pattern-tile');
        this.activePattern.forEach((idx) => {
          tiles[idx].classList.add('pattern-lit');
        });
        this.app.sfx.playTone(440, 'triangle', 0.2, 0.2);

        setTimeout(() => {
          this.activePattern.forEach((idx) => {
            tiles[idx].classList.remove('pattern-lit');
          });
          this.state = 'input';
          this.instruction.textContent = `🎯 Recreate pattern (${this.patternCount} tiles)`;
          this.instruction.style.color = '#4ade80';
        }, 1600);
      }, 500);
    }

    handleTileClick(tile, index) {
      if (this.state !== 'input') return;
      if (this.userSelected.includes(index)) return;

      if (this.activePattern.includes(index)) {
        this.userSelected.push(index);
        this.app.sfx.tapCorrect(this.userSelected.length);
        tile.classList.add('pattern-correct');

        if (this.userSelected.length === this.activePattern.length) {
          this.handleLevelWin();
        }
      } else {
        this.app.sfx.tapWrong();
        tile.classList.add('pattern-wrong');
        this.lives--;
        this.updateLivesDisplay();

        const tiles = document.querySelectorAll('#pattern-grid .pattern-tile');
        this.activePattern.forEach((idx) => {
          tiles[idx].classList.add('pattern-correct');
        });

        if (this.lives <= 0) {
          setTimeout(() => this.handleGameOver(), 700);
        } else {
          this.btnAction.style.display = 'block';
          this.btnAction.textContent = `Strike! (${this.lives} ❤️ left) - Try Again`;
        }
      }
    }

    handleLevelWin() {
      this.app.sfx.levelUp();
      this.level++;
      const pStats = this.app.stats.data.pattern;
      if (this.level - 1 > pStats.bestLevel) {
        pStats.bestLevel = this.level - 1;
        this.app.stats.save();
        this.updateBestDisplay();
      }

      this.btnAction.style.display = 'block';
      this.btnAction.textContent = `Level ${this.level - 1} Clear! 🚀 Next Level`;
    }

    handleGameOver() {
      const pStats = this.app.stats.data.pattern;
      pStats.totalPlayed++;
      const finalLvl = this.level - 1;
      if (finalLvl > pStats.bestLevel) pStats.bestLevel = finalLvl;
      this.app.stats.save();
      this.updateBestDisplay();

      let badge = 'Spatial Prodigy 🧩';
      if (finalLvl >= 8) badge = 'Master Architect ⚡';
      else if (finalLvl >= 4) badge = 'Solid Visualizer 🎯';

      this.app.showGameOverModal({
        title: 'Pattern Memory Ended',
        score: `Level ${finalLvl}`,
        best: `Level ${pStats.bestLevel}`,
        badge: badge,
        desc: `You accurately recalled ${this.patternCount} complex matrix positions!`,
      });
    }

    updateLivesDisplay() {
      this.livesDisplay.innerHTML = '❤️'.repeat(Math.max(0, this.lives));
    }

    updateBestDisplay() {
      this.bestDisplay.textContent = `Lvl ${this.app.stats.data.pattern.bestLevel}`;
    }
  }

  // ================= GAME 4: SEQUENCE RECALL (SIMON) ENGINE =================
  class SequenceRecallEngine {
    constructor(app) {
      this.app = app;
      this.sequence = [];
      this.stepIndex = 0;
      this.score = 0;
      this.state = 'idle';

      this.initDOM();
      this.bindEvents();
    }

    initDOM() {
      this.pads = document.querySelectorAll('.simon-pad');
      this.scoreDisplay = document.getElementById('sequence-score-display');
      this.turnPill = document.getElementById('sequence-turn-pill');
      this.bestDisplay = document.getElementById('sequence-best-display');
      this.overlay = document.getElementById('sequence-overlay');
      this.centerText = document.getElementById('simon-center-text');
      this.btnStart = document.getElementById('btn-sequence-start');
      this.btnRestart = document.getElementById('btn-sequence-restart');
    }

    bindEvents() {
      this.btnStart.addEventListener('click', () => {
        this.overlay.classList.add('hidden');
        this.start();
      });
      this.btnRestart.addEventListener('click', () => this.start());

      this.pads.forEach((pad) => {
        pad.addEventListener('click', () => {
          const padId = parseInt(pad.getAttribute('data-pad'), 10);
          this.handlePadInput(padId);
        });
      });
    }

    onEnter() {
      this.updateBestDisplay();
      this.overlay.classList.remove('hidden');
    }

    start() {
      this.sequence = [];
      this.score = 0;
      this.scoreDisplay.textContent = '0';
      this.centerText.textContent = '0';
      this.nextRound();
    }

    nextRound() {
      this.scoreDisplay.textContent = this.score;
      this.centerText.textContent = this.score;
      const nextPad = Math.floor(Math.random() * 4);
      this.sequence.push(nextPad);
      this.playSequence();
    }

    playSequence() {
      this.state = 'playing_seq';
      this.turnPill.textContent = '👀 Watch!';
      this.turnPill.classList.remove('turn-user');

      let i = 0;
      const speed = Math.max(300, 650 - (this.score * 25));

      const interval = setInterval(() => {
        if (i >= this.sequence.length) {
          clearInterval(interval);
          this.startUserTurn();
          return;
        }

        const padId = this.sequence[i];
        this.flashPad(padId, speed * 0.6);
        i++;
      }, speed);
    }

    flashPad(padId, duration = 300) {
      const pad = this.pads[padId];
      if (!pad) return;

      pad.classList.add('pad-active');
      this.app.sfx.simonNote(padId);

      setTimeout(() => {
        pad.classList.remove('pad-active');
      }, duration);
    }

    startUserTurn() {
      this.state = 'user_turn';
      this.stepIndex = 0;
      this.turnPill.textContent = '👆 Your Turn!';
      this.turnPill.classList.add('turn-user');
    }

    handlePadInput(padId) {
      if (this.state !== 'user_turn') return;

      this.flashPad(padId, 220);

      if (padId === this.sequence[this.stepIndex]) {
        this.stepIndex++;

        if (this.stepIndex >= this.sequence.length) {
          this.state = 'playing_seq';
          this.score++;
          this.app.sfx.levelUp();

          const sStats = this.app.stats.data.sequence;
          if (this.score > sStats.bestStreak) {
            sStats.bestStreak = this.score;
            this.app.stats.save();
            this.updateBestDisplay();
          }

          setTimeout(() => this.nextRound(), 900);
        }
      } else {
        this.handleGameOver();
      }
    }

    handleGameOver() {
      this.state = 'idle';
      this.app.sfx.tapWrong();
      this.turnPill.textContent = '❌ Miss!';
      this.turnPill.classList.remove('turn-user');

      const sStats = this.app.stats.data.sequence;
      sStats.totalPlayed++;
      if (this.score > sStats.bestStreak) sStats.bestStreak = this.score;
      this.app.stats.save();
      this.updateBestDisplay();

      let badge = 'Rhythm Master 🎵';
      if (this.score >= 12) badge = 'Symphonic Genius 🌟';
      else if (this.score >= 6) badge = 'Great Auditory Span ⚡';

      this.app.showGameOverModal({
        title: 'Sequence Ended',
        score: `${this.score} pts`,
        best: `${sStats.bestStreak} pts`,
        badge: badge,
        desc: `You flawlessly remembered a sequence of ${this.score} continuous steps!`,
      });
    }

    updateBestDisplay() {
      this.bestDisplay.textContent = `${this.app.stats.data.sequence.bestStreak} pts`;
    }
  }

  // ================= BOOTSTRAP APP ON DOM LOAD =================
  document.addEventListener('DOMContentLoaded', () => {
    window.brainHub = new BrainHubApp();
  });
})();
