// gameplay.js
// Responsável pelas mecânicas centrais do jogo que acontecem em cada fotograma.
//
// Este módulo gere:
//   - Troca do modo dos fantasmas (vaguear vs perseguir) controlada por
//     uma animação de lançamento de moeda
//   - Modo poder: ativado ao apanhar uma moeda de poder brilhante; faz
//     os fantasmas fugirem e dá pontos bónus por cada fantasma comido
//   - Deteção de colisão entre o jogador e os fantasmas
//   - O widget de lançamento de moeda: uma pequena animação CSS 3D de
//     uma moeda que revela se os fantasmas vão vaguear ou perseguir
//
// Nenhuma destas funções conhece o renderizador 3D. Trabalham com
// números simples, objetos de estado e alguns elementos DOM.

// ─────────────────────────────────────────────────────────────
// WIDGET DE LANÇAMENTO DE MOEDA
// Uma pequena div HTML estilizada como uma moeda que roda em 3D
// (perspetiva CSS + rotateY) para revelar o próximo modo dos fantasmas.
// Frente mostra "P" (Perseguir), verso mostra "V" (Vaguear).
// ─────────────────────────────────────────────────────────────

/**
 * Cria o widget de lançamento de moeda como elementos DOM e adiciona-o à página.
 * O widget está escondido por padrão e só aparece durante um lançamento.
 *
 * @returns {{
 *   contentorMoeda: HTMLElement,
 *   interiorMoeda:  HTMLElement
 * }}
 */
export function criarWidgetMoeda() {
    // Contentor exterior — fornece a perspetiva CSS (efeito de profundidade)
    const contentorMoeda = document.createElement('div');
    contentorMoeda.style.position    = 'fixed';
    contentorMoeda.style.top         = '8px';
    contentorMoeda.style.left        = '50%';
    contentorMoeda.style.transform   = 'translateX(-50%)';
    contentorMoeda.style.width       = '52px';
    contentorMoeda.style.height      = '52px';
    contentorMoeda.style.perspective = '600px';
    contentorMoeda.style.zIndex      = '10';
    contentorMoeda.style.display     = 'none';  // escondido até ocorrer um lançamento

    // Contentor interior — é este elemento que roda de facto
    const interiorMoeda = document.createElement('div');
    interiorMoeda.style.width          = '100%';
    interiorMoeda.style.height         = '100%';
    interiorMoeda.style.position       = 'relative';
    interiorMoeda.style.transformStyle = 'preserve-3d';    // filhos mantêm posições 3D
    interiorMoeda.style.transform      = 'rotateY(0deg)';

    // Estilo partilhado pelas duas faces da moeda
    const estiloFace = {
        position:           'absolute',
        inset:              '0',
        display:            'flex',
        alignItems:         'center',
        justifyContent:     'center',
        background:         '#f8fafc',
        border:             '2px solid #0f172a',
        borderRadius:       '50%',
        color:              '#0f172a',
        fontWeight:         '700',
        fontSize:           '20px',
        backfaceVisibility: 'hidden'  // cada face é invisível quando vira as costas à câmara
    };

    // Face da frente: mostra 'P' (Perseguir)
    const frenteMoeda = document.createElement('div');
    frenteMoeda.textContent = 'P';
    Object.assign(frenteMoeda.style, estiloFace);

    // Face de trás: mostra 'V' (Vaguear)
    // Começa rodada 180° para ficar virada para trás (invisível quando a moeda não foi lançada)
    const traseiraMoeda = document.createElement('div');
    traseiraMoeda.textContent = 'V';
    Object.assign(traseiraMoeda.style, { ...estiloFace, transform: 'rotateY(180deg)' });

    interiorMoeda.appendChild(frenteMoeda);
    interiorMoeda.appendChild(traseiraMoeda);
    contentorMoeda.appendChild(interiorMoeda);
    document.body.appendChild(contentorMoeda);

    return { contentorMoeda, interiorMoeda };
}

// ─────────────────────────────────────────────────────────────
// ESTADO DO MODO DOS FANTASMAS
// Controla se os fantasmas estão a vaguear (andar aleatoriamente)
// ou a perseguir (caçar ativamente o jogador).
// ─────────────────────────────────────────────────────────────

