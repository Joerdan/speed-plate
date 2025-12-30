/**
 * SPEED PLATE
 * A Reaction & Memory Game
 */

const GameState = {
    settings: {
        exposureTime: 1000,
        difficulty: 'medium',
        autoLevel: true,
        custom: {
            letters: true,
            numbers: true,
            dash: false,
            length: 7
        }
    },
    currentMode: 'classic', // 'classic' or 'competitive'
    classicStats: {
        score: 0,
        level: 1,
        totalPlayed: 0,
        consecutiveWins: 0,
        currentStreak: 0,
        bestStreak: 0,
        highScore: 0
    },
    competitiveStats: {
        score: 0,
        level: 1,
        totalPlayed: 0,
        consecutiveWins: 0,
        lives: 3
    },
    currentPlate: '',
    isPlaying: false,
    isProcessing: false, // LOCK INPUT
    audio: null
};

// Helper to get current stats
function getCurrentStats() {
    return GameState.currentMode === 'competitive' ? GameState.competitiveStats : GameState.classicStats;
}

class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Default volume
        this.masterGain.connect(this.ctx.destination);
    }

    playTone(freq, type, duration, vol = 1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playEngineStart() {
        // Drone effect
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 2);
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 1);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 3);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 3);
    }

    playFlash() {
        this.playTone(800, 'sine', 0.1, 0.5);
    }

    playSuccess() {
        // Major chord arpeggio
        const now = this.ctx.currentTime;
        [440, 554, 659].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.3), i * 50);
        });
    }

    playFailure() {
        this.playTone(150, 'sawtooth', 0.5, 0.5);
        this.playTone(100, 'sawtooth', 0.5, 0.5);
    }

    playLevelUp() {
        // Rising slide
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }
}

// DOM Elements
const ui = {
    screens: {
        start: document.getElementById('start-screen'),
        game: document.getElementById('game-screen'),
        result: document.getElementById('result-screen')
    },
    plate: {
        container: document.getElementById('license-plate'),
        text: document.getElementById('plate-text'),
        timer: document.getElementById('timer-bar'),
        inputArea: document.getElementById('input-area'),
        input: document.getElementById('user-guess'),
        feedback: document.getElementById('feedback')
    },
    countdown: document.getElementById('countdown-overlay'),
    stats: {
        score: document.getElementById('score-display'),
        level: document.getElementById('current-level'),
        streak: document.getElementById('streak-display'),
        highScore: document.getElementById('highscore-display'),
        streakContainer: document.getElementById('streak-container'),
        highScoreContainer: document.getElementById('highscore-container'),
        livesContainer: document.getElementById('lives-container'),
        lives: document.getElementById('lives-display'),
        finalScore: document.getElementById('final-score')
    },
    buttons: {
        startClassic: document.getElementById('start-classic-btn'),
        startSurvival: document.getElementById('start-survival-btn'),
        restart: document.getElementById('restart-btn'),
        backToMenu: document.getElementById('back-to-menu-btn'),
        settings: document.getElementById('settings-btn'),
        closeSettings: document.getElementById('close-settings'),
        reset: document.getElementById('reset-stats')
    },
    modals: {
        settings: document.getElementById('settings-modal')
    },
    forms: {
        exposure: document.getElementById('exposure-time'),
        exposureDisplay: document.getElementById('exposure-value'),
        difficulty: document.getElementById('difficulty-select'),
        autoLevel: document.getElementById('auto-level'),
        // Custom
        customPanel: document.getElementById('custom-settings-panel'),
        cLetters: document.getElementById('custom-letters'),
        cNumbers: document.getElementById('custom-numbers'),
        cDash: document.getElementById('custom-dash'),
        cLength: document.getElementById('custom-length'),
        cLengthVal: document.getElementById('custom-length-val')
    }
};

/**
 * INIT & EVENT LISTENERS
 */
