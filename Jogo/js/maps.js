import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

export function createHedgeWallTexture() {
    const texture = textureLoader.load('.\\Imagens\\Mapas\\Labirinto\\wall_textura.jpg');
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    texture.anisotropy = 4;
    return texture;
}

export function createGrassFloorTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#4a8c28';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 500; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const g = 100 + Math.floor(Math.random() * 80);
        ctx.fillStyle = `rgba(18, ${g}, 12, 0.32)`;
        ctx.fillRect(x, y, 1, 3 + Math.round(Math.random() * 4));
    }

    for (let i = 0; i < 60; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 8 + Math.random() * 20;
        ctx.fillStyle = `rgba(30, ${90 + Math.floor(Math.random() * 60)}, 15, 0.25)`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    const imageData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 18;
        imageData.data[i]     = Math.max(0, Math.min(255, imageData.data[i]     + n));
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + n));
        imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + n));
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.anisotropy = 4;
    return texture;
}

export function createConcreteWallTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#28271f';
    ctx.fillRect(0, 0, size, size);

    const blockH = Math.round(size * 0.26);
    for (let row = 0; row < 4; row += 1) {
        const offset = row % 2 === 0 ? 0 : size * 0.5;
        const blockW = size * 0.5;
        for (let col = -1; col < 3; col += 1) {
            const bx = col * blockW + offset;
            const by = row * blockH;
            const lv = 38 + Math.floor(Math.random() * 18);
            ctx.fillStyle = `rgb(${lv}, ${lv}, ${lv - 4})`;
            ctx.fillRect(bx + 2, by + 2, blockW - 4, blockH - 4);
            ctx.fillStyle = '#0e0d0b';
            ctx.fillRect(bx, by, blockW, 2);
            ctx.fillRect(bx, by, 2, blockH);
        }
    }

    for (let i = 0; i < 10; i += 1) {
        const x = Math.random() * size;
        const grad = ctx.createLinearGradient(x, 0, x + (Math.random() - 0.5) * 8, size);
        grad.addColorStop(0, 'rgba(120, 55, 8, 0)');
        grad.addColorStop(0.3, `rgba(120, 55, 8, ${0.12 + Math.random() * 0.22})`);
        grad.addColorStop(1, 'rgba(120, 55, 8, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - 5, 0, 10 + Math.random() * 10, size);
    }

    ctx.strokeStyle = 'rgba(8, 6, 4, 0.7)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
        let cx = Math.random() * size;
        let cy = Math.random() * size;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let j = 0; j < 5; j += 1) {
            cx += (Math.random() - 0.5) * 25;
            cy += 8 + Math.random() * 18;
            ctx.lineTo(cx, cy);
        }
        ctx.stroke();
    }

    const imageData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 18;
        imageData.data[i]     = Math.max(0, Math.min(255, imageData.data[i]     + n));
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + n));
        imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + n));
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.anisotropy = 4;
    return texture;
}

export function createMetalFloorTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#1c1b18';
    ctx.fillRect(0, 0, size, size);

    const grid = Math.round(size / 12);
    const bar = Math.round(grid * 0.28);

    for (let y = 0; y < size; y += grid) {
        ctx.fillStyle = '#2c2b26';
        ctx.fillRect(0, y, size, bar);
        ctx.fillStyle = 'rgba(90, 88, 72, 0.28)';
        ctx.fillRect(0, y, size, 1);
    }
    for (let x = 0; x < size; x += grid) {
        ctx.fillStyle = '#2c2b26';
        ctx.fillRect(x, 0, bar, size);
        ctx.fillStyle = 'rgba(90, 88, 72, 0.28)';
        ctx.fillRect(x, 0, 1, size);
    }

    for (let y = 0; y < size; y += grid) {
        for (let x = 0; x < size; x += grid) {
            const boltR = bar * 0.55;
            const bg = ctx.createRadialGradient(x + bar * 0.5, y + bar * 0.5, 0, x + bar * 0.5, y + bar * 0.5, boltR);
            bg.addColorStop(0, 'rgba(110, 108, 90, 0.85)');
            bg.addColorStop(0.5, 'rgba(55, 54, 46, 0.85)');
            bg.addColorStop(1, 'rgba(14, 14, 12, 0.85)');
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.arc(x + bar * 0.5, y + bar * 0.5, boltR, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    for (let i = 0; i < 6; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 12 + Math.random() * 35;
        const og = ctx.createRadialGradient(x, y, 0, x, y, r);
        og.addColorStop(0, 'rgba(8, 6, 3, 0.5)');
        og.addColorStop(0.6, 'rgba(16, 12, 5, 0.22)');
        og.addColorStop(1, 'rgba(16, 12, 5, 0)');
        ctx.fillStyle = og;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.55, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    const imageData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 12;
        imageData.data[i]     = Math.max(0, Math.min(255, imageData.data[i]     + n));
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + n));
        imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + n));
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5);
    texture.anisotropy = 4;
    return texture;
}

