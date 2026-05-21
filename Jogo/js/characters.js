import * as THREE from 'three';
import { findSpawnCell, isWalkableAt } from './maze.js';

export const playerSettings = {
    moveSpeed: 2.4,
    playerEyeHeight: 0.52,
    playerRadius: 0.22,
    mouseSensitivity: 0.0025
};

export const ghostSettings = {
    radiusRatio: 0.22,
    spacingUnits: 2,
    moveSpeed: 1.15,
    collisionPadding: 0.03
};

export const coinSettings = {
    radiusRatio: 0.11,
    baseHeight: 0.2,
    floatAmplitude: 0.06,
    floatSpeed: 2.4
};

const ghostColors = {
    blue: 0x05a4fa,
    red: 0xdc2626,
    orange: 0xff5e00,
    pink: 0xec4899
};

const ghostFrightenedColor = 0x1e3a8a;

const cardinalDirections = [
    { row: -1, column: 0 },
    { row: 1, column: 0 },
    { row: 0, column: -1 },
    { row: 0, column: 1 }
];

function createControls() {
    return {
        forward: false,
        backward: false,
        left: false,
        right: false,
        dragging: false,
        previousX: 0,
        previousY: 0,
        yaw: Math.PI / 4,
        pitch: -0.08,
        view: 'perspective'
    };
}

function isInsideGrid(layout, row, column) {
    return row >= 0 && row < layout.length && column >= 0 && column < layout[0].length;
}

function worldToCell(worldX, worldZ, tileSize) {
    return {
        row: Math.round(worldZ / tileSize),
        column: Math.round(worldX / tileSize)
    };
}

function isWalkableCell(layout, row, column) {
    return isInsideGrid(layout, row, column) && layout[row][column] === 0;
}

function directionKey(direction) {
    return `${direction.row},${direction.column}`;
}

function oppositeDirection(direction) {
    return {
        row: -direction.row,
        column: -direction.column
    };
}

function getAvailableDirections(mazeLayout, row, column, options = {}) {
    const directions = [];
    const {
        blockCenterBox,
        centerMarkerCell,
        ghostRadius,
        tileSize
    } = options;
    const effectiveRadius = ghostRadius ? ghostRadius + ghostSettings.collisionPadding : ghostRadius;

    for (const direction of cardinalDirections) {
        const nextRow = row + direction.row;
        const nextColumn = column + direction.column;

        const isWalkable = effectiveRadius && tileSize
            ? isWalkableAt(mazeLayout, nextColumn * tileSize, nextRow * tileSize, effectiveRadius)
            : isWalkableCell(mazeLayout, nextRow, nextColumn);

        if (isWalkable) {
            if (blockCenterBox && centerMarkerCell && isInsideCenterBox(nextRow, nextColumn, centerMarkerCell)) {
                continue;
            }
            directions.push(direction);
        }
    }

    return directions;
}

function isNearCellCenter(position, tileSize) {
    const cellX = Math.round(position.x / tileSize) * tileSize;
    const cellZ = Math.round(position.z / tileSize) * tileSize;
    const threshold = tileSize * 0.08;

    return Math.abs(position.x - cellX) <= threshold && Math.abs(position.z - cellZ) <= threshold;
}

function isInsideCenterBox(row, column, centerMarkerCell) {
    return Math.abs(row - centerMarkerCell.row) <= 1 && Math.abs(column - centerMarkerCell.column) <= 1;
}

function pickGhostDirection(ghost, mazeLayout, tileSize, options = {}) {
    const { row, column } = worldToCell(ghost.position.x, ghost.position.z, tileSize);
    const availableDirections = getAvailableDirections(mazeLayout, row, column, {
        ...options,
        ghostRadius: ghost.userData.radius,
        tileSize
    });

    if (availableDirections.length === 0) {
        return ghost.userData.direction ?? { row: 0, column: 0 };
    }

    return availableDirections[Math.floor(Math.random() * availableDirections.length)];
}

function pickChaseDirection(ghost, mazeLayout, tileSize, targetCell, options = {}) {
    const { row, column } = worldToCell(ghost.position.x, ghost.position.z, tileSize);
    const availableDirections = getAvailableDirections(mazeLayout, row, column, {
        ...options,
        ghostRadius: ghost.userData.radius,
        tileSize
    });

    if (availableDirections.length === 0) {
        return ghost.userData.direction ?? { row: 0, column: 0 };
    }

    const reverseKey = directionKey(oppositeDirection(ghost.userData.direction ?? { row: 0, column: 0 }));
    let bestAnyDirection = availableDirections[0];
    let bestAnyScore = Number.POSITIVE_INFINITY;
    let bestNonReverseDirection = null;
    let bestNonReverseScore = Number.POSITIVE_INFINITY;

    for (const direction of availableDirections) {
        const nextRow = row + direction.row;
        const nextColumn = column + direction.column;
        const dx = targetCell.column - nextColumn;
        const dz = targetCell.row - nextRow;
        const distance = dx * dx + dz * dz;
        const isReverse = directionKey(direction) === reverseKey;

        if (distance < bestAnyScore) {
            bestAnyScore = distance;
            bestAnyDirection = direction;
        }

        if (!isReverse && distance < bestNonReverseScore) {
            bestNonReverseScore = distance;
            bestNonReverseDirection = direction;
        }
    }

    if (bestNonReverseDirection) {
        return bestNonReverseDirection;
    }

    return bestAnyDirection;
}

