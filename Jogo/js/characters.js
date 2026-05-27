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
    collisionPadding: 0.03,
    faceTurnSpeed: 7.0
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

const dogColors = {
    golden:  0xb07030,
    brown:   0x7a4520,
    tawny:   0x9a5a2c,
    caramel: 0xa06228
};

const robotColors = {
    steelBlue: 0x4A6880,
    rustGrey: 0x705040,
    oliveGrey: 0x506050,
    slateGrey: 0x504858
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

            if (
                !isInsideGrid(mazeLayout, nextRow, nextColumn)
                || mazeLayout[nextRow][nextColumn] !== 0
                || (blockCenterBox && centerMarkerCell && isInsideCenterBox(nextRow, nextColumn, centerMarkerCell))
                || visited[nextRow][nextColumn]
            ) {
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
        if (!prev || (prev.row === startRow && prev.column === startColumn)) {
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

        if (ghost.userData.direction.row) {
            ghost.position.x = Math.round(ghost.position.x / tileSize) * tileSize;
        } else if (ghost.userData.direction.column) {
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
    updateGhostFaceOrientation(ghost, deltaSeconds);
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

    const bodyGeometry = new THREE.LatheGeometry(profile, 48);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = -radius * 0.08;

    const bodyPositions = bodyGeometry.attributes.position;
    const waveCount = 10;
    const waveAmplitude = radius * 0.04;
    const waveStartY = -radius * 0.04;

    for (let i = 0; i < bodyPositions.count; i += 1) {
        const x = bodyPositions.getX(i);
        const y = bodyPositions.getY(i);
        const z = bodyPositions.getZ(i);

        if (y < waveStartY) {
            const angle = Math.atan2(z, x);
            const wave = Math.sin(angle * waveCount) * waveAmplitude;
            bodyPositions.setY(i, y - wave);
            bodyPositions.setX(i, x * 0.98);
            bodyPositions.setZ(i, z * 0.98);
        }
    }

    bodyPositions.needsUpdate = true;
    bodyGeometry.computeVertexNormals();


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

    const faceGroup = new THREE.Group();
    const leftEye = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
    const leftPupil = new THREE.Mesh(pupilGeometry, eyePupilMaterial);
    const rightPupil = new THREE.Mesh(pupilGeometry, eyePupilMaterial);

    leftEye.position.set(-radius * 0.32, radius * 0.90, radius * 1.02);
    rightEye.position.set(radius * 0.32, radius * 0.90, radius * 1.02);
    leftPupil.position.set(-radius * 0.32, radius * 0.90, radius * 1.11);
    rightPupil.position.set(radius * 0.32, radius * 0.90, radius * 1.11);

    faceGroup.add(leftEye, rightEye, leftPupil, rightPupil);
    group.add(body, faceGroup);
    group.userData.bodyMaterial = bodyMaterial;
    group.userData.bodyParts = [body];
    group.userData.eyeParts = [leftEye, rightEye, leftPupil, rightPupil];
    group.userData.faceGroup = faceGroup;
    group.userData.faceYaw = 0;
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
    const faceGroup = new THREE.Group();
    const eye = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.18, 12), eyeWhiteMaterial);
    const eye2 = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.18, 12), eyeWhiteMaterial);
    eye.position.set(-radius * 0.25, radius * 0.35, 0.01);
    eye2.position.set(radius * 0.25, radius * 0.35, 0.01);

    const pupil = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.07, 10), pupilMaterial);
    const pupil2 = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.07, 10), pupilMaterial);
    pupil.position.set(-radius * 0.25, radius * 0.3, 0.02);
    pupil2.position.set(radius * 0.25, radius * 0.3, 0.02);

    faceGroup.add(eye, eye2, pupil, pupil2);
    group.add(head, body, faceGroup);
    group.userData.bodyMaterial = material;
    group.userData.bodyParts = [head, body];
    group.userData.eyeParts = [eye, eye2, pupil, pupil2];
    group.userData.faceGroup = faceGroup;
    group.userData.faceYaw = 0;
    group.rotation.x = -Math.PI / 2;
    return group;
}