/**
 * Cria o estado mutável do modo dos fantasmas.
 * pesoPersseguicao é a probabilidade (0–1) de o próximo lançamento cair em Perseguir.
 * Ajusta-se automaticamente após cada lançamento (mesmo resultado → mesma probabilidade;
 * resultado diferente → repõe em 50%).
 *
 * @param {object} configMoeda - Objeto de configuração com passoWeight, pesoMinimo, pesoMaximo.
 * @returns {{
 *   modoFantasma:     string,
 *   pesoPerseguicao:  number,
 *   rotacaoMoeda:     number,
 *   idAnimacaoMoeda:  number | null,
 *   idTimeoutMoeda:   number | null
 * }}
 */
export function criarEstadoModoFantasma(configMoeda) {
    return {
        modoFantasma:    'roam',  // modo atual: 'roam' (vaguear) ou 'chase' (perseguir)
        pesoPerseguicao: 0.5,     // probabilidade de cair em perseguir (50% no início)
        rotacaoMoeda:    0,       // ângulo atual de rotação CSS da moeda, em graus
        idAnimacaoMoeda: null,    // handle de requestAnimationFrame para a animação
        idTimeoutMoeda:  null     // handle de setTimeout para o atraso de revelação
    };
}

/**
 * Escolhe aleatoriamente o próximo modo dos fantasmas e ajusta o peso para o futuro.
 * Se o resultado for igual ao anterior, a probabilidade do mesmo lado diminui ligeiramente.
 * Se for diferente, o peso repõe-se em 50%.
 *
 * @param {object} estadoModoFantasma - Objeto de estado mutável de criarEstadoModoFantasma().
 * @param {object} configMoeda        - Definições com passoWeight, pesoMinimo, pesoMaximo.
 * @returns {'roam' | 'chase'}        - O modo recém-selecionado.
 */
export function escolherProximoModoFantasma(estadoModoFantasma, configMoeda) {
    const sorteio    = Math.random();
    const proximoModo = sorteio < estadoModoFantasma.pesoPerseguicao ? 'chase' : 'roam';

    if (proximoModo !== estadoModoFantasma.modoFantasma) {
        // Resultado diferente — repor probabilidade justa de 50/50
        estadoModoFantasma.pesoPerseguicao = 0.5;
    } else if (proximoModo === 'chase') {
        // Perseguir de novo — tornar perseguir ligeiramente menos provável da próxima vez
        estadoModoFantasma.pesoPerseguicao = Math.max(
            configMoeda.minWeight,
            estadoModoFantasma.pesoPerseguicao - configMoeda.weightStep
        );
    } else {
        // Vaguear de novo — tornar vaguear ligeiramente menos provável da próxima vez
        estadoModoFantasma.pesoPerseguicao = Math.min(
            configMoeda.maxWeight,
            estadoModoFantasma.pesoPerseguicao + configMoeda.weightStep
        );
    }

    estadoModoFantasma.modoFantasma = proximoModo;
    return proximoModo;
}

// ─────────────────────────────────────────────────────────────
// ANIMAÇÃO DO LANÇAMENTO DE MOEDA
// Usa requestAnimationFrame para rodar suavemente a moeda do ângulo
// atual até ao ângulo destino ao longo de ~1.5 segundos.
// ─────────────────────────────────────────────────────────────

/**
 * Anima a moeda a rodar do ângulo atual até aoGrausDestino.
 * Usa uma curva de easing cúbico para a moeda desacelerar suavemente.
 * Após a rotação, aguarda resultadoMs antes de esconder a moeda.
 *
 * @param {HTMLElement} interiorMoeda     - A div interior que recebe a rotação CSS.
 * @param {HTMLElement} contentorMoeda    - A div exterior (escondida após a rotação).
 * @param {object}      estadoModoFantasma - Estado mutável — rotacaoMoeda e idAnimacaoMoeda são atualizados.
 * @param {number}      grausDestino      - Ângulo final de rotação em graus.
 * @param {object}      configMoeda       - Definições com flipDurationMs e resultHoldMs.
 */
