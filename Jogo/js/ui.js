// ui.js
// Responsável por todos os elementos da interface durante o jogo.
//
// Este módulo gere:
//   - A etiqueta de pontuação ("Pontos: 120") mostrada no canto
//   - O temporizador de contagem decrescente do modo poder
//     (aparece quando uma moeda de poder é apanhada)
//   - O menu de pausa (tecla Escape abre; tem Continuar, Controlos, Sair)
//   - O ecrã de fim de jogo (mostrado em vitória ou derrota, com pontuação e posição)
//
// Nenhuma destas funções toca na cena 3D — apenas lêem e escrevem
// o HTML/CSS dos elementos DOM existentes.

import { guardarPontuacao } from './scores.js';

// ─────────────────────────────────────────────────────────────
// PONTUAÇÃO
// ─────────────────────────────────────────────────────────────

/**
 * Cria a etiqueta de pontuação e adiciona-a à página.
 * A etiqueta mostra o total de pontos em qualquer momento durante o jogo.
 *
 * @returns {HTMLElement} O elemento da etiqueta de pontuação.
 */
export function criarElementoPontuacao() {
    const elementoPontuacao = document.createElement('div');
    elementoPontuacao.className = 'score-pill';
    elementoPontuacao.textContent = 'Pontos: 0';
    document.body.appendChild(elementoPontuacao);
    return elementoPontuacao;
}

/**
 * Atualiza o texto dentro da etiqueta de pontuação.
 *
 * @param {HTMLElement} elementoPontuacao - O elemento da etiqueta.
 * @param {number}      valor             - O novo total de pontos a mostrar.
 */
export function atualizarPontuacao(elementoPontuacao, valor) {
    if (!elementoPontuacao) return;
    elementoPontuacao.textContent = `Pontos: ${valor}`;
}

// ─────────────────────────────────────────────────────────────
// TEMPORIZADOR DO MODO PODER
// Aparece quando o jogador apanha uma moeda de poder. Mostra
// uma contagem decrescente em segundos. Desaparece quando o
// modo poder termina.
// ─────────────────────────────────────────────────────────────

/**
 * Cria o elemento do temporizador e adiciona-o à página.
 * Começa escondido; é mostrado por mostrarTemporizador().
 *
 * @returns {HTMLElement} O elemento contentor do temporizador.
 */
export function criarElementoTemporizador() {
    const elementoTemporizador = document.createElement('div');
    elementoTemporizador.className = 'power-timer is-hidden';
    elementoTemporizador.innerHTML = `
        <span class="power-timer__clock" aria-hidden="true"></span>
        <span class="power-timer__value">10</span>
    `;
    document.body.appendChild(elementoTemporizador);
    return elementoTemporizador;
}

/**
 * Torna o temporizador visível e define o número inicial de segundos.
 *
 * @param {HTMLElement} elementoTemporizador - O elemento do temporizador.
 * @param {number}      segundosTotais       - Quantos segundos mostrar inicialmente.
 */
export function mostrarTemporizador(elementoTemporizador, segundosTotais) {
    if (!elementoTemporizador) return;
    elementoTemporizador.classList.remove('is-hidden');
    const spanValor = elementoTemporizador.querySelector('.power-timer__value');
    if (spanValor) spanValor.textContent = String(Math.ceil(segundosTotais));
}

/**
 * Esconde o temporizador.
 *
 * @param {HTMLElement} elementoTemporizador - O elemento do temporizador.
 */
export function esconderTemporizador(elementoTemporizador) {
    if (!elementoTemporizador) return;
    elementoTemporizador.classList.add('is-hidden');
}

// ─────────────────────────────────────────────────────────────
// MENU DE PAUSA
// O menu de pausa é uma sobreposição DOM que aparece ao premir Escape.
// Tem múltiplos sub-painéis: 'pause-main' e 'pause-controls'.
// ─────────────────────────────────────────────────────────────

/**
 * Lê todos os elementos DOM do menu de pausa da página.
 * Devolve null para qualquer elemento que não exista.
 *
 * @returns {object} Conjunto de referências DOM do menu de pausa.
 */
export function obterElementosMenuPausa() {
    const raizPausa = document.getElementById('pause-root');
    return {
        raizPausa,
        botaoVoltar:      document.getElementById('pause-back'),
        botaoContinuar:   document.getElementById('pause-continue'),
        botaoControlos:   document.getElementById('pause-controls'),
        botaoSair:        document.getElementById('pause-exit'),
        paineis: raizPausa ? Array.from(raizPausa.querySelectorAll('[data-view]')) : []
    };
}

/**
 * Mostra um sub-painel do menu de pausa e esconde todos os outros.
 * Também mostra/esconde o botão de voltar conforme o painel ativo.
 *
 * @param {string}      nomeVista   - 'pause-main' ou 'pause-controls'
 * @param {HTMLElement} raizPausa   - O elemento raiz do menu de pausa.
 * @param {HTMLElement[]} paineis   - Todos os painéis [data-view] dentro do raizPausa.
 * @param {HTMLElement} botaoVoltar - O botão de voltar dentro do menu de pausa.
 */
export function mostrarSubPainelPausa(nomeVista, raizPausa, paineis, botaoVoltar) {
    if (!raizPausa) return;

    for (const painel of paineis) {
        const eDestino = painel.getAttribute('data-view') === nomeVista;
        painel.classList.toggle('is-hidden', !eDestino);
    }

    // O botão de voltar só é necessário quando NÃO estamos no painel principal
    if (botaoVoltar) {
        botaoVoltar.classList.toggle('is-hidden', nomeVista === 'pause-main');
    }
}

