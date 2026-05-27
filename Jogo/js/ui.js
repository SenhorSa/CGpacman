// ui.js
// Responsible for all on-screen interface elements during gameplay.
//
// This module manages:
//   - The score pill ("Pontos: 120") shown in the top corner
//   - The power-mode countdown timer (appears when a power coin is eaten)
//   - The pause menu (Escape key opens it; has Resume, Controls, Exit)
//   - The game-over screen (shown on win or loss, with final score and rank)
//
// None of these functions touch the 3D scene — they only read and write
// the HTML/CSS of existing DOM elements.

import { saveScore } from './scores.js';

// ─────────────────────────────────────────────────────────────
// SCORE DISPLAY
// ─────────────────────────────────────────────────────────────

/**
 * Creates the score pill element and appends it to the page body.
 * The pill shows the current point total at all times during gameplay.
 *
 * @returns {HTMLElement} The score pill element.
 */
export function createScoreElement() {
    const scoreElement = document.createElement('div');
    scoreElement.className = 'score-pill';
    scoreElement.textContent = 'Pontos: 0';
    document.body.appendChild(scoreElement);
    return scoreElement;
}

/**
 * Updates the text inside the score pill.
 *
 * @param {HTMLElement} scoreElement - The score pill element.
 * @param {number}      value        - The new point total to display.
 */
export function updateScoreDisplay(scoreElement, value) {
    if (!scoreElement) return;
    scoreElement.textContent = `Pontos: ${value}`;
}

// ─────────────────────────────────────────────────────────────
// POWER TIMER
// Appears when the player eats a power coin. Shows a countdown
// in seconds. Disappears when power mode ends.
// ─────────────────────────────────────────────────────────────

/**
 * Creates the power-timer element and appends it to the page body.
 * It starts hidden and is shown by showPowerTimer().
 *
 * @returns {HTMLElement} The power-timer container element.
 */
export function createPowerTimerElement() {
    const timerElement = document.createElement('div');
    timerElement.className = 'power-timer is-hidden';
    timerElement.innerHTML = `
        <span class="power-timer__clock" aria-hidden="true"></span>
        <span class="power-timer__value">10</span>
    `;
    document.body.appendChild(timerElement);
    return timerElement;
}

/**
 * Makes the power timer visible and sets its displayed number of seconds.
 *
 * @param {HTMLElement} timerElement  - The power-timer element.
 * @param {number}      totalSeconds  - How many seconds to display initially.
 */
export function showPowerTimer(timerElement, totalSeconds) {
    if (!timerElement) return;
    timerElement.classList.remove('is-hidden');
    const valueSpan = timerElement.querySelector('.power-timer__value');
    if (valueSpan) valueSpan.textContent = String(Math.ceil(totalSeconds));
}

/**
 * Hides the power timer.
 *
 * @param {HTMLElement} timerElement - The power-timer element.
 */
export function hidePowerTimer(timerElement) {
    if (!timerElement) return;
    timerElement.classList.add('is-hidden');
}

/**
 * Updates the countdown number inside the timer every game frame.
 * Returns true if power mode is still running, false if it has expired.
 *
 * @param {HTMLElement} timerElement   - The power-timer element.
 * @param {number}      remainingMs    - Milliseconds left in power mode.
 * @returns {boolean}  Whether power mode is still active after this tick.
 */
export function tickPowerTimerDisplay(timerElement, remainingMs) {
    if (!timerElement) return false;

    const remainingSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
    const valueSpan = timerElement.querySelector('.power-timer__value');
    if (valueSpan) valueSpan.textContent = String(remainingSeconds);

    if (remainingMs <= 0) {
        hidePowerTimer(timerElement);
        return false; // power mode has ended
    }

    return true; // power mode still running
}

// ─────────────────────────────────────────────────────────────
// PAUSE MENU
// The pause menu is a DOM overlay that slides in on Escape.
// It has multiple sub-views: 'pause-main' and 'pause-controls'.
// ─────────────────────────────────────────────────────────────

/**
 * Reads all pause-menu DOM elements from the page.
 * Returns null for any element that doesn't exist (graceful degradation).
 *
 * @returns {object} Bundle of pause-menu DOM references.
 */
export function getPauseMenuElements() {
    return {
        pauseRoot:            document.getElementById('pause-root'),
        pauseBackButton:      document.getElementById('pause-back'),
        pauseContinueButton:  document.getElementById('pause-continue'),
        pauseControlsButton:  document.getElementById('pause-controls'),
        pauseExitButton:      document.getElementById('pause-exit'),
        pausePanels: (() => {
            const root = document.getElementById('pause-root');
            return root ? Array.from(root.querySelectorAll('[data-view]')) : [];
        })()
    };
}

/**
 * Shows one sub-panel of the pause menu and hides all others.
 * Also shows/hides the back button depending on which panel is active.
 *
 * @param {string}      viewName    - 'pause-main' or 'pause-controls'
 * @param {HTMLElement} pauseRoot   - The pause menu root element.
 * @param {HTMLElement[]} pausePanels - All [data-view] panels inside pauseRoot.
 * @param {HTMLElement} pauseBackButton - The back button inside the pause menu.
 */
