import * as THREE from 'three';
import { createMaze, getCenterMarkerCell, getMazeData } from './maze.js';
import { bindLightNumberKeys, registerLight } from './lights.js';
import {
    MAP_CONFIGS,
    createHedgeWallTexture,
    createGrassFloorTexture,
    createConcreteWallTexture,
    createMetalFloorTexture
} from './maps.js';
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

    // Deep burgundy/wine plaster base
    ctx.fillStyle = '#6e0f1a';
    ctx.fillRect(0, 0, size, size);

    // Subtle vertical gradient: slightly lighter at top (ceiling bounce light), darker at bottom
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.02)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Fine plaster grain noise
    const imageData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 18;
        imageData.data[i]     = Math.max(0, Math.min(255, imageData.data[i]     + noise));
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

    // Warm amber/gold carpet base (hotel corridor palette)
    ctx.fillStyle = '#c07830';
    ctx.fillRect(0, 0, size, size);

    const cols = 4;
    const rows = 4;
    const tw = size / cols;
    const th = size / rows;

    const drawDiamond = (cx, cy, hw, hh) => {
        ctx.beginPath();
        ctx.moveTo(cx,      cy - hh);
        ctx.lineTo(cx + hw, cy     );
        ctx.lineTo(cx,      cy + hh);
        ctx.lineTo(cx - hw, cy     );
        ctx.closePath();
    };

    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const cx = (col + 0.5) * tw;
            const cy = (row + 0.5) * th;

            // Outer diamond — darker rim fill
            drawDiamond(cx, cy, tw * 0.46, th * 0.46);
            ctx.fillStyle = 'rgba(155, 85, 15, 0.30)';
            ctx.fill();
            drawDiamond(cx, cy, tw * 0.46, th * 0.46);
            ctx.strokeStyle = 'rgba(80, 32, 6, 0.80)';
            ctx.lineWidth = size / 110;
            ctx.stroke();

            // Middle diamond — lighter gold accent
            drawDiamond(cx, cy, tw * 0.30, th * 0.30);
            ctx.fillStyle = 'rgba(240, 180, 70, 0.28)';
            ctx.fill();
            drawDiamond(cx, cy, tw * 0.30, th * 0.30);
            ctx.strokeStyle = 'rgba(80, 32, 6, 0.55)';
            ctx.lineWidth = size / 220;
            ctx.stroke();

            // Inner center diamond — dark accent
            drawDiamond(cx, cy, tw * 0.10, th * 0.10);
            ctx.fillStyle = 'rgba(80, 32, 6, 0.50)';
            ctx.fill();
        }
    }

    // Fine carpet fibre noise
    const imageData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 16;
        imageData.data[i]     = Math.max(0, Math.min(255, imageData.data[i]     + noise));
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
        imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.anisotropy = 4;
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

let wallLampAssets = null;

function getWallLampAssets(tileSize) {
    if (wallLampAssets && wallLampAssets.tileSize === tileSize) {
        return wallLampAssets;
    }

    const s = tileSize;
    wallLampAssets = {
        tileSize,
        // Flat backing plate on wall
        plateGeometry:  new THREE.BoxGeometry(s * 0.12, s * 0.18, s * 0.03),
        // Short arm (rotated to point in +Z)
        armGeometry:    new THREE.CylinderGeometry(s * 0.018, s * 0.024, s * 0.06, 8),
        // Hexagonal cup/neck connecting arm to lantern body
        cupGeometry:    new THREE.CylinderGeometry(s * 0.040, s * 0.028, s * 0.05, 6),
        // Hexagonal collar rings (top and bottom of body)
        collarGeometry: new THREE.CylinderGeometry(s * 0.063, s * 0.063, s * 0.013, 6),
        // Hexagonal glass body (open prism, transparent)
        glassGeometry:  new THREE.CylinderGeometry(s * 0.055, s * 0.055, s * 0.14, 6, 1, true),
        // Thin vertical edge bar (one geometry, placed at each of the 6 hex corners)
        edgeGeometry:   new THREE.CylinderGeometry(s * 0.007, s * 0.007, s * 0.14, 6),
        // Hexagonal pyramid cap (tip at top, radiusTop=0)
        capGeometry:    new THREE.CylinderGeometry(0, s * 0.064, s * 0.065, 6),
        // Small decorative finial sphere at very top
        finialGeometry: new THREE.SphereGeometry(s * 0.018, 8, 6),
        // Edison bulb inside
        bulbGeometry:   new THREE.SphereGeometry(s * 0.028, 10, 7),

        metalMaterial: new THREE.MeshStandardMaterial({
            color: 0x3a2510, roughness: 0.55, metalness: 0.45
        }),
        glassMaterial: new THREE.MeshStandardMaterial({
            color: 0xfff3d0, roughness: 0.05, metalness: 0.0,
            transparent: true, opacity: 0.25, side: THREE.DoubleSide
        }),
        bulbMaterial: new THREE.MeshStandardMaterial({
            color: 0xfff1c1, emissive: 0xffb347, emissiveIntensity: 1.4
        }),
    };

    return wallLampAssets;
}

