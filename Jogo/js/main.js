import * as THREE from 'three';
import { createMaze, getCenterMarkerCell, getMazeData } from './maze.js';
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

    const ghost2DGroup = new THREE.Group();
    scene.add(ghost2DGroup);
    const ghost2DModels = createGhosts2D({ ghosts, tileSize });
    for (const ghost2D of ghost2DModels) {
        ghost2DGroup.add(ghost2D);
    }

    const { pacman3D, pacman2D } = createPacmanModels({ tileSize });
    scene.add(pacman3D, pacman2D);

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
        stateElement.textContent = message;
    }

    function setScore(value) {
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

    function endGame(message) {
        gameState = 'finished';
        setHudState(message);
        powerModeActive = false;
        powerTimerElement.classList.add('is-hidden');
    }

    setScore(totalScore);
    setHudState('Colete as moedas e fuja dos fantasmas.');

    function activatePerspectiveView() {
        activeCamera = perspectiveCamera;
        activeView = 'perspective';
        controls.view = 'perspective';
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
        const now = performance.now();

        if (gameState === 'playing') {
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

            for (let index = 0; index < ghosts.length; index += 1) {
                const ghost = ghosts[index];
                const ghost2D = ghost2DModels[index];
                ghost2D.position.x = ghost.position.x;
                ghost2D.position.z = ghost.position.z;
                ghost2D.position.y = tileSize * 0.02;

                if (ghost.userData.state === 'eyes' && isGhostInsideCenterBox(ghost, centerMarkerCell, tileSize)) {
                    setGhostState(ghost, 'normal');
                    setGhost2DState(ghost2D, 'normal', ghost.userData.color);
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
                    endGame('Game over. Um fantasma apanhou o jogador. Pressiona R para reiniciar.');
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
                totalScore += coinResult.collectedCount;
                setScore(totalScore);
            }

            if (coinResult.powerCollected > 0) {
                startPowerMode(now);
            }

            if (collectedCoinsCount >= coins.length) {
                endGame('Venceste. Todas as moedas foram apanhadas. Pressiona R para reiniciar.');
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

        renderer.render(scene, activeCamera);
        requestAnimationFrame(animate);
    }

    activatePerspectiveView();
    onWindowResize();
    animate();
}