function buildDog3D(color, tileSize) {
    const group = new THREE.Group();
    const r = tileSize * ghostSettings.radiusRatio;

    const skinMat = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.0 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xe8e2cc, emissive: 0xd0cab0, emissiveIntensity: 0.55 });
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.4 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x6a0808, roughness: 0.75, side: THREE.DoubleSide });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x050303, roughness: 0.25 });

    // Torso — elongated sphere scaled to sinewy dog shape
    const torso = new THREE.Mesh(new THREE.SphereGeometry(r * 0.50, 10, 7), skinMat);
    torso.scale.set(0.76, 0.66, 1.42);
    group.add(torso);

    // Shoulder muscle bulge
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 8, 6), skinMat);
    shoulder.scale.set(1.18, 0.70, 0.88);
    shoulder.position.set(0, r * 0.18, r * 0.40);
    group.add(shoulder);

    // Neck — cylinder angled forward
    const neckH = r * 0.46;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.27, neckH, 8), skinMat);
    neck.position.set(0, r * 0.20, r * 0.48);
    neck.rotation.x = -0.52;
    group.add(neck);

    // Head
    const headW = r * 0.60;
    const headH = r * 0.48;
    const headD = r * 0.58;
    const hY = r * 0.22;
    const hZ = r * 0.88;
    const head = new THREE.Mesh(new THREE.BoxGeometry(headW, headH, headD), skinMat);
    head.position.set(0, hY, hZ);
    group.add(head);

    // Ears — pointed Doberman-style cones
    for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(r * 0.10, r * 0.36, 5), skinMat);
        ear.position.set(side * headW * 0.40, hY + headH * 0.5 + r * 0.17, hZ - r * 0.04);
        ear.rotation.z = side * 0.10;
        group.add(ear);
    }

    // Upper snout
    const snoutW = headW * 0.72;
    const snoutH = headH * 0.30;
    const snoutD = r * 0.52;
    const snoutY = hY - headH * 0.14;
    const snoutZ = hZ + headD * 0.5 + snoutD * 0.44;
    const snout = new THREE.Mesh(new THREE.BoxGeometry(snoutW, snoutH, snoutD), skinMat);
    snout.position.set(0, snoutY, snoutZ);
    group.add(snout);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 8, 6), noseMat);
    nose.scale.set(1, 0.72, 0.82);
    nose.position.set(0, snoutY, snoutZ + snoutD * 0.5 + r * 0.02);
    group.add(nose);

    // Lower jaw — slightly dropped open
    const jawW = snoutW * 0.88;
    const jawH = snoutH * 0.76;
    const jawD = snoutD * 0.92;
    const jawY = snoutY - snoutH * 0.58 - jawH * 0.5;
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(jawW, jawH, jawD), skinMat);
    jaw.position.set(0, jawY, snoutZ - r * 0.04);
    group.add(jaw);

    // Mouth interior
    const mouthPlane = new THREE.Mesh(new THREE.PlaneGeometry(snoutW * 0.82, snoutH * 0.75), mouthMat);
    mouthPlane.rotation.x = 0.22;
    mouthPlane.position.set(0, snoutY - snoutH * 0.48, snoutZ + snoutD * 0.12);
    group.add(mouthPlane);

    // Upper teeth (6 cones pointing down)
    const tw = r * 0.036;
    const th = r * 0.10;
    for (let i = 0; i < 6; i += 1) {
        const tx = (i - 2.5) * (snoutW * 0.68 / 5);
        const upper = new THREE.Mesh(new THREE.ConeGeometry(tw, th, 4), toothMat);
        upper.rotation.x = Math.PI;
        upper.position.set(tx, snoutY - snoutH * 0.42, snoutZ + snoutD * 0.14);
        group.add(upper);
    }
    // Lower teeth (4 cones pointing up, offset)
    for (let i = 0; i < 4; i += 1) {
        const tx = (i - 1.5) * (snoutW * 0.58 / 3);
        const lower = new THREE.Mesh(new THREE.ConeGeometry(tw * 0.85, th * 0.88, 4), toothMat);
        lower.position.set(tx, jawY + jawH * 0.42, snoutZ + snoutD * 0.10);
        group.add(lower);
    }

    // Eyes — pale milky white (unsettling)
    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.10, 9, 7), eyeMat);
        eye.position.set(side * headW * 0.27, hY + headH * 0.10, hZ + headD * 0.44);
        group.add(eye);
    }

    // Leg geometry constants
    const legTop = -r * 0.06;
    const fuH = r * 0.37;
    const flH = r * 0.42;
    const lr  = r * 0.092;
    const buH = r * 0.34;
    const blH = r * 0.38;

    // Shoulder and hip joint connectors
    for (const side of [-1, 1]) {
        const sc = new THREE.Mesh(new THREE.SphereGeometry(lr * 2.1, 8, 6), skinMat);
        sc.position.set(side * r * 0.29, legTop + r * 0.04, r * 0.33);
        group.add(sc);
        const hc = new THREE.Mesh(new THREE.SphereGeometry(lr * 1.9, 8, 6), skinMat);
        hc.position.set(side * r * 0.27, legTop + r * 0.04, -r * 0.35);
        group.add(hc);
    }

    // Each leg is a sub-group whose LOCAL origin is the pivot (attachment point at top).
    // Geometry hangs down from y=0 of the sub-group so rotation.x swings the leg fore/aft.
    // Quadruped trot: diagonal pairs share phase (FL+BR=0, FR+BL=π).
    const legDefs = [
        { x:  r * 0.29, z:  r * 0.34, front: true,  phase: 0       },  // front-left
        { x: -r * 0.29, z:  r * 0.34, front: true,  phase: Math.PI },  // front-right
        { x: -r * 0.27, z: -r * 0.36, front: false, phase: 0       },  // back-right
        { x:  r * 0.27, z: -r * 0.36, front: false, phase: Math.PI },  // back-left
    ];

    const legGroups = [];
    for (const def of legDefs) {
        const lg = new THREE.Group();
        lg.position.set(def.x, legTop, def.z);

        if (def.front) {
            const fu = new THREE.Mesh(new THREE.CylinderGeometry(lr * 0.90, lr * 0.76, fuH, 7), skinMat);
            fu.position.y = -fuH * 0.5;
            lg.add(fu);
            const fl = new THREE.Mesh(new THREE.CylinderGeometry(lr * 0.60, lr * 0.48, flH, 6), skinMat);
            fl.position.set(0, -fuH - flH * 0.5, r * 0.02);
            lg.add(fl);
            const fp = new THREE.Mesh(new THREE.SphereGeometry(lr * 1.12, 7, 5), skinMat);
            fp.scale.set(1.3, 0.50, 1.6);
            fp.position.set(0, -fuH - flH, r * 0.03);
            lg.add(fp);
        } else {
            const bu = new THREE.Mesh(new THREE.CylinderGeometry(lr * 1.18, lr * 0.88, buH, 7), skinMat);
            bu.position.y = -buH * 0.5;
            lg.add(bu);
            const bl = new THREE.Mesh(new THREE.CylinderGeometry(lr * 0.56, lr * 0.44, blH, 6), skinMat);
            bl.position.set(0, -buH - blH * 0.5, r * 0.02);
            lg.add(bl);
            const bp = new THREE.Mesh(new THREE.SphereGeometry(lr * 1.02, 7, 5), skinMat);
            bp.scale.set(1.25, 0.48, 1.52);
            bp.position.set(0, -buH - blH, r * 0.01);
            lg.add(bp);
        }

        group.add(lg);
        legGroups.push({ mesh: lg, phase: def.phase });
    }

    // Tail
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.038, r * 0.022, r * 0.48, 6), skinMat);
    tail.position.set(0, r * 0.04, -r * 0.62);
    tail.rotation.x = 0.48;
    group.add(tail);

    group.userData.bodyMaterial = skinMat;
    group.userData.bodyParts = [torso, shoulder, neck, head, snout, jaw, tail];
    group.userData.eyeParts = [];
    group.userData.faceGroup = null;
    group.userData.faceYaw = 0;
    group.userData.rotateFullBody = true;
    group.userData.legGroups = legGroups;
    return group;
}