function pickFleeDirection(ghost, mazeLayout, tileSize, targetCell, options = {}) {
    const { row, column } = worldToCell(ghost.position.x, ghost.position.z, tileSize);
    const availableDirections = getAvailableDirections(mazeLayout, row, column, {
        ...options,
        ghostRadius: ghost.userData.radius,
        tileSize
    });

    if (availableDirections.length === 0) {
        return ghost.userData.direction ?? { row: 0, column: 0 };
    }

    let bestAnyDirection = availableDirections[0];
    let bestAnyScore = Number.NEGATIVE_INFINITY;

    for (const direction of availableDirections) {
        const nextRow = row + direction.row;
        const nextColumn = column + direction.column;
        const dx = targetCell.column - nextColumn;
        const dz = targetCell.row - nextRow;
        const distance = dx * dx + dz * dz;
        if (distance > bestAnyScore) {
            bestAnyScore = distance;
            bestAnyDirection = direction;
        }
    }

    return bestAnyDirection;
}

function pickShortestPathDirection(ghost, mazeLayout, tileSize, targetCell, options = {}) {
    const { row: startRow, column: startColumn } = worldToCell(ghost.position.x, ghost.position.z, tileSize);
    const { blockCenterBox, centerMarkerCell } = options;

    if (startRow === targetCell.row && startColumn === targetCell.column) {
        return ghost.userData.direction ?? { row: 0, column: 0 };
    }

    const rows = mazeLayout.length;
    const columns = mazeLayout[0].length;
    const visited = Array.from({ length: rows }, () => Array(columns).fill(false));
    const parent = Array.from({ length: rows }, () => Array(columns).fill(null));
    const queue = [{ row: startRow, column: startColumn }];
    visited[startRow][startColumn] = true;

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            break;
        }

        if (current.row === targetCell.row && current.column === targetCell.column) {
            break;
        }

        for (const direction of cardinalDirections) {
            const nextRow = current.row + direction.row;
            const nextColumn = current.column + direction.column;

            if (!isInsideGrid(mazeLayout, nextRow, nextColumn)) {
                continue;
            }

            if (mazeLayout[nextRow][nextColumn] !== 0) {
                continue;
            }

            if (blockCenterBox && centerMarkerCell && isInsideCenterBox(nextRow, nextColumn, centerMarkerCell)) {
                continue;
            }

            if (visited[nextRow][nextColumn]) {
                continue;
            }

            visited[nextRow][nextColumn] = true;
            parent[nextRow][nextColumn] = current;
            queue.push({ row: nextRow, column: nextColumn });
        }
    }

    if (!visited[targetCell.row]?.[targetCell.column]) {
        return pickChaseDirection(ghost, mazeLayout, tileSize, targetCell, options);
    }

    let step = { row: targetCell.row, column: targetCell.column };
    while (parent[step.row]?.[step.column]) {
        const prev = parent[step.row][step.column];
        if (!prev) {
            break;
        }
        if (prev.row === startRow && prev.column === startColumn) {
            break;
        }
        step = prev;
    }

    return {
        row: step.row - startRow,
        column: step.column - startColumn
    };
}

