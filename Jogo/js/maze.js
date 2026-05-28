// maze.js
// Responsável por criar o layout do labirinto e construir a sua geometria 3D.
//
// Contém duas partes principais:
//
//   LAYOUT — createSymmetricMazeLayout cria a grelha 2D do labirinto a partir de
//             um blueprint textual (23×33 caracteres). Cada '#' é uma parede (1),
//             cada '.' é corredor (0). As letras P (porta), C (centro) e S (spawn)
//             marcam células especiais e são convertidas em 0 (corredor).
//
//   GEOMETRIA — createMaze constrói toda a geometria Three.js: chão, teto, paredes
//               (um Box por célula de parede), painel de porta decorativo e linha-guia
//               de bordo. Devolve os objetos para o resto do jogo usar.
//
//   NAVEGAÇÃO — isWalkableAt, findSpawnCell, getMazeData são utilitários que os
//               módulos de personagens e câmaras usam para se mover no labirinto.

import * as THREE from 'three';

// As quatro direções ortogonais usadas para navegação na grelha (cima, baixo, esquerda, direita)
const cardinalDirections = [
    { row: -1, column: 0 },
    { row: 1, column: 0 },
    { row: 0, column: -1 },
    { row: 0, column: 1 }
];

// Células marcadas com letras especiais no blueprint — preenchidas durante o parsing
let centerMarkerCell = null;  // célula 'C': centro do labirinto (ponto de reunião dos inimigos)
let frontMarkerCell  = null;  // célula 'P': frente do centro (onde aparece o painel de porta)
let spawnMarkerCell  = null;  // célula 'S': posição inicial do jogador

// ─────────────────────────────────────────────────────────────
// CRIAÇÃO DO LAYOUT (GRELHA 2D)
// ─────────────────────────────────────────────────────────────

/**
 * Cria uma grelha 2D totalmente preenchida com um valor fixo.
 * Usada como ponto de partida para algoritmos que "abrem" corredores.
 */
function createFilledGrid(rows, columns, fillValue) {
    return Array.from({ length: rows }, () => Array.from({ length: columns }, () => fillValue));
}

/**
 * Abre um corredor horizontal na grelha (define células como 0 entre startColumn e endColumn).
 */
function carveHorizontal(layout, row, startColumn, endColumn) {
    for (let column = startColumn; column <= endColumn; column += 1) {
        layout[row][column] = 0;
    }
}

/**
 * Abre um corredor vertical na grelha (define células como 0 entre startRow e endRow).
 */
function carveVertical(layout, column, startRow, endRow) {
    for (let row = startRow; row <= endRow; row += 1) {
        layout[row][column] = 0;
    }
}

/**
 * Gera um layout de labirinto alternativo por algoritmo (anéis + corredores + bloqueadores).
 * Usado como fallback se as dimensões não corresponderem ao blueprint principal.
 */
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

    carveHorizontal(layout, 10, 10, 16);
    carveHorizontal(layout, 11, 9, 17);
    carveHorizontal(layout, 12, 10, 16);
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

/**
 * Cria o layout do labirinto a partir do blueprint textual de 23×33 caracteres.
 * Cada caracter do blueprint é convertido:
 *   '#' → 1 (parede)     '.' → 0 (corredor)
 *   'C' → 0 + centerMarkerCell    'P' → 0 + frontMarkerCell    'S' → 0 + spawnMarkerCell
 * Se as dimensões pedidas não baterem com o blueprint, usa o layout algorítmico.
 */