function buildDog2D(color, tileSize) {
    const group = new THREE.Group();
    const r = tileSize * ghostSettings.radiusRatio;

    const bodyMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const tanMat  = new THREE.MeshBasicMaterial({ color: 0xd4a060, side: THREE.DoubleSide });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x1a0d06, side: THREE.DoubleSide });

    // Body — elongated oval
    const body = new THREE.Mesh(new THREE.CircleGeometry(r * 0.50, 16), bodyMat);
    body.scale.set(0.84, 1.18, 1);
    body.position.set(0, -r * 0.06, 0);
    group.add(body);

    // Tail nub at rear
    const tail = new THREE.Mesh(new THREE.CircleGeometry(r * 0.14, 8), bodyMat);
    tail.position.set(r * 0.22, -r * 0.60, 0.002);
    group.add(tail);

    // Head
    const head = new THREE.Mesh(new THREE.CircleGeometry(r * 0.34, 14), bodyMat);
    head.position.set(0, r * 0.50, 0.002);
    group.add(head);

    // Ears (tan, always visible)
    const earL = new THREE.Mesh(new THREE.CircleGeometry(r * 0.165, 10), tanMat);
    earL.scale.set(0.70, 1.05, 1);
    earL.position.set(-r * 0.32, r * 0.58, 0.004);
    group.add(earL);
    const earR = new THREE.Mesh(new THREE.CircleGeometry(r * 0.165, 10), tanMat);
    earR.scale.set(0.70, 1.05, 1);
    earR.position.set(r * 0.32, r * 0.58, 0.004);
    group.add(earR);

    // Snout patch (tan, always visible)
    const snout = new THREE.Mesh(new THREE.CircleGeometry(r * 0.175, 10), tanMat);
    snout.position.set(0, r * 0.58, 0.006);
    group.add(snout);

    // Nose (dark, always visible)
    const nose = new THREE.Mesh(new THREE.CircleGeometry(r * 0.055, 7), darkMat);
    nose.position.set(0, r * 0.64, 0.010);
    group.add(nose);

    // Eyes (dark, always visible)
    const eyeL = new THREE.Mesh(new THREE.CircleGeometry(r * 0.058, 7), darkMat);
    eyeL.position.set(-r * 0.12, r * 0.50, 0.010);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.CircleGeometry(r * 0.058, 7), darkMat);
    eyeR.position.set(r * 0.12, r * 0.50, 0.010);
    group.add(eyeR);

    group.userData.bodyMaterial = bodyMat;
    group.userData.bodyParts    = [body, head, tail];
    group.userData.eyeParts     = [earL, earR, snout, nose, eyeL, eyeR];
    group.userData.faceGroup    = null;
    group.userData.faceYaw      = 0;
    group.rotation.x = -Math.PI / 2;
    return group;
}

