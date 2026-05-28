// scene.js
// Responsável por tudo o que diz respeito à renderização e às câmaras.
//
// Este módulo cria e gere:
//   - A Cena do Three.js (o contentor que guarda todos os objetos 3D)
//   - O Renderizador principal (desenha a cena no ecrã)
//   - Duas câmaras:
//       • cameraPerspetiva  → vista em primeira pessoa 3D (jogo normal)
//       • cameraTopDown     → vista de cima 2D (vista de pássaro, ativada com Espaço)
//   - O sol: a luz direcional que projeta sombras, mais uma esfera visível
//             e um sprite de resplendor no céu
//   - Troca de vistas: materiais, visibilidade e câmara ativa mudam ao
//     trocar entre a vista 3D e a vista 2D
//   - Redimensionamento da janela para a imagem preencher sempre o ecrã

import * as THREE from 'three';
import { registarLuz, definirLuzAtivaPorChave } from './lights.js';

// ─────────────────────────────────────────────────────────────
// CRIAÇÃO DA CENA E DO RENDERIZADOR
// ─────────────────────────────────────────────────────────────

/**
 * Cria a Cena do Three.js, o Renderizador WebGL principal e a iluminação da cena.
 * O elemento canvas do renderizador é adicionado ao contentor DOM fornecido.
 *
 * @param {HTMLElement} contentor       - O elemento DOM que recebe o canvas.
 * @param {object}      configuracaoMapa - Definições do mapa (cor de fundo, névoa, luzes, etc.).
 * @returns {{
 *   cena:          THREE.Scene,
 *   renderizador:  THREE.WebGLRenderer,
 *   nevoeiroJogo:  THREE.Fog | null,
 *   luzAmbiente:   THREE.AmbientLight,
 *   luzPrincipal:  THREE.DirectionalLight
 * }}
 */
export function criarCenaERenderizador(contentor, configuracaoMapa) {
    // A cena guarda todos os objetos 3D, luzes e câmaras
    const cena = new THREE.Scene();
    cena.background = new THREE.Color(configuracaoMapa.sceneBackground);

    // A névoa faz as paredes distantes desvanecerem no fundo, criando profundidade
    const nevoeiroJogo = configuracaoMapa.fogEnabled
        ? new THREE.Fog(configuracaoMapa.fogColor, configuracaoMapa.fogNear, configuracaoMapa.fogFar)
        : null;
    cena.fog = nevoeiroJogo;

    // O renderizador converte a cena 3D numa imagem 2D no ecrã
    const renderizador = new THREE.WebGLRenderer({
        antialias: true,                    // bordas mais suaves (ligeiramente mais lento mas melhor aspeto)
        powerPreference: 'high-performance'
    });
    renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // limite de 2× por desempenho
    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap;  // bordas de sombra suaves
    contentor.appendChild(renderizador.domElement);

    // Luz ambiente: preenche a cena toda com um brilho plano e sem direção
    // (impede que as áreas em sombra fiquem completamente negras)
    const luzAmbiente = registarLuz(
        'gameAmbient',
        new THREE.AmbientLight(configuracaoMapa.ambientColor, configuracaoMapa.ambientIntensity)
    );
    cena.add(luzAmbiente);

    // Luz direcional principal: funciona como o sol, projeta sombras
    const luzPrincipal = registarLuz(
        'gameDirectional',
        new THREE.DirectionalLight(configuracaoMapa.directionalColor, configuracaoMapa.directionalIntensity)
    );
    luzPrincipal.castShadow = true;
    luzPrincipal.shadow.mapSize.set(2048, 2048); // resolução das sombras (maior = sombras mais nítidas)
    luzPrincipal.shadow.bias = -0.0003;          // evita artefactos de sombra em superfícies planas
    luzPrincipal.shadow.normalBias = 0.04;
    cena.add(luzPrincipal);

    return { cena, renderizador, nevoeiroJogo, luzAmbiente, luzPrincipal };
}

// ─────────────────────────────────────────────────────────────
// SOL
// Posiciona a luz direcional para simular um sol a 60° de elevação
// e 45° de azimute, depois adiciona uma esfera visível e um sprite
// de resplendor no céu.
// ─────────────────────────────────────────────────────────────

