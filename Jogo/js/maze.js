import * as THREE from 'three';

const cardinalDirections = [
    { row: -1, column: 0 },
    { row: 1, column: 0 },
    { row: 0, column: -1 },
    { row: 0, column: 1 }
];

let centerMarkerCell = null;
let frontMarkerCell = null;
let spawnMarkerCell = null;

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

function createBarricadedDoorFaceTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }
    drawDoorBase(ctx, size);

    const pt = Math.round(size * 0.115);
    const nailR = Math.round(pt * 0.17);

    function drawPlank(x1, y1, x2, y2) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const len = Math.hypot(x2 - x1, y2 - y1);
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const hw = len / 2;
        const hh = pt / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        ctx.fillStyle = '#9b6228';
        ctx.fillRect(-hw, -hh, len, pt);

        ctx.save();
        ctx.beginPath();
        ctx.rect(-hw, -hh, len, pt);
        ctx.clip();
        for (let x = -hw; x < hw; x += Math.round(size * 0.045)) {
            ctx.strokeStyle = 'rgba(40, 18, 4, 0.22)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, -hh);
            ctx.lineTo(x + Math.round(size * 0.01), hh);
            ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = 'rgba(230, 170, 90, 0.30)';
        ctx.fillRect(-hw, -hh, len, Math.round(pt * 0.22));

        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fillRect(-hw, hh - Math.round(pt * 0.20), len, Math.round(pt * 0.20));

        ctx.strokeStyle = '#5a2e08';
        ctx.lineWidth = 2;
        ctx.strokeRect(-hw, -hh, len, pt);

        for (const nx of [-hw + nailR * 2.2, hw - nailR * 2.2]) {
            const ng = ctx.createRadialGradient(
                nx - Math.round(nailR * 0.3), -Math.round(nailR * 0.3), 0,
                nx, 0, nailR
            );
            ng.addColorStop(0, '#c8c8c8');
            ng.addColorStop(0.5, '#585858');
            ng.addColorStop(1, '#1a1a1a');
            ctx.fillStyle = ng;
            ctx.beginPath();
            ctx.arc(nx, 0, nailR, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // Three planks: two diagonals crossing + one horizontal
    drawPlank(size * 0.02, size * 0.72, size * 0.98, size * 0.18);
    drawPlank(size * 0.02, size * 0.22, size * 0.98, size * 0.76);
    drawPlank(-size * 0.02, size * 0.48, size * 1.02, size * 0.48);

    return new THREE.CanvasTexture(canvas);
}

export function getCenterMarkerCell() {
    return centerMarkerCell;
}

export function getFrontMarkerCell() {
    return frontMarkerCell;
}

export function createMenuMazeLayout(rows, columns) {
    return createSymmetricMazeLayout(rows, columns);
}

function isInsideGrid(layout, row, column) {
    return row >= 0 && row < layout.length && column >= 0 && column < layout[0].length;
}

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