function tryMoveGhost(ghost, mazeLayout, tileSize, deltaSeconds, centerMarkerCell, mode, targetCell) {
    const currentDirection = ghost.userData.direction ?? { row: 0, column: 0 };
    const blockCenterBox = mode === 'return' ? false : (ghost.userData.hasLeftBox ?? false);
    const baseRadius = ghost.userData.radius ?? 0;
    const effectiveRadius = baseRadius;
    const directionOptions = {
        blockCenterBox,
        centerMarkerCell,
        ghostRadius: effectiveRadius,
        tileSize
    };

    const targetFallback = centerMarkerCell ?? worldToCell(ghost.position.x, ghost.position.z, tileSize);
    const resolvedTarget = targetCell ?? targetFallback;
    const steeringMode = mode;

    if (currentDirection.row === 0 && currentDirection.column === 0) {
        if (steeringMode === 'return') {
            ghost.userData.direction = pickShortestPathDirection(ghost, mazeLayout, tileSize, resolvedTarget, directionOptions);
        } else if (steeringMode === 'chase') {
            ghost.userData.direction = pickChaseDirection(ghost, mazeLayout, tileSize, resolvedTarget, directionOptions);
        } else if (steeringMode === 'flee') {
            ghost.userData.direction = pickFleeDirection(ghost, mazeLayout, tileSize, resolvedTarget, directionOptions);
        } else {
            ghost.userData.direction = pickGhostDirection(ghost, mazeLayout, tileSize, directionOptions);
        }
    }

    if (centerMarkerCell) {
        const { row, column } = worldToCell(ghost.position.x, ghost.position.z, tileSize);
        if (!isInsideCenterBox(row, column, centerMarkerCell)) {
            ghost.userData.hasLeftBox = true;
        }
    }

    if (isNearCellCenter(ghost.position, tileSize)) {
        if (ghost.userData.canTurn ?? true) {
            if (steeringMode === 'return') {
                ghost.userData.direction = pickShortestPathDirection(ghost, mazeLayout, tileSize, resolvedTarget, directionOptions);
            } else if (steeringMode === 'chase') {
                ghost.userData.direction = pickChaseDirection(ghost, mazeLayout, tileSize, resolvedTarget, directionOptions);
            } else if (steeringMode === 'flee') {
                ghost.userData.direction = pickFleeDirection(ghost, mazeLayout, tileSize, resolvedTarget, directionOptions);
            } else {
                ghost.userData.direction = pickGhostDirection(ghost, mazeLayout, tileSize, directionOptions);
            }
            ghost.userData.canTurn = false;
        }
    } else {
        ghost.userData.canTurn = true;
    }

    const speed = ghost.userData.speed ?? ghostSettings.moveSpeed;
    const step = speed * deltaSeconds;
    const nextX = ghost.position.x + ghost.userData.direction.column * step;
    const nextZ = ghost.position.z + ghost.userData.direction.row * step;
    const nextCell = worldToCell(nextX, nextZ, tileSize);
    const paddedRadius = effectiveRadius + ghostSettings.collisionPadding;
    const canMove = isWalkableAt(mazeLayout, nextX, nextZ, paddedRadius)
        && (!blockCenterBox || !centerMarkerCell || !isInsideCenterBox(nextCell.row, nextCell.column, centerMarkerCell));

    if (canMove) {
        ghost.position.x = nextX;
        ghost.position.z = nextZ;

        // Atualizar rotação do fantasma para a direção do movimento
        const dir = ghost.userData.direction;
        if (dir && (dir.row !== 0 || dir.column !== 0)) {
            // Ângulo em radianos: atan2(-row, column) para alinhar com o eixo X/Z
            const angle = Math.atan2(dir.row, dir.column);
            ghost.rotation.y = angle;
        }

        if (ghost.userData.direction.row !== 0) {
            ghost.position.x = Math.round(ghost.position.x / tileSize) * tileSize;
        } else if (ghost.userData.direction.column !== 0) {
            ghost.position.z = Math.round(ghost.position.z / tileSize) * tileSize;
        }
        return;
    }

    if (steeringMode === 'return') {
        ghost.userData.direction = pickShortestPathDirection(ghost, mazeLayout, tileSize, resolvedTarget, directionOptions);
        return;
    }

    if (steeringMode === 'chase') {
        ghost.userData.direction = pickChaseDirection(ghost, mazeLayout, tileSize, resolvedTarget, directionOptions);
        return;
    }

    if (steeringMode === 'flee') {
        ghost.userData.direction = pickFleeDirection(ghost, mazeLayout, tileSize, resolvedTarget, directionOptions);
        return;
    }

    ghost.userData.direction = pickGhostDirection(ghost, mazeLayout, tileSize, directionOptions);
}

function collidesWithGhosts(ghosts, nextX, nextZ, playerRadius) {
    if (!ghosts || ghosts.length === 0) {
        return false;
    }

    for (const ghost of ghosts) {
        const ghostRadius = ghost?.userData?.radius ?? 0;
        const dx = nextX - ghost.position.x;
        const dz = nextZ - ghost.position.z;
        const minDistance = playerRadius + ghostRadius;

        if (dx * dx + dz * dz <= minDistance * minDistance) {
            return true;
        }
    }

    return false;
}

function canMoveTo(mazeLayout, nextX, nextZ) {
    return isWalkableAt(mazeLayout, nextX, nextZ, playerSettings.playerRadius);
}

