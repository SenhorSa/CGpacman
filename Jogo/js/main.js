import * as THREE from 'three';
import { createMaze, getCenterMarkerCell, getMazeData } from './maze.js';
import {
    collectCoins,
    createCoins,
    createGhosts,
    createPlayer,
    playerIsTouchingGhosts,
    playerSettings,
    updateCoins,
    updateGhosts,
    updatePlayer
} from './characters.js';

const appElement = document.getElementById('app');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1116);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
appElement.appendChild(renderer.domElement);

const hudElement = document.createElement('div');
hudElement.className = 'overlay';
hudElement.innerHTML = `
    <h1>Pacman 3D</h1>
    <p id="hud-score">Pontos: 0</p>
    <p id="hud-state">Colete as moedas e fuja dos fantasmas.</p>
    <span class="hint">WASD move | Mouse olha | Espaço alterna vista | R reinicia</span>
`;
document.body.appendChild(hudElement);

const scoreElement = hudElement.querySelector('#hud-score');
const stateElement = hudElement.querySelector('#hud-state');

const coinFlipSettings = {
    intervalMs: 30000,
    revealDelayMs: 500,
    flipDurationMs: 1500,
    resultHoldMs: 1500,
    weightStep: 0.1,
    minWeight: 0.01,
    maxWeight: 0.99
};

let ghostMode = 'roam';
let chaseWeight = 0.5;
let coinRotation = 0;
let flipAnimationId = null;
let flipTimeoutId = null;

const coinWrapper = document.createElement('div');
coinWrapper.style.position = 'fixed';
coinWrapper.style.top = '8px';
coinWrapper.style.left = '50%';
coinWrapper.style.transform = 'translateX(-50%)';
coinWrapper.style.width = '52px';
coinWrapper.style.height = '52px';
coinWrapper.style.perspective = '600px';
coinWrapper.style.zIndex = '10';
coinWrapper.style.display = 'none';

const coinInner = document.createElement('div');
coinInner.style.width = '100%';
coinInner.style.height = '100%';
coinInner.style.position = 'relative';
coinInner.style.transformStyle = 'preserve-3d';
coinInner.style.transform = 'rotateY(0deg)';

const coinFront = document.createElement('div');
coinFront.textContent = 'P';
coinFront.style.position = 'absolute';
coinFront.style.inset = '0';
coinFront.style.display = 'flex';
coinFront.style.alignItems = 'center';
coinFront.style.justifyContent = 'center';
coinFront.style.background = '#f8fafc';
coinFront.style.border = '2px solid #0f172a';
coinFront.style.borderRadius = '50%';
coinFront.style.color = '#0f172a';
coinFront.style.fontWeight = '700';
coinFront.style.fontSize = '20px';
coinFront.style.backfaceVisibility = 'hidden';

const coinBack = document.createElement('div');
coinBack.textContent = 'V';
coinBack.style.position = 'absolute';
coinBack.style.inset = '0';
coinBack.style.display = 'flex';
coinBack.style.alignItems = 'center';
coinBack.style.justifyContent = 'center';
coinBack.style.background = '#f8fafc';
coinBack.style.border = '2px solid #0f172a';
coinBack.style.borderRadius = '50%';
coinBack.style.color = '#0f172a';
coinBack.style.fontWeight = '700';
coinBack.style.fontSize = '20px';
coinBack.style.transform = 'rotateY(180deg)';
coinBack.style.backfaceVisibility = 'hidden';

coinInner.appendChild(coinFront);
coinInner.appendChild(coinBack);
coinWrapper.appendChild(coinInner);
document.body.appendChild(coinWrapper);

function pickGhostMode() {
    const roll = Math.random();
    const nextMode = roll < chaseWeight ? 'chase' : 'roam';

    if (nextMode === 'chase') {
        chaseWeight = Math.max(coinFlipSettings.minWeight, chaseWeight - coinFlipSettings.weightStep);
    } else {
        chaseWeight = Math.min(coinFlipSettings.maxWeight, chaseWeight + coinFlipSettings.weightStep);
    }

    ghostMode = nextMode;
    return nextMode;
}

