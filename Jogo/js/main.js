// main.js
// Ponto de entrada e orquestrador central do jogo.
//
// O único papel deste ficheiro é ligar todas as peças entre si:
// importa funcionalidades dos outros módulos, chama-as pela ordem
// correta e liga os seus resultados uns aos outros.
// Nenhuma lógica complexa vive aqui — cada responsabilidade tem o seu módulo:
//
//   walllamp.js   → criação e colocação de candeeiros de parede
//   scene.js      → cena, renderizador, câmaras, troca de vistas
//   ui.js         → pontuação, menu de pausa, ecrã de fim de jogo
//   gameplay.js   → modo fantasmas, modo poder, moeda, colisões
//   minimap.js    → renderização do minimapa
//   characters.js → jogador, fantasmas, pacman, moedas  (NÃO EDITAR)
//   maze.js       → disposição e geometria do labirinto (NÃO EDITAR)
//   maps.js       → configurações dos mapas             (NÃO EDITAR)
//   lights.js     → registo de luzes                    (NÃO EDITAR)
//   scores.js     → persistência de pontuações          (NÃO EDITAR)

import * as THREE from 'three';
import { createMaze, getCenterMarkerCell, getMazeData } from './maze.js';
import { associarTeclasNumericasLuzes, registarLuz } from './lights.js';
import {
    MAP_CONFIGS,
    createHedgeWallTexture, createGrassFloorTexture,
    createConcreteWallTexture, createMetalFloorTexture,
    createHotelWallTexture, createHotelFloorTexture
} from './maps.js';
import {
    collectCoins, createCoins,
    createGhosts, createGhosts2D, createPacmanModels, createPlayer,
    playerSettings, isGhostInsideCenterBox,
    setGhost2DState, setGhostState,
    updateCoins, updateGhosts, updatePlayer
} from './characters.js';
import { colocarCandeeirosParede }                         from './walllamp.js';
import { criarCenaERenderizador, configurarLuzSolar, criarCamerasDeJogo, ativarVistaPerspetiva, ativarVistaTopDown, tratarRedimensionamento } from './scene.js';
import { criarElementoPontuacao, atualizarPontuacao, criarElementoTemporizador, obterElementosMenuPausa, mostrarSubPainelPausa, abrirMenuPausa, fecharMenuPausa, obterElementosFimJogo, terminarJogo } from './ui.js';
import { criarWidgetMoeda, criarEstadoModoFantasma, iniciarCicloMoeda, criarEstadoPoder, ativarPoder, atualizarPoder, obterIndiceColisaoFantasma, avancarParaAngulo } from './gameplay.js';
import { criarRenderizadorMinimapa, renderizarMinimapa }   from './minimap.js';

// ─────────────────────────────────────────────────────────────
// DIMENSÕES DO LABIRINTO
// Todos os mapas usam a mesma grelha de 23×33. O tamanho de célula 1
// significa que uma célula = uma unidade do mundo, o que simplifica
// todos os cálculos de posicionamento.
// ─────────────────────────────────────────────────────────────
const LINHAS_LABIRINTO   = 23;
const COLUNAS_LABIRINTO  = 33;
const TAMANHO_CELULA     = 1;  // uma célula = uma unidade do mundo
const ALTURA_PAREDE      = 1;  // as paredes têm 1 unidade de altura

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DA MOEDA
// Controla a frequência e suavidade das trocas de modo dos fantasmas.
// ─────────────────────────────────────────────────────────────
const CONFIGURACOES_MOEDA = {
    intervalMs:    30000,  // frequência dos lançamentos (a cada 30 segundos)
    revealDelayMs:   500,  // pausa antes da moeda começar a rodar (milissegundos)
    flipDurationMs: 1500,  // duração da animação de rotação
    resultHoldMs:   1500,  // tempo que o resultado é mostrado antes de desaparecer
    weightStep:      0.1,  // quanto a probabilidade muda após resultado repetido
    minWeight:      0.01,  // probabilidade mínima de perseguir
    maxWeight:      0.99   // probabilidade máxima de perseguir
};

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DO MODO PODER
// Apanhar uma moeda de poder brilhante ativa o modo poder.
// ─────────────────────────────────────────────────────────────
const CONFIGURACOES_PODER = {
    durationMs:      10000,  // o modo poder dura 10 segundos
    baseGhostPoints:    20   // o primeiro fantasma comido dá 20 pts; cada seguinte dá o dobro
};

