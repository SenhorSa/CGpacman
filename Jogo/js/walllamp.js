// walllamp.js
// Responsible for creating and placing wall lamps inside the maze.
//
// A wall lamp is a small 3D lantern attached to a wall tile. It has:
//   - A flat backing plate pressed against the wall surface
//   - A short arm sticking outward
//   - A hexagonal glass lantern body with metal frame
//   - A glowing Edison bulb inside
//   - A Three.js PointLight that illuminates the surrounding area
//
// The lamp geometry pieces are built once and shared (cached) between all
// lamp instances so the GPU does not hold duplicate copies of the same shapes.

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// SHARED GEOMETRY CACHE
// All lamp instances reuse the same geometry objects.
// We rebuild the cache only if tileSize changes (which never
// happens in practice — it is always 1).
// ─────────────────────────────────────────────────────────────

/** Stores the shared geometries and materials for a specific tileSize. */
let cachedLampAssets = null;

/**
 * Returns (or builds) the shared lamp geometry/material set for the given tile size.
 * @param {number} tileSize - Width of one maze tile in world units.
 */
function getLampAssets(tileSize) {
    if (cachedLampAssets && cachedLampAssets.tileSize === tileSize) {
        return cachedLampAssets;
    }

    // s is a shorthand so the measurements below are easier to read.
    const s = tileSize;

    cachedLampAssets = {
        tileSize,

        // Flat backing plate pressed flat against the wall surface
        plateGeometry:  new THREE.BoxGeometry(s * 0.12, s * 0.18, s * 0.03),

        // Short cylindrical arm that sticks outward from the plate
        // (CylinderGeometry runs along Y; we rotate it 90° so it points along Z)
        armGeometry:    new THREE.CylinderGeometry(s * 0.018, s * 0.024, s * 0.06, 8),

        // Hexagonal cup/neck that connects the arm to the lantern body
        cupGeometry:    new THREE.CylinderGeometry(s * 0.040, s * 0.028, s * 0.05, 6),

        // Decorative collar rings at the top and bottom of the lantern body
        collarGeometry: new THREE.CylinderGeometry(s * 0.063, s * 0.063, s * 0.013, 6),

        // Open hexagonal glass tube — the main lantern body (transparent)
        glassGeometry:  new THREE.CylinderGeometry(s * 0.055, s * 0.055, s * 0.14, 6, 1, true),

        // Thin vertical bar placed at each of the 6 hex corners to frame the glass
        edgeGeometry:   new THREE.CylinderGeometry(s * 0.007, s * 0.007, s * 0.14, 6),

        // Hexagonal pyramid cap on top of the lantern (tip points upward)
        capGeometry:    new THREE.CylinderGeometry(0, s * 0.064, s * 0.065, 6),

        // Small decorative sphere at the very top of the cap
        finialGeometry: new THREE.SphereGeometry(s * 0.018, 8, 6),

        // The glowing Edison-style bulb inside the lantern
        bulbGeometry:   new THREE.SphereGeometry(s * 0.028, 10, 7),

        // Dark bronze/iron material for all metal parts
        metalMaterial: new THREE.MeshStandardMaterial({
            color: 0x3a2510, roughness: 0.55, metalness: 0.45
        }),

        // Semi-transparent material for the glass tube
        glassMaterial: new THREE.MeshStandardMaterial({
            color: 0xfff3d0, roughness: 0.05, metalness: 0.0,
            transparent: true, opacity: 0.25, side: THREE.DoubleSide
        }),

        // Warm emissive material that makes the bulb look lit from inside
        bulbMaterial: new THREE.MeshStandardMaterial({
            color: 0xfff1c1, emissive: 0xffb347, emissiveIntensity: 1.4
        }),
    };

    return cachedLampAssets;
}

// ─────────────────────────────────────────────────────────────
// SINGLE LAMP CREATION
// ─────────────────────────────────────────────────────────────

