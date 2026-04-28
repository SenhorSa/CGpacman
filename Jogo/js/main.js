import * as THREE from 'three';

const appElement = document.getElementById('app');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1116);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
appElement.appendChild(renderer.domElement);

const mazeRows = 23;
const mazeColumns = 33;

function createFilledGrid(rows, columns, fillValue) {
    return Array.from({ length: rows }, () => Array.from({ length: columns }, () => fillValue));
}

function carveHorizontal(layout, row, startColumn, endColumn) {
    for (let column = startColumn; column <= endColumn; column += 1) {
        layout[row][column] = 0;
    }
}

function carveVertical(layout, column, startRow, endRow) {
    for (let row = startRow; row <= endRow; row += 1) {
        layout[row][column] = 0;
    }
}

function createPacmanDarkDeceptionLayout(rows, columns) {
    const layout = createFilledGrid(rows, columns, 1);
    const ringOffsets = [1, 4, 7, 10];
    const horizontalLanes = [3, 7, 11, 15, 19];
    const verticalLanes = [3, 7, 11, 15, 19, 23];

    for (const offset of ringOffsets) {
        carveHorizontal(layout, offset, offset, columns - offset - 1);
        carveHorizontal(layout, rows - offset - 1, offset, columns - offset - 1);
        carveVertical(layout, offset, offset, rows - offset - 1);
        carveVertical(layout, columns - offset - 1, offset, rows - offset - 1);
    }

    for (const row of horizontalLanes) {
        carveHorizontal(layout, row, 1, columns - 2);
    }

    for (const column of verticalLanes) {
        carveVertical(layout, column, 1, rows - 2);
    }

    // Central arena to mimic high-pressure chase loops.
    carveHorizontal(layout, 10, 10, 16);
    carveHorizontal(layout, 11, 9, 17);
    carveHorizontal(layout, 12, 10, 16);
    carveVertical(layout, 9, 10, 12);
    carveVertical(layout, 17, 10, 12);

    const tacticalBlockers = [
        { row: 3, column: 13 },
        { row: 7, column: 9 },
        { row: 7, column: 17 },
        { row: 11, column: 5 },
        { row: 11, column: 21 },
        { row: 15, column: 13 },
        { row: 19, column: 9 },
        { row: 19, column: 17 }
    ];

    for (const blocker of tacticalBlockers) {
        layout[blocker.row][blocker.column] = 1;
    }

    return layout;
}

const baseMazeLayout = createPacmanDarkDeceptionLayout(mazeRows, mazeColumns);

const cardinalDirections = [
    { row: -1, column: 0 },
    { row: 1, column: 0 },
    { row: 0, column: -1 },
    { row: 0, column: 1 }
];

function isInsideGrid(layout, row, column) {
    return row >= 0 && row < layout.length && column >= 0 && column < layout[0].length;
}

function isInsideInnerGrid(layout, row, column) {
    return row > 0 && row < layout.length - 1 && column > 0 && column < layout[0].length - 1;
}

function countWalkableNeighbors(layout, row, column) {
    let walkableCount = 0;

    for (const direction of cardinalDirections) {
        const nextRow = row + direction.row;
        const nextColumn = column + direction.column;

        if (isInsideGrid(layout, nextRow, nextColumn) && layout[nextRow][nextColumn] === 0) {
            walkableCount += 1;
        }
    }

    return walkableCount;
}

function buildPlayableMaze(layout) {
    const playableLayout = layout.map((row) => [...row]);
    const maxIterations = playableLayout.length * playableLayout[0].length * 8;

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        const deadEnds = [];

        for (let row = 1; row < playableLayout.length - 1; row += 1) {
            for (let column = 1; column < playableLayout[row].length - 1; column += 1) {
                if (playableLayout[row][column] !== 0) {
                    continue;
                }

                if (countWalkableNeighbors(playableLayout, row, column) <= 1) {
                    deadEnds.push({ row, column });
                }
            }
        }

        if (deadEnds.length === 0) {
            break;
        }

        for (const deadEnd of deadEnds) {
            const strongCandidates = [];
            const fallbackCandidates = [];

            for (const direction of cardinalDirections) {
                const wallRow = deadEnd.row + direction.row;
                const wallColumn = deadEnd.column + direction.column;

                if (!isInsideInnerGrid(playableLayout, wallRow, wallColumn) || playableLayout[wallRow][wallColumn] !== 1) {
                    continue;
                }

                const beyondRow = deadEnd.row + direction.row * 2;
                const beyondColumn = deadEnd.column + direction.column * 2;

                if (
                    isInsideInnerGrid(playableLayout, beyondRow, beyondColumn)
                    && playableLayout[beyondRow][beyondColumn] === 0
                ) {
                    strongCandidates.push({ row: wallRow, column: wallColumn });
                    continue;
                }

                if (countWalkableNeighbors(playableLayout, wallRow, wallColumn) >= 1) {
                    fallbackCandidates.push({ row: wallRow, column: wallColumn });
                }
            }

            const selectedCandidate = strongCandidates[0] ?? fallbackCandidates[0];

            if (selectedCandidate) {
                playableLayout[selectedCandidate.row][selectedCandidate.column] = 0;
            }
        }
    }

    return playableLayout;
}

function findSpawnCell(layout) {
    const preferredSpawn = { row: layout.length - 4, column: Math.floor(layout[0].length / 2) };

    if (layout[preferredSpawn.row][preferredSpawn.column] === 0) {
        return preferredSpawn;
    }

    for (let row = 1; row < layout.length - 1; row += 1) {
        for (let column = 1; column < layout[row].length - 1; column += 1) {
            if (layout[row][column] === 0) {
                return { row, column };
            }
        }
    }

    return { row: 1, column: 1 };
}

