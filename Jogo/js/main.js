// main.js
// The game's entry point and central orchestrator.
//
// This file's only job is to wire all the pieces together:
// it imports functionality from the other modules, calls them in the
// correct order, and connects their outputs to each other.
// No complex logic lives here — each concern has its own module:
//
//   walllamp.js  → wall lamp creation and placement
//   scene.js     → scene, renderer, cameras, view switching
//   ui.js        → score display, pause menu, game-over screen
//   gameplay.js  → ghost mode, power mode, coin flip, collisions
//   minimap.js   → minimap rendering
//   characters.js → player, ghosts, pacman models, coins (DO NOT EDIT)
//   maze.js       → maze layout and geometry  (DO NOT EDIT)
//   maps.js       → map configurations        (DO NOT EDIT)
//   lights.js     → light registry            (DO NOT EDIT)
//   scores.js     → score persistence         (DO NOT EDIT)

import * as THREE from 'three';
import { createMaze, getCenterMarkerCell, getMazeData } from './maze.js';
import { bindLightNumberKeys, registerLight } from './lights.js';
import {
    MAP_CONFIGS,
    createHedgeWallTexture, createGrassFloorTexture,
    createConcreteWallTexture, createMetalFloorTexture,
    createHotelWallTexture, createHotelFloorTexture
} from './maps.js';
import {
    collectCoins, createCoins,
    createGhosts, createGhosts2D, createPacmanModels, createPlayer,
    playerSettings, isGhostInsideCenterBox,
    setGhost2DState, setGhostState,
    updateCoins, updateGhosts, updatePlayer
} from './characters.js';
import { placeWallLamps }                                         from './walllamp.js';
import { createSceneAndRenderer, setupSunLight, createGameCameras, activatePerspectiveView, activateOrthographicView, handleWindowResize } from './scene.js';
import { createScoreElement, updateScoreDisplay, createPowerTimerElement, getPauseMenuElements, showPauseSubView, openPauseMenu, closePauseMenu, getGameoverElements, endGame } from './ui.js';
import { createCoinFlipWidget, createGhostModeState, triggerCoinFlipCycle, createPowerModeState, activatePowerMode, tickPowerMode, getCollidingGhostIndex, stepTowardAngle } from './gameplay.js';
import { createMinimapRenderer, renderMinimap }                   from './minimap.js';

// ─────────────────────────────────────────────────────────────
// MAZE DIMENSIONS
// Every map uses the same 23×33 grid. The tile size of 1 means
// one tile = one world unit (meter), which makes all positioning simple.
// ─────────────────────────────────────────────────────────────
const MAZE_ROWS    = 23;
const MAZE_COLUMNS = 33;
const TILE_SIZE    = 1;   // one tile = one world unit
const WALL_HEIGHT  = 1;   // walls are 1 unit tall

// ─────────────────────────────────────────────────────────────
// COIN FLIP SETTINGS
// The coin flip controls how often and how smoothly ghost mode switches.
// ─────────────────────────────────────────────────────────────
const COIN_FLIP_SETTINGS = {
    intervalMs:    30000,  // how often the coin flips (every 30 seconds)
    revealDelayMs:   500,  // pause before the coin starts spinning (milliseconds)
    flipDurationMs: 1500,  // how long the spin animation takes
    resultHoldMs:   1500,  // how long the result is shown before the coin disappears
    weightStep:      0.1,  // how much the probability shifts after a repeated result
    minWeight:      0.01,  // chase probability floor (ghosts can always chase occasionally)
    maxWeight:      0.99   // chase probability ceiling
};

// ─────────────────────────────────────────────────────────────
// POWER MODE SETTINGS
// Eating a glowing power coin activates power mode.
// ─────────────────────────────────────────────────────────────
const POWER_MODE_SETTINGS = {
    durationMs:      10000,  // power mode lasts 10 seconds
    baseGhostPoints:    20   // eating the first ghost gives 20 pts; each next gives double
};