function init() {
    loadSettings();
    updateUI();

    // Button Events
    ui.buttons.startClassic.addEventListener('click', () => startGame('medium'));
    ui.buttons.startSurvival.addEventListener('click', () => startGame('competitive'));
    ui.buttons.restart.addEventListener('click', () => {
        switchScreen('start');
        resetStats();
    });
    ui.buttons.backToMenu.addEventListener('click', () => {
        switchScreen('start');
        ui.buttons.backToMenu.classList.add('hidden');
    });
    ui.buttons.settings.addEventListener('click', () => toggleModal(ui.modals.settings, true));
    ui.buttons.closeSettings.addEventListener('click', () => toggleModal(ui.modals.settings, false));
    ui.buttons.reset.addEventListener('click', resetStats);

    // Settings Inputs
    ui.forms.exposure.addEventListener('input', (e) => {
        GameState.settings.exposureTime = parseInt(e.target.value);
        ui.forms.exposureDisplay.textContent = `${GameState.settings.exposureTime}ms`;
        saveSettings();
    });

    ui.forms.difficulty.addEventListener('change', (e) => {
        GameState.settings.difficulty = e.target.value;
        toggleCustomPanel(e.target.value === 'custom');
        saveSettings();
    });

    ui.forms.autoLevel.addEventListener('change', (e) => {
        GameState.settings.autoLevel = e.target.checked;
        saveSettings();
    });

    // Custom Inputs
    const updateCustom = () => {
        GameState.settings.custom.letters = ui.forms.cLetters.checked;
        GameState.settings.custom.numbers = ui.forms.cNumbers.checked;
        GameState.settings.custom.dash = ui.forms.cDash.checked;
        GameState.settings.custom.length = parseInt(ui.forms.cLength.value);

        ui.forms.cLengthVal.textContent = GameState.settings.custom.length;

        // Prevent disabling both
        if (!GameState.settings.custom.letters && !GameState.settings.custom.numbers) {
            ui.forms.cLetters.checked = true;
            GameState.settings.custom.letters = true;
        }

        saveSettings();
    };

    ui.forms.cLetters.addEventListener('change', updateCustom);
    ui.forms.cNumbers.addEventListener('change', updateCustom);
    ui.forms.cDash.addEventListener('change', updateCustom);
    ui.forms.cLength.addEventListener('input', updateCustom);

    // Initial check
    toggleCustomPanel(GameState.settings.difficulty === 'custom');

    // Game Input
    ui.plate.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitGuess();
        }
    });

    // Custom Keyboard for Mobile
    const keyboard = document.getElementById('custom-keyboard');
    if (keyboard) {
        keyboard.addEventListener('click', (e) => {
            const btn = e.target.closest('.key-btn');
            if (!btn) return;

            e.preventDefault();
            const key = btn.dataset.key;
            const action = btn.dataset.action;

            if (action === 'delete') {
                ui.plate.input.value = ui.plate.input.value.slice(0, -1);
            } else if (action === 'enter') {
                submitGuess();
            } else if (key) {
                if (ui.plate.input.value.length < 10) {
                    ui.plate.input.value += key;
                }
            }
        });
    }

    // Prevent native keyboard on mobile
    if (window.innerWidth <= 768) {
        ui.plate.input.addEventListener('focus', (e) => {
            e.target.blur();
        });
    }
}

function toggleModal(modal, show) {
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}


function toggleCustomPanel(show) {
    if (show) ui.forms.customPanel.classList.remove('hidden');
    else ui.forms.customPanel.classList.add('hidden');
}


/**
 * GAME LOGIC
 */
