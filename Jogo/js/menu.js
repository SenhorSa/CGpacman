import { startGame } from './main.js';
import { playerSettings } from './characters.js';

const menuRoot = document.getElementById('menu-root');
const backButton = document.getElementById('menu-back');
const startButton = document.getElementById('menu-start');
const scoresButton = document.getElementById('menu-scores');
const controlsButton = document.getElementById('menu-controls');
const scoreList = document.getElementById('score-list');
const scoreEmpty = document.getElementById('score-empty');
const sensitivityInput = document.getElementById('sensitivity');
const sensitivityValue = document.getElementById('sensitivity-value');

const menuPanels = Array.from(document.querySelectorAll('[data-view]'));

function showView(viewName) {
	for (const panel of menuPanels) {
		const isTarget = panel.getAttribute('data-view') === viewName;
		panel.classList.toggle('is-hidden', !isTarget);
	}

	const showBack = viewName !== 'main';
	backButton?.classList.toggle('is-hidden', !showBack);
}

function updateSensitivityLabel(value) {
	if (!sensitivityValue) {
		return;
	}
	sensitivityValue.textContent = value.toFixed(4);
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

	for (const entry of scores.slice(0, 5)) {
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

if (sensitivityInput) {
	const initialValue = Number(playerSettings.mouseSensitivity ?? 0.0025);
	sensitivityInput.value = String(initialValue);
	updateSensitivityLabel(initialValue);

	sensitivityInput.addEventListener('input', (event) => {
		const nextValue = Number(event.target.value);
		playerSettings.mouseSensitivity = nextValue;
		updateSensitivityLabel(nextValue);
	});
}

startButton?.addEventListener('click', startNewGame);
scoresButton?.addEventListener('click', () => {
	hydrateScoreList();
	showView('scores');
});
controlsButton?.addEventListener('click', () => showView('controls'));
backButton?.addEventListener('click', () => showView('main'));

showView('main');