function animateCoinFlip(targetDegrees) {
    if (flipAnimationId) {
        cancelAnimationFrame(flipAnimationId);
    }

    const startRotation = coinRotation;
    const startTime = performance.now();
    const duration = coinFlipSettings.flipDurationMs;

    const animate = (time) => {
        const progress = Math.min((time - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const angle = startRotation + (targetDegrees - startRotation) * eased;
        coinInner.style.transform = `rotateY(${angle}deg)`;

        if (progress < 1) {
            flipAnimationId = requestAnimationFrame(animate);
            return;
        }

        coinRotation = targetDegrees % 360;
        coinInner.style.transform = `rotateY(${coinRotation}deg)`;
        setTimeout(() => {
            coinWrapper.style.display = 'none';
        }, coinFlipSettings.resultHoldMs);
        flipAnimationId = null;
    };

    flipAnimationId = requestAnimationFrame(animate);
}

function startCoinFlipCycle() {
    const nextMode = pickGhostMode();
    const finalFace = nextMode === 'chase' ? 0 : 180;
    const targetRotation = finalFace + 720;

    coinWrapper.style.display = 'block';

    if (flipTimeoutId) {
        clearTimeout(flipTimeoutId);
    }

    flipTimeoutId = setTimeout(() => {
        animateCoinFlip(targetRotation);
    }, coinFlipSettings.revealDelayMs);
}

setTimeout(() => {
    startCoinFlipCycle();
    setInterval(startCoinFlipCycle, coinFlipSettings.intervalMs);
}, coinFlipSettings.intervalMs);

const mazeRows = 23;
const mazeColumns = 33;
const tileSize = 1;
const wallHeight = 1;

const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 2.2);
mainLight.position.set(8, 12, 6);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
mainLight.shadow.bias = -0.0003;
mainLight.shadow.normalBias = 0.04;
mainLight.shadow.camera.left = -10;
mainLight.shadow.camera.right = 10;
mainLight.shadow.camera.top = 10;
mainLight.shadow.camera.bottom = -10;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 30;
scene.add(mainLight);

const wallMaterialPerspective = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.9, metalness: 0.0 });
const wallMaterialOrthographic = new THREE.MeshBasicMaterial({
    color: 0x1a73ff,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
});
const floorMaterialPerspective = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 1.0, metalness: 0.0 });
const floorMaterialOrthographic = new THREE.MeshBasicMaterial({ color: 0x111827, toneMapped: false });
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 1.0, metalness: 0.0, side: THREE.BackSide });
const borderGuideMaterial = new THREE.LineBasicMaterial({ color: 0xe5e7eb });

const { mazeLayout, mazeGroup, floor, ceiling } = createMaze({
    scene,
    tileSize,
    wallHeight,
    mazeRows,
    mazeColumns,
    materials: {
        wallMaterialPerspective,
        floorMaterialPerspective,
        ceilingMaterial,
        borderGuideMaterial
    }
});

const { mazeWidth, mazeHeight, mazeCenterX, mazeCenterZ } = getMazeData(mazeLayout, tileSize);
const centerMarkerCell = getCenterMarkerCell();

const playerSpotlight = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 24),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
);
playerSpotlight.rotation.x = -Math.PI / 2;
playerSpotlight.position.y = 0.06;
scene.add(playerSpotlight);

const perspectiveCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

const orthoSize = Math.max(mazeWidth, mazeHeight) * 0.6;
const orthographicCameraHeight = 18;
const orthographicCamera = new THREE.OrthographicCamera(
    -orthoSize,
    orthoSize,
    orthoSize,
    -orthoSize,
    0.1,
    100
);
orthographicCamera.position.set(mazeCenterX, orthographicCameraHeight, mazeCenterZ);
orthographicCamera.lookAt(mazeCenterX, 0, mazeCenterZ);

const { controls, spawnCell } = createPlayer({ camera: perspectiveCamera, mazeLayout, tileSize });

const ghosts = createGhosts({ scene, mazeLayout, centerMarkerCell, tileSize, wallHeight });

const ghostCells = ghosts.map((ghost) => ({
    row: Math.round(ghost.position.z / tileSize),
    column: Math.round(ghost.position.x / tileSize)
}));

const { coins } = createCoins({
    scene,
    mazeLayout,
    tileSize,
    excludedCells: [spawnCell, ...ghostCells],
    centerMarkerCell,
    exclusionRadius: 2
});

let collectedCoinsCount = 0;
let gameState = 'playing';

let activeCamera = perspectiveCamera;
let activeView = 'perspective';

function setHudState(message) {
    stateElement.textContent = message;
}

function setScore(value) {
    scoreElement.textContent = `Pontos: ${value}`;
}

function endGame(message) {
    gameState = 'finished';
    setHudState(message);
}

setScore(collectedCoinsCount);
setHudState('Colete as moedas e fuja dos fantasmas.');

function activatePerspectiveView() {
    activeCamera = perspectiveCamera;
    activeView = 'perspective';
    controls.view = 'perspective';
    floor.material = floorMaterialPerspective;
    ceiling.visible = true;

    for (const wall of mazeGroup.children) {
        if (wall.userData?.isPanel) {
            continue;
        }
        wall.material = wallMaterialPerspective;
    }
}