function startGame(mode) {
    if (mode) {
        GameState.settings.difficulty = mode;
        GameState.currentMode = mode === 'competitive' ? 'competitive' : 'classic';
        // Update UI select to match
        ui.forms.difficulty.value = mode;
    }

    // Ensure UI reflects mode (hides/shows lives)
    updateUI();

    // NUCLEAR OPTION: Force hide hearts if not competitive
    if (GameState.settings.difficulty !== 'competitive') {
        ui.stats.livesContainer.classList.add('hidden');
        ui.stats.livesContainer.style.display = 'none';
    } else {
        ui.stats.livesContainer.style.display = '';
    }

    if (!GameState.audio) GameState.audio = new AudioManager();
    if (GameState.audio.ctx.state === 'suspended') GameState.audio.ctx.resume();

    GameState.audio.playEngineStart();

    GameState.isPlaying = true;
    switchScreen('game');
    ui.buttons.backToMenu.classList.remove('hidden');

    // Initial speed set
    updateBackgroundSpeed();

    // Strict Hide Lives initially
    if (GameState.settings.difficulty !== 'competitive') {
        ui.stats.livesContainer.classList.add('hidden');
    }

    // Audio Unlock
    if (GameState.audio.ctx.state === 'suspended') {
        const unlock = () => {
            GameState.audio.ctx.resume();
            document.removeEventListener('click', unlock);
        };
        document.addEventListener('click', unlock);
    }

    startCountdown().then(() => {
        prepareRound();
    });
}

function startCountdown() {
    return new Promise(resolve => {
        let count = 3;
        ui.countdown.classList.remove('hidden');
        ui.countdown.textContent = count;

        // Initial Tone
        if (GameState.audio) GameState.audio.playTone(400, 'sine', 0.1, 0.5);

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                ui.countdown.textContent = count;
                ui.countdown.classList.remove('count-animate');
                void ui.countdown.offsetWidth; // trigger reflow
                ui.countdown.classList.add('count-animate');
                if (GameState.audio) GameState.audio.playTone(400, 'sine', 0.1, 0.5);
            } else {
                clearInterval(interval);
                ui.countdown.textContent = 'GO!';
                ui.countdown.classList.remove('count-animate');
                void ui.countdown.offsetWidth;
                ui.countdown.classList.add('count-animate');
                if (GameState.audio) GameState.audio.playTone(800, 'square', 0.2, 0.5);

                setTimeout(() => {
                    ui.countdown.classList.add('hidden');
                    resolve();
                }, 500);
            }
        }, 800);

        ui.countdown.classList.add('count-animate');
    });
}

function prepareRound() {
    GameState.isProcessing = false; // UNLOCK

    // NUCLEAR: Hide hearts again
    if (GameState.settings.difficulty !== 'competitive') {
        ui.stats.livesContainer.classList.add('hidden');
        ui.stats.livesContainer.style.display = 'none';
    }

    // Reset Input
    ui.plate.input.value = '';
    ui.plate.inputArea.classList.add('hidden');
    ui.plate.feedback.textContent = '';

    // Clean Plate Visuals
    ui.plate.container.classList.remove('plate-success');
    ui.plate.container.classList.add('hidden'); // Ensure hidden before flash

    // Generate Plate
    GameState.currentPlate = generatePlate(GameState.settings.difficulty);
    ui.plate.text.textContent = GameState.currentPlate;

    // Show Plate (Flash)
    ui.plate.container.classList.remove('hidden');

    // Visual Glitch on Reveal
    ui.plate.text.setAttribute('data-text', GameState.currentPlate);
    ui.plate.text.classList.add('glitch');
    if (GameState.audio) GameState.audio.playFlash();

    // Timer Bar Animation
    ui.plate.timer.style.transition = 'none';
    ui.plate.timer.style.width = '100%';
    // Force Reflow
    void ui.plate.timer.offsetWidth;

    ui.plate.timer.style.transition = `width ${GameState.settings.exposureTime}ms linear`;
    ui.plate.timer.style.width = '0%';

    setTimeout(() => {
        ui.plate.text.classList.remove('glitch');
    }, 300);

    // Hide after exposure time
    setTimeout(() => {
        ui.plate.container.classList.add('hidden');
        showInput();
    }, GameState.settings.exposureTime);
}

function showInput() {
    ui.plate.inputArea.classList.remove('hidden');
    ui.plate.input.focus();
}