function createSymmetricMazeLayout(rows, columns) {
    const blueprint = [
        '#################################',
        '#.....#.....#...#.....#.........#',
        '#.###.#.###.#.#.#.###.#.###.#.#.#',
        '#.#...#.#...#.#.#...#.#...#.#.#.#',
        '#.#.###.#.###.#.###.#.###.#.#.#.#',
        '#.#.#...#.....#.....#...#.#.#.#.#',
        '#.#.#.#####.#####.#####.#.#.#.#.#',
        '#.........#...#...#.........#...#',
        '###.#####.###.#.###.#####.###...#',
        '#...#...#...........#...#...#...#',
        '#.###.#.###.##P##.###.#.###.#.###',
        '#S....#.....#.C.#.....#.........#',
        '#.###.#.###.#####.###.#.###.#...#',
        '#...#...#...........#...#...#...#',
        '###.#####.###.#.###.#####.###.#.#',
        '#.........#...#...#.....#.....#.#',
        '#.#.#####.#.#####.#####.#.#####.#',
        '#.#.#...#.#.....#.....#.#...#.#.#',
        '#.#.###.#.###.#.#.###.#.###.#.#.#',
        '#.#...#.#...#.#.#...#.#...#.#...#',
        '#.###.#.###.#.#.#.###.#.###.#.###',
        '#...........#...#.....#.........#',
        '#################################'
    ];

    if (rows !== blueprint.length || columns !== blueprint[0].length) {
        centerMarkerCell = null;
        frontMarkerCell = null;
        spawnMarkerCell = null;
        return createPacmanDarkDeceptionLayout(rows, columns);
    }

    centerMarkerCell = null;
    frontMarkerCell = null;
    spawnMarkerCell = null;

    return blueprint.map((row, rowIndex) => Array.from(row, (cell, columnIndex) => {
        if (cell === 'C') {
            centerMarkerCell = { row: rowIndex, column: columnIndex };
            return 0;
        }

        if (cell === 'P') {
            frontMarkerCell = { row: rowIndex, column: columnIndex };
            return 0;
        }

        if (cell === 'S') {
            spawnMarkerCell = { row: rowIndex, column: columnIndex };
            return 0;
        }

        return cell === '#' ? 1 : 0;
    }));
}

// ─────────────────────────────────────────────────────────────
// TEXTURAS DA PORTA
// ─────────────────────────────────────────────────────────────

/**
 * Desenha a base de uma porta de duas folhas num canvas 2D.
 * Cada folha tem dois painéis com brilho e sombra, e um puxador dourado.
 * Reutilizado por createDoorFaceTexture e createBarricadedDoorFaceTexture.
 */
function drawDoorBase(ctx, size) {
    ctx.fillStyle = '#2a0e04';
    ctx.fillRect(0, 0, size, size);

    const fb = Math.round(size * 0.07);
    const gap = Math.round(size * 0.04);
    const mid = size / 2;
    const leafTop = fb;
    const leafH = size - fb * 2;

    function drawLeaf(lx, lw) {
        ctx.fillStyle = '#7b3a10';
        ctx.fillRect(lx, leafTop, lw, leafH);

        ctx.save();
        ctx.beginPath();
        ctx.rect(lx, leafTop, lw, leafH);
        ctx.clip();
        for (let y = leafTop; y < leafTop + leafH; y += Math.round(size * 0.04)) {
            ctx.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.06})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lx, y);
            ctx.lineTo(lx + lw, y + (Math.random() - 0.5) * 3);
            ctx.stroke();
        }
        ctx.restore();

        const padX = Math.round(lw * 0.10);
        const pw = lw - padX * 2;
        const px = lx + padX;
        const padV = Math.round(leafH * 0.06);
        const innerH = leafH - padV * 3;
        const topPH = Math.round(innerH * 0.42);
        const botPH = Math.round(innerH * 0.50);
        const panelDefs = [
            { py: leafTop + padV,             ph: topPH },
            { py: leafTop + padV * 2 + topPH, ph: botPH }
        ];

        for (const { py, ph } of panelDefs) {
            ctx.fillStyle = '#8c4018';
            ctx.fillRect(px, py, pw, ph);

            ctx.strokeStyle = 'rgba(210, 140, 65, 0.40)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, py + ph);
            ctx.lineTo(px, py);
            ctx.lineTo(px + pw, py);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(10, 3, 0, 0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px + pw, py);
            ctx.lineTo(px + pw, py + ph);
            ctx.lineTo(px, py + ph);
            ctx.stroke();
        }
    }

    const leftX = fb;
    const leftW = Math.round(mid - gap / 2) - fb;
    const rightX = Math.round(mid + gap / 2);
    const rightW = size - fb - rightX;

    drawLeaf(leftX, leftW);
    drawLeaf(rightX, rightW);

    const gs = ctx.createLinearGradient(mid - gap, 0, mid + gap, 0);
    gs.addColorStop(0, 'rgba(0,0,0,0)');
    gs.addColorStop(0.35, 'rgba(0,0,0,0.65)');
    gs.addColorStop(0.65, 'rgba(0,0,0,0.65)');
    gs.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gs;
    ctx.fillRect(Math.round(mid - gap), leafTop, gap * 2, leafH);

    const knobY = Math.round(leafTop + leafH * 0.62);
    const knobR = Math.round(size * 0.027);

    function drawKnob(kx) {
        const kg = ctx.createRadialGradient(
            kx - Math.round(knobR * 0.3), knobY - Math.round(knobR * 0.3), 1,
            kx, knobY, knobR
        );
        kg.addColorStop(0, '#f5e070');
        kg.addColorStop(0.5, '#c8920a');
        kg.addColorStop(1, '#5a3600');
        ctx.fillStyle = kg;
        ctx.beginPath();
        ctx.arc(kx, knobY, knobR, 0, Math.PI * 2);
        ctx.fill();
    }

    drawKnob(leftX + leftW - Math.round(leftW * 0.15));
    drawKnob(rightX + Math.round(rightW * 0.15));
}