function buildRobot3D(color, tileSize) {
    const group = new THREE.Group();
    const r = tileSize * ghostSettings.radiusRatio;
    const s = r * 1.6; // overall scale — bigger, humanoid proportions

    const bodyMat  = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.68 });
    const darkMat  = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.55, metalness: 0.72 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3800, emissiveIntensity: 1.6, roughness: 0.08, metalness: 0.90 });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x888c92, roughness: 0.28, metalness: 0.88 });

    // Origin is at floor level (y=0 = feet), everything builds upward.

    // ── LEGS ────────────────────────────────────────────────────────
    const footH = s * 0.10, footD = s * 0.30;
    const lLegH = s * 0.38, uLegH = s * 0.42;
    const legR2 = s * 0.10, kneeR = s * 0.095;
    const legSpan = s * 0.22;
    const hipY = footH + lLegH + uLegH;

    const makeLeg = (side) => {
        const lg = new THREE.Group();
        lg.position.set(side * legSpan, hipY, 0);
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(legR2, legR2 * 0.84, uLegH, 8), bodyMat);
        thigh.position.set(0, -uLegH * 0.5, 0);
        lg.add(thigh);
        const knee = new THREE.Mesh(new THREE.SphereGeometry(kneeR, 8, 6), jointMat);
        knee.position.set(0, -uLegH, 0);
        lg.add(knee);
        const shin = new THREE.Mesh(new THREE.CylinderGeometry(legR2 * 0.76, legR2 * 0.68, lLegH, 8), darkMat);
        shin.position.set(0, -uLegH - lLegH * 0.5, 0);
        lg.add(shin);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(legR2 * 1.6, footH, footD), darkMat);
        foot.position.set(0, -uLegH - lLegH - footH * 0.5, footD * 0.15);
        lg.add(foot);
        group.add(lg);
        return lg;
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);

    // ── PELVIS ──────────────────────────────────────────────────────
    const pelH = s * 0.14, pelW = s * 0.50, pelD = s * 0.32;
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(pelW, pelH, pelD), darkMat);
    pelvis.position.set(0, hipY + pelH * 0.5, 0);
    group.add(pelvis);

    // ── ABDOMEN ─────────────────────────────────────────────────────
    const abdH = s * 0.20;
    const abdomen = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.20, s * 0.22, abdH, 10), darkMat);
    const abdY = hipY + pelH + abdH * 0.5;
    abdomen.position.set(0, abdY, 0);
    group.add(abdomen);

    // ── CHEST ───────────────────────────────────────────────────────
    const chestH = s * 0.46, chestTop = s * 0.28, chestBot = s * 0.24;
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(chestTop, chestBot, chestH, 10), bodyMat);
    const chestY = abdY + abdH * 0.5 + chestH * 0.5;
    chest.position.set(0, chestY, 0);
    group.add(chest);

    // chest plate detail
    const plate = new THREE.Mesh(new THREE.BoxGeometry(chestTop * 1.3, chestH * 0.58, chestTop * 0.14), darkMat);
    plate.position.set(0, chestY, chestTop * 0.92);
    group.add(plate);

    // ── NECK ────────────────────────────────────────────────────────
    const neckH = s * 0.13;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.09, s * 0.11, neckH, 8), darkMat);
    const neckY = chestY + chestH * 0.5 + neckH * 0.5;
    neck.position.set(0, neckY, 0);
    group.add(neck);

    // ── HEAD ────────────────────────────────────────────────────────
    const headRad = s * 0.25;
    const head = new THREE.Mesh(new THREE.SphereGeometry(headRad, 12, 9), bodyMat);
    head.scale.set(1.0, 0.88, 0.86);
    const headY = neckY + neckH * 0.5 + headRad * 0.86;
    head.position.set(0, headY, 0);
    group.add(head);

    // visor slit (glowing eye)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(headRad * 1.32, headRad * 0.17, s * 0.038), visorMat);
    visor.position.set(0, headY + headRad * 0.10, headRad * 0.84);
    group.add(visor);

    // antenna
    const antH = s * 0.17;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.016, s * 0.011, antH, 5), darkMat);
    ant.position.set(0, headY + headRad * 0.84 + antH * 0.5, 0);
    group.add(ant);
    const antTip = new THREE.Mesh(new THREE.SphereGeometry(s * 0.034, 6, 5), visorMat);
    antTip.position.set(0, headY + headRad * 0.84 + antH + s * 0.034, 0);
    group.add(antTip);

    // ── SHOULDERS ───────────────────────────────────────────────────
    const shlR = s * 0.12;
    const shlY = chestY + chestH * 0.28;
    const shlLX = -(chestTop + shlR * 0.55);
    const shlRX =  (chestTop + shlR * 0.55);
    const shlMeshL = new THREE.Mesh(new THREE.SphereGeometry(shlR, 8, 6), jointMat);
    shlMeshL.position.set(shlLX, shlY, 0);
    group.add(shlMeshL);
    const shlMeshR = new THREE.Mesh(new THREE.SphereGeometry(shlR, 8, 6), jointMat);
    shlMeshR.position.set(shlRX, shlY, 0);
    group.add(shlMeshR);

    // ── ARMS ────────────────────────────────────────────────────────
    const uArmH = s * 0.38, lArmH = s * 0.32;
    const uArmR2 = s * 0.085, lArmR2 = s * 0.070, elbR = s * 0.075;
    const handW = s * 0.11, handH = s * 0.13;

    const makeArm = (side) => {
        const ag = new THREE.Group();
        ag.position.set(side < 0 ? shlLX : shlRX, shlY, 0);
        const uArm = new THREE.Mesh(new THREE.CylinderGeometry(uArmR2, uArmR2 * 0.84, uArmH, 8), bodyMat);
        uArm.position.set(0, -uArmH * 0.5, 0);
        ag.add(uArm);
        const elbow = new THREE.Mesh(new THREE.SphereGeometry(elbR, 8, 6), jointMat);
        elbow.position.set(0, -uArmH, 0);
        ag.add(elbow);
        const lArm = new THREE.Mesh(new THREE.CylinderGeometry(lArmR2, lArmR2 * 0.88, lArmH, 8), darkMat);
        lArm.position.set(0, -uArmH - lArmH * 0.5, 0);
        ag.add(lArm);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(handW, handH, handW * 0.85), darkMat);
        hand.position.set(0, -uArmH - lArmH - handH * 0.5, 0);
        ag.add(hand);
        group.add(ag);
        return ag;
    };
    const armL = makeArm(-1);
    const armR = makeArm(1);

    // ── ANIMATION ───────────────────────────────────────────────────
    group.userData.legGroups = [
        { mesh: legL,  phase: 0,       amplitude: 0.40 },
        { mesh: legR,  phase: Math.PI, amplitude: 0.40 },
        { mesh: armL,  phase: Math.PI, amplitude: 0.24 },
        { mesh: armR,  phase: 0,       amplitude: 0.24 },
    ];

    group.userData.bodyMaterial = bodyMat;
    group.userData.bodyParts    = [chest, pelvis, abdomen, neck, head, plate];
    group.userData.eyeParts     = [visor, antTip];
    group.userData.faceGroup    = null;
    group.userData.faceYaw      = 0;
    group.userData.rotateFullBody = true;
    return group;
}