function generatePlate(difficulty) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';

    const randomChar = () => chars[Math.floor(Math.random() * chars.length)];
    const randomNum = () => nums[Math.floor(Math.random() * nums.length)];

    let plate = '';

    if (difficulty === 'easy') {
        // ABC-123
        for (let i = 0; i < 3; i++) plate += randomChar();
        plate += '-';
        for (let i = 0; i < 3; i++) plate += randomNum();
    } else if (difficulty === 'medium') {
        // ABC-1234
        for (let i = 0; i < 3; i++) plate += randomChar();
        plate += '-';
        for (let i = 0; i < 4; i++) plate += randomNum();
    } else if (difficulty === 'hard') {
        // Hard: Mixed format like 1AB-23C
        // Just random 7 chars with dash
        for (let i = 0; i < 3; i++) plate += Math.random() > 0.5 ? randomChar() : randomNum();
        plate += '-';
        for (let i = 0; i < 3; i++) plate += Math.random() > 0.5 ? randomChar() : randomNum();
    } else if (difficulty === 'competitive') {
        // Start Easy/Medium, get harder?
        // Let's stick to Medium format (standard plate) but speed gets crazy
        for (let i = 0; i < 3; i++) plate += randomChar();
        plate += '-';
        for (let i = 0; i < 4; i++) plate += randomNum();
    } else if (difficulty === 'custom') {
        const { letters, numbers, dash, length } = GameState.settings.custom;
        let pool = '';
        if (letters) pool += chars;
        if (numbers) pool += nums;

        let contentLen = dash ? length - 1 : length;
        if (contentLen < 1) contentLen = 1;

        for (let i = 0; i < contentLen; i++) {
            plate += pool[Math.floor(Math.random() * pool.length)];
        }

        // Add dash in middle if requested and length > 2
        if (dash && length > 2) {
            const mid = Math.floor(contentLen / 2);
            plate = plate.slice(0, mid) + '-' + plate.slice(mid);
        }
    }

    return plate;
}

function submitGuess() {
    if (GameState.isProcessing) return; // PREVENT RACE CONDITION

    const userGuess = ui.plate.input.value.toUpperCase().trim();
    const correct = GameState.currentPlate.toUpperCase().trim();

    // Only lock if we have a result (simple check, empty input might be allowed to retry? 
    // user requirement implies strictness "should not allow you to enter it again")
    if (userGuess.length > 0) {
        GameState.isProcessing = true; // LOCK
        ui.plate.inputArea.classList.add('hidden'); // Hide immediately to prevent spam
    } else {
        return; // Ignore empty
    }

    if (userGuess === correct) {
        handleSuccess();
    } else {
        handleFailure(correct);
    }
}

function handleSuccess() {
    ui.plate.feedback.className = 'feedback-msg success';
    ui.plate.feedback.textContent = 'MATCH VERIFIED';

    // Show Green Plate - ALL GREEN
    const allGreen = GameState.currentPlate.split('').map(char =>
        `<span class="char-correct">${char}</span>`
    ).join('');
    ui.plate.text.innerHTML = allGreen;
    ui.plate.container.classList.remove('hidden');
    ui.plate.container.classList.add('plate-success');
    ui.plate.inputArea.classList.add('hidden');

    if (GameState.audio) GameState.audio.playSuccess();

    // Update Score using current mode's stats
    const stats = getCurrentStats();
    stats.score += calculateScore();
    stats.totalPlayed++;
    stats.consecutiveWins++;

    // Update streak for Classic mode
    if (GameState.currentMode === 'classic') {
        stats.currentStreak++;
        if (stats.currentStreak > stats.bestStreak) {
            stats.bestStreak = stats.currentStreak;
        }
        if (stats.score > stats.highScore) {
            stats.highScore = stats.score;
        }
    }

    // Level Up Logic
    // In Competitive, always auto-level
    const isCompetitive = GameState.settings.difficulty === 'competitive';
    if ((GameState.settings.autoLevel || isCompetitive) && stats.consecutiveWins >= (isCompetitive ? 3 : 5)) {
        levelUp();
    }

    saveStats();
    updateUI();

    // Next Round Delay - COMPLETELY SEPARATE from next round's exposure
    setTimeout(() => {
        ui.plate.container.classList.add('hidden'); // Hide feedback plate first
        setTimeout(() => {
            prepareRound(); // Then start new round
        }, 500); // Small gap
    }, 2000); // 2s to see the green success
}

