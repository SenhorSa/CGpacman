/**
 * @param {float} x Valor para transalção no eixo do X
 * @param {float} y Valor para transalção no eixo do y
 * @param {float} z Valor para transalção no eixo do z
 */

function CriarMatrizTranslacao(x,y,z)
{
    return [
        [1,  0,  0,  x],
        [0,  1,  0,  y],
        [0,  0,  1,  z],
        [0,  0,  0,  1]
    ];
}

/**
 * @param {float} x Valor para transalção no eixo do X
 * @param {float} y Valor para transalção no eixo do y
 * @param {float} z Valor para transalção no eixo do z
 */

function CriarMatrizEscala(x,y,z)
{
    return[
        [x,  0,  0,  0],
        [0,  y,  0,  0],
        [0,  0,  z,  0],
        [0,  0,  0,  1]
    ]
}

/**
 * @param {float} angulo Ângulo em graus para rodar no eixo do X
 */
function CriarMatrizRotacaoX(angulo)
{
    // Seno e cosseno são calculados em radianos, logo é necessário converter de graus
    // para radianos utilizando a linha a baixo.
    var radianos = angulo * Math.PI / 180;

    // Matriz final de Rotação no eixo do X
    return [
        [1, 0, 0, 0],
        [0, Math.cos(radianos), -Math.sin(radianos), 0],
        [0, Math.sin(radianos),  Math.cos(radianos), 0],
        [0, 0, 0, 1]
    ];
}

/**
 * @param {float} angulo Ângulo em graus para rodar no eixo do Y
 */
function CriarMatrizRotacaoY(angulo)
{
    // Seno e cosseno são calculados em radianos, logo é necessário converter de graus
    // para radianos utilizando a linha a baixo.
    var radianos = angulo * Math.PI / 180;

    // Matriz final de Rotação no eixo do Y
    return [
        [ Math.cos(radianos), 0, Math.sin(radianos), 0],
        [0, 1, 0, 0],
        [-Math.sin(radianos), 0, Math.cos(radianos), 0],
        [0, 0, 0, 1]
    ];
}

/**
 * @param {float} angulo Ângulo em graus para rodar no eixo do Z
 */
function CriarMatrizRotacaoZ(angulo)
{
    // Seno e cosseno são calculados em radianos, logo é necessário converter de graus
    // para radianos utilizando a linha a baixo.
    var radianos = angulo * Math.PI / 180;

    // Matriz final de Rotação no eixo do Z
    return [
        [Math.cos(radianos), -Math.sin(radianos), 0, 0],
        [Math.sin(radianos),  Math.cos(radianos), 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];
}