export function createFenceWallMaterial() {
    const material = new THREE.MeshStandardMaterial({
        color: 0x2a2a32,
        roughness: 0.4,
        metalness: 0.55,
        transparent: true,
        alphaTest: 0.15,
        side: THREE.DoubleSide
    });

    new THREE.TextureLoader().load('./Imagens/Mapas/Labirinto/fence_textura.png', (tex) => {
        const img = tex.image;
        const sz = Math.max(img.width || 512, img.height || 512);
        const canvas = document.createElement('canvas');
        canvas.width = sz;
        canvas.height = sz;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, sz, sz);
        const id = ctx.getImageData(0, 0, sz, sz);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const isFence = luma < 110;
            d[i]     = isFence ? 30  : 180;
            d[i + 1] = isFence ? 28  : 180;
            d[i + 2] = isFence ? 34  : 180;
            d[i + 3] = isFence ? 255 : 0;
        }
        ctx.putImageData(id, 0, 0);
        const processed = new THREE.CanvasTexture(canvas);
        processed.wrapS = THREE.RepeatWrapping;
        processed.wrapT = THREE.RepeatWrapping;
        processed.repeat.set(1, 1);
        processed.anisotropy = 4;
        material.map = processed;
        material.needsUpdate = true;
    });

    return material;
}