function buildRobot2D(color, tileSize) {
    const group = new THREE.Group();
    const r = tileSize * ghostSettings.radiusRatio;

    const bodyMat   = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const silverMat = new THREE.MeshBasicMaterial({ color: 0x8898a8, side: THREE.DoubleSide });
    const darkMat   = new THREE.MeshBasicMaterial({ color: 0x14181e, side: THREE.DoubleSide });
    const cyanMat   = new THREE.MeshBasicMaterial({ color: 0x00d4ff, side: THREE.DoubleSide });

    // Torso
    const torso = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.86, r * 0.98), bodyMat);
    torso.position.set(0, -r * 0.12, 0);
    group.add(torso);

    // Shoulder pads
    const shlL = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.22, r * 0.32), bodyMat);
    shlL.position.set(-r * 0.57, r * 0.06, 0.002);
    group.add(shlL);
    const shlR = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.22, r * 0.32), bodyMat);
    shlR.position.set(r * 0.57, r * 0.06, 0.002);
    group.add(shlR);

    // Waist belt (dark, fixed)
    const waist = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.86, r * 0.10), darkMat);
    waist.position.set(0, -r * 0.48, 0.002);
    group.add(waist);

    // Boots (dark, fixed)
    const bootL = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.28, r * 0.20), darkMat);
    bootL.position.set(-r * 0.24, -r * 0.67, 0.002);
    group.add(bootL);
    const bootR = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.28, r * 0.20), darkMat);
    bootR.position.set(r * 0.24, -r * 0.67, 0.002);
    group.add(bootR);

    // Helmet ring (silver, fixed)
    const helmet = new THREE.Mesh(new THREE.CircleGeometry(r * 0.35, 14), silverMat);
    helmet.position.set(0, r * 0.48, 0.002);
    group.add(helmet);

    // Helmet body (bodyMat, changes with state)
    const helmetBody = new THREE.Mesh(new THREE.CircleGeometry(r * 0.27, 14), bodyMat);
    helmetBody.position.set(0, r * 0.48, 0.004);
    group.add(helmetBody);

    // Cyan visor (fixed, always visible)
    const visor = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.44, r * 0.09), cyanMat);
    visor.position.set(0, r * 0.51, 0.008);
    group.add(visor);

    // Cyan chest emitter (fixed, always visible)
    const emitter = new THREE.Mesh(new THREE.CircleGeometry(r * 0.075, 8), cyanMat);
    emitter.position.set(0, r * 0.05, 0.006);
    group.add(emitter);

    group.userData.bodyMaterial = bodyMat;
    group.userData.bodyParts    = [torso, shlL, shlR, helmetBody];
    group.userData.eyeParts     = [helmet, visor, emitter, waist, bootL, bootR];
    group.userData.faceGroup    = null;
    group.userData.faceYaw      = 0;
    group.rotation.x = -Math.PI / 2;
    return group;
}