export function animarLancamentoMoeda(interiorMoeda, contentorMoeda, estadoModoFantasma, grausDestino, configMoeda) {
    // Cancelar qualquer animação de rotação ainda em curso
    if (estadoModoFantasma.idAnimacaoMoeda) {
        cancelAnimationFrame(estadoModoFantasma.idAnimacaoMoeda);
    }

    const rotacaoInicio = estadoModoFantasma.rotacaoMoeda;
    const tempoInicio   = performance.now();
    const duracao       = configMoeda.flipDurationMs;

    // Esta função interna executa em cada fotograma até a rotação estar completa
    function animarFotograma(tempoAtual) {
        const progresso = Math.min((tempoAtual - tempoInicio) / duracao, 1);

        // Easing cúbico de saída: começa rápido, abranda no final (como uma moeda real)
        const suavizado = 1 - Math.pow(1 - progresso, 3);
        const anguloAtual = rotacaoInicio + (grausDestino - rotacaoInicio) * suavizado;
        interiorMoeda.style.transform = `rotateY(${anguloAtual}deg)`;

        if (progresso < 1) {
            // Ainda a animar — pedir o próximo fotograma
            estadoModoFantasma.idAnimacaoMoeda = requestAnimationFrame(animarFotograma);
            return;
        }

        // Animação completa — fixar no ângulo exato e agendar para esconder
        estadoModoFantasma.rotacaoMoeda = grausDestino % 360;
        interiorMoeda.style.transform = `rotateY(${estadoModoFantasma.rotacaoMoeda}deg)`;
        setTimeout(() => {
            contentorMoeda.style.display = 'none';
        }, configMoeda.resultHoldMs);
        estadoModoFantasma.idAnimacaoMoeda = null;
    }

    estadoModoFantasma.idAnimacaoMoeda = requestAnimationFrame(animarFotograma);
}

/**
 * Desencadeia um ciclo completo de lançamento de moeda: escolhe o próximo modo,
 * mostra a moeda, aguarda brevemente (revealDelayMs) e depois anima a rotação
 * para cair na face correta.
 *
 * Não faz nada se o modo poder estiver ativo (lançar seria confuso durante a fuga)
 * ou se o jogo não estiver no estado 'a-jogar'.
 *
 * @param {object}      estadoModoFantasma - Objeto de estado mutável de criarEstadoModoFantasma().
 * @param {object}      configMoeda        - Todas as definições de tempo.
 * @param {object}      estadoPoder        - Estado do modo poder — verificar o flag .ativo.
 * @param {object}      estadoJogo         - Estado do jogo — verificar .estado === 'a-jogar'.
 * @param {HTMLElement} contentorMoeda     - Div exterior da moeda (mostrada/escondida aqui).
 * @param {HTMLElement} interiorMoeda      - Div interior da moeda (rodada aqui).
 */
export function iniciarCicloMoeda(estadoModoFantasma, configMoeda, estadoPoder, estadoJogo, contentorMoeda, interiorMoeda) {
    if (estadoPoder.ativo || estadoJogo.estado !== 'a-jogar') {
        return;
    }

    const proximoModo = escolherProximoModoFantasma(estadoModoFantasma, configMoeda);

    // Face a 0°   = frente ('P' = Perseguir)
    // Face a 180° = verso  ('V' = Vaguear)
    // Adicionar 720° (duas voltas completas) faz a moeda rodar visivelmente antes de parar
    const anguloFaceDestino = proximoModo === 'chase' ? 0 : 180;
    const rotacaoDestino    = anguloFaceDestino + 720;

    // Mostrar a moeda imediatamente
    contentorMoeda.style.display = 'block';

    // Cancelar qualquer lançamento pendente que ainda não começou
    if (estadoModoFantasma.idTimeoutMoeda) {
        clearTimeout(estadoModoFantasma.idTimeoutMoeda);
    }

    // Aguardar brevemente antes de começar a rotação (a moeda fica parada um momento)
    estadoModoFantasma.idTimeoutMoeda = setTimeout(() => {
        animarLancamentoMoeda(interiorMoeda, contentorMoeda, estadoModoFantasma, rotacaoDestino, configMoeda);
    }, configMoeda.revealDelayMs);
}

// ─────────────────────────────────────────────────────────────
// MODO PODER
// Ativado quando o jogador toca numa moeda de poder brilhante.
// Durante configPoder.durationMs milissegundos, os fantasmas fogem
// em vez de perseguir, e comer um fantasma dá pontos bónus crescentes.
// ─────────────────────────────────────────────────────────────