function buildGhost3D(color, tileSize) {
    const group = new THREE.Group();
    const radius = tileSize * ghostSettings.radiusRatio;
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.02,
        side: THREE.DoubleSide
    });

    const profile = [];
    const shoulderY = radius * 1.1;
    const domeSegments = 12;

    profile.push(new THREE.Vector2(0, -radius * 0.2));

    for (let i = 0; i <= domeSegments; i += 1) {
        const theta = (i / domeSegments) * (Math.PI / 2);
        const x = radius * Math.sin(theta);
        const y = shoulderY + radius * Math.cos(theta);
        profile.push(new THREE.Vector2(x, y));
    }

    profile.push(new THREE.Vector2(radius * 1.05, radius * 0.35));
    profile.push(new THREE.Vector2(radius * 1.1, radius * 0.12));
    profile.push(new THREE.Vector2(radius * 1.15, -radius * 0.2));
    profile.push(new THREE.Vector2(0, -radius * 0.2));

    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), bodyMaterial);
    body.position.y = -radius * 0.08;

    const skirtHeight = radius * 0.8;
    const skirtGeometry = new THREE.CylinderGeometry(radius * 1.02, radius * 0.95, skirtHeight, 48, 2, true);
    const skirt = new THREE.Mesh(skirtGeometry, bodyMaterial);
    skirt.position.y = -radius * 0.38;

    const skirtPositions = skirtGeometry.attributes.position;
    const waveCount = 10;
    const waveAmplitude = radius * 0.04;

    for (let i = 0; i < skirtPositions.count; i += 1) {
        const x = skirtPositions.getX(i);
        const y = skirtPositions.getY(i);
        const z = skirtPositions.getZ(i);
        const angle = Math.atan2(z, x);
        const wave = Math.sin(angle * waveCount) * waveAmplitude;

        if (y < 0) {
            skirtPositions.setY(i, y - wave);
            skirtPositions.setX(i, x * 0.98);
            skirtPositions.setZ(i, z * 0.98);
        }
    }

    skirtPositions.needsUpdate = true;
    skirtGeometry.computeVertexNormals();


    const eyeWhiteMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    });
    const eyePupilMaterial = new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
    });
    const eyeGeometry = new THREE.CircleGeometry(radius * 0.28, 20);
    const pupilGeometry = new THREE.CircleGeometry(radius * 0.12, 16);

    const leftEye = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
    const leftPupil = new THREE.Mesh(pupilGeometry, eyePupilMaterial);
    const rightPupil = new THREE.Mesh(pupilGeometry, eyePupilMaterial);

    leftEye.position.set(-radius * 0.32, radius * 0.90, radius * 1.02);
    rightEye.position.set(radius * 0.32, radius * 0.90, radius * 1.02);
    leftPupil.position.set(-radius * 0.32, radius * 0.90, radius * 1.11);
    rightPupil.position.set(radius * 0.32, radius * 0.90, radius * 1.11);

    group.add(body, skirt, leftEye, rightEye, leftPupil, rightPupil);
    group.userData.bodyMaterial = bodyMaterial;
    group.userData.bodyParts = [body, skirt];
    group.userData.eyeParts = [leftEye, rightEye, leftPupil, rightPupil];
    group.scale.y = 1.25;
    return group;
}

function buildGhost2D(color, tileSize) {
    const group = new THREE.Group();
    const radius = tileSize * ghostSettings.radiusRatio;
    const material = new THREE.MeshBasicMaterial({ color });
    const head = new THREE.Mesh(new THREE.CircleGeometry(radius, 18), material);
    head.position.y = radius * 0.4;

    const body = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 1.1), material);
    body.position.y = -radius * 0.25;

    const eyeWhiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const eye = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.18, 12), eyeWhiteMaterial);
    const eye2 = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.18, 12), eyeWhiteMaterial);
    eye.position.set(-radius * 0.25, radius * 0.35, 0.01);
    eye2.position.set(radius * 0.25, radius * 0.35, 0.01);

    const pupil = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.07, 10), pupilMaterial);
    const pupil2 = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.07, 10), pupilMaterial);
    pupil.position.set(-radius * 0.25, radius * 0.3, 0.02);
    pupil2.position.set(radius * 0.25, radius * 0.3, 0.02);

    group.add(head, body, eye, eye2, pupil, pupil2);
    group.userData.bodyMaterial = material;
    group.userData.bodyParts = [head, body];
    group.userData.eyeParts = [eye, eye2, pupil, pupil2];
    group.rotation.x = -Math.PI / 2;
    return group;
}