export function buildMansionEnvironment(scene, mazeCenterX, mazeCenterZ, mazeWidth, mazeHeight, tileSize) {
    const group = new THREE.Group();
    scene.add(group);

    const cx = mazeCenterX;
    const cz = -7;

    const matWall = new THREE.MeshStandardMaterial({ color: 0x272b35, roughness: 0.9, metalness: 0.05 });
    const matRoof = new THREE.MeshStandardMaterial({ color: 0x13161d, roughness: 0.95, metalness: 0.0 });
    const matWin  = new THREE.MeshStandardMaterial({
        color: 0xff7a10, emissive: 0xff4800, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.0
    });
    const matTrim = new THREE.MeshStandardMaterial({ color: 0x1b1e27, roughness: 0.8, metalness: 0.12 });
    const matGround = new THREE.MeshStandardMaterial({ color: 0x192e0b, roughness: 1.0 });
    const matPath   = new THREE.MeshStandardMaterial({ color: 0x38312a, roughness: 0.92 });

    const p = (geo, mat, x, y, z) => {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx + x, y, cz + z);
        group.add(mesh);
        return mesh;
    };

    // ── GROUND FLOOR ─────────────────────────────────────────────────────────
    p(new THREE.BoxGeometry(18, 3.5, 8), matWall, 0, 1.75, 0);         // main block; south face at z=-3
    p(new THREE.BoxGeometry(3.0, 3.2, 1.5), matWall, -5.5, 1.6, 4.75); // left bay; south face ≈ z=-1.5
    p(new THREE.BoxGeometry(3.0, 3.2, 1.5), matWall, 5.5, 1.6, 4.75);  // right bay
    p(new THREE.BoxGeometry(3.5, 3.5, 5.5), matWall, -11.0, 1.75, -0.5); // left wing
    p(new THREE.BoxGeometry(3.5, 3.5, 5.5), matWall, 11.0, 1.75, -0.5);  // right wing

    // ── SECOND FLOOR ─────────────────────────────────────────────────────────
    p(new THREE.BoxGeometry(16, 2.8, 7), matWall, 0, 4.9, 0);
    p(new THREE.BoxGeometry(2.8, 2.5, 1.0), matWall, -5.5, 4.85, 3.55);
    p(new THREE.BoxGeometry(2.8, 2.5, 1.0), matWall, 5.5, 4.85, 3.55);

    // ── CENTRAL TOWER ────────────────────────────────────────────────────────
    p(new THREE.BoxGeometry(4.5, 3.0, 4.5), matWall, 0, 7.8, -0.5);

    // ── ROUND TURRET (left) ──────────────────────────────────────────────────
    p(new THREE.CylinderGeometry(1.4, 1.6, 7.0, 12), matWall, -9.5, 3.5, 0.5);

    // ── PORCH ────────────────────────────────────────────────────────────────
    p(new THREE.BoxGeometry(8, 0.2, 2.5), matWall, 0, 0.1, 5.0);           // floor; south edge z=-1.25
    p(new THREE.BoxGeometry(8.6, 0.22, 2.8), matTrim, 0, 3.55, 5.15);      // roof
    for (const colX of [-3.5, -1.2, 1.2, 3.5]) {
        p(new THREE.CylinderGeometry(0.12, 0.14, 3.5, 8), matTrim, colX, 1.75, 6.2); // z=-0.8
    }

    // ── ROOFS ────────────────────────────────────────────────────────────────
    // Main pyramid
    const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), matRoof);
    mainRoof.rotation.y = Math.PI / 4;
    mainRoof.scale.set(11, 3.5, 6);
    mainRoof.position.set(cx, 5.25, cz);      // base at y=3.5, tip at y=7.0
    group.add(mainRoof);

    // Tower pointed roof
    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), matRoof);
    towerRoof.rotation.y = Math.PI / 4;
    towerRoof.scale.set(3.5, 5.5, 3.5);
    towerRoof.position.set(cx, 12.05, cz - 0.5); // base at y=9.3, tip at y=14.8
    group.add(towerRoof);

    // Turret cone
    const turretRoof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4.0, 12), matRoof);
    turretRoof.position.set(cx - 9.5, 9.0, cz + 0.5);
    group.add(turretRoof);

    // Side wing roofs
    for (const sx of [-11.0, 11.0]) {
        const wr = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), matRoof);
        wr.rotation.y = Math.PI / 4;
        wr.scale.set(2.8, 2.5, 4.0);
        wr.position.set(cx + sx, 4.75, cz - 0.5);
        group.add(wr);
    }

    // Bay window micro-roofs
    for (const bx of [-5.5, 5.5]) {
        const br = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), matRoof);
        br.rotation.y = Math.PI / 4;
        br.scale.set(1.7, 1.3, 1.1);
        br.position.set(cx + bx, 3.85, cz + 4.75);
        group.add(br);
    }

    // Dormer (center front)
    p(new THREE.BoxGeometry(1.5, 1.0, 0.6), matWall, 0, 4.9, 3.0);
    const dormerRoof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), matRoof);
    dormerRoof.rotation.y = Math.PI / 4;
    dormerRoof.scale.set(1.0, 0.9, 0.6);
    dormerRoof.position.set(cx, 5.5, cz + 3.0);
    group.add(dormerRoof);

    // ── CHIMNEYS ─────────────────────────────────────────────────────────────
    for (const [chX, chZ] of [[-4.5, -3.5], [2, -4], [6.5, -2.5]]) {
        p(new THREE.BoxGeometry(0.65, 3.5, 0.65), matTrim, chX, 5.25, chZ);
        p(new THREE.BoxGeometry(1.0, 0.28, 1.0), matTrim, chX, 7.14, chZ);
    }

    // ── SOUTH FACADE WINDOWS ─────────────────────────────────────────────────
    // Ground floor (main south face at z = cz+4 = -3)
    for (const wx of [-7, -4.5, -2, 0, 2, 4.5, 7]) {
        p(new THREE.BoxGeometry(0.62, 0.9, 0.05), matWin, wx, 1.9, 4.06);
    }
    // Bay window front faces
    p(new THREE.BoxGeometry(0.72, 0.88, 0.05), matWin, -5.5, 1.6, 5.56);
    p(new THREE.BoxGeometry(0.72, 0.88, 0.05), matWin, 5.5, 1.6, 5.56);
    // Second floor south
    for (const wx of [-6, -3.5, -1, 1, 3.5, 6]) {
        p(new THREE.BoxGeometry(0.58, 0.78, 0.05), matWin, wx, 4.9, 3.56);
    }
    p(new THREE.BoxGeometry(0.62, 0.72, 0.05), matWin, -5.5, 4.9, 4.06);
    p(new THREE.BoxGeometry(0.62, 0.72, 0.05), matWin, 5.5, 4.9, 4.06);
    // Tower south window + dormer
    p(new THREE.BoxGeometry(0.72, 0.82, 0.05), matWin, 0, 7.85, 1.81);
    p(new THREE.BoxGeometry(0.5, 0.5, 0.05), matWin, 0, 4.88, 3.32);
    // East / west side windows
    for (let i = 0; i < 3; i++) {
        p(new THREE.BoxGeometry(0.05, 0.85, 0.62), matWin,  9.06, 1.9, -1.5 + i * 2);
        p(new THREE.BoxGeometry(0.05, 0.85, 0.62), matWin, -9.06, 1.9, -1.5 + i * 2);
        p(new THREE.BoxGeometry(0.05, 0.75, 0.58), matWin,  8.06, 4.9, -1.5 + i * 2);
    }
    // Turret window ring
    for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const tw = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.62, 0.05), matWin);
        tw.position.set(cx - 9.5 + Math.sin(ang) * 1.5, 3.5, cz + 0.5 + Math.cos(ang) * 1.5);
        tw.rotation.y = -ang;
        group.add(tw);
    }

    // ── WINDOW POINT LIGHTS ───────────────────────────────────────────────────
    const addLight = (x, y, z, color, intensity, dist) => {
        const l = new THREE.PointLight(color, intensity, dist);
        l.position.set(cx + x, y, cz + z);
        scene.add(l);
    };
    addLight(0, 2.2, 4.5, 0xff6010, 2.2, 11);
    addLight(-5, 2.0, 5.0, 0xff7020, 1.4, 8);
    addLight(5, 2.0, 5.0, 0xff7020, 1.0, 8);
    addLight(-4, 5.2, 4.0, 0xff6510, 1.2, 7);
    addLight(0, 8.5, 1.5, 0xff5000, 0.9, 6);
    addLight(-9.5, 3.8, 2.0, 0xff6010, 1.2, 7);

    // ── EXTENDED GROUND (north of maze) ──────────────────────────────────────
    const extGround = new THREE.Mesh(
        new THREE.PlaneGeometry((mazeWidth + 24) * tileSize, 26),
        matGround
    );
    extGround.rotation.x = -Math.PI / 2;
    extGround.position.set(cx, 0.006, cz - 6);
    scene.add(extGround);

    // Stone path from porch toward maze north gate
    const pathMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 7.5), matPath);
    pathMesh.rotation.x = -Math.PI / 2;
    pathMesh.position.set(cx, 0.008, cz + 7.25);
    scene.add(pathMesh);

    return group;
}