/**
 * Cria o estado mutável do modo poder.
 *
 * @returns {{
 *   ativo:     boolean,
 *   expiraEm:  number,
 *   sequenciaFantasmas: number
 * }}
 */
export function criarEstadoPoder() {
    return {
        ativo:              false,  // se o modo poder está a decorrer
        expiraEm:           0,      // timestamp de performance.now() em que o modo poder termina
        sequenciaFantasmas: 0       // fantasmas comidos neste modo poder (afeta o bónus)
    };
}

/**
 * Ativa o modo poder: define o prazo de expiração, coloca todos os fantasmas vivos
 * em modo de fuga, esconde o widget da moeda e mostra o temporizador de contagem.
 *
 * @param {number}        agora              - Timestamp atual de performance.now().
 * @param {object}        estadoPoder        - Estado mutável de criarEstadoPoder().
 * @param {object}        configPoder        - Definições com durationMs.
 * @param {object}        estadoModoFantasma - Estado mutável — idTimeoutMoeda é limpo.
 * @param {THREE.Object3D[]} fantasmas       - Todos os objetos 3D dos fantasmas na cena.
 * @param {THREE.Object3D[]} modelos2DFantasmas - Todos os objetos 2D planos dos fantasmas.
 * @param {HTMLElement}   contentorMoeda     - Widget da moeda (escondido durante o modo poder).
 * @param {HTMLElement}   elementoTemporizador - Temporizador (mostrado durante o modo poder).
 * @param {Function}      setGhostState      - Função para mudar o estado visual de um fantasma 3D.
 * @param {Function}      setGhost2DState    - Função para mudar o estado visual de um fantasma 2D.
 */
export function ativarPoder(
    agora, estadoPoder, configPoder, estadoModoFantasma,
    fantasmas, modelos2DFantasmas,
    contentorMoeda, elementoTemporizador,
    setGhostState, setGhost2DState
) {
    estadoPoder.ativo              = true;
    estadoPoder.expiraEm           = agora + configPoder.durationMs;
    estadoPoder.sequenciaFantasmas = 0;

    // Esconder o widget da moeda — o modo dos fantasmas não muda durante o poder
    contentorMoeda.style.display = 'none';
    if (estadoModoFantasma.idTimeoutMoeda) {
        clearTimeout(estadoModoFantasma.idTimeoutMoeda);
        estadoModoFantasma.idTimeoutMoeda = null;
    }

    // Mostrar o temporizador de contagem decrescente
    if (elementoTemporizador) {
        elementoTemporizador.classList.remove('is-hidden');
        const spanValor = elementoTemporizador.querySelector('.power-timer__value');
        if (spanValor) spanValor.textContent = String(Math.ceil(configPoder.durationMs / 100));
    }

    // Colocar todos os fantasmas ainda vivos em modo de fuga
    // (eyes = fantasma já comido, ignorar)
    for (const fantasma of fantasmas) {
        if (fantasma.userData.state !== 'eyes') {
            setGhostState(fantasma, 'scared');
        }
        // Repor a direção para que os fantasmas comecem a fugir imediatamente
        fantasma.userData.canTurn  = true;
        fantasma.userData.direction = { row: 0, column: 0 };
    }

    // Atualizar os sprites 2D dos fantasmas para o aspeto assustado
    fantasmas.forEach((fantasma, indice) => {
        if (fantasma.userData.state === 'scared') {
            setGhost2DState(modelos2DFantasmas[indice], 'scared', fantasma.userData.color);
        }
    });
}

/**
 * Chamada em cada fotograma enquanto o modo poder está ativo.
 * Atualiza o temporizador e desativa o modo poder quando o tempo esgota.
 *
 * @param {number}        agora              - Timestamp atual de performance.now().
 * @param {object}        estadoPoder        - Estado mutável do modo poder.
 * @param {HTMLElement}   elementoTemporizador - O elemento temporizador a atualizar.
 * @param {THREE.Object3D[]} fantasmas       - Todos os fantasmas 3D.
 * @param {THREE.Object3D[]} modelos2DFantasmas - Todos os fantasmas 2D.
 * @param {Function}      setGhostState      - Função para mudar o estado de um fantasma 3D.
 * @param {Function}      setGhost2DState    - Função para mudar o estado de um fantasma 2D.
 */