export function createPacmanModels({ tileSize }) {
    const group3d = new THREE.Group();
    const radius = tileSize * 0.24;
    const mouthAngle = Math.PI / 3;
    const bodyGeometry = new THREE.SphereGeometry(
        radius,
        24,
        18,
        mouthAngle * 0.5,
        Math.PI * 2 - mouthAngle,
        0,
        Math.PI
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.0 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.y = Math.PI / 2;

    const eye = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    eye.position.set(0, radius * 0.45, radius * 0.25);

    group3d.add(body, eye);
    group3d.userData.baseY = tileSize * 0.22;

    const group2d = new THREE.Group();
    const pacman2d = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 1.1, 24, mouthAngle * 0.5, Math.PI * 2 - mouthAngle),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    const eye2d = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.09, 10), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
    eye2d.position.set(0, radius * 0.4, 0.02);

    group2d.add(pacman2d, eye2d);
    group2d.userData.baseY = tileSize * 0.06;
    group2d.rotation.x = -Math.PI / 2;

    return { pacman3D: group3d, pacman2D: group2d };
}

function updatePerspectiveCamera(deltaSeconds, controls, camera, mazeLayout) {
    const forwardVector = new THREE.Vector3(-Math.sin(controls.yaw), 0, -Math.cos(controls.yaw));
    const rightVector = new THREE.Vector3(Math.cos(controls.yaw), 0, -Math.sin(controls.yaw));
    const movementVector = new THREE.Vector3();

    if (controls.forward) {
        movementVector.add(forwardVector);
    }

    if (controls.backward) {
        movementVector.addScaledVector(forwardVector, -1);
    }

    if (controls.left) {
        movementVector.addScaledVector(rightVector, -1);
    }

    if (controls.right) {
        movementVector.add(rightVector);
    }

    if (movementVector.lengthSq() > 0) {
        movementVector.normalize();
        const movementStep = playerSettings.moveSpeed * deltaSeconds;
        const nextX = camera.position.x + movementVector.x * movementStep;
        const nextZ = camera.position.z + movementVector.z * movementStep;

        if (canMoveTo(mazeLayout, nextX, camera.position.z)) {
            camera.position.x = nextX;
        }

        if (canMoveTo(mazeLayout, camera.position.x, nextZ)) {
            camera.position.z = nextZ;
        }
    }

    camera.position.y = playerSettings.playerEyeHeight;
    camera.rotation.y = controls.yaw;
    camera.rotation.x = controls.pitch;
}

function updateOrthographicMovement(deltaSeconds, controls, camera, mazeLayout) {
    const movementVector = new THREE.Vector3();

    if (controls.forward) {
        movementVector.z -= 1;
    }

    if (controls.backward) {
        movementVector.z += 1;
    }

    if (controls.left) {
        movementVector.x -= 1;
    }

    if (controls.right) {
        movementVector.x += 1;
    }

    if (movementVector.lengthSq() > 0) {
        movementVector.normalize();
        const movementStep = playerSettings.moveSpeed * deltaSeconds;
        const nextX = camera.position.x + movementVector.x * movementStep;
        const nextZ = camera.position.z + movementVector.z * movementStep;

        if (canMoveTo(mazeLayout, nextX, camera.position.z)) {
            camera.position.x = nextX;
        }

        if (canMoveTo(mazeLayout, camera.position.x, nextZ)) {
            camera.position.z = nextZ;
        }
    }

    camera.position.y = playerSettings.playerEyeHeight;
}

export function createPlayer({ camera, mazeLayout, tileSize }) {
    const controls = createControls();
    const spawnCell = findSpawnCell(mazeLayout);

    camera.position.set(
        spawnCell.column * tileSize,
        playerSettings.playerEyeHeight,
        spawnCell.row * tileSize
    );
    camera.rotation.order = 'YXZ';

    return { controls, spawnCell };
}

