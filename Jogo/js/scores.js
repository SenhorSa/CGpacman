// scores.js
// Responsável por guardar e carregar as pontuações dos jogadores no localStorage.
//
// As pontuações são guardadas como uma lista ordenada (melhor pontuação primeiro)
// com no máximo MAX_ENTRADAS entradas. Cada entrada regista a pontuação, o mapa
// jogado e se o jogo foi ganho ou perdido.

const CHAVE_ARMAZENAMENTO = 'pacman3d_scores';
const MAX_ENTRADAS = 10;

/**
 * Guarda uma nova pontuação no localStorage e devolve a classificação no Top 10.
 * Se já existir uma entrada idêntica (mesma pontuação, resultado e mapa), não guarda.
 *
 * @param {object} entrada
 * @param {number} entrada.pontuacao  - Pontuação total do jogador.
 * @param {string} entrada.idMapa     - Identificador do mapa jogado.
 * @param {string} entrada.nomeMapa   - Nome do mapa para mostrar na tabela.
 * @param {string} entrada.resultado  - 'win' se o jogador ganhou, 'lose' se perdeu.
 * @returns {number|null} Posição na tabela (1 = melhor), ou null se não entrou no Top 10.
 */
export function guardarPontuacao({ pontuacao, idMapa, nomeMapa, resultado }) {
    const pontuacoes = carregarPontuacoes();

    // Não registar se já existe uma entrada completamente igual
    const eDuplicado = pontuacoes.some(e => e.score === pontuacao && e.result === resultado && e.mapId === idMapa);
    if (eDuplicado) {
        return null;
    }

    // Adicionar a nova entrada usando as mesmas chaves do JSON armazenado (compatibilidade retroativa)
    pontuacoes.push({ score: pontuacao, mapId: idMapa, mapName: nomeMapa, result: resultado });

    // Ordenar por pontuação (descendente); empates: vitória antes de derrota
    pontuacoes.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ordem = { win: 0, lose: 1 };
        return (ordem[a.result] ?? 1) - (ordem[b.result] ?? 1);
    });

    // Manter apenas as melhores MAX_ENTRADAS pontuações
    const cortada = pontuacoes.slice(0, MAX_ENTRADAS);

    try {
        localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(cortada));
    } catch {
        // localStorage indisponível (modo privado sem permissão de escrita)
    }

    // Devolver a posição no top (1-indexado), ou null se ficou fora do top
    const classificacao = cortada.findIndex(e => e.score === pontuacao && e.result === resultado);
    return classificacao >= 0 ? classificacao + 1 : null;
}

/**
 * Lê todas as pontuações guardadas no localStorage.
 * Devolve sempre um array — nunca lança exceção.
 *
 * @returns {Array<{score: number, mapId: string, mapName: string, result: string}>}
 */
export function carregarPontuacoes() {
    try {
        const guardado = localStorage.getItem(CHAVE_ARMAZENAMENTO);
        const analisado = guardado ? JSON.parse(guardado) : [];
        return Array.isArray(analisado) ? analisado : [];
    } catch {
        // JSON corrompido ou localStorage inacessível
        return [];
    }
}