export function atualizarPoder(
    agora, estadoPoder, elementoTemporizador,
    fantasmas, modelos2DFantasmas,
    setGhostState, setGhost2DState
) {
    if (!estadoPoder.ativo) return;

    const msRestantes = Math.max(0, estadoPoder.expiraEm - agora);

    // Atualizar a contagem exibida
    const spanValor = elementoTemporizador?.querySelector('.power-timer__value');
    if (spanValor) spanValor.textContent = String(Math.ceil(msRestantes / 1000));

    if (msRestantes > 0) return;  // ainda a decorrer

    // Modo poder terminou — desativar
    estadoPoder.ativo              = false;
    estadoPoder.sequenciaFantasmas = 0;
    elementoTemporizador?.classList.add('is-hidden');

    // Devolver os fantasmas assustados ao estado normal
    for (const fantasma of fantasmas) {
        if (fantasma.userData.state === 'scared') {
            setGhostState(fantasma, 'normal');
        }
    }
    for (const fantasma2D of modelos2DFantasmas) {
        if (fantasma2D.userData.state === 'scared') {
            setGhost2DState(fantasma2D, 'normal', fantasma2D.userData.baseColor);
        }
    }
}

// ─────────────────────────────────────────────────────────────
// DETEÇÃO DE COLISÃO
// ─────────────────────────────────────────────────────────────

/**
 * Encontra o índice do primeiro fantasma cujo corpo sobrepõe a posição do jogador.
 * Usa colisão simples círculo-círculo (tanto o jogador como os fantasmas são circulares).
 * Devolve -1 se nenhum fantasma estiver a tocar o jogador.
 *
 * @param {number}  xJogador     - Posição X do jogador no mundo.
 * @param {number}  zJogador     - Posição Z do jogador no mundo.
 * @param {number}  raioJogador  - Raio de colisão do jogador.
 * @param {THREE.Object3D[]} fantasmas - Todos os objetos fantasma (têm .position e .userData.radius).
 * @returns {number} Índice do fantasma em colisão, ou -1 se nenhum.
 */
export function obterIndiceColisaoFantasma(xJogador, zJogador, raioJogador, fantasmas) {
    for (let indice = 0; indice < fantasmas.length; indice += 1) {
        const fantasma    = fantasmas[indice];
        const raioFantasma = fantasma.userData.radius ?? 0;

        const deltaX = xJogador - fantasma.position.x;
        const deltaZ = zJogador - fantasma.position.z;
        const separacaoMinima = raioJogador + raioFantasma;

        // Comparar distâncias ao quadrado (evita a operação de raiz quadrada, mais eficiente)
        if (deltaX * deltaX + deltaZ * deltaZ <= separacaoMinima * separacaoMinima) {
            return indice;
        }
    }
    return -1;
}

// ─────────────────────────────────────────────────────────────
// AUXILIAR DE ROTAÇÃO SUAVE
// ─────────────────────────────────────────────────────────────

/**
 * Move um ângulo (em radianos) de anguloAtual em direção a anguloDestino
 * no máximo passoMaximo radianos.
 * Toma sempre o caminho mais curto em volta do círculo (trata o salto 0°/360°).
 * Usado para rodar suavemente o modelo do Pacman para a direção de movimento.
 *
 * @param {number} anguloAtual  - O ângulo atual em radianos.
 * @param {number} anguloDestino - O ângulo pretendido em radianos.
 * @param {number} passoMaximo  - Máximo de radianos a rodar num fotograma.
 * @returns {number} O novo ângulo após avançar em direção ao destino.
 */
export function avancarParaAngulo(anguloAtual, anguloDestino, passoMaximo) {
    // atan2(sin, cos) dá a diferença angular com sinal mais curta em [-π, +π]
    const diferenca = Math.atan2(
        Math.sin(anguloDestino - anguloAtual),
        Math.cos(anguloDestino - anguloAtual)
    );

    if (Math.abs(diferenca) <= passoMaximo) {
        return anguloDestino;  // suficientemente perto — encaixar no destino
    }

    return anguloAtual + Math.sign(diferenca) * passoMaximo;
}
