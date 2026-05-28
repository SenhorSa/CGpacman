// walllamp.js
// Responsável por criar e posicionar candeeiros de parede no labirinto.
//
// Um candeeiro de parede é uma lanterna hexagonal fixada numa parede.
// É composto por:
//   - Uma placa de apoio encostada à parede
//   - Um braço curto que projeta a lanterna para fora
//   - Um corpo hexagonal de vidro com moldura metálica
//   - Uma lâmpada Edison luminosa no interior
//   - Uma PointLight do Three.js que ilumina a área em redor
//
// As geometrias (formas 3D) são criadas uma única vez e partilhadas
// por todos os candeeiros, para não sobrecarregar a memória da placa gráfica.

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
// CACHE DE RECURSOS PARTILHADOS
// Todos os candeeiros reutilizam as mesmas geometrias e materiais.
// O cache é reconstruído apenas se o tamanho da célula mudar
// (o que na prática nunca acontece — é sempre 1).
// ─────────────────────────────────────────────────────────────

/** Guarda as geometrias e materiais partilhados para um determinado tamanho de célula. */
let recursosCandeeiroCached = null;

/**
 * Devolve (ou cria) o conjunto de geometrias e materiais partilhados para o tamanho de célula dado.
 * @param {number} tamanhoCelula - Largura de uma célula do labirinto em unidades do mundo.
 */
function obterRecursosCandeeiro(tamanhoCelula) {
    if (recursosCandeeiroCached && recursosCandeeiroCached.tamanhoCelula === tamanhoCelula) {
        return recursosCandeeiroCached;
    }

    // 'tam' é abreviatura de 'tamanhoCelula' para tornar as medidas abaixo mais legíveis
    const tam = tamanhoCelula;

    recursosCandeeiroCached = {
        tamanhoCelula,

        // Placa plana encostada à superfície da parede
        geometriaPlaca:        new THREE.BoxGeometry(tam * 0.12, tam * 0.18, tam * 0.03),

        // Braço cilíndrico curto que projeta a lanterna para fora da parede
        // (CylinderGeometry alinha-se com o eixo Y; rodamos 90° para apontar em +Z)
        geometriaBraco:        new THREE.CylinderGeometry(tam * 0.018, tam * 0.024, tam * 0.06, 8),

        // Copo / pescoço hexagonal que liga o braço ao corpo da lanterna
        geometriaCopo:         new THREE.CylinderGeometry(tam * 0.040, tam * 0.028, tam * 0.05, 6),

        // Anéis decorativos no topo e na base do corpo da lanterna
        geometriaColeira:      new THREE.CylinderGeometry(tam * 0.063, tam * 0.063, tam * 0.013, 6),

        // Tubo hexagonal de vidro aberto — o corpo principal da lanterna (transparente)
        geometriaVidro:        new THREE.CylinderGeometry(tam * 0.055, tam * 0.055, tam * 0.14, 6, 1, true),

        // Barra vertical fina colocada em cada um dos 6 cantos hexagonais para emoldurar o vidro
        geometriaAresta:       new THREE.CylinderGeometry(tam * 0.007, tam * 0.007, tam * 0.14, 6),

        // Tampa piramidal hexagonal no topo da lanterna (ponta para cima)
        geometriaCapelo:       new THREE.CylinderGeometry(0, tam * 0.064, tam * 0.065, 6),

        // Pequena esfera decorativa no vértice da tampa
        geometriaEsferaDecorativa: new THREE.SphereGeometry(tam * 0.018, 8, 6),

        // Lâmpada Edison luminosa no interior da lanterna
        geometriaLampada:      new THREE.SphereGeometry(tam * 0.028, 10, 7),

        // Material escuro de bronze/ferro para todas as partes metálicas
        materialMetal: new THREE.MeshStandardMaterial({
            color: 0x3a2510, roughness: 0.55, metalness: 0.45
        }),

        // Material semitransparente para o tubo de vidro
        materialVidro: new THREE.MeshStandardMaterial({
            color: 0xfff3d0, roughness: 0.05, metalness: 0.0,
            transparent: true, opacity: 0.25, side: THREE.DoubleSide
        }),

        // Material emissivo quente que faz a lâmpada parecer acesa por dentro
        materialLampada: new THREE.MeshStandardMaterial({
            color: 0xfff1c1, emissive: 0xffb347, emissiveIntensity: 1.4
        }),
    };

    return recursosCandeeiroCached;
}

// ─────────────────────────────────────────────────────────────
// CRIAÇÃO DE UM ÚNICO CANDEEIRO
// ─────────────────────────────────────────────────────────────

