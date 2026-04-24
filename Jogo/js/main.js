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

const mazeLayout = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

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
mainLight.shadow.camera.left = -10;
mainLight.shadow.camera.right = 10;
mainLight.shadow.camera.top = 10;
mainLight.shadow.camera.bottom = -10;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 30;
scene.add(mainLight);

const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x0066ff });
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 1.0, metalness: 0.0 });
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 1.0, metalness: 0.0, side: THREE.BackSide });

const mazeGroup = new THREE.Group();
scene.add(mazeGroup);

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(mazeWidth * tileSize, mazeHeight * tileSize),
    floorMaterial
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(mazeCenterX, 0, mazeCenterZ);
floor.receiveShadow = true;
scene.add(floor);

const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(mazeWidth * tileSize, mazeHeight * tileSize),
    ceilingMaterial
);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.set(mazeCenterX, wallHeight, mazeCenterZ);
scene.add(ceiling);

const wallGeometry = new THREE.BoxGeometry(tileSize, wallHeight, tileSize);

for (let row = 0; row < mazeLayout.length; row += 1) {
    for (let column = 0; column < mazeLayout[row].length; column += 1) {
        if (mazeLayout[row][column] !== 1) {
            continue;
        }

        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.castShadow = true;
        wall.receiveShadow = true;
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
    up: false,
    down: false,
    dragging: false,
    previousX: 0,
    previousY: 0,
    yaw: Math.PI / 4,
    pitch: -0.08
};

const moveSpeed = 2.4;
const verticalSpeed = 1.6;
const mouseSensitivity = 0.0025;

function updatePerspectiveCamera(deltaSeconds) {
    const forwardVector = new THREE.Vector3(Math.sin(controls.yaw), 0, Math.cos(controls.yaw));
    const rightVector = new THREE.Vector3(Math.cos(controls.yaw), 0, -Math.sin(controls.yaw));

    if (controls.forward) {
        perspectiveCamera.position.addScaledVector(forwardVector, moveSpeed * deltaSeconds);
    }

    if (controls.backward) {
        perspectiveCamera.position.addScaledVector(forwardVector, -moveSpeed * deltaSeconds);
    }

    if (controls.left) {
        perspectiveCamera.position.addScaledVector(rightVector, -moveSpeed * deltaSeconds);
    }

    if (controls.right) {
        perspectiveCamera.position.addScaledVector(rightVector, moveSpeed * deltaSeconds);
    }

    if (controls.up) {
        perspectiveCamera.position.y += verticalSpeed * deltaSeconds;
    }

    if (controls.down) {
        perspectiveCamera.position.y -= verticalSpeed * deltaSeconds;
    }

    perspectiveCamera.rotation.y = controls.yaw;
    perspectiveCamera.rotation.x = controls.pitch;
}

function activatePerspectiveView() {
    activeCamera = perspectiveCamera;
    activeView = 'perspective';
}

function activateOrthographicView() {
    activeCamera = orthographicCamera;
    activeView = 'orthographic';
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
        case 'KeyQ':
            controls.up = true;
            break;
        case 'KeyE':
            controls.down = true;
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
        case 'KeyQ':
            controls.up = false;
            break;
        case 'KeyE':
            controls.down = false;
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
    const frustumSize = Math.max(mazeWidth, mazeHeight) * 0.6;
    orthographicCamera.left = -(frustumSize * aspect) / 2;
    orthographicCamera.right = (frustumSize * aspect) / 2;
    orthographicCamera.top = frustumSize / 2;
    orthographicCamera.bottom = -frustumSize / 2;
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

activateOrthographicView();
onWindowResize();
animate();