export function createPacmanModels({ tileSize }) {
    const group3d = new THREE.Group();
    const radius = tileSize * 0.24;
    const openAngle   = Math.PI / 3;   // 60° — fully open
    const closedAngle = Math.PI / 18;  // 10° — almost closed

    // 3D body — open mouth as base, closed mouth as morph target
    const openGeo3D = new THREE.SphereGeometry(radius, 24, 18,
        openAngle * 0.5, Math.PI * 2 - openAngle, 0, Math.PI);
    const closedGeo3D = new THREE.SphereGeometry(radius, 24, 18,
        closedAngle * 0.5, Math.PI * 2 - closedAngle, 0, Math.PI);
    openGeo3D.morphAttributes.position = [closedGeo3D.attributes.position.clone()];

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.0 });
    const body = new THREE.Mesh(openGeo3D, bodyMaterial);
    body.morphTargetInfluences = [0];
    body.rotation.y = Math.PI / 2;

    const eye = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    eye.position.set(0, radius * 0.45, radius * 0.25);

    group3d.add(body, eye);
    group3d.userData.baseY    = tileSize * 0.22;
    group3d.userData.mouthMesh = body;

    // 2D body — same morph target approach
    const group2d = new THREE.Group();
    const openGeo2D = new THREE.CircleGeometry(radius * 1.1, 24,
        openAngle * 0.5, Math.PI * 2 - openAngle);
    const closedGeo2D = new THREE.CircleGeometry(radius * 1.1, 24,
        closedAngle * 0.5, Math.PI * 2 - closedAngle);
    openGeo2D.morphAttributes.position = [closedGeo2D.attributes.position.clone()];

    const pacman2d = new THREE.Mesh(openGeo2D, new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    pacman2d.morphTargetInfluences = [0];

    const eye2d = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.09, 10), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
    eye2d.position.set(0, radius * 0.4, 0.02);

    group2d.add(pacman2d, eye2d);
    group2d.userData.baseY     = tileSize * 0.06;
    group2d.userData.mouthMesh = pacman2d;
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

    const targetCell = { row: spawnCell.row, column: 0 };
    const targetX = targetCell.column * tileSize;
    const targetZ = targetCell.row * tileSize;
    const dirX = targetX - camera.position.x;
    const dirZ = targetZ - camera.position.z;
    if (dirX !== 0 || dirZ !== 0) {
        controls.yaw = Math.atan2(dirX, -dirZ);
        camera.rotation.y = controls.yaw;
    }

    return { controls, spawnCell };
}