/**
 * Constrói um candeeiro de parede completo como um Group do Three.js.
 * A origem local do grupo fica na superfície da parede.
 * A posição e rotação são definidas pela função que chama esta (colocarCandeeirosParede).
 *
 * @param {number} tamanhoCelula  - Largura de uma célula em unidades do mundo.
 * @param {number} corLuz         - Cor hexadecimal da luz pontual emitida.
 * @param {number} intensidadeLuz - Brilho da luz pontual.
 * @returns {{ grupo: THREE.Group, luz: THREE.PointLight }}
 */
function criarCandeeiroParede(tamanhoCelula, corLuz = 0xffd9a8, intensidadeLuz = 1.1) {
    const recursos = obterRecursosCandeeiro(tamanhoCelula);
    const tam = tamanhoCelula;
    const grupo = new THREE.Group();

    // --- Placa de apoio (encostada à parede) ---
    const placa = new THREE.Mesh(recursos.geometriaPlaca, recursos.materialMetal);
    placa.position.set(0, 0, tam * 0.015);
    grupo.add(placa);

    // --- Braço (rodado para o cilindro apontar para fora em +Z) ---
    const braco = new THREE.Mesh(recursos.geometriaBraco, recursos.materialMetal);
    braco.rotation.x = Math.PI / 2;
    braco.position.set(0, -tam * 0.025, tam * 0.030);
    grupo.add(braco);

    // --- Copo / pescoço entre o braço e o corpo da lanterna ---
    const copo = new THREE.Mesh(recursos.geometriaCopo, recursos.materialMetal);
    copo.position.set(0, tam * 0.015, tam * 0.075);
    grupo.add(copo);

    // Posição Z onde o corpo da lanterna está centrado (perto mas sem tocar a parede)
    const posicaoZLanterna = tam * 0.085;

    // Posições Y que empilham as peças da lanterna de baixo para cima
    const yBaseCorpo  = tam * 0.040;
    const yCentroCorpo = yBaseCorpo + tam * 0.070;  // ponto médio do tubo de vidro
    const yTopoCorpo   = yBaseCorpo + tam * 0.140;  // bordo superior do tubo de vidro

    // --- Coleira inferior ---
    const coleiraInferior = new THREE.Mesh(recursos.geometriaColeira, recursos.materialMetal);
    coleiraInferior.position.set(0, yBaseCorpo, posicaoZLanterna);
    grupo.add(coleiraInferior);

    // --- Tubo de vidro hexagonal (corpo principal da lanterna) ---
    const vidro = new THREE.Mesh(recursos.geometriaVidro, recursos.materialVidro);
    vidro.position.set(0, yCentroCorpo, posicaoZLanterna);
    grupo.add(vidro);

    // --- Seis barras metálicas, uma em cada canto da secção hexagonal ---
    const raioArestas = tam * 0.055;
    for (let i = 0; i < 6; i += 1) {
        const angulo = (i / 6) * Math.PI * 2;
        const aresta = new THREE.Mesh(recursos.geometriaAresta, recursos.materialMetal);
        aresta.position.set(
            Math.sin(angulo) * raioArestas,
            yCentroCorpo,
            posicaoZLanterna + Math.cos(angulo) * raioArestas
        );
        grupo.add(aresta);
    }

    // --- Coleira superior ---
    const coleiraSuperior = new THREE.Mesh(recursos.geometriaColeira, recursos.materialMetal);
    coleiraSuperior.position.set(0, yTopoCorpo, posicaoZLanterna);
    grupo.add(coleiraSuperior);

    // --- Tampa piramidal (base plana no yTopoCorpo, ponta aponta para cima) ---
    const capelo = new THREE.Mesh(recursos.geometriaCapelo, recursos.materialMetal);
    capelo.position.set(0, yTopoCorpo + tam * 0.0325, posicaoZLanterna);
    grupo.add(capelo);

    // --- Pequena esfera decorativa no vértice da tampa ---
    const esferaDecorativa = new THREE.Mesh(recursos.geometriaEsferaDecorativa, recursos.materialMetal);
    esferaDecorativa.position.set(0, yTopoCorpo + tam * 0.083, posicaoZLanterna);
    grupo.add(esferaDecorativa);

    // --- Lâmpada Edison luminosa no interior da lanterna ---
    const lampada = new THREE.Mesh(recursos.geometriaLampada, recursos.materialLampada);
    lampada.position.set(0, yCentroCorpo, posicaoZLanterna);
    grupo.add(lampada);

    // --- Luz pontual que ilumina a área em redor (raio de 3 células, queda quadrática) ---
    const luz = new THREE.PointLight(corLuz, intensidadeLuz, tam * 3.0, 2);
    luz.position.set(0, yCentroCorpo, posicaoZLanterna);
    grupo.add(luz);

    return { grupo, luz };
}

// ─────────────────────────────────────────────────────────────
// COLOCAÇÃO DOS CANDEEIROS
// ─────────────────────────────────────────────────────────────

