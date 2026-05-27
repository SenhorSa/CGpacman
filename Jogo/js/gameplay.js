// gameplay.js
// Responsible for the core game mechanics that happen every frame.
//
// This module manages:
//   - Ghost mode switching (roam vs chase) driven by a coin-flip animation
//   - Power mode: activated by eating a glowing power coin; makes ghosts flee
//     and awards bonus points for each ghost eaten during the window
//   - Collision detection between the player and ghosts
//   - The coin-flip widget: a small 3D CSS animation of a flipping coin that
//     visually reveals whether ghosts will roam or chase next
//
// None of these functions know about the 3D renderer. They work with plain
// numbers, state objects, and a few DOM elements.

// ─────────────────────────────────────────────────────────────
// COIN FLIP WIDGET
// A small HTML div styled to look like a coin that flips in 3D
// (CSS perspective + rotateY) to reveal the next ghost mode.
// Front face shows "P" (perseguir = chase), back face shows "V" (vaguear = roam).
// ─────────────────────────────────────────────────────────────

/**
 * Creates the coin-flip widget as DOM elements and appends it to the page.
 * The widget is hidden by default and shown only during a flip event.
 *
 * @returns {{
 *   coinWrapper: HTMLElement,
 *   coinInner:   HTMLElement
 * }}
 */
export function createCoinFlipWidget() {
    // Outer container — provides the CSS perspective (depth effect)
    const coinWrapper = document.createElement('div');
    coinWrapper.style.position   = 'fixed';
    coinWrapper.style.top        = '8px';
    coinWrapper.style.left       = '50%';
    coinWrapper.style.transform  = 'translateX(-50%)';
    coinWrapper.style.width      = '52px';
    coinWrapper.style.height     = '52px';
    coinWrapper.style.perspective = '600px';
    coinWrapper.style.zIndex     = '10';
    coinWrapper.style.display    = 'none';  // hidden until a flip event occurs

    // Inner container — this is the element that actually rotates
    const coinInner = document.createElement('div');
    coinInner.style.width          = '100%';
    coinInner.style.height         = '100%';
    coinInner.style.position       = 'relative';
    coinInner.style.transformStyle = 'preserve-3d';    // children maintain 3D positions
    coinInner.style.transform      = 'rotateY(0deg)';

    // Shared style for both coin faces
    const faceStyle = {
        position:           'absolute',
        inset:              '0',
        display:            'flex',
        alignItems:         'center',
        justifyContent:     'center',
        background:         '#f8fafc',
        border:             '2px solid #0f172a',
        borderRadius:       '50%',
        color:              '#0f172a',
        fontWeight:         '700',
        fontSize:           '20px',
        backfaceVisibility: 'hidden'   // each face is invisible when facing away from camera
    };

    // Front face: shows 'P' (Perseguir = Chase)
    const coinFront = document.createElement('div');
    coinFront.textContent = 'P';
    Object.assign(coinFront.style, faceStyle);

    // Back face: shows 'V' (Vaguear = Roam)
    // Starts rotated 180° so it begins facing away (invisible when coin is unflipped)
    const coinBack = document.createElement('div');
    coinBack.textContent = 'V';
    Object.assign(coinBack.style, { ...faceStyle, transform: 'rotateY(180deg)' });

    coinInner.appendChild(coinFront);
    coinInner.appendChild(coinBack);
    coinWrapper.appendChild(coinInner);
    document.body.appendChild(coinWrapper);

    return { coinWrapper, coinInner };
}

// ─────────────────────────────────────────────────────────────
// GHOST MODE STATE
// Tracks whether ghosts are currently roaming (wandering randomly)
// or chasing (actively hunting the player).
// ─────────────────────────────────────────────────────────────

/**
 * Creates the mutable ghost-mode state.
 * chaseWeight is the probability (0–1) that the next flip lands on Chase.
 * It self-adjusts after each flip (same result → same weight, different → reset to 50%).
 *
 * @param {object} coinFlipSettings - Configuration object with weightStep, minWeight, maxWeight.
 * @returns {{
 *   ghostMode:   string,
 *   chaseWeight: number,
 *   coinRotation: number,
 *   flipAnimationId: number | null,
 *   flipTimeoutId:   number | null
 * }}
 */