const mazeLayout = buildPlayableMaze(baseMazeLayout);

const tileSize = 1;
const wallHeight = 1;
const mazeWidth = mazeLayout[0].length;
const mazeHeight = mazeLayout.length;
const mazeCenterX = (mazeWidth - 1) * tileSize * 0.5;
const mazeCenterZ = (mazeHeight - 1) * tileSize * 0.5;

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

const mazeGroup = new THREE.Group();
scene.add(mazeGroup);

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(mazeWidth * tileSize, mazeHeight * tileSize),
    floorMaterialPerspective
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(mazeCenterX, 0, mazeCenterZ);
floor.receiveShadow = true;
scene.add(floor);

const borderGuidePoints = [
    new THREE.Vector3(-0.5, 0.03, -0.5),
    new THREE.Vector3(mazeWidth - 0.5, 0.03, -0.5),
    new THREE.Vector3(mazeWidth - 0.5, 0.03, mazeHeight - 0.5),
    new THREE.Vector3(-0.5, 0.03, mazeHeight - 0.5),
    new THREE.Vector3(-0.5, 0.03, -0.5)
];
const borderGuideGeometry = new THREE.BufferGeometry().setFromPoints(borderGuidePoints);
const borderGuide = new THREE.Line(borderGuideGeometry, borderGuideMaterial);
scene.add(borderGuide);

const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(mazeWidth * tileSize, mazeHeight * tileSize),
    ceilingMaterial
);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.set(mazeCenterX, wallHeight + 0.15, mazeCenterZ);
scene.add(ceiling);

const wallGeometry = new THREE.BoxGeometry(tileSize, wallHeight, tileSize);

for (let row = 0; row < mazeLayout.length; row += 1) {
    for (let column = 0; column < mazeLayout[row].length; column += 1) {
        if (mazeLayout[row][column] !== 1) {
            continue;
        }

        const wall = new THREE.Mesh(wallGeometry, wallMaterialPerspective);
        wall.castShadow = true;
        wall.receiveShadow = false;
        wall.position.set(column * tileSize, wallHeight * 0.5, row * tileSize);
        mazeGroup.add(wall);
    }
}


const perspectiveCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
perspectiveCamera.position.set(1.5, 1.0, 1.5);
perspectiveCamera.rotation.order = 'YXZ';

const orthoSize = Math.max(mazeWidth, mazeHeight) * 0.6;
const orthographicCamera = new THREE.OrthographicCamera(
    -orthoSize,
    orthoSize,
    orthoSize,
    -orthoSize,
    0.1,
    100
);
orthographicCamera.position.set(mazeCenterX, 18, mazeCenterZ);
orthographicCamera.lookAt(mazeCenterX, 0, mazeCenterZ);

let activeCamera = perspectiveCamera;
let activeView = 'perspective';

const controls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    dragging: false,
    previousX: 0,
    previousY: 0,
    yaw: Math.PI / 4,
    pitch: -0.08
};

const moveSpeed = 2.4;
const playerEyeHeight = 0.52;
const playerRadius = 0.22;
const mouseSensitivity = 0.0025;

const spawnCell = findSpawnCell(mazeLayout);
perspectiveCamera.position.set(spawnCell.column * tileSize, playerEyeHeight, spawnCell.row * tileSize);

function isWalkableAt(worldX, worldZ) {
    const sampleOffsets = [
        { x: -playerRadius, z: -playerRadius },
        { x: playerRadius, z: -playerRadius },
        { x: -playerRadius, z: playerRadius },
        { x: playerRadius, z: playerRadius }
    ];

    for (const offset of sampleOffsets) {
        const sampleX = worldX + offset.x;
        const sampleZ = worldZ + offset.z;
        const column = Math.floor(sampleX + 0.5);
        const row = Math.floor(sampleZ + 0.5);

        if (!isInsideGrid(mazeLayout, row, column) || mazeLayout[row][column] !== 0) {
            return false;
        }
    }

    return true;
}

function updatePerspectiveCamera(deltaSeconds) {
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
        const movementStep = moveSpeed * deltaSeconds;
        const nextX = perspectiveCamera.position.x + movementVector.x * movementStep;
        const nextZ = perspectiveCamera.position.z + movementVector.z * movementStep;

        if (isWalkableAt(nextX, perspectiveCamera.position.z)) {
            perspectiveCamera.position.x = nextX;
        }

        if (isWalkableAt(perspectiveCamera.position.x, nextZ)) {
            perspectiveCamera.position.z = nextZ;
        }
    }

    perspectiveCamera.position.y = playerEyeHeight;
    perspectiveCamera.rotation.y = controls.yaw;
    perspectiveCamera.rotation.x = controls.pitch;
}

function activatePerspectiveView() {
    activeCamera = perspectiveCamera;
    activeView = 'perspective';
    floor.material = floorMaterialPerspective;
    ceiling.visible = true;

    for (const wall of mazeGroup.children) {
        wall.material = wallMaterialPerspective;
    }
}

function activateOrthographicView() {
    activeCamera = orthographicCamera;
    activeView = 'orthographic';
    floor.material = floorMaterialOrthographic;
    ceiling.visible = false;

    for (const wall of mazeGroup.children) {
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

    controls.yaw -= deltaX * mouseSensitivity;
    controls.pitch -= deltaY * mouseSensitivity;
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

    if (activeView === 'perspective') {
        updatePerspectiveCamera(deltaSeconds);
    } else {
        orthographicCamera.lookAt(mazeCenterX, 0, mazeCenterZ);
    }

    renderer.render(scene, activeCamera);
    requestAnimationFrame(animate);
}

activatePerspectiveView();
onWindowResize();
animate();