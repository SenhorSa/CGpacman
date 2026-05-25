import * as THREE from 'three';
import { createMaze, getCenterMarkerCell, getMazeData } from './maze.js';
import { bindLightNumberKeys, registerLight } from './lights.js';
import {
    collectCoins,
    createCoins,
    createGhosts,
    createGhosts2D,
    createPacmanModels,
    createPlayer,
    playerSettings,
    isGhostInsideCenterBox,
    setGhost2DState,
    setGhostState,
    updateCoins,
    updateGhosts,
    updatePlayer
} from './characters.js';

function createWallTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }

    ctx.fillStyle = '#890509';
    ctx.fillRect(0, 0, size, size);

    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const panelCount = 5;
    const panelWidth = Math.ceil(size / panelCount);
    for (let i = 0; i < panelCount; i += 1) {
        const x = i * panelWidth;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.04 + Math.random() * 0.05})`;
        ctx.fillRect(x + 2, 0, panelWidth - 4, size);

        ctx.fillStyle = 'rgba(28, 22, 18, 0.55)';
        ctx.fillRect(x, 0, 2, size);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(x + panelWidth - 2, 0, 2, size);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let y = 0; y < size; y += 12) {
        ctx.fillRect(0, y, size, 1);
    }

    ctx.fillStyle = 'rgba(53, 45, 36, 0.45)';
    for (let i = 0; i < 20; i += 1) {
        const stainX = Math.random() * size;
        const stainY = Math.random() * size;
        const stainRadius = 10 + Math.random() * 26;
        ctx.beginPath();
        ctx.ellipse(stainX, stainY, stainRadius, stainRadius * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = 'rgba(62, 79, 60, 0.32)';
    for (let i = 0; i < 14; i += 1) {
        const moldX = Math.random() * size;
        const moldY = Math.random() * size;
        const moldRadius = 6 + Math.random() * 18;
        ctx.beginPath();
        ctx.ellipse(moldX, moldY, moldRadius, moldRadius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = 'rgba(27, 22, 18, 0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i += 1) {
        const startX = Math.random() * size;
        const startY = Math.random() * size;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + Math.random() * 50 - 25, startY + Math.random() * 40 - 20);
        ctx.stroke();
    }

    const imageData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 30;
        imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
        imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    texture.anisotropy = 4;
    return texture;
}

function createCarpetFloorTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }

    ctx.fillStyle = '#bb8f29';
    ctx.fillRect(0, 0, size, size);

    const hexRadius = size / 12;
    const hexHeight = Math.sqrt(3) * hexRadius;
    const stepX = hexRadius * 1.5;
    const stepY = hexHeight;
    const innerRadius = hexRadius * 0.62;
    const coreRadius = hexRadius * 0.35;

    const drawHex = (cx, cy, radius, strokeStyle, lineWidth) => {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
            const angle = Math.PI / 6 + i * (Math.PI / 3);
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.stroke();
    };

    for (let col = -2; col < size / stepX + 2; col += 1) {
        const x = col * stepX;
        const offsetY = col % 2 === 0 ? 0 : stepY / 2;
        for (let row = -2; row < size / stepY + 2; row += 1) {
            const y = row * stepY + offsetY;
            const centerX = x + hexRadius;
            const centerY = y + hexHeight / 2;
            if (centerX < -hexRadius || centerX > size + hexRadius || centerY < -hexHeight || centerY > size + hexHeight) {
                continue;
            }

            drawHex(centerX, centerY, hexRadius, 'rgba(94, 66, 28, 0.55)', 2);
            drawHex(centerX, centerY, innerRadius, 'rgba(255, 255, 255, 0.18)', 1);
            drawHex(centerX, centerY, coreRadius, 'rgba(94, 66, 28, 0.35)', 1);
        }
    }

    const imageData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 18;
        imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
        imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    texture.anisotropy = 4;
    texture.userData.hex = {
        size,
        centerU: hexRadius / size,
        centerV: (hexHeight * 0.5) / size
    };
    return texture;
}

function alignCarpetTextureToGrid(texture, mazeWidth, mazeHeight, tileSize, targetCell) {
    if (!texture?.userData?.hex) {
        return;
    }

    const { centerU, centerV } = texture.userData.hex;
    const repeatX = texture.repeat?.x ?? 1;
    const repeatY = texture.repeat?.y ?? 1;
    const width = mazeWidth * tileSize;
    const height = mazeHeight * tileSize;
    const targetX = Number.isFinite(targetCell?.column) ? targetCell.column * tileSize : 0;
    const targetZ = Number.isFinite(targetCell?.row) ? targetCell.row * tileSize : 0;
    const u = (targetX + tileSize * 0.5) / width;
    const v = (targetZ + tileSize * 0.5) / height;
    const rawU = (u * repeatX) % 1;
    const rawV = (v * repeatY) % 1;
    const offsetU = (centerU - rawU + 1) % 1;
    const offsetV = (centerV - rawV + 1) % 1;

    texture.offset.set(offsetU, offsetV);
    texture.needsUpdate = true;
}

let gameStarted = false;

export function startGame() {
    if (gameStarted) {
        return;
    }

    gameStarted = true;

    const appElement = document.getElementById('app');
    if (!appElement) {
        return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1116);

    bindLightNumberKeys();

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    appElement.appendChild(renderer.domElement);

    const minimapRoot = document.getElementById('minimap');
    const minimapCanvas = document.getElementById('minimap-canvas');
    const minimapRenderer = minimapCanvas
        ? new THREE.WebGLRenderer({ canvas: minimapCanvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
        : null;
    if (minimapRenderer) {
        minimapRenderer.setClearColor(0x000000, 0);
        minimapRenderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    const minimapSize = 4;
    const minimapHeight = 12;
    const minimapCamera = minimapRenderer
        ? new THREE.OrthographicCamera(-minimapSize, minimapSize, minimapSize, -minimapSize, 0.1, 60)
        : null;

    const pauseRoot = document.getElementById('pause-root');
    const pauseBackButton = document.getElementById('pause-back');
    const pauseContinueButton = document.getElementById('pause-continue');
    const pauseControlsButton = document.getElementById('pause-controls');
    const pauseExitButton = document.getElementById('pause-exit');
    const pausePanels = pauseRoot ? Array.from(pauseRoot.querySelectorAll('[data-view]')) : [];

    const gameoverRoot = document.getElementById('gameover-root');
    const gameoverTitle = document.getElementById('gameover-title');
    const gameoverScore = document.getElementById('gameover-score');
    const gameoverNewButton = document.getElementById('gameover-new');
    const gameoverExitButton = document.getElementById('gameover-exit');

    const scoreElement = document.createElement('div');
    scoreElement.className = 'score-pill';
    scoreElement.textContent = 'Pontos: 0';
    document.body.appendChild(scoreElement);
    const stateElement = null;

    const powerTimerElement = document.createElement('div');
    powerTimerElement.className = 'power-timer is-hidden';
    powerTimerElement.innerHTML = `
        <span class="power-timer__clock" aria-hidden="true"></span>
        <span class="power-timer__value">10</span>
    `;
    document.body.appendChild(powerTimerElement);

    const coinFlipSettings = {
        intervalMs: 30000,
        revealDelayMs: 500,
        flipDurationMs: 1500,
        resultHoldMs: 1500,
        weightStep: 0.1,
        minWeight: 0.01,
        maxWeight: 0.99
    };

    const powerModeSettings = {
        durationMs: 10000,
        baseGhostPoints: 20
    };

    let ghostMode = 'roam';
    let chaseWeight = 0.5;
    let coinRotation = 0;
    let flipAnimationId = null;
    let flipTimeoutId = null;
    let powerModeActive = false;
    let powerModeUntil = 0;
    let ghostEatStreak = 0;
    let pauseStartedAt = 0;

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

        if (nextMode !== ghostMode) {
            chaseWeight = 0.5;
        } else if (nextMode === 'chase') {
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
        if (powerModeActive || gameState !== 'playing') {
            return;
        }
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

    const ambientLight = registerLight('gameAmbient', new THREE.AmbientLight(0xffffff, 1.1));
    scene.add(ambientLight);

    const mainLight = registerLight('gameDirectional', new THREE.DirectionalLight(0xffffff, 2.2));
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

    const wallTexture = createWallTexture(256);
    const wallMaterialPerspective = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.85,
        metalness: 0.0,
        map: wallTexture ?? null
    });
    const wallMaterialOrthographic = new THREE.MeshBasicMaterial({
        color: 0x1a73ff,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
    });
    const floorTexture = createCarpetFloorTexture(512);
    const floorMaterialPerspective = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.0,
        map: floorTexture ?? null
    });
    const floorMaterialOrthographic = new THREE.MeshBasicMaterial({ color: 0x111827, toneMapped: false });
    const ceilingMaterial = new THREE.MeshStandardMaterial({
        color: 0xfcd781,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide
    });
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

    alignCarpetTextureToGrid(floorTexture, mazeWidth, mazeHeight, tileSize, centerMarkerCell);

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

    const ghost2DGroup = new THREE.Group();
    scene.add(ghost2DGroup);
    const ghost2DModels = createGhosts2D({ ghosts, tileSize });
    for (const ghost2D of ghost2DModels) {
        ghost2DGroup.add(ghost2D);
    }

    const { pacman3D, pacman2D } = createPacmanModels({ tileSize });
    const minimapPacman = new THREE.Mesh(
        new THREE.CircleGeometry(tileSize * 0.22, 20),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    minimapPacman.rotation.x = -Math.PI / 2;
    minimapPacman.visible = false;
    scene.add(minimapPacman);
    scene.add(pacman3D, pacman2D);

    let lastPlayerX = perspectiveCamera.position.x;
    let lastPlayerZ = perspectiveCamera.position.z;
    const lastMoveDir = new THREE.Vector3(1, 0, 0);
    let pacman3DYaw = Math.PI;
    let pacman2DYaw = 0;
    const pacmanTurnSpeed = 12;

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
        exclusionRadius: 2,
        powerCoinCount: 5
    });

    let collectedCoinsCount = 0;
    let totalScore = 0;
    let gameState = 'playing';

    let activeCamera = perspectiveCamera;
    let activeView = 'perspective';

    function setHudState(message) {
        if (!stateElement) {
            return;
        }
        stateElement.textContent = message;
    }

    function showPauseView(viewName) {
        if (!pauseRoot) {
            return;
        }

        for (const panel of pausePanels) {
            const isTarget = panel.getAttribute('data-view') === viewName;
            panel.classList.toggle('is-hidden', !isTarget);
        }

        if (pauseBackButton) {
            const showBack = viewName !== 'pause-main';
            pauseBackButton.classList.toggle('is-hidden', !showBack);
        }
    }

    function pauseGame() {
        if (!pauseRoot || gameState !== 'playing') {
            return;
        }

        gameState = 'paused';
        pauseStartedAt = performance.now();
        pauseRoot.classList.remove('is-hidden');
        showPauseView('pause-main');

        controls.forward = false;
        controls.backward = false;
        controls.left = false;
        controls.right = false;
        controls.dragging = false;
    }

    function resumeGame() {
        if (!pauseRoot || gameState !== 'paused') {
            return;
        }

        const now = performance.now();
        if (powerModeActive && pauseStartedAt > 0) {
            powerModeUntil += now - pauseStartedAt;
        }
        pauseStartedAt = 0;
        pauseRoot.classList.add('is-hidden');
        gameState = 'playing';
    }

    function setScore(value) {
        if (!scoreElement) {
            return;
        }
        scoreElement.textContent = `Pontos: ${value}`;
    }

    function updatePowerTimer(now) {
        if (!powerModeActive) {
            return;
        }

        const remainingMs = Math.max(0, powerModeUntil - now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const valueElement = powerTimerElement.querySelector('.power-timer__value');
        if (valueElement) {
            valueElement.textContent = String(remainingSeconds);
        }

        if (remainingMs <= 0) {
            powerModeActive = false;
            powerTimerElement.classList.add('is-hidden');
            ghostEatStreak = 0;

            for (const ghost of ghosts) {
                if (ghost.userData.state === 'scared') {
                    setGhostState(ghost, 'normal');
                }
            }

            for (const ghost2d of ghost2DModels) {
                if (ghost2d.userData.state === 'scared') {
                    const { baseColor } = ghost2d.userData;
                    setGhost2DState(ghost2d, 'normal', baseColor);
                }
            }
        }
    }

    function startPowerMode(now) {
        powerModeActive = true;
        powerModeUntil = now + powerModeSettings.durationMs;
        ghostEatStreak = 0;
        powerTimerElement.classList.remove('is-hidden');
        coinWrapper.style.display = 'none';
        if (flipTimeoutId) {
            clearTimeout(flipTimeoutId);
            flipTimeoutId = null;
        }
        const valueElement = powerTimerElement.querySelector('.power-timer__value');
        if (valueElement) {
            valueElement.textContent = String(Math.ceil(powerModeSettings.durationMs / 1000));
        }

        for (const ghost of ghosts) {
            if (ghost.userData.state !== 'eyes') {
                setGhostState(ghost, 'scared');
            }
            ghost.userData.canTurn = true;
            ghost.userData.direction = { row: 0, column: 0 };
        }

        ghosts.forEach((ghost, index) => {
            if (ghost.userData.state === 'scared') {
                const ghost2d = ghost2DModels[index];
                setGhost2DState(ghost2d, 'scared', ghost.userData.color);
            }
        });
    }

    function getCollidingGhostIndex(playerX, playerZ) {
        for (let index = 0; index < ghosts.length; index += 1) {
            const ghost = ghosts[index];
            const ghostRadius = ghost.userData.radius ?? 0;
            const dx = playerX - ghost.position.x;
            const dz = playerZ - ghost.position.z;
            const minDistance = playerSettings.playerRadius + ghostRadius;

            if (dx * dx + dz * dz <= minDistance * minDistance) {
                return index;
            }
        }

        return -1;
    }

    function endGame(result) {
        gameState = 'finished';
        setHudState('');
        powerModeActive = false;
        powerTimerElement.classList.add('is-hidden');
        pauseRoot?.classList.add('is-hidden');

        if (gameoverRoot) {
            const isWin = result === 'win';
            if (gameoverTitle) {
                gameoverTitle.textContent = isWin ? 'Parabens!! Vitoria' : 'Game Over';
            }
            if (gameoverScore) {
                gameoverScore.textContent = `Pontos: ${totalScore}`;
            }
            gameoverRoot.classList.remove('is-hidden');
        }
    }

    setScore(totalScore);
    setHudState('Colete as moedas e fuja dos fantasmas.');

    function activatePerspectiveView() {
        activeCamera = perspectiveCamera;
        activeView = 'perspective';
        controls.view = 'perspective';
        if (minimapRoot) {
            minimapRoot.style.display = '';
        }
        floor.material = floorMaterialPerspective;
        ceiling.visible = true;

        for (const ghost of ghosts) {
            ghost.visible = true;
        }

        for (const ghost2D of ghost2DModels) {
            ghost2D.visible = false;
        }

        pacman2D.visible = false;
        pacman3D.visible = true;

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
        if (minimapRoot) {
            minimapRoot.style.display = 'none';
        }
        floor.material = floorMaterialOrthographic;
        ceiling.visible = false;

        for (const ghost of ghosts) {
            ghost.visible = false;
        }

        for (const ghost2D of ghost2DModels) {
            ghost2D.visible = true;
        }

        pacman2D.visible = true;
        pacman3D.visible = false;

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

    function stepAngle(current, target, maxStep) {
        const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
        if (Math.abs(delta) <= maxStep) {
            return target;
        }
        return current + Math.sign(delta) * maxStep;
    }

    window.addEventListener('keydown', (event) => {
        if (event.code === 'Escape') {
            event.preventDefault();
            if (gameState === 'playing') {
                pauseGame();
            } else if (gameState === 'paused') {
                if (pauseBackButton && !pauseBackButton.classList.contains('is-hidden')) {
                    showPauseView('pause-main');
                } else {
                    resumeGame();
                }
            }
            return;
        }

        if (event.code === 'KeyR') {
            sessionStorage.setItem('pacman3d_autostart', '1');
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
        if (activeView !== 'perspective' || gameState !== 'playing') {
            return;
        }

        controls.dragging = true;
        controls.previousX = event.clientX;
        controls.previousY = event.clientY;
        renderer.domElement.setPointerCapture(event.pointerId);
    });

    renderer.domElement.addEventListener('pointermove', (event) => {
        if (!controls.dragging || activeView !== 'perspective' || gameState !== 'playing') {
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

        if (minimapRenderer && minimapRoot) {
            const size = minimapRoot.clientWidth || 160;
            const dpr = Math.min(window.devicePixelRatio, 2);
            minimapRenderer.setPixelRatio(dpr);
            minimapRenderer.setSize(size, size, false);
        }
    }

    const clock = new THREE.Clock();

    function animate() {
        const deltaSeconds = clock.getDelta();
        const now = performance.now();

        if (gameState === 'playing') {
            const prevX = perspectiveCamera.position.x;
            const prevZ = perspectiveCamera.position.z;

            updateCoins({
                elapsedSeconds: clock.elapsedTime,
                coins,
                view: activeView
            });

            updatePlayer({
                deltaSeconds,
                controls,
                camera: perspectiveCamera,
                mazeLayout,
                tileSize,
                ghosts
            });

            updatePowerTimer(now);

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
                },
                modeResolver: (ghost) => {
                    if (ghost.userData.state === 'eyes') {
                        return 'return';
                    }

                    if (powerModeActive) {
                        return 'flee';
                    }

                    return ghostMode;
                },
                targetResolver: (ghost) => {
                    if (ghost.userData.state === 'eyes' && centerMarkerCell) {
                        return centerMarkerCell;
                    }

                    return {
                        row: Math.round(perspectiveCamera.position.z / tileSize),
                        column: Math.round(perspectiveCamera.position.x / tileSize)
                    };
                }
            });

            const movedX = perspectiveCamera.position.x - prevX;
            const movedZ = perspectiveCamera.position.z - prevZ;
            if (movedX * movedX + movedZ * movedZ > 1e-6) {
                lastMoveDir.set(movedX, 0, movedZ).normalize();
            }

            const target3DYaw = controls.yaw + Math.PI;
            pacman3DYaw = stepAngle(pacman3DYaw, target3DYaw, pacmanTurnSpeed * deltaSeconds);
            pacman3D.rotation.y = pacman3DYaw;

            let target2DYaw = pacman2DYaw;
            if (Math.abs(lastMoveDir.x) >= Math.abs(lastMoveDir.z)) {
                target2DYaw = 0;
                pacman2D.scale.x = lastMoveDir.x >= 0 ? 1 : -1;
            } else {
                pacman2D.scale.x = 1;
                target2DYaw = lastMoveDir.z <= 0 ? -3 * Math.PI / 2 : -Math.PI / 2;
            }
            pacman2DYaw = stepAngle(pacman2DYaw, target2DYaw, pacmanTurnSpeed * deltaSeconds);
            pacman2D.rotation.z = pacman2DYaw;

            for (let index = 0; index < ghosts.length; index += 1) {
                const ghost = ghosts[index];
                const ghost2D = ghost2DModels[index];
                ghost2D.position.x = ghost.position.x;
                ghost2D.position.z = ghost.position.z;
                ghost2D.position.y = tileSize * 0.02;

                if (ghost.userData.state === 'eyes' && isGhostInsideCenterBox(ghost, centerMarkerCell, tileSize)) {
                    setGhostState(ghost, 'normal');
                    setGhost2DState(ghost2D, 'normal', ghost.userData.color);
                    ghost.userData.hasLeftBox = false;
                    ghost.userData.canTurn = true;
                    ghost.userData.direction = { row: 0, column: 0 };
                }
            }

            const playerX = perspectiveCamera.position.x;
            const playerZ = perspectiveCamera.position.z;
            const collidingIndex = getCollidingGhostIndex(playerX, playerZ);

            if (collidingIndex >= 0) {
                const ghost = ghosts[collidingIndex];
                if (powerModeActive && ghost.userData.state !== 'eyes') {
                    setGhostState(ghost, 'eyes');
                    setGhost2DState(ghost2DModels[collidingIndex], 'eyes', ghost.userData.color);
                    const bonus = powerModeSettings.baseGhostPoints * Math.pow(2, ghostEatStreak);
                    ghostEatStreak += 1;
                    totalScore += bonus;
                    setScore(totalScore);
                } else if (ghost.userData.state !== 'eyes') {
                    endGame('lose');
                }
            }

            const coinResult = collectCoins({
                playerX,
                playerZ,
                playerRadius: playerSettings.playerRadius,
                coins
            });

            if (coinResult.collectedCount > 0) {
                collectedCoinsCount += coinResult.collectedCount;
                const normalCoins = coinResult.collectedCount - coinResult.powerCollected;
                totalScore += normalCoins + coinResult.powerCollected * 5;
                setScore(totalScore);
            }

            if (coinResult.powerCollected > 0) {
                startPowerMode(now);
            }

            if (collectedCoinsCount >= coins.length) {
                endGame('win');
            }
        }

        if (activeView === 'orthographic') {
            orthographicCamera.position.set(
                orthographicCamera.position.x,
                orthographicCameraHeight,
                orthographicCamera.position.z
            );
            orthographicCamera.lookAt(mazeCenterX, 0, mazeCenterZ);
        }

        playerSpotlight.position.set(
            perspectiveCamera.position.x,
            playerSpotlight.position.y,
            perspectiveCamera.position.z
        );

        const pacman3DHeight = pacman3D.userData.baseY ?? playerSettings.playerEyeHeight;
        pacman3D.position.set(
            perspectiveCamera.position.x,
            pacman3DHeight,
            perspectiveCamera.position.z
        );

        const pacman2DHeight = pacman2D.userData.baseY ?? tileSize * 0.06;
        pacman2D.position.set(
            perspectiveCamera.position.x,
            pacman2DHeight,
            perspectiveCamera.position.z
        );
        minimapPacman.position.set(
            perspectiveCamera.position.x,
            pacman2DHeight,
            perspectiveCamera.position.z
        );

        lastPlayerX = perspectiveCamera.position.x;
        lastPlayerZ = perspectiveCamera.position.z;

        renderer.render(scene, activeCamera);

        if (minimapRenderer && minimapCamera) {
            const playerX = perspectiveCamera.position.x;
            const playerZ = perspectiveCamera.position.z;
            minimapCamera.position.set(playerX, minimapHeight, playerZ);
            minimapCamera.lookAt(playerX, 0, playerZ);

            const prevCeilingVisible = ceiling.visible;
            const prevFloorMaterial = floor.material;
            const prevPacman3DVisible = pacman3D.visible;
            const prevPacman2DVisible = pacman2D.visible;
            const prevGhostVisibility = ghosts.map((ghost) => ghost.visible);
            const prevGhost2DVisibility = ghost2DModels.map((ghost2d) => ghost2d.visible);
            const prevWallMaterials = mazeGroup.children.map((wall) => wall.material);

            ceiling.visible = false;
            floor.material = floorMaterialOrthographic;
            pacman3D.visible = false;
            pacman2D.visible = false;
            minimapPacman.visible = true;

            ghosts.forEach((ghost) => {
                ghost.visible = false;
            });
            ghost2DModels.forEach((ghost2d) => {
                ghost2d.visible = true;
            });

            mazeGroup.children.forEach((wall, index) => {
                if (wall.userData?.isPanel) {
                    return;
                }
                wall.material = wallMaterialOrthographic;
                prevWallMaterials[index] = prevWallMaterials[index] ?? wall.material;
            });

            updateCoins({
                elapsedSeconds: clock.elapsedTime,
                coins,
                view: 'orthographic'
            });

            minimapRenderer.render(scene, minimapCamera);

            ceiling.visible = prevCeilingVisible;
            floor.material = prevFloorMaterial;
            pacman3D.visible = prevPacman3DVisible;
            pacman2D.visible = prevPacman2DVisible;
            minimapPacman.visible = false;

            ghosts.forEach((ghost, index) => {
                ghost.visible = prevGhostVisibility[index];
            });
            ghost2DModels.forEach((ghost2d, index) => {
                ghost2d.visible = prevGhost2DVisibility[index];
            });
            mazeGroup.children.forEach((wall, index) => {
                wall.material = prevWallMaterials[index];
            });

            updateCoins({
                elapsedSeconds: clock.elapsedTime,
                coins,
                view: activeView
            });
        }
        requestAnimationFrame(animate);
    }

    activatePerspectiveView();
    onWindowResize();
    animate();

    pauseContinueButton?.addEventListener('click', resumeGame);
    pauseControlsButton?.addEventListener('click', () => showPauseView('pause-controls'));
    pauseExitButton?.addEventListener('click', () => window.location.reload());
    pauseBackButton?.addEventListener('click', () => showPauseView('pause-main'));

    gameoverNewButton?.addEventListener('click', () => {
        sessionStorage.setItem('pacman3d_autostart', '1');
        window.location.reload();
    });
    gameoverExitButton?.addEventListener('click', () => window.location.reload());
}
