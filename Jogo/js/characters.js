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
    spacingUnits: 2
};

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

export function createPlayer({ camera, mazeLayout, tileSize }) {
    const controls = createControls();
    const spawnCell = findSpawnCell(mazeLayout);

    camera.position.set(
        spawnCell.column * tileSize,
        playerSettings.playerEyeHeight,
        spawnCell.row * tileSize
    );
    camera.rotation.order = 'YXZ';

    return { controls };
}

export function createGhosts({ scene, mazeCenterX, mazeCenterZ, tileSize, wallHeight }) {
    const ghostRadius = tileSize * ghostSettings.radiusRatio;
    const ghostHeight = (wallHeight + 0.15) * 0.5;
    const spacing = tileSize * ghostSettings.spacingUnits;
    const ghostGeometry = new THREE.SphereGeometry(ghostRadius, 32, 24);

    const blueGhost = new THREE.Mesh(
        ghostGeometry,
        new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45, metalness: 0.05 })
    );
    blueGhost.userData.radius = ghostRadius;
    blueGhost.position.set(mazeCenterX - spacing, ghostHeight, mazeCenterZ);

    const redGhost = new THREE.Mesh(
        ghostGeometry,
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45, metalness: 0.05 })
    );
    redGhost.userData.radius = ghostRadius;
    redGhost.position.set(mazeCenterX + spacing, ghostHeight, mazeCenterZ);

    const greenGhost = new THREE.Mesh(
        ghostGeometry,
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.45, metalness: 0.05 })
    );
    greenGhost.userData.radius = ghostRadius;
    greenGhost.position.set(mazeCenterX, ghostHeight, mazeCenterZ);

    scene.add(blueGhost, redGhost, greenGhost);

    return [blueGhost, redGhost, greenGhost];
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

function canMoveTo(mazeLayout, ghosts, nextX, nextZ) {
    if (!isWalkableAt(mazeLayout, nextX, nextZ, playerSettings.playerRadius)) {
        return false;
    }

    return !collidesWithGhosts(ghosts, nextX, nextZ, playerSettings.playerRadius);
}

function updatePerspectiveCamera(deltaSeconds, controls, camera, mazeLayout, ghosts) {
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

        if (canMoveTo(mazeLayout, ghosts, nextX, camera.position.z)) {
            camera.position.x = nextX;
        }

        if (canMoveTo(mazeLayout, ghosts, camera.position.x, nextZ)) {
            camera.position.z = nextZ;
        }
    }

    camera.position.y = playerSettings.playerEyeHeight;
    camera.rotation.y = controls.yaw;
    camera.rotation.x = controls.pitch;
}

function updateOrthographicMovement(deltaSeconds, controls, camera, mazeLayout, ghosts) {
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

        if (canMoveTo(mazeLayout, ghosts, nextX, camera.position.z)) {
            camera.position.x = nextX;
        }

        if (canMoveTo(mazeLayout, ghosts, camera.position.x, nextZ)) {
            camera.position.z = nextZ;
        }
    }

    camera.position.y = playerSettings.playerEyeHeight;
}

export function updatePlayer({ deltaSeconds, controls, camera, mazeLayout, ghosts }) {
    if (controls.view === 'orthographic') {
        updateOrthographicMovement(deltaSeconds, controls, camera, mazeLayout, ghosts);
        return;
    }

    updatePerspectiveCamera(deltaSeconds, controls, camera, mazeLayout, ghosts);
}