function getWallTextureForMap(config) {
    if (config.wallTextureType === 'hedge') return createHedgeWallTexture();
    if (config.wallTextureType === 'concrete') return createConcreteWallTexture(256);
    return createWallTexture(256);
}

function getFloorTextureForMap(config) {
    if (config.floorTextureType === 'grass') return createGrassFloorTexture(512);
    if (config.floorTextureType === 'metal') return createMetalFloorTexture(512);
    return createCarpetFloorTexture(512);
}

function createWallLamp(tileSize, lightColor = 0xffd9a8, lightIntensity = 1.1) {
    const assets = getWallLampAssets(tileSize);
    const s = tileSize;
    const group = new THREE.Group();

    // --- Backing plate (flat against wall) ---
    const plate = new THREE.Mesh(assets.plateGeometry, assets.metalMaterial);
    plate.position.set(0, 0, s * 0.015);
    group.add(plate);

    // --- Short arm (CylinderGeometry along Y → rotation.x = π/2 → points in +Z) ---
    const arm = new THREE.Mesh(assets.armGeometry, assets.metalMaterial);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(0, -s * 0.025, s * 0.030);  // spans z = 0 .. 0.06
    group.add(arm);

    // --- Hexagonal cup (neck between arm and lantern body) ---
    const cup = new THREE.Mesh(assets.cupGeometry, assets.metalMaterial);
    cup.position.set(0, s * 0.015, s * 0.075);   // cup top at y = 0.040
    group.add(cup);

    // Lantern body is centered at this Z — very close to wall (max protrusion ≈ 0.14 units)
    const lz = s * 0.085;

    // Y positions stack upward from cup top (y = 0.040)
    const bodyBottomY = s * 0.040;
    const bodyCenterY = bodyBottomY + s * 0.070;  // = s * 0.110
    const bodyTopY    = bodyBottomY + s * 0.140;  // = s * 0.180

    // --- Bottom collar ring ---
    const botCollar = new THREE.Mesh(assets.collarGeometry, assets.metalMaterial);
    botCollar.position.set(0, bodyBottomY, lz);
    group.add(botCollar);

    // --- Hexagonal glass body (open prism) ---
    const glass = new THREE.Mesh(assets.glassGeometry, assets.glassMaterial);
    glass.position.set(0, bodyCenterY, lz);
    group.add(glass);

    // --- 6 vertical metal edge bars at hex corners ---
    const edgeRadius = s * 0.055;
    for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        const edge = new THREE.Mesh(assets.edgeGeometry, assets.metalMaterial);
        edge.position.set(
            Math.sin(angle) * edgeRadius,
            bodyCenterY,
            lz + Math.cos(angle) * edgeRadius
        );
        group.add(edge);
    }

    // --- Top collar ring ---
    const topCollar = new THREE.Mesh(assets.collarGeometry, assets.metalMaterial);
    topCollar.position.set(0, bodyTopY, lz);
    group.add(topCollar);

    // --- Hexagonal pyramid cap ---
    const cap = new THREE.Mesh(assets.capGeometry, assets.metalMaterial);
    cap.position.set(0, bodyTopY + s * 0.0325, lz);
    group.add(cap);

    // --- Decorative finial at apex ---
    const finial = new THREE.Mesh(assets.finialGeometry, assets.metalMaterial);
    finial.position.set(0, bodyTopY + s * 0.083, lz);
    group.add(finial);

    // --- Edison bulb (emissive, inside hex body) ---
    const bulb = new THREE.Mesh(assets.bulbGeometry, assets.bulbMaterial);
    bulb.position.set(0, bodyCenterY, lz);
    group.add(bulb);

    // --- Point light ---
    const light = new THREE.PointLight(lightColor, lightIntensity, s * 3.0, 2);
    light.position.set(0, bodyCenterY, lz);
    group.add(light);

    return { group, light };
}