function levelUp() {
    const stats = getCurrentStats();
    stats.level++;
    stats.consecutiveWins = 0;

    // Decrease exposure time by 10%, min 200ms
    let newTime = Math.floor(GameState.settings.exposureTime * 0.9);
    if (newTime < 200) newTime = 200;

    GameState.settings.exposureTime = newTime;

    // Update UI elements for settings if they are open/cached
    ui.forms.exposure.value = newTime;
    ui.forms.exposureDisplay.textContent = `${newTime}ms`;

    // Notify
    ui.plate.feedback.textContent = `LEVEL UP! SPEED INCREASED!`;
    if (GameState.audio) GameState.audio.playLevelUp();

    updateBackgroundSpeed();
    if (GameState.settings.difficulty !== 'competitive') {
        saveSettings(); // Don't save temp competitive settings as permanent defaults
    }
}

function updateBackgroundSpeed() {
    // Basic logic: base overlap is 2s, fastest is 0.2s
    const speed = Math.max(0.2, 2 - (getCurrentStats().level * 0.1)) + 's';
    const grid = document.querySelector('.grid-overlay');
    if (grid) grid.style.animationDuration = speed;
}

function handleFailure(correctAnswer) {
    const userGuess = ui.plate.input.value.toUpperCase().trim();

    ui.plate.feedback.className = 'feedback-msg error';
    ui.plate.feedback.textContent = `MISMATCH!`; // Simplified msg, visual plate shows truth

    // Show visual diff on plate
    ui.plate.text.innerHTML = generateFeedbackHTML(correctAnswer, userGuess);
    ui.plate.container.classList.remove('hidden');
    ui.plate.inputArea.classList.add('hidden'); // Hide input to focus on plate

    if (GameState.audio) GameState.audio.playFailure();

    // Competitive Logic
    if (GameState.settings.difficulty === 'competitive') {
        const stats = getCurrentStats();
        stats.lives--;
        updateHearts();

        if (stats.lives <= 0) {
            setTimeout(handleGameOver, 2000);
            return;
        }
    }

    const stats = getCurrentStats();
    stats.totalPlayed++;
    stats.consecutiveWins = 0;

    // Reset streak for Classic mode
    if (GameState.currentMode === 'classic') {
        stats.currentStreak = 0;
    }

    saveStats();

    // SEPARATE timing: Hide plate, then start new round
    setTimeout(() => {
        ui.plate.container.classList.add('hidden');
        setTimeout(() => {
            prepareRound();
        }, 500);
    }, 2500); // 2.5s to see the diff
}

function generateFeedbackHTML(correct, guess) {
    let html = '';
    // Iterate through correct string
    for (let i = 0; i < correct.length; i++) {
        const cChar = correct[i];
        const gChar = guess[i] || ''; // Empty if short

        if (cChar === gChar) {
            html += `<span class="char-correct">${cChar}</span>`;
        } else {
            html += `<span class="char-wrong">${cChar}</span>`;
        }
    }
    return html;
}

function handleGameOver() {
    switchScreen('result');
    const stats = getCurrentStats();
    ui.stats.finalScore.textContent = stats.score;
    // Don't save stats here properly resets elsewhere, maybe save high score later
}

function updateHearts() {
    const stats = getCurrentStats();
    const hearts = ui.stats.lives.querySelectorAll('.heart');
    hearts.forEach((h, i) => {
        if (i < stats.lives) h.classList.add('active');
        else h.classList.remove('active');
    });
}

