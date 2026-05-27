import * as THREE from 'three';
import { startGame } from './main.js';
import {
	createCoins,
	createGhosts,
	updateCoins,
	updateGhosts
} from './characters.js';
import { createMaze, getCenterMarkerCell, getMazeData } from './maze.js';
import { bindLightNumberKeys, registerLight } from './lights.js';
import { MAP_CONFIGS, drawMapThumbnail, createHotelWallTexture, createHotelFloorTexture } from './maps.js';
import { loadScores } from './scores.js';

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

	const scores = loadScores();

	if (scores.length === 0) {
		scoreEmpty.style.display = 'block';
		return;
	}

	scoreEmpty.style.display = 'none';

	for (let index = 0; index < scores.length; index += 1) {
		const entry = scores[index];
		const resultLabel = entry.result === 'win' ? 'Vitória' : 'Derrota';
		const mapLabel = entry.mapName ?? entry.mapId ?? '—';

		const listItem = document.createElement('li');
		const left = document.createElement('span');
		const right = document.createElement('span');

		left.textContent = `#${index + 1}  ${mapLabel} · ${resultLabel}`;
		right.textContent = `${entry.score ?? 0} pts`;
		right.style.paddingLeft = '2rem';
		right.style.whiteSpace = 'nowrap';

		listItem.append(left, right);
		scoreList.appendChild(listItem);
	}
}

function startNewGame() {
	showView('map-select');
}

function initMapSelect() {
	const carousel = document.querySelector('[data-view="map-select"] .map-carousel');
	if (!carousel) {
		return;
	}

	for (const config of Object.values(MAP_CONFIGS)) {
		const card = document.createElement('div');
		card.className = 'map-card';

		const thumb = document.createElement('canvas');
		thumb.width = 220;
		thumb.height = 140;
		drawMapThumbnail(thumb, config);

		const nameEl = document.createElement('h3');
		nameEl.textContent = config.name;

		const descEl = document.createElement('p');
		descEl.textContent = config.description;

		const enemyEl = document.createElement('span');
		enemyEl.className = 'map-card__enemy';
		enemyEl.textContent = config.enemyLabel;

		card.append(thumb, nameEl, descEl, enemyEl);
		card.addEventListener('click', () => {
			startGame(config);
			menuRoot?.classList.add('is-hidden');
		});
		carousel.appendChild(card);
	}
}

startButton?.addEventListener('click', startNewGame);
scoresButton?.addEventListener('click', () => {
	hydrateScoreList();
	showView('scores');
});
controlsButton?.addEventListener('click', () => showView('controls'));
backButton?.addEventListener('click', () => showView('main'));

showView('main');
initMapSelect();

function setupMenuMazeBackground() {
	if (!mazeCanvasA || !mazeCanvasB) {
		return;
	}

	bindLightNumberKeys();

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

	const ambientLight = registerLight('menuAmbient', new THREE.AmbientLight(0xffffff, 0.9));
	scene.add(ambientLight);
	const keyLight = registerLight('menuDirectional', new THREE.DirectionalLight(0xffffff, 0.9));
	keyLight.position.set(6, 10, 4);
	scene.add(keyLight);

	const tileSize = 1;
	const wallHeight = 1;
	const mazeRows = 23;
	const mazeColumns = 33;
	const wallTexture = createHotelWallTexture(256);
	const wallMaterial = new THREE.MeshStandardMaterial({
		color: 0xffffff,
		roughness: 0.85,
		metalness: 0.0,
		map: wallTexture ?? null
	});
	const floorTexture = createHotelFloorTexture(512);
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
