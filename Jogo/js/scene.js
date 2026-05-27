// scene.js
// Responsible for everything related to rendering and cameras.
//
// This module creates and manages:
//   - The Three.js Scene (the container that holds all 3D objects)
//   - The main Renderer (draws the scene to the screen)
//   - Two cameras:
//       • perspectiveCamera  → first-person 3D view (normal gameplay)
//       • orthographicCamera → top-down 2D view (bird's-eye view, toggled with Space)
//   - A "sun" visual: the directional light that casts shadows, plus a visible
//     sun sphere and a glow sprite in the sky
//   - View switching: swapping materials, visibility, and the active camera
//     when the player toggles between 3D and 2D views
//   - Window resize handling so the image always fills the screen correctly

import * as THREE from 'three';
import { registerLight, setLightEnabledByKey } from './lights.js';

// ─────────────────────────────────────────────────────────────
// SCENE AND RENDERER SETUP
// ─────────────────────────────────────────────────────────────

/**
 * Creates the Three.js Scene, main WebGL Renderer, and scene lighting.
 * The renderer's canvas element is appended to the given DOM container.
 *
 * @param {HTMLElement} container   - The DOM element that receives the canvas.
 * @param {object}      mapConfig   - Map settings (background color, fog, lights, etc.).
 * @returns {{
 *   scene:       THREE.Scene,
 *   renderer:    THREE.WebGLRenderer,
 *   sceneFog:    THREE.Fog | null,
 *   ambientLight: THREE.AmbientLight,
 *   mainLight:   THREE.DirectionalLight
 * }}
 */
export function createSceneAndRenderer(container, mapConfig) {
    // The scene holds all 3D objects, lights, and cameras
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(mapConfig.sceneBackground);

    // Fog makes distant walls fade into the background, creating depth
    const sceneFog = mapConfig.fogEnabled
        ? new THREE.Fog(mapConfig.fogColor, mapConfig.fogNear, mapConfig.fogFar)
        : null;
    scene.fog = sceneFog;

    // The renderer converts the 3D scene into a 2D image on the screen
    const renderer = new THREE.WebGLRenderer({
        antialias: true,            // smoother edges (slightly slower but looks much better)
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap at 2× for performance
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;  // soft shadow edges
    container.appendChild(renderer.domElement);

    // Ambient light: fills the whole scene with a flat, directionless glow
    // (prevents shadow areas from being completely black)
    const ambientLight = registerLight(
        'gameAmbient',
        new THREE.AmbientLight(mapConfig.ambientColor, mapConfig.ambientIntensity)
    );
    scene.add(ambientLight);

    // Main directional light: acts as the sun, casts shadows
    const mainLight = registerLight(
        'gameDirectional',
        new THREE.DirectionalLight(mapConfig.directionalColor, mapConfig.directionalIntensity)
    );
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048); // shadow resolution (higher = sharper shadows)
    mainLight.shadow.bias = -0.0003;          // prevents shadow acne on flat surfaces
    mainLight.shadow.normalBias = 0.04;
    scene.add(mainLight);

    return { scene, renderer, sceneFog, ambientLight, mainLight };
}

// ─────────────────────────────────────────────────────────────
// SUN VISUAL
// Sets the directional light position to simulate a sun at 60°
// elevation and 45° azimuth, then adds a visible sun sphere and
// a radial-gradient glow sprite in the sky.
// ─────────────────────────────────────────────────────────────

/**
 * Positions the main directional light like a sun and adds visible sun visuals.
 * Pressing key '6' toggles the sun (and ambient light) on/off.
 *
 * @param {THREE.Scene}            scene          - The scene to add visuals to.
 * @param {THREE.DirectionalLight} mainLight      - The light to position and configure.
 * @param {{ column: number, row: number } | null} centerMarkerCell - Center of the maze.
 * @param {number} mazeCenterX  - World X of the maze center.
 * @param {number} mazeCenterZ  - World Z of the maze center.
 * @param {number} mazeWidth    - Total world width of the maze.
 * @param {number} mazeHeight   - Total world height of the maze.
 * @param {number} tileSize     - World size of one tile.
 */
export function setupSunLight(scene, mainLight, centerMarkerCell, mazeCenterX, mazeCenterZ, mazeWidth, mazeHeight, tileSize) {
    // The sun orbits at 30 world-units distance from the maze center,
    // at 60° elevation above the horizon and 45° horizontal azimuth.
    const pivotX = centerMarkerCell ? centerMarkerCell.column * tileSize : mazeCenterX;
    const pivotZ = centerMarkerCell ? centerMarkerCell.row    * tileSize : mazeCenterZ;
    const elevation  = Math.PI / 3;   // 60° above the horizon
    const azimuth    = Math.PI / 4;   // 45° horizontal rotation
    const sunDistance = 30;

    mainLight.position.set(
        pivotX + sunDistance * Math.cos(elevation) * Math.cos(azimuth),
        sunDistance * Math.sin(elevation),
        pivotZ + sunDistance * Math.cos(elevation) * Math.sin(azimuth)
    );
    mainLight.target.position.set(pivotX, 0, pivotZ);
    scene.add(mainLight.target);

    // Shadow frustum covers the whole maze plus a small margin
    const shadowHalfSize = Math.max(mazeWidth, mazeHeight) * 0.65;
    mainLight.shadow.camera.left   = -shadowHalfSize;
    mainLight.shadow.camera.right  =  shadowHalfSize;
    mainLight.shadow.camera.top    =  shadowHalfSize;
    mainLight.shadow.camera.bottom = -shadowHalfSize;
    mainLight.shadow.camera.near   = 1;
    mainLight.shadow.camera.far    = 80;
    mainLight.shadow.camera.updateProjectionMatrix();

    // Visible sun sphere at the light position
    const sunCoreMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xfffde8 })
    );
    sunCoreMesh.position.copy(mainLight.position);
    scene.add(sunCoreMesh);

    // Glow halo: a canvas texture with a radial gradient, displayed as a billboard Sprite
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width  = 256;
    glowCanvas.height = 256;
    const glowCtx = glowCanvas.getContext('2d');
    const gradient = glowCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0.00, 'rgba(255, 255, 220, 1.00)');
    gradient.addColorStop(0.15, 'rgba(255, 240, 100, 0.85)');
    gradient.addColorStop(0.40, 'rgba(255, 200,  40, 0.30)');
    gradient.addColorStop(0.70, 'rgba(255, 160,   0, 0.08)');
    gradient.addColorStop(1.00, 'rgba(255, 120,   0, 0.00)');
    glowCtx.fillStyle = gradient;
    glowCtx.fillRect(0, 0, 256, 256);

    const sunGlowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(glowCanvas),
        blending: THREE.AdditiveBlending, // adds color on top, making it appear to glow
        transparent: true,
        depthWrite: false                 // prevents the sprite from blocking other objects
    }));
    sunGlowSprite.position.copy(mainLight.position);
    sunGlowSprite.scale.set(14, 14, 1);
    scene.add(sunGlowSprite);

    // Key '6' toggles the sun and ambient light on/off
    let sunVisible = true;
    window.addEventListener('keydown', (event) => {
        if (event.key !== '6') return;
        sunVisible = !sunVisible;
        setLightEnabledByKey('gameDirectional', sunVisible);
        setLightEnabledByKey('gameAmbient',     sunVisible);
        sunCoreMesh.visible   = sunVisible;
        sunGlowSprite.visible = sunVisible;
    });
}