export function createGhosts({ scene, mazeLayout, centerMarkerCell, tileSize, wallHeight }) {
    const centerRow = Math.floor(mazeLayout.length / 2);
    const centerColumn = Math.floor(mazeLayout[0].length / 2);
    const centerCell = centerMarkerCell ?? { row: centerRow, column: centerColumn };
    const centerX = centerCell.column * tileSize;
    const centerZ = centerCell.row * tileSize;
    const ghostRadius = tileSize * ghostSettings.radiusRatio;
    const ghostHeight = (wallHeight + 0.15) * 0.3 + tileSize * 0.08;

    function resolveCellPosition(cell, fallbackX, fallbackZ) {
        if (isInsideGrid(mazeLayout, cell.row, cell.column) && mazeLayout[cell.row][cell.column] === 0) {
            return {
                x: cell.column * tileSize,
                z: cell.row * tileSize
            };
        }

        return { x: fallbackX, z: fallbackZ };
    }

    const leftCell = { row: centerCell.row, column: centerCell.column - 1 };
    const rightCell = { row: centerCell.row, column: centerCell.column + 1 };
    const upCell = { row: centerCell.row - 2, column: centerCell.column };

    const blueGhost = buildGhost3D(ghostColors.blue, tileSize);
    blueGhost.userData.radius = ghostRadius;
    blueGhost.userData.baseSpeed = ghostSettings.moveSpeed;
    blueGhost.userData.speed = ghostSettings.moveSpeed;
    blueGhost.userData.direction = { row: 0, column: 1 };
    blueGhost.userData.canTurn = true;
    blueGhost.userData.color = ghostColors.blue;
    blueGhost.userData.state = 'normal';
    const bluePosition = resolveCellPosition(leftCell, centerX, centerZ);
    blueGhost.position.set(bluePosition.x, ghostHeight, bluePosition.z);

    const redGhost = buildGhost3D(ghostColors.red, tileSize);
    redGhost.userData.radius = ghostRadius;
    redGhost.userData.baseSpeed = ghostSettings.moveSpeed * 1.05;
    redGhost.userData.speed = ghostSettings.moveSpeed * 1.05;
    redGhost.userData.direction = { row: 0, column: -1 };
    redGhost.userData.canTurn = true;
    redGhost.userData.color = ghostColors.red;
    redGhost.userData.state = 'normal';
    const redPosition = resolveCellPosition(rightCell, centerX, centerZ);
    redGhost.position.set(redPosition.x, ghostHeight, redPosition.z);

    const orangeGhost = buildGhost3D(ghostColors.orange, tileSize);
    orangeGhost.userData.radius = ghostRadius;
    orangeGhost.userData.baseSpeed = ghostSettings.moveSpeed * 0.92;
    orangeGhost.userData.speed = ghostSettings.moveSpeed * 0.92;
    orangeGhost.userData.direction = { row: -1, column: 0 };
    orangeGhost.userData.canTurn = true;
    orangeGhost.userData.color = ghostColors.orange;
    orangeGhost.userData.state = 'normal';
    const orangePosition = resolveCellPosition(centerCell, centerX, centerZ);
    orangeGhost.position.set(orangePosition.x, ghostHeight, orangePosition.z);

    const pinkGhost = buildGhost3D(ghostColors.pink, tileSize);
    pinkGhost.userData.radius = ghostRadius;
    pinkGhost.userData.baseSpeed = ghostSettings.moveSpeed * 0.98;
    pinkGhost.userData.speed = ghostSettings.moveSpeed * 0.98;
    pinkGhost.userData.direction = { row: 1, column: 0 };
    pinkGhost.userData.canTurn = true;
    pinkGhost.userData.color = ghostColors.pink;
    pinkGhost.userData.state = 'normal';
    const pinkPosition = resolveCellPosition(upCell, centerX, centerZ);
    pinkGhost.position.set(pinkPosition.x, ghostHeight, pinkPosition.z);

    scene.add(blueGhost, redGhost, orangeGhost, pinkGhost);

    for (const ghost of [blueGhost, redGhost, orangeGhost, pinkGhost]) {
        if (!isNearCellCenter(ghost.position, tileSize)) {
                ghost.userData.direction = pickGhostDirection(ghost, mazeLayout, tileSize, { blockCenterBox: false, centerMarkerCell });
        }
    }

    return [blueGhost, redGhost, orangeGhost, pinkGhost];
}

export function createGhosts2D({ ghosts, tileSize }) {
    return ghosts.map((ghost) => {
        const color = ghost.userData.color ?? ghostColors.blue;
        const ghost2d = buildGhost2D(color, tileSize);
        ghost2d.userData.baseColor = color;
        ghost2d.userData.state = 'normal';
        return ghost2d;
    });
}

export function updateGhosts({
    deltaSeconds,
    ghosts,
    mazeLayout,
    tileSize,
    centerMarkerCell,
    mode,
    targetCell,
    modeResolver,
    targetResolver
}) {
    for (const ghost of ghosts) {
        const resolvedMode = modeResolver ? modeResolver(ghost) : mode;
        const resolvedTarget = targetResolver ? targetResolver(ghost) : targetCell;
        tryMoveGhost(ghost, mazeLayout, tileSize, deltaSeconds, centerMarkerCell, resolvedMode, resolvedTarget);
    }
}

function setGhostMaterialColor(ghost, hexColor) {
    const material = ghost.userData.bodyMaterial;
    if (material && material.color) {
        material.color.setHex(hexColor);
    }
}

function setGhostPartsVisibility(ghost, showBody) {
    const bodyParts = ghost.userData.bodyParts ?? [];
    const eyeParts = ghost.userData.eyeParts ?? [];

    for (const part of bodyParts) {
        part.visible = showBody;
    }

    for (const part of eyeParts) {
        part.visible = true;
    }
}

function setGhostBodyOpacity(ghost, opacity) {
    const {bodyMaterial} = ghost.userData;
    if (!bodyMaterial) {
        return;
    }

    bodyMaterial.transparent = opacity < 1;
    bodyMaterial.opacity = opacity;
}

