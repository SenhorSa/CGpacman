import * as THREE from 'three';

const cardinalDirections = [
    { row: -1, column: 0 },
    { row: 1, column: 0 },
    { row: 0, column: -1 },
    { row: 0, column: 1 }
];

let centerMarkerCell = null;
let frontMarkerCell = null;

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
        '#.....#.....#.C.#.....#.........#',
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
        return createPacmanDarkDeceptionLayout(rows, columns);
    }

    centerMarkerCell = null;
    frontMarkerCell = null;

    return blueprint.map((row, rowIndex) => Array.from(row, (cell, columnIndex) => {
        if (cell === 'C') {
            centerMarkerCell = { row: rowIndex, column: columnIndex };
            return 0;
        }

        if (cell === 'P') {
            frontMarkerCell = { row: rowIndex, column: columnIndex };
            return 0;
        }

        return cell === '#' ? 1 : 0;
    }));
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

export function findSpawnCell(layout) {
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

    if (frontMarkerCell) {
        const faceThickness = tileSize * 0.08;
        const faceGeometry = new THREE.BoxGeometry(tileSize, wallHeight, faceThickness);
        const faceMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            toneMapped: false,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
            depthTest: false
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