/**
 * Abre o menu de pausa e congela o movimento do jogador.
 * Não faz nada se o jogo não estiver no estado 'a-jogar'.
 *
 * @param {object}      estadoJogo  - Objeto de estado mutável com .estado e .pausadoEm.
 * @param {object}      controlos   - Controlos do jogador (definidos a false para parar o movimento).
 * @param {HTMLElement} raizPausa   - O elemento raiz da pausa.
 * @param {HTMLElement[]} paineis
 * @param {HTMLElement} botaoVoltar
 */
export function abrirMenuPausa(estadoJogo, controlos, raizPausa, paineis, botaoVoltar) {
    if (!raizPausa || estadoJogo.estado !== 'a-jogar') return;

    estadoJogo.estado    = 'pausado';
    estadoJogo.pausadoEm = performance.now();
    raizPausa.classList.remove('is-hidden');
    mostrarSubPainelPausa('pause-main', raizPausa, paineis, botaoVoltar);

    // Parar todo o movimento para o jogador não deslizar depois de pausar
    controlos.forward  = false;
    controlos.backward = false;
    controlos.left     = false;
    controlos.right    = false;
    controlos.dragging = false;
}

/**
 * Fecha o menu de pausa e retoma o jogo.
 * Se o modo poder estava ativo quando se pausou, o temporizador é estendido
 * pelo tempo da pausa, para o jogador não perder tempo injustamente.
 *
 * @param {object}      estadoJogo  - Objeto de estado mutável com .estado e .pausadoEm.
 * @param {object}      estadoPoder - Objeto mutável com .ativo e .expiraEm.
 * @param {HTMLElement} raizPausa   - O elemento raiz da pausa.
 */
export function fecharMenuPausa(estadoJogo, estadoPoder, raizPausa) {
    if (!raizPausa || estadoJogo.estado !== 'pausado') return;

    const agora = performance.now();

    // Estender o prazo do modo poder pelo tempo que o jogo esteve pausado
    if (estadoPoder.ativo && estadoJogo.pausadoEm > 0) {
        estadoPoder.expiraEm += agora - estadoJogo.pausadoEm;
    }

    estadoJogo.pausadoEm = 0;
    estadoJogo.estado    = 'a-jogar';
    raizPausa.classList.add('is-hidden');
}

// ─────────────────────────────────────────────────────────────
// ECRÃ DE FIM DE JOGO
// ─────────────────────────────────────────────────────────────

/**
 * Lê todos os elementos DOM do ecrã de fim de jogo da página.
 *
 * @returns {object} Conjunto de referências DOM do fim de jogo.
 */
export function obterElementosFimJogo() {
    return {
        raizFimJogo:      document.getElementById('gameover-root'),
        tituloFimJogo:    document.getElementById('gameover-title'),
        pontuacaoFimJogo: document.getElementById('gameover-score'),
        botaoNovoJogo:    document.getElementById('gameover-new'),
        botaoSairFimJogo: document.getElementById('gameover-exit')
    };
}

/**
 * Termina o jogo: guarda a pontuação e mostra o ecrã de fim de jogo
 * com o título adequado, pontuação final e posição no top.
 *
 * @param {'vitoria'|'derrota'} resultado      - Se o jogador ganhou ou perdeu.
 * @param {number}        pontuacaoTotal       - Pontuação final do jogador.
 * @param {object}        configuracaoMapa     - O mapa jogado (precisa de .id e .name).
 * @param {object}        estadoJogo           - Estado mutável — .estado é definido como 'terminado'.
 * @param {object}        estadoPoder          - Estado mutável — .ativo é definido como false.
 * @param {HTMLElement}   elementoTemporizador - Temporizador (escondido ao terminar).
 * @param {HTMLElement}   raizPausa            - Menu de pausa (escondido ao terminar).
 * @param {object}        elementosFimJogo     - Conjunto DOM de obterElementosFimJogo().
 */
export function terminarJogo(resultado, pontuacaoTotal, configuracaoMapa, estadoJogo, estadoPoder, elementoTemporizador, raizPausa, elementosFimJogo) {
    // Marcar o jogo como terminado para parar o ciclo de atualização
    estadoJogo.estado = 'terminado';
    estadoPoder.ativo = false;

    // Esconder sobreposições que possam estar visíveis
    esconderTemporizador(elementoTemporizador);
    raizPausa?.classList.add('is-hidden');

    // Guardar a pontuação no localStorage e obter a posição no top (1-10, ou null)
    const classificacao = guardarPontuacao({
        pontuacao: pontuacaoTotal,
        idMapa:    configuracaoMapa.id,
        nomeMapa:  configuracaoMapa.name,
        resultado: resultado === 'vitoria' ? 'win' : 'lose'
    });

    const { raizFimJogo, tituloFimJogo, pontuacaoFimJogo } = elementosFimJogo;
    if (!raizFimJogo) return;

    const eVitoria = resultado === 'vitoria';
    if (tituloFimJogo) {
        tituloFimJogo.textContent = eVitoria ? 'Parabens!! Vitoria' : 'Game Over';
    }

    if (pontuacaoFimJogo) {
        const textoClassificacao = classificacao !== null ? `  •  #${classificacao} no Top 10` : '';
        pontuacaoFimJogo.textContent = `Pontos: ${pontuacaoTotal}${textoClassificacao}`;
    }

    raizFimJogo.classList.remove('is-hidden');
}