// ─────────────────────────────────────────────────────────────
// POSIÇÕES DOS CANDEEIROS
// Cada entrada coloca um candeeiro numa parede específica do labirinto.
// As posições foram escolhidas manualmente para iluminar os corredores.
// { row, column } é uma célula caminhável; 'wall' é a parede vizinha.
// ─────────────────────────────────────────────────────────────
const POSICOES_CANDEEIROS = [
    { row: 1,  column: 3,  wall: 'south' }, { row: 1,  column: 9,  wall: 'north' },
    { row: 1,  column: 20, wall: 'north' }, { row: 1,  column: 26, wall: 'north' },
    { row: 1,  column: 30, wall: 'north' }, { row: 2,  column: 11, wall: 'east'  },
    { row: 2,  column: 17, wall: 'west'  }, { row: 2,  column: 23, wall: 'west'  },
    { row: 3,  column: 7,  wall: 'west'  }, { row: 3,  column: 13, wall: 'east'  },
    { row: 3,  column: 15, wall: 'west'  }, { row: 4,  column: 1,  wall: 'east'  },
    { row: 4,  column: 3,  wall: 'east'  }, { row: 4,  column: 9,  wall: 'west'  },
    { row: 4,  column: 19, wall: 'east'  }, { row: 4,  column: 29, wall: 'west'  },
    { row: 4,  column: 31, wall: 'east'  }, { row: 5,  column: 22, wall: 'north' },
    { row: 5,  column: 25, wall: 'east'  }, { row: 5,  column: 27, wall: 'west'  },
    { row: 7,  column: 7,  wall: 'north' }, { row: 7,  column: 12, wall: 'north' },
    { row: 7,  column: 16, wall: 'north' }, { row: 7,  column: 21, wall: 'north' },
    { row: 9,  column: 13, wall: 'south' }, { row: 9,  column: 15, wall: 'south' },
    { row: 9,  column: 26, wall: 'north' }, { row: 9,  column: 30, wall: 'south' },
    { row: 10, column: 1,  wall: 'east'  }, { row: 11, column: 5,  wall: 'east'  },
    { row: 11, column: 7,  wall: 'west'  }, { row: 11, column: 11, wall: 'east'  },
    { row: 11, column: 17, wall: 'west'  }, { row: 11, column: 21, wall: 'east'  },
    { row: 11, column: 23, wall: 'west'  }, { row: 11, column: 30, wall: 'north' },
    { row: 12, column: 1,  wall: 'east'  }, { row: 13, column: 14, wall: 'north' },
    { row: 14, column: 13, wall: 'east'  }, { row: 14, column: 15, wall: 'west'  },
    { row: 14, column: 25, wall: 'west'  }, { row: 15, column: 1,  wall: 'north' },
    { row: 15, column: 9,  wall: 'east'  }, { row: 15, column: 20, wall: 'north' },
    { row: 15, column: 28, wall: 'south' }, { row: 16, column: 31, wall: 'east'  },
    { row: 17, column: 5,  wall: 'west'  }, { row: 17, column: 10, wall: 'south' },
    { row: 17, column: 26, wall: 'north' }, { row: 19, column: 4,  wall: 'north' },
    { row: 19, column: 15, wall: 'east'  }, { row: 19, column: 17, wall: 'west'  },
    { row: 19, column: 21, wall: 'east'  }, { row: 19, column: 23, wall: 'west'  },
    { row: 19, column: 29, wall: 'west'  }, { row: 20, column: 11, wall: 'east'  },
    { row: 21, column: 1,  wall: 'west'  }, { row: 21, column: 7,  wall: 'south' },
    { row: 21, column: 13, wall: 'west'  }, { row: 21, column: 27, wall: 'south' }
];

// ─────────────────────────────────────────────────────────────
// AUXILIARES DE TEXTURA
// Devolvem a textura de parede/chão correta para o mapa selecionado.
// ─────────────────────────────────────────────────────────────

function obterTexturaParede(configuracaoMapa) {
    if (configuracaoMapa.wallTextureType === 'hedge')    return createHedgeWallTexture();
    if (configuracaoMapa.wallTextureType === 'concrete') return createConcreteWallTexture(256);
    return createHotelWallTexture(256);
}

function obterTexturaChao(configuracaoMapa) {
    if (configuracaoMapa.floorTextureType === 'grass') return createGrassFloorTexture(512);
    if (configuracaoMapa.floorTextureType === 'metal') return createMetalFloorTexture(512);
    return createHotelFloorTexture(512);
}

// ─────────────────────────────────────────────────────────────
// PONTO DE ENTRADA
// ─────────────────────────────────────────────────────────────

// Impede que iniciarJogo seja chamado mais de uma vez
// (clicar duas vezes num mapa criaria dois jogos sobrepostos)
let jogoIniciado = false;

