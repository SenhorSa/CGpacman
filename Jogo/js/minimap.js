// minimap.js
// Responsible for creating and rendering the minimap (the small map in the corner).
//
// The minimap is a second WebGL renderer that uses the same 3D scene but with a
// top-down orthographic camera following the player. To render it correctly:
//   1. We temporarily swap all materials to their flat 2D versions
//   2. We hide the 3D character models and show the 2D flat sprites instead
//   3. We render the scene with the minimap camera
//   4. We restore all the original materials and visibility settings
//
// This "borrow the scene" approach means the minimap stays perfectly in sync
// with the main game world without needing a separate copy of the maze.

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// MINIMAP RENDERER SETUP
// ─────────────────────────────────────────────────────────────

/**
 * Creates the minimap WebGL renderer and camera.
 * If the minimap canvas or container DOM elements don't exist, returns nulls
 * (the rest of the code checks for null before using these).
 *
 * @param {number} minimapViewSize - How many world units the minimap camera shows on each side.
 *                                   Smaller = zoomed in, larger = zoomed out.
 * @param {number} minimapHeight   - How high above the ground the minimap camera floats.
 * @returns {{
 *   minimapRenderer: THREE.WebGLRenderer | null,
 *   minimapCamera:   THREE.OrthographicCamera | null,
 *   minimapRoot:     HTMLElement | null
 * }}
 */
export function createMinimapRenderer(minimapViewSize = 4, minimapHeight = 12) {
    const minimapRoot   = document.getElementById('minimap');
    const minimapCanvas = document.getElementById('minimap-canvas');

    if (!minimapCanvas) {
        return { minimapRenderer: null, minimapCamera: null, minimapRoot: null };
    }

    const minimapRenderer = new THREE.WebGLRenderer({
        canvas:           minimapCanvas,
        alpha:            true,   // transparent background so the page shows through
        antialias:        true,
        powerPreference:  'high-performance'
    });
    minimapRenderer.setClearColor(0x000000, 0);          // clear to transparent
    minimapRenderer.outputColorSpace = THREE.SRGBColorSpace;

    // Square orthographic camera — equal view distance in all four directions
    const minimapCamera = new THREE.OrthographicCamera(
        -minimapViewSize,   // left
         minimapViewSize,   // right
         minimapViewSize,   // top
        -minimapViewSize,   // bottom
        0.1,                // near clip (don't draw objects closer than this)
        60                  // far clip
    );

    return { minimapRenderer, minimapCamera, minimapRoot };
}

// ─────────────────────────────────────────────────────────────
// MINIMAP RENDER
// Called every frame. Temporarily converts the scene to 2D, renders
// the minimap, then restores everything back to the active view state.
// ─────────────────────────────────────────────────────────────

/**
 * Renders one frame of the minimap into the minimap canvas.
 *
 * The minimap camera follows the player from directly above.
 * To produce the correct top-down look, this function:
 *   - Removes fog (fog only makes sense in the first-person view)
 *   - Hides the 3D character models and shows the flat 2D sprites
 *   - Swaps all walls and floor to their flat 2D materials
 *   - Renders the scene with the minimap camera
 *   - Restores all changed properties to whatever they were before
 *
 * @param {object} minimapContext - All objects needed to render the minimap.
 */
export function renderMinimap({
    minimapRenderer, minimapCamera, minimapHeight,
    scene, mazeGroup,
    floor, floorMaterialOrthographic,
    ceiling,
    wallMaterialOrthographic,
    pacman3D, pacman2D, minimapPacman,
    ghosts, ghost2DModels,
    perspectiveCameraPosition,
    coins, updateCoins,
    clock, activeView
}) {
    if (!minimapRenderer || !minimapCamera) return;

    const playerX = perspectiveCameraPosition.x;
    const playerZ = perspectiveCameraPosition.z;

    // The minimap camera always sits directly above the player, looking straight down
    minimapCamera.position.set(playerX, minimapHeight, playerZ);
    minimapCamera.lookAt(playerX, 0, playerZ);

    // ── Snapshot: remember the current state of every object we're about to change ──
    const savedFog              = scene.fog;
    const savedBackground       = scene.background;
    const savedCeilingVisible   = ceiling.visible;
    const savedFloorMaterial    = floor.material;
    const savedPacman3DVisible  = pacman3D.visible;
    const savedPacman2DVisible  = pacman2D.visible;
    const savedGhostVisibility  = ghosts.map(ghost => ghost.visible);
    const savedGhost2DVisibility = ghost2DModels.map(ghost2d => ghost2d.visible);
    const savedWallMaterials    = mazeGroup.children.map(wall => wall.material);

    // ── Set up scene for top-down rendering ──
    scene.fog        = null;    // no fog from above
    scene.background = null;    // transparent — the minimap container has its own background

    ceiling.visible        = false;  // ceiling would block the top-down view
    floor.material         = floorMaterialOrthographic;
    pacman3D.visible       = false;  // hide the 3D model
    pacman2D.visible       = false;  // hide the in-game 2D sprite too
    minimapPacman.visible  = true;   // show the dedicated minimap player dot

    // Show 2D ghost sprites, hide 3D ghost models
    ghosts.forEach(ghost => { ghost.visible = false; });
    ghost2DModels.forEach(ghost2d => { ghost2d.visible = true; });

    // Swap walls to the flat unlit material
    mazeGroup.children.forEach((wall, index) => {
        if (wall.userData?.isPanel) return;
        wall.material = wallMaterialOrthographic;
        // Fix: preserve the original material reference even if it was already flat
        savedWallMaterials[index] = savedWallMaterials[index] ?? wall.material;
    });

    // Update coins to their 2D flat appearance for the minimap frame
    updateCoins({ elapsedSeconds: clock.elapsedTime, coins, view: 'orthographic' });

    // ── Render ──
    minimapRenderer.render(scene, minimapCamera);

    // ── Restore: put everything back exactly as it was ──
    scene.fog        = savedFog;
    scene.background = savedBackground;

    ceiling.visible       = savedCeilingVisible;
    floor.material        = savedFloorMaterial;
    pacman3D.visible      = savedPacman3DVisible;
    pacman2D.visible      = savedPacman2DVisible;
    minimapPacman.visible = false;

    ghosts.forEach((ghost, index) => { ghost.visible = savedGhostVisibility[index]; });
    ghost2DModels.forEach((ghost2d, index) => { ghost2d.visible = savedGhost2DVisibility[index]; });
    mazeGroup.children.forEach((wall, index) => { wall.material = savedWallMaterials[index]; });

    // Restore coins to whatever view the player is currently in
    updateCoins({ elapsedSeconds: clock.elapsedTime, coins, view: activeView });
}