/**
 * Cria a textura de porta normal num canvas de tamanho dado.
 * Usada no painel decorativo em frente da sala central.
 */
function createDoorFaceTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }
    drawDoorBase(ctx, size);
    return new THREE.CanvasTexture(canvas);
}

// ─────────────────────────────────────────────────────────────
// UTILITÁRIOS EXPORTADOS
// ─────────────────────────────────────────────────────────────

/**
 * Devolve a célula central do labirinto (marcada com 'C' no blueprint).
 * É o ponto de reunião dos inimigos após spawnar.
 */
export function getCenterMarkerCell() {
    return centerMarkerCell;
}

/**
 * Devolve a célula da frente (marcada com 'P' no blueprint).
 * É onde o painel decorativo de porta é colocado.
 */
export function getFrontMarkerCell() {
    return frontMarkerCell;
}

/**
 * Gera o layout do labirinto para usar no fundo animado do menu principal.
 * Usa o mesmo blueprint do jogo para garantir consistência visual.
 */
export function createMenuMazeLayout(rows, columns) {
    return createSymmetricMazeLayout(rows, columns);
}

/**
 * Verifica se uma coordenada (row, column) está dentro dos limites da grelha.
 */
function isInsideGrid(layout, row, column) {
    return row >= 0 && row < layout.length && column >= 0 && column < layout[0].length;
}

/**
 * Encontra a melhor célula de spawn para o jogador.
 * Prioridade: célula 'S' do blueprint → linha perto do fundo → primeira célula livre.
 *
 * @param {number[][]} layout - A grelha 2D do labirinto.
 * @returns {{ row: number, column: number }}
 */