export function showPauseSubView(viewName, pauseRoot, pausePanels, pauseBackButton) {
    if (!pauseRoot) return;

    for (const panel of pausePanels) {
        const isTarget = panel.getAttribute('data-view') === viewName;
        panel.classList.toggle('is-hidden', !isTarget);
    }

    // The back button is only needed when NOT on the main pause panel
    if (pauseBackButton) {
        const showBack = viewName !== 'pause-main';
        pauseBackButton.classList.toggle('is-hidden', !showBack);
    }
}

/**
 * Opens the pause menu overlay and freezes player movement.
 * Does nothing if the game is not currently in 'playing' state.
 *
 * @param {object}      gameState   - Mutable state object with a .status string and .pauseStartedAt.
 * @param {object}      controls    - Player movement controls (all set to false to stop movement).
 * @param {HTMLElement} pauseRoot   - The pause root element.
 * @param {HTMLElement[]} pausePanels
 * @param {HTMLElement} pauseBackButton
 */
export function openPauseMenu(gameState, controls, pauseRoot, pausePanels, pauseBackButton) {
    if (!pauseRoot || gameState.status !== 'playing') return;

    gameState.status = 'paused';
    gameState.pauseStartedAt = performance.now();
    pauseRoot.classList.remove('is-hidden');
    showPauseSubView('pause-main', pauseRoot, pausePanels, pauseBackButton);

    // Stop all movement so the player doesn't slide after pausing
    controls.forward  = false;
    controls.backward = false;
    controls.left     = false;
    controls.right    = false;
    controls.dragging = false;
}

/**
 * Closes the pause menu and resumes gameplay.
 * If power mode was active when paused, the power timer is extended
 * by the duration of the pause so the player doesn't lose time unfairly.
 *
 * @param {object}      gameState    - Mutable state object with .status, .pauseStartedAt.
 * @param {object}      powerState   - Mutable object with .active and .expiresAt.
 * @param {HTMLElement} pauseRoot    - The pause root element.
 */
export function closePauseMenu(gameState, powerState, pauseRoot) {
    if (!pauseRoot || gameState.status !== 'paused') return;

    const now = performance.now();

    // Extend power mode deadline by however long the game was paused
    if (powerState.active && gameState.pauseStartedAt > 0) {
        powerState.expiresAt += now - gameState.pauseStartedAt;
    }

    gameState.pauseStartedAt = 0;
    gameState.status = 'playing';
    pauseRoot.classList.add('is-hidden');
}

// ─────────────────────────────────────────────────────────────
// GAME OVER SCREEN
// ─────────────────────────────────────────────────────────────

/**
 * Reads all gameover-screen DOM elements from the page.
 *
 * @returns {object} Bundle of gameover DOM references.
 */
export function getGameoverElements() {
    return {
        gameoverRoot:      document.getElementById('gameover-root'),
        gameoverTitle:     document.getElementById('gameover-title'),
        gameoverScore:     document.getElementById('gameover-score'),
        gameoverNewButton: document.getElementById('gameover-new'),
        gameoverExitButton: document.getElementById('gameover-exit')
    };
}

/**
 * Ends the current game: saves the score, then shows the game-over screen
 * with the appropriate title, final score, and leaderboard rank.
 *
 * @param {'win'|'lose'}  result          - Whether the player won or lost.
 * @param {number}        totalScore      - The player's final score.
 * @param {object}        mapConfig       - The map that was played (needs .id and .name).
 * @param {object}        gameState       - Mutable state — .status is set to 'finished'.
 * @param {object}        powerState      - Mutable state — .active is set to false.
 * @param {HTMLElement}   powerTimerEl    - The power timer element (hidden on game end).
 * @param {HTMLElement}   pauseRoot       - The pause menu (hidden on game end).
 * @param {object}        gameoverEls     - DOM bundle from getGameoverElements().
 */
export function endGame(result, totalScore, mapConfig, gameState, powerState, powerTimerEl, pauseRoot, gameoverEls) {
    // Mark game as finished so the animate loop stops updating gameplay
    gameState.status  = 'finished';
    powerState.active = false;

    // Hide any overlays that might still be visible
    hidePowerTimer(powerTimerEl);
    pauseRoot?.classList.add('is-hidden');

    // Save the score to localStorage and get the player's rank (1-10, or null)
    const rank = saveScore({
        score:   totalScore,
        mapId:   mapConfig.id,
        mapName: mapConfig.name,
        result
    });

    const { gameoverRoot, gameoverTitle, gameoverScore } = gameoverEls;
    if (!gameoverRoot) return;

    // Show win or loss message
    const isWin = result === 'win';
    if (gameoverTitle) {
        gameoverTitle.textContent = isWin ? 'Parabens!! Vitoria' : 'Game Over';
    }

    // Show the score and optionally the leaderboard rank
    if (gameoverScore) {
        const rankText = rank !== null ? `  •  #${rank} no Top 10` : '';
        gameoverScore.textContent = `Pontos: ${totalScore}${rankText}`;
    }

    gameoverRoot.classList.remove('is-hidden');
}
