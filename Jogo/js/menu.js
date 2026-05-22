import * as THREE from 'three';
import { startGame } from './main.js';
import {
	createCoins,
	createGhosts,
	updateCoins,
	updateGhosts
} from './characters.js';
import { createMaze, getCenterMarkerCell, getMazeData } from './maze.js';

function createWallTexture(size = 256) {
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return null;
	}

	ctx.fillStyle = '#820101';
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

	ctx.fillStyle = '#c7ab6b';
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
	return texture;
}

const menuRoot = document.getElementById('menu-root');
const backButton = document.getElementById('menu-back');
const startButton = document.getElementById('menu-start');
const scoresButton = document.getElementById('menu-scores');
const controlsButton = document.getElementById('menu-controls');
const scoreList = document.getElementById('score-list');
const scoreEmpty = document.getElementById('score-empty');
const mazeCanvasA = document.getElementById('menu-maze-canvas-a');
const mazeCanvasB = document.getElementById('menu-maze-canvas-b');

const menuPanels = Array.from(document.querySelectorAll('[data-view]'));

function showView(viewName) {
	for (const panel of menuPanels) {
		const isTarget = panel.getAttribute('data-view') === viewName;
		panel.classList.toggle('is-hidden', !isTarget);
	}

	const showBack = viewName !== 'main';
	backButton?.classList.toggle('is-hidden', !showBack);
}

function hydrateScoreList() {
	if (!scoreList || !scoreEmpty) {
		return;
	}

	scoreList.innerHTML = '';

	const stored = localStorage.getItem('pacman3d_scores');
	const scores = stored ? JSON.parse(stored) : [];

	if (!Array.isArray(scores) || scores.length === 0) {
		scoreEmpty.style.display = 'block';
		return;
	}

	scoreEmpty.style.display = 'none';

	const maxEntries = 5;
	const scoreCount = Math.min(scores.length, maxEntries);
	for (let index = 0; index < scoreCount; index += 1) {
		const entry = scores[index];
		const listItem = document.createElement('li');
		const label = document.createElement('span');
		const value = document.createElement('span');

		label.textContent = entry?.label ?? 'Jogo';
		value.textContent = entry?.score ?? 0;

		listItem.append(label, value);
		scoreList.appendChild(listItem);
	}
}

function startNewGame() {
	startGame();
	menuRoot?.classList.add('is-hidden');
}

function autoStartIfRequested() {
	if (!menuRoot) {
		return false;
	}

	const shouldAutoStart = sessionStorage.getItem('pacman3d_autostart');
	if (!shouldAutoStart) {
		return false;
	}

	sessionStorage.removeItem('pacman3d_autostart');
	menuRoot.classList.add('is-hidden');
	startNewGame();
	return true;
}

startButton?.addEventListener('click', startNewGame);
scoresButton?.addEventListener('click', () => {
	hydrateScoreList();
	showView('scores');
});
controlsButton?.addEventListener('click', () => showView('controls'));
backButton?.addEventListener('click', () => showView('main'));

if (!autoStartIfRequested()) {
	showView('main');
}

