// minimap.js
// Responsável por criar e renderizar o minimapa (o mapa pequeno no canto do ecrã).
//
// O minimapa é um segundo renderizador WebGL que usa a mesma cena 3D mas com
// uma câmara ortogonal de topo que segue o jogador. Para renderizar corretamente:
//   1. Trocamos temporariamente todos os materiais para as versões 2D planas
//   2. Escondemos os modelos 3D dos personagens e mostramos os sprites 2D planos
//   3. Renderizamos a cena com a câmara do minimapa
//   4. Restauramos todos os materiais e visibilidades originais
//
// Esta abordagem de "emprestar a cena" garante que o minimapa está sempre
// em perfeita sincronia com o mundo 3D sem necessitar de uma cópia separada.

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// CRIAÇÃO DO RENDERIZADOR DO MINIMAPA
// ─────────────────────────────────────────────────────────────

/**
 * Cria o renderizador WebGL e a câmara do minimapa.
 * Se os elementos DOM do canvas ou do contentor não existirem, devolve nulls
 * (o resto do código verifica null antes de usar).
 *
 * @param {number} tamanhoVista  - Quantas unidades do mundo a câmara do minimapa mostra de cada lado.
 *                                 Menor = mais aproximado, maior = mais afastado.
 * @param {number} alturaCamera  - Altura acima do chão a que a câmara do minimapa flutua.
 * @returns {{
 *   renderizadorMinimapa: THREE.WebGLRenderer | null,
 *   cameraMinimapa:       THREE.OrthographicCamera | null,
 *   raizMinimapa:         HTMLElement | null
 * }}
 */
export function criarRenderizadorMinimapa(tamanhoVista = 4, alturaCamera = 12) {
    const raizMinimapa   = document.getElementById('minimap');
    const canvasMinimapa = document.getElementById('minimap-canvas');

    if (!canvasMinimapa) {
        return { renderizadorMinimapa: null, cameraMinimapa: null, raizMinimapa: null };
    }

    const renderizadorMinimapa = new THREE.WebGLRenderer({
        canvas:          canvasMinimapa,
        alpha:           true,   // fundo transparente para a página aparecer por baixo
        antialias:       true,
        powerPreference: 'high-performance'
    });
    renderizadorMinimapa.setClearColor(0x000000, 0);         // limpar com transparente
    renderizadorMinimapa.outputColorSpace = THREE.SRGBColorSpace;

    // Câmara ortogonal quadrada — distância de vista igual nas quatro direções
    const cameraMinimapa = new THREE.OrthographicCamera(
        -tamanhoVista,  // bordo esquerdo
         tamanhoVista,  // bordo direito
         tamanhoVista,  // bordo superior
        -tamanhoVista,  // bordo inferior
        0.1,            // corte próximo
        60              // corte distante
    );

    return { renderizadorMinimapa, cameraMinimapa, raizMinimapa };
}

// ─────────────────────────────────────────────────────────────
// RENDERIZAÇÃO DO MINIMAPA
// Chamada em cada fotograma. Converte temporariamente a cena para 2D,
// renderiza o minimapa e depois restaura tudo para o estado da vista ativa.
// ─────────────────────────────────────────────────────────────

/**
 * Renderiza um fotograma do minimapa no canvas do minimapa.
 *
 * A câmara do minimapa segue o jogador diretamente de cima.
 * Para produzir o aspeto correto de topo, esta função:
 *   - Remove a névoa (a névoa só faz sentido na vista em primeira pessoa)
 *   - Esconde os modelos 3D e mostra os sprites 2D
 *   - Troca todas as paredes e o chão para os materiais 2D planos
 *   - Renderiza a cena com a câmara do minimapa
 *   - Restaura todas as propriedades alteradas para o que eram antes
 *
 * @param {object} contextoMinimapa - Todos os objetos necessários para renderizar o minimapa.
 */