export function drawMapThumbnail(canvas, config) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = canvas.width;
    const h = canvas.height;

    const [wallCol, floorCol, accentCol] = config.previewColors;

    // Sky / scene background
    ctx.fillStyle = `#${config.sceneBackground.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, s, h);

    if (config.id === 'labirinto') {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
        skyGrad.addColorStop(0, '#7ec8e3');
        skyGrad.addColorStop(1, '#b8e4f0');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, s, h);
    }

    // Floor
    ctx.fillStyle = floorCol;
    ctx.fillRect(0, h * 0.62, s, h * 0.38);

    // Left wall
    ctx.fillStyle = wallCol;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.30, h * 0.38);
    ctx.lineTo(s * 0.30, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Right wall
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(s * 0.70, h * 0.38);
    ctx.lineTo(s * 0.70, h);
    ctx.lineTo(s, h);
    ctx.closePath();
    ctx.fill();

    // Ceiling
    if (config.ceilingVisible) {
        const ceilCol = config.ceilingColor
            ? `#${config.ceilingColor.toString(16).padStart(6, '0')}`
            : '#ede0c8';
        ctx.fillStyle = ceilCol;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(s, 0);
        ctx.lineTo(s * 0.70, h * 0.38);
        ctx.lineTo(s * 0.30, h * 0.38);
        ctx.closePath();
        ctx.fill();
    }

    if (config.id === 'hotel') {
        // Warm lamp glow on left wall
        const glow = ctx.createRadialGradient(s * 0.12, h * 0.42, 0, s * 0.12, h * 0.42, s * 0.22);
        glow.addColorStop(0, 'rgba(255, 200, 80, 0.75)');
        glow.addColorStop(1, 'rgba(255, 160, 40, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, s * 0.35, h);
        // Lamp bracket hint
        ctx.fillStyle = '#3a2510';
        ctx.fillRect(s * 0.08, h * 0.36, s * 0.04, s * 0.04);
    } else if (config.id === 'labirinto') {
        // Sunlight shaft
        const sun = ctx.createLinearGradient(s * 0.5, 0, s * 0.5, h * 0.6);
        sun.addColorStop(0, 'rgba(255, 252, 210, 0.18)');
        sun.addColorStop(1, 'rgba(255, 252, 210, 0)');
        ctx.fillStyle = sun;
        ctx.beginPath();
        ctx.moveTo(s * 0.38, 0);
        ctx.lineTo(s * 0.62, 0);
        ctx.lineTo(s * 0.72, h * 0.6);
        ctx.lineTo(s * 0.28, h * 0.6);
        ctx.closePath();
        ctx.fill();
    } else if (config.id === 'fabrica') {
        // Orange fog overlay
        const fog = ctx.createLinearGradient(s * 0.5, h * 0.38, s * 0.5, h);
        fog.addColorStop(0, 'rgba(255, 80, 10, 0.08)');
        fog.addColorStop(1, 'rgba(255, 80, 10, 0.22)');
        ctx.fillStyle = fog;
        ctx.fillRect(0, 0, s, h);
        // Fire barrel glow on floor
        const barrel = ctx.createRadialGradient(s * 0.5, h * 0.78, 0, s * 0.5, h * 0.78, s * 0.25);
        barrel.addColorStop(0, 'rgba(255, 100, 10, 0.55)');
        barrel.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = barrel;
        ctx.fillRect(0, h * 0.5, s, h * 0.5);
    }

    // Accent label strip at bottom
    ctx.fillStyle = accentCol;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(0, h - 4, s, 4);
    ctx.globalAlpha = 1;
}