/**
 * Inicia um novo jogo no mapa selecionado.
 * Chamada pelo menu quando o jogador clica num cartão de mapa.
 *
 * @param {object} configuracaoMapa - Uma das configurações de MAP_CONFIGS em maps.js.
 */
export function startGame(configuracaoMapa = MAP_CONFIGS.hotel) {
    if (jogoIniciado) return;
    jogoIniciado = true;

    const elementoApp = document.getElementById('app');
    if (!elementoApp) return;

    // ── PASSO 1: Criar a cena 3D, o renderizador e as luzes da cena ──────────
    // A cena é o contentor de todos os objetos 3D.
    // O renderizador desenha a cena no canvas do navegador.

    const { cena, renderizador, nevoeiroJogo, luzPrincipal } = criarCenaERenderizador(elementoApp, configuracaoMapa);
    associarTeclasNumericasLuzes();  // as teclas numéricas 1–9 passam a controlar as luzes individuais

    // ── PASSO 2: Criar os materiais do labirinto ──────────────────────────────
    // Materiais de perspetiva: alta qualidade, afetados pela iluminação
    const texturaParede = obterTexturaParede(configuracaoMapa);
    const texturaChao   = obterTexturaChao(configuracaoMapa);

    const materialParedePersp = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: configuracaoMapa.wallRoughness, metalness: 0.0,
        map: texturaParede ?? null
    });
    const materialChaoPersp = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: configuracaoMapa.floorRoughness, metalness: 0.0,
        map: texturaChao ?? null
    });
    const materialTeto = new THREE.MeshStandardMaterial({
        color: configuracaoMapa.ceilingColor ?? 0xede0c8,
        roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide
    });

    // Materiais de topo: cores planas simples, sem cálculo de iluminação
    const materialParedeTop = new THREE.MeshBasicMaterial({
        map: texturaParede ?? null, color: 0xffffff, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const materialChaoTop = new THREE.MeshBasicMaterial({
        map: texturaChao ?? null, color: 0xffffff, toneMapped: false
    });
    const materialLinhaGuia = new THREE.LineBasicMaterial({ color: 0xe5e7eb });

    // O grupo de luzes pontuais contém todas as luzes dos candeeiros de parede
    // para que possam ser controladas em conjunto como um grupo registado
    const grupoPontosLuz = registarLuz('gamePointLights', new THREE.Group());
    cena.add(grupoPontosLuz);

    // ── PASSO 3: Construir a geometria do labirinto ───────────────────────────
    // layoutLabirinto é uma grelha 2D: 0 = caminhável, 1 = parede sólida.

    const { mazeLayout: layoutLabirinto, mazeGroup: grupoLabirinto, floor: chao, ceiling: teto } = createMaze({
        scene: cena, tileSize: TAMANHO_CELULA, wallHeight: ALTURA_PAREDE,
        mazeRows: LINHAS_LABIRINTO, mazeColumns: COLUNAS_LABIRINTO,
        materials: { wallMaterialPerspective: materialParedePersp, floorMaterialPerspective: materialChaoPersp, ceilingMaterial: materialTeto, borderGuideMaterial: materialLinhaGuia }
    });

    const { mazeWidth: larguraLabirinto, mazeHeight: alturaLabirinto, mazeCenterX: centroCenaX, mazeCenterZ: centroCenaZ } = getMazeData(layoutLabirinto, TAMANHO_CELULA);
    const celulaCentro = getCenterMarkerCell();  // célula central usada como base dos fantasmas

    // ── PASSO 4: Posicionar o sol ─────────────────────────────────────────────
    configurarLuzSolar(cena, luzPrincipal, celulaCentro, centroCenaX, centroCenaZ, larguraLabirinto, alturaLabirinto, TAMANHO_CELULA);

    // ── PASSO 5: Colocar candeeiros de parede ─────────────────────────────────
    // Só colocar se o mapa usar luzes pontuais (intensidade > 0)
    if (configuracaoMapa.pointLightIntensity > 0) {
        colocarCandeeirosParede({
            layoutLabirinto, tamanhoCelula: TAMANHO_CELULA, alturaParede: ALTURA_PAREDE,
            grupoDestino:   grupoPontosLuz,
            corLuz:         configuracaoMapa.pointLightColor,
            intensidadeLuz: configuracaoMapa.pointLightIntensity,
            posicoes:       POSICOES_CANDEEIROS
        });
    }

    // ── PASSO 6: Criar as câmaras ─────────────────────────────────────────────
    const { cameraPerspetiva, cameraTopDown } = criarCamerasDeJogo(
        larguraLabirinto, alturaLabirinto, centroCenaX, centroCenaZ
    );

    // ── PASSO 7: Criar o renderizador do minimapa ─────────────────────────────
    const TAMANHO_VISTA_MINIMAPA  = 4;   // unidades visíveis à volta do jogador de cada lado
    const ALTURA_CAMERA_MINIMAPA  = 12;  // altura acima do chão da câmara do minimapa
    const { renderizadorMinimapa, cameraMinimapa, raizMinimapa } = criarRenderizadorMinimapa(
        TAMANHO_VISTA_MINIMAPA, ALTURA_CAMERA_MINIMAPA
    );

    // ── PASSO 8: Criar todos os personagens ──────────────────────────────────

    // Jogador: configura os controlos de movimento e posiciona a câmara de perspetiva
    const { controls: controlos, spawnCell: celulaNascimento } = createPlayer({
        camera: cameraPerspetiva, mazeLayout: layoutLabirinto, tileSize: TAMANHO_CELULA
    });

    // Inimigos: modelos 3D para a vista em perspetiva
    const fantasmas = createGhosts({
        scene: cena, mazeLayout: layoutLabirinto, centerMarkerCell: celulaCentro,
        tileSize: TAMANHO_CELULA, wallHeight: ALTURA_PAREDE,
        enemyType: configuracaoMapa.enemyType
    });

    // Sprites 2D planos dos inimigos para as vistas de topo e minimapa
    const grupoFantasmas2D  = new THREE.Group();
    cena.add(grupoFantasmas2D);
    const modelos2DFantasmas = createGhosts2D({ ghosts: fantasmas, tileSize: TAMANHO_CELULA, enemyType: configuracaoMapa.enemyType });
    for (const fantasma2D of modelos2DFantasmas) grupoFantasmas2D.add(fantasma2D);

    // Pacman: um modelo 3D para a perspetiva, um sprite plano para a vista de topo
    const { pacman3D, pacman2D } = createPacmanModels({ tileSize: TAMANHO_CELULA });
    cena.add(pacman3D, pacman2D);

    // Círculo amarelo simples mostrado apenas no minimapa (não nas vistas principais)
    const pacmanMinimapa = new THREE.Mesh(
        new THREE.CircleGeometry(TAMANHO_CELULA * 0.22, 20),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    pacmanMinimapa.rotation.x = -Math.PI / 2;
    pacmanMinimapa.visible    = false;
    cena.add(pacmanMinimapa);

    // Pequeno círculo amarelo no chão diretamente sob o jogador (como um holofote)
    const holofoteJogador = new THREE.Mesh(
        new THREE.CircleGeometry(0.18, 24),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    holofoteJogador.rotation.x = -Math.PI / 2;
    holofoteJogador.position.y  = 0.06;
    cena.add(holofoteJogador);

    // ── PASSO 9: Colocar moedas ───────────────────────────────────────────────
    // Excluir a célula de nascimento do jogador e todas as células iniciais dos fantasmas
    // para evitar que moedas apareçam dentro dos personagens

    const celulasInicioFantasmas = fantasmas.map(f => ({
        row:    Math.round(f.position.z / TAMANHO_CELULA),
        column: Math.round(f.position.x / TAMANHO_CELULA)
    }));

    const { coins: moedas } = createCoins({
        scene: cena, mazeLayout: layoutLabirinto, tileSize: TAMANHO_CELULA,
        excludedCells:   [celulaNascimento, ...celulasInicioFantasmas],
        centerMarkerCell: celulaCentro,
        exclusionRadius: 2,   // distância mínima da base dos fantasmas para colocar moedas
        powerCoinCount:  5    // quantas moedas de poder brilhantes colocar
    });

    // ── PASSO 10: Criar os elementos da interface ─────────────────────────────
    const elementoPontuacao    = criarElementoPontuacao();
    const elementoTemporizador = criarElementoTemporizador();
    const menuPausa            = obterElementosMenuPausa();
    const elementosFimJogo     = obterElementosFimJogo();

    // ── PASSO 11: Criar o widget da moeda e o estado do modo fantasmas ────────
    const { contentorMoeda, interiorMoeda } = criarWidgetMoeda();
    const estadoModoFantasma = criarEstadoModoFantasma(CONFIGURACOES_MOEDA);

    // ── PASSO 12: Criar o estado do modo poder e do jogo ─────────────────────

    const estadoPoder = criarEstadoPoder();

    // estadoJogo.estado pode ser: 'a-jogar', 'pausado', 'terminado'
    // Controla se o ciclo de animação deve atualizar a mecânica de jogo
    const estadoJogo  = { estado: 'a-jogar', pausadoEm: 0 };

    // Rastreia qual câmara e qual vista ('perspetiva' ou 'topo') está ativa.
    // Este objeto é modificado pelas funções de troca de vista em scene.js.
    const estadoAtivo = { camera: cameraPerspetiva, vista: 'perspetiva' };

    // Totais acumulados ao longo do jogo
    let pontuacaoTotal    = 0;
    let moedasApanhadas   = 0;

    // ── PASSO 13: Rastreio da rotação do Pacman ───────────────────────────────
    // Controla a rotação visual atual dos modelos do Pacman para que
    // se virem suavemente para a direção de movimento.

    const ultimaDirecaoMovimento = new THREE.Vector3(1, 0, 0);  // última direção de movimento
    let   rotacaoPacman3D = Math.PI;  // rotação atual do modelo 3D do Pacman no eixo Y
    let   rotacaoPacman2D = 0;        // rotação atual do sprite 2D do Pacman no eixo Z
    const VELOCIDADE_ROTACAO_PACMAN = 12;  // radianos por segundo

    // ── PASSO 14: Pacote de vistas ────────────────────────────────────────────
    // Construído uma vez para não ter de listar todos estes parâmetros
    // cada vez que chamamos ativarVistaPerspetiva ou ativarVistaTopDown.

    const pacoteVistas = {
        controlos, cameraPerspetiva, cameraTopDown,
        raizMinimapa,
        chao, materialChaoPersp, materialChaoTop,
        teto, configuracaoMapa, nevoeiroJogo, cena,
        fantasmas, modelos2DFantasmas, pacman2D, pacman3D,
        grupoLabirinto, materialParedePersp, materialParedeTop,
        estadoAtivo
    };

    // ── PASSO 15: Temporizador da moeda ───────────────────────────────────────
    // O primeiro lançamento ocorre após 30 segundos.
    // Depois repete a cada 30 segundos.

    function executarLancamentoMoeda() {
        iniciarCicloMoeda(estadoModoFantasma, CONFIGURACOES_MOEDA, estadoPoder, estadoJogo, contentorMoeda, interiorMoeda);
    }

    setTimeout(() => {
        executarLancamentoMoeda();
        setInterval(executarLancamentoMoeda, CONFIGURACOES_MOEDA.intervalMs);
    }, CONFIGURACOES_MOEDA.intervalMs);

    // ── PASSO 16: Controlos de teclado ────────────────────────────────────────

    window.addEventListener('keydown', (evento) => {
        // Escape: abrir/fechar menu de pausa
        if (evento.code === 'Escape') {
            evento.preventDefault();
            if (estadoJogo.estado === 'a-jogar') {
                abrirMenuPausa(estadoJogo, controlos, menuPausa.raizPausa, menuPausa.paineis, menuPausa.botaoVoltar);
            } else if (estadoJogo.estado === 'pausado') {
                // Se um sub-painel estiver aberto (botão voltar visível), voltar ao painel principal
                if (menuPausa.botaoVoltar && !menuPausa.botaoVoltar.classList.contains('is-hidden')) {
                    mostrarSubPainelPausa('pause-main', menuPausa.raizPausa, menuPausa.paineis, menuPausa.botaoVoltar);
                } else {
                    fecharMenuPausa(estadoJogo, estadoPoder, menuPausa.raizPausa);
                }
            }
            return;
        }

        // R: recarregar a página (reinício rápido)
        if (evento.code === 'KeyR') { window.location.reload(); return; }

        // WASD: movimento
        if (evento.code === 'KeyW') { controlos.forward  = true; return; }
        if (evento.code === 'KeyS') { controlos.backward = true; return; }
        if (evento.code === 'KeyA') { controlos.left     = true; return; }
        if (evento.code === 'KeyD') { controlos.right    = true; return; }

        // Espaço: alternar entre vista 3D em perspetiva e vista 2D de topo
        if (evento.code === 'Space') {
            evento.preventDefault();
            if (estadoAtivo.vista === 'perspetiva') {
                ativarVistaTopDown(pacoteVistas);
            } else {
                ativarVistaPerspetiva(pacoteVistas);
            }
        }
    });

    window.addEventListener('keyup', (evento) => {
        if (evento.code === 'KeyW') { controlos.forward  = false; }
        if (evento.code === 'KeyS') { controlos.backward = false; }
        if (evento.code === 'KeyA') { controlos.left     = false; }
        if (evento.code === 'KeyD') { controlos.right    = false; }
    });

    // ── PASSO 17: Controlos de rato (rodar câmara na vista 3D) ───────────────

    renderizador.domElement.addEventListener('pointerdown', (evento) => {
        if (estadoAtivo.vista !== 'perspetiva' || estadoJogo.estado !== 'a-jogar') return;
        controlos.dragging  = true;
        controlos.previousX = evento.clientX;
        controlos.previousY = evento.clientY;
        renderizador.domElement.setPointerCapture(evento.pointerId);
    });

    renderizador.domElement.addEventListener('pointermove', (evento) => {
        if (!controlos.dragging || estadoAtivo.vista !== 'perspetiva' || estadoJogo.estado !== 'a-jogar') return;
        const deltaX = evento.clientX - controlos.previousX;
        const deltaY = evento.clientY - controlos.previousY;
        controlos.yaw   -= deltaX * playerSettings.mouseSensitivity;
        controlos.pitch -= deltaY * playerSettings.mouseSensitivity;
        controlos.pitch  = Math.max(-1.25, Math.min(1.25, controlos.pitch));  // limitar para não virar ao contrário
        controlos.previousX = evento.clientX;
        controlos.previousY = evento.clientY;
    });

    renderizador.domElement.addEventListener('pointerup', (evento) => {
        controlos.dragging = false;
        renderizador.domElement.releasePointerCapture(evento.pointerId);
    });

    // ── PASSO 18: Redimensionamento da janela ─────────────────────────────────

    window.addEventListener('resize', () => {
        tratarRedimensionamento({ renderizador, cameraPerspetiva, cameraTopDown, renderizadorMinimapa, raizMinimapa, alturaLabirinto });
    });

    // ── PASSO 19: Ligação dos botões de pausa e fim de jogo ───────────────────

    menuPausa.botaoContinuar?.addEventListener('click', () => fecharMenuPausa(estadoJogo, estadoPoder, menuPausa.raizPausa));
    menuPausa.botaoControlos?.addEventListener('click', () => mostrarSubPainelPausa('pause-controls', menuPausa.raizPausa, menuPausa.paineis, menuPausa.botaoVoltar));
    menuPausa.botaoSair?.addEventListener('click',      () => window.location.reload());
    menuPausa.botaoVoltar?.addEventListener('click',    () => mostrarSubPainelPausa('pause-main',     menuPausa.raizPausa, menuPausa.paineis, menuPausa.botaoVoltar));

    elementosFimJogo.botaoNovoJogo?.addEventListener('click',   () => window.location.reload());
    elementosFimJogo.botaoSairFimJogo?.addEventListener('click', () => window.location.reload());

    // ── PASSO 20: O ciclo do jogo ─────────────────────────────────────────────
    // Esta função é chamada ~60 vezes por segundo por requestAnimationFrame.
    // Atualiza cada parte móvel do jogo e depois desenha o fotograma.

    const relogio = new THREE.Clock();

    function animar() {
        const segundosDesdeUltimoFotograma = relogio.getDelta();  // segundos desde o último fotograma (~0.016 a 60fps)
        const agora                        = performance.now();   // milissegundos desde o carregamento da página

        // Só atualizar a mecânica de jogo enquanto o jogo está a decorrer ativamente
        if (estadoJogo.estado === 'a-jogar') {

            // Guardar onde a câmara estava antes do movimento para detetar deslocamento
            const xCameraAnterior = cameraPerspetiva.position.x;
            const zCameraAnterior = cameraPerspetiva.position.z;

            // Animar moedas (efeito de bóia/rotação)
            updateCoins({ elapsedSeconds: relogio.elapsedTime, coins: moedas, view: estadoAtivo.vista === 'perspetiva' ? 'perspective' : 'orthographic' });

            // Mover o jogador com base nas teclas premidas e no olhar do rato
            updatePlayer({ deltaSeconds: segundosDesdeUltimoFotograma, controls: controlos, camera: cameraPerspetiva, mazeLayout: layoutLabirinto });

            // Atualizar o temporizador do modo poder (também termina o modo quando expira)
            atualizarPoder(agora, estadoPoder, elementoTemporizador, fantasmas, modelos2DFantasmas, setGhostState, setGhost2DState);

            // Mover todos os inimigos; o comportamento depende do modo atual dos fantasmas
            updateGhosts({
                deltaSeconds: segundosDesdeUltimoFotograma,
                ghosts: fantasmas,
                mazeLayout: layoutLabirinto,
                tileSize: TAMANHO_CELULA,
                centerMarkerCell: celulaCentro,
                mode: estadoModoFantasma.modoFantasma,
                targetCell: {
                    row:    Math.round(cameraPerspetiva.position.z / TAMANHO_CELULA),
                    column: Math.round(cameraPerspetiva.position.x / TAMANHO_CELULA)
                },
                // Substituição de modo por fantasma: eyes = a regressar, poder ativo = fugir
                modeResolver: (fantasma) => {
                    if (fantasma.userData.state === 'eyes') return 'return';
                    if (estadoPoder.ativo)                  return 'flee';
                    return estadoModoFantasma.modoFantasma;
                },
                // Substituição de alvo por fantasma: eyes = regressar à base, senão = perseguir jogador
                targetResolver: (fantasma) => {
                    if (fantasma.userData.state === 'eyes' && celulaCentro) return celulaCentro;
                    return {
                        row:    Math.round(cameraPerspetiva.position.z / TAMANHO_CELULA),
                        column: Math.round(cameraPerspetiva.position.x / TAMANHO_CELULA)
                    };
                }
            });

            // Detetar se o jogador se moveu neste fotograma (para orientar o modelo do Pacman)
            const movimentoX = cameraPerspetiva.position.x - xCameraAnterior;
            const movimentoZ = cameraPerspetiva.position.z - zCameraAnterior;
            if (movimentoX * movimentoX + movimentoZ * movimentoZ > 1e-6) {
                ultimaDirecaoMovimento.set(movimentoX, 0, movimentoZ).normalize();
            }

            // Rodar suavemente o modelo 3D do Pacman para a direção em que a câmara aponta
            const alvo3DYaw  = controlos.yaw + Math.PI;
            rotacaoPacman3D  = avancarParaAngulo(rotacaoPacman3D, alvo3DYaw, VELOCIDADE_ROTACAO_PACMAN * segundosDesdeUltimoFotograma);
            pacman3D.rotation.y = rotacaoPacman3D;

            // Rodar suavemente o sprite 2D do Pacman para a direção de movimento
            let alvo2DYaw = rotacaoPacman2D;
            if (Math.abs(ultimaDirecaoMovimento.x) >= Math.abs(ultimaDirecaoMovimento.z)) {
                // Movimento horizontal — virar para a esquerda ou direita; inverter o sprite
                alvo2DYaw = 0;
                pacman2D.scale.x = ultimaDirecaoMovimento.x >= 0 ? 1 : -1;
            } else {
                // Movimento vertical — virar para cima ou para baixo
                pacman2D.scale.x = 1;
                alvo2DYaw = ultimaDirecaoMovimento.z <= 0 ? -3 * Math.PI / 2 : -Math.PI / 2;
            }
            rotacaoPacman2D         = avancarParaAngulo(rotacaoPacman2D, alvo2DYaw, VELOCIDADE_ROTACAO_PACMAN * segundosDesdeUltimoFotograma);
            pacman2D.rotation.z = rotacaoPacman2D;

            // Sincronizar as posições dos sprites 2D dos fantasmas com os modelos 3D
            for (let i = 0; i < fantasmas.length; i += 1) {
                const fantasma   = fantasmas[i];
                const fantasma2D = modelos2DFantasmas[i];
                fantasma2D.position.set(fantasma.position.x, TAMANHO_CELULA * 0.02, fantasma.position.z);

                // Se um fantasma comido (eyes) chegou à base, ressuscitá-lo
                if (fantasma.userData.state === 'eyes' && isGhostInsideCenterBox(fantasma, celulaCentro, TAMANHO_CELULA)) {
                    setGhostState(fantasma, 'normal');
                    setGhost2DState(fantasma2D, 'normal', fantasma.userData.color);
                    fantasma.userData.hasLeftBox = false;
                    fantasma.userData.canTurn    = true;
                    fantasma.userData.direction  = { row: 0, column: 0 };
                }
            }

            // Verificar colisão fantasma–jogador
            const xJogador = cameraPerspetiva.position.x;
            const zJogador = cameraPerspetiva.position.z;
            const indiceColisao = obterIndiceColisaoFantasma(xJogador, zJogador, playerSettings.playerRadius, fantasmas);

            if (indiceColisao >= 0) {
                const fantasmaTocado = fantasmas[indiceColisao];
                if (estadoPoder.ativo && fantasmaTocado.userData.state !== 'eyes') {
                    // Modo poder ativo: comer o fantasma por pontos bónus crescentes
                    setGhostState(fantasmaTocado, 'eyes');
                    setGhost2DState(modelos2DFantasmas[indiceColisao], 'eyes', fantasmaTocado.userData.color);
                    const bonus = CONFIGURACOES_PODER.baseGhostPoints * Math.pow(2, estadoPoder.sequenciaFantasmas);
                    estadoPoder.sequenciaFantasmas += 1;
                    pontuacaoTotal  += bonus;
                    atualizarPontuacao(elementoPontuacao, pontuacaoTotal);
                } else if (fantasmaTocado.userData.state !== 'eyes') {
                    // Modo normal: tocar num fantasma termina o jogo
                    terminarJogo('derrota', pontuacaoTotal, configuracaoMapa, estadoJogo, estadoPoder, elementoTemporizador, menuPausa.raizPausa, elementosFimJogo);
                }
            }

            // Verificar apanha de moedas
            const resultadoMoedas = collectCoins({
                playerX: xJogador, playerZ: zJogador,
                playerRadius: playerSettings.playerRadius,
                coins: moedas
            });

            if (resultadoMoedas.collectedCount > 0) {
                moedasApanhadas += resultadoMoedas.collectedCount;
                // Moedas normais = 1 pt cada; moedas de poder = 5 pts cada
                const moedasNormais = resultadoMoedas.collectedCount - resultadoMoedas.powerCollected;
                pontuacaoTotal += moedasNormais + resultadoMoedas.powerCollected * 5;
                atualizarPontuacao(elementoPontuacao, pontuacaoTotal);
            }

            // Apanhar uma moeda de poder ativa o modo poder
            if (resultadoMoedas.powerCollected > 0) {
                ativarPoder(
                    agora, estadoPoder, CONFIGURACOES_PODER, estadoModoFantasma,
                    fantasmas, modelos2DFantasmas,
                    contentorMoeda, elementoTemporizador,
                    setGhostState, setGhost2DState
                );
            }

            // Apanhar todas as moedas = vitória
            if (moedasApanhadas >= moedas.length) {
                terminarJogo('vitoria', pontuacaoTotal, configuracaoMapa, estadoJogo, estadoPoder, elementoTemporizador, menuPausa.raizPausa, elementosFimJogo);
            }
        }

        // ── Atualizações visuais que correm mesmo durante a pausa ────────────

        // Manter o holofote do chão sob o jogador a toda a hora
        holofoteJogador.position.set(cameraPerspetiva.position.x, holofoteJogador.position.y, cameraPerspetiva.position.z);

        // Manter os modelos do Pacman na posição do jogador no mundo
        const yBasePacman3D = pacman3D.userData.baseY ?? playerSettings.playerEyeHeight;
        pacman3D.position.set(cameraPerspetiva.position.x, yBasePacman3D, cameraPerspetiva.position.z);

        const yBasePacman2D = pacman2D.userData.baseY ?? TAMANHO_CELULA * 0.06;
        pacman2D.position.set(cameraPerspetiva.position.x, yBasePacman2D, cameraPerspetiva.position.z);
        pacmanMinimapa.position.set(cameraPerspetiva.position.x, yBasePacman2D, cameraPerspetiva.position.z);

        // Animar a boca do Pacman: onda sinusoidal cria o ciclo de abrir/fechar
        const aberturasBoca = Math.abs(Math.sin(relogio.elapsedTime * 7));
        if (pacman3D.userData.mouthMesh) pacman3D.userData.mouthMesh.morphTargetInfluences[0] = aberturasBoca;
        if (pacman2D.userData.mouthMesh) pacman2D.userData.mouthMesh.morphTargetInfluences[0] = aberturasBoca;

        // ── Desenhar a vista principal ────────────────────────────────────────
        renderizador.render(cena, estadoAtivo.camera);

        // ── Desenhar o minimapa (no seu canvas separado no canto) ─────────────
        renderizarMinimapa({
            renderizadorMinimapa, cameraMinimapa,
            alturaCamera: ALTURA_CAMERA_MINIMAPA,
            cena, grupoLabirinto,
            chao, materialChaoTop,
            teto,
            materialParedeTop,
            pacman3D, pacman2D, pacmanMinimapa,
            fantasmas, modelos2DFantasmas,
            posicaoCameraPersp: cameraPerspetiva.position,
            moedas, updateCoins,
            relogio, vistaAtiva: estadoAtivo.vista === 'perspetiva' ? 'perspective' : 'orthographic'
        });

        requestAnimationFrame(animar);
    }

    // ── PASSO 21: Arrancar o jogo ─────────────────────────────────────────────

    ativarVistaPerspetiva(pacoteVistas);        // configurar a vista 3D inicial
    tratarRedimensionamento({ renderizador, cameraPerspetiva, cameraTopDown, renderizadorMinimapa, raizMinimapa, alturaLabirinto });  // garantir tamanhos iniciais corretos
    atualizarPontuacao(elementoPontuacao, 0);   // mostrar "Pontos: 0" imediatamente
    animar();                                   // iniciar o ciclo do jogo
}