function placeManualWallLamps({ mazeLayout, tileSize, wallHeight, targetGroup, placements, lightColor = 0xffd9a8, lightIntensity = 1.1 }) {
    if (!mazeLayout || !targetGroup || !Array.isArray(placements)) {
        return;
    }

    const rows = mazeLayout.length;
    const columns = mazeLayout[0]?.length ?? 0;
    const wallDefs = {
        north: { dr: -1, dc: 0, normalX: 0, normalZ: -1, rotationY: 0 },
        south: { dr: 1, dc: 0, normalX: 0, normalZ: 1, rotationY: Math.PI },
        west: { dr: 0, dc: -1, normalX: -1, normalZ: 0, rotationY: Math.PI / 2 },
        east: { dr: 0, dc: 1, normalX: 1, normalZ: 0, rotationY: -Math.PI / 2 }
    };
    const usedKeys = new Set();

    const isWall = (row, column) => (
        row >= 0
        && row < rows
        && column >= 0
        && column < columns
        && mazeLayout[row][column] === 1
    );

    for (const placement of placements) {
        const row = placement.row;
        const column = placement.column;
        const wallKey = String(placement.wall ?? '').trim().toLowerCase();
        const wallDef = wallDefs[wallKey];
        if (!wallDef || !Number.isInteger(row) || !Number.isInteger(column)) {
            continue;
        }

        const key = `${row},${column},${wallKey}`;
        if (usedKeys.has(key)) {
            continue;
        }
        usedKeys.add(key);

        const wallRow = row + wallDef.dr;
        const wallCol = column + wallDef.dc;
        if (!isWall(wallRow, wallCol)) {
            console.warn('Skipped lamp with no wall neighbor:', { row, column, wall: wallKey });
            continue;
        }

        const { group } = createWallLamp(tileSize, lightColor, lightIntensity);
        const offset = tileSize * 0.5 - tileSize * 0.08;
        const x = column * tileSize + wallDef.normalX * offset;
        const z = row * tileSize + wallDef.normalZ * offset;
        group.position.set(x, wallHeight * 0.72, z);
        group.rotation.y = wallDef.rotationY;
        targetGroup.add(group);
    }
}

let gameStarted = false;

