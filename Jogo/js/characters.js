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
    moveSpeed: 1.15
};

export const coinSettings = {
    radiusRatio: 0.11,
    baseHeight: 0.2,
    floatAmplitude: 0.06,
    floatSpeed: 2.4
};

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

    for (const direction of cardinalDirections) {
        const nextRow = row + direction.row;
        const nextColumn = column + direction.column;

        const isWalkable = ghostRadius && tileSize
            ? isWalkableAt(mazeLayout, nextColumn * tileSize, nextRow * tileSize, ghostRadius)
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

function tryMoveGhost(ghost, mazeLayout, tileSize, deltaSeconds, centerMarkerCell, mode, targetCell) {
    const currentDirection = ghost.userData.direction ?? { row: 0, column: 0 };
    const blockCenterBox = ghost.userData.hasLeftBox ?? false;
    const directionOptions = {
        blockCenterBox,
        centerMarkerCell,
        ghostRadius: ghost.userData.radius,
        tileSize
    };

    if (currentDirection.row === 0 && currentDirection.column === 0) {
        ghost.userData.direction = mode === 'chase'
            ? pickChaseDirection(ghost, mazeLayout, tileSize, targetCell, directionOptions)
            : pickGhostDirection(ghost, mazeLayout, tileSize, directionOptions);
    }

    if (centerMarkerCell) {
        const { row, column } = worldToCell(ghost.position.x, ghost.position.z, tileSize);
        if (!isInsideCenterBox(row, column, centerMarkerCell)) {
            ghost.userData.hasLeftBox = true;
        }
    }

    if (isNearCellCenter(ghost.position, tileSize)) {
        if (ghost.userData.canTurn ?? true) {
            ghost.userData.direction = mode === 'chase'
                ? pickChaseDirection(ghost, mazeLayout, tileSize, targetCell, directionOptions)
                : pickGhostDirection(ghost, mazeLayout, tileSize, directionOptions);
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
    const ghostRadius = ghost.userData.radius ?? 0;
    const canMove = isWalkableAt(mazeLayout, nextX, nextZ, ghostRadius)
        && (!blockCenterBox || !centerMarkerCell || !isInsideCenterBox(nextCell.row, nextCell.column, centerMarkerCell));

    if (canMove) {
        ghost.position.x = nextX;
        ghost.position.z = nextZ;

        if (ghost.userData.direction.row !== 0) {
            ghost.position.x = Math.round(ghost.position.x / tileSize) * tileSize;
        } else if (ghost.userData.direction.column !== 0) {
            ghost.position.z = Math.round(ghost.position.z / tileSize) * tileSize;
        }
        return;
    }

    ghost.userData.direction = mode === 'chase'
        ? pickChaseDirection(ghost, mazeLayout, tileSize, targetCell, directionOptions)
        : pickGhostDirection(ghost, mazeLayout, tileSize, directionOptions);
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
    const ghostHeight = (wallHeight + 0.15) * 0.5;
    const ghostGeometry = new THREE.SphereGeometry(ghostRadius, 32, 24);

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

    const blueGhost = new THREE.Mesh(
        ghostGeometry,
        new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45, metalness: 0.05 })
    );
    blueGhost.userData.radius = ghostRadius;
    blueGhost.userData.speed = ghostSettings.moveSpeed;
    blueGhost.userData.direction = { row: 0, column: 1 };
    blueGhost.userData.canTurn = true;
    const bluePosition = resolveCellPosition(leftCell, centerX, centerZ);
    blueGhost.position.set(bluePosition.x, ghostHeight, bluePosition.z);

    const redGhost = new THREE.Mesh(
        ghostGeometry,
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45, metalness: 0.05 })
    );
    redGhost.userData.radius = ghostRadius;
    redGhost.userData.speed = ghostSettings.moveSpeed * 1.05;
    redGhost.userData.direction = { row: 0, column: -1 };
    redGhost.userData.canTurn = true;
    const redPosition = resolveCellPosition(rightCell, centerX, centerZ);
    redGhost.position.set(redPosition.x, ghostHeight, redPosition.z);

    const greenGhost = new THREE.Mesh(
        ghostGeometry,
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.45, metalness: 0.05 })
    );
    greenGhost.userData.radius = ghostRadius;
    greenGhost.userData.speed = ghostSettings.moveSpeed * 0.92;
    greenGhost.userData.direction = { row: -1, column: 0 };
    greenGhost.userData.canTurn = true;
    const greenPosition = resolveCellPosition(centerCell, centerX, centerZ);
    greenGhost.position.set(greenPosition.x, ghostHeight, greenPosition.z);

    const pinkGhost = new THREE.Mesh(
        ghostGeometry,
        new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.45, metalness: 0.05 })
    );
    pinkGhost.userData.radius = ghostRadius;
    pinkGhost.userData.speed = ghostSettings.moveSpeed * 0.98;
    pinkGhost.userData.direction = { row: 1, column: 0 };
    pinkGhost.userData.canTurn = true;
    const pinkPosition = resolveCellPosition(upCell, centerX, centerZ);
    pinkGhost.position.set(pinkPosition.x, ghostHeight, pinkPosition.z);

    scene.add(blueGhost, redGhost, greenGhost, pinkGhost);

    for (const ghost of [blueGhost, redGhost, greenGhost, pinkGhost]) {
        if (!isNearCellCenter(ghost.position, tileSize)) {
                ghost.userData.direction = pickGhostDirection(ghost, mazeLayout, tileSize, { blockCenterBox: false, centerMarkerCell });
        }
    }

    return [blueGhost, redGhost, greenGhost, pinkGhost];
}

export function updateGhosts({ deltaSeconds, ghosts, mazeLayout, tileSize, centerMarkerCell, mode, targetCell }) {
    for (const ghost of ghosts) {
        tryMoveGhost(ghost, mazeLayout, tileSize, deltaSeconds, centerMarkerCell, mode, targetCell);
    }
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
    exclusionRadius = 0
}) {
    const coinRadius = tileSize * coinSettings.radiusRatio;
    const coinGeometry = new THREE.SphereGeometry(coinRadius, 16, 10);
    const coinMaterial = new THREE.MeshBasicMaterial({ color: 0xfde68a });
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
            coinGroup.add(coin);
            coins.push(coin);
        }
    }

    scene.add(coinGroup);

    return { coinGroup, coins };
}

export function updateCoins({ elapsedSeconds, coins }) {
    for (const coin of coins) {
        if (coin.userData.collected) {
            continue;
        }

        const baseHeight = coin.userData.baseHeight ?? coinSettings.baseHeight;
        const floatOffset = coin.userData.floatOffset ?? 0;
        coin.position.y = baseHeight + Math.sin(elapsedSeconds * coinSettings.floatSpeed + floatOffset) * coinSettings.floatAmplitude;
    }
}

export function collectCoins({ playerX, playerZ, playerRadius, coins }) {
    let collectedCount = 0;

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
        }
    }

    return collectedCount;
}

export function updatePlayer({ deltaSeconds, controls, camera, mazeLayout }) {
    if (controls.view === 'orthographic') {
        updateOrthographicMovement(deltaSeconds, controls, camera, mazeLayout);
        return;
    }

    updatePerspectiveCamera(deltaSeconds, controls, camera, mazeLayout);
}