// ─────────────────────────────────────────────────────────────
// WALL LAMP PLACEMENTS
// Each entry places a lamp on a specific wall tile facing a specific direction.
// These positions were chosen manually to light the maze corridors evenly.
// { row, column } is a walkable tile; 'wall' is which neighbour wall it mounts on.
// ─────────────────────────────────────────────────────────────
const WALL_LAMP_PLACEMENTS = [
    { row: 1,  column: 3,  wall: 'south' }, { row: 1,  column: 9,  wall: 'north' },
    { row: 1,  column: 20, wall: 'north' }, { row: 1,  column: 26, wall: 'north' },
    { row: 1,  column: 30, wall: 'north' }, { row: 2,  column: 11, wall: 'east'  },
    { row: 2,  column: 17, wall: 'west'  }, { row: 2,  column: 23, wall: 'west'  },
    { row: 3,  column: 7,  wall: 'west'  }, { row: 3,  column: 13, wall: 'east'  },
    { row: 3,  column: 15, wall: 'west'  }, { row: 4,  column: 1,  wall: 'east'  },
    { row: 4,  column: 3,  wall: 'east'  }, { row: 4,  column: 9,  wall: 'west'  },
    { row: 4,  column: 19, wall: 'east'  }, { row: 4,  column: 29, wall: 'west'  },
    { row: 4,  column: 31, wall: 'east'  }, { row: 5,  column: 22, wall: 'north' },
    { row: 5,  column: 25, wall: 'east'  }, { row: 5,  column: 27, wall: 'west'  },
    { row: 7,  column: 7,  wall: 'north' }, { row: 7,  column: 12, wall: 'north' },
    { row: 7,  column: 16, wall: 'north' }, { row: 7,  column: 21, wall: 'north' },
    { row: 9,  column: 13, wall: 'south' }, { row: 9,  column: 15, wall: 'south' },
    { row: 9,  column: 26, wall: 'north' }, { row: 9,  column: 30, wall: 'south' },
    { row: 10, column: 1,  wall: 'east'  }, { row: 11, column: 5,  wall: 'east'  },
    { row: 11, column: 7,  wall: 'west'  }, { row: 11, column: 11, wall: 'east'  },
    { row: 11, column: 17, wall: 'west'  }, { row: 11, column: 21, wall: 'east'  },
    { row: 11, column: 23, wall: 'west'  }, { row: 11, column: 30, wall: 'north' },
    { row: 12, column: 1,  wall: 'east'  }, { row: 13, column: 14, wall: 'north' },
    { row: 14, column: 13, wall: 'east'  }, { row: 14, column: 15, wall: 'west'  },
    { row: 14, column: 25, wall: 'west'  }, { row: 15, column: 1,  wall: 'north' },
    { row: 15, column: 9,  wall: 'east'  }, { row: 15, column: 20, wall: 'north' },
    { row: 15, column: 28, wall: 'south' }, { row: 16, column: 31, wall: 'east'  },
    { row: 17, column: 5,  wall: 'west'  }, { row: 17, column: 10, wall: 'south' },
    { row: 17, column: 26, wall: 'north' }, { row: 19, column: 4,  wall: 'north' },
    { row: 19, column: 15, wall: 'east'  }, { row: 19, column: 17, wall: 'west'  },
    { row: 19, column: 21, wall: 'east'  }, { row: 19, column: 23, wall: 'west'  },
    { row: 19, column: 29, wall: 'west'  }, { row: 20, column: 11, wall: 'east'  },
    { row: 21, column: 1,  wall: 'west'  }, { row: 21, column: 7,  wall: 'south' },
    { row: 21, column: 13, wall: 'west'  }, { row: 21, column: 27, wall: 'south' }
];

// ─────────────────────────────────────────────────────────────
// TEXTURE HELPERS
// Returns the correct wall/floor texture for the selected map.
// Each map config has a textureType field that determines which
// canvas-drawn texture to use.
// ─────────────────────────────────────────────────────────────

function getWallTextureForMap(config) {
    if (config.wallTextureType === 'hedge')    return createHedgeWallTexture();
    if (config.wallTextureType === 'concrete') return createConcreteWallTexture(256);
    return createHotelWallTexture(256);
}