/**
 * Posiciona a luz principal como um sol e adiciona os visuais do sol à cena.
 * A tecla '6' alterna o sol (e a luz ambiente) ligado/desligado.
 *
 * @param {THREE.Scene}              cena           - A cena onde os visuais são adicionados.
 * @param {THREE.DirectionalLight}   luzPrincipal   - A luz a posicionar e configurar.
 * @param {{ column: number, row: number } | null} celulaCentro - Centro do labirinto.
 * @param {number} centroCenaX   - X do mundo no centro do labirinto.
 * @param {number} centroCenaZ   - Z do mundo no centro do labirinto.
 * @param {number} larguraLabirinto  - Largura total do labirinto.
 * @param {number} alturaLabirinto   - Profundidade total do labirinto.
 * @param {number} tamanhoCelula     - Tamanho de uma célula em unidades do mundo.
 */
export function configurarLuzSolar(cena, luzPrincipal, celulaCentro, centroCenaX, centroCenaZ, larguraLabirinto, alturaLabirinto, tamanhoCelula) {
    // O sol orbita a 30 unidades de distância do centro do labirinto,
    // a 60° de elevação acima do horizonte e 45° de azimute horizontal.
    const pivotX = celulaCentro ? celulaCentro.column * tamanhoCelula : centroCenaX;
    const pivotZ = celulaCentro ? celulaCentro.row    * tamanhoCelula : centroCenaZ;
    const elevacao   = Math.PI / 3;  // 60° acima do horizonte
    const azimute    = Math.PI / 4;  // 45° de rotação horizontal
    const distanciaSol = 30;

    luzPrincipal.position.set(
        pivotX + distanciaSol * Math.cos(elevacao) * Math.cos(azimute),
        distanciaSol * Math.sin(elevacao),
        pivotZ + distanciaSol * Math.cos(elevacao) * Math.sin(azimute)
    );
    luzPrincipal.target.position.set(pivotX, 0, pivotZ);
    cena.add(luzPrincipal.target);

    // O frustum de sombra cobre todo o labirinto com uma pequena margem
    const metadeZonaSombra = Math.max(larguraLabirinto, alturaLabirinto) * 0.65;
    luzPrincipal.shadow.camera.left   = -metadeZonaSombra;
    luzPrincipal.shadow.camera.right  =  metadeZonaSombra;
    luzPrincipal.shadow.camera.top    =  metadeZonaSombra;
    luzPrincipal.shadow.camera.bottom = -metadeZonaSombra;
    luzPrincipal.shadow.camera.near   = 1;
    luzPrincipal.shadow.camera.far    = 80;
    luzPrincipal.shadow.camera.updateProjectionMatrix();

    // Esfera visível na posição da luz (representa o disco solar)
    const malhaCoreSol = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xfffde8 })
    );
    malhaCoreSol.position.copy(luzPrincipal.position);
    cena.add(malhaCoreSol);

    // Halo de resplendor: textura de canvas com gradiente radial, exibida como um Sprite billboard
    const canvasResplendor = document.createElement('canvas');
    canvasResplendor.width  = 256;
    canvasResplendor.height = 256;
    const ctxResplendor = canvasResplendor.getContext('2d');
    const gradiente = ctxResplendor.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradiente.addColorStop(0.00, 'rgba(255, 255, 220, 1.00)');
    gradiente.addColorStop(0.15, 'rgba(255, 240, 100, 0.85)');
    gradiente.addColorStop(0.40, 'rgba(255, 200,  40, 0.30)');
    gradiente.addColorStop(0.70, 'rgba(255, 160,   0, 0.08)');
    gradiente.addColorStop(1.00, 'rgba(255, 120,   0, 0.00)');
    ctxResplendor.fillStyle = gradiente;
    ctxResplendor.fillRect(0, 0, 256, 256);

    const spriteResplendorSol = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvasResplendor),
        blending: THREE.AdditiveBlending, // adiciona cor por cima, dando efeito de brilho
        transparent: true,
        depthWrite: false  // impede que o sprite bloqueie outros objetos
    }));
    spriteResplendorSol.position.copy(luzPrincipal.position);
    spriteResplendorSol.scale.set(14, 14, 1);
    cena.add(spriteResplendorSol);

    // A tecla '6' alterna o sol e a luz ambiente ligado/desligado
    let solVisivel = true;
    window.addEventListener('keydown', (evento) => {
        if (evento.key !== '6') return;
        solVisivel = !solVisivel;
        definirLuzAtivaPorChave('gameDirectional', solVisivel);
        definirLuzAtivaPorChave('gameAmbient',     solVisivel);
        malhaCoreSol.visible       = solVisivel;
        spriteResplendorSol.visible = solVisivel;
    });
}