function calculateScore() {
    // Basic score based on speed (exposure time)
    // Faster exposure = Higher score
    const base = 100;
    const multiplier = 3000 / GameState.settings.exposureTime;
    return Math.floor(base * multiplier);
}

function switchScreen(screenName) {
    Object.values(ui.screens).forEach(s => s.classList.add('hidden'));
    ui.screens[screenName].classList.remove('hidden');
}


/**
 * DATA PERSISTENCE
 */
function saveSettings() {
    localStorage.setItem('speedplate_settings', JSON.stringify(GameState.settings));
}

function loadSettings() {
    const saved = localStorage.getItem('speedplate_settings');
    if (saved) {
        const parsed = JSON.parse(saved);
        GameState.settings = { ...GameState.settings, ...parsed };

        ui.forms.exposure.value = GameState.settings.exposureTime;
        ui.forms.exposureDisplay.textContent = `${GameState.settings.exposureTime}ms`;
        ui.forms.difficulty.value = GameState.settings.difficulty;
        ui.forms.autoLevel.checked = GameState.settings.autoLevel;

        if (GameState.settings.custom) {
            ui.forms.cLetters.checked = GameState.settings.custom.letters;
            ui.forms.cNumbers.checked = GameState.settings.custom.numbers;
            ui.forms.cDash.checked = GameState.settings.custom.dash;
            ui.forms.cLength.value = GameState.settings.custom.length;
            ui.forms.cLengthVal.textContent = GameState.settings.custom.length;
        }

        toggleCustomPanel(GameState.settings.difficulty === 'custom');
    }

    // Load separate stats for each mode
    const classicStats = localStorage.getItem('speedplate_classic_stats');
    if (classicStats) {
        GameState.classicStats = { ...GameState.classicStats, ...JSON.parse(classicStats) };
    }

    const competitiveStats = localStorage.getItem('speedplate_competitive_stats');
    if (competitiveStats) {
        GameState.competitiveStats = { ...GameState.competitiveStats, ...JSON.parse(competitiveStats) };
    }
}

function saveStats() {
    const key = GameState.currentMode === 'competitive' ? 'speedplate_competitive_stats' : 'speedplate_classic_stats';
    localStorage.setItem(key, JSON.stringify(getCurrentStats()));
}

function resetStats() {
    if (GameState.currentMode === 'competitive') {
        GameState.competitiveStats = { score: 0, level: 1, totalPlayed: 0, consecutiveWins: 0, lives: 3 };
        GameState.settings.exposureTime = 1000;
        ui.forms.exposure.value = 1000;
        ui.forms.exposureDisplay.textContent = '1000ms';
    } else {
        GameState.classicStats = { score: 0, level: 1, totalPlayed: 0, consecutiveWins: 0, currentStreak: 0, bestStreak: 0, highScore: 0 };
    }

    saveStats();
    updateUI();
}

function updateUI() {
    const stats = getCurrentStats();
    ui.stats.score.textContent = stats.score;
    ui.stats.level.textContent = stats.level;

    // Show/hide streak and high score for Classic mode
    const isClassic = GameState.currentMode === 'classic';
    if (isClassic) {
        ui.stats.streakContainer.style.display = '';
        ui.stats.highScoreContainer.style.display = '';
        ui.stats.streak.textContent = stats.currentStreak || 0;
        ui.stats.highScore.textContent = stats.highScore || 0;
    } else {
        ui.stats.streakContainer.style.display = 'none';
        ui.stats.highScoreContainer.style.display = 'none';
    }

    // Strict Mode Check with NUCLEAR option
    const isCompetitive = GameState.settings.difficulty === 'competitive';
    if (isCompetitive) {
        ui.stats.livesContainer.classList.remove('hidden');
        ui.stats.livesContainer.style.display = '';
        updateHearts();
    } else {
        ui.stats.livesContainer.classList.add('hidden');
        ui.stats.livesContainer.style.display = 'none';
    }
}


// Start
init();