export function createGhosts({ scene, mazeLayout, centerMarkerCell, tileSize, wallHeight, enemyType = 'ghost' }) {
    const centerRow = Math.floor(mazeLayout.length / 2);
    const centerColumn = Math.floor(mazeLayout[0].length / 2);
    const centerCell = centerMarkerCell ?? { row: centerRow, column: centerColumn };
    const centerX = centerCell.column * tileSize;
    const centerZ = centerCell.row * tileSize;
    const ghostRadius = tileSize * ghostSettings.radiusRatio;
    const enemyHeight = enemyType === 'ghost'
        ? (wallHeight + 0.15) * 0.3 + tileSize * 0.08
        : enemyType === 'robot' ? 0
        : tileSize * 0.22;

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

    const colorMap = enemyType === 'dog' ? dogColors : enemyType === 'robot' ? robotColors : ghostColors;
    const colorList = Object.values(colorMap);
    const buildFn = enemyType === 'dog' ? buildDog3D : enemyType === 'robot' ? buildRobot3D : buildGhost3D;
    const initialDirections = [
        { row: 0, column: 1 },
        { row: 0, column: -1 },
        { row: -1, column: 0 },
        { row: 1, column: 0 }
    ];
    const speedMultipliers = [1.0, 1.05, 0.92, 0.98];
    const spawnCells = [leftCell, rightCell, centerCell, upCell];

    const enemies = initialDirections.map((dir, i) => {
        const enemy = buildFn(colorList[i] ?? colorList[0], tileSize);
        enemy.userData.radius = ghostRadius;
        enemy.userData.baseSpeed = ghostSettings.moveSpeed * speedMultipliers[i];
        enemy.userData.speed = ghostSettings.moveSpeed * speedMultipliers[i];
        enemy.userData.direction = { ...dir };
        enemy.userData.canTurn = true;
        enemy.userData.color = colorList[i] ?? colorList[0];
        enemy.userData.state = 'normal';
        const pos = resolveCellPosition(spawnCells[i], centerX, centerZ);
        enemy.position.set(pos.x, enemyHeight, pos.z);
        return enemy;
    });

    scene.add(...enemies);

    for (const enemy of enemies) {
        if (!isNearCellCenter(enemy.position, tileSize)) {
            enemy.userData.direction = pickGhostDirection(enemy, mazeLayout, tileSize, { blockCenterBox: false, centerMarkerCell });
        }
        const dir = enemy.userData.direction ?? { row: 0, column: 0 };
        enemy.userData.faceYaw = dir.row || dir.column ? Math.atan2(dir.column, dir.row) : 0;
        if (enemy.userData.rotateFullBody) {
            enemy.rotation.y = enemy.userData.faceYaw;
        } else if (enemy.userData.faceGroup) {
            enemy.userData.faceGroup.rotation.y = enemy.userData.faceYaw;
        }
    }

    return enemies;
}