/**
 * Cria e posiciona candeeiros de parede em locais específicos do labirinto.
 * Cada posição indica uma célula caminhável e em qual das quatro paredes
 * (norte / sul / este / oeste) o candeeiro deve ser montado.
 *
 * A função ignora qualquer posição onde a parede solicitada não existe
 * no layoutLabirinto, imprimindo um aviso em vez disso.
 *
 * @param {object}        opcoes
 * @param {number[][]}    opcoes.layoutLabirinto  - Grelha 2D: 1 = parede, 0 = caminhável.
 * @param {number}        opcoes.tamanhoCelula    - Tamanho em unidades do mundo de uma célula.
 * @param {number}        opcoes.alturaParede     - Altura das paredes.
 * @param {THREE.Object3D} opcoes.grupoDestino    - Grupo do Three.js onde os candeeiros são adicionados.
 * @param {object[]}      opcoes.posicoes         - Array de { row, column, wall }.
 * @param {number}        [opcoes.corLuz]         - Cor hexadecimal da luz de todos os candeeiros.
 * @param {number}        [opcoes.intensidadeLuz] - Brilho da luz de todos os candeeiros.
 */
export function colocarCandeeirosParede({ layoutLabirinto, tamanhoCelula, alturaParede, grupoDestino, posicoes, corLuz = 0xffd9a8, intensidadeLuz = 1.1 }) {
    if (!layoutLabirinto || !grupoDestino || !Array.isArray(posicoes)) {
        return;
    }

    const numLinhas  = layoutLabirinto.length;
    const numColunas = layoutLabirinto[0]?.length ?? 0;

    // Para cada ponto cardeal: qual célula vizinha deve ser parede,
    // para que lado a lanterna aponta, e a rotação Y a aplicar ao grupo.
    const direcoesParede = {
        norte: { linhaVizinha: -1, colunaVizinha:  0, normalX:  0, normalZ: -1, rotacaoY: 0 },
        sul:   { linhaVizinha:  1, colunaVizinha:  0, normalX:  0, normalZ:  1, rotacaoY: Math.PI },
        oeste: { linhaVizinha:  0, colunaVizinha: -1, normalX: -1, normalZ:  0, rotacaoY: Math.PI / 2 },
        este:  { linhaVizinha:  0, colunaVizinha:  1, normalX:  1, normalZ:  0, rotacaoY: -Math.PI / 2 }
    };

    // Regista as posições já usadas para evitar dois candeeiros no mesmo sítio
    const posicoesUsadas = new Set();

    const eParedeSolida = (linha, coluna) =>
        linha >= 0 && linha < numLinhas &&
        coluna >= 0 && coluna < numColunas &&
        layoutLabirinto[linha][coluna] === 1;

    for (const posicao of posicoes) {
        const { row: linha, column: coluna } = posicao;

        // Aceitar nomes em inglês (north/south/east/west) para compatibilidade com os dados existentes
        const nomeDirecaoEN  = String(posicao.wall ?? '').trim().toLowerCase();
        // Mapear inglês → português para aceder a direcoesParede
        const mapaInglesParaPortugues = { north: 'norte', south: 'sul', east: 'este', west: 'oeste' };
        const nomeDirecao = mapaInglesParaPortugues[nomeDirecaoEN] ?? nomeDirecaoEN;
        const direcao = direcoesParede[nomeDirecao];

        // Ignorar entradas com dados inválidos
        if (!direcao || !Number.isInteger(linha) || !Number.isInteger(coluna)) {
            continue;
        }

        // Ignorar duplicados
        const chaveUnica = `${linha},${coluna},${nomeDirecao}`;
        if (posicoesUsadas.has(chaveUnica)) {
            continue;
        }
        posicoesUsadas.add(chaveUnica);

        // Ignorar se não existir parede na direção pedida
        const linhaParede  = linha  + direcao.linhaVizinha;
        const colunaParede = coluna + direcao.colunaVizinha;
        if (!eParedeSolida(linhaParede, colunaParede)) {
            console.warn('Candeeiro ignorado — sem parede vizinha:', { linha, coluna, direcao: nomeDirecao });
            continue;
        }

        const { grupo } = criarCandeeiroParede(tamanhoCelula, corLuz, intensidadeLuz);

        // Empurrar o candeeiro ligeiramente para fora do centro da parede para ficar na superfície
        const deslocamentoSuperficie = tamanhoCelula * 0.5 - tamanhoCelula * 0.08;
        const xMundo = coluna * tamanhoCelula + direcao.normalX * deslocamentoSuperficie;
        const zMundo = linha  * tamanhoCelula + direcao.normalZ * deslocamentoSuperficie;

        grupo.position.set(xMundo, alturaParede * 0.72, zMundo);
        grupo.rotation.y = direcao.rotacaoY;
        grupoDestino.add(grupo);
    }
}