// ─────────────────────────────────────────────────────────────
// CÂMARAS
// ─────────────────────────────────────────────────────────────

/**
 * Cria as duas câmaras do jogo.
 *
 * cameraPerspetiva — câmara 3D padrão em primeira pessoa.
 * cameraTopDown    — câmara plana vista de cima centrada no labirinto.
 *
 * @param {number} larguraLabirinto  - Largura total do labirinto.
 * @param {number} alturaLabirinto   - Profundidade total do labirinto.
 * @param {number} centroCenaX       - X do mundo no centro do labirinto.
 * @param {number} centroCenaZ       - Z do mundo no centro do labirinto.
 * @returns {{ cameraPerspetiva: THREE.PerspectiveCamera, cameraTopDown: THREE.OrthographicCamera }}
 */
export function criarCamerasDeJogo(larguraLabirinto, alturaLabirinto, centroCenaX, centroCenaZ) {
    // Câmara em perspetiva — campo de visão de 60° (ângulo vertical)
    const cameraPerspetiva = new THREE.PerspectiveCamera(
        60,                                          // campo de visão em graus
        window.innerWidth / window.innerHeight,      // rácio de aspeto igual à janela
        0.1,                                         // plano de corte próximo
        100                                          // plano de corte distante
    );

    // Câmara ortogonal de topo — sem distorção de perspetiva
    // O tamanho garante que todo o labirinto cabe na vista com alguma margem
    const metadeTamanhoOrtogonal = Math.max(larguraLabirinto, alturaLabirinto) * 0.6;
    const altitudeCameraTopDown = 18;  // altura acima do chão a que a câmara flutua
    const cameraTopDown = new THREE.OrthographicCamera(
        -metadeTamanhoOrtogonal,  // bordo esquerdo
         metadeTamanhoOrtogonal,  // bordo direito
         metadeTamanhoOrtogonal,  // bordo superior
        -metadeTamanhoOrtogonal,  // bordo inferior
        0.1,                      // corte próximo
        100                       // corte distante
    );
    cameraTopDown.position.set(centroCenaX, altitudeCameraTopDown, centroCenaZ);
    cameraTopDown.lookAt(centroCenaX, 0, centroCenaZ);

    return { cameraPerspetiva, cameraTopDown };
}

// ─────────────────────────────────────────────────────────────
// TROCA DE VISTAS
// O jogo tem duas vistas: perspetiva 3D (padrão) e topo 2D.
// Ao trocar, substituem-se materiais, câmara e quais modelos são visíveis.
// ─────────────────────────────────────────────────────────────

/**
 * Muda todos os objetos da cena para a vista 3D em perspetiva.
 * Mostra os modelos 3D dos personagens, ativa a névoa e usa os materiais completos.
 *
 * @param {object} pacoteVistas - Todos os objetos da cena que mudam entre vistas.
 */
export function ativarVistaPerspetiva({
    controlos, cameraPerspetiva, raizMinimapa,
    chao, materialChaoPersp,
    teto, configuracaoMapa, nevoeiroJogo, cena,
    fantasmas, modelos2DFantasmas, pacman2D, pacman3D,
    grupoLabirinto, materialParedePersp,
    estadoAtivo
}) {
    estadoAtivo.camera = cameraPerspetiva;
    estadoAtivo.vista  = 'perspetiva';
    controlos.view     = 'perspective';

    // Mostrar o minimapa no canto
    if (raizMinimapa) raizMinimapa.style.display = '';

    // Restaurar o material de chão de qualidade total
    chao.material = materialChaoPersp;

    // Mostrar teto apenas se o mapa assim o definir
    teto.visible = configuracaoMapa.ceilingVisible !== false;

    // Reativar névoa para profundidade nos corredores
    cena.fog = nevoeiroJogo;

    // Mostrar modelos 3D dos fantasmas, esconder os 2D planos
    for (const fantasma of fantasmas)          fantasma.visible = true;
    for (const modelo2D of modelos2DFantasmas) modelo2D.visible = false;

    // Mostrar Pacman 3D, esconder o sprite 2D
    pacman2D.visible = false;
    pacman3D.visible = true;

    // Aplicar o material detalhado de perspetiva a todas as paredes
    for (const parede of grupoLabirinto.children) {
        if (parede.userData?.isPanel) continue;  // ignorar painéis decorativos
        parede.material = materialParedePersp;
    }
}

