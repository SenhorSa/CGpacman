import * as THREE from 'three';
import { createMaze, getMazeData } from './maze.js';
import { createPlayer, updatePlayer, playerSettings } from './characters.js';

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

const { controls } = createPlayer({ camera: perspectiveCamera, mazeLayout, tileSize });

let activeCamera = perspectiveCamera;
let activeView = 'perspective';

function activatePerspectiveView() {
    activeCamera = perspectiveCamera;
    activeView = 'perspective';
    controls.view = 'perspective';
    floor.material = floorMaterialPerspective;
    ceiling.visible = true;

    for (const wall of mazeGroup.children) {
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

    updatePlayer({
        deltaSeconds,
        controls,
        camera: perspectiveCamera,
        mazeLayout,
        tileSize
    });

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