export function createGhostModeState(coinFlipSettings) {
    return {
        ghostMode:       'roam',   // current mode: 'roam' or 'chase'
        chaseWeight:     0.5,      // probability of landing on chase (50% at start)
        coinRotation:    0,        // current CSS rotation angle of the coin, in degrees
        flipAnimationId: null,     // requestAnimationFrame handle for the flip animation
        flipTimeoutId:   null      // setTimeout handle for the reveal delay
    };
}

/**
 * Randomly selects the next ghost mode and adjusts the chase weight for the future.
 * If the result is the same as before, the same-side probability decreases slightly
 * (coin is less likely to land the same way again). If different, weight resets to 50%.
 *
 * @param {object} ghostModeState   - The mutable state object from createGhostModeState().
 * @param {object} coinFlipSettings - Settings with weightStep, minWeight, maxWeight.
 * @returns {'roam' | 'chase'}      - The newly selected mode.
 */
export function pickNextGhostMode(ghostModeState, coinFlipSettings) {
    const roll     = Math.random();
    const nextMode = roll < ghostModeState.chaseWeight ? 'chase' : 'roam';

    if (nextMode !== ghostModeState.ghostMode) {
        // Different result from before — reset to fair 50/50 odds
        ghostModeState.chaseWeight = 0.5;
    } else if (nextMode === 'chase') {
        // Chase again — make chase slightly less likely next time
        ghostModeState.chaseWeight = Math.max(
            coinFlipSettings.minWeight,
            ghostModeState.chaseWeight - coinFlipSettings.weightStep
        );
    } else {
        // Roam again — make roam slightly less likely next time
        ghostModeState.chaseWeight = Math.min(
            coinFlipSettings.maxWeight,
            ghostModeState.chaseWeight + coinFlipSettings.weightStep
        );
    }

    ghostModeState.ghostMode = nextMode;
    return nextMode;
}

// ─────────────────────────────────────────────────────────────
// COIN FLIP ANIMATION
// Uses requestAnimationFrame to smoothly spin the coin from its
// current rotation to the target rotation over ~1.5 seconds.
// ─────────────────────────────────────────────────────────────

/**
 * Animates the coin spinning from its current angle to targetDegrees.
 * Uses a cubic ease-out curve so the coin decelerates smoothly.
 * After the spin, waits resultHoldMs before hiding the coin.
 *
 * @param {HTMLElement} coinInner        - The inner div that gets the CSS rotation.
 * @param {HTMLElement} coinWrapper      - The outer div (hidden after spin).
 * @param {object}      ghostModeState   - State object — coinRotation and flipAnimationId are updated.
 * @param {number}      targetDegrees    - Final rotation angle in degrees.
 * @param {object}      coinFlipSettings - Settings with flipDurationMs and resultHoldMs.
 */
export function animateCoinFlip(coinInner, coinWrapper, ghostModeState, targetDegrees, coinFlipSettings) {
    // Cancel any flip animation still in progress
    if (ghostModeState.flipAnimationId) {
        cancelAnimationFrame(ghostModeState.flipAnimationId);
    }

    const startRotation = ghostModeState.coinRotation;
    const startTime     = performance.now();
    const duration      = coinFlipSettings.flipDurationMs;

    // This inner function runs every animation frame until the flip is complete
    function animateFrame(currentTime) {
        const progress = Math.min((currentTime - startTime) / duration, 1);

        // Cubic ease-out: starts fast, slows down at the end (like a real coin)
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentAngle = startRotation + (targetDegrees - startRotation) * eased;
        coinInner.style.transform = `rotateY(${currentAngle}deg)`;

        if (progress < 1) {
            // Still animating — request the next frame
            ghostModeState.flipAnimationId = requestAnimationFrame(animateFrame);
            return;
        }

        // Animation complete — snap to exact final angle and schedule hide
        ghostModeState.coinRotation = targetDegrees % 360;
        coinInner.style.transform = `rotateY(${ghostModeState.coinRotation}deg)`;
        setTimeout(() => {
            coinWrapper.style.display = 'none';
        }, coinFlipSettings.resultHoldMs);
        ghostModeState.flipAnimationId = null;
    }

    ghostModeState.flipAnimationId = requestAnimationFrame(animateFrame);
}

/**
 * Triggers one full coin-flip cycle: picks the next ghost mode, shows the coin,
 * waits briefly (revealDelayMs), then animates the flip to land on the correct face.
 *
 * Does nothing if power mode is active (flipping would be confusing during flee mode)
 * or if the game is not in the 'playing' state.
 *
 * @param {object}      ghostModeState   - Mutable state object from createGhostModeState().
 * @param {object}      coinFlipSettings - All timing settings.
 * @param {object}      powerState       - Power mode state — checked for .active flag.
 * @param {object}      gameState        - Game state — checked for .status === 'playing'.
 * @param {HTMLElement} coinWrapper      - Outer coin div (shown/hidden here).
 * @param {HTMLElement} coinInner        - Inner coin div (rotated here).
 */