// ─────────────────────────────────────────────────────────────
// CAMERAS
// ─────────────────────────────────────────────────────────────

/**
 * Creates the two game cameras.
 *
 * perspectiveCamera  — standard first-person 3D camera.
 * orthographicCamera — top-down flat camera centered on the maze.
 *   Its size is fixed so the whole maze is always visible.
 *
 * @param {number} mazeWidth   - Total world width of the maze.
 * @param {number} mazeHeight  - Total world depth of the maze.
 * @param {number} mazeCenterX - World X of the maze center.
 * @param {number} mazeCenterZ - World Z of the maze center.
 * @returns {{ perspectiveCamera: THREE.PerspectiveCamera, orthographicCamera: THREE.OrthographicCamera }}
 */
export function createGameCameras(mazeWidth, mazeHeight, mazeCenterX, mazeCenterZ) {
    // First-person perspective camera — standard 60° field of view
    const perspectiveCamera = new THREE.PerspectiveCamera(
        60,                                          // vertical field of view in degrees
        window.innerWidth / window.innerHeight,      // aspect ratio matches the window
        0.1,                                         // near clipping plane (don't draw closer than this)
        100                                          // far clipping plane (don't draw farther than this)
    );

    // Top-down orthographic camera — no perspective distortion
    // Size is calculated so the whole maze fits in the view with some padding
    const orthoHalfSize = Math.max(mazeWidth, mazeHeight) * 0.6;
    const orthographicCameraAltitude = 18;  // how high above the floor the camera floats
    const orthographicCamera = new THREE.OrthographicCamera(
        -orthoHalfSize,   // left edge
         orthoHalfSize,   // right edge
         orthoHalfSize,   // top edge
        -orthoHalfSize,   // bottom edge
        0.1,              // near clip
        100               // far clip
    );
    orthographicCamera.position.set(mazeCenterX, orthographicCameraAltitude, mazeCenterZ);
    orthographicCamera.lookAt(mazeCenterX, 0, mazeCenterZ);

    return { perspectiveCamera, orthographicCamera };
}

// ─────────────────────────────────────────────────────────────
// VIEW SWITCHING
// The game has two views: 3D perspective (default) and 2D top-down.
// Switching swaps materials, camera, and which character models are visible.
// ─────────────────────────────────────────────────────────────

/**
 * Switches all scene objects to the 3D perspective view.
 * Shows the 3D character models, enables fog, and uses the standard materials.
 *
 * @param {object} viewObjects - All the scene objects that change between views.
 */