function setupMenuMazeBackground() {
	if (!mazeCanvasA || !mazeCanvasB) {
		return;
	}

	const canvases = [mazeCanvasA, mazeCanvasB];
	const renderers = canvases.map((canvas) => new THREE.WebGLRenderer({
		canvas,
		alpha: true,
		antialias: true,
		powerPreference: 'low-power'
	}));
	const scene = new THREE.Scene();
	const cameras = [
		new THREE.PerspectiveCamera(55, 1, 0.1, 60),
		new THREE.PerspectiveCamera(55, 1, 0.1, 60)
	];

	for (const renderer of renderers) {
		renderer.setClearColor(0x000000, 0);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
	}

	const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
	scene.add(ambientLight);
	const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
	keyLight.position.set(6, 10, 4);
	scene.add(keyLight);

	const tileSize = 1;
	const wallHeight = 1;
	const mazeRows = 23;
	const mazeColumns = 33;
	const wallTexture = createWallTexture(256);
	const wallMaterial = new THREE.MeshStandardMaterial({
		color: 0xffffff,
		roughness: 0.85,
		metalness: 0.0,
		map: wallTexture ?? null
	});
	const floorTexture = createCarpetFloorTexture(512);
	const floorMaterial = new THREE.MeshStandardMaterial({
		color: 0xffffff,
		roughness: 0.9,
		metalness: 0.0,
		map: floorTexture ?? null
	});

	const { mazeLayout, mazeGroup, floor, ceiling } = createMaze({
		scene,
		tileSize,
		wallHeight,
		mazeRows,
		mazeColumns,
		materials: {
			wallMaterialPerspective: wallMaterial,
			floorMaterialPerspective: floorMaterial
		}
	});

	const centerMarkerCell = getCenterMarkerCell();
	const { mazeCenterX, mazeCenterZ } = getMazeData(mazeLayout, tileSize);
	mazeGroup.position.set(0, 0, 0);
	floor.receiveShadow = false;
	ceiling.visible = false;

	const ghosts = createGhosts({
		scene,
		mazeLayout,
		centerMarkerCell,
		tileSize,
		wallHeight
	});

	const ghostCells = ghosts.map((ghost) => ({
		row: Math.round(ghost.position.z / tileSize),
		column: Math.round(ghost.position.x / tileSize)
	}));

	const { coins } = createCoins({
		scene,
		mazeLayout,
		tileSize,
		excludedCells: ghostCells,
		centerMarkerCell,
		exclusionRadius: 2
	});

	const presets = [
		{
			position: new THREE.Vector3(mazeCenterX - 6, 5.2, mazeCenterZ - 8),
			target: new THREE.Vector3(mazeCenterX, 0.4, mazeCenterZ),
			panAxis: new THREE.Vector3(1, 0, 0),
			panAmplitude: 1.1,
			phase: 0
		},
		{
			position: new THREE.Vector3(mazeCenterX + 7, 5.8, mazeCenterZ + 6),
			target: new THREE.Vector3(mazeCenterX, 0.6, mazeCenterZ + 2.5),
			panAxis: new THREE.Vector3(0, 0, 1),
			panAmplitude: 1.0,
			phase: Math.PI / 2
		},
		{
			position: new THREE.Vector3(mazeCenterX, 7.2, mazeCenterZ - 10),
			target: new THREE.Vector3(mazeCenterX - 1.5, 0.4, mazeCenterZ + 1),
			panAxis: new THREE.Vector3(1, 0, 0),
			panAmplitude: 1.2,
			phase: Math.PI
		}
	];

	let currentIndex = 0;
	let nextIndex = 1;
	let transitionStart = performance.now();
	let transitioning = false;
	const transitionDuration = 1200;
	const holdDuration = 5000;
	const baseOpacity = 0.7;
	let lastSwitchTime = performance.now();
	let activeSlot = 0;
	let nextSlot = 1;

	const resize = () => {
		const width = mazeCanvasA.clientWidth || window.innerWidth;
		const height = mazeCanvasA.clientHeight || window.innerHeight;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		for (const renderer of renderers) {
			renderer.setPixelRatio(dpr);
			renderer.setSize(width, height, false);
		}
		for (const camera of cameras) {
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
		}
	};

	const getPresetState = (preset, time) => {
		const pan = Math.sin(time * 0.00025 + preset.phase) * preset.panAmplitude;
		const position = preset.position.clone().add(preset.panAxis.clone().multiplyScalar(pan));
		const target = preset.target.clone();
		return { position, target };
	};

	const clock = new THREE.Clock();

	const render = (time) => {
		if (!menuRoot || menuRoot.classList.contains('is-hidden')) {
			requestAnimationFrame(render);
			return;
		}

		if (!transitioning && time - lastSwitchTime > holdDuration) {
			transitioning = true;
			transitionStart = time;
			lastSwitchTime = time;
			nextIndex = (currentIndex + 1) % presets.length;
		}

		const currentState = getPresetState(presets[currentIndex], time);
		const nextState = getPresetState(presets[nextIndex], time);

		if (transitioning) {
			const progress = Math.min((time - transitionStart) / transitionDuration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			const currentOpacity = baseOpacity * (1 - eased);
			const nextOpacity = baseOpacity * eased;

			canvases[activeSlot].style.opacity = String(currentOpacity);
			canvases[nextSlot].style.opacity = String(nextOpacity);

			cameras[activeSlot].position.copy(currentState.position);
			cameras[activeSlot].lookAt(currentState.target);
			cameras[nextSlot].position.copy(nextState.position);
			cameras[nextSlot].lookAt(nextState.target);
			renderers[activeSlot].render(scene, cameras[activeSlot]);
			renderers[nextSlot].render(scene, cameras[nextSlot]);

			if (progress >= 1) {
				currentIndex = nextIndex;
				transitioning = false;
				lastSwitchTime = time;
				const temp = activeSlot;
				activeSlot = nextSlot;
				nextSlot = temp;
				canvases[nextSlot].style.opacity = '0';
			}
		} else {
			canvases[activeSlot].style.opacity = String(baseOpacity);
			canvases[nextSlot].style.opacity = '0';
			cameras[activeSlot].position.copy(currentState.position);
			cameras[activeSlot].lookAt(currentState.target);
			renderers[activeSlot].render(scene, cameras[activeSlot]);
		}

		const deltaSeconds = clock.getDelta();
		updateGhosts({
			deltaSeconds: deltaSeconds * 0.6,
			ghosts,
			mazeLayout,
			tileSize,
			centerMarkerCell,
			mode: 'roam',
			targetCell: {
				row: centerMarkerCell?.row ?? Math.round(mazeCenterZ / tileSize),
				column: centerMarkerCell?.column ?? Math.round(mazeCenterX / tileSize)
			}
		});

		updateCoins({
			elapsedSeconds: clock.elapsedTime,
			coins,
			view: 'perspective'
		});

		requestAnimationFrame(render);
	};

	resize();
	window.addEventListener('resize', resize);
	canvases[activeSlot].style.opacity = String(baseOpacity);
	canvases[nextSlot].style.opacity = '0';
	requestAnimationFrame(render);
}

setupMenuMazeBackground();