export function triggerCoinFlipCycle(ghostModeState, coinFlipSettings, powerState, gameState, coinWrapper, coinInner) {
    if (powerState.active || gameState.status !== 'playing') {
        return;
    }

    const nextMode = pickNextGhostMode(ghostModeState, coinFlipSettings);

    // Face at 0°   = front ('P' = chase)
    // Face at 180° = back  ('V' = roam)
    // Adding 720° (two full spins) makes the coin visibly spin before settling
    const finalFaceAngle = nextMode === 'chase' ? 0 : 180;
    const targetRotation = finalFaceAngle + 720;

    // Show the coin immediately
    coinWrapper.style.display = 'block';

    // Clear any pending flip that hasn't started yet
    if (ghostModeState.flipTimeoutId) {
        clearTimeout(ghostModeState.flipTimeoutId);
    }

    // Wait briefly before starting the spin (the coin is visible but still)
    ghostModeState.flipTimeoutId = setTimeout(() => {
        animateCoinFlip(coinInner, coinWrapper, ghostModeState, targetRotation, coinFlipSettings);
    }, coinFlipSettings.revealDelayMs);
}

// ─────────────────────────────────────────────────────────────
// POWER MODE
// Activated when the player touches a glowing power coin.
// For powerModeSettings.durationMs milliseconds, ghosts flee instead of
// chasing, and eating a ghost gives escalating bonus points.
// ─────────────────────────────────────────────────────────────

/**
 * Creates the mutable power-mode state.
 *
 * @returns {{
 *   active:      boolean,
 *   expiresAt:   number,
 *   eatStreak:   number
 * }}
 */
export function createPowerModeState() {
    return {
        active:    false,   // whether power mode is currently running
        expiresAt: 0,       // performance.now() timestamp when power mode ends
        eatStreak: 0        // number of ghosts eaten during this power mode (affects bonus)
    };
}

/**
 * Activates power mode: sets the expiry timestamp, makes all living ghosts scared,
 * hides the coin flip widget, and shows the countdown timer.
 *
 * @param {number}        now               - Current performance.now() timestamp.
 * @param {object}        powerState        - Mutable state from createPowerModeState().
 * @param {object}        powerModeSettings - Settings with durationMs.
 * @param {object}        ghostModeState    - Mutable state — flipTimeoutId is cleared.
 * @param {THREE.Object3D[]} ghosts         - All 3D ghost objects in the scene.
 * @param {THREE.Object3D[]} ghost2DModels  - All flat 2D ghost objects in the scene.
 * @param {HTMLElement}   coinWrapper       - Coin flip widget (hidden during power mode).
 * @param {HTMLElement}   powerTimerElement - Power timer element (shown during power mode).
 * @param {Function}      setGhostState     - Function to change a 3D ghost's visual state.
 * @param {Function}      setGhost2DState   - Function to change a 2D ghost's visual state.
 */
export function activatePowerMode(
    now, powerState, powerModeSettings, ghostModeState,
    ghosts, ghost2DModels,
    coinWrapper, powerTimerElement,
    setGhostState, setGhost2DState
) {
    powerState.active    = true;
    powerState.expiresAt = now + powerModeSettings.durationMs;
    powerState.eatStreak = 0;

    // Hide the coin flip widget — ghost mode doesn't change during power mode
    coinWrapper.style.display = 'none';
    if (ghostModeState.flipTimeoutId) {
        clearTimeout(ghostModeState.flipTimeoutId);
        ghostModeState.flipTimeoutId = null;
    }

    // Show the countdown timer
    if (powerTimerElement) {
        powerTimerElement.classList.remove('is-hidden');
        const valueSpan = powerTimerElement.querySelector('.power-timer__value');
        if (valueSpan) valueSpan.textContent = String(Math.ceil(powerModeSettings.durationMs / 1000));
    }

    // Make all ghosts that are still alive flee (eyes = ghost already eaten, skip)
    for (const ghost of ghosts) {
        if (ghost.userData.state !== 'eyes') {
            setGhostState(ghost, 'scared');
        }
        // Reset direction so ghosts immediately start fleeing instead of finishing old path
        ghost.userData.canTurn  = true;
        ghost.userData.direction = { row: 0, column: 0 };
    }

    // Update the flat 2D ghost sprites to match the scared visual
    ghosts.forEach((ghost, index) => {
        if (ghost.userData.state === 'scared') {
            setGhost2DState(ghost2DModels[index], 'scared', ghost.userData.color);
        }
    });
}