function activateOrthographicView() {
    activeCamera = orthographicCamera;
    activeView = 'orthographic';
    controls.view = 'orthographic';
    floor.material = floorMaterialOrthographic;
    ceiling.visible = false;

    for (const wall of mazeGroup.children) {
        if (wall.userData?.isPanel) {
            continue;
        }
        wall.material = wallMaterialOrthographic;
    }
}

function toggleCamera() {
    if (activeView === 'perspective') {
        activateOrthographicView();
        return;
    }

    activatePerspectiveView();
}

window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyR') {
        window.location.reload();
        return;
    }

    switch (event.code) {
        case 'KeyW':
            controls.forward = true;
            break;
        case 'KeyS':
            controls.backward = true;
            break;
        case 'KeyA':
            controls.left = true;
            break;
        case 'KeyD':
            controls.right = true;
            break;
        case 'Digit1':
            activatePerspectiveView();
            break;
        case 'Digit2':
            activateOrthographicView();
            break;
        case 'Space':
            event.preventDefault();
            toggleCamera();
            break;
        default:
            break;
    }
});

window.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW':
            controls.forward = false;
            break;
        case 'KeyS':
            controls.backward = false;
            break;
        case 'KeyA':
            controls.left = false;
            break;
        case 'KeyD':
            controls.right = false;
            break;
        default:
            break;
    }
});

renderer.domElement.addEventListener('pointerdown', (event) => {
    if (activeView !== 'perspective') {
        return;
    }

    controls.dragging = true;
    controls.previousX = event.clientX;
    controls.previousY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener('pointermove', (event) => {
    if (!controls.dragging || activeView !== 'perspective') {
        return;
    }

    const deltaX = event.clientX - controls.previousX;
    const deltaY = event.clientY - controls.previousY;

    controls.yaw -= deltaX * playerSettings.mouseSensitivity;
    controls.pitch -= deltaY * playerSettings.mouseSensitivity;
    controls.pitch = Math.max(-1.25, Math.min(1.25, controls.pitch));

    controls.previousX = event.clientX;
    controls.previousY = event.clientY;
});

renderer.domElement.addEventListener('pointerup', (event) => {
    controls.dragging = false;
    renderer.domElement.releasePointerCapture(event.pointerId);
});

window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);

    perspectiveCamera.aspect = window.innerWidth / window.innerHeight;
    perspectiveCamera.updateProjectionMatrix();

    const aspect = window.innerWidth / window.innerHeight;
    const halfMazeHeightWithMargin = (mazeHeight + 2) * 0.5;
    orthographicCamera.left = -halfMazeHeightWithMargin * aspect;
    orthographicCamera.right = halfMazeHeightWithMargin * aspect;
    orthographicCamera.top = halfMazeHeightWithMargin;
    orthographicCamera.bottom = -halfMazeHeightWithMargin;
    orthographicCamera.updateProjectionMatrix();
}

const clock = new THREE.Clock();

function animate() {
    const deltaSeconds = clock.getDelta();

    if (gameState === 'playing') {
        updateCoins({
            elapsedSeconds: clock.elapsedTime,
            coins
        });

        updatePlayer({
            deltaSeconds,
            controls,
            camera: perspectiveCamera,
            mazeLayout,
            tileSize,
            ghosts
        });

        updateGhosts({
            deltaSeconds,
            ghosts,
            mazeLayout,
            tileSize,
            centerMarkerCell,
            mode: ghostMode,
            targetCell: {
                row: Math.round(perspectiveCamera.position.z / tileSize),
                column: Math.round(perspectiveCamera.position.x / tileSize)
            }
        });

        const playerCaught = playerIsTouchingGhosts({
            playerX: perspectiveCamera.position.x,
            playerZ: perspectiveCamera.position.z,
            playerRadius: playerSettings.playerRadius,
            ghosts
        });

        if (playerCaught) {
            endGame('Game over. Um fantasma apanhou o jogador. Pressiona R para reiniciar.');
        } else {
            const newlyCollected = collectCoins({
                playerX: perspectiveCamera.position.x,
                playerZ: perspectiveCamera.position.z,
                playerRadius: playerSettings.playerRadius,
                coins
            });

            if (newlyCollected > 0) {
                collectedCoinsCount += newlyCollected;
                setScore(collectedCoinsCount);
            }

            if (collectedCoinsCount >= coins.length) {
                endGame('Venceste. Todas as moedas foram apanhadas. Pressiona R para reiniciar.');
            }
        }
    }

    if (activeView === 'orthographic') {
        orthographicCamera.position.y = orthographicCameraHeight;
        orthographicCamera.lookAt(mazeCenterX, 0, mazeCenterZ);
    }

    playerSpotlight.position.x = perspectiveCamera.position.x;
    playerSpotlight.position.z = perspectiveCamera.position.z;

    renderer.render(scene, activeCamera);
    requestAnimationFrame(animate);
}

activatePerspectiveView();
onWindowResize();
animate();