export function findSpawnCell(layout) {
    if (spawnMarkerCell && layout[spawnMarkerCell.row]?.[spawnMarkerCell.column] === 0) {
        return spawnMarkerCell;
    }

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

/**
 * Verifica se uma posição no mundo é caminhável dado um raio de colisão.
 * Testa os quatro cantos da caixa delimitadora (radius × radius) — se algum
 * canto cair numa parede, a posição não é caminhável.
 *
 * @param {number[][]} mazeLayout - A grelha 2D.
 * @param {number}     worldX     - Coordenada X no mundo.
 * @param {number}     worldZ     - Coordenada Z no mundo.
 * @param {number}     radius     - Metade da largura da caixa de colisão.
 * @returns {boolean}
 */
export function isWalkableAt(mazeLayout, worldX, worldZ, radius) {
    const sampleOffsets = [
        { x: -radius, z: -radius },
        { x: radius, z: -radius },
        { x: -radius, z: radius },
        { x: radius, z: radius }
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

/**
 * Calcula as dimensões e o centro do labirinto em coordenadas do mundo.
 * Usado pelas câmaras e pelas luzes para se posicionarem corretamente.
 *
 * @param {number[][]} mazeLayout - A grelha 2D.
 * @param {number}     tileSize   - Tamanho de uma célula em unidades do mundo.
 * @returns {{ mazeWidth, mazeHeight, mazeCenterX, mazeCenterZ }}
 */
export function getMazeData(mazeLayout, tileSize) {
    const mazeWidth = mazeLayout[0].length;
    const mazeHeight = mazeLayout.length;
    const mazeCenterX = (mazeWidth - 1) * tileSize * 0.5;
    const mazeCenterZ = (mazeHeight - 1) * tileSize * 0.5;

    return {
        mazeWidth,
        mazeHeight,
        mazeCenterX,
        mazeCenterZ
    };
}

// ─────────────────────────────────────────────────────────────
// CONSTRUÇÃO DA GEOMETRIA 3D
// ─────────────────────────────────────────────────────────────

/**
 * Constrói toda a geometria 3D do labirinto na cena Three.js.
 *
 * Para cada célula '1' do layout cria um cubo (parede). Também cria:
 *   - Um PlaneGeometry como chão
 *   - Um PlaneGeometry como teto (com BackSide para ser visível de baixo)
 *   - Uma linha-guia de bordo (apenas para debug/alinhamento)
 *   - Um painel de porta decorativo sobre a célula 'P'
 *
 * Devolve todos os objetos para o jogo poder ajustar materiais, visibilidade, etc.
 *
 * @param {object} params
 * @param {THREE.Scene} params.scene      - A cena onde adicionar os objetos.
 * @param {number}      params.tileSize   - Tamanho de cada célula (normalmente 1).
 * @param {number}      params.wallHeight - Altura das paredes.
 * @param {number}      params.mazeRows    - Número de linhas da grelha.
 * @param {number}      params.mazeColumns - Número de colunas da grelha.
 * @param {object}      params.materials  - Materiais opcionais para substituir os padrão.
 * @returns {{ mazeLayout, mazeGroup, floor, ceiling, borderGuide }}
 */
export function createMaze({
    scene,
    tileSize,
    wallHeight,
    mazeRows,
    mazeColumns,
    materials = {}
}) {
    const wallMaterialPerspective = materials.wallMaterialPerspective
        ?? new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.9, metalness: 0.0 });
    const floorMaterialPerspective = materials.floorMaterialPerspective
        ?? new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 1.0, metalness: 0.0 });
    const ceilingMaterial = materials.ceilingMaterial
        ?? new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 1.0, metalness: 0.0, side: THREE.BackSide });
    const borderGuideMaterial = materials.borderGuideMaterial
        ?? new THREE.LineBasicMaterial({ color: 0xe5e7eb });

    const mazeLayout = createSymmetricMazeLayout(mazeRows, mazeColumns);

    const { mazeWidth, mazeHeight, mazeCenterX, mazeCenterZ } = getMazeData(mazeLayout, tileSize);

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

    const tileHalf = tileSize * 0.5;
    const borderGuidePoints = [
        new THREE.Vector3(-tileHalf, 0.03, -tileHalf),
        new THREE.Vector3(mazeWidth * tileSize - tileHalf, 0.03, -tileHalf),
        new THREE.Vector3(mazeWidth * tileSize - tileHalf, 0.03, mazeHeight * tileSize - tileHalf),
        new THREE.Vector3(-tileHalf, 0.03, mazeHeight * tileSize - tileHalf),
        new THREE.Vector3(-tileHalf, 0.03, -tileHalf)
    ];
    const borderGuideGeometry = new THREE.BufferGeometry().setFromPoints(borderGuidePoints);
    const borderGuide = new THREE.Line(borderGuideGeometry, borderGuideMaterial);
    scene.add(borderGuide);

    const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(mazeWidth * tileSize, mazeHeight * tileSize),
        ceilingMaterial
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(mazeCenterX, wallHeight + 0.02, mazeCenterZ);
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

    if (frontMarkerCell) {
        const faceThickness = tileSize * 0.08;
        const faceGeometry = new THREE.BoxGeometry(tileSize, wallHeight, faceThickness);
        const doorTex = createDoorFaceTexture(512);
        const faceMaterial = new THREE.MeshBasicMaterial({
            map: doorTex,
            toneMapped: false,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });
        const faceWall = new THREE.Mesh(faceGeometry, faceMaterial);
        faceWall.castShadow = true;
        faceWall.receiveShadow = false;
        faceWall.userData.isPanel = true;
        faceWall.position.set(
            frontMarkerCell.column * tileSize,
            wallHeight * 0.5,
            (frontMarkerCell.row - 0.5) * tileSize + tileSize * 0.01
        );
        faceWall.renderOrder = 1;
        mazeGroup.add(faceWall);
    }

    return {
        mazeLayout,
        mazeGroup,
        floor,
        ceiling,
        borderGuide
    };
}