export const MAP_CONFIGS = {
    hotel: {
        id: 'hotel',
        name: 'Hotel',
        description: 'Corredores sombrios de um hotel abandonado.',
        enemyType: 'ghost',
        enemyLabel: 'Fantasmas',
        sceneBackground: 0x0e1116,
        fogEnabled: false,
        fogColor: 0x0e1116,
        fogNear: 10,
        fogFar: 24,
        ambientColor: 0xffffff,
        ambientIntensity: 1.1,
        directionalColor: 0xffffff,
        directionalIntensity: 2.2,
        pointLightColor: 0xffd9a8,
        pointLightIntensity: 1.1,
        ceilingColor: 0xede0c8,
        ceilingVisible: true,
        wallRoughness: 0.65,
        floorRoughness: 0.9,
        wallTextureType: 'hotel',
        floorTextureType: 'carpet',
        previewColors: ['#6e0f1a', '#c07830', '#ede0c8'],
    },
    labirinto: {
        id: 'labirinto',
        name: 'Labirinto',
        description: 'Jardim de arbustos com cães raivosos à solta.',
        enemyType: 'dog',
        enemyLabel: 'Cães Raivosos',
        sceneBackground: 0x7ec8e3,
        fogEnabled: true,
        fogColor: 0x9ad8ee,
        fogNear: 10,
        fogFar: 22,
        ambientColor: 0xd8f0b0,
        ambientIntensity: 2.2,
        directionalColor: 0xfff8d0,
        directionalIntensity: 3.2,
        pointLightColor: 0xfff0a0,
        pointLightIntensity: 0.0,
        ceilingColor: null,
        ceilingVisible: false,
        wallRoughness: 0.95,
        floorRoughness: 0.95,
        wallTextureType: 'hedge',
        floorTextureType: 'grass',
        previewColors: ['#3a7a20', '#5db840', '#7ec8e3'],
    },
    fabrica: {
        id: 'fabrica',
        name: 'Fábrica Abandonada',
        description: 'Instalações industriais infestadas de robôs defeituosos.',
        enemyType: 'robot',
        enemyLabel: 'Robôs Defeituosos',
        sceneBackground: 0x060404,
        fogEnabled: true,
        fogColor: 0x1a0c06,
        fogNear: 4,
        fogFar: 12,
        ambientColor: 0xff5010,
        ambientIntensity: 0.35,
        directionalColor: 0xff6820,
        directionalIntensity: 0.6,
        pointLightColor: 0xff6010,
        pointLightIntensity: 1.4,
        ceilingColor: 0x080604,
        ceilingVisible: true,
        wallRoughness: 0.95,
        floorRoughness: 0.85,
        wallTextureType: 'concrete',
        floorTextureType: 'metal',
        previewColors: ['#252320', '#1c1c1a', '#ff6010'],
    }
};