/**
 * Builds one complete wall lamp as a Three.js Group.
 * The group's local origin sits at the wall surface — position and
 * rotation are set by the caller (placeWallLamps).
 *
 * @param {number} tileSize        - Width of one maze tile in world units.
 * @param {number} lightColor      - Hex color of the emitted point light.
 * @param {number} lightIntensity  - Brightness of the point light.
 * @returns {{ group: THREE.Group, light: THREE.PointLight }}
 */
function createWallLamp(tileSize, lightColor = 0xffd9a8, lightIntensity = 1.1) {
    const assets = getLampAssets(tileSize);
    const s = tileSize;
    const group = new THREE.Group();

    // --- Backing plate (lies flat against the wall) ---
    const plate = new THREE.Mesh(assets.plateGeometry, assets.metalMaterial);
    plate.position.set(0, 0, s * 0.015);
    group.add(plate);

    // --- Arm (rotated so the cylinder points outward in +Z) ---
    const arm = new THREE.Mesh(assets.armGeometry, assets.metalMaterial);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(0, -s * 0.025, s * 0.030);
    group.add(arm);

    // --- Cup / neck between arm and lantern body ---
    const cup = new THREE.Mesh(assets.cupGeometry, assets.metalMaterial);
    cup.position.set(0, s * 0.015, s * 0.075);
    group.add(cup);

    // Z position where the lantern body is centered (close to but not touching the wall)
    const lanternZ = s * 0.085;

    // Y positions that stack the lantern body parts from bottom to top
    const bodyBottomY  = s * 0.040;
    const bodyCenterY  = bodyBottomY + s * 0.070;  // midpoint of the glass tube
    const bodyTopY     = bodyBottomY + s * 0.140;  // top edge of the glass tube

    // --- Bottom collar ring ---
    const bottomCollar = new THREE.Mesh(assets.collarGeometry, assets.metalMaterial);
    bottomCollar.position.set(0, bodyBottomY, lanternZ);
    group.add(bottomCollar);

    // --- Hexagonal glass tube (the main lantern body) ---
    const glass = new THREE.Mesh(assets.glassGeometry, assets.glassMaterial);
    glass.position.set(0, bodyCenterY, lanternZ);
    group.add(glass);

    // --- Six metal edge bars, one at each corner of the hex cross-section ---
    const edgeRadius = s * 0.055;
    for (let cornerIndex = 0; cornerIndex < 6; cornerIndex += 1) {
        const angle = (cornerIndex / 6) * Math.PI * 2;
        const edge = new THREE.Mesh(assets.edgeGeometry, assets.metalMaterial);
        edge.position.set(
            Math.sin(angle) * edgeRadius,
            bodyCenterY,
            lanternZ + Math.cos(angle) * edgeRadius
        );
        group.add(edge);
    }

    // --- Top collar ring ---
    const topCollar = new THREE.Mesh(assets.collarGeometry, assets.metalMaterial);
    topCollar.position.set(0, bodyTopY, lanternZ);
    group.add(topCollar);

    // --- Pyramid cap (flat base at bodyTopY, tip pointing upward) ---
    const cap = new THREE.Mesh(assets.capGeometry, assets.metalMaterial);
    cap.position.set(0, bodyTopY + s * 0.0325, lanternZ);
    group.add(cap);

    // --- Small decorative sphere at the very tip of the cap ---
    const finial = new THREE.Mesh(assets.finialGeometry, assets.metalMaterial);
    finial.position.set(0, bodyTopY + s * 0.083, lanternZ);
    group.add(finial);

    // --- Glowing Edison bulb inside the lantern ---
    const bulb = new THREE.Mesh(assets.bulbGeometry, assets.bulbMaterial);
    bulb.position.set(0, bodyCenterY, lanternZ);
    group.add(bulb);

    // --- Point light that illuminates the surrounding area ---
    // Distance 3 tiles, quadratic falloff (decay = 2)
    const light = new THREE.PointLight(lightColor, lightIntensity, s * 3.0, 2);
    light.position.set(0, bodyCenterY, lanternZ);
    group.add(light);

    return { group, light };
}