export function renderizarMinimapa({
    renderizadorMinimapa, cameraMinimapa, alturaCamera,
    cena, grupoLabirinto,
    chao, materialChaoTop,
    teto,
    materialParedeTop,
    pacman3D, pacman2D, pacmanMinimapa,
    fantasmas, modelos2DFantasmas,
    posicaoCameraPersp,
    moedas, updateCoins,
    relogio, vistaAtiva
}) {
    if (!renderizadorMinimapa || !cameraMinimapa) return;

    const xJogador = posicaoCameraPersp.x;
    const zJogador = posicaoCameraPersp.z;

    // A câmara do minimapa fica sempre diretamente acima do jogador, a olhar para baixo
    cameraMinimapa.position.set(xJogador, alturaCamera, zJogador);
    cameraMinimapa.lookAt(xJogador, 0, zJogador);

    // ── Guardar: memorizar o estado atual de tudo o que vamos alterar ──────────
    const nevoeiroGuardado           = cena.fog;
    const fundoGuardado              = cena.background;
    const tetoVisivelGuardado        = teto.visible;
    const materialChaoGuardado       = chao.material;
    const pacman3DVisivelGuardado    = pacman3D.visible;
    const pacman2DVisivelGuardado    = pacman2D.visible;
    const visibilidadeFantasmas      = fantasmas.map(f => f.visible);
    const visibilidade2DFantasmas    = modelos2DFantasmas.map(f => f.visible);
    const materiaisParedes           = grupoLabirinto.children.map(parede => parede.material);

    // ── Preparar a cena para renderização de topo ───────────────────────────
    cena.fog        = null;   // sem névoa a partir de cima
    cena.background = null;   // transparente — o contentor do minimapa tem o seu próprio fundo

    teto.visible          = false;   // o teto bloquearia a vista de topo
    chao.material         = materialChaoTop;
    pacman3D.visible      = false;   // esconder o modelo 3D
    pacman2D.visible      = false;   // esconder também o sprite 2D do jogo
    pacmanMinimapa.visible = true;   // mostrar o ponto dedicado do minimapa

    // Mostrar sprites 2D dos fantasmas, esconder modelos 3D
    fantasmas.forEach(f => { f.visible = false; });
    modelos2DFantasmas.forEach(f => { f.visible = true; });

    // Trocar as paredes para o material plano não iluminado
    grupoLabirinto.children.forEach((parede, indice) => {
        if (parede.userData?.isPanel) return;
        parede.material = materialParedeTop;
        // Preservar referência ao material original mesmo que já fosse plano
        materiaisParedes[indice] = materiaisParedes[indice] ?? parede.material;
    });

    // Atualizar moedas para o aspeto 2D plano para este fotograma do minimapa
    updateCoins({ elapsedSeconds: relogio.elapsedTime, coins: moedas, view: 'orthographic' });

    // ── Renderizar ──────────────────────────────────────────────────────────
    renderizadorMinimapa.render(cena, cameraMinimapa);

    // ── Restaurar: repor tudo exatamente como estava ──────────────────────
    cena.fog        = nevoeiroGuardado;
    cena.background = fundoGuardado;

    teto.visible          = tetoVisivelGuardado;
    chao.material         = materialChaoGuardado;
    pacman3D.visible      = pacman3DVisivelGuardado;
    pacman2D.visible      = pacman2DVisivelGuardado;
    pacmanMinimapa.visible = false;

    fantasmas.forEach((f, i) => { f.visible = visibilidadeFantasmas[i]; });
    modelos2DFantasmas.forEach((f, i) => { f.visible = visibilidade2DFantasmas[i]; });
    grupoLabirinto.children.forEach((parede, i) => { parede.material = materiaisParedes[i]; });

    // Restaurar as moedas para a vista em que o jogador se encontra
    updateCoins({ elapsedSeconds: relogio.elapsedTime, coins: moedas, view: vistaAtiva });
}