function getFloorTextureForMap(config) {
    if (config.floorTextureType === 'grass') return createGrassFloorTexture(512);
    if (config.floorTextureType === 'metal') return createMetalFloorTexture(512);
    return createHotelFloorTexture(512);
}

// ─────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────

// Prevents startGame from being called more than once
// (clicking a map card twice would otherwise create two games on top of each other)
let gameStarted = false;

/**
 * Starts a new game on the selected map.
 * Called by the menu when the player clicks a map card.
 *
 * @param {object} mapConfig - One of the configurations from MAP_CONFIGS in maps.js.
 */
export function startGame(mapConfig = MAP_CONFIGS.hotel) {
    if (gameStarted) return;
    gameStarted = true;

    const appElement = document.getElementById('app');
    if (!appElement) return;

    // ── STEP 1: Create the 3D scene, renderer, and scene lights ──────────────
    // The scene is the container for all 3D objects.
    // The renderer draws the scene to the browser canvas.

    const { scene, renderer, sceneFog, mainLight } = createSceneAndRenderer(appElement, mapConfig);
    bindLightNumberKeys();  // enables number keys 1–9 to toggle individual lights

    // ── STEP 2: Build the maze geometry and get layout data ──────────────────
    // mazeLayout is a 2D array: 0 = walkable floor, 1 = solid wall.
    // mazeGroup, floor, ceiling are Three.js objects added to the scene.

    const wallTexture   = getWallTextureForMap(mapConfig);
    const floorTexture  = getFloorTextureForMap(mapConfig);

    // Perspective materials: high-quality, affected by lighting
    const wallMaterialPerspective  = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: mapConfig.wallRoughness, metalness: 0.0,
        map: wallTexture ?? null
    });
    const floorMaterialPerspective = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: mapConfig.floorRoughness, metalness: 0.0,
        map: floorTexture ?? null
    });
    const ceilingMaterial = new THREE.MeshStandardMaterial({
        color: mapConfig.ceilingColor ?? 0xede0c8,
        roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide
    });

    // Orthographic materials: simple flat colors, no lighting calculation needed
    const wallMaterialOrthographic  = new THREE.MeshBasicMaterial({
        map: wallTexture ?? null, color: 0xffffff, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const floorMaterialOrthographic = new THREE.MeshBasicMaterial({
        map: floorTexture ?? null, color: 0xffffff, toneMapped: false
    });
    const borderGuideMaterial = new THREE.LineBasicMaterial({ color: 0xe5e7eb });

    // The point light group holds all the wall lamp lights so they can be
    // toggled together as one registered light group
    const pointLightGroup = registerLight('gamePointLights', new THREE.Group());
    scene.add(pointLightGroup);

    const { mazeLayout, mazeGroup, floor, ceiling } = createMaze({
        scene, tileSize: TILE_SIZE, wallHeight: WALL_HEIGHT,
        mazeRows: MAZE_ROWS, mazeColumns: MAZE_COLUMNS,
        materials: { wallMaterialPerspective, floorMaterialPerspective, ceilingMaterial, borderGuideMaterial }
    });

    const { mazeWidth, mazeHeight, mazeCenterX, mazeCenterZ } = getMazeData(mazeLayout, TILE_SIZE);
    const centerMarkerCell = getCenterMarkerCell();  // center tile used as ghost home base

    // ── STEP 3: Position the sun and add its visual ───────────────────────────

    setupSunLight(scene, mainLight, centerMarkerCell, mazeCenterX, mazeCenterZ, mazeWidth, mazeHeight, TILE_SIZE);

    // ── STEP 4: Place wall lamps ──────────────────────────────────────────────
    // Only place lamps if this map uses point lights (intensity > 0)

    if (mapConfig.pointLightIntensity > 0) {
        placeWallLamps({
            mazeLayout, tileSize: TILE_SIZE, wallHeight: WALL_HEIGHT,
            targetGroup: pointLightGroup,
            lightColor:    mapConfig.pointLightColor,
            lightIntensity: mapConfig.pointLightIntensity,
            placements: WALL_LAMP_PLACEMENTS
        });
    }

    // ── STEP 5: Create cameras ────────────────────────────────────────────────

    const { perspectiveCamera, orthographicCamera } = createGameCameras(
        mazeWidth, mazeHeight, mazeCenterX, mazeCenterZ
    );

    // ── STEP 6: Create minimap renderer ──────────────────────────────────────
    // minimapViewSize = how many tiles visible around the player on each side

    const MINIMAP_VIEW_SIZE   = 4;
    const MINIMAP_CAMERA_HEIGHT = 12;
    const { minimapRenderer, minimapCamera, minimapRoot } = createMinimapRenderer(
        MINIMAP_VIEW_SIZE, MINIMAP_CAMERA_HEIGHT
    );

    // ── STEP 7: Create all characters ────────────────────────────────────────

    // Player: sets up movement controls and positions the perspective camera at spawn
    const { controls, spawnCell } = createPlayer({ camera: perspectiveCamera, mazeLayout, tileSize: TILE_SIZE });

    // Enemies: 3D models for the perspective view
    const ghosts = createGhosts({
        scene, mazeLayout, centerMarkerCell,
        tileSize: TILE_SIZE, wallHeight: WALL_HEIGHT,
        enemyType: mapConfig.enemyType
    });

    // Flat 2D enemy sprites for the top-down and minimap views
    const ghost2DGroup  = new THREE.Group();
    scene.add(ghost2DGroup);
    const ghost2DModels = createGhosts2D({ ghosts, tileSize: TILE_SIZE, enemyType: mapConfig.enemyType });
    for (const ghost2D of ghost2DModels) ghost2DGroup.add(ghost2D);

    // Pacman: one 3D model for perspective view, one flat sprite for top-down view
    const { pacman3D, pacman2D } = createPacmanModels({ tileSize: TILE_SIZE });
    scene.add(pacman3D, pacman2D);

    // A simple yellow circle shown only on the minimap (not in either main view)
    const minimapPacman = new THREE.Mesh(
        new THREE.CircleGeometry(TILE_SIZE * 0.22, 20),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    minimapPacman.rotation.x = -Math.PI / 2;
    minimapPacman.visible    = false;
    scene.add(minimapPacman);

    // Small yellow circle on the floor directly under the player (like a spotlight)
    const playerSpotlight = new THREE.Mesh(
        new THREE.CircleGeometry(0.18, 24),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    playerSpotlight.rotation.x = -Math.PI / 2;
    playerSpotlight.position.y  = 0.06;
    scene.add(playerSpotlight);

    // ── STEP 8: Place coins ───────────────────────────────────────────────────
    // Exclude the player's spawn cell and all ghost starting cells from coin placement
    // to prevent coins from spawning inside characters

    const ghostStartCells = ghosts.map(ghost => ({
        row:    Math.round(ghost.position.z / TILE_SIZE),
        column: Math.round(ghost.position.x / TILE_SIZE)
    }));

    const { coins } = createCoins({
        scene, mazeLayout, tileSize: TILE_SIZE,
        excludedCells:   [spawnCell, ...ghostStartCells],
        centerMarkerCell,
        exclusionRadius: 2,    // minimum distance from ghost home for coin placement
        powerCoinCount:  5     // how many glowing power coins to place
    });

    // ── STEP 9: Create UI elements ────────────────────────────────────────────

    const scoreElement      = createScoreElement();
    const powerTimerElement = createPowerTimerElement();
    const pauseElements     = getPauseMenuElements();
    const gameoverElements  = getGameoverElements();

    // ── STEP 10: Create the coin flip widget and ghost mode state ─────────────

    const { coinWrapper, coinInner } = createCoinFlipWidget();
    const ghostModeState = createGhostModeState(COIN_FLIP_SETTINGS);

    // ── STEP 11: Create power mode and game state ─────────────────────────────

    const powerState = createPowerModeState();

    // gameState.status tracks whether the game loop should update gameplay:
    //   'playing'  → normal gameplay
    //   'paused'   → pause menu is open; nothing moves
    //   'finished' → game over; nothing moves
    const gameState  = { status: 'playing', pauseStartedAt: 0 };

    // Tracks which camera and which view mode ('perspective' or 'orthographic') is active.
    // This object is mutated by the view-switching functions in scene.js.
    const activeState = { camera: perspectiveCamera, view: 'perspective' };

    // Running totals updated as the player collects coins and eats ghosts
    let totalScore         = 0;
    let collectedCoinsCount = 0;

    // ── STEP 12: Pacman rotation tracking ────────────────────────────────────
    // These track the current visual rotation of the pacman models so they
    // can smoothly turn to face the direction of movement.

    const lastMoveDirection = new THREE.Vector3(1, 0, 0);  // direction of last movement
    let   pacman3DYaw = Math.PI;  // current Y-axis rotation of the 3D pacman model
    let   pacman2DYaw = 0;        // current Z-axis rotation of the 2D pacman sprite
    const PACMAN_TURN_SPEED = 12; // radians per second — how fast pacman rotates

    // ── STEP 13: Bundle of scene objects used for view switching ─────────────
    // Building this once means we don't have to list all these params every time
    // we call activatePerspectiveView or activateOrthographicView.

    const viewBundle = {
        controls, perspectiveCamera, orthographicCamera,
        minimapRoot,
        floor, floorMaterialPerspective, floorMaterialOrthographic,
        ceiling, mapConfig, sceneFog, scene,
        ghosts, ghost2DModels, pacman2D, pacman3D,
        mazeGroup, wallMaterialPerspective, wallMaterialOrthographic,
        activeState
    };

    // ── STEP 14: Start coin flip timer ────────────────────────────────────────
    // The first flip happens after 30 seconds. After that, flips repeat every 30 seconds.

    function runCoinFlip() {
        triggerCoinFlipCycle(ghostModeState, COIN_FLIP_SETTINGS, powerState, gameState, coinWrapper, coinInner);
    }

    setTimeout(() => {
        runCoinFlip();
        setInterval(runCoinFlip, COIN_FLIP_SETTINGS.intervalMs);
    }, COIN_FLIP_SETTINGS.intervalMs);

    // ── STEP 15: Keyboard controls ────────────────────────────────────────────

    window.addEventListener('keydown', (event) => {
        // Escape: toggle pause menu
        if (event.code === 'Escape') {
            event.preventDefault();
            if (gameState.status === 'playing') {
                openPauseMenu(gameState, controls, pauseElements.pauseRoot, pauseElements.pausePanels, pauseElements.pauseBackButton);
            } else if (gameState.status === 'paused') {
                // If a sub-panel is open (back button visible), go back to main pause panel
                if (pauseElements.pauseBackButton && !pauseElements.pauseBackButton.classList.contains('is-hidden')) {
                    showPauseSubView('pause-main', pauseElements.pauseRoot, pauseElements.pausePanels, pauseElements.pauseBackButton);
                } else {
                    closePauseMenu(gameState, powerState, pauseElements.pauseRoot);
                }
            }
            return;
        }

        // R: reload the page (quick restart)
        if (event.code === 'KeyR') { window.location.reload(); return; }

        // WASD: movement
        if (event.code === 'KeyW') { controls.forward  = true; return; }
        if (event.code === 'KeyS') { controls.backward = true; return; }
        if (event.code === 'KeyA') { controls.left     = true; return; }
        if (event.code === 'KeyD') { controls.right    = true; return; }

        // Space: toggle between 3D perspective and 2D top-down view
        if (event.code === 'Space') {
            event.preventDefault();
            if (activeState.view === 'perspective') {
                activateOrthographicView(viewBundle);
            } else {
                activatePerspectiveView(viewBundle);
            }
        }
    });

    window.addEventListener('keyup', (event) => {
        if (event.code === 'KeyW') { controls.forward  = false; }
        if (event.code === 'KeyS') { controls.backward = false; }
        if (event.code === 'KeyA') { controls.left     = false; }
        if (event.code === 'KeyD') { controls.right    = false; }
    });

    // ── STEP 16: Mouse drag controls (rotate camera in 3D view) ──────────────

    renderer.domElement.addEventListener('pointerdown', (event) => {
        if (activeState.view !== 'perspective' || gameState.status !== 'playing') return;
        controls.dragging  = true;
        controls.previousX = event.clientX;
        controls.previousY = event.clientY;
        renderer.domElement.setPointerCapture(event.pointerId);
    });

    renderer.domElement.addEventListener('pointermove', (event) => {
        if (!controls.dragging || activeState.view !== 'perspective' || gameState.status !== 'playing') return;
        const deltaX = event.clientX - controls.previousX;
        const deltaY = event.clientY - controls.previousY;
        controls.yaw   -= deltaX * playerSettings.mouseSensitivity;
        controls.pitch -= deltaY * playerSettings.mouseSensitivity;
        controls.pitch  = Math.max(-1.25, Math.min(1.25, controls.pitch));  // clamp to prevent flipping
        controls.previousX = event.clientX;
        controls.previousY = event.clientY;
    });

    renderer.domElement.addEventListener('pointerup', (event) => {
        controls.dragging = false;
        renderer.domElement.releasePointerCapture(event.pointerId);
    });

    // ── STEP 17: Window resize handler ───────────────────────────────────────

    window.addEventListener('resize', () => {
        handleWindowResize({ renderer, perspectiveCamera, orthographicCamera, minimapRenderer, minimapRoot, mazeHeight });
    });

    // ── STEP 18: Pause / gameover button wiring ───────────────────────────────

    pauseElements.pauseContinueButton?.addEventListener('click', () => closePauseMenu(gameState, powerState, pauseElements.pauseRoot));
    pauseElements.pauseControlsButton?.addEventListener('click', () => showPauseSubView('pause-controls', pauseElements.pauseRoot, pauseElements.pausePanels, pauseElements.pauseBackButton));
    pauseElements.pauseExitButton?.addEventListener('click',     () => window.location.reload());
    pauseElements.pauseBackButton?.addEventListener('click',     () => showPauseSubView('pause-main',     pauseElements.pauseRoot, pauseElements.pausePanels, pauseElements.pauseBackButton));

    gameoverElements.gameoverNewButton?.addEventListener('click',  () => window.location.reload());
    gameoverElements.gameoverExitButton?.addEventListener('click', () => window.location.reload());

    // ── STEP 19: The game loop ────────────────────────────────────────────────
    // This function is called ~60 times per second by requestAnimationFrame.
    // It updates every moving part of the game and then draws the frame.

    const clock = new THREE.Clock();

    function animate() {
        const deltaSeconds = clock.getDelta();       // seconds since last frame (~0.016 at 60fps)
        const now          = performance.now();      // milliseconds since page load

        // Only update gameplay logic while the game is actively being played
        if (gameState.status === 'playing') {

            // Remember where the camera was before movement so we can detect displacement
            const prevCameraX = perspectiveCamera.position.x;
            const prevCameraZ = perspectiveCamera.position.z;

            // Animate coins (bobbing/spinning effect)
            updateCoins({ elapsedSeconds: clock.elapsedTime, coins, view: activeState.view });

            // Move the player based on currently held keys and mouse look
            updatePlayer({ deltaSeconds, controls, camera: perspectiveCamera, mazeLayout });

            // Update the power mode countdown timer (also ends power mode when it expires)
            tickPowerMode(now, powerState, powerTimerElement, ghosts, ghost2DModels, setGhostState, setGhost2DState);

            // Move all enemies; their behavior depends on the current ghost mode
            updateGhosts({
                deltaSeconds, ghosts, mazeLayout,
                tileSize: TILE_SIZE, centerMarkerCell,
                mode: ghostModeState.ghostMode,
                targetCell: {
                    row:    Math.round(perspectiveCamera.position.z / TILE_SIZE),
                    column: Math.round(perspectiveCamera.position.x / TILE_SIZE)
                },
                // Per-ghost mode override: eyes = returning home, power mode active = flee
                modeResolver: (ghost) => {
                    if (ghost.userData.state === 'eyes') return 'return';
                    if (powerState.active)               return 'flee';
                    return ghostModeState.ghostMode;
                },
                // Per-ghost target override: eyes = go home, otherwise = chase player
                targetResolver: (ghost) => {
                    if (ghost.userData.state === 'eyes' && centerMarkerCell) return centerMarkerCell;
                    return {
                        row:    Math.round(perspectiveCamera.position.z / TILE_SIZE),
                        column: Math.round(perspectiveCamera.position.x / TILE_SIZE)
                    };
                }
            });

            // Detect if the player moved this frame (used to orient the pacman model)
            const movedX = perspectiveCamera.position.x - prevCameraX;
            const movedZ = perspectiveCamera.position.z - prevCameraZ;
            if (movedX * movedX + movedZ * movedZ > 1e-6) {
                lastMoveDirection.set(movedX, 0, movedZ).normalize();
            }

            // Smoothly rotate the 3D pacman model to face the camera's look direction
            const target3DYaw = controls.yaw + Math.PI;
            pacman3DYaw      = stepTowardAngle(pacman3DYaw, target3DYaw, PACMAN_TURN_SPEED * deltaSeconds);
            pacman3D.rotation.y = pacman3DYaw;

            // Smoothly rotate the 2D pacman sprite to face the direction of movement
            let target2DYaw = pacman2DYaw;
            if (Math.abs(lastMoveDirection.x) >= Math.abs(lastMoveDirection.z)) {
                // Moving horizontally — face left or right; flip the sprite instead of rotating
                target2DYaw = 0;
                pacman2D.scale.x = lastMoveDirection.x >= 0 ? 1 : -1;
            } else {
                // Moving vertically — face up or down
                pacman2D.scale.x = 1;
                target2DYaw = lastMoveDirection.z <= 0 ? -3 * Math.PI / 2 : -Math.PI / 2;
            }
            pacman2DYaw         = stepTowardAngle(pacman2DYaw, target2DYaw, PACMAN_TURN_SPEED * deltaSeconds);
            pacman2D.rotation.z = pacman2DYaw;

            // Sync 2D ghost sprite positions to their 3D counterparts
            for (let index = 0; index < ghosts.length; index += 1) {
                const ghost   = ghosts[index];
                const ghost2D = ghost2DModels[index];
                ghost2D.position.set(ghost.position.x, TILE_SIZE * 0.02, ghost.position.z);

                // If an eaten ghost (eyes) has reached the home box, revive it
                if (ghost.userData.state === 'eyes' && isGhostInsideCenterBox(ghost, centerMarkerCell, TILE_SIZE)) {
                    setGhostState(ghost, 'normal');
                    setGhost2DState(ghost2D, 'normal', ghost.userData.color);
                    ghost.userData.hasLeftBox = false;
                    ghost.userData.canTurn    = true;
                    ghost.userData.direction  = { row: 0, column: 0 };
                }
            }

            // Check for ghost–player collision
            const playerX = perspectiveCamera.position.x;
            const playerZ = perspectiveCamera.position.z;
            const collidingGhostIndex = getCollidingGhostIndex(playerX, playerZ, playerSettings.playerRadius, ghosts);

            if (collidingGhostIndex >= 0) {
                const touchedGhost = ghosts[collidingGhostIndex];
                if (powerState.active && touchedGhost.userData.state !== 'eyes') {
                    // Power mode active: eat the ghost for escalating bonus points
                    setGhostState(touchedGhost, 'eyes');
                    setGhost2DState(ghost2DModels[collidingGhostIndex], 'eyes', touchedGhost.userData.color);
                    const bonus  = POWER_MODE_SETTINGS.baseGhostPoints * Math.pow(2, powerState.eatStreak);
                    powerState.eatStreak += 1;
                    totalScore  += bonus;
                    updateScoreDisplay(scoreElement, totalScore);
                } else if (touchedGhost.userData.state !== 'eyes') {
                    // Normal mode: touching a ghost ends the game
                    endGame('lose', totalScore, mapConfig, gameState, powerState, powerTimerElement, pauseElements.pauseRoot, gameoverElements);
                }
            }

            // Check for coin collection
            const coinResult = collectCoins({
                playerX, playerZ,
                playerRadius: playerSettings.playerRadius,
                coins
            });

            if (coinResult.collectedCount > 0) {
                collectedCoinsCount += coinResult.collectedCount;
                // Normal coins = 1 pt each; power coins = 5 pts each
                const normalCoinCount = coinResult.collectedCount - coinResult.powerCollected;
                totalScore += normalCoinCount + coinResult.powerCollected * 5;
                updateScoreDisplay(scoreElement, totalScore);
            }

            // Eating a power coin activates power mode
            if (coinResult.powerCollected > 0) {
                activatePowerMode(
                    now, powerState, POWER_MODE_SETTINGS, ghostModeState,
                    ghosts, ghost2DModels,
                    coinWrapper, powerTimerElement,
                    setGhostState, setGhost2DState
                );
            }

            // Collected all coins = win
            if (collectedCoinsCount >= coins.length) {
                endGame('win', totalScore, mapConfig, gameState, powerState, powerTimerElement, pauseElements.pauseRoot, gameoverElements);
            }
        }

        // ── Visual updates that run even when paused ──────────────────────────

        // Keep the floor spotlight under the player at all times
        playerSpotlight.position.set(perspectiveCamera.position.x, playerSpotlight.position.y, perspectiveCamera.position.z);

        // Keep the pacman models sitting at the player's world position
        const pacman3DBaseY = pacman3D.userData.baseY ?? playerSettings.playerEyeHeight;
        pacman3D.position.set(perspectiveCamera.position.x, pacman3DBaseY, perspectiveCamera.position.z);

        const pacman2DBaseY = pacman2D.userData.baseY ?? TILE_SIZE * 0.06;
        pacman2D.position.set(perspectiveCamera.position.x, pacman2DBaseY, perspectiveCamera.position.z);
        minimapPacman.position.set(perspectiveCamera.position.x, pacman2DBaseY, perspectiveCamera.position.z);

        // Animate pacman's mouth: a sine wave creates the open/close cycle
        const mouthOpenAmount = Math.abs(Math.sin(clock.elapsedTime * 7));
        if (pacman3D.userData.mouthMesh) pacman3D.userData.mouthMesh.morphTargetInfluences[0] = mouthOpenAmount;
        if (pacman2D.userData.mouthMesh) pacman2D.userData.mouthMesh.morphTargetInfluences[0] = mouthOpenAmount;

        // ── Draw the main view ────────────────────────────────────────────────
        renderer.render(scene, activeState.camera);

        // ── Draw the minimap (in its separate canvas in the corner) ──────────
        renderMinimap({
            minimapRenderer, minimapCamera,
            minimapHeight: MINIMAP_CAMERA_HEIGHT,
            scene, mazeGroup,
            floor, floorMaterialOrthographic,
            ceiling,
            wallMaterialOrthographic,
            pacman3D, pacman2D, minimapPacman,
            ghosts, ghost2DModels,
            perspectiveCameraPosition: perspectiveCamera.position,
            coins, updateCoins,
            clock, activeView: activeState.view
        });

        requestAnimationFrame(animate);
    }

    // ── STEP 20: Start the game ───────────────────────────────────────────────

    activatePerspectiveView(viewBundle);                // set up the initial 3D view
    handleWindowResize({ renderer, perspectiveCamera, orthographicCamera, minimapRenderer, minimapRoot, mazeHeight }); // ensure correct initial sizes
    updateScoreDisplay(scoreElement, 0);                // show "Pontos: 0" immediately
    animate();                                          // begin the game loop
}