// ─────────────────────────────────────────────────────────────
// LAMP PLACEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Creates and positions wall lamps at specific locations in the maze.
 * Each placement specifies a walkable tile and which of its four walls
 * (north / south / east / west) the lamp should be mounted on.
 *
 * The function skips any placement where the requested wall tile does not
 * actually exist (value === 1) in mazeLayout, printing a warning instead.
 *
 * @param {object} options
 * @param {number[][]}    options.mazeLayout     - 2D grid: 1 = wall, 0 = walkable.
 * @param {number}        options.tileSize       - World-unit size of one tile.
 * @param {number}        options.wallHeight     - Height of wall tiles.
 * @param {THREE.Object3D} options.targetGroup   - Three.js group to add lamps into.
 * @param {object[]}      options.placements     - Array of { row, column, wall } objects.
 * @param {number}        [options.lightColor]   - Hex color for all lamp lights.
 * @param {number}        [options.lightIntensity] - Brightness for all lamp lights.
 */
export function placeWallLamps({ mazeLayout, tileSize, wallHeight, targetGroup, placements, lightColor = 0xffd9a8, lightIntensity = 1.1 }) {
    if (!mazeLayout || !targetGroup || !Array.isArray(placements)) {
        return;
    }

    const rows    = mazeLayout.length;
    const columns = mazeLayout[0]?.length ?? 0;

    // For each compass direction: which neighbor tile must be a wall,
    // which way the lamp faces, and the Y rotation to apply to the group.
    const wallDirections = {
        north: { neighborRow: -1, neighborCol:  0, normalX:  0, normalZ: -1, rotationY: 0 },
        south: { neighborRow:  1, neighborCol:  0, normalX:  0, normalZ:  1, rotationY: Math.PI },
        west:  { neighborRow:  0, neighborCol: -1, normalX: -1, normalZ:  0, rotationY: Math.PI / 2 },
        east:  { neighborRow:  0, neighborCol:  1, normalX:  1, normalZ:  0, rotationY: -Math.PI / 2 }
    };

    // Track already-placed lamp positions so we don't place two lamps at the same spot.
    const placedKeys = new Set();

    const isSolidWall = (row, column) =>
        row >= 0 && row < rows &&
        column >= 0 && column < columns &&
        mazeLayout[row][column] === 1;

    for (const placement of placements) {
        const { row, column } = placement;
        const directionName = String(placement.wall ?? '').trim().toLowerCase();
        const direction = wallDirections[directionName];

        // Skip if the placement has invalid data
        if (!direction || !Number.isInteger(row) || !Number.isInteger(column)) {
            continue;
        }

        // Skip duplicates
        const placementKey = `${row},${column},${directionName}`;
        if (placedKeys.has(placementKey)) {
            continue;
        }
        placedKeys.add(placementKey);

        // Skip if there is no wall tile in the requested direction
        const wallRow = row + direction.neighborRow;
        const wallCol = column + direction.neighborCol;
        if (!isSolidWall(wallRow, wallCol)) {
            console.warn('Skipped lamp — no wall tile at requested direction:', { row, column, wall: directionName });
            continue;
        }

        const { group } = createWallLamp(tileSize, lightColor, lightIntensity);

        // Push the lamp slightly away from the wall center so it sits on the surface
        const surfaceOffset = tileSize * 0.5 - tileSize * 0.08;
        const worldX = column * tileSize + direction.normalX * surfaceOffset;
        const worldZ = row    * tileSize + direction.normalZ * surfaceOffset;

        group.position.set(worldX, wallHeight * 0.72, worldZ);
        group.rotation.y = direction.rotationY;
        targetGroup.add(group);
    }
}