export function setGhostState(ghost, state) {
    if (!ghost) {
        return;
    }

    const baseSpeed = ghost.userData.baseSpeed ?? ghostSettings.moveSpeed;
    const baseColor = ghost.userData.color ?? ghostColors.blue;

    if (state === 'eyes') {
        ghost.userData.speed = baseSpeed * 3;
        setGhostBodyOpacity(ghost, 0);
        setGhostPartsVisibility(ghost, true);
    } else if (state === 'scared') {
        ghost.userData.speed = baseSpeed;
        setGhostBodyOpacity(ghost, 1);
        setGhostMaterialColor(ghost, ghostFrightenedColor);
        setGhostPartsVisibility(ghost, true);
    } else {
        ghost.userData.speed = baseSpeed;
        setGhostBodyOpacity(ghost, 1);
        setGhostMaterialColor(ghost, baseColor);
        setGhostPartsVisibility(ghost, true);
    }

    ghost.userData.state = state;
}

export function setGhost2DState(ghost2d, state, baseColor) {
    if (!ghost2d) {
        return;
    }

    const {
        bodyMaterial,
        bodyParts = [],
        eyeParts = [],
        baseColor: storedBaseColor
    } = ghost2d.userData;
    const resolvedBaseColor = baseColor ?? storedBaseColor ?? ghostColors.blue;

    const setBodyOpacity = (opacity) => {
        if (!bodyMaterial) {
            return;
        }
        bodyMaterial.transparent = opacity < 1;
        bodyMaterial.opacity = opacity;
    };

    if (state === 'eyes') {
        setBodyOpacity(0);

        for (const part of bodyParts) {
            part.visible = true;
        }

        for (const part of eyeParts) {
            part.visible = true;
        }
    } else {
        setBodyOpacity(1);
        const nextColor = state === 'scared' ? ghostFrightenedColor : resolvedBaseColor;
        if (bodyMaterial && bodyMaterial.color) {
            bodyMaterial.color.setHex(nextColor);
        }

        for (const part of bodyParts) {
            part.visible = true;
        }

        for (const part of eyeParts) {
            part.visible = true;
        }
    }

    ghost2d.userData.state = state;
    ghost2d.userData.baseColor = resolvedBaseColor;
}

export function isGhostInsideCenterBox(ghost, centerMarkerCell, tileSize) {
    if (!ghost || !centerMarkerCell) {
        return false;
    }

    const { row, column } = worldToCell(ghost.position.x, ghost.position.z, tileSize);
    return row === centerMarkerCell.row && column === centerMarkerCell.column;
}

export function playerIsTouchingGhosts({ playerX, playerZ, playerRadius, ghosts }) {
    return collidesWithGhosts(ghosts, playerX, playerZ, playerRadius);
}

