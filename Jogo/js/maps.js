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

export function createHotelWallTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#6e0f1a';
    ctx.fillRect(0, 0, size, size);

    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.02)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 18;
        imageData.data[i]     = Math.max(0, Math.min(255, imageData.data[i]     + noise));
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

export function createHotelFloorTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#c07830';
    ctx.fillRect(0, 0, size, size);

    const cols = 4;
    const rows = 4;
    const tw = size / cols;
    const th = size / rows;

    const drawDiamond = (cx, cy, hw, hh) => {
        ctx.beginPath();
        ctx.moveTo(cx,      cy - hh);
        ctx.lineTo(cx + hw, cy     );
        ctx.lineTo(cx,      cy + hh);
        ctx.lineTo(cx - hw, cy     );
        ctx.closePath();
    };

    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const cx = (col + 0.5) * tw;
            const cy = (row + 0.5) * th;

            drawDiamond(cx, cy, tw * 0.46, th * 0.46);
            ctx.fillStyle = 'rgba(155, 85, 15, 0.30)';
            ctx.fill();
            drawDiamond(cx, cy, tw * 0.46, th * 0.46);
            ctx.strokeStyle = 'rgba(80, 32, 6, 0.80)';
            ctx.lineWidth = size / 110;
            ctx.stroke();

            drawDiamond(cx, cy, tw * 0.30, th * 0.30);
            ctx.fillStyle = 'rgba(240, 180, 70, 0.28)';
            ctx.fill();
            drawDiamond(cx, cy, tw * 0.30, th * 0.30);
            ctx.strokeStyle = 'rgba(80, 32, 6, 0.55)';
            ctx.lineWidth = size / 220;
            ctx.stroke();

            drawDiamond(cx, cy, tw * 0.10, th * 0.10);
            ctx.fillStyle = 'rgba(80, 32, 6, 0.50)';
            ctx.fill();
        }
    }

    const imageData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 16;
        imageData.data[i]     = Math.max(0, Math.min(255, imageData.data[i]     + noise));
        imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
        imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.anisotropy = 4;
    return texture;
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