export function createGhosts2D({ ghosts, tileSize, enemyType = 'ghost' }) {
    return ghosts.map((ghost) => {
        const color = ghost.userData.color ?? ghostColors.blue;
        let ghost2d;
        if (enemyType === 'dog') {
            ghost2d = buildDog2D(color, tileSize);
        } else if (enemyType === 'robot') {
            ghost2d = buildRobot2D(color, tileSize);
        } else {
            ghost2d = buildGhost2D(color, tileSize);
        }
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
        updateGhostFaceOrientation(ghost, deltaSeconds);
        updateEnemyLegs(ghost, deltaSeconds);
    }
}

function updateEnemyLegs(ghost, deltaSeconds) {
    const { legGroups } = ghost.userData;
    if (!legGroups || legGroups.length === 0) {
        return;
    }

    const dir = ghost.userData.direction;
    const isMoving = Boolean(dir && (dir.row !== 0 || dir.column !== 0));

    if (isMoving) {
        ghost.userData.walkTime = (ghost.userData.walkTime ?? 0) + deltaSeconds;
    }

    const t = ghost.userData.walkTime ?? 0;
    const speed = ghost.userData.speed ?? ghostSettings.moveSpeed;
    const freq = speed * 4.8;

    for (const leg of legGroups) {
        const amp = leg.amplitude ?? 0.44;
        if (isMoving) {
            leg.mesh.rotation.x = Math.sin(t * freq + leg.phase) * amp;
        } else {
            leg.mesh.rotation.x *= Math.max(0, 1 - deltaSeconds * 10);
        }
    }
}

function updateGhostFaceOrientation(ghost, deltaSeconds) {
    if (!ghost) {
        return;
    }

    const dir = ghost.userData.direction ?? { row: 0, column: 0 };
    if (!dir.row && !dir.column) {
        return;
    }

    const targetYaw = Math.atan2(dir.column, dir.row);
    const currentYaw = ghost.userData.faceYaw ?? 0;
    const maxStep = ghostSettings.faceTurnSpeed * deltaSeconds;
    const wrappedDelta = ((targetYaw - currentYaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    const clampedDelta = Math.abs(wrappedDelta) <= maxStep ? wrappedDelta : Math.sign(wrappedDelta) * maxStep;
    const nextYaw = currentYaw + clampedDelta;

    ghost.userData.faceYaw = nextYaw;

    if (ghost.userData.rotateFullBody) {
        ghost.rotation.y = nextYaw;
        return;
    }

    const { faceGroup } = ghost.userData;
    if (!faceGroup) {
        return;
    }
    faceGroup.rotation.y = nextYaw;
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