export function createCoins({
    scene,
    mazeLayout,
    tileSize,
    excludedCells = [],
    centerMarkerCell = null,
    exclusionRadius = 0,
    powerCoinCount = 0
}) {
    const coinRadius = tileSize * coinSettings.radiusRatio;
    const coinGeometry = new THREE.SphereGeometry(coinRadius, 16, 10);
    const powerGeometry = (() => {
        const baseGeometry = new THREE.OctahedronGeometry(coinRadius * 1.05);
        const geometry = baseGeometry.toNonIndexed();
        const lightColor = new THREE.Color(0xfff3b4);
        const darkColor = new THREE.Color(0xc79b3a);
        const colors = [];
        const vertexCount = geometry.attributes.position.count;

        for (let i = 0; i < vertexCount; i += 3) {
            const faceIndex = i / 3;
            const faceColor = (faceIndex % 2 === 0) ? lightColor : darkColor;
            for (let v = 0; v < 3; v += 1) {
                colors.push(faceColor.r, faceColor.g, faceColor.b);
            }
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        return geometry;
    })();
    const powerGeometry2D = new THREE.PlaneGeometry(coinRadius * 1.9, coinRadius * 1.9);
    const coinMaterial = new THREE.MeshBasicMaterial({ color: 0xfde68a });
    const powerMaterial3D = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.35,
        metalness: 0.1
    });
    const powerMaterial2D = new THREE.MeshBasicMaterial({
        color: 0xfde68a,
        side: THREE.DoubleSide
    });
    const coinGroup = new THREE.Group();
    const excludedCellSet = new Set(excludedCells.map(({ row, column }) => `${row},${column}`));
    const bannedRows = new Set([9, 10, 11, 12, 13]);
    const bannedColumns = new Set([11, 12, 13, 14, 15, 16, 17]);
    const coins = [];
    const radiusSquared = exclusionRadius * exclusionRadius;

    for (let row = 1; row < mazeLayout.length - 1; row += 1) {
        for (let column = 1; column < mazeLayout[row].length - 1; column += 1) {
            if (mazeLayout[row][column] !== 0) {
                continue;
            }

            if (excludedCellSet.has(`${row},${column}`)) {
                continue;
            }

            if (centerMarkerCell && exclusionRadius > 0) {
                const dx = column - centerMarkerCell.column;
                const dz = row - centerMarkerCell.row;

                if (dx * dx + dz * dz <= radiusSquared) {
                    continue;
                }
            }

            if (bannedRows.has(row) && bannedColumns.has(column)) {
                continue;
            }

            const coin = new THREE.Mesh(coinGeometry, coinMaterial);
            coin.position.set(column * tileSize, coinSettings.baseHeight, row * tileSize);
            coin.userData.radius = coinRadius;
            coin.userData.collected = false;
            coin.userData.baseHeight = coinSettings.baseHeight;
            coin.userData.floatOffset = Math.random() * Math.PI * 2;
            coin.userData.isPower = false;
            coinGroup.add(coin);
            coins.push(coin);
        }
    }

    const selectable = coins.slice();
    for (let i = selectable.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = selectable[i];
        selectable[i] = selectable[j];
        selectable[j] = temp;
    }

    const powerCount = Math.min(powerCoinCount, selectable.length);
    for (let i = 0; i < powerCount; i += 1) {
        const coin = selectable[i];
        coin.userData.isPower = true;
        coin.geometry = powerGeometry;
        coin.material = powerMaterial3D;
        coin.scale.setScalar(2.0);
        coin.userData.baseHeight = coinSettings.baseHeight + coinRadius * 0.65;
        coin.position.y = coin.userData.baseHeight;
        coin.userData.spinSpeed = 1.6 + Math.random() * 0.6;
        coin.userData.spinOffset = Math.random() * Math.PI * 2;
        coin.userData.powerGeometry3D = powerGeometry;
        coin.userData.powerMaterial3D = powerMaterial3D;
        coin.userData.powerGeometry2D = powerGeometry2D;
        coin.userData.powerMaterial2D = powerMaterial2D;
    }

    scene.add(coinGroup);

    return { coinGroup, coins };
}

export function updateCoins({ elapsedSeconds, coins, view = 'perspective' }) {
    for (const coin of coins) {
        if (coin.userData.collected) {
            continue;
        }

        const baseHeight = coin.userData.baseHeight ?? coinSettings.baseHeight;
        const floatOffset = coin.userData.floatOffset ?? 0;

        if (coin.userData.isPower) {
            coin.position.y = baseHeight;

            if (view === 'orthographic') {
                const { powerGeometry2D, powerMaterial2D } = coin.userData;
                if (powerGeometry2D && coin.geometry !== powerGeometry2D) {
                    coin.geometry = powerGeometry2D;
                }
                if (powerMaterial2D && coin.material !== powerMaterial2D) {
                    coin.material = powerMaterial2D;
                }
                coin.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
            } else {
                const { powerGeometry3D, powerMaterial3D } = coin.userData;
                if (powerGeometry3D && coin.geometry !== powerGeometry3D) {
                    coin.geometry = powerGeometry3D;
                }
                if (powerMaterial3D && coin.material !== powerMaterial3D) {
                    coin.material = powerMaterial3D;
                }
                const spinSpeed = coin.userData.spinSpeed ?? 1.8;
                const spinOffset = coin.userData.spinOffset ?? 0;
                coin.rotation.set(0, elapsedSeconds * spinSpeed + spinOffset, 0);
            }
        } else {
            coin.position.y = baseHeight + Math.sin(elapsedSeconds * coinSettings.floatSpeed + floatOffset) * coinSettings.floatAmplitude;
        }
    }
}

export function collectCoins({ playerX, playerZ, playerRadius, coins }) {
    let collectedCount = 0;
    let powerCollected = 0;

    for (const coin of coins) {
        if (coin.userData.collected) {
            continue;
        }

        const dx = playerX - coin.position.x;
        const dz = playerZ - coin.position.z;
        const coinRadius = coin.userData.radius ?? 0;
        const collectionRadius = playerRadius + coinRadius;

        if (dx * dx + dz * dz <= collectionRadius * collectionRadius) {
            coin.userData.collected = true;
            coin.visible = false;
            collectedCount += 1;
            if (coin.userData.isPower) {
                powerCollected += 1;
            }
        }
    }

    return { collectedCount, powerCollected };
}

export function updatePlayer({ deltaSeconds, controls, camera, mazeLayout }) {
    if (controls.view === 'orthographic') {
        updateOrthographicMovement(deltaSeconds, controls, camera, mazeLayout);
        return;
    }

    updatePerspectiveCamera(deltaSeconds, controls, camera, mazeLayout);
}