export function activatePerspectiveView({
    controls, perspectiveCamera, minimapRoot,
    floor, floorMaterialPerspective,
    ceiling, mapConfig, sceneFog, scene,
    ghosts, ghost2DModels, pacman2D, pacman3D,
    mazeGroup, wallMaterialPerspective,
    activeState
}) {
    activeState.camera = perspectiveCamera;
    activeState.view   = 'perspective';
    controls.view      = 'perspective';

    // Show the minimap overlay in the corner
    if (minimapRoot) minimapRoot.style.display = '';

    // Swap floor material back to the full-quality perspective version
    floor.material = floorMaterialPerspective;

    // Show ceiling only if the map config allows it
    ceiling.visible = mapConfig.ceilingVisible !== false;

    // Re-enable fog so the corridor looks deep and atmospheric
    scene.fog = sceneFog;

    // Show 3D ghost models, hide flat 2D ones
    for (const ghost of ghosts)       ghost.visible = true;
    for (const ghost2D of ghost2DModels) ghost2D.visible = false;

    // Show 3D pacman, hide flat 2D sprite
    pacman2D.visible = false;
    pacman3D.visible = true;

    // Swap all wall tiles to the detailed perspective material
    for (const wall of mazeGroup.children) {
        if (wall.userData?.isPanel) continue;  // skip decorative panels
        wall.material = wallMaterialPerspective;
    }
}

/**
 * Switches all scene objects to the 2D top-down orthographic view.
 * Shows flat sprite models, removes fog, and uses simplified materials.
 *
 * @param {object} viewObjects - All the scene objects that change between views.
 */
export function activateOrthographicView({
    controls, orthographicCamera, minimapRoot,
    floor, floorMaterialOrthographic,
    ceiling, scene,
    ghosts, ghost2DModels, pacman2D, pacman3D,
    mazeGroup, wallMaterialOrthographic,
    activeState
}) {
    activeState.camera = orthographicCamera;
    activeState.view   = 'orthographic';
    controls.view      = 'orthographic';

    // Hide the minimap — the whole view is already top-down
    if (minimapRoot) minimapRoot.style.display = 'none';

    // Swap floor to simplified flat material (no lighting calculation needed from above)
    floor.material = floorMaterialOrthographic;

    // No ceiling in top-down view — it would block everything
    ceiling.visible = false;

    // Remove fog — distance cueing doesn't make sense from directly above
    scene.fog = null;

    // Hide 3D ghost models, show flat 2D ones
    for (const ghost of ghosts)          ghost.visible = false;
    for (const ghost2D of ghost2DModels) ghost2D.visible = true;

    // Show flat pacman sprite, hide 3D model
    pacman2D.visible = true;
    pacman3D.visible = false;

    // Swap walls to the flat MeshBasicMaterial (no lighting, faster)
    for (const wall of mazeGroup.children) {
        if (wall.userData?.isPanel) continue;
        wall.material = wallMaterialOrthographic;
    }
}

/**
 * Toggles between perspective and orthographic view.
 * Called when the player presses Space.
 *
 * @param {object} viewArgs    - Same argument bundle as activatePerspectiveView / activateOrthographicView.
 * @param {object} activeState - Mutable object with { camera, view } tracking the current view.
 */
export function toggleGameView(viewArgs, activeState) {
    if (activeState.view === 'perspective') {
        activateOrthographicView({ ...viewArgs, activeState });
    } else {
        activatePerspectiveView({ ...viewArgs, activeState });
    }
}

// ─────────────────────────────────────────────────────────────
// WINDOW RESIZE HANDLER
// ─────────────────────────────────────────────────────────────

/**
 * Updates renderer size, camera aspect ratios, and minimap size
 * whenever the browser window is resized.
 *
 * @param {object} resizeTargets - All renderers and cameras that need updating.
 */
export function handleWindowResize({
    renderer, perspectiveCamera, orthographicCamera,
    minimapRenderer, minimapRoot,
    mazeHeight
}) {
    const width  = window.innerWidth;
    const height = window.innerHeight;

    // Resize the main canvas to fill the window
    renderer.setSize(width, height);

    // Update perspective camera aspect ratio so objects are not stretched
    perspectiveCamera.aspect = width / height;
    perspectiveCamera.updateProjectionMatrix();

    // Recalculate orthographic camera frustum for new aspect ratio
    // so the top-down view always shows the full maze without stretching
    const aspect = width / height;
    const halfMazeHeightWithMargin = (mazeHeight + 2) * 0.5;
    orthographicCamera.left   = -halfMazeHeightWithMargin * aspect;
    orthographicCamera.right  =  halfMazeHeightWithMargin * aspect;
    orthographicCamera.top    =  halfMazeHeightWithMargin;
    orthographicCamera.bottom = -halfMazeHeightWithMargin;
    orthographicCamera.updateProjectionMatrix();

    // Resize the minimap canvas to match its DOM container size
    if (minimapRenderer && minimapRoot) {
        const minimapSize = minimapRoot.clientWidth || 160;
        const devicePixelRatio = Math.min(window.devicePixelRatio, 2);
        minimapRenderer.setPixelRatio(devicePixelRatio);
        minimapRenderer.setSize(minimapSize, minimapSize, false);
    }
}
