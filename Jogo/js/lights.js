// lights.js
// Gere todas as luzes da cena num registo central.
//
// Cada luz é identificada por uma chave de texto (ex: 'gameAmbient').
// As teclas 1–5 do teclado alternam as luzes correspondentes.
//
// Usar intensity=0 em vez de visible=false é intencional: mudar visible
// força o Three.js a recompilar todos os shaders (NUM_DIR_LIGHTS muda),
// o que causa uma pausa visível. Com intensity=0 a luz desaparece
// sem qualquer recompilação.

let luzesAtivas = true;
let teclasNumericasRegistadas = false;

// Ordem fixa das luzes para mapeamento nas teclas 1–5
const ordemFixa = [
    'gameAmbient',
    'gameDirectional',
    'gamePointLights',
    'menuAmbient',
    'menuDirectional'
];

const registoLuzes          = new Map();  // chave → objeto de luz Three.js
const estadosLuzes          = new Map();  // chave → true/false (ligada/desligada individualmente)
const intensidadesOriginais = new Map();  // chave → intensidade original (restaurada ao ligar)

// Aplica o estado atual (luzesAtivas AND estado individual) a uma luz
function aplicarEstadoLuzPorChave(chave) {
    const luz = registoLuzes.get(chave);
    if (!luz) return;

    const estaAtiva = luzesAtivas && estadosLuzes.get(chave) !== false;

    // intensity=0 em vez de visible=false para evitar recompilação de shaders
    if (typeof luz.intensity === 'number') {
        luz.intensity = estaAtiva ? (intensidadesOriginais.get(chave) ?? 1) : 0;
    } else {
        // Grupos (ex: gamePointLights) não têm intensity — usar visibilidade
        luz.visible = estaAtiva;
    }
}

/**
 * Regista uma luz no sistema central e aplica o seu estado inicial.
 * Deve ser chamado imediatamente após criar a luz.
 *
 * @param {string}      chave - Identificador único da luz (ex: 'gameAmbient').
 * @param {THREE.Light} luz   - O objeto de luz Three.js a registar.
 * @returns {THREE.Light} A mesma luz passada (para encadeamento: registarLuz(...) → cena.add(...)).
 */
export function registarLuz(chave, luz) {
    if (!chave || !luz) return luz;

    registoLuzes.set(chave, luz);
    if (typeof luz.intensity === 'number') {
        intensidadesOriginais.set(chave, luz.intensity);
    }
    if (!estadosLuzes.has(chave)) {
        estadosLuzes.set(chave, true);
    }
    aplicarEstadoLuzPorChave(chave);
    return luz;
}

/**
 * Liga ou desliga uma luz específica pelo seu identificador.
 *
 * @param {string}  chave   - Identificador da luz.
 * @param {boolean} ativada - true para ligar, false para desligar.
 * @returns {boolean} true se a operação foi bem-sucedida.
 */
export function definirLuzAtivaPorChave(chave, ativada) {
    if (!chave || !registoLuzes.has(chave)) return false;
    estadosLuzes.set(chave, Boolean(ativada));
    aplicarEstadoLuzPorChave(chave);
    return true;
}

/**
 * Alterna o estado de uma luz (ligada ↔ desligada).
 *
 * @param {string} chave - Identificador da luz.
 * @returns {boolean} true se a operação foi bem-sucedida.
 */
export function alternarLuzPorChave(chave) {
    if (!chave || !registoLuzes.has(chave)) return false;
    const proximoEstado = !(estadosLuzes.get(chave) !== false);
    estadosLuzes.set(chave, proximoEstado);
    aplicarEstadoLuzPorChave(chave);
    return true;
}

/**
 * Liga ou desliga TODAS as luzes registadas de uma só vez.
 *
 * @param {boolean} ativadas - true para ligar todas, false para desligar todas.
 */
export function definirLuzesAtivas(ativadas) {
    luzesAtivas = Boolean(ativadas);
    for (const chave of registoLuzes.keys()) {
        aplicarEstadoLuzPorChave(chave);
    }
}

/**
 * Inverte o estado global de todas as luzes.
 *
 * @returns {boolean} O novo estado global (true = ligadas).
 */
export function alternarLuzes() {
    definirLuzesAtivas(!luzesAtivas);
    return luzesAtivas;
}

/**
 * Devolve true se as luzes estão globalmente ativas.
 *
 * @returns {boolean}
 */
export function obterLuzesAtivas() {
    return luzesAtivas;
}

/**
 * Devolve o número de luzes atualmente registadas.
 *
 * @returns {number}
 */
export function obterContagemLuzes() {
    return registoLuzes.size;
}

/**
 * Devolve a lista de mapeamentos luz ↔ tecla numérica para mostrar na UI de controlos.
 *
 * @returns {Array<{key: string, number: number, registered: boolean}>}
 */
export function obterMapeamentoLuzes() {
    return ordemFixa.map((chave, indice) => ({
        key:        chave,
        number:     indice + 1,
        registered: registoLuzes.has(chave)
    }));
}

/**
 * Associa as teclas numéricas 1–N ao sistema de luzes (uma vez apenas).
 * Premir a tecla 1 alterna a primeira luz da ordemFixa, etc.
 *
 * @param {EventTarget} alvo - O objeto ao qual adicionar o listener (por defeito: window).
 */
export function associarTeclasNumericasLuzes(alvo = window) {
    if (teclasNumericasRegistadas || !alvo?.addEventListener) return;

    teclasNumericasRegistadas = true;
    alvo.addEventListener('keydown', (evento) => {
        if (!evento?.key) return;
        if (evento.key < '1' || evento.key > String(ordemFixa.length)) return;

        const indice = Number(evento.key) - 1;
        const chave = ordemFixa[indice];
        if (chave) alternarLuzPorChave(chave);
    });
}