export function startGame(mapConfig = MAP_CONFIGS.hotel) {
    if (gameStarted) {
        return;
    }

    gameStarted = true;

    const appElement = document.getElementById('app');
    if (!appElement) {
        return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(mapConfig.sceneBackground);
    if (mapConfig.fogEnabled) {
        scene.fog = new THREE.Fog(mapConfig.fogColor, mapConfig.fogNear, mapConfig.fogFar);
    }

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

    const ambientLight = registerLight('gameAmbient', new THREE.AmbientLight(mapConfig.ambientColor, mapConfig.ambientIntensity));
    scene.add(ambientLight);

    const mainLight = registerLight('gameDirectional', new THREE.DirectionalLight(mapConfig.directionalColor, mapConfig.directionalIntensity));
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

    const wallTexture = getWallTextureForMap(mapConfig);
    const wallMaterialPerspective = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: mapConfig.wallRoughness,
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
    const floorTexture = getFloorTextureForMap(mapConfig);
    const floorMaterialPerspective = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: mapConfig.floorRoughness,
        metalness: 0.0,
        map: floorTexture ?? null
    });
    const floorMaterialOrthographic = new THREE.MeshBasicMaterial({ color: 0x111827, toneMapped: false });
    const ceilingColor = mapConfig.ceilingColor ?? 0xede0c8;
    const ceilingMaterial = new THREE.MeshStandardMaterial({
        color: ceilingColor,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide
    });
    const borderGuideMaterial = new THREE.LineBasicMaterial({ color: 0xe5e7eb });

    const pointLightGroup = registerLight('gamePointLights', new THREE.Group());
    scene.add(pointLightGroup);

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
    if (mapConfig.pointLightIntensity > 0) {
    placeManualWallLamps({
        mazeLayout,
        tileSize,
        wallHeight,
        targetGroup: pointLightGroup,
        lightColor: mapConfig.pointLightColor,
        lightIntensity: mapConfig.pointLightIntensity,
        placements: [
            { row: 1, column: 3, wall: 'south' },
            { row: 1, column: 9, wall: 'north' },
            { row: 1, column: 20, wall: 'north' },
            { row: 1, column: 26, wall: 'north' },
            { row: 1, column: 30, wall: 'north' },
            { row: 2, column: 11, wall: 'east' },
            { row: 2, column: 17, wall: 'west' },
            { row: 2, column: 23, wall: 'west' },
            { row: 3, column: 7, wall: 'west' },
            { row: 3, column: 13, wall: 'east' },
            { row: 3, column: 15, wall: 'west' },
            { row: 4, column: 1, wall: 'east' },
            { row: 4, column: 3, wall: 'east' },
            { row: 4, column: 9, wall: 'west' },
            { row: 4, column: 19, wall: 'east' },
            { row: 4, column: 29, wall: 'west' },
            { row: 4, column: 31, wall: 'east' },
            { row: 5, column: 22, wall: 'north' },
            { row: 5, column: 25, wall: 'east' },
            { row: 5, column: 27, wall: 'west' },
            { row: 7, column: 7, wall: 'north' },
            { row: 7, column: 12, wall: 'north' },
            { row: 7, column: 16, wall: 'north' },
            { row: 7, column: 21, wall: 'north' },
            { row: 9, column: 13, wall: 'south' },
            { row: 9, column: 15, wall: 'south' },
            { row: 9, column: 26, wall: 'north' },
            { row: 9, column: 30, wall: 'south' },
            { row: 10, column: 1, wall: 'east' },
            { row: 11, column: 5, wall: 'east' },
            { row: 11, column: 7, wall: 'west' },
            { row: 11, column: 11, wall: 'east' },
            { row: 11, column: 17, wall: 'west' },
            { row: 11, column: 21, wall: 'east' },
            { row: 11, column: 23, wall: 'west' },
            { row: 11, column: 30, wall: 'north' },
            { row: 12, column: 1, wall: 'east' },
            { row: 13, column: 14, wall: 'north' },
            { row: 14, column: 13, wall: 'east' },
            { row: 14, column: 15, wall: 'west' },
            { row: 14, column: 25, wall: 'west' },
            { row: 15, column: 1, wall: 'north' },
            { row: 15, column: 9, wall: 'east' },
            { row: 15, column: 20, wall: 'north' },
            { row: 15, column: 28, wall: 'south' },
            { row: 16, column: 31, wall: 'east' },
            { row: 17, column: 5, wall: 'west' },
            { row: 17, column: 10, wall: 'south' },
            { row: 17, column: 26, wall: 'north' },
            { row: 19, column: 4, wall: 'north' },
            { row: 19, column: 15, wall: 'east' },
            { row: 19, column: 17, wall: 'west' },
            { row: 19, column: 21, wall: 'east' },
            { row: 19, column: 23, wall: 'west' },
            { row: 19, column: 29, wall: 'west' },
            { row: 20, column: 11, wall: 'east' },
            { row: 21, column: 1, wall: 'west' },
            { row: 21, column: 7, wall: 'south' },
            { row: 21, column: 13, wall: 'west' },
            { row: 21, column: 27, wall: 'south' }
        ]
    });
    }

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

    const ghosts = createGhosts({ scene, mazeLayout, centerMarkerCell, tileSize, wallHeight, enemyType: mapConfig.enemyType });

    const ghost2DGroup = new THREE.Group();
    scene.add(ghost2DGroup);
    const ghost2DModels = createGhosts2D({ ghosts, tileSize, enemyType: mapConfig.enemyType });
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
        ceiling.visible = mapConfig.ceilingVisible !== false;

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
        window.location.reload();
    });
    gameoverExitButton?.addEventListener('click', () => window.location.reload());
}