/**
 * Muda todos os objetos da cena para a vista 2D ortogonal de topo.
 * Mostra sprites planos, remove a névoa e usa materiais simplificados.
 *
 * @param {object} pacoteVistas - Todos os objetos da cena que mudam entre vistas.
 */
export function ativarVistaTopDown({
    controlos, cameraTopDown, raizMinimapa,
    chao, materialChaoTop,
    teto, cena,
    fantasmas, modelos2DFantasmas, pacman2D, pacman3D,
    grupoLabirinto, materialParedeTop,
    estadoAtivo
}) {
    estadoAtivo.camera = cameraTopDown;
    estadoAtivo.vista  = 'topo';
    controlos.view     = 'orthographic';

    // Esconder o minimapa — a vista já é de cima
    if (raizMinimapa) raizMinimapa.style.display = 'none';

    // Material de chão plano simplificado (sem cálculo de iluminação)
    chao.material = materialChaoTop;

    // Sem teto na vista de topo — taparia tudo
    teto.visible = false;

    // Sem névoa — não faz sentido a partir de cima
    cena.fog = null;

    // Esconder modelos 3D dos fantasmas, mostrar os 2D planos
    for (const fantasma of fantasmas)          fantasma.visible = false;
    for (const modelo2D of modelos2DFantasmas) modelo2D.visible = true;

    // Mostrar sprite plano do Pacman, esconder o modelo 3D
    pacman2D.visible = true;
    pacman3D.visible = false;

    // Aplicar o material plano MeshBasicMaterial às paredes (sem iluminação, mais rápido)
    for (const parede of grupoLabirinto.children) {
        if (parede.userData?.isPanel) continue;
        parede.material = materialParedeTop;
    }
}

// ─────────────────────────────────────────────────────────────
// REDIMENSIONAMENTO DA JANELA
// ─────────────────────────────────────────────────────────────

/**
 * Atualiza o tamanho do renderizador, os rácios de aspeto das câmaras e o tamanho
 * do minimapa sempre que a janela do navegador for redimensionada.
 *
 * @param {object} alvosRedimensionamento - Todos os renderizadores e câmaras a atualizar.
 */
export function tratarRedimensionamento({
    renderizador, cameraPerspetiva, cameraTopDown,
    renderizadorMinimapa, raizMinimapa,
    alturaLabirinto
}) {
    const largura = window.innerWidth;
    const altura  = window.innerHeight;

    // Redimensionar o canvas principal para preencher a janela
    renderizador.setSize(largura, altura);

    // Atualizar o rácio de aspeto da câmara de perspetiva para evitar deformação
    cameraPerspetiva.aspect = largura / altura;
    cameraPerspetiva.updateProjectionMatrix();

    // Recalcular o frustum da câmara ortogonal para o novo rácio de aspeto,
    // de modo a mostrar sempre o labirinto completo sem deformação
    const racioAspeto = largura / altura;
    const metadeAltura = (alturaLabirinto + 2) * 0.5;
    cameraTopDown.left   = -metadeAltura * racioAspeto;
    cameraTopDown.right  =  metadeAltura * racioAspeto;
    cameraTopDown.top    =  metadeAltura;
    cameraTopDown.bottom = -metadeAltura;
    cameraTopDown.updateProjectionMatrix();

    // Redimensionar o canvas do minimapa para coincidir com o tamanho do seu contentor DOM
    if (renderizadorMinimapa && raizMinimapa) {
        const tamanhoMinimapa = raizMinimapa.clientWidth || 160;
        const pixelRatio = Math.min(window.devicePixelRatio, 2);
        renderizadorMinimapa.setPixelRatio(pixelRatio);
        renderizadorMinimapa.setSize(tamanhoMinimapa, tamanhoMinimapa, false);
    }
}