/**
 * Called every frame while power mode is active.
 * Updates the countdown display and deactivates power mode when time runs out.
 *
 * @param {number}        now               - Current performance.now() timestamp.
 * @param {object}        powerState        - Mutable power mode state.
 * @param {HTMLElement}   powerTimerElement - The timer element to update.
 * @param {THREE.Object3D[]} ghosts         - All 3D ghost objects.
 * @param {THREE.Object3D[]} ghost2DModels  - All 2D ghost objects.
 * @param {Function}      setGhostState     - Function to change a 3D ghost's visual state.
 * @param {Function}      setGhost2DState   - Function to change a 2D ghost's visual state.
 */
export function tickPowerMode(
    now, powerState, powerTimerElement,
    ghosts, ghost2DModels,
    setGhostState, setGhost2DState
) {
    if (!powerState.active) return;

    const remainingMs = Math.max(0, powerState.expiresAt - now);

    // Update displayed countdown
    const valueSpan = powerTimerElement?.querySelector('.power-timer__value');
    if (valueSpan) valueSpan.textContent = String(Math.ceil(remainingMs / 1000));

    if (remainingMs > 0) return; // still running

    // Power mode has ended — deactivate
    powerState.active    = false;
    powerState.eatStreak = 0;
    powerTimerElement?.classList.add('is-hidden');

    // Return any scared ghosts back to their normal state
    for (const ghost of ghosts) {
        if (ghost.userData.state === 'scared') {
            setGhostState(ghost, 'normal');
        }
    }
    for (const ghost2d of ghost2DModels) {
        if (ghost2d.userData.state === 'scared') {
            setGhost2DState(ghost2d, 'normal', ghost2d.userData.baseColor);
        }
    }
}

// ─────────────────────────────────────────────────────────────
// COLLISION DETECTION
// ─────────────────────────────────────────────────────────────

/**
 * Finds the index of the first ghost whose body overlaps the player's position.
 * Uses simple circle-circle collision (both the player and ghosts are circular).
 * Returns -1 if no ghost is touching the player.
 *
 * @param {number}  playerX         - Player's world X position.
 * @param {number}  playerZ         - Player's world Z position.
 * @param {number}  playerRadius    - Collision radius of the player.
 * @param {THREE.Object3D[]} ghosts - All ghost objects (have .position and .userData.radius).
 * @returns {number} Index of the colliding ghost, or -1 if none.
 */
export function getCollidingGhostIndex(playerX, playerZ, playerRadius, ghosts) {
    for (let index = 0; index < ghosts.length; index += 1) {
        const ghost     = ghosts[index];
        const ghostRadius = ghost.userData.radius ?? 0;

        const dx = playerX - ghost.position.x;
        const dz = playerZ - ghost.position.z;
        const minimumSeparation = playerRadius + ghostRadius;

        // Squared distance check avoids an expensive square-root operation
        if (dx * dx + dz * dz <= minimumSeparation * minimumSeparation) {
            return index;
        }
    }
    return -1;
}

// ─────────────────────────────────────────────────────────────
// SMOOTH ANGLE ROTATION HELPER
// ─────────────────────────────────────────────────────────────

/**
 * Moves an angle (in radians) from current toward target by at most maxStep radians.
 * Always takes the shortest path around the circle (handles the 0°/360° wrap-around).
 * Used to smoothly rotate the Pacman model to face the direction it is moving.
 *
 * @param {number} currentAngle - The current angle in radians.
 * @param {number} targetAngle  - The desired angle in radians.
 * @param {number} maxStep      - Maximum radians to rotate in one frame.
 * @returns {number} The new angle after stepping toward the target.
 */
export function stepTowardAngle(currentAngle, targetAngle, maxStep) {
    // atan2(sin, cos) gives the shortest signed angular difference in [-π, +π]
    const delta = Math.atan2(
        Math.sin(targetAngle - currentAngle),
        Math.cos(targetAngle - currentAngle)
    );

    if (Math.abs(delta) <= maxStep) {
        return targetAngle; // close enough — snap to target
    }

    return currentAngle + Math.sign(delta) * maxStep;
